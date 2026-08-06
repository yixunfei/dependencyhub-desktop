import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport,
  type WorkspaceNode
} from './workspaceDiscovery'

export type RuntimePinningExportFormat = 'markdown' | 'json'
export type RuntimePinningStatus = 'ready' | 'warning' | 'blocked'
export type RuntimePinningSeverity = 'info' | 'warning' | 'blocked'
export type RuntimePinningSource = 'workspace' | 'ancestor' | 'manifest' | 'config'
export type RuntimePinningKind =
  | 'node-package-manager'
  | 'node-runtime'
  | 'python-runtime'
  | 'jvm-runtime'
  | 'maven-wrapper'
  | 'gradle-wrapper'
  | 'go-version'
  | 'go-toolchain'
  | 'rust-toolchain'
  | 'rust-version'
  | 'flutter-sdk'
  | 'dotnet-sdk'
  | 'dotnet-target'
  | 'php-runtime'
  | 'ruby-runtime'
  | 'swift-tools'
  | 'docker-base-image'
export type RuntimePinningFindingKind =
  | 'missing-runtime-pin'
  | 'missing-tool-wrapper'
  | 'missing-package-manager-pin'
  | 'unpinned-package-manager'
  | 'floating-container-tag'

export interface RuntimePinningEvidence {
  kind: RuntimePinningKind
  managerId?: DependencyManagerId
  source: RuntimePinningSource
  file: string
  path: string
  relativePath: string
  value: string
  modifiedAt?: string
}

export interface RuntimePinningFinding {
  id: string
  kind: RuntimePinningFindingKind
  severity: RuntimePinningSeverity
  managerId?: DependencyManagerId
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface RuntimePinningWorkspace {
  workspace: WorkspaceNode
  status: RuntimePinningStatus
  score: number
  managers: DependencyManagerId[]
  evidence: RuntimePinningEvidence[]
  findings: RuntimePinningFinding[]
}

export interface RuntimePinningSummary {
  workspaceCount: number
  ready: number
  warning: number
  blocked: number
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
  missingRuntimePinCount: number
  missingToolWrapperCount: number
  missingPackageManagerPinCount: number
  unpinnedPackageManagerCount: number
  floatingContainerTagCount: number
  evidenceCount: number
  inheritedEvidenceWorkspaceCount: number
  managerCount: number
  managers: DependencyManagerId[]
  byManager: Record<string, number>
}

export interface RuntimePinningReport {
  generatedAt: string
  projectPath: string
  discovery: WorkspaceDiscoveryReport
  workspaces: RuntimePinningWorkspace[]
  summary: RuntimePinningSummary
}

export interface RuntimePinningExportResult {
  path: string
  format: RuntimePinningExportFormat
  generatedAt: string
  workspaceCount: number
  summary: RuntimePinningSummary
}

const REPORT_DIR = '.npmDesktopManager/reports'

const NODE_MANAGERS = new Set<DependencyManagerId>(['npm', 'pnpm', 'yarn', 'bun'])
const PYTHON_MANAGERS = new Set<DependencyManagerId>(['pip', 'uv', 'poetry', 'pipenv', 'conda'])
const JVM_MANAGERS = new Set<DependencyManagerId>(['maven', 'gradle'])
const RUNTIME_MANAGER_IDS = new Set<DependencyManagerId>([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'pip',
  'uv',
  'poetry',
  'pipenv',
  'conda',
  'maven',
  'gradle',
  'cargo',
  'go',
  'flutter',
  'nuget',
  'composer',
  'bundler',
  'swiftpm',
  'docker'
])

export class RuntimePinningService {
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService

  constructor(dependencies: { workspaceDiscoveryService?: WorkspaceDiscoveryService } = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
  }

  async report(projectPath: string): Promise<RuntimePinningReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const discovery = await this.workspaceDiscoveryService.report(root)
    const workspaces = await Promise.all(discovery.workspaces.map((workspace) => inspectWorkspace(root, workspace)))

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      discovery,
      workspaces,
      summary: summarize(workspaces)
    }
  }

  async exportMarkdown(projectPath: string): Promise<RuntimePinningExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'runtime-pinning-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderRuntimePinningMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      workspaceCount: report.workspaces.length,
      summary: report.summary
    }
  }

  async exportJson(projectPath: string): Promise<RuntimePinningExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'runtime-pinning-report.json')
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

