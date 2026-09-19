import { access, readFile } from 'fs/promises'
import { join } from 'path'
import { parse as parseTomlValue } from 'smol-toml'
import { runLoggedCommand } from './commandRunner'
import { registryHttpGet } from './registryHttp'
import { resolveToolBin } from './toolchain'
import { splitCommandLine } from './splitCommandLine'

export interface CargoDependency {
  name: string
  version: string
  type: 'dependencies' | 'dev-dependencies' | 'build-dependencies'
  source?: string
  optional?: boolean
}

export interface CargoSearchResult {
  name: string
  version?: string
  description?: string
}

export interface CargoInstallArgs {
  packageName: string
  version?: string
  cwd: string
  type?: CargoDependency['type']
  features?: string
}

export class CargoService {
  private async executeCargo(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
    try {
      return await runLoggedCommand(await resolveToolBin('cargo', cwd), args, {
        cwd,
        maxBuffer: 1024 * 1024 * 20,
        displayBin: 'cargo'
      })
    } catch (error: any) {
      const wrapped = new Error(error.message || 'cargo command failed') as Error & { stdout?: string; stderr?: string }
      wrapped.stdout = error.stdout
      wrapped.stderr = error.stderr
      throw wrapped
    }
  }

  async detect(cwd: string): Promise<{ hasCargoToml: boolean; path: string }> {
    const manifestPath = join(cwd, 'Cargo.toml')
    try {
      await access(manifestPath)
      return { hasCargoToml: true, path: manifestPath }
    } catch {
      return { hasCargoToml: false, path: manifestPath }
    }
  }

  async list(cwd: string): Promise<CargoDependency[]> {
    // Strip the UTF-8 BOM Windows editors emit: smol-toml rejects it and the
    // whole manifest would look unparseable.
    const content = (await readFile(join(cwd, 'Cargo.toml'), 'utf-8')).replace(/^\uFEFF/, '')
    return parseCargoTomlDependencies(content)
  }

  async search(query: string): Promise<CargoSearchResult[]> {
    if (!query.trim()) return []
    try {
      const { stdout } = await this.executeCargo(['search', query.trim(), '--limit', '20'])
      return parseCargoSearch(stdout)
    } catch {
      try {
        const data = JSON.parse(await httpsGet(`https://crates.io/api/v1/crates?q=${encodeURIComponent(query.trim())}&per_page=20`))
        return (data.crates || []).map((item: any) => ({
          name: item.id || item.name,
          version: item.max_version || item.newest_version || '',
          description: item.description || ''
        })).filter((item: CargoSearchResult) => item.name)
      } catch {
        return []
      }
    }
  }

  async versions(packageName: string): Promise<string[]> {
    if (!packageName.trim()) return []
    try {
      const data = JSON.parse(await httpsGet(`https://crates.io/api/v1/crates/${encodeURIComponent(packageName.trim())}/versions`))
      return (data.versions || [])
        .filter((item: any) => !item.yanked)
        .map((item: any) => item.num)
        .filter(Boolean)
        .slice(0, 30)
    } catch {
      return []
    }
  }

  async install(args: CargoInstallArgs): Promise<string> {
    const command = ['add', args.packageName]
    if (args.version) command.push('--vers', args.version)
    if (args.type === 'dev-dependencies') command.push('--dev')
    if (args.type === 'build-dependencies') command.push('--build')
    if (args.features) command.push('--features', args.features)
    const { stdout, stderr } = await this.executeCargo(command, args.cwd)
    return stdout || stderr
  }

  async uninstall(args: { packageName: string; cwd: string; type?: CargoDependency['type'] }): Promise<string> {
    const command = ['remove', args.packageName]
    if (args.type === 'dev-dependencies') command.push('--dev')
    if (args.type === 'build-dependencies') command.push('--build')
    const { stdout, stderr } = await this.executeCargo(command, args.cwd)
    return stdout || stderr
  }

  async update(args: { packageName?: string; cwd: string }): Promise<string> {
    const command = ['update']
    if (args.packageName) command.push('-p', args.packageName)
    const { stdout, stderr } = await this.executeCargo(command, args.cwd)
    return stdout || stderr
  }

