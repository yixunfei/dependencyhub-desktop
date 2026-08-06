import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve } from 'path'
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

export type LockfileDriftExportFormat = 'markdown' | 'json'
export type LockfileDriftStatus = 'ready' | 'warning' | 'blocked'
export type LockfileDriftSeverity = 'info' | 'warning' | 'blocked'
export type LockfileDriftFindingKind =
  | 'missing-lockfile'
  | 'stale-lockfile'
  | 'mixed-node-lockfiles'
  | 'package-manager-mismatch'
  | 'missing-package-manager-pin'
  | 'orphan-lockfile'
  | 'shared-root-lockfile'

export interface LockfileDriftFile {
  file: string
  path: string
  relativePath: string
  modifiedAt: string
  size: number
}

export interface LockfileDriftFinding {
  id: string
  kind: LockfileDriftFindingKind
  severity: LockfileDriftSeverity
  managerId?: DependencyManagerId
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface LockfileDriftWorkspace {
  workspace: WorkspaceNode
  status: LockfileDriftStatus
  score: number
  managers: DependencyManagerId[]
  packageManager?: string
  declaredManagerId?: DependencyManagerId
  manifestFiles: LockfileDriftFile[]
  localLockFiles: LockfileDriftFile[]
  inheritedLockFiles: LockfileDriftFile[]
  newestManifestAt?: string
  newestLockfileAt?: string
  findings: LockfileDriftFinding[]
}

export interface LockfileDriftSummary {
  workspaceCount: number
  ready: number
  warning: number
  blocked: number
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
  missingLockfileCount: number
  staleLockfileCount: number
  mixedNodeLockfileCount: number
  packageManagerMismatchCount: number
  missingPackageManagerPinCount: number
  inheritedLockfileWorkspaceCount: number
  orphanLockfileWorkspaceCount: number
  managerCount: number
  managers: DependencyManagerId[]
  byManager: Record<string, number>
}

export interface LockfileDriftReport {
  generatedAt: string
  projectPath: string
  discovery: WorkspaceDiscoveryReport
  workspaces: LockfileDriftWorkspace[]
  summary: LockfileDriftSummary
}

export interface LockfileDriftExportResult {
  path: string
  format: LockfileDriftExportFormat
  generatedAt: string
  workspaceCount: number
  summary: LockfileDriftSummary
}

const REPORT_DIR = '.npmDesktopManager/reports'
const LOCK_DRIFT_TOLERANCE_MS = 1000
const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))
const NODE_MANAGERS = new Set<DependencyManagerId>(['npm', 'pnpm', 'yarn', 'bun'])
const LOCK_STRICT_MANAGERS = new Set<DependencyManagerId>([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'uv',
  'poetry',
  'pipenv',
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

export class LockfileDriftService {
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService

  constructor(dependencies: { workspaceDiscoveryService?: WorkspaceDiscoveryService } = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
  }

  async report(projectPath: string): Promise<LockfileDriftReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const discovery = await this.workspaceDiscoveryService.report(root)
    const workspaces = await Promise.all(discovery.workspaces.map((workspace) => (
      inspectWorkspaceDrift(root, workspace, discovery.workspaces)
    )))

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      discovery,
      workspaces,
      summary: summarize(workspaces)
    }
  }

  async exportMarkdown(projectPath: string): Promise<LockfileDriftExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'lockfile-drift-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderLockfileDriftMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      workspaceCount: report.workspaces.length,
      summary: report.summary
    }
  }

  async exportJson(projectPath: string): Promise<LockfileDriftExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'lockfile-drift-report.json')
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