async function inspectWorkspace(root: string, workspace: WorkspaceNode): Promise<RuntimePinningWorkspace> {
  const managers = workspace.managerIds.filter((managerId) => RUNTIME_MANAGER_IDS.has(managerId))
  const evidence: RuntimePinningEvidence[] = []
  const findings: RuntimePinningFinding[] = []

  evidence.push(...await nodeEvidence(root, workspace))
  evidence.push(...await pythonEvidence(root, workspace))
  evidence.push(...await jvmEvidence(root, workspace))
  evidence.push(...await goEvidence(root, workspace))
  evidence.push(...await rustEvidence(root, workspace))
  evidence.push(...await flutterEvidence(root, workspace))
  evidence.push(...await dotnetEvidence(root, workspace))
  evidence.push(...await phpEvidence(root, workspace))
  evidence.push(...await rubyEvidence(root, workspace))
  evidence.push(...await swiftEvidence(root, workspace))
  evidence.push(...await dockerEvidence(root, workspace, findings))

  if (managers.some((managerId) => NODE_MANAGERS.has(managerId))) {
    if (!hasEvidence(evidence, 'node-package-manager')) {
      findings.push(finding({
        id: `${workspace.id}:node:missing-package-manager-pin`,
        kind: 'missing-package-manager-pin',
        severity: workspace.relativePath === '.' ? 'warning' : 'info',
        managerId: nodeManagerFor(workspace),
        title: 'Node.js package manager is not pinned',
        summary: `${workspace.name} has Node.js dependency files but package.json does not declare packageManager.`,
        recommendation: 'Set packageManager in package.json, for example npm@10.x, pnpm@9.x, yarn@4.x, or bun@1.x.',
        evidence: [`Workspace: ${workspace.relativePath}`]
      }))
    } else if (evidence.some((item) => item.kind === 'node-package-manager' && !/@[^@]+$/.test(item.value))) {
      findings.push(finding({
        id: `${workspace.id}:node:unpinned-package-manager`,
        kind: 'unpinned-package-manager',
        severity: 'warning',
        managerId: nodeManagerFor(workspace),
        title: 'Node.js package manager version is not pinned',
        summary: `${workspace.name} declares packageManager without an exact tool version.`,
        recommendation: 'Pin packageManager to a tool and version so Corepack, CI, and release builds resolve the same installer.',
        evidence: evidence
          .filter((item) => item.kind === 'node-package-manager')
          .map((item) => `${item.relativePath}: ${item.value}`)
      }))
    }

    if (!hasEvidence(evidence, 'node-runtime')) {
      findings.push(missingRuntimeFinding(workspace, nodeManagerFor(workspace), 'Node.js', [
        'Add engines.node to package.json.',
        'Commit .nvmrc or .node-version at the workspace or repository root.'
      ]))
    }
  }

  if (managers.some((managerId) => PYTHON_MANAGERS.has(managerId)) && !hasEvidence(evidence, 'python-runtime')) {
    findings.push(missingRuntimeFinding(workspace, pythonManagerFor(workspace), 'Python', [
      'Add requires-python to pyproject.toml.',
      'Commit .python-version, runtime.txt, Pipfile [requires], or an environment.yml python pin.'
    ]))
  }

  if (managers.some((managerId) => JVM_MANAGERS.has(managerId))) {
    if (!hasEvidence(evidence, 'jvm-runtime')) {
      findings.push(missingRuntimeFinding(workspace, jvmManagerFor(workspace), 'JVM', [
        'Add Maven compiler release/source/target configuration.',
        'Add a Gradle Java toolchain or sourceCompatibility pin.'
      ]))
    }
    if (managers.includes('maven') && !hasEvidence(evidence, 'maven-wrapper')) {
      findings.push(missingWrapperFinding(workspace, 'maven', 'Maven Wrapper', '.mvn/wrapper/maven-wrapper.properties'))
    }
    if (managers.includes('gradle') && !hasEvidence(evidence, 'gradle-wrapper')) {
      findings.push(missingWrapperFinding(workspace, 'gradle', 'Gradle Wrapper', 'gradle/wrapper/gradle-wrapper.properties'))
    }
  }

  if (managers.includes('go') && !hasEvidence(evidence, 'go-version')) {
    findings.push(missingRuntimeFinding(workspace, 'go', 'Go', ['Commit a go.mod file with a go version directive.']))
  }

  if (managers.includes('cargo') && !hasAnyEvidence(evidence, ['rust-toolchain', 'rust-version'])) {
    findings.push(missingRuntimeFinding(workspace, 'cargo', 'Rust', [
      'Commit rust-toolchain.toml or rust-toolchain.',
      'Set package.rust-version in Cargo.toml for library crates.'
    ]))
  }

  if (managers.includes('flutter') && !hasEvidence(evidence, 'flutter-sdk')) {
    findings.push(missingRuntimeFinding(workspace, 'flutter', 'Dart/Flutter SDK', ['Add environment.sdk to pubspec.yaml.']))
  }

  if (managers.includes('nuget')) {
    if (!hasEvidence(evidence, 'dotnet-target')) {
      findings.push(missingRuntimeFinding(workspace, 'nuget', '.NET target framework', ['Set TargetFramework or TargetFrameworks in the project file.']))
    }
    if (!hasEvidence(evidence, 'dotnet-sdk')) {
      findings.push(finding({
        id: `${workspace.id}:nuget:missing-dotnet-sdk-pin`,
        kind: 'missing-runtime-pin',
        severity: 'info',
        managerId: 'nuget',
        title: '.NET SDK is not pinned',
        summary: `${workspace.name} does not have a global.json SDK version pin in the workspace or an ancestor.`,
        recommendation: 'Commit global.json when release builds require a specific .NET SDK version.',
        evidence: [`Workspace: ${workspace.relativePath}`]
      }))
    }
  }

  if (managers.includes('composer') && !hasEvidence(evidence, 'php-runtime')) {
    findings.push(missingRuntimeFinding(workspace, 'composer', 'PHP', ['Set require.php or config.platform.php in composer.json.']))
  }

  if (managers.includes('bundler') && !hasEvidence(evidence, 'ruby-runtime')) {
    findings.push(missingRuntimeFinding(workspace, 'bundler', 'Ruby', ['Set ruby in Gemfile or commit .ruby-version.']))
  }

  if (managers.includes('swiftpm') && !hasEvidence(evidence, 'swift-tools')) {
    findings.push(missingRuntimeFinding(workspace, 'swiftpm', 'Swift tools', ['Add the // swift-tools-version header to Package.swift.']))
  }

  return {
    workspace,
    status: statusFromFindings(findings),
    score: scoreFromFindings(findings),
    managers,
    evidence: evidence.sort(evidenceSort),
    findings
  }
}

