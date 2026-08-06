import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  type DependencyManagerDefinition,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport,
  type WorkspaceNode
} from './workspaceDiscovery'

export type OfflineCacheReadinessExportFormat = 'markdown' | 'json'
export type OfflineCacheReadinessStatus = 'ready' | 'warning' | 'blocked'
export type OfflineCacheReadinessSeverity = 'info' | 'warning' | 'blocked'
export type OfflineCacheEvidenceKind =
  | 'lockfile'
  | 'inherited-lockfile'
  | 'package-manager-pin'
  | 'cache-config'
  | 'registry-config'
  | 'offline-command'
  | 'vendor-cache'
  | 'manager-support'
export type OfflineCacheFindingKind =
  | 'missing-lockfile'
  | 'missing-package-manager-pin'
  | 'missing-cache-config'
  | 'missing-offline-command'
  | 'missing-vendor-cache'
  | 'inherited-lockfile'

export interface OfflineCacheEvidence {
  kind: OfflineCacheEvidenceKind
  managerId: DependencyManagerId
  title: string
  value: string
  path?: string
  relativePath?: string
  source: 'workspace' | 'ancestor' | 'generated' | 'config'
}

export interface OfflineCacheFinding {
  id: string
  kind: OfflineCacheFindingKind
  severity: OfflineCacheReadinessSeverity
  managerId: DependencyManagerId
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface OfflineCacheManagerReadiness {
  managerId: DependencyManagerId
  managerName: string
  status: OfflineCacheReadinessStatus
  score: number
  lockfileReady: boolean
  cacheConfigReady: boolean
  offlineCommandReady: boolean
  vendorCacheReady: boolean
  evidence: OfflineCacheEvidence[]
  findings: OfflineCacheFinding[]
}

export interface OfflineCacheWorkspaceReadiness {
  workspace: WorkspaceNode
  status: OfflineCacheReadinessStatus
  score: number
  managers: OfflineCacheManagerReadiness[]
  evidence: OfflineCacheEvidence[]
  findings: OfflineCacheFinding[]
}

export interface OfflineCacheReadinessSummary {
  workspaceCount: number
  ready: number
  warning: number
  blocked: number
  managerCount: number
  managers: DependencyManagerId[]
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
  lockfileReadyManagerCount: number
  inheritedLockfileManagerCount: number
  missingLockfileManagerCount: number
  packageManagerPinCount: number
  cacheConfigManagerCount: number
  offlineCommandManagerCount: number
  vendorCacheManagerCount: number
  missingOfflineCommandManagerCount: number
  missingCacheConfigManagerCount: number
  byManager: Record<string, number>
}

export interface OfflineCacheReadinessReport {
  generatedAt: string
  projectPath: string
  discovery: WorkspaceDiscoveryReport
  workspaces: OfflineCacheWorkspaceReadiness[]
  summary: OfflineCacheReadinessSummary
}

export interface OfflineCacheReadinessExportResult {
  path: string
  format: OfflineCacheReadinessExportFormat
  generatedAt: string
  workspaceCount: number
  summary: OfflineCacheReadinessSummary
}

const REPORT_DIR = '.npmDesktopManager/reports'
const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))
const LOCK_STRICT_MANAGERS = new Set<DependencyManagerId>([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'uv',
  'poetry',
  'pipenv',
  'conda',
  'cargo',
  'go',
  'flutter',
  'nuget',
  'composer',
  'bundler',
  'swiftpm',
  'cocoapods',
  'helm',
  'native'
])
const NODE_MANAGERS = new Set<DependencyManagerId>(['npm', 'pnpm', 'yarn', 'bun'])

export class OfflineCacheReadinessService {
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService

  constructor(dependencies: { workspaceDiscoveryService?: WorkspaceDiscoveryService } = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
  }

