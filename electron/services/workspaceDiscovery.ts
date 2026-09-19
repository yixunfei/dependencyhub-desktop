import type { Dirent } from 'fs'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  getManagerDetectionFiles,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import type { WorkspaceKind } from '../../shared/workspaceKinds'
import { fsLimiter } from './concurrency'
import { cachedReport, invalidateReports } from './reportCache'

export type { WorkspaceKind }

export interface WorkspaceNode {
  id: string
  name: string
  path: string
  relativePath: string
  kind: WorkspaceKind
  managerIds: DependencyManagerId[]
  manifestFiles: string[]
  lockFiles: string[]
  configFiles: string[]
  discoveredBy: string[]
  parentId?: string
  packageName?: string
  version?: string
}

export interface WorkspaceDiscoverySummary {
  workspaceCount: number
  explicitWorkspaceCount: number
  managerCount: number
  managers: DependencyManagerId[]
  manifestFileCount: number
  lockFileCount: number
  configFileCount: number
  byKind: Record<string, number>
  byManager: Record<string, number>
  /** True when the directory cap stopped the walk; results are then partial. */
  truncated?: boolean
}

export interface WorkspaceDiscoveryReport {
  generatedAt: string
  projectPath: string
  workspaces: WorkspaceNode[]
  summary: WorkspaceDiscoverySummary
}

export interface WorkspaceDiscoveryExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  workspaceCount: number
  summary: WorkspaceDiscoverySummary
}

interface WorkspaceCandidate {
  path: string
  kind: WorkspaceKind
  source: string
  managerHints?: DependencyManagerId[]
}

const REPORT_DIR = '.npmDesktopManager/reports'
const MAX_SCAN_DEPTH = 5
/** Beyond a few thousand directories every extra probe costs more than it finds. */
const MAX_SCAN_DIRECTORIES = 20000
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.npmDesktopManager',
  'node_modules',
  'dist',
  'dist-electron',
  'build',
  'out',
  'coverage',
  'target',
  '.gradle',
  '.venv',
  'venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  '.tox',
  '.idea',
  '.vscode'
])

const MANAGER_IDS = MANAGER_DEFINITIONS.map((manager) => manager.id)

/**
 * Directory listings are cached with a short TTL rather than cleared at the top
 * of every report: eight services request this scan at once and each of them
 * used to wipe the cache the others had just populated, so none ever hit it.
 */
const DIRECTORY_NAMES_TTL_MS = 10_000
const MAX_CACHED_DIRECTORIES = 5000
interface DirectoryNamesEntry {
  at: number
  promise: Promise<string[]>
}
const directoryNamesCache = new Map<string, DirectoryNamesEntry>()

export class WorkspaceDiscoveryService {
  /**
   * A full tree walk is the single most expensive read in the app and several
   * governance reports ask for it during the same page load. Memoising it keeps
   * one scan alive for concurrent callers; writes call {@link invalidateReports}
   * so a panel never renders pre-install results.
   */
  async report(projectPath: string): Promise<WorkspaceDiscoveryReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    return await cachedReport(`workspaceDiscovery:${root}`, 30_000, () => this.scanWorkspaceTree(root))
  }

  private async scanWorkspaceTree(root: string): Promise<WorkspaceDiscoveryReport> {
    const { directories, truncated } = await walkDirectories(root, MAX_SCAN_DEPTH)
    const explicitCandidates = await discoverExplicitWorkspaces(root, directories)
    const manifestCandidates = await discoverManifestWorkspaces(root, directories)
    const candidates: WorkspaceCandidate[] = [
      { path: root, kind: 'root', source: 'project-root' },
      ...explicitCandidates,
      ...manifestCandidates
    ]

    // Inspecting a workspace touches the filesystem dozens of times, so it is
    // parallelised but still bounded; the results are merged back in candidate
    // order afterwards, keeping the report deterministic.
    const inspected = await fsLimiter.runAll(candidates, async (candidate) => {
      const workspacePath = resolve(candidate.path)
      if (!isInside(root, workspacePath)) return null
      if (!await isDirectory(workspacePath)) return null
      return {
        candidate,
        node: await inspectWorkspace(root, workspacePath, candidate)
      }
    })

    const byPath = new Map<string, WorkspaceNode>()
    for (const entry of inspected) {
      if (!entry) continue
      const key = pathKey(entry.node.path)
      const existing = byPath.get(key)
      if (existing) {
        mergeWorkspace(existing, entry.node, entry.candidate.source)
      } else {
        byPath.set(key, entry.node)
      }
    }

    const workspaces = Array.from(byPath.values())
      .sort((a, b) => workspaceSortKey(a).localeCompare(workspaceSortKey(b)))
    assignParents(workspaces)

    const summary = summarize(workspaces)
    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      workspaces,
      summary: truncated ? { ...summary, truncated: true } : summary
    }
  }

  async exportMarkdown(projectPath: string): Promise<WorkspaceDiscoveryExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-discovery-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      workspaceCount: report.workspaces.length,
      summary: report.summary
    }
  }

  async exportJson(projectPath: string): Promise<WorkspaceDiscoveryExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-discovery-report.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      workspaceCount: report.workspaces.length,
      summary: report.summary
    }
  }
}