async function nodeEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.some((managerId) => NODE_MANAGERS.has(managerId))) return []
  const evidence: RuntimePinningEvidence[] = []
  const packageJsonPath = join(workspace.path, 'package.json')
  const parsed = parseJson(await readOptional(packageJsonPath))
  if (parsed) {
    if (typeof parsed.packageManager === 'string' && parsed.packageManager.trim()) {
      evidence.push(await evidenceForPath(root, packageJsonPath, 'node-package-manager', parsed.packageManager.trim(), {
        managerId: declaredNodeManager(parsed.packageManager) || nodeManagerFor(workspace),
        source: 'manifest'
      }))
    }
    if (typeof parsed.engines?.node === 'string' && parsed.engines.node.trim()) {
      evidence.push(await evidenceForPath(root, packageJsonPath, 'node-runtime', parsed.engines.node.trim(), {
        managerId: nodeManagerFor(workspace),
        source: 'manifest'
      }))
    }
  }
  evidence.push(...await ancestorFileEvidence(root, workspace, ['.nvmrc', '.node-version'], 'node-runtime', nodeManagerFor(workspace)))
  return evidence
}

async function pythonEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.some((managerId) => PYTHON_MANAGERS.has(managerId))) return []
  const evidence: RuntimePinningEvidence[] = []
  const managerId = pythonManagerFor(workspace)
  const pyprojectPath = join(workspace.path, 'pyproject.toml')
  const pyproject = await readOptional(pyprojectPath)
  const pyprojectPin = matchFirst(pyproject, [
    /requires-python\s*=\s*["']([^"']+)["']/i,
    /(?:^|\n)\s*python\s*=\s*["']([^"']+)["']/i
  ])
  if (pyprojectPin) {
    evidence.push(await evidenceForPath(root, pyprojectPath, 'python-runtime', pyprojectPin, { managerId, source: 'manifest' }))
  }

  const pipfilePath = join(workspace.path, 'Pipfile')
  const pipfile = await readOptional(pipfilePath)
  const pipfilePin = matchFirst(pipfile, [
    /python_version\s*=\s*["']([^"']+)["']/i,
    /python_full_version\s*=\s*["']([^"']+)["']/i
  ])
  if (pipfilePin) {
    evidence.push(await evidenceForPath(root, pipfilePath, 'python-runtime', pipfilePin, { managerId: 'pipenv', source: 'manifest' }))
  }

  for (const file of ['environment.yml', 'environment.yaml']) {
    const path = join(workspace.path, file)
    const text = await readOptional(path)
    const condaPin = matchFirst(text, [
      /^\s*-\s*python\s*=\s*([^\s#]+)/im,
      /^\s*python\s*[:=]\s*["']?([^"'\s#]+)/im
    ])
    if (condaPin) {
      evidence.push(await evidenceForPath(root, path, 'python-runtime', condaPin, { managerId: 'conda', source: 'manifest' }))
    }
  }

  evidence.push(...await ancestorFileEvidence(root, workspace, ['.python-version', 'runtime.txt'], 'python-runtime', managerId))
  return evidence
}

async function jvmEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.some((managerId) => JVM_MANAGERS.has(managerId))) return []
  const evidence: RuntimePinningEvidence[] = []
  const pomPath = join(workspace.path, 'pom.xml')
  const pom = await readOptional(pomPath)
  const mavenPin = matchFirst(pom, [
    /<maven\.compiler\.release>\s*([^<\s]+)\s*<\/maven\.compiler\.release>/i,
    /<maven\.compiler\.source>\s*([^<\s]+)\s*<\/maven\.compiler\.source>/i,
    /<java\.version>\s*([^<\s]+)\s*<\/java\.version>/i
  ])
  if (mavenPin) {
    evidence.push(await evidenceForPath(root, pomPath, 'jvm-runtime', mavenPin, { managerId: 'maven', source: 'manifest' }))
  }

  for (const file of ['build.gradle', 'build.gradle.kts']) {
    const path = join(workspace.path, file)
    const text = await readOptional(path)
    const gradlePin = matchFirst(text, [
      /languageVersion\s*=\s*JavaLanguageVersion\.of\((\d+)\)/i,
      /sourceCompatibility\s*=\s*['"]?([^"'\s]+)/i,
      /targetCompatibility\s*=\s*['"]?([^"'\s]+)/i
    ])
    if (gradlePin) {
      evidence.push(await evidenceForPath(root, path, 'jvm-runtime', gradlePin, { managerId: 'gradle', source: 'manifest' }))
    }
  }

  evidence.push(...await ancestorFileEvidence(root, workspace, ['.mvn/wrapper/maven-wrapper.properties'], 'maven-wrapper', 'maven'))
  evidence.push(...await ancestorFileEvidence(root, workspace, ['gradle/wrapper/gradle-wrapper.properties'], 'gradle-wrapper', 'gradle'))
  return evidence
}