  async report(projectPath: string): Promise<OfflineCacheReadinessReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const discovery = await this.workspaceDiscoveryService.report(root)
    const workspaces = await Promise.all(discovery.workspaces.map((workspace) => inspectWorkspace(root, workspace, discovery.workspaces)))

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      discovery,
      workspaces,
      summary: summarize(workspaces)
    }
  }

  async exportMarkdown(projectPath: string): Promise<OfflineCacheReadinessExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'offline-cache-readiness-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderOfflineCacheReadinessMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      workspaceCount: report.workspaces.length,
      summary: report.summary
    }
  }

  async exportJson(projectPath: string): Promise<OfflineCacheReadinessExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'offline-cache-readiness-report.json')
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

async function inspectWorkspace(
  root: string,
  workspace: WorkspaceNode,
  allWorkspaces: WorkspaceNode[]
): Promise<OfflineCacheWorkspaceReadiness> {
  const managers = await Promise.all(workspace.managerIds.map((managerId) => inspectManager(root, workspace, allWorkspaces, managerId)))
  const evidence = managers.flatMap((manager) => manager.evidence)
  const findings = managers.flatMap((manager) => manager.findings)
  const status = statusFromFindings(findings)
  return {
    workspace,
    status,
    score: scoreFromFindings(findings),
    managers,
    evidence,
    findings
  }
}

async function inspectManager(
  root: string,
  workspace: WorkspaceNode,
  allWorkspaces: WorkspaceNode[],
  managerId: DependencyManagerId
): Promise<OfflineCacheManagerReadiness> {
  const manager = MANAGER_BY_ID.get(managerId)
  const evidence: OfflineCacheEvidence[] = []
  const findings: OfflineCacheFinding[] = []
  if (!manager) {
    return managerReadiness(managerId, managerId, evidence, findings)
  }

  evidence.push(...lockfileEvidence(root, workspace, allWorkspaces, manager))
  evidence.push(...await packageManagerPinEvidence(root, workspace, managerId))
  evidence.push(...await configEvidence(root, workspace, managerId))
  evidence.push(...await vendorCacheEvidence(root, workspace, managerId))
  evidence.push(...offlineCommandEvidence(managerId))
  evidence.push(supportEvidence(managerId))

  const hasLocalLockfile = evidence.some((item) => item.kind === 'lockfile')
  const hasInheritedLockfile = evidence.some((item) => item.kind === 'inherited-lockfile')
  const hasLockfileCoverage = hasLocalLockfile || hasInheritedLockfile || manager.lockFiles.length === 0
  const hasCacheConfig = evidence.some((item) => item.kind === 'cache-config' || item.kind === 'registry-config')
  const hasOfflineCommand = evidence.some((item) => item.kind === 'offline-command')
  const hasVendorCache = evidence.some((item) => item.kind === 'vendor-cache')

  if (manager.lockFiles.length > 0 && !hasLockfileCoverage) {
    findings.push(missingLockfileFinding(workspace, manager))
  }
  if (hasInheritedLockfile) {
    findings.push(inheritedLockfileFinding(workspace, manager, evidence.filter((item) => item.kind === 'inherited-lockfile')))
  }
  if (NODE_MANAGERS.has(managerId) && !evidence.some((item) => item.kind === 'package-manager-pin')) {
    findings.push(missingPackageManagerPinFinding(workspace, manager))
  }
  if (!hasCacheConfig && manager.capabilities.some((capability) => capability === 'cache' || capability === 'registry-config')) {
    findings.push(missingCacheConfigFinding(workspace, manager))
  }
  if (!hasOfflineCommand) {
    findings.push(missingOfflineCommandFinding(workspace, manager))
  }
  if (managerIdRequiresVendorCache(managerId) && !hasVendorCache) {
    findings.push(missingVendorCacheFinding(workspace, manager))
  }

  return managerReadiness(managerId, manager.name, evidence, findings)
}