async function inspectWorkspaceDrift(
  root: string,
  workspace: WorkspaceNode,
  allWorkspaces: WorkspaceNode[]
): Promise<LockfileDriftWorkspace> {
  const [manifestFiles, localLockFiles, packageManager] = await Promise.all([
    fileRefs(root, workspace.manifestFiles),
    fileRefs(root, workspace.lockFiles),
    readPackageManager(workspace.path)
  ])
  const declaredManagerId = declaredNodeManager(packageManager)
  const inheritedByKey = new Map<string, LockfileDriftFile>()
  const findings: LockfileDriftFinding[] = []
  const managers = workspace.managerIds.filter((managerId) => {
    const manager = MANAGER_BY_ID.get(managerId)
    return Boolean(manager && hasManagerEvidence(workspace, manager))
  })

  for (const managerId of managers) {
    const manager = MANAGER_BY_ID.get(managerId)
    if (!manager || manager.lockFiles.length === 0) continue

    const managerManifests = manifestFiles.filter((file) => manager.manifestFiles.some((pattern) => fileMatchesPattern(file.file, pattern)))
    const localLocks = localLockFiles.filter((file) => manager.lockFiles.some((pattern) => fileMatchesPattern(file.file, pattern)))
    const inheritedLocks = localLocks.length > 0 ? [] : await inheritedLockRefs(root, workspace, allWorkspaces, manager)
    for (const lock of inheritedLocks) inheritedByKey.set(lock.relativePath, lock)

    if (localLocks.length === 0 && inheritedLocks.length === 0) {
      findings.push(missingLockfileFinding(workspace, managerId, manager))
      continue
    }

    if (localLocks.length === 0 && inheritedLocks.length > 0) {
      findings.push(sharedRootLockfileFinding(workspace, managerId, inheritedLocks))
    }

    const coverageLocks = localLocks.length > 0 ? localLocks : inheritedLocks
    const stale = staleLockfileEvidence(managerManifests, coverageLocks)
    if (stale) {
      findings.push(staleLockfileFinding(workspace, managerId, stale.manifest, stale.lockfile))
    }
  }

  const nodeLockManagers = nodeLockManagersFor(localLockFiles)
  const inheritedNodeLockManagers = nodeLockManagersFor([...inheritedByKey.values()])
  const effectiveNodeLockManagers = nodeLockManagers.length > 0 ? nodeLockManagers : inheritedNodeLockManagers
  if (nodeLockManagers.length > 1) {
    findings.push(mixedNodeLockfilesFinding(workspace, nodeLockManagers, localLockFiles))
  }

  if (declaredManagerId && effectiveNodeLockManagers.length > 0 && !effectiveNodeLockManagers.includes(declaredManagerId)) {
    findings.push(packageManagerMismatchFinding(workspace, packageManager || declaredManagerId, declaredManagerId, effectiveNodeLockManagers))
  } else if (!declaredManagerId && managers.some((managerId) => NODE_MANAGERS.has(managerId))) {
    findings.push(missingPackageManagerPinFinding(workspace))
  }

  if (workspace.lockFiles.length > 0 && workspace.manifestFiles.length === 0) {
    findings.push(orphanLockfileFinding(workspace, localLockFiles))
  }

  const inheritedLockFiles = [...inheritedByKey.values()].sort(fileSort)
  const allLockFiles = [...localLockFiles, ...inheritedLockFiles]
  return {
    workspace,
    status: statusFromFindings(findings),
    score: scoreFromFindings(findings),
    managers,
    packageManager,
    declaredManagerId,
    manifestFiles,
    localLockFiles,
    inheritedLockFiles,
    newestManifestAt: newestFile(manifestFiles)?.modifiedAt,
    newestLockfileAt: newestFile(allLockFiles)?.modifiedAt,
    findings
  }
}

async function fileRefs(root: string, files: string[]): Promise<LockfileDriftFile[]> {
  const refs = await Promise.all(files.map(async (file) => {
    try {
      const path = join(root, file)
      const stats = await stat(path)
      return {
        file: basename(file),
        path,
        relativePath: normalizeRelative(file),
        modifiedAt: stats.mtime.toISOString(),
        size: stats.size
      }
    } catch {
      return null
    }
  }))
  return refs.filter((file): file is LockfileDriftFile => Boolean(file)).sort(fileSort)
}

async function inheritedLockRefs(
  root: string,
  workspace: WorkspaceNode,
  allWorkspaces: WorkspaceNode[],
  manager: DependencyManagerDefinition
): Promise<LockfileDriftFile[]> {
  const ancestors = allWorkspaces
    .filter((candidate) => candidate.id !== workspace.id && isAncestorPath(candidate.path, workspace.path))
    .sort((a, b) => b.path.length - a.path.length)

  for (const ancestor of ancestors) {
    const matching = ancestor.lockFiles.filter((file) => manager.lockFiles.some((pattern) => fileMatchesPattern(file, pattern)))
    if (matching.length > 0) return fileRefs(root, matching)
  }
  return []
}