async function goEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('go')) return []
  const evidence: RuntimePinningEvidence[] = []
  const path = join(workspace.path, 'go.mod')
  const text = await readOptional(path)
  const goVersion = matchFirst(text, [/^go\s+([^\s]+)/m])
  const toolchain = matchFirst(text, [/^toolchain\s+([^\s]+)/m])
  if (goVersion) evidence.push(await evidenceForPath(root, path, 'go-version', goVersion, { managerId: 'go', source: 'manifest' }))
  if (toolchain) evidence.push(await evidenceForPath(root, path, 'go-toolchain', toolchain, { managerId: 'go', source: 'manifest' }))
  return evidence
}

async function rustEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('cargo')) return []
  const evidence: RuntimePinningEvidence[] = []
  const cargoPath = join(workspace.path, 'Cargo.toml')
  const cargo = await readOptional(cargoPath)
  const rustVersion = matchFirst(cargo, [/rust-version\s*=\s*["']([^"']+)["']/i])
  if (rustVersion) evidence.push(await evidenceForPath(root, cargoPath, 'rust-version', rustVersion, { managerId: 'cargo', source: 'manifest' }))
  evidence.push(...await ancestorFileEvidence(root, workspace, ['rust-toolchain.toml', 'rust-toolchain'], 'rust-toolchain', 'cargo'))
  return evidence
}