function managerReadiness(
  managerId: DependencyManagerId,
  managerName: string,
  evidence: OfflineCacheEvidence[],
  findings: OfflineCacheFinding[]
): OfflineCacheManagerReadiness {
  return {
    managerId,
    managerName,
    status: statusFromFindings(findings),
    score: scoreFromFindings(findings),
    lockfileReady: evidence.some((item) => item.kind === 'lockfile' || item.kind === 'inherited-lockfile'),
    cacheConfigReady: evidence.some((item) => item.kind === 'cache-config' || item.kind === 'registry-config'),
    offlineCommandReady: evidence.some((item) => item.kind === 'offline-command'),
    vendorCacheReady: evidence.some((item) => item.kind === 'vendor-cache'),
    evidence,
    findings
  }
}

function lockfileEvidence(
  root: string,
  workspace: WorkspaceNode,
  allWorkspaces: WorkspaceNode[],
  manager: DependencyManagerDefinition
): OfflineCacheEvidence[] {
  const local = workspace.lockFiles
    .filter((file) => manager.lockFiles.some((pattern) => fileMatchesPattern(basename(file), pattern)))
    .map((file) => evidence({
      kind: 'lockfile',
      managerId: manager.id,
      title: 'Local lockfile',
      value: file,
      path: join(root, file),
      relativePath: file,
      source: 'workspace'
    }))
  if (local.length > 0) return local

  const inherited = ancestorWorkspaces(workspace, allWorkspaces)
    .flatMap((ancestor) => ancestor.lockFiles
      .filter((file) => manager.lockFiles.some((pattern) => fileMatchesPattern(basename(file), pattern)))
      .map((file) => evidence({
        kind: 'inherited-lockfile',
        managerId: manager.id,
        title: 'Inherited lockfile',
        value: file,
        path: join(root, file),
        relativePath: file,
        source: 'ancestor'
      })))
  return inherited
}

async function packageManagerPinEvidence(
  root: string,
  workspace: WorkspaceNode,
  managerId: DependencyManagerId
): Promise<OfflineCacheEvidence[]> {
  if (!NODE_MANAGERS.has(managerId)) return []
  const packageJsonPath = join(workspace.path, 'package.json')
  const parsed = parseJson(await readOptional(packageJsonPath))
  const packageManager = typeof parsed?.packageManager === 'string' ? parsed.packageManager : ''
  if (!packageManager || !packageManager.toLowerCase().startsWith(`${managerId}@`)) return []
  return [evidence({
    kind: 'package-manager-pin',
    managerId,
    title: 'Package manager pin',
    value: packageManager,
    path: packageJsonPath,
    relativePath: normalizeRelative(root, packageJsonPath),
    source: 'workspace'
  })]
}

async function configEvidence(
  root: string,
  workspace: WorkspaceNode,
  managerId: DependencyManagerId
): Promise<OfflineCacheEvidence[]> {
  const files = unique([
    ...workspace.configFiles,
    ...managerConfigCandidates(managerId).map((file) => workspace.relativePath === '.' ? file : `${workspace.relativePath}/${file}`)
  ])
  const items: OfflineCacheEvidence[] = []

  for (const relativePath of files) {
    const path = join(root, relativePath)
    const content = await readOptional(path)
    if (!content) continue
    const signal = configSignal(content, managerId)
    if (!signal) continue
    items.push(evidence({
      kind: signal.kind,
      managerId,
      title: signal.title,
      value: signal.value,
      path,
      relativePath,
      source: 'config'
    }))
  }
  return items
}

async function vendorCacheEvidence(
  root: string,
  workspace: WorkspaceNode,
  managerId: DependencyManagerId
): Promise<OfflineCacheEvidence[]> {
  const candidates = vendorCacheCandidates(managerId)
  const items: OfflineCacheEvidence[] = []
  for (const candidate of candidates) {
    const path = join(workspace.path, candidate)
    if (!await exists(path)) continue
    const relativePath = normalizeRelative(root, path)
    items.push(evidence({
      kind: 'vendor-cache',
      managerId,
      title: 'Vendored dependency cache',
      value: candidate,
      path,
      relativePath,
      source: 'workspace'
    }))
  }
  return items
}