function staleLockfileEvidence(
  manifests: LockfileDriftFile[],
  lockfiles: LockfileDriftFile[]
): { manifest: LockfileDriftFile; lockfile: LockfileDriftFile } | null {
  const newestManifest = newestFile(manifests)
  const newestLockfile = newestFile(lockfiles)
  if (!newestManifest || !newestLockfile) return null
  if (Date.parse(newestManifest.modifiedAt) - Date.parse(newestLockfile.modifiedAt) <= LOCK_DRIFT_TOLERANCE_MS) return null
  return {
    manifest: newestManifest,
    lockfile: newestLockfile
  }
}

function hasManagerEvidence(workspace: WorkspaceNode, manager: DependencyManagerDefinition): boolean {
  return workspace.managerIds.includes(manager.id) && (
    workspace.manifestFiles.some((file) => manager.manifestFiles.some((pattern) => fileMatchesPattern(file, pattern))) ||
    workspace.lockFiles.some((file) => manager.lockFiles.some((pattern) => fileMatchesPattern(file, pattern))) ||
    workspace.configFiles.some((file) => (manager.configFiles || []).some((pattern) => fileMatchesPattern(file, pattern)))
  )
}

async function readPackageManager(workspacePath: string): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(await readFile(join(workspacePath, 'package.json'), 'utf-8'))
    return typeof parsed?.packageManager === 'string' && parsed.packageManager.trim()
      ? parsed.packageManager.trim()
      : undefined
  } catch {
    return undefined
  }
}

function declaredNodeManager(packageManager?: string): DependencyManagerId | undefined {
  if (!packageManager) return undefined
  const name = packageManager.trim().split('@')[0].toLowerCase()
  return NODE_MANAGERS.has(name as DependencyManagerId) ? name as DependencyManagerId : undefined
}

function nodeLockManagersFor(files: LockfileDriftFile[]): DependencyManagerId[] {
  return [...new Set(files.map((file) => managerForNodeLockfile(file.file)).filter(Boolean) as DependencyManagerId[])]
    .sort((a, b) => a.localeCompare(b))
}

function managerForNodeLockfile(file: string): DependencyManagerId | undefined {
  const name = basename(file).toLowerCase()
  if (name === 'package-lock.json' || name === 'npm-shrinkwrap.json') return 'npm'
  if (name === 'pnpm-lock.yaml') return 'pnpm'
  if (name === 'yarn.lock') return 'yarn'
  if (name === 'bun.lock' || name === 'bun.lockb') return 'bun'
  return undefined
}

function missingLockfileFinding(
  workspace: WorkspaceNode,
  managerId: DependencyManagerId,
  manager: DependencyManagerDefinition
): LockfileDriftFinding {
  const strict = LOCK_STRICT_MANAGERS.has(managerId)
  return {
    id: `${workspace.id}:${managerId}:missing-lockfile`,
    kind: 'missing-lockfile',
    severity: strict ? 'blocked' : 'warning',
    managerId,
    title: `${manager.shortName} lockfile missing`,
    summary: `${workspace.name} declares ${manager.shortName} dependency inputs but no local or inherited lockfile was found.`,
    recommendation: manager.lockFiles.length > 0
      ? `Generate and commit one of: ${manager.lockFiles.join(', ')}.`
      : 'Review whether this ecosystem has a reproducible lock or freeze artifact.',
    evidence: [
      `Workspace: ${workspace.relativePath}`,
      `Expected lockfiles: ${manager.lockFiles.join(', ') || 'none declared'}`,
      `Detected manifests: ${workspace.manifestFiles.join(', ') || '-'}`
    ]
  }
}