async function flutterEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('flutter')) return []
  const path = join(workspace.path, 'pubspec.yaml')
  const text = await readOptional(path)
  const sdk = matchFirst(text, [/^\s*sdk\s*:\s*["']?([^"'\n#]+)/im])
  return sdk ? [await evidenceForPath(root, path, 'flutter-sdk', sdk.trim(), { managerId: 'flutter', source: 'manifest' })] : []
}

async function dotnetEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('nuget')) return []
  const evidence: RuntimePinningEvidence[] = []
  evidence.push(...await ancestorJsonEvidence(root, workspace, 'global.json', 'dotnet-sdk', 'nuget', (json) => (
    typeof json?.sdk?.version === 'string' ? json.sdk.version : ''
  )))
  for (const manifest of workspace.manifestFiles.filter((file) => /\.fsproj$|\.csproj$/i.test(file))) {
    const path = join(root, manifest)
    const text = await readOptional(path)
    const target = matchFirst(text, [
      /<TargetFramework>\s*([^<\s]+)\s*<\/TargetFramework>/i,
      /<TargetFrameworks>\s*([^<]+)\s*<\/TargetFrameworks>/i
    ])
    if (target) evidence.push(await evidenceForPath(root, path, 'dotnet-target', target, { managerId: 'nuget', source: 'manifest' }))
  }
  return evidence
}

async function phpEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('composer')) return []
  const path = join(workspace.path, 'composer.json')
  const parsed = parseJson(await readOptional(path))
  const value = typeof parsed?.require?.php === 'string'
    ? parsed.require.php
    : typeof parsed?.config?.platform?.php === 'string'
      ? parsed.config.platform.php
      : ''
  return value ? [await evidenceForPath(root, path, 'php-runtime', value, { managerId: 'composer', source: 'manifest' })] : []
}

async function rubyEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('bundler')) return []
  const evidence: RuntimePinningEvidence[] = []
  const gemfilePath = join(workspace.path, 'Gemfile')
  const gemfile = await readOptional(gemfilePath)
  const rubyPin = matchFirst(gemfile, [/^\s*ruby\s+["']([^"']+)["']/im])
  if (rubyPin) evidence.push(await evidenceForPath(root, gemfilePath, 'ruby-runtime', rubyPin, { managerId: 'bundler', source: 'manifest' }))
  evidence.push(...await ancestorFileEvidence(root, workspace, ['.ruby-version'], 'ruby-runtime', 'bundler'))
  return evidence
}

async function swiftEvidence(root: string, workspace: WorkspaceNode): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('swiftpm')) return []
  const path = join(workspace.path, 'Package.swift')
  const text = await readOptional(path)
  const version = matchFirst(text, [/swift-tools-version\s*:\s*([^\s]+)/i])
  return version ? [await evidenceForPath(root, path, 'swift-tools', version, { managerId: 'swiftpm', source: 'manifest' })] : []
}