function offlineCommandEvidence(managerId: DependencyManagerId): OfflineCacheEvidence[] {
  return offlineCommands(managerId).map((command) => evidence({
    kind: 'offline-command',
    managerId,
    title: 'Offline restore command',
    value: command,
    source: 'generated'
  }))
}

function supportEvidence(managerId: DependencyManagerId): OfflineCacheEvidence {
  return evidence({
    kind: 'manager-support',
    managerId,
    title: 'Offline/cache support model',
    value: supportModel(managerId),
    source: 'generated'
  })
}

function missingLockfileFinding(workspace: WorkspaceNode, manager: DependencyManagerDefinition): OfflineCacheFinding {
  const severity: OfflineCacheReadinessSeverity = LOCK_STRICT_MANAGERS.has(manager.id) ? 'blocked' : 'warning'
  return finding({
    id: `${workspace.id}:${manager.id}:missing-lockfile`,
    kind: 'missing-lockfile',
    severity,
    managerId: manager.id,
    title: `${manager.shortName} lockfile is missing`,
    summary: `${workspace.name} uses ${manager.shortName} but no ${manager.lockFiles.join(' / ')} lockfile was found for offline or frozen installs.`,
    recommendation: `Generate and commit a ${manager.shortName} lockfile before relying on offline, cached, or reproducible release installs.`,
    evidence: [`Workspace: ${workspace.relativePath}`, `Expected lockfiles: ${manager.lockFiles.join(', ')}`]
  })
}

function inheritedLockfileFinding(
  workspace: WorkspaceNode,
  manager: DependencyManagerDefinition,
  inherited: OfflineCacheEvidence[]
): OfflineCacheFinding {
  return finding({
    id: `${workspace.id}:${manager.id}:inherited-lockfile`,
    kind: 'inherited-lockfile',
    severity: 'info',
    managerId: manager.id,
    title: `${manager.shortName} uses inherited lockfile coverage`,
    summary: `${workspace.name} has no local ${manager.shortName} lockfile, but parent workspace lock evidence is available.`,
    recommendation: 'Keep inherited lockfile coverage visible in release bundles and prefer workspace-local lockfiles when the package manager supports them.',
    evidence: inherited.map((item) => item.relativePath || item.value)
  })
}

function missingPackageManagerPinFinding(workspace: WorkspaceNode, manager: DependencyManagerDefinition): OfflineCacheFinding {
  return finding({
    id: `${workspace.id}:${manager.id}:missing-package-manager-pin`,
    kind: 'missing-package-manager-pin',
    severity: workspace.relativePath === '.' ? 'warning' : 'info',
    managerId: manager.id,
    title: `${manager.shortName} package manager version is not pinned`,
    summary: `${workspace.name} does not declare packageManager for ${manager.shortName}; cache behavior can differ across tool versions.`,
    recommendation: 'Set packageManager in package.json so CI, developer machines, and offline restore jobs use the same manager version.',
    evidence: [`Workspace: ${workspace.relativePath}`]
  })
}

function missingCacheConfigFinding(workspace: WorkspaceNode, manager: DependencyManagerDefinition): OfflineCacheFinding {
  return finding({
    id: `${workspace.id}:${manager.id}:missing-cache-config`,
    kind: 'missing-cache-config',
    severity: 'warning',
    managerId: manager.id,
    title: `${manager.shortName} cache or mirror policy is not documented`,
    summary: `${workspace.name} has no detected cache, mirror, registry, or offline configuration for ${manager.shortName}.`,
    recommendation: 'Document cache directories, mirrors, proxies, trusted registries, or offline flags in project config so release restores are repeatable.',
    evidence: [`Workspace: ${workspace.relativePath}`, `Config files: ${workspace.configFiles.join(', ') || '-'}`]
  })
}