function sharedRootLockfileFinding(
  workspace: WorkspaceNode,
  managerId: DependencyManagerId,
  inheritedLocks: LockfileDriftFile[]
): LockfileDriftFinding {
  return {
    id: `${workspace.id}:${managerId}:shared-root-lockfile`,
    kind: 'shared-root-lockfile',
    severity: 'info',
    managerId,
    title: 'Lockfile inherited from parent workspace',
    summary: `${workspace.name} is covered by a parent workspace lockfile rather than a local lockfile.`,
    recommendation: 'Keep parent lockfile updates in the same review as workspace manifest changes.',
    evidence: inheritedLocks.map((file) => `${file.relativePath} modified ${file.modifiedAt}`)
  }
}

function staleLockfileFinding(
  workspace: WorkspaceNode,
  managerId: DependencyManagerId,
  manifest: LockfileDriftFile,
  lockfile: LockfileDriftFile
): LockfileDriftFinding {
  return {
    id: `${workspace.id}:${managerId}:stale-lockfile`,
    kind: 'stale-lockfile',
    severity: 'warning',
    managerId,
    title: 'Manifest is newer than lockfile',
    summary: `${manifest.relativePath} was modified after ${lockfile.relativePath}; frozen installs may not reflect manifest changes.`,
    recommendation: 'Regenerate the lockfile with the selected package manager and re-run readiness checks.',
    evidence: [
      `Manifest: ${manifest.relativePath} modified ${manifest.modifiedAt}`,
      `Lockfile: ${lockfile.relativePath} modified ${lockfile.modifiedAt}`
    ]
  }
}

function mixedNodeLockfilesFinding(
  workspace: WorkspaceNode,
  managers: DependencyManagerId[],
  lockfiles: LockfileDriftFile[]
): LockfileDriftFinding {
  return {
    id: `${workspace.id}:node:mixed-lockfiles`,
    kind: 'mixed-node-lockfiles',
    severity: 'warning',
    title: 'Multiple Node.js lockfile families detected',
    summary: `${workspace.name} contains lockfiles for ${managers.join(', ')}.`,
    recommendation: 'Keep only the lockfile family for the package manager used in CI and release automation.',
    evidence: lockfiles
      .filter((file) => managerForNodeLockfile(file.file))
      .map((file) => `${file.relativePath} -> ${managerForNodeLockfile(file.file)}`)
  }
}

function packageManagerMismatchFinding(
  workspace: WorkspaceNode,
  packageManager: string,
  declaredManagerId: DependencyManagerId,
  lockManagers: DependencyManagerId[]
): LockfileDriftFinding {
  return {
    id: `${workspace.id}:node:package-manager-mismatch`,
    kind: 'package-manager-mismatch',
    severity: 'blocked',
    managerId: declaredManagerId,
    title: 'packageManager does not match lockfile family',
    summary: `${workspace.name} declares ${packageManager}, but lock coverage points to ${lockManagers.join(', ')}.`,
    recommendation: 'Align packageManager, CI install commands, and committed Node.js lockfiles before release.',
    evidence: [
      `packageManager: ${packageManager}`,
      `Lockfile managers: ${lockManagers.join(', ')}`
    ]
  }
}

function missingPackageManagerPinFinding(workspace: WorkspaceNode): LockfileDriftFinding {
  return {
    id: `${workspace.id}:node:missing-package-manager-pin`,
    kind: 'missing-package-manager-pin',
    severity: workspace.relativePath === '.' ? 'warning' : 'info',
    title: 'Node.js package manager is not pinned',
    summary: `${workspace.name} has Node.js dependency files but package.json does not declare packageManager.`,
    recommendation: 'Set packageManager in package.json so local, CI, and release installs use the same tool and major version.',
    evidence: [`Workspace: ${workspace.relativePath}`]
  }
}

function orphanLockfileFinding(workspace: WorkspaceNode, lockfiles: LockfileDriftFile[]): LockfileDriftFinding {
  return {
    id: `${workspace.id}:orphan-lockfile`,
    kind: 'orphan-lockfile',
    severity: 'warning',
    title: 'Lockfile without manifest',
    summary: `${workspace.name} has lockfiles but no dependency manifest was discovered.`,
    recommendation: 'Remove stale lockfiles or add the missing manifest so dependency governance can resolve ownership.',
    evidence: lockfiles.map((file) => file.relativePath)
  }
}