async function dockerEvidence(
  root: string,
  workspace: WorkspaceNode,
  findings: RuntimePinningFinding[]
): Promise<RuntimePinningEvidence[]> {
  if (!workspace.managerIds.includes('docker')) return []
  const evidence: RuntimePinningEvidence[] = []
  for (const manifest of workspace.manifestFiles.filter((file) => /(^|\/)(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/i.test(file))) {
    const path = join(root, manifest)
    const text = await readOptional(path)
    for (const image of dockerImages(text)) {
      evidence.push(await evidenceForPath(root, path, 'docker-base-image', image, { managerId: 'docker', source: 'manifest' }))
      if (isFloatingImage(image)) {
        findings.push(finding({
          id: `${workspace.id}:docker:floating:${safeId(image)}`,
          kind: 'floating-container-tag',
          severity: 'warning',
          managerId: 'docker',
          title: 'Container image tag is floating',
          summary: `${workspace.name} references ${image}, which may resolve to different image digests over time.`,
          recommendation: 'Use an explicit non-latest tag and preferably pin the image by digest for production builds.',
          evidence: [`${manifest}: ${image}`]
        }))
      }
    }
  }
  return evidence
}

async function ancestorFileEvidence(
  root: string,
  workspace: WorkspaceNode,
  files: string[],
  kind: RuntimePinningKind,
  managerId?: DependencyManagerId
): Promise<RuntimePinningEvidence[]> {
  const evidence: RuntimePinningEvidence[] = []
  for (const file of files) {
    const path = await nearestAncestorFile(root, workspace.path, file)
    if (!path) continue
    const text = (await readOptional(path)).trim()
    if (!text) continue
    evidence.push(await evidenceForPath(root, path, kind, firstMeaningfulLine(text), {
      managerId,
      source: pathKey(dirname(path)) === pathKey(workspace.path) || pathKey(path) === pathKey(join(workspace.path, file))
        ? 'workspace'
        : 'ancestor'
    }))
  }
  return evidence
}

async function ancestorJsonEvidence(
  root: string,
  workspace: WorkspaceNode,
  file: string,
  kind: RuntimePinningKind,
  managerId: DependencyManagerId,
  picker: (json: any) => string
): Promise<RuntimePinningEvidence[]> {
  const path = await nearestAncestorFile(root, workspace.path, file)
  if (!path) return []
  const value = picker(parseJson(await readOptional(path))).trim()
  if (!value) return []
  return [await evidenceForPath(root, path, kind, value, {
    managerId,
    source: pathKey(dirname(path)) === pathKey(workspace.path) ? 'workspace' : 'ancestor'
  })]
}

async function nearestAncestorFile(root: string, workspacePath: string, file: string): Promise<string | null> {
  let current = resolve(workspacePath)
  const resolvedRoot = resolve(root)
  while (isInsideOrEqual(resolvedRoot, current)) {
    const candidate = join(current, file)
    if (await exists(candidate)) return candidate
    if (pathKey(current) === pathKey(resolvedRoot)) break
    current = dirname(current)
  }
  return null
}

async function evidenceForPath(
  root: string,
  path: string,
  kind: RuntimePinningKind,
  value: string,
  options: { managerId?: DependencyManagerId; source: RuntimePinningSource }
): Promise<RuntimePinningEvidence> {
  const stats = await stat(path).catch(() => null)
  return {
    kind,
    managerId: options.managerId,
    source: options.source,
    file: basename(path),
    path,
    relativePath: normalizeRelative(relative(root, path)),
    value,
    modifiedAt: stats?.mtime.toISOString()
  }
}

function missingRuntimeFinding(
  workspace: WorkspaceNode,
  managerId: DependencyManagerId | undefined,
  runtimeName: string,
  recommendations: string[]
): RuntimePinningFinding {
  return finding({
    id: `${workspace.id}:${managerId || runtimeName.toLowerCase()}:missing-runtime-pin`,
    kind: 'missing-runtime-pin',
    severity: 'warning',
    managerId,
    title: `${runtimeName} runtime version is not pinned`,
    summary: `${workspace.name} has ${runtimeName} dependency metadata but no runtime version pin was discovered.`,
    recommendation: recommendations.join(' '),
    evidence: [`Workspace: ${workspace.relativePath}`]
  })
}

function missingWrapperFinding(
  workspace: WorkspaceNode,
  managerId: DependencyManagerId,
  wrapperName: string,
  expectedFile: string
): RuntimePinningFinding {
  return finding({
    id: `${workspace.id}:${managerId}:missing-wrapper`,
    kind: 'missing-tool-wrapper',
    severity: 'warning',
    managerId,
    title: `${wrapperName} is missing`,
    summary: `${workspace.name} uses ${managerId} but no ${expectedFile} was found in the workspace or an ancestor.`,
    recommendation: `Commit ${expectedFile} so CI and local builds use the same ${managerId} distribution.`,
    evidence: [`Workspace: ${workspace.relativePath}`, `Expected: ${expectedFile}`]
  })
}

function statusFromFindings(findings: RuntimePinningFinding[]): RuntimePinningStatus {
  if (findings.some((finding) => finding.severity === 'blocked')) return 'blocked'
  if (findings.some((finding) => finding.severity === 'warning')) return 'warning'
  return 'ready'
}

function scoreFromFindings(findings: RuntimePinningFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'blocked') return total + 25
    if (finding.severity === 'warning') return total + 8
    return total + 2
  }, 0)
  return Math.max(0, 100 - penalty)
}