function missingOfflineCommandFinding(workspace: WorkspaceNode, manager: DependencyManagerDefinition): OfflineCacheFinding {
  return finding({
    id: `${workspace.id}:${manager.id}:missing-offline-command`,
    kind: 'missing-offline-command',
    severity: 'warning',
    managerId: manager.id,
    title: `${manager.shortName} has no offline restore command template`,
    summary: `The framework does not yet define a reliable offline restore command for ${manager.shortName}.`,
    recommendation: 'Add a manager-specific offline or cache-warmed install command before using this ecosystem in locked-down release environments.',
    evidence: [`Workspace: ${workspace.relativePath}`]
  })
}

function missingVendorCacheFinding(workspace: WorkspaceNode, manager: DependencyManagerDefinition): OfflineCacheFinding {
  return finding({
    id: `${workspace.id}:${manager.id}:missing-vendor-cache`,
    kind: 'missing-vendor-cache',
    severity: 'warning',
    managerId: manager.id,
    title: `${manager.shortName} vendor/cache evidence is missing`,
    summary: `${workspace.name} can benefit from a checked-in vendor/cache artifact, but none was detected.`,
    recommendation: 'Create a vendor/cache, wheelhouse, chart archive, or image archive workflow for air-gapped and disaster-recovery installs.',
    evidence: [`Workspace: ${workspace.relativePath}`, `Expected: ${vendorCacheCandidates(manager.id).join(', ')}`]
  })
}

function summarize(workspaces: OfflineCacheWorkspaceReadiness[]): OfflineCacheReadinessSummary {
  const managers = unique(workspaces.flatMap((workspace) => workspace.managers.map((manager) => manager.managerId))).sort() as DependencyManagerId[]
  const managerRows = workspaces.flatMap((workspace) => workspace.managers)
  const findings = workspaces.flatMap((workspace) => workspace.findings)
  return {
    workspaceCount: workspaces.length,
    ready: workspaces.filter((workspace) => workspace.status === 'ready').length,
    warning: workspaces.filter((workspace) => workspace.status === 'warning').length,
    blocked: workspaces.filter((workspace) => workspace.status === 'blocked').length,
    managerCount: managers.length,
    managers,
    findingCount: findings.length,
    blockedFindingCount: findings.filter((finding) => finding.severity === 'blocked').length,
    warningFindingCount: findings.filter((finding) => finding.severity === 'warning').length,
    lockfileReadyManagerCount: managerRows.filter((manager) => manager.lockfileReady).length,
    inheritedLockfileManagerCount: managerRows.filter((manager) => manager.evidence.some((item) => item.kind === 'inherited-lockfile')).length,
    missingLockfileManagerCount: findings.filter((finding) => finding.kind === 'missing-lockfile').length,
    packageManagerPinCount: managerRows.filter((manager) => manager.evidence.some((item) => item.kind === 'package-manager-pin')).length,
    cacheConfigManagerCount: managerRows.filter((manager) => manager.cacheConfigReady).length,
    offlineCommandManagerCount: managerRows.filter((manager) => manager.offlineCommandReady).length,
    vendorCacheManagerCount: managerRows.filter((manager) => manager.vendorCacheReady).length,
    missingOfflineCommandManagerCount: findings.filter((finding) => finding.kind === 'missing-offline-command').length,
    missingCacheConfigManagerCount: findings.filter((finding) => finding.kind === 'missing-cache-config').length,
    byManager: countBy(managerRows.map((manager) => manager.managerId))
  }
}

function statusFromFindings(findings: OfflineCacheFinding[]): OfflineCacheReadinessStatus {
  if (findings.some((finding) => finding.severity === 'blocked')) return 'blocked'
  if (findings.some((finding) => finding.severity === 'warning')) return 'warning'
  return 'ready'
}

function scoreFromFindings(findings: OfflineCacheFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'blocked') return total + 18
    if (finding.severity === 'warning') return total + 7
    return total + 1
  }, 0)
  return Math.max(0, 100 - penalty)
}