  async tree(cwd: string): Promise<string> {
    const { stdout, stderr } = await this.executeCargo(['tree'], cwd)
    return stdout || stderr
  }

  async audit(cwd: string): Promise<{ raw: string; error?: string }> {
    try {
      const { stdout, stderr } = await this.executeCargo(['audit', '--json'], cwd)
      return { raw: stdout || stderr }
    } catch (error: any) {
      return {
        raw: error.stdout || error.stderr || '',
        error: error.stderr || error.message || 'cargo-audit is not available'
      }
    }
  }

  async run(cwd: string, commandLine: string): Promise<string> {
    const args = splitCommandLine(commandLine)
    if (args.length === 0) throw new Error('Cargo command is required')
    const { stdout, stderr } = await this.executeCargo(args, cwd)
    return stdout || stderr
  }
}

type CargoDependencySection = CargoDependency['type']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

// Line-based comment stripping previously ate `#` inside strings (git URL
// fragments), and a hardcoded section whitelist missed [target.*.dependencies]
// and workspace inheritance. Parsing with smol-toml removes both hazards.
function parseCargoTomlDependencies(content: string): CargoDependency[] {
  const document = parseTomlValue(content) as Record<string, unknown>
  const workspaceVersions = readWorkspaceDependencyVersions(document)
  const dependencies: CargoDependency[] = []

  for (const [sectionName, sectionValue] of Object.entries(document)) {
    const section = cargoDependencySection(sectionName)
    if (section && isRecord(sectionValue)) {
      for (const [key, value] of Object.entries(sectionValue)) {
        dependencies.push(readCargoDependency(key, value, section, workspaceVersions))
      }
    }
  }

  // [target.'cfg(...)'.dependencies] entries only appear after the top-level
  // dependency sections in normal manifests, so appending them keeps a stable
  // order close to the file's.
  const targets = isRecord(document['target']) ? document['target'] : undefined
  for (const targetValue of Object.values(targets ?? {})) {
    const targetDependencies = isRecord(targetValue) ? targetValue['dependencies'] : undefined
    if (!isRecord(targetDependencies)) continue
    for (const [key, value] of Object.entries(targetDependencies)) {
      dependencies.push(readCargoDependency(key, value, 'dependencies', workspaceVersions))
    }
  }

  return dependencies
}

function cargoDependencySection(sectionName: string): CargoDependencySection | undefined {
  if (sectionName === 'dependencies' || sectionName === 'dev-dependencies' || sectionName === 'build-dependencies') {
    return sectionName
  }
  return undefined
}

function readWorkspaceDependencyVersions(document: Record<string, unknown>): Map<string, string> {
  const workspaceDependencies = isRecord(document['workspace']) ? document['workspace'].dependencies : undefined
  const versions = new Map<string, string>()
  if (!isRecord(workspaceDependencies)) return versions
  for (const [name, value] of Object.entries(workspaceDependencies)) {
    const version = asText(isRecord(value) ? value.version : value)
    if (version) versions.set(name, version)
  }
  return versions
}

function readCargoDependency(
  key: string,
  value: unknown,
  section: CargoDependencySection,
  workspaceVersions: Map<string, string>
): CargoDependency {
  const record = isRecord(value) ? value : undefined
  const name = asText(record?.package) || key
  const inherited = record?.workspace === true
  const workspaceVersion = inherited
    ? (workspaceVersions.get(name) ? `${workspaceVersions.get(name)} (workspace)` : '(workspace)')
    : undefined
  const pathSource = asText(record?.path)
  const gitSource = asText(record?.git)

  return {
    name,
    version: asText(record?.version) || workspaceVersion || (typeof value === 'string' ? value : ''),
    type: section,
    source: pathSource ? `path:${pathSource}` : gitSource ? `git:${gitSource}` : undefined,
    optional: record?.optional === true
  }
}

function parseCargoSearch(output: string): CargoSearchResult[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('...'))
    .map((line) => {
      const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"\s*#\s*(.*)$/)
      if (!match) return null
      return {
        name: match[1],
        version: match[2],
        description: match[3]
      }
    })
    .filter(Boolean) as CargoSearchResult[]
}

function httpsGet(url: string): Promise<string> {
  return registryHttpGet(url, { headers: { 'User-Agent': 'DependencyHub Desktop' } })
}