function summarize(workspaces: RuntimePinningWorkspace[]): RuntimePinningSummary {
  const findings = workspaces.flatMap((workspace) => workspace.findings)
  const managers = [...new Set(workspaces.flatMap((workspace) => workspace.managers))]
    .sort((a, b) => a.localeCompare(b)) as DependencyManagerId[]
  return {
    workspaceCount: workspaces.length,
    ready: workspaces.filter((workspace) => workspace.status === 'ready').length,
    warning: workspaces.filter((workspace) => workspace.status === 'warning').length,
    blocked: workspaces.filter((workspace) => workspace.status === 'blocked').length,
    findingCount: findings.length,
    blockedFindingCount: findings.filter((finding) => finding.severity === 'blocked').length,
    warningFindingCount: findings.filter((finding) => finding.severity === 'warning').length,
    missingRuntimePinCount: findings.filter((finding) => finding.kind === 'missing-runtime-pin').length,
    missingToolWrapperCount: findings.filter((finding) => finding.kind === 'missing-tool-wrapper').length,
    missingPackageManagerPinCount: findings.filter((finding) => finding.kind === 'missing-package-manager-pin').length,
    unpinnedPackageManagerCount: findings.filter((finding) => finding.kind === 'unpinned-package-manager').length,
    floatingContainerTagCount: findings.filter((finding) => finding.kind === 'floating-container-tag').length,
    evidenceCount: workspaces.reduce((total, workspace) => total + workspace.evidence.length, 0),
    inheritedEvidenceWorkspaceCount: workspaces.filter((workspace) => workspace.evidence.some((item) => item.source === 'ancestor')).length,
    managerCount: managers.length,
    managers,
    byManager: countBy(workspaces.flatMap((workspace) => workspace.managers))
  }
}