function renderOfflineCacheReadinessMarkdown(report: OfflineCacheReadinessReport): string {
  const lines = [
    '# Offline Cache Readiness Report',
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
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Blocked/warning findings: ${report.summary.blockedFindingCount}/${report.summary.warningFindingCount}`,
    `- Lockfile-ready managers: ${report.summary.lockfileReadyManagerCount}`,
    `- Inherited lockfile managers: ${report.summary.inheritedLockfileManagerCount}`,
    `- Missing lockfile managers: ${report.summary.missingLockfileManagerCount}`,
    `- Package manager pins: ${report.summary.packageManagerPinCount}`,
    `- Cache/mirror config managers: ${report.summary.cacheConfigManagerCount}`,
    `- Offline command managers: ${report.summary.offlineCommandManagerCount}`,
    `- Vendor/cache managers: ${report.summary.vendorCacheManagerCount}`,
    '',
    '## Workspace Matrix',
    '',
    '| Workspace | Status | Score | Managers | Lockfiles | Cache config | Offline commands | Vendor cache | Findings |',
    '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |'
  ]

  for (const workspace of report.workspaces) {
    lines.push([
      markdownCell(`${workspace.workspace.name} (${workspace.workspace.relativePath})`),
      workspace.status,
      String(workspace.score),
      markdownCell(workspace.managers.map((manager) => manager.managerId).join(', ') || '-'),
      String(workspace.managers.filter((manager) => manager.lockfileReady).length),
      String(workspace.managers.filter((manager) => manager.cacheConfigReady).length),
      String(workspace.managers.filter((manager) => manager.offlineCommandReady).length),
      String(workspace.managers.filter((manager) => manager.vendorCacheReady).length),
      String(workspace.findings.length)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Manager Evidence', '')
  for (const workspace of report.workspaces) {
    lines.push(`### ${workspace.workspace.name} (${workspace.workspace.relativePath})`, '')
    if (workspace.managers.length === 0) {
      lines.push('- No dependency managers detected.', '')
      continue
    }
    for (const manager of workspace.managers) {
      lines.push(`#### ${manager.managerName}`)
      lines.push(`- Status: ${manager.status}`)
      lines.push(`- Score: ${manager.score}`)
      lines.push(`- Lockfile ready: ${manager.lockfileReady ? 'yes' : 'no'}`)
      lines.push(`- Cache config ready: ${manager.cacheConfigReady ? 'yes' : 'no'}`)
      lines.push(`- Offline command ready: ${manager.offlineCommandReady ? 'yes' : 'no'}`)
      lines.push(`- Vendor/cache ready: ${manager.vendorCacheReady ? 'yes' : 'no'}`)
      lines.push('- Evidence:')
      lines.push(...manager.evidence.slice(0, 12).map((item) => `  - ${item.title}: ${item.value}${item.relativePath ? ` (${item.relativePath})` : ''}`))
      if (manager.findings.length > 0) {
        lines.push('- Findings:')
        for (const item of manager.findings) {
          lines.push(`  - ${item.severity}: ${item.title} - ${item.summary}`)
        }
      }
      lines.push('')
    }
  }

  return `${lines.join('\n')}\n`
}

function configSignal(content: string, managerId: DependencyManagerId): { kind: 'cache-config' | 'registry-config'; title: string; value: string } | null {
  const lower = content.toLowerCase()
  const registryWords = ['registry', 'mirror', 'proxy', 'repository', 'index-url', 'extra-index-url', 'source', 'url']
  const cacheWords = ['cache', 'offline', 'prefer-offline', 'frozen-lockfile', 'locked', 'no-index', 'find-links', 'vendor', 'vendored-sources', 'localrepository', 'go-offline']
  const registryWord = registryWords.find((word) => lower.includes(word))
  const cacheWord = cacheWords.find((word) => lower.includes(word))

  if (cacheWord) {
    return {
      kind: 'cache-config',
      title: `${managerId} cache/offline config`,
      value: cacheWord
    }
  }
  if (registryWord) {
    return {
      kind: 'registry-config',
      title: `${managerId} registry/mirror config`,
      value: registryWord
    }
  }
  return null
}