function statusFromFindings(findings: LockfileDriftFinding[]): LockfileDriftStatus {
  if (findings.some((finding) => finding.severity === 'blocked')) return 'blocked'
  if (findings.some((finding) => finding.severity === 'warning')) return 'warning'
  return 'ready'
}

function scoreFromFindings(findings: LockfileDriftFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'blocked') return total + 25
    if (finding.severity === 'warning') return total + 8
    return total + 2
  }, 0)
  return Math.max(0, 100 - penalty)
}

function summarize(workspaces: LockfileDriftWorkspace[]): LockfileDriftSummary {
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
    missingLockfileCount: findings.filter((finding) => finding.kind === 'missing-lockfile').length,
    staleLockfileCount: findings.filter((finding) => finding.kind === 'stale-lockfile').length,
    mixedNodeLockfileCount: findings.filter((finding) => finding.kind === 'mixed-node-lockfiles').length,
    packageManagerMismatchCount: findings.filter((finding) => finding.kind === 'package-manager-mismatch').length,
    missingPackageManagerPinCount: findings.filter((finding) => finding.kind === 'missing-package-manager-pin').length,
    inheritedLockfileWorkspaceCount: workspaces.filter((workspace) => workspace.inheritedLockFiles.length > 0).length,
    orphanLockfileWorkspaceCount: workspaces.filter((workspace) => workspace.findings.some((finding) => finding.kind === 'orphan-lockfile')).length,
    managerCount: managers.length,
    managers,
    byManager: countBy(workspaces.flatMap((workspace) => workspace.managers))
  }
}

function renderLockfileDriftMarkdown(report: LockfileDriftReport): string {
  const lines = [
    '# Lockfile Drift Report',
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
    `- Missing lockfiles: ${report.summary.missingLockfileCount}`,
    `- Stale lockfiles: ${report.summary.staleLockfileCount}`,
    `- Mixed Node.js lockfiles: ${report.summary.mixedNodeLockfileCount}`,
    `- Package manager mismatches: ${report.summary.packageManagerMismatchCount}`,
    `- Missing packageManager pins: ${report.summary.missingPackageManagerPinCount}`,
    `- Inherited lockfile coverage: ${report.summary.inheritedLockfileWorkspaceCount}`,
    '',
    '## Workspace Matrix',
    '',
    '| Status | Score | Workspace | Managers | packageManager | Manifests | Local locks | Inherited locks | Findings |',
    '| --- | ---: | --- | --- | --- | --- | --- | --- | --- |'
  ]

  for (const workspace of report.workspaces) {
    lines.push([
      workspace.status,
      String(workspace.score),
      markdownCell(workspace.workspace.relativePath),
      markdownCell(workspace.managers.join(', ') || '-'),
      markdownCell(workspace.packageManager || '-'),
      markdownCell(workspace.manifestFiles.map((file) => file.relativePath).join('<br>') || '-'),
      markdownCell(workspace.localLockFiles.map((file) => file.relativePath).join('<br>') || '-'),
      markdownCell(workspace.inheritedLockFiles.map((file) => file.relativePath).join('<br>') || '-'),
      markdownCell(workspace.findings.map((finding) => `${finding.severity}: ${finding.title}`).join('<br>') || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.workspaces.every((workspace) => workspace.findings.length === 0)) {
    lines.push('No lockfile drift findings were detected.')
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

function newestFile(files: LockfileDriftFile[]): LockfileDriftFile | undefined {
  return [...files].sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))[0]
}

function fileSort(a: LockfileDriftFile, b: LockfileDriftFile): number {
  return a.relativePath.localeCompare(b.relativePath)
}

function fileMatchesPattern(file: string, pattern: string): boolean {
  const fileName = basename(file).toLowerCase()
  const normalizedPattern = pattern.toLowerCase()
  if (!normalizedPattern.includes('*')) return fileName === basename(normalizedPattern)
  const regex = new RegExp(`^${escapeRegExp(basename(normalizedPattern)).replace(/\\\*/g, '.*')}$`, 'i')
  return regex.test(fileName)
}

function isAncestorPath(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return Boolean(rel && !rel.startsWith('..') && rel !== child)
}

function normalizeRelative(file: string): string {
  return file.replace(/\\/g, '/')
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}