function renderRuntimePinningMarkdown(report: RuntimePinningReport): string {
  const lines = [
    '# Runtime Pinning Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Summary',
    '',
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Ready: ${report.summary.ready}`,
    `- Warning: ${report.summary.warning}`,
    `- Blocked: ${report.summary.blocked}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Missing runtime pins: ${report.summary.missingRuntimePinCount}`,
    `- Missing tool wrappers: ${report.summary.missingToolWrapperCount}`,
    `- Missing packageManager pins: ${report.summary.missingPackageManagerPinCount}`,
    `- Floating container tags: ${report.summary.floatingContainerTagCount}`,
    `- Pinning evidence: ${report.summary.evidenceCount}`,
    `- Inherited evidence workspaces: ${report.summary.inheritedEvidenceWorkspaceCount}`,
    '',
    '## Workspace Matrix',
    '',
    '| Status | Score | Workspace | Managers | Evidence | Findings |',
    '| --- | ---: | --- | --- | --- | --- |'
  ]

  for (const workspace of report.workspaces) {
    lines.push([
      workspace.status,
      String(workspace.score),
      markdownCell(workspace.workspace.relativePath),
      markdownCell(workspace.managers.join(', ') || '-'),
      markdownCell(workspace.evidence.map(formatEvidence).join('<br>') || '-'),
      markdownCell(workspace.findings.map((finding) => `${finding.severity}: ${finding.title}`).join('<br>') || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.workspaces.every((workspace) => workspace.findings.length === 0)) {
    lines.push('No runtime pinning findings were detected.')
  } else {
    for (const workspace of report.workspaces) {
      for (const finding of workspace.findings) {
        lines.push(
          `### ${finding.title}`,
          '',
          `- Workspace: ${workspace.workspace.relativePath}`,
          `- Severity: ${finding.severity}`,
          `- Kind: ${finding.kind}`,
          `- Manager: ${finding.managerId || '-'}`,
          `- Summary: ${finding.summary}`,
          `- Recommendation: ${finding.recommendation}`,
          `- Evidence: ${finding.evidence.join('; ') || '-'}`,
          ''
        )
      }
    }
  }

  return `${lines.join('\n')}\n`
}

function dockerImages(text: string): string[] {
  const images = [
    ...Array.from(text.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?([^\s@]+(?:@[^\s]+)?)/gim)).map((match) => match[1]),
    ...Array.from(text.matchAll(/^\s*image:\s*["']?([^"'\s]+)["']?/gim)).map((match) => match[1])
  ]
  return [...new Set(images.filter(Boolean))]
}

function isFloatingImage(image: string): boolean {
  if (image.includes('@sha256:')) return false
  const last = image.split('/').pop() || image
  if (!last.includes(':')) return true
  return last.toLowerCase().endsWith(':latest')
}

function declaredNodeManager(packageManager: string): DependencyManagerId | undefined {
  const name = packageManager.trim().split('@')[0].toLowerCase()
  return NODE_MANAGERS.has(name as DependencyManagerId) ? name as DependencyManagerId : undefined
}

function nodeManagerFor(workspace: WorkspaceNode): DependencyManagerId | undefined {
  return workspace.managerIds.find((managerId) => NODE_MANAGERS.has(managerId))
}

function pythonManagerFor(workspace: WorkspaceNode): DependencyManagerId | undefined {
  return workspace.managerIds.find((managerId) => PYTHON_MANAGERS.has(managerId))
}

function jvmManagerFor(workspace: WorkspaceNode): DependencyManagerId | undefined {
  return workspace.managerIds.find((managerId) => JVM_MANAGERS.has(managerId))
}

function hasEvidence(evidence: RuntimePinningEvidence[], kind: RuntimePinningKind): boolean {
  return evidence.some((item) => item.kind === kind)
}

function hasAnyEvidence(evidence: RuntimePinningEvidence[], kinds: RuntimePinningKind[]): boolean {
  return evidence.some((item) => kinds.includes(item.kind))
}

function finding(input: RuntimePinningFinding): RuntimePinningFinding {
  return input
}

function matchFirst(text: string, patterns: RegExp[]): string {
  if (!text) return ''
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return ''
}

function parseJson(text: string): any {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function firstMeaningfulLine(text: string): string {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith('#')) || text.trim()
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || Boolean(rel && !rel.startsWith('..') && rel !== child)
}

function normalizeRelative(value: string): string {
  return value.replace(/\\/g, '/') || '.'
}

function pathKey(path: string): string {
  return resolve(path).toLowerCase()
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'image'
}

function evidenceSort(a: RuntimePinningEvidence, b: RuntimePinningEvidence): number {
  return a.relativePath.localeCompare(b.relativePath) || a.kind.localeCompare(b.kind)
}

function formatEvidence(evidence: RuntimePinningEvidence): string {
  return `${evidence.kind}: ${evidence.value} (${evidence.relativePath}${evidence.source === 'ancestor' ? ', inherited' : ''})`
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}