async function discoverExplicitWorkspaces(root: string, directories: string[]): Promise<WorkspaceCandidate[]> {
  const groups = await Promise.all([
    discoverPackageJsonWorkspaces(root, directories),
    discoverPnpmWorkspaces(root, directories),
    discoverCargoMembers(root, directories),
    discoverMavenModules(root),
    discoverGradleProjects(root),
    discoverGoWorkModules(root)
  ])
  return groups.flat()
}

async function discoverPackageJsonWorkspaces(root: string, directories: string[]): Promise<WorkspaceCandidate[]> {
  const packageJson = parseJson(await readOptional(join(root, 'package.json')))
  const workspacePatterns = normalizeStringArray(
    Array.isArray(packageJson?.workspaces)
      ? packageJson.workspaces
      : packageJson?.workspaces?.packages
  )
  if (workspacePatterns.length === 0) return []

  const packageManager = String(packageJson?.packageManager || '').toLowerCase()
  const hasYarnLock = await exists(join(root, 'yarn.lock'))
  const hasPnpmWorkspace = await exists(join(root, 'pnpm-workspace.yaml'))
  const hasPnpmLock = await exists(join(root, 'pnpm-lock.yaml'))
  const hasBunLock = await exists(join(root, 'bun.lock')) || await exists(join(root, 'bun.lockb'))
  const kind: WorkspaceKind = packageManager.startsWith('yarn') || hasYarnLock
    ? 'yarn-workspace'
    : packageManager.startsWith('npm')
      ? 'npm-workspace'
      : packageManager.startsWith('pnpm') || hasPnpmWorkspace || hasPnpmLock
      ? 'pnpm-workspace'
      : 'npm-workspace'
  const managerHints: DependencyManagerId[] = packageManager.startsWith('yarn') || hasYarnLock
    ? ['yarn']
    : packageManager.startsWith('npm')
      ? ['npm']
      : packageManager.startsWith('pnpm') || hasPnpmWorkspace || hasPnpmLock
      ? ['pnpm']
      : packageManager.startsWith('bun') || hasBunLock
        ? ['bun']
        : ['npm']

  return expandWorkspacePatterns(root, workspacePatterns, directories).map((path) => ({
    path,
    kind,
    source: 'package.json workspaces',
    managerHints
  }))
}

async function discoverPnpmWorkspaces(root: string, directories: string[]): Promise<WorkspaceCandidate[]> {
  const text = await readOptional(join(root, 'pnpm-workspace.yaml'))
  if (!text) return []
  const patterns = parseYamlList(text, 'packages')
  return expandWorkspacePatterns(root, patterns, directories).map((path) => ({
    path,
    kind: 'pnpm-workspace',
    source: 'pnpm-workspace.yaml',
    managerHints: ['pnpm']
  }))
}

async function discoverCargoMembers(root: string, directories: string[]): Promise<WorkspaceCandidate[]> {
  const text = await readOptional(join(root, 'Cargo.toml'))
  if (!text) return []
  const workspaceBlock = tomlTableBlock(text, 'workspace')
  const members = workspaceBlock ? parseTomlArray(workspaceBlock, 'members') : []
  return expandWorkspacePatterns(root, members, directories).map((path) => ({
    path,
    kind: 'cargo-member',
    source: 'Cargo.toml workspace.members',
    managerHints: ['cargo']
  }))
}

async function discoverMavenModules(root: string): Promise<WorkspaceCandidate[]> {
  const text = await readOptional(join(root, 'pom.xml'))
  if (!text) return []
  const modulesBlock = text.match(/<modules\b[^>]*>([\s\S]*?)<\/modules>/i)?.[1] || ''
  const modules = Array.from(modulesBlock.matchAll(/<module\b[^>]*>\s*([^<]+?)\s*<\/module>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean)
  return modules.map((modulePath) => ({
    path: join(root, modulePath),
    kind: 'maven-module',
    source: 'pom.xml modules',
    managerHints: ['maven']
  }))
}

async function discoverGradleProjects(root: string): Promise<WorkspaceCandidate[]> {
  const text = await readOptional(join(root, 'settings.gradle'))
    || await readOptional(join(root, 'settings.gradle.kts'))
  if (!text) return []

  const projectPaths: string[] = []
  for (const match of text.matchAll(/include\s*\(?\s*([^) \n][^\n)]*)\)?/gi)) {
    const declaration = match[1]
    for (const projectPath of declaration.matchAll(/["'](:?[^"']+)["']/g)) {
      projectPaths.push(gradleProjectToPath(projectPath[1]))
    }
  }

  return [...new Set(projectPaths.filter(Boolean))].map((projectPath) => ({
    path: join(root, projectPath),
    kind: 'gradle-project',
    source: 'Gradle settings include',
    managerHints: ['gradle']
  }))
}