function managerConfigCandidates(managerId: DependencyManagerId): string[] {
  switch (managerId) {
    case 'npm':
    case 'pnpm':
      return ['.npmrc', '.pnpmrc']
    case 'yarn':
      return ['.yarnrc', '.yarnrc.yml']
    case 'bun':
      return ['bunfig.toml']
    case 'pip':
    case 'uv':
    case 'poetry':
    case 'pipenv':
      return ['pip.conf', 'pip.ini', 'pyproject.toml', 'setup.cfg', 'tox.ini']
    case 'conda':
      return ['.condarc', 'environment.yml']
    case 'maven':
      return ['settings.xml', '.mvn/maven.config']
    case 'gradle':
      return ['gradle.properties', 'settings.gradle', 'settings.gradle.kts']
    case 'cargo':
      return ['.cargo/config.toml', '.cargo/config']
    case 'go':
      return ['go.env', 'go.work']
    case 'flutter':
      return ['pubspec.yaml']
    case 'nuget':
      return ['nuget.config', 'NuGet.Config']
    case 'composer':
      return ['composer.json', 'auth.json']
    case 'bundler':
      return ['.bundle/config']
    case 'swiftpm':
      return ['Package.swift']
    case 'cocoapods':
      return ['Podfile']
    case 'helm':
      return ['Chart.yaml', 'repositories.yaml']
    case 'docker':
      return ['Dockerfile', 'docker-compose.yml', 'compose.yml']
    case 'bazel':
      return ['MODULE.bazel', 'MODULE.bazel.lock', 'WORKSPACE', 'WORKSPACE.bazel', '.bazelrc']
    case 'pants':
      return ['pants.toml', 'pants.rc', '.pants.rc']
    case 'buck':
      return ['.buckconfig', '.buckroot', 'BUCK', 'BUCK.v2']
    case 'native':
      return ['vcpkg.json', 'vcpkg-configuration.json', 'conanfile.txt', 'conanfile.py', 'CMakePresets.json']
    default:
      return []
  }
}

function vendorCacheCandidates(managerId: DependencyManagerId): string[] {
  switch (managerId) {
    case 'yarn':
      return ['.yarn/cache']
    case 'pip':
    case 'uv':
    case 'poetry':
    case 'pipenv':
      return ['wheelhouse', 'vendor', 'packages', 'dist']
    case 'cargo':
      return ['vendor', '.cargo/vendor']
    case 'go':
      return ['vendor', 'vendor/modules.txt']
    case 'composer':
      return ['vendor', 'cache']
    case 'bundler':
      return ['vendor/cache']
    case 'helm':
      return ['charts']
    case 'docker':
      return ['images', 'docker-images']
    case 'bazel':
      return ['.bazel/cache', 'bazel-cache']
    case 'pants':
      return ['.pants.d', 'pants-cache']
    case 'buck':
      return ['buck-out', '.buck-cache']
    case 'native':
      return ['vcpkg_installed', 'vendor', 'third_party']
    default:
      return []
  }
}

