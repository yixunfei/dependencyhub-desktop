import { spawn } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import { registryHttpGet } from './registryHttp'
import { resolveShellFreeCommand, runLoggedCommand } from './commandRunner'
import { terminateProcessTree } from './processTree'
import { writeFileAtomic } from './atomicWrite'
import { setCommandLogWindow } from './commandLogger'
import { resolveToolBin } from './toolchain'
import { acceptsNpmReadExit, requireNpmReadResult, type NpmReadKind } from './npmReadResult'
import { checkNpmSelfInstall } from './npmRuntime'

const CACHE_TTL = 10 * 60 * 1000
const packageInfoCache = new Map<string, { expiresAt: number; value: any }>()
const packageSizeCache = new Map<string, { expiresAt: number; value: any }>()
const versionMetadataCache = new Map<string, { expiresAt: number; value: any }>()

export function setNpmServiceWindow(window: BrowserWindow | null) {
  setCommandLogWindow(window)
}

function getCached<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string): T | null {
  const item = cache.get(key)
  if (!item) return null
  if (item.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return item.value
}

function setCached<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T): T {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL })
  return value
}

function parseJson(stdout: string, fallback: any = null): any {
  if (!stdout.trim()) return fallback
  try {
    return JSON.parse(stdout)
  } catch {
    return fallback
  }
}