async function discoverGoWorkModules(root: string): Promise<WorkspaceCandidate[]> {
  const text = await readOptional(join(root, 'go.work'))
  if (!text) return []

  const modules: string[] = []
  const block = text.match(/\buse\s*\(([\s\S]*?)\)/i)?.[1]
  if (block) {
    modules.push(...block.split(/\r?\n/).map((line) => stripInlineComment(line).trim()).filter(Boolean))
  }

  for (const match of text.matchAll(/^\s*use\s+([^\s(][^\r\n]*)$/gim)) {
    modules.push(stripInlineComment(match[1]).trim())
  }

  return [...new Set(modules.filter(Boolean))].map((modulePath) => ({
    path: join(root, modulePath),
    kind: 'go-work-module',
    source: 'go.work use',
    managerHints: ['go']
  }))
}

async function discoverManifestWorkspaces(root: string, directories: string[]): Promise<WorkspaceCandidate[]> {
  const matches = await fsLimiter.runAll(directories, async (directory) => (
    await hasWorkspaceManifest(directory)
      ? {
          path: directory,
          kind: await inferWorkspaceKind(directory, directory === root),
          source: 'manifest-scan'
        }
      : null
  ))
  return matches.filter((candidate): candidate is WorkspaceCandidate => candidate !== null)
}

async function inspectWorkspace(
  root: string,
  workspacePath: string,
  candidate: WorkspaceCandidate
): Promise<WorkspaceNode> {
  const detectedManagers = new Set<DependencyManagerId>([
    ...managerHintsForKind(candidate.kind),
    ...(candidate.managerHints || [])
  ])
  const manifestFiles = new Set<string>()
  const lockFiles = new Set<string>()
  const configFiles = new Set<string>()

  // Sixty-two ecosystems inspected one at a time meant hundreds of sequential
  // awaits per workspace; they are independent reads, so run them in parallel
  // and collect into the same ordered sets afterwards.
  const perManager = await fsLimiter.runAll(MANAGER_DEFINITIONS, async (manager) => ({
    manager,
    detection: await existingPatternMatches(workspacePath, getManagerDetectionFiles(manager)),
    manifest: await existingPatternMatches(workspacePath, manager.manifestFiles),
    lock: await existingPatternMatches(workspacePath, manager.lockFiles),
    config: await existingPatternMatches(workspacePath, manager.configFiles || [])
  }))

  for (const { manager, detection, manifest, lock, config } of perManager) {
    if (detection.length > 0) {
      detectedManagers.add(manager.id)
    }

    for (const file of manifest) {
      manifestFiles.add(toProjectRelative(root, workspacePath, file))
    }
    for (const file of lock) {
      lockFiles.add(toProjectRelative(root, workspacePath, file))
    }
    for (const file of config) {
      configFiles.add(toProjectRelative(root, workspacePath, file))
    }
  }

  const relativePath = toPosix(relative(root, workspacePath)) || '.'
  const identity = await readWorkspaceIdentity(workspacePath)
  const name = identity.packageName || (relativePath === '.' ? basename(root) : basename(workspacePath))
  return {
    id: workspaceId(relativePath),
    name,
    path: workspacePath,
    relativePath,
    kind: candidate.kind,
    managerIds: sortManagerIds([...detectedManagers]),
    manifestFiles: [...manifestFiles].sort(),
    lockFiles: [...lockFiles].sort(),
    configFiles: [...configFiles].sort(),
    discoveredBy: [candidate.source],
    packageName: identity.packageName,
    version: identity.version
  }
}

function mergeWorkspace(target: WorkspaceNode, incoming: WorkspaceNode, source: string) {
  target.managerIds = sortManagerIds([...new Set([...target.managerIds, ...incoming.managerIds])])
  target.manifestFiles = [...new Set([...target.manifestFiles, ...incoming.manifestFiles])].sort()
  target.lockFiles = [...new Set([...target.lockFiles, ...incoming.lockFiles])].sort()
  target.configFiles = [...new Set([...target.configFiles, ...incoming.configFiles])].sort()
  target.discoveredBy = [...new Set([...target.discoveredBy, source])].sort()

  if (target.kind !== 'root' && source !== 'manifest-scan') {
    target.kind = incoming.kind
  }
  if (!target.packageName && incoming.packageName) target.packageName = incoming.packageName
  if (!target.version && incoming.version) target.version = incoming.version
  if ((!target.name || target.name === basename(target.path)) && incoming.packageName) {
    target.name = incoming.packageName
  }
}

function assignParents(workspaces: WorkspaceNode[]) {
  for (const workspace of workspaces) {
    if (workspace.relativePath === '.') continue
    const parent = workspaces
      .filter((candidate) => candidate.id !== workspace.id && isAncestorPath(candidate.path, workspace.path))
      .sort((a, b) => b.path.length - a.path.length)[0]
    if (parent) workspace.parentId = parent.id
  }
}

function summarize(workspaces: WorkspaceNode[]): WorkspaceDiscoverySummary {
  const managers = sortManagerIds([...new Set(workspaces.flatMap((workspace) => workspace.managerIds))])
  return {
    workspaceCount: workspaces.length,
    explicitWorkspaceCount: workspaces.filter((workspace) => workspace.discoveredBy.some((source) => source !== 'project-root' && source !== 'manifest-scan')).length,
    managerCount: managers.length,
    managers,
    manifestFileCount: uniqueCount(workspaces.flatMap((workspace) => workspace.manifestFiles)),
    lockFileCount: uniqueCount(workspaces.flatMap((workspace) => workspace.lockFiles)),
    configFileCount: uniqueCount(workspaces.flatMap((workspace) => workspace.configFiles)),
    byKind: countBy(workspaces.map((workspace) => workspace.kind)),
    byManager: countBy(workspaces.flatMap((workspace) => workspace.managerIds))
  }
}

function managerHintsForKind(kind: WorkspaceKind): DependencyManagerId[] {
  switch (kind) {
    case 'npm-workspace':
      return ['npm']
    case 'pnpm-workspace':
      return ['pnpm']
    case 'yarn-workspace':
      return ['yarn']
    case 'cargo-member':
      return ['cargo']
    case 'maven-module':
      return ['maven']
    case 'gradle-project':
      return ['gradle']
    case 'sbt-project':
      return ['sbt']
    case 'leiningen-project':
      return ['leiningen']
    case 'mix-project':
      return ['mix']
    case 'rebar3-project':
      return ['rebar3']
    case 'cabal-project':
      return ['cabal']
    case 'stack-project':
      return ['stack']
    case 'renv-project':
      return ['renv']
    case 'julia-project':
      return ['julia']
    case 'terraform-project':
      return ['terraform', 'opentofu']
    case 'ansible-project':
      return ['ansible']
    case 'automation-project':
      return ['github-actions', 'gitlab-ci', 'pre-commit']
    case 'bazel-workspace':
      return ['bazel']
    case 'pants-project':
      return ['pants']
    case 'buck-project':
      return ['buck']
    case 'opam-project':
      return ['opam']
    case 'cpan-project':
      return ['cpan']
    case 'luarocks-project':
      return ['luarocks']
    case 'shards-project':
      return ['shards']
    case 'zig-project':
      return ['zig']
    case 'homebrew-bundle':
      return ['homebrew']
    case 'chocolatey-packages':
      return ['chocolatey']
    case 'scoop-packages':
      return ['scoop']
    case 'winget-packages':
      return ['winget']
    case 'runtime-tool-versions':
      return ['asdf']
    case 'mise-project':
      return ['mise']
    case 'sdkman-project':
      return ['sdkman']
    case 'apt-packages':
      return ['apt']
    case 'rpm-packages':
      return ['dnf']
    case 'apk-packages':
      return ['apk']
    case 'pacman-packages':
      return ['pacman']
    case 'nix-project':
      return ['nix']
    case 'go-work-module':
      return ['go']
    case 'poetry-package':
      return ['poetry']
    case 'python-package':
      return ['pip']
    case 'flutter-package':
      return ['flutter']
    case 'native-project':
      return ['native']
    case 'deno-project':
      return ['deno']
    case 'nuget-project':
      return ['nuget']
    case 'composer-package':
      return ['composer']
    case 'ruby-package':
      return ['bundler']
    case 'swiftpm-package':
      return ['swiftpm']
    case 'cocoapods-project':
      return ['cocoapods']
    case 'helm-chart':
      return ['helm']
    case 'docker-compose-project':
      return ['docker']
    case 'kustomize-project':
      return ['kustomize']
    case 'helmfile-project':
      return ['helmfile']
    case 'skaffold-project':
      return ['skaffold']
    case 'argocd-project':
      return ['argocd']
    case 'flux-project':
      return ['flux']
    default:
      return []
  }
}

async function hasWorkspaceManifest(directory: string): Promise<boolean> {
  const matches = await fsLimiter.runAll(
    MANAGER_DEFINITIONS,
    (manager) => existingPatternMatches(directory, manager.manifestFiles)
  )
  return matches.some((found) => found.length > 0)
}

async function inferWorkspaceKind(directory: string, isRoot: boolean): Promise<WorkspaceKind> {
  if (isRoot) return 'root'
  const packageJson = parseJson(await readOptional(join(directory, 'package.json')))
  if (packageJson) {
    const packageManager = String(packageJson.packageManager || '').toLowerCase()
    if (packageManager.startsWith('yarn') || await exists(join(directory, 'yarn.lock'))) return 'yarn-workspace'
    if (packageManager.startsWith('pnpm') || await exists(join(directory, 'pnpm-lock.yaml'))) return 'pnpm-workspace'
    return 'npm-workspace'
  }
  if (await exists(join(directory, 'Cargo.toml'))) return 'cargo-member'
  if (await exists(join(directory, 'pom.xml'))) return 'maven-module'
  if (await exists(join(directory, 'build.gradle')) || await exists(join(directory, 'build.gradle.kts'))) return 'gradle-project'
  if (await exists(join(directory, 'build.sbt'))) return 'sbt-project'
  if (await exists(join(directory, 'project.clj'))) return 'leiningen-project'
  if (await exists(join(directory, 'mix.exs'))) return 'mix-project'
  if (await exists(join(directory, 'rebar.config'))) return 'rebar3-project'
  if (await exists(join(directory, 'stack.yaml')) || await exists(join(directory, 'package.yaml'))) return 'stack-project'
  if ((await existingPatternMatches(directory, ['*.cabal'])).length > 0 || await exists(join(directory, 'cabal.project'))) return 'cabal-project'
  if (await exists(join(directory, 'renv.lock')) || await exists(join(directory, 'DESCRIPTION'))) return 'renv-project'
  if (await exists(join(directory, 'Project.toml')) || await exists(join(directory, 'Manifest.toml'))) return 'julia-project'
  if ((await existingPatternMatches(directory, ['*.tf', '*.tf.json'])).length > 0 || await exists(join(directory, '.terraform.lock.hcl'))) return 'terraform-project'
  if (await exists(join(directory, 'ansible.cfg')) || await exists(join(directory, 'requirements.yml')) || await exists(join(directory, 'requirements.yaml'))) return 'ansible-project'
  if (await exists(join(directory, '.github', 'workflows')) || await exists(join(directory, '.gitlab-ci.yml')) || await exists(join(directory, '.gitlab-ci.yaml')) || await exists(join(directory, '.pre-commit-config.yaml')) || await exists(join(directory, '.pre-commit-config.yml'))) return 'automation-project'
  if (await exists(join(directory, 'MODULE.bazel')) || await exists(join(directory, 'WORKSPACE')) || await exists(join(directory, 'WORKSPACE.bazel')) || await exists(join(directory, '.bazelrc'))) return 'bazel-workspace'
  if (await exists(join(directory, 'pants.toml'))) return 'pants-project'
  if (await exists(join(directory, '.buckconfig')) || await exists(join(directory, '.buckroot')) || await exists(join(directory, 'BUCK.v2'))) return 'buck-project'
  if ((await existingPatternMatches(directory, ['*.opam'])).length > 0 || await exists(join(directory, 'dune-project'))) return 'opam-project'
  if (await exists(join(directory, 'cpanfile'))) return 'cpan-project'
  if ((await existingPatternMatches(directory, ['*.rockspec'])).length > 0) return 'luarocks-project'
  if (await exists(join(directory, 'shard.yml'))) return 'shards-project'
  if (await exists(join(directory, 'build.zig.zon')) || await exists(join(directory, 'build.zig'))) return 'zig-project'
  if (await exists(join(directory, 'Brewfile'))) return 'homebrew-bundle'
  if (await exists(join(directory, 'packages.config')) || await exists(join(directory, 'chocolatey.config'))) return 'chocolatey-packages'
  if (await exists(join(directory, 'scoopfile.json')) || await exists(join(directory, 'scoopfile'))) return 'scoop-packages'
  if (await exists(join(directory, 'winget-export.json')) || await exists(join(directory, 'winget-packages.json'))) return 'winget-packages'
  if (await exists(join(directory, '.tool-versions'))) return 'runtime-tool-versions'
  if (await exists(join(directory, 'mise.toml')) || await exists(join(directory, '.mise.toml'))) return 'mise-project'
  if (await exists(join(directory, '.sdkmanrc'))) return 'sdkman-project'
  if (await exists(join(directory, 'apt-packages.txt')) || await exists(join(directory, 'packages.apt')) || await exists(join(directory, 'debian-packages.txt'))) return 'apt-packages'
  if (await exists(join(directory, 'dnf-packages.txt')) || await exists(join(directory, 'rpm-packages.txt')) || await exists(join(directory, 'packages.dnf'))) return 'rpm-packages'
  if (await exists(join(directory, 'apk-packages.txt')) || await exists(join(directory, 'packages.apk'))) return 'apk-packages'
  if (await exists(join(directory, 'pacman-packages.txt')) || await exists(join(directory, 'packages.pacman'))) return 'pacman-packages'
  if (await exists(join(directory, 'flake.nix')) || await exists(join(directory, 'flake.lock')) || await exists(join(directory, 'shell.nix')) || await exists(join(directory, 'default.nix'))) return 'nix-project'
  if (await exists(join(directory, 'go.mod'))) return 'go-work-module'
  if (await exists(join(directory, 'pubspec.yaml'))) return 'flutter-package'
  if (await exists(join(directory, 'deno.json')) || await exists(join(directory, 'deno.jsonc'))) return 'deno-project'
  if ((await existingPatternMatches(directory, ['*.csproj', '*.fsproj'])).length > 0) return 'nuget-project'
  if (await exists(join(directory, 'composer.json'))) return 'composer-package'
  if (await exists(join(directory, 'Gemfile')) || (await existingPatternMatches(directory, ['*.gemspec'])).length > 0) return 'ruby-package'
  if (await exists(join(directory, 'Package.swift'))) return 'swiftpm-package'
  if (await exists(join(directory, 'Podfile'))) return 'cocoapods-project'
  if (await exists(join(directory, 'Chart.yaml'))) return 'helm-chart'
  if (await exists(join(directory, 'Dockerfile')) || await exists(join(directory, 'docker-compose.yml')) || await exists(join(directory, 'compose.yaml'))) return 'docker-compose-project'
  if (await exists(join(directory, 'kustomization.yaml')) || await exists(join(directory, 'kustomization.yml')) || await exists(join(directory, 'Kustomization'))) return 'kustomize-project'
  if (await exists(join(directory, 'helmfile.yaml')) || await exists(join(directory, 'helmfile.yml'))) return 'helmfile-project'
  if (await exists(join(directory, 'skaffold.yaml')) || await exists(join(directory, 'skaffold.yml'))) return 'skaffold-project'
  if (await exists(join(directory, 'argocd-application.yaml')) || await exists(join(directory, 'argocd-application.yml')) || await exists(join(directory, '.argocd'))) return 'argocd-project'
  if (await exists(join(directory, 'flux-kustomization.yaml')) || await exists(join(directory, 'flux-kustomization.yml')) || await exists(join(directory, 'flux-helmrelease.yaml')) || await exists(join(directory, 'flux-helmrelease.yml')) || await exists(join(directory, 'flux-system'))) return 'flux-project'
  if (await exists(join(directory, 'CMakeLists.txt')) || await exists(join(directory, 'vcpkg.json')) || await exists(join(directory, 'conanfile.txt')) || await exists(join(directory, 'conanfile.py'))) return 'native-project'

  const pyproject = await readOptional(join(directory, 'pyproject.toml'))
  if (pyproject && /\[tool\.poetry\]/i.test(pyproject)) return 'poetry-package'
  if (pyproject || await exists(join(directory, 'setup.py')) || await exists(join(directory, 'requirements.txt')) || await exists(join(directory, 'Pipfile')) || await exists(join(directory, 'environment.yml')) || await exists(join(directory, 'environment.yaml'))) {
    return 'python-package'
  }
  if (await hasAiManifest(directory)) return 'ai-project'
  return 'python-package'
}

/**
 * AI manifests declare agent tool servers, skills, and instruction sets. They are
 * checked last so a directory that also ships a language manifest keeps that
 * ecosystem as its primary kind, and they emit no kind-level manager hint because
 * workspace inspection already detects the exact AI managers that are present.
 */
async function hasAiManifest(directory: string): Promise<boolean> {
  return await exists(join(directory, '.mcp.json'))
    || await exists(join(directory, 'mcp.json'))
    || await exists(join(directory, 'skills.json'))
    || await exists(join(directory, 'agents.json'))
    || await exists(join(directory, 'a2a.json'))
    || await exists(join(directory, '.well-known', 'agent-card.json'))
}

async function readWorkspaceIdentity(directory: string): Promise<{ packageName?: string; version?: string }> {
  const packageJson = parseJson(await readOptional(join(directory, 'package.json')))
  if (packageJson?.name || packageJson?.version) {
    return { packageName: stringOrUndefined(packageJson.name), version: stringOrUndefined(packageJson.version) }
  }

  const pyproject = await readOptional(join(directory, 'pyproject.toml'))
  if (pyproject) {
    const poetryBlock = tomlTableBlock(pyproject, 'tool.poetry')
    const projectBlock = tomlTableBlock(pyproject, 'project')
    const packageName = extractTomlString(poetryBlock || '', 'name') || extractTomlString(projectBlock || '', 'name')
    const version = extractTomlString(poetryBlock || '', 'version') || extractTomlString(projectBlock || '', 'version')
    if (packageName || version) return { packageName, version }
  }

  const cargo = await readOptional(join(directory, 'Cargo.toml'))
  if (cargo) {
    const packageBlock = tomlTableBlock(cargo, 'package')
    const packageName = extractTomlString(packageBlock || '', 'name')
    const version = extractTomlString(packageBlock || '', 'version')
    if (packageName || version) return { packageName, version }
  }

  const pom = await readOptional(join(directory, 'pom.xml'))
  if (pom) {
    const artifactId = pom.match(/<artifactId>\s*([^<]+)\s*<\/artifactId>/i)?.[1]?.trim()
    const version = pom.match(/<version>\s*([^<]+)\s*<\/version>/i)?.[1]?.trim()
    if (artifactId || version) return { packageName: artifactId, version }
  }

  const pubspec = await readOptional(join(directory, 'pubspec.yaml'))
  if (pubspec) {
    const packageName = pubspec.match(/^name:\s*["']?([^"'\r\n#]+)["']?/im)?.[1]?.trim()
    const version = pubspec.match(/^version:\s*["']?([^"'\r\n#]+)["']?/im)?.[1]?.trim()
    if (packageName || version) return { packageName, version }
  }

  const goMod = await readOptional(join(directory, 'go.mod'))
  if (goMod) {
    const modulePath = goMod.match(/^module\s+([^\s]+)/im)?.[1]?.trim()
    if (modulePath) return { packageName: modulePath }
  }

  const composerJson = parseJson(await readOptional(join(directory, 'composer.json')))
  if (composerJson?.name || composerJson?.version) {
    return { packageName: stringOrUndefined(composerJson.name), version: stringOrUndefined(composerJson.version) }
  }

  const chart = await readOptional(join(directory, 'Chart.yaml'))
  if (chart) {
    const packageName = chart.match(/^name:\s*["']?([^"'\r\n#]+)["']?/im)?.[1]?.trim()
    const version = chart.match(/^version:\s*["']?([^"'\r\n#]+)["']?/im)?.[1]?.trim()
    if (packageName || version) return { packageName, version }
  }

  return {}
}

async function walkDirectories(
  root: string,
  maxDepth: number
): Promise<{ directories: string[]; truncated: boolean }> {
  const result: string[] = [root]
  let truncated = false

  async function visit(directory: string, depth: number) {
    if (depth >= maxDepth) return
    // A huge monorepo checkout (or a directory symlinked into itself) can
    // otherwise produce hundreds of thousands of candidates, each of which is
    // later probed sixty-two times.
    if (result.length >= MAX_SCAN_DIRECTORIES) {
      truncated = true
      return
    }
    let entries: Dirent[]
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue
      const next = join(directory, entry.name)
      result.push(next)
      await visit(next, depth + 1)
    }
  }

  await visit(root, 0)
  return { directories: result, truncated }
}