function offlineCommands(managerId: DependencyManagerId): string[] {
  switch (managerId) {
    case 'npm':
      return ['npm ci --prefer-offline']
    case 'pnpm':
      return ['pnpm install --frozen-lockfile --offline']
    case 'yarn':
      return ['yarn install --immutable --offline']
    case 'bun':
      return ['bun install --frozen-lockfile']
    case 'deno':
      return ['deno cache --lock=deno.lock --cached-only']
    case 'pip':
      return ['python -m pip install --no-index --find-links wheelhouse -r requirements.txt']
    case 'uv':
      return ['uv sync --locked --offline']
    case 'poetry':
      return ['poetry install --sync --no-root']
    case 'pipenv':
      return ['pipenv sync --deploy']
    case 'conda':
      return ['conda env create --offline -f environment.yml']
    case 'maven':
      return ['mvn -o verify', 'mvn dependency:go-offline']
    case 'gradle':
      return ['gradle --offline build']
    case 'cargo':
      return ['cargo build --locked --offline']
    case 'go':
      return ['go test -mod=vendor ./...', 'GOPROXY=off go test ./...']
    case 'flutter':
      return ['flutter pub get --offline']
    case 'nuget':
      return ['dotnet restore --locked-mode --ignore-failed-sources']
    case 'composer':
      return ['composer install --prefer-dist --no-interaction']
    case 'bundler':
      return ['bundle install --local']
    case 'swiftpm':
      return ['swift package resolve']
    case 'cocoapods':
      return ['pod install --deployment']
    case 'helm':
      return ['helm dependency build --skip-refresh']
    case 'docker':
      return ['docker compose config', 'docker load --input images.tar']
    case 'bazel':
      return ['bazel mod graph', 'bazel build //... --nobuild']
    case 'pants':
      return ['pants dependencies ::', 'pants generate-lockfiles --check']
    case 'buck':
      return ['buck2 query //...', 'buck2 targets //...']
    case 'native':
      return ['cmake --build build', 'vcpkg install --x-use-aria2=false']
    default:
      return []
  }
}

function supportModel(managerId: DependencyManagerId): string {
  switch (managerId) {
    case 'maven':
      return 'Warm the local repository with dependency:go-offline, then build with -o.'
    case 'gradle':
      return 'Use dependency locks, Gradle wrapper, and --offline after cache warm-up.'
    case 'docker':
      return 'Pre-pull and archive images; compose files alone do not guarantee offline rebuilds.'
    case 'bazel':
      return 'Use bzlmod locks, repository cache policy, and remote/local cache warm-up for hermetic build graph resolution.'
    case 'pants':
      return 'Commit generated lockfiles and warm Pants named caches before isolated CI runs.'
    case 'buck':
      return 'Keep cell configuration reviewable and warm Buck repository/cache artifacts before isolated builds.'
    case 'go':
      return 'Use go.sum plus GOPROXY cache or vendored modules for isolated environments.'
    case 'cargo':
      return 'Use Cargo.lock plus cargo vendor or warmed registry cache.'
    default:
      return 'Use committed locks plus a cache-warmed or mirror-backed install command.'
  }
}

function managerIdRequiresVendorCache(managerId: DependencyManagerId): boolean {
  return ['pip', 'uv', 'poetry', 'pipenv', 'cargo', 'go', 'bundler', 'helm', 'docker', 'bazel', 'pants', 'buck'].includes(managerId)
}

function ancestorWorkspaces(workspace: WorkspaceNode, allWorkspaces: WorkspaceNode[]): WorkspaceNode[] {
  const byId = new Map(allWorkspaces.map((item) => [item.id, item]))
  const ancestors: WorkspaceNode[] = []
  let current = workspace.parentId ? byId.get(workspace.parentId) : undefined
  while (current) {
    ancestors.push(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return ancestors
}

function evidence(input: OfflineCacheEvidence): OfflineCacheEvidence {
  return input
}

function finding(input: OfflineCacheFinding): OfflineCacheFinding {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function fileMatchesPattern(file: string, pattern: string): boolean {
  if (pattern === file) return true
  if (!pattern.includes('*')) return basename(file).toLowerCase() === pattern.toLowerCase()
  const regex = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`, 'i')
  return regex.test(file)
}

function normalizeRelative(root: string, path: string): string {
  return path.replace(resolve(root), '').replace(/^[\\/]+/, '').replace(/\\/g, '/') || '.'
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

function parseJson(content: string): any {
  if (!content.trim()) return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