function parseJsonRequired<T = unknown>(stdout: string, operation: string): T {
  if (!stdout.trim()) throw new Error(`${operation} returned no JSON output`)
  try {
    return JSON.parse(stdout) as T
  } catch (error) {
    throw new Error(`${operation} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function normalizePackageSpec(packageName: string, version?: string): string {
  const name = packageName.trim()
  if (!name || name.startsWith('-')) throw new Error('A package name is required')
  if (!version) return name
  const versionMark = name.indexOf('@', name.startsWith('@') ? 1 : 0)
  if (versionMark > 0) throw new Error('Specify the version either in the package name or in the version field')
  return `${name}@${version}`
}

function registryPackageUrl(packageName: string, version = 'latest'): string {
  return `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`
}

function httpsGet(url: string): Promise<string> {
  return registryHttpGet(url)
}

export interface NpmDependencyStatus {
  type: 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies'
  status: 'installed' | 'missing' | 'invalid' | 'extraneous' | 'peer-conflict'
  version?: string
  problems?: string[]
}

export interface NpmListResult {
  name?: string
  version?: string
  dependencies?: Record<string, any>
  problems?: string[]
  manifest?: Record<string, Record<string, string>>
  statuses?: Record<string, NpmDependencyStatus>
  error?: string
}

export function classifyNpmDependencies(
  manifest: Record<string, Record<string, string>>,
  installed: Record<string, any>,
  problems: string[] = []
): Record<string, NpmDependencyStatus> {
  const result: Record<string, NpmDependencyStatus> = {}
  const typeOrder = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const
  for (const type of typeOrder) {
    for (const [name] of Object.entries(manifest[type] || {})) {
      const node = installed[name]
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const matchingProblems = problems.filter((problem) => {
        const text = problem.toLowerCase()
        const packagePattern = new RegExp(`(?:^|[^a-z0-9._-])${escapedName.toLowerCase()}(?:$|[^a-z0-9._-])`)
        return packagePattern.test(text)
      })
      const peerConflict = matchingProblems.some((problem) => /peer|eresolve/i.test(problem))
      const status = !node || node.missing ? 'missing' : peerConflict ? 'peer-conflict' : node.invalid || matchingProblems.some((problem) => /invalid|missing/i.test(problem)) ? 'invalid' : 'installed'
      if (!result[name] || type === 'optionalDependencies' || type === 'peerDependencies') {
        result[name] = { type, status, version: node?.version, problems: matchingProblems }
      }
    }
  }
  for (const [name, node] of Object.entries(installed)) {
    if (!result[name]) result[name] = { type: 'dependencies', status: 'extraneous', version: node?.version, problems: [`${name} is extraneous`] }
  }
  return result
}

function collectNpmTree(tree: any): { installed: Record<string, any>; problems: string[] } {
  const installed: Record<string, any> = {}
  const problems: string[] = [...(Array.isArray(tree?.problems) ? tree.problems : [])]
  const walk = (dependencies: Record<string, any> | undefined) => {
    for (const [name, node] of Object.entries(dependencies || {})) {
      const value = node && typeof node === 'object' ? node as Record<string, any> : {}
      installed[name] = value
      if (Array.isArray(value.problems)) problems.push(...value.problems.map(String))
      if (value.invalid) problems.push(`${name}: invalid`)
      if (value.extraneous) problems.push(`${name}: extraneous`)
      walk(value.dependencies)
    }
  }
  walk(tree?.dependencies)
  return { installed, problems }
}

async function readNpmManifest(cwd: string): Promise<Record<string, Record<string, string>>> {
  try {
    // Windows editors may emit a UTF-8 BOM; without stripping it JSON.parse
    // fails and every declared dependency would silently look "missing".
    const raw = (await readFile(join(cwd, 'package.json'), 'utf8')).replace(/^\uFEFF/, '')
    const value = JSON.parse(raw)
    return {
      dependencies: value.dependencies || {},
      devDependencies: value.devDependencies || {},
      optionalDependencies: value.optionalDependencies || {},
      peerDependencies: value.peerDependencies || {}
    }
  } catch {
    return {}
  }
}

export class NpmService {
  private async executeNpm(args: string[], cwd?: string, readKind?: NpmReadKind): Promise<{ stdout: string; stderr: string }> {
    return await runLoggedCommand(await resolveToolBin('npm', cwd), args, {
      cwd,
      maxBuffer: 1024 * 1024 * 10,
      env: { ...process.env },
      displayBin: 'npm',
      acceptExitCode: readKind ? (code, output) => acceptsNpmReadExit(readKind, code, output.stdout) : undefined
    })
  }

  private async readNpm(args: string[], kind: NpmReadKind, cwd?: string): Promise<any> {
    const { stdout } = await this.executeNpm(args, cwd, kind)
    return requireNpmReadResult(stdout, kind)
  }

  async search(query: string, limit?: number): Promise<any[]> {
    const command = ['search', query, '--json', '--long']
    if (limit && Number.isFinite(limit)) {
      command.push(`--searchlimit=${Math.max(1, Math.min(Math.floor(limit), 250))}`)
    }
    const { stdout } = await this.executeNpm(command)
    const result = parseJsonRequired<unknown>(stdout, 'npm search')
    if (!Array.isArray(result)) throw new Error('npm search returned an invalid result')
    return result
  }

  async view(packageName: string): Promise<any> {
    const { stdout } = await this.executeNpm(['view', packageName, '--json'])
    return parseJsonRequired(stdout, 'npm view')
  }

  async install(args: any): Promise<string> {
    const { packageName, cwd, global, dev, version } = args
    const spec = normalizePackageSpec(packageName, version)
    const commandCwd = global ? undefined : cwd
    if (global) await checkNpmSelfInstall(spec, commandCwd)
    const command = ['install', spec]
    if (global) command.push('-g')
    if (dev) command.push('--save-dev')
    command.push('--legacy-peer-deps')
    
    const { stdout, stderr } = await this.executeNpm(command, commandCwd)
    return stdout || stderr
  }

  async uninstall(args: any): Promise<string> {
    const { packageName, cwd, global } = args
    if (!packageName || packageName.startsWith('-')) throw new Error('A package name is required')
    const command = ['uninstall', packageName]
    if (global) command.push('-g')
    
    const { stdout, stderr } = await this.executeNpm(command, global ? undefined : cwd)
    return stdout || stderr
  }

  async update(args: any): Promise<string> {
    const { packageName, cwd, global, version } = args
    
    if (packageName) {
      return this.install({ ...args, version: version || 'latest' })
    } else {
      const command = ['update', '--legacy-peer-deps']
      if (global) command.push('-g')
      
      const { stdout, stderr } = await this.executeNpm(command, global ? undefined : cwd)
      return stdout || stderr
    }
  }

  async outdated(cwd: string): Promise<any> {
    return this.readNpm(['outdated', '--json'], 'outdated', cwd)
  }

  async list(cwd: string, global: boolean): Promise<any> {
    const command = ['list', '--json', '--depth=0']
    if (global) command.push('-g')
    const parsed = await this.readNpm(command, 'list', global ? undefined : cwd)
    const manifest = global ? undefined : await readNpmManifest(cwd)
    const tree = collectNpmTree(parsed)
    return { ...parsed, manifest, statuses: manifest ? classifyNpmDependencies(manifest, parsed.dependencies || {}, tree.problems) : undefined }
  }

  async configList(): Promise<any> {
    const { stdout } = await this.executeNpm(['config', 'list', '--json'])
    return parseJsonRequired(stdout, 'npm config list')
  }

  async configSet(key: string, value: string): Promise<void> {
    await this.executeNpm(['config', 'set', key, value])
  }

  async whoami(): Promise<string> {
    try {
      const { stdout } = await this.executeNpm(['whoami'])
      return stdout.trim()
    } catch (error: any) {
      // `npm whoami` exits nonzero for a normal logged-out session. Preserve
      // that empty identity while surfacing network, permission, and other
      // failures to the settings page.
      const text = [error?.message, error?.stderr].filter(Boolean).join('\n')
      if (error?.code === 'ENEEDAUTH' || /ENEEDAUTH|not logged in|login required|unauthorized/i.test(text)) return ''
      throw error
    }
  }

  async login(registry?: string): Promise<void> {
    const npmBin = await resolveToolBin('npm')
    return new Promise((resolve, reject) => {
      const args = ['login']
      if (registry) {
        args.push('--registry', registry)
      }
      
      const command = resolveShellFreeCommand(npmBin, args)
      const child = spawn(command.bin, command.args, {
        // stdio stays inherited so the interactive login prompt works; known
        // limitation: prompts are invisible in the packaged GUI without a TTY.
        stdio: 'inherit',
        shell: false,
        windowsHide: true,
        windowsVerbatimArguments: command.windowsVerbatimArguments === true
      })
      const timeout = setTimeout(() => {
        // npm on Windows runs under a cmd.exe wrapper: killing only the
        // wrapper leaves the real npm/node grandchild running (and writing
        // .npmrc). Terminate the whole tree instead.
        void terminateProcessTree(child)
        reject(new Error('Login timed out after 10 minutes'))
      }, 10 * 60 * 1000)

      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(new Error(`Login failed to start: ${error.message}`))
      })

      child.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve()
        else reject(new Error('Login failed'))
      })
    })
  }

  async logout(registry?: string): Promise<void> {
    const command = ['logout']
    if (registry) command.push('--registry', registry)
    await this.executeNpm(command)
  }

  async runScript(cwd: string, script: string): Promise<string> {
    const { stdout, stderr } = await this.executeNpm(['run', script], cwd)
    return stdout || stderr
  }

  async getScripts(cwd: string): Promise<string[]> {
    const { stdout } = await this.executeNpm(['pkg', 'get', 'scripts', '--json'], cwd)
    const result = parseJsonRequired<unknown>(stdout, 'npm pkg get scripts')
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('npm pkg get scripts returned an invalid result')
    }
    return Object.keys(result)
  }

  async configGet(key: string): Promise<string> {
    try {
      const { stdout } = await this.executeNpm(['config', 'get', key])
      return stdout.trim()
    } catch (error) {
      return ''
    }
  }

  async configDelete(key: string): Promise<void> {
    await this.executeNpm(['config', 'delete', key])
  }

  async configEdit(): Promise<void> {
    await this.executeNpm(['config', 'edit'])
  }

  async moveDependency(args: any): Promise<string> {
    const { packageName, cwd, from, to } = args
    if (!packageName || !cwd || from === to) throw new Error('A dependency, project path and different target section are required')
    const manifest = await readNpmManifest(cwd)
    const requested = manifest[from]?.[packageName]
    if (!requested) throw new Error(`${packageName} is not declared in ${from}`)

    // The move runs as two separate commands. If the second leg fails after
    // uninstall already rewrote package.json, the dependency would be silently
    // dropped from the manifest — restore the pre-move manifest instead.
    const manifestPath = cwd ? join(cwd, 'package.json') : null
    let manifestSnapshot: string | null = null
    if (manifestPath) {
      try {
        manifestSnapshot = (await readFile(manifestPath, 'utf8'))
      } catch {
        manifestSnapshot = null
      }
    }

    try {
      await this.uninstall({ packageName, cwd, global: false })

      return await this.install({
        packageName,
        version: requested,
        cwd,
        global: false,
        dev: to === 'devDependencies'
      })
    } catch (error) {
      if (manifestPath && manifestSnapshot !== null) {
        try {
          await writeFile(manifestPath, manifestSnapshot, 'utf8')
        } catch (restoreError) {
          console.warn('Failed to restore package.json after failed dependency move:', restoreError)
        }
      }
      throw error
    }
  }

  async getPublishedPackages(username: string): Promise<any[]> {
    const { stdout } = await this.executeNpm(['search', `maintainer:${username}`, '--json', '--long'])
    const result = parseJsonRequired<unknown>(stdout, 'npm maintainer search')
    if (!Array.isArray(result)) throw new Error('npm maintainer search returned an invalid result')
    return result
  }

  async checkAllOutdated(cwd: string): Promise<any> {
    return await this.outdated(cwd)
  }

  async getPackageInfo(packageName: string): Promise<any> {
    const cached = getCached(packageInfoCache, packageName)
    if (cached) return cached

    const { stdout } = await this.executeNpm(['info', packageName, '--json'])
    return setCached(packageInfoCache, packageName, parseJsonRequired(stdout, 'npm info'))
  }

  async getVersions(packageName: string): Promise<string[]> {
    const metadata = await this.getVersionMetadata(packageName)
    return metadata.versions.map((item: NpmVersionInfo) => item.version)
  }

  async getVersionMetadata(packageName: string): Promise<any> {
    const normalizedName = packageName.trim()
    if (!normalizedName) {
      return emptyVersionMetadata(packageName)
    }

    const cached = getCached(versionMetadataCache, normalizedName)
    if (cached) return cached

    try {
      const { stdout } = await this.executeNpm([
        'view',
        normalizedName,
        'versions',
        'time',
        'dist-tags',
        'description',
        '--json'
      ])
      const data = parseJsonRequired<any>(stdout, 'npm view metadata')
      const versions = Array.isArray(data?.versions)
        ? data.versions
        : data?.versions
          ? [data.versions]
          : []
      const time = data?.time && typeof data.time === 'object' ? data.time : {}
      const distTags = data?.['dist-tags'] && typeof data['dist-tags'] === 'object' ? data['dist-tags'] : {}
      const description = typeof data?.description === 'string' ? data.description : ''
      const metadata = buildVersionMetadata(normalizedName, versions, time, distTags, description)
      return setCached(versionMetadataCache, normalizedName, metadata)
    } catch (error) {
      try {
        const { stdout } = await this.executeNpm(['view', normalizedName, 'versions', '--json'])
        const versions = parseJsonRequired<unknown>(stdout, 'npm view versions')
        const versionList = Array.isArray(versions) ? versions : versions ? [versions] : []
        const metadata = buildVersionMetadata(normalizedName, versionList, {}, {}, '')
        return setCached(versionMetadataCache, normalizedName, metadata)
      } catch (fallbackError) {
        throw fallbackError
      }
    }
  }

  async installVersion(args: any): Promise<string> {
    return this.install(args)
  }

  async globalOutdated(): Promise<any> {
    return this.readNpm(['outdated', '-g', '--json'], 'outdated')
  }

  async adduser(registry?: string): Promise<void> {
    const npmBin = await resolveToolBin('npm')
    return new Promise((resolve, reject) => {
      const args = ['adduser']
      if (registry) {
        args.push('--registry', registry)
      }
      
      const command = resolveShellFreeCommand(npmBin, args)
      const child = spawn(command.bin, command.args, {
          stdio: 'inherit',
          shell: false,
          windowsHide: true,
          windowsVerbatimArguments: command.windowsVerbatimArguments === true
      })
      const timeout = setTimeout(() => {
        void terminateProcessTree(child)
        reject(new Error('Add user timed out after 10 minutes'))
      }, 10 * 60 * 1000)

      // A missing npm binary makes spawn fail asynchronously; without this
      // listener the 'error' event would crash the main process.
      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(new Error(`Add user failed to start: ${error.message}`))
      })
      
      child.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve()
        else reject(new Error('Add user failed'))
      })
    })
  }

  async getRegistryInfo(registry?: string): Promise<any> {
    const url = registry || 'https://registry.npmjs.org/'
    return parseJsonRequired(await httpsGet(url), 'npm registry info')
  }

  async getPackageSize(packageName: string, version?: string): Promise<any> {
    const cacheKey = `${packageName}@${version || 'latest'}`
    const cached = getCached(packageSizeCache, cacheKey)
    if (cached) return cached

    const pkgVersion = version || 'latest'
    const url = registryPackageUrl(packageName, pkgVersion)
    const data = parseJsonRequired<any>(await httpsGet(url), 'npm package metadata')
    const dist = data?.dist
    if (!dist || typeof dist !== 'object') throw new Error('npm package metadata did not include distribution information')
    const unpackedSize = Number.isFinite(dist.unpackedSize) ? dist.unpackedSize : 0
    const fileCount = Number.isFinite(dist.fileCount) ? dist.fileCount : 0
    return setCached(packageSizeCache, cacheKey, {
      unpackedSize,
      fileCount,
      packedSize: dist.tarball ? 'unknown' : 0,
      prettySize: formatBytes(unpackedSize)
    })
  }

  async getDependencyTree(packageName: string, version?: string, depth: number = 2): Promise<any> {
    // Unbounded recursion made this effectively never resolve: every node
    // re-fetched `npm view` serially, with no memoization and no node budget.
    const clampedDepth = Math.min(Math.max(0, Math.floor(depth) || 0), 4)
    return await this.buildDependencyTree(packageName, version, clampedDepth, new Map(), { remaining: 500 })
  }

  private async buildDependencyTree(
    packageName: string,
    version: string | undefined,
    depth: number,
    memo: Map<string, Promise<any>>,
    budget: { remaining: number }
  ): Promise<any> {
    const key = `${packageName}@${version || 'latest'}#${depth}`
    const cached = memo.get(key)
    if (cached) return await cached
    const task = this.fetchDependencyTree(packageName, version, depth, memo, budget)
    memo.set(key, task)
    return await task
  }

  private async fetchDependencyTree(
    packageName: string,
    version: string | undefined,
    depth: number,
    memo: Map<string, Promise<any>>,
    budget: { remaining: number }
  ): Promise<any> {
    try {
      const pkgVersion = version || 'latest'
      const { stdout } = await this.executeNpm(['view', normalizePackageSpec(packageName, pkgVersion), 'dependencies', '--json'])
      const dependencies = parseJsonRequired<unknown>(stdout, 'npm dependency metadata')
      if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
        throw new Error('npm dependency metadata returned an invalid result')
      }

      if (!dependencies || Object.keys(dependencies).length === 0) {
        return { name: packageName, version: pkgVersion, dependencies: [] }
      }

      const tree: any = {
        name: packageName,
        version: pkgVersion,
        dependencies: []
      }

      for (const [depName, depVersion] of Object.entries(dependencies)) {
        if (depth <= 0 || budget.remaining <= 0) {
          tree.dependencies.push({ name: depName, version: depVersion, dependencies: [] })
          continue
        }
        budget.remaining -= 1
        tree.dependencies.push(await this.buildDependencyTree(depName, depVersion as string, depth - 1, memo, budget))
      }

      return tree
    } catch (error) {
      throw error
    }
  }

  async audit(cwd: string): Promise<any> {
    return this.readNpm(['audit', '--json'], 'audit', cwd)
  }

  async globalAudit(): Promise<any> {
    throw Object.assign(new Error('npm audit does not support global packages. Select a project to run a security audit.'), {
      code: 'EAUDITGLOBAL', category: 'conflict', retryable: false
    })
  }

  async auditFix(cwd: string): Promise<string> {
    const { stdout, stderr } = await this.executeNpm(['audit', 'fix', '--legacy-peer-deps'], cwd)
    return stdout || stderr
  }

  async getPackageReadme(packageName: string): Promise<string> {
    const data = parseJsonRequired<any>(await httpsGet(registryPackageUrl(packageName)), 'npm package metadata')
    return typeof data.readme === 'string' ? data.readme : 'No README available'
  }

  async getDependents(packageName: string): Promise<number> {
    const data = parseJsonRequired<any>(await httpsGet(`https://registry.npmjs.org/-/v1/search?text=dependencies:${packageName}&size=0`), 'npm dependents search')
    if (!Number.isFinite(data.total)) throw new Error('npm dependents search returned an invalid result')
    return data.total
  }

  async downloadStats(packageName: string): Promise<any> {
    return parseJsonRequired(await httpsGet(`https://api.npmjs.org/downloads/point/last-week/${packageName}`), 'npm download stats')
  }

  async getProjectDependencyTree(cwd: string, depth: number = 2): Promise<any> {
    return this.readNpm(['list', '--json', `--depth=${depth}`], 'list', cwd)
  }

  async getGlobalDependencyTree(depth: number = 1): Promise<any> {
    return this.readNpm(['list', '-g', '--json', `--depth=${depth}`], 'list')
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function emptyVersionMetadata(packageName: string): any {
  return {
    name: packageName,
    description: '',
    distTags: {},
    versions: [],
    stable: [],
    prerelease: [],
    latest: ''
  }
}

function buildVersionMetadata(
  packageName: string,
  versions: string[],
  time: Record<string, string>,
  distTags: Record<string, string>,
  description: string
): any {
  const sortedVersions = [...new Set(versions.filter(Boolean))].sort((a, b) => {
    const dateA = Date.parse(time[a] || '')
    const dateB = Date.parse(time[b] || '')
    if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) {
      return dateB - dateA
    }
    return compareVersionLike(b, a)
  })

  const tagByVersion = new Map<string, string[]>()
  Object.entries(distTags || {}).forEach(([tag, version]) => {
    if (!version) return
    const tags = tagByVersion.get(version) || []
    tags.push(tag)
    tagByVersion.set(version, tags)
  })

  const versionItems = sortedVersions.map((version) => {
    const tags = tagByVersion.get(version) || []
    const prerelease = isPrereleaseVersion(version)
    return {
      version,
      date: time[version] || '',
      tags,
      prerelease,
      channel: prerelease ? resolvePrereleaseChannel(version, tags) : 'stable'
    }
  })

  const latest = distTags?.latest || versionItems.find((item) => !item.prerelease)?.version || versionItems[0]?.version || ''

  return {
    name: packageName,
    description,
    distTags: distTags || {},
    versions: versionItems,
    stable: versionItems.filter((item) => !item.prerelease),
    prerelease: versionItems.filter((item) => item.prerelease),
    latest
  }
}

function isPrereleaseVersion(version: string): boolean {
  return version.includes('-') || /\b(alpha|beta|rc|next|canary|experimental|preview|pre|dev|nightly|snapshot)\b/i.test(version)
}

function resolvePrereleaseChannel(version: string, tags: string[]): string {
  const text = [version, ...tags].join(' ').toLowerCase()
  const channels = ['alpha', 'beta', 'rc', 'next', 'canary', 'experimental', 'preview', 'nightly', 'snapshot', 'dev']
  return channels.find((channel) => text.includes(channel)) || 'prerelease'
}

function compareVersionLike(a: string, b: string): number {
  const parsedA = parseVersionParts(a)
  const parsedB = parseVersionParts(b)
  for (let index = 0; index < Math.max(parsedA.length, parsedB.length); index += 1) {
    const diff = (parsedA[index] || 0) - (parsedB[index] || 0)
    if (diff !== 0) return diff
  }
  return a.localeCompare(b)
}

function parseVersionParts(version: string): number[] {
  const match = version.match(/\d+(?:\.\d+)*/)
  if (!match) return []
  return match[0].split('.').map((part) => Number(part) || 0)
}