function expandWorkspacePatterns(root: string, patterns: string[], directories: string[]): string[] {
  const includePatterns = patterns.map(cleanPattern).filter((pattern) => pattern && !pattern.startsWith('!'))
  const excludePatterns = patterns.map(cleanPattern).filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1))
  const excludes = excludePatterns.map(globToRegExp)
  const matches = new Set<string>()

  for (const pattern of includePatterns) {
    if (!hasGlob(pattern)) {
      matches.add(resolve(root, pattern))
      continue
    }

    const regex = globToRegExp(pattern)
    for (const directory of directories) {
      const rel = toPosix(relative(root, directory))
      if (!rel || rel === '.') continue
      if (regex.test(rel) && !excludes.some((exclude) => exclude.test(rel))) {
        matches.add(directory)
      }
    }
  }

  return [...matches]
}

function globToRegExp(pattern: string): RegExp {
  const normalized = toPosix(pattern).replace(/\/+$/g, '')
  let output = '^'
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]
    if (char === '*' && next === '*') {
      output += '.*'
      index += 1
    } else if (char === '*') {
      output += '[^/]*'
    } else {
      output += escapeRegExp(char)
    }
  }
  output += '$'
  return new RegExp(output, 'i')
}

async function existingPatternMatches(directory: string, patterns: readonly string[]): Promise<string[]> {
  if (patterns.length === 0) return []
  const entries = await readDirectoryNames(directory)
  const matches: string[] = []

  for (const pattern of patterns) {
    if (pattern.includes('/') || pattern.includes('\\')) {
      const normalizedPattern = toPosix(pattern)
      const separator = normalizedPattern.lastIndexOf('/')
      const directoryPart = normalizedPattern.slice(0, separator)
      const filePart = normalizedPattern.slice(separator + 1)
      if (hasGlob(filePart)) {
        const regex = globToRegExp(filePart)
        matches.push(...(await readDirectoryNames(join(directory, ...directoryPart.split('/'))))
          .filter((entry) => regex.test(entry))
          .map((entry) => `${directoryPart}/${entry}`))
        continue
      }
      if (await exists(join(directory, pattern))) matches.push(toPosix(pattern))
      continue
    }

    if (hasGlob(pattern)) {
      const regex = globToRegExp(pattern)
      matches.push(...entries.filter((entry) => regex.test(entry)))
      continue
    }

    if (entries.includes(pattern)) matches.push(pattern)
  }

  return [...new Set(matches)]
}

async function readDirectoryNames(directory: string): Promise<string[]> {
  const key = resolve(directory)
  const cached = directoryNamesCache.get(key)
  if (cached && Date.now() - cached.at < DIRECTORY_NAMES_TTL_MS) return await cached.promise
  const promise = readdir(key).then((entries) => entries.sort()).catch(() => [] as string[])
  if (directoryNamesCache.size > MAX_CACHED_DIRECTORIES) directoryNamesCache.clear()
  directoryNamesCache.set(key, { at: Date.now(), promise })
  return await promise
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

function parseJson(text: string | null): any {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function parseYamlList(text: string, key: string): string[] {
  const lines = text.split(/\r?\n/)
  const values: string[] = []
  let inList = false
  let baseIndent = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    if (!inList && new RegExp(`^${escapeRegExp(key)}\\s*:`).test(trimmed)) {
      inList = true
      baseIndent = indent
      continue
    }
    if (!inList) continue
    if (indent <= baseIndent && !trimmed.startsWith('-')) break
    const match = trimmed.match(/^-\s*["']?([^"'\s#]+)["']?/)
    if (match) values.push(match[1])
  }

  return values
}

function tomlTableBlock(text: string, tableName: string): string | null {
  const lines = text.split(/\r?\n/)
  const header = `[${tableName}]`
  const collected: string[] = []
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^\[[^\]]+\]$/.test(trimmed)) {
      if (inTable) break
      inTable = trimmed.toLowerCase() === header.toLowerCase()
      continue
    }
    if (inTable) collected.push(line)
  }

  return inTable ? collected.join('\n') : null
}

function parseTomlArray(text: string, key: string): string[] {
  const match = text.match(new RegExp(`${escapeRegExp(key)}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'i'))
  if (!match) return []
  return Array.from(match[1].matchAll(/["']([^"']+)["']/g)).map((item) => item[1].trim()).filter(Boolean)
}

function extractTomlString(text: string, key: string): string | undefined {
  return text.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*["']([^"']+)["']`, 'im'))?.[1]?.trim()
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => typeof item === 'string' ? item : '').filter(Boolean)
    : []
}

function gradleProjectToPath(project: string): string {
  return project.replace(/^:+/, '').replace(/:/g, '/').trim()
}

function cleanPattern(pattern: string): string {
  return stripInlineComment(pattern).trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/')
}

function stripInlineComment(value: string): string {
  return value.replace(/\s+#.*$/, '')
}

function hasGlob(pattern: string): boolean {
  return pattern.includes('*')
}

function workspaceId(relativePath: string): string {
  if (!relativePath || relativePath === '.') return 'root'
  return toPosix(relativePath)
    .replace(/[^a-zA-Z0-9._/-]+/g, '-')
    .replace(/[/.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'workspace'
}

function workspaceSortKey(workspace: WorkspaceNode): string {
  return workspace.relativePath === '.' ? '!' : workspace.relativePath
}

function toProjectRelative(root: string, workspacePath: string, file: string): string {
  return toPosix(relative(root, join(workspacePath, file))) || file
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/')
}

function pathKey(path: string): string {
  return process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)
}

function sortManagerIds(ids: string[]): DependencyManagerId[] {
  const order = new Map(MANAGER_IDS.map((id, index) => [id, index]))
  return [...new Set(ids as DependencyManagerId[])]
    .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b))
}

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function isAncestorPath(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function uniqueCount(values: string[]): number {
  return new Set(values).size
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderMarkdown(report: WorkspaceDiscoveryReport): string {
  const lines = [
    '# Workspace Discovery Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Summary',
    '',
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Explicit workspaces: ${report.summary.explicitWorkspaceCount}`,
    `- Managers: ${report.summary.managers.join(', ') || 'none'}`,
    `- Manifest files: ${report.summary.manifestFileCount}`,
    `- Lock files: ${report.summary.lockFileCount}`,
    '',
    '## Workspaces',
    '',
    '| Workspace | Kind | Managers | Path | Manifests | Locks |',
    '| --- | --- | --- | --- | --- | --- |'
  ]

  for (const workspace of report.workspaces) {
    lines.push([
      markdownCell(workspace.name),
      markdownCell(workspace.kind),
      markdownCell(workspace.managerIds.join(', ') || '-'),
      markdownCell(workspace.relativePath),
      markdownCell(workspace.manifestFiles.join('<br>') || '-'),
      markdownCell(workspace.lockFiles.join('<br>') || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Distribution', '')
  lines.push('### By Kind', '')
  for (const [kind, count] of Object.entries(report.summary.byKind).sort()) {
    lines.push(`- ${kind}: ${count}`)
  }
  lines.push('', '### By Manager', '')
  for (const [manager, count] of Object.entries(report.summary.byManager).sort()) {
    lines.push(`- ${manager}: ${count}`)
  }

  return `${lines.join('\n')}\n`
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
