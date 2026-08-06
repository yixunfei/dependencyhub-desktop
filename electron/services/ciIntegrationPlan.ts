import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport,
  type WorkspaceNode
} from './workspaceDiscovery'
import {
  ReadinessGateService,
  type ReadinessGateReport,
  type ReadinessGateStatus
} from './readinessGate'
import {
  LockfileDriftService,
  type LockfileDriftReport
} from './lockfileDrift'
import {
  RuntimePinningService,
  type RuntimePinningReport
} from './runtimePinning'
import {
  OfflineCacheReadinessService,
  type OfflineCacheEvidence,
  type OfflineCacheReadinessReport
} from './offlineCacheReadiness'
import {
  ReleaseRiskProfileService,
  type ReleaseRiskCategory,
  type ReleaseRiskProfileReport,
  type ReleaseRiskProfileStatus
} from './releaseRiskProfile'

export type CiIntegrationPlanExportFormat = 'markdown' | 'json' | 'github-actions'
export type CiIntegrationProvider = 'github-actions'
export type CiIntegrationPlanStatus = 'ready' | 'warning' | 'blocked'
export type CiIntegrationWarningSeverity = 'info' | 'warning' | 'blocked'
export type CiIntegrationWarningSource =
  | 'readiness-gate'
  | 'lockfile-drift'
  | 'runtime-pinning'
  | 'offline-cache-readiness'
  | 'release-risk-profile'
  | 'ci-integration-plan'
export type CiIntegrationStepStage =
  | 'checkout'
  | 'setup'
  | 'cache'
  | 'install'
  | 'verify'
  | 'audit'
  | 'evidence'
  | 'publish'

export interface CiIntegrationCommand {
  managerId: DependencyManagerId
  title: string
  command: string
  source: 'offline-cache' | 'generated'
  offlineCapable: boolean
}

export interface CiIntegrationMatrixEntry {
  workspaceId: string
  workspaceName: string
  workspaceRelativePath: string
  cwd: string
  managerIds: DependencyManagerId[]
  manifestFiles: string[]
  lockFiles: string[]
  configFiles: string[]
  installCommands: CiIntegrationCommand[]
  verificationCommands: CiIntegrationCommand[]
  cacheKeys: string[]
  requiredSecrets: string[]
}

export interface CiIntegrationStep {
  id: string
  title: string
  stage: CiIntegrationStepStage
  kind: 'uses' | 'run' | 'upload-artifact'
  command?: string
  uses?: string
  if?: string
  workingDirectory?: string
  managerId?: DependencyManagerId
  source: 'generated' | 'offline-cache' | 'governance'
}

export interface CiIntegrationJob {
  id: string
  name: string
  provider: CiIntegrationProvider
  runner: string
  needs: string[]
  workspaceCount: number
  managerIds: DependencyManagerId[]
  matrix: CiIntegrationMatrixEntry[]
  steps: CiIntegrationStep[]
  cacheKeys: string[]
  requiredSecrets: string[]
  artifacts: string[]
  warnings: CiIntegrationWarning[]
}

export interface CiIntegrationWarning {
  id: string
  severity: CiIntegrationWarningSeverity
  source: CiIntegrationWarningSource
  releaseRiskCategory?: ReleaseRiskCategory
  title: string
  summary: string
  recommendation: string
  evidence: string[]
  managerId?: DependencyManagerId
  workspaceId?: string
  workspaceName?: string
  workspaceRelativePath?: string
}

export interface CiIntegrationPlanSummary {
  status: CiIntegrationPlanStatus
  workspaceCount: number
  managerCount: number
  managers: DependencyManagerId[]
  jobCount: number
  matrixEntryCount: number
  installCommandCount: number
  offlineCommandCount: number
  verificationCommandCount: number
  cacheKeyCount: number
  requiredSecretCount: number
  artifactCount: number
  warningCount: number
  blockedWarningCount: number
  readinessStatus?: ReadinessGateStatus
  releaseRiskStatus?: ReleaseRiskProfileStatus
  lockfileDriftFindingCount: number
  runtimePinningFindingCount: number
  offlineCacheFindingCount: number
  deploymentReferenceCount: number
  floatingDeploymentRefCount: number
  deploymentBaselineEvidenceCount: number
  missingDeploymentBaselineCount: number
  deploymentWarningCount: number
}

export interface CiIntegrationPlanSources {
  discovery: Pick<WorkspaceDiscoveryReport, 'generatedAt' | 'summary'>
  readiness?: Pick<ReadinessGateReport, 'generatedAt' | 'status' | 'score' | 'summary'>
  lockfileDrift?: Pick<LockfileDriftReport, 'generatedAt' | 'summary'>
  runtimePinning?: Pick<RuntimePinningReport, 'generatedAt' | 'summary'>
  offlineCache?: Pick<OfflineCacheReadinessReport, 'generatedAt' | 'summary'>
  releaseRisk?: Pick<ReleaseRiskProfileReport, 'generatedAt' | 'status' | 'score' | 'summary'>
  errors: Partial<Record<CiIntegrationWarningSource, string>>
}

export interface CiIntegrationPlanReport {
  generatedAt: string
  projectPath: string
  provider: CiIntegrationProvider
  status: CiIntegrationPlanStatus
  summary: CiIntegrationPlanSummary
  matrix: CiIntegrationMatrixEntry[]
  jobs: CiIntegrationJob[]
  warnings: CiIntegrationWarning[]
  requiredSecrets: string[]
  cacheKeys: string[]
  artifacts: string[]
  workflowYaml: string
  sources: CiIntegrationPlanSources
}

export interface CiIntegrationPlanExportResult {
  path: string
  format: CiIntegrationPlanExportFormat
  generatedAt: string
  status: CiIntegrationPlanStatus
  workspaceCount: number
  jobCount: number
  warningCount: number
  count: number
  summary: CiIntegrationPlanSummary
}

export interface CiIntegrationPlanDependencies {
  workspaceDiscoveryService?: WorkspaceDiscoveryService
  readinessGateService?: ReadinessGateService
  lockfileDriftService?: LockfileDriftService
  runtimePinningService?: RuntimePinningService
  offlineCacheReadinessService?: OfflineCacheReadinessService
  releaseRiskProfileService?: ReleaseRiskProfileService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))

export class CiIntegrationPlanService {
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService
  private readonly readinessGateService: ReadinessGateService
  private readonly lockfileDriftService: LockfileDriftService
  private readonly runtimePinningService: RuntimePinningService
  private readonly offlineCacheReadinessService: OfflineCacheReadinessService
  private readonly releaseRiskProfileService: ReleaseRiskProfileService

  constructor(dependencies: CiIntegrationPlanDependencies = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.readinessGateService = dependencies.readinessGateService || new ReadinessGateService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.lockfileDriftService = dependencies.lockfileDriftService || new LockfileDriftService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.runtimePinningService = dependencies.runtimePinningService || new RuntimePinningService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.offlineCacheReadinessService = dependencies.offlineCacheReadinessService || new OfflineCacheReadinessService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.releaseRiskProfileService = dependencies.releaseRiskProfileService || new ReleaseRiskProfileService({
      readinessGateService: this.readinessGateService,
      workspaceDiscoveryService: this.workspaceDiscoveryService,
      lockfileDriftService: this.lockfileDriftService,
      runtimePinningService: this.runtimePinningService,
      offlineCacheReadinessService: this.offlineCacheReadinessService
    })
  }

  async plan(projectPath: string): Promise<CiIntegrationPlanReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)

    const discovery = await this.workspaceDiscoveryService.report(root)
    const [readinessResult, lockfileResult, runtimeResult, offlineResult, riskResult] = await Promise.all([
      capture(() => this.readinessGateService.report(root)),
      capture(() => this.lockfileDriftService.report(root)),
      capture(() => this.runtimePinningService.report(root)),
      capture(() => this.offlineCacheReadinessService.report(root)),
      capture(() => this.releaseRiskProfileService.report(root))
    ])

    const matrix = discovery.workspaces.map((workspace) => workspaceMatrixEntry(root, workspace, offlineResult.value))
    const warnings = normalizeWarnings({
      readiness: readinessResult.value,
      lockfileDrift: lockfileResult.value,
      runtimePinning: runtimeResult.value,
      offlineCache: offlineResult.value,
      releaseRisk: riskResult.value,
      sourceErrors: sourceErrors(readinessResult, lockfileResult, runtimeResult, offlineResult, riskResult)
    })
    const requiredSecrets = unique(matrix.flatMap((entry) => entry.requiredSecrets)).sort()
    const cacheKeys = unique(matrix.flatMap((entry) => entry.cacheKeys)).sort()
    const artifacts = [
      '.npmDesktopManager/reports/**',
      '.npmDesktopManager/reports/release-bundle/**',
      'coverage/**'
    ]
    const jobs = buildJobs(matrix, warnings)
    const summary = summarize({
      matrix,
      jobs,
      warnings,
      requiredSecrets,
      cacheKeys,
      artifacts,
      readiness: readinessResult.value,
      lockfileDrift: lockfileResult.value,
      runtimePinning: runtimeResult.value,
      offlineCache: offlineResult.value,
      releaseRisk: riskResult.value
    })
    const workflowYaml = renderGithubActionsWorkflow({
      matrix,
      requiredSecrets,
      artifacts,
      status: summary.status
    })

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      provider: 'github-actions',
      status: summary.status,
      summary,
      matrix,
      jobs,
      warnings,
      requiredSecrets,
      cacheKeys,
      artifacts,
      workflowYaml,
      sources: {
        discovery: {
          generatedAt: discovery.generatedAt,
          summary: discovery.summary
        },
        readiness: readinessResult.value
          ? {
              generatedAt: readinessResult.value.generatedAt,
              status: readinessResult.value.status,
              score: readinessResult.value.score,
              summary: readinessResult.value.summary
            }
          : undefined,
        lockfileDrift: lockfileResult.value
          ? {
              generatedAt: lockfileResult.value.generatedAt,
              summary: lockfileResult.value.summary
            }
          : undefined,
        runtimePinning: runtimeResult.value
          ? {
              generatedAt: runtimeResult.value.generatedAt,
              summary: runtimeResult.value.summary
            }
          : undefined,
        offlineCache: offlineResult.value
          ? {
              generatedAt: offlineResult.value.generatedAt,
              summary: offlineResult.value.summary
            }
          : undefined,
        releaseRisk: riskResult.value
          ? {
              generatedAt: riskResult.value.generatedAt,
              status: riskResult.value.status,
              score: riskResult.value.score,
              summary: riskResult.value.summary
            }
          : undefined,
        errors: sourceErrors(readinessResult, lockfileResult, runtimeResult, offlineResult, riskResult)
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<CiIntegrationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'ci-integration-plan.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderCiIntegrationPlanMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<CiIntegrationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'ci-integration-plan.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }

  async exportGithubActions(projectPath: string): Promise<CiIntegrationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'ci', 'github-actions-dependency-governance.yml')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, report.workflowYaml, 'utf-8')
    return exportResult(path, 'github-actions', report)
  }
}

function workspaceMatrixEntry(
  root: string,
  workspace: WorkspaceNode,
  offlineReport?: OfflineCacheReadinessReport
): CiIntegrationMatrixEntry {
  const managerIds = unique(workspace.managerIds).sort() as DependencyManagerId[]
  const installCommands = managerIds.map((managerId) => installCommandFor(root, workspace, managerId, offlineReport))
  const verificationCommands = managerIds.map((managerId) => verificationCommandFor(managerId))
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceRelativePath: workspace.relativePath,
    cwd: workspace.relativePath === '.' ? '.' : workspace.relativePath,
    managerIds,
    manifestFiles: workspace.manifestFiles,
    lockFiles: workspace.lockFiles,
    configFiles: workspace.configFiles,
    installCommands,
    verificationCommands,
    cacheKeys: unique(managerIds.map(cacheKeyForManager)).sort(),
    requiredSecrets: unique(managerIds.flatMap(requiredSecretsForManager)).sort()
  }
}

function installCommandFor(
  root: string,
  workspace: WorkspaceNode,
  managerId: DependencyManagerId,
  offlineReport?: OfflineCacheReadinessReport
): CiIntegrationCommand {
  const offline = offlineReport?.workspaces
    .find((item) => item.workspace.id === workspace.id)
    ?.managers
    .find((manager) => manager.managerId === managerId)
    ?.evidence
    .find((item): item is OfflineCacheEvidence => item.kind === 'offline-command')
  const fallback = fallbackInstallCommand(managerId)
  const manager = MANAGER_BY_ID.get(managerId)
  const command = offline?.value || fallback
  return {
    managerId,
    title: `${manager?.shortName || managerId} install`,
    command: relativizeWorkspaceCommand(root, workspace, command),
    source: offline ? 'offline-cache' : 'generated',
    offlineCapable: Boolean(offline) || offlineInstallManagers.has(managerId)
  }
}

function verificationCommandFor(managerId: DependencyManagerId): CiIntegrationCommand {
  const manager = MANAGER_BY_ID.get(managerId)
  return {
    managerId,
    title: `${manager?.shortName || managerId} verification`,
    command: fallbackVerificationCommand(managerId),
    source: 'generated',
    offlineCapable: false
  }
}

function buildJobs(matrix: CiIntegrationMatrixEntry[], warnings: CiIntegrationWarning[]): CiIntegrationJob[] {
  const managerIds = unique(matrix.flatMap((entry) => entry.managerIds)).sort() as DependencyManagerId[]
  const workspaceWarnings = warnings.filter((item) => !isReleaseEvidenceWarning(item)).slice(0, 50)
  const releaseEvidenceWarnings = warnings.filter(isReleaseEvidenceWarning).slice(0, 50)
  return [
    {
      id: 'workspace-dependencies',
      name: 'Workspace dependency governance',
      provider: 'github-actions',
      runner: 'ubuntu-latest',
      needs: [],
      workspaceCount: matrix.length,
      managerIds,
      matrix,
      steps: [
        step({ id: 'checkout', title: 'Checkout repository', stage: 'checkout', kind: 'uses', uses: 'actions/checkout@v4' }),
        ...setupSteps(managerIds),
        ...managerIds.map((managerId) => step({
          id: `${managerId}-install`,
          title: `${managerLabel(managerId)} install`,
          stage: 'install',
          kind: 'run',
          command: fallbackInstallCommand(managerId),
          if: managerIf(managerId),
          workingDirectory: '${{ matrix.workspace }}',
          managerId,
          source: offlineInstallManagers.has(managerId) ? 'offline-cache' : 'generated'
        })),
        ...managerIds.map((managerId) => step({
          id: `${managerId}-verify`,
          title: `${managerLabel(managerId)} verification`,
          stage: 'verify',
          kind: 'run',
          command: fallbackVerificationCommand(managerId),
          if: managerIf(managerId),
          workingDirectory: '${{ matrix.workspace }}',
          managerId,
          source: 'generated'
        })),
        step({
          id: 'upload-workspace-reports',
          title: 'Upload dependency reports',
          stage: 'evidence',
          kind: 'upload-artifact',
          uses: 'actions/upload-artifact@v4',
          source: 'generated'
        })
      ],
      cacheKeys: unique(matrix.flatMap((entry) => entry.cacheKeys)).sort(),
      requiredSecrets: unique(matrix.flatMap((entry) => entry.requiredSecrets)).sort(),
      artifacts: ['.npmDesktopManager/reports/**', 'coverage/**'],
      warnings: workspaceWarnings
    },
    {
      id: 'release-evidence',
      name: 'Release evidence bundle',
      provider: 'github-actions',
      runner: 'ubuntu-latest',
      needs: ['workspace-dependencies'],
      workspaceCount: 1,
      managerIds,
      matrix: matrix.filter((entry) => entry.workspaceRelativePath === '.').slice(0, 1),
      steps: [
        step({ id: 'checkout', title: 'Checkout repository', stage: 'checkout', kind: 'uses', uses: 'actions/checkout@v4' }),
        step({ id: 'setup-node', title: 'Setup Node.js for framework scripts', stage: 'setup', kind: 'uses', uses: 'actions/setup-node@v4' }),
        step({ id: 'npm-ci', title: 'Install framework tooling', stage: 'install', kind: 'run', command: 'npm ci --prefer-offline', source: 'generated' }),
        step({ id: 'verify-framework', title: 'Run framework verification', stage: 'verify', kind: 'run', command: 'npm run verify:framework --if-present', source: 'governance' }),
        step({ id: 'deployment-release-gate', title: 'Check deployment release gates', stage: 'audit', kind: 'run', command: deploymentReleaseGateCommand(), source: 'governance' }),
        step({ id: 'release-evidence-completeness', title: 'Check release evidence completeness', stage: 'audit', kind: 'run', command: releaseEvidenceCompletenessGateCommand(), source: 'governance' }),
        step({ id: 'test', title: 'Run project tests', stage: 'verify', kind: 'run', command: 'npm test --if-present', source: 'generated' }),
        step({ id: 'upload-release-evidence', title: 'Upload release evidence', stage: 'evidence', kind: 'upload-artifact', uses: 'actions/upload-artifact@v4', source: 'generated' })
      ],
      cacheKeys: ['${{ runner.os }}-npm-${{ hashFiles(\'**/package-lock.json\') }}'],
      requiredSecrets: [],
      artifacts: ['.npmDesktopManager/reports/**'],
      warnings: releaseEvidenceWarnings
    }
  ]
}

function setupSteps(managerIds: DependencyManagerId[]): CiIntegrationStep[] {
  const steps: CiIntegrationStep[] = []
  if (managerIds.some((managerId) => ['npm', 'pnpm', 'yarn'].includes(managerId))) {
    steps.push(step({
      id: 'setup-node',
      title: 'Setup Node.js',
      stage: 'setup',
      kind: 'uses',
      uses: 'actions/setup-node@v4',
      if: managersIf(['npm', 'pnpm', 'yarn'])
    }))
    steps.push(step({
      id: 'corepack-enable',
      title: 'Enable Corepack',
      stage: 'setup',
      kind: 'run',
      command: 'corepack enable',
      if: managersIf(['pnpm', 'yarn'])
    }))
  }
  if (managerIds.includes('bun')) {
    steps.push(step({ id: 'setup-bun', title: 'Setup Bun', stage: 'setup', kind: 'uses', uses: 'oven-sh/setup-bun@v2', if: managerIf('bun') }))
  }
  if (managerIds.some((managerId) => ['pip', 'uv', 'poetry', 'pipenv', 'conda'].includes(managerId))) {
    steps.push(step({ id: 'setup-python', title: 'Setup Python', stage: 'setup', kind: 'uses', uses: 'actions/setup-python@v5', if: managersIf(['pip', 'uv', 'poetry', 'pipenv', 'conda']) }))
  }
  if (managerIds.some((managerId) => ['maven', 'gradle'].includes(managerId))) {
    steps.push(step({ id: 'setup-java', title: 'Setup Java', stage: 'setup', kind: 'uses', uses: 'actions/setup-java@v4', if: managersIf(['maven', 'gradle']) }))
  }
  if (managerIds.includes('go')) {
    steps.push(step({ id: 'setup-go', title: 'Setup Go', stage: 'setup', kind: 'uses', uses: 'actions/setup-go@v5', if: managerIf('go') }))
  }
  if (managerIds.includes('cargo')) {
    steps.push(step({ id: 'setup-rust', title: 'Setup Rust', stage: 'setup', kind: 'uses', uses: 'dtolnay/rust-toolchain@stable', if: managerIf('cargo') }))
  }
  if (managerIds.includes('flutter')) {
    steps.push(step({ id: 'setup-flutter', title: 'Setup Flutter', stage: 'setup', kind: 'uses', uses: 'subosito/flutter-action@v2', if: managerIf('flutter') }))
  }
  if (managerIds.includes('deno')) {
    steps.push(step({ id: 'setup-deno', title: 'Setup Deno', stage: 'setup', kind: 'uses', uses: 'denoland/setup-deno@v2', if: managerIf('deno') }))
  }
  if (managerIds.includes('nuget')) {
    steps.push(step({ id: 'setup-dotnet', title: 'Setup .NET', stage: 'setup', kind: 'uses', uses: 'actions/setup-dotnet@v4', if: managerIf('nuget') }))
  }
  if (managerIds.includes('composer')) {
    steps.push(step({ id: 'setup-php', title: 'Setup PHP', stage: 'setup', kind: 'uses', uses: 'shivammathur/setup-php@v2', if: managerIf('composer') }))
  }
  if (managerIds.includes('bundler')) {
    steps.push(step({ id: 'setup-ruby', title: 'Setup Ruby', stage: 'setup', kind: 'uses', uses: 'ruby/setup-ruby@v1', if: managerIf('bundler') }))
  }
  if (managerIds.includes('helm')) {
    steps.push(step({ id: 'setup-helm', title: 'Setup Helm', stage: 'setup', kind: 'uses', uses: 'azure/setup-helm@v4', if: managerIf('helm') }))
  }
  if (managerIds.includes('docker')) {
    steps.push(step({ id: 'setup-docker-buildx', title: 'Setup Docker Buildx', stage: 'setup', kind: 'uses', uses: 'docker/setup-buildx-action@v3', if: managerIf('docker') }))
  }
  return steps
}

function normalizeWarnings(input: {
  readiness?: ReadinessGateReport
  lockfileDrift?: LockfileDriftReport
  runtimePinning?: RuntimePinningReport
  offlineCache?: OfflineCacheReadinessReport
  releaseRisk?: ReleaseRiskProfileReport
  sourceErrors: Partial<Record<CiIntegrationWarningSource, string>>
}): CiIntegrationWarning[] {
  const warnings: CiIntegrationWarning[] = []

  for (const [source, error] of Object.entries(input.sourceErrors)) {
    if (!error) continue
    warnings.push(warning({
      id: `${source}:source-error`,
      severity: 'warning',
      source: source as CiIntegrationWarningSource,
      title: `${source} unavailable`,
      summary: error,
      recommendation: 'Regenerate the CI integration plan after this evidence source is available.',
      evidence: [error]
    }))
  }

  for (const check of input.readiness?.checks || []) {
    if (check.status !== 'blocked' && check.status !== 'warning') continue
    warnings.push(warning({
      id: `readiness:${check.id}`,
      severity: check.status === 'blocked' ? 'blocked' : 'warning',
      source: 'readiness-gate',
      title: check.title,
      summary: check.summary,
      recommendation: check.recommendation,
      evidence: check.evidence
    }))
  }

  for (const workspace of input.lockfileDrift?.workspaces || []) {
    for (const item of workspace.findings) {
      warnings.push(warning({
        id: `lockfile:${item.id}`,
        severity: item.severity === 'blocked' ? 'blocked' : item.severity === 'warning' ? 'warning' : 'info',
        source: 'lockfile-drift',
        title: item.title,
        summary: item.summary,
        recommendation: item.recommendation,
        evidence: item.evidence,
        managerId: item.managerId,
        workspaceId: workspace.workspace.id,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      }))
    }
  }

  for (const workspace of input.runtimePinning?.workspaces || []) {
    for (const item of workspace.findings) {
      warnings.push(warning({
        id: `runtime:${item.id}`,
        severity: item.severity === 'blocked' ? 'blocked' : item.severity === 'warning' ? 'warning' : 'info',
        source: 'runtime-pinning',
        title: item.title,
        summary: item.summary,
        recommendation: item.recommendation,
        evidence: item.evidence,
        managerId: item.managerId,
        workspaceId: workspace.workspace.id,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      }))
    }
  }

  for (const workspace of input.offlineCache?.workspaces || []) {
    for (const item of workspace.findings) {
      warnings.push(warning({
        id: `offline:${item.id}`,
        severity: item.severity === 'blocked' ? 'blocked' : item.severity === 'warning' ? 'warning' : 'info',
        source: 'offline-cache-readiness',
        title: item.title,
        summary: item.summary,
        recommendation: item.recommendation,
        evidence: item.evidence,
        managerId: item.managerId,
        workspaceId: workspace.workspace.id,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      }))
    }
  }

  const releaseRiskWarnings = uniqueBy([
    ...(input.releaseRisk?.topRisks || []),
    ...(input.releaseRisk?.findings || []).filter((item) => item.category === 'deployment')
  ], (item) => item.id)

  for (const item of releaseRiskWarnings) {
    warnings.push(warning({
      id: `risk:${item.id}`,
      severity: item.severity === 'critical' || item.severity === 'high' ? 'blocked' : item.severity === 'info' ? 'info' : 'warning',
      source: 'release-risk-profile',
      releaseRiskCategory: item.category,
      title: item.title,
      summary: item.summary,
      recommendation: item.recommendation,
      evidence: item.evidence,
      managerId: item.managerId,
      workspaceId: item.workspaceId,
      workspaceName: item.workspaceName,
      workspaceRelativePath: item.workspaceRelativePath
    }))
  }

  return uniqueBy(warnings, (item) => item.id).slice(0, 200)
}

function isReleaseEvidenceWarning(warning: CiIntegrationWarning): boolean {
  return warning.source === 'release-risk-profile' ||
    warning.id === 'readiness:deployment-references' ||
    warning.id === 'readiness:deployment-baselines'
}

function summarize(input: {
  matrix: CiIntegrationMatrixEntry[]
  jobs: CiIntegrationJob[]
  warnings: CiIntegrationWarning[]
  requiredSecrets: string[]
  cacheKeys: string[]
  artifacts: string[]
  readiness?: ReadinessGateReport
  lockfileDrift?: LockfileDriftReport
  runtimePinning?: RuntimePinningReport
  offlineCache?: OfflineCacheReadinessReport
  releaseRisk?: ReleaseRiskProfileReport
}): CiIntegrationPlanSummary {
  const managers = unique(input.matrix.flatMap((entry) => entry.managerIds)).sort() as DependencyManagerId[]
  const blockedWarningCount = input.warnings.filter((item) => item.severity === 'blocked').length
  const deploymentWarningCount = input.warnings.filter((item) =>
    item.releaseRiskCategory === 'deployment' ||
    item.id === 'readiness:deployment-references' ||
    item.id === 'readiness:deployment-baselines'
  ).length
  const status: CiIntegrationPlanStatus = blockedWarningCount > 0 || input.readiness?.status === 'blocked' || input.releaseRisk?.status === 'blocked'
    ? 'blocked'
    : input.warnings.some((item) => item.severity === 'warning') || input.readiness?.status === 'warning' || input.releaseRisk?.status === 'warning'
      ? 'warning'
      : 'ready'

  return {
    status,
    workspaceCount: input.matrix.length,
    managerCount: managers.length,
    managers,
    jobCount: input.jobs.length,
    matrixEntryCount: input.matrix.length,
    installCommandCount: input.matrix.reduce((total, entry) => total + entry.installCommands.length, 0),
    offlineCommandCount: input.matrix.reduce((total, entry) => total + entry.installCommands.filter((command) => command.offlineCapable).length, 0),
    verificationCommandCount: input.matrix.reduce((total, entry) => total + entry.verificationCommands.length, 0),
    cacheKeyCount: input.cacheKeys.length,
    requiredSecretCount: input.requiredSecrets.length,
    artifactCount: input.artifacts.length,
    warningCount: input.warnings.length,
    blockedWarningCount,
    readinessStatus: input.readiness?.status,
    releaseRiskStatus: input.releaseRisk?.status,
    lockfileDriftFindingCount: input.lockfileDrift?.summary.findingCount || 0,
    runtimePinningFindingCount: input.runtimePinning?.summary.findingCount || 0,
    offlineCacheFindingCount: input.offlineCache?.summary.findingCount || 0,
    deploymentReferenceCount: input.releaseRisk?.summary.deploymentReferenceCount || input.readiness?.summary.deploymentReferenceCount || 0,
    floatingDeploymentRefCount: input.releaseRisk?.summary.floatingDeploymentRefCount || input.readiness?.summary.floatingDeploymentRefCount || 0,
    deploymentBaselineEvidenceCount: input.releaseRisk?.summary.deploymentBaselineEvidenceCount || input.readiness?.summary.deploymentBaselineEvidenceCount || 0,
    missingDeploymentBaselineCount: input.releaseRisk?.summary.missingDeploymentBaselineCount || input.readiness?.summary.missingDeploymentBaselineCount || 0,
    deploymentWarningCount
  }
}

function renderCiIntegrationPlanMarkdown(report: CiIntegrationPlanReport): string {
  const lines = [
    '# CI Integration Plan',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Provider: ${report.provider}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    `- Jobs: ${report.summary.jobCount}`,
    `- Matrix entries: ${report.summary.matrixEntryCount}`,
    `- Install commands: ${report.summary.installCommandCount}`,
    `- Offline/cache-aware commands: ${report.summary.offlineCommandCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    `- Cache keys: ${report.summary.cacheKeyCount}`,
    `- Required secrets: ${report.summary.requiredSecretCount}`,
    `- Warnings: ${report.summary.warningCount}`,
    `- Blocked warnings: ${report.summary.blockedWarningCount}`,
    `- Readiness: ${report.summary.readinessStatus || '-'}`,
    `- Release risk: ${report.summary.releaseRiskStatus || '-'}`,
    `- Deployment references: ${report.summary.deploymentReferenceCount}`,
    `- Floating deployment refs: ${report.summary.floatingDeploymentRefCount}`,
    `- Deployment baseline evidence: ${report.summary.deploymentBaselineEvidenceCount}`,
    `- Missing deployment baselines: ${report.summary.missingDeploymentBaselineCount}`,
    `- Deployment warnings: ${report.summary.deploymentWarningCount}`,
    '',
    '## Workspace Matrix',
    '',
    '| Workspace | Managers | Install commands | Verify commands | Cache keys | Secrets |',
    '| --- | --- | --- | --- | --- | --- |'
  ]

  for (const entry of report.matrix) {
    lines.push([
      markdownCell(`${entry.workspaceName} (${entry.workspaceRelativePath})`),
      markdownCell(entry.managerIds.join(', ') || '-'),
      markdownCell(entry.installCommands.map((command) => `${command.managerId}: ${command.command}`).join('<br>') || '-'),
      markdownCell(entry.verificationCommands.map((command) => `${command.managerId}: ${command.command}`).join('<br>') || '-'),
      markdownCell(entry.cacheKeys.join('<br>') || '-'),
      markdownCell(entry.requiredSecrets.join(', ') || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Jobs', '')
  for (const job of report.jobs) {
    lines.push(`### ${job.name}`, '')
    lines.push(`- Job ID: ${job.id}`)
    lines.push(`- Runner: ${job.runner}`)
    lines.push(`- Needs: ${job.needs.join(', ') || '-'}`)
    lines.push(`- Workspaces: ${job.workspaceCount}`)
    lines.push(`- Managers: ${job.managerIds.join(', ') || '-'}`)
    lines.push(`- Artifacts: ${job.artifacts.join(', ') || '-'}`)
    lines.push('')
    lines.push('| Step | Stage | Kind | Command / Action |')
    lines.push('| --- | --- | --- | --- |')
    for (const item of job.steps) {
      lines.push([
        markdownCell(item.title),
        item.stage,
        item.kind,
        markdownCell(item.command || item.uses || '-')
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
    lines.push('')
  }

  lines.push('## Required Secrets', '')
  if (report.requiredSecrets.length === 0) {
    lines.push('- No provider secrets inferred from detected managers.')
  } else {
    lines.push(...report.requiredSecrets.map((secret) => `- ${secret}`))
  }

  lines.push('', '## Warnings', '')
  if (report.warnings.length === 0) {
    lines.push('- No CI integration warnings.')
  } else {
    for (const item of report.warnings.slice(0, 50)) {
      lines.push(`- ${item.severity} / ${item.source}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
  }

  lines.push('', '## GitHub Actions Workflow', '', '```yaml', report.workflowYaml.trimEnd(), '```')
  return `${lines.join('\n')}\n`
}

function renderGithubActionsWorkflow(input: {
  matrix: CiIntegrationMatrixEntry[]
  requiredSecrets: string[]
  artifacts: string[]
  status: CiIntegrationPlanStatus
}): string {
  const managerIds = unique(input.matrix.flatMap((entry) => entry.managerIds)).sort() as DependencyManagerId[]
  const lines = [
    'name: Dependency Governance',
    '',
    'on:',
    '  pull_request:',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '  security-events: write',
    '',
    'jobs:',
    '  workspace-dependencies:',
    '    name: Workspace dependency governance',
    '    runs-on: ubuntu-latest',
    '    strategy:',
    '      fail-fast: false',
    '      matrix:',
    '        include:'
  ]

  for (const entry of input.matrix) {
    lines.push(`          - workspace: ${yamlString(entry.cwd)}`)
    lines.push(`            workspace_name: ${yamlString(entry.workspaceName)}`)
    lines.push(`            manager_ids: ${yamlString(managerMarker(entry.managerIds))}`)
  }

  lines.push(
    '    steps:',
    '      - name: Checkout repository',
    '        uses: actions/checkout@v4'
  )

  for (const item of setupWorkflowSteps(managerIds)) {
    lines.push(...item)
  }

  for (const managerId of managerIds) {
    lines.push(
      `      - name: Install ${managerLabel(managerId)} dependencies`,
      `        if: ${managerIf(managerId)}`,
      `        working-directory: ${githubExpression('matrix.workspace')}`,
      '        run: |',
      ...yamlRunLines(fallbackInstallCommand(managerId), 10)
    )
  }

  for (const managerId of managerIds) {
    lines.push(
      `      - name: Verify ${managerLabel(managerId)} dependencies`,
      `        if: ${managerIf(managerId)}`,
      `        working-directory: ${githubExpression('matrix.workspace')}`,
      '        run: |',
      ...yamlRunLines(fallbackVerificationCommand(managerId), 10)
    )
  }

  lines.push(
    '      - name: Upload workspace dependency reports',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: dependency-governance-${{ matrix.workspace_name }}',
    '          if-no-files-found: ignore',
    '          path: |',
    ...input.artifacts.map((artifact) => `            ${artifact}`),
    '',
    '  release-evidence:',
    '    name: Release evidence bundle',
    '    runs-on: ubuntu-latest',
    '    needs: workspace-dependencies',
    '    steps:',
    '      - name: Checkout repository',
    '        uses: actions/checkout@v4',
    '      - name: Setup Node.js',
    '        uses: actions/setup-node@v4',
    '        with:',
    '          node-version-file: .nvmrc',
    '          cache: npm',
    '      - name: Install framework tooling',
    '        run: npm ci --prefer-offline',
    '      - name: Run framework verification',
    '        run: npm run verify:framework --if-present',
    '      - name: Check deployment release gates',
    '        shell: bash',
    '        run: |',
    ...yamlRunLines(deploymentReleaseGateCommand(), 10),
    '      - name: Check release evidence completeness',
    '        shell: bash',
    '        run: |',
    ...yamlRunLines(releaseEvidenceCompletenessGateCommand(), 10),
    '      - name: Run project tests',
    '        run: npm test --if-present',
    '      - name: Upload release evidence',
    '        if: always()',
    '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: release-evidence',
    '          if-no-files-found: ignore',
    '          path: |',
    '            .npmDesktopManager/reports/**'
  )

  if (input.requiredSecrets.length > 0) {
    lines.push('', '# Required repository or environment secrets:', ...input.requiredSecrets.map((secret) => `# - ${secret}`))
  }
  lines.push(`# Generated status: ${input.status}`)

  return `${lines.join('\n')}\n`
}

function releaseEvidenceCompletenessGateCommand(): string {
  return [
    'node <<\'NODE\'',
    'const fs = require("fs")',
    'const path = ".npmDesktopManager/reports/release-evidence-completeness.json"',
    'if (!fs.existsSync(path)) {',
    '  console.log("No release evidence completeness report found; skipping completeness enforcement.")',
    '  console.log("Export release-evidence-completeness.json before release sign-off to enforce missing, failed, and tampered evidence checks.")',
    '  process.exit(0)',
    '}',
    'const report = JSON.parse(fs.readFileSync(path, "utf8"))',
    'const summary = report.summary || {}',
    'console.log("Release evidence status: " + (report.status || "unknown"))',
    'console.log("Present artifacts: " + (summary.presentArtifactCount || 0) + "/" + (summary.expectedArtifactCount || 0))',
    'console.log("Missing required artifacts: " + (summary.missingRequiredArtifactCount || 0))',
    'console.log("Failed required artifacts: " + (summary.failedRequiredArtifactCount || 0))',
    'console.log("Required integrity mismatches: " + (summary.requiredIntegrityMismatchCount || 0))',
    'if (report.status === "blocked" || (summary.missingRequiredArtifactCount || 0) > 0 || (summary.failedRequiredArtifactCount || 0) > 0 || (summary.requiredIntegrityMismatchCount || 0) > 0) {',
    '  console.error("Release evidence completeness gate failed.")',
    '  for (const item of (report.findings || []).filter((finding) => finding.severity === "blocked").slice(0, 20)) {',
    '    console.error("- " + item.title + ": " + item.summary)',
    '  }',
    '  process.exit(1)',
    '}',
    'console.log("Release evidence completeness gate passed.")',
    'NODE'
  ].join('\n')
}

function deploymentReleaseGateCommand(): string {
  return [
    'node <<\'NODE\'',
    'const fs = require("fs")',
    'function load(path) {',
    '  if (!fs.existsSync(path)) return null',
    '  return JSON.parse(fs.readFileSync(path, "utf8"))',
    '}',
    'const readiness = load(".npmDesktopManager/reports/readiness-report.json")',
    'const releaseRisk = load(".npmDesktopManager/reports/release-risk-profile.json")',
    'const deploymentChecks = ((readiness && readiness.checks) || []).filter((item) => item && (item.id === "deployment-references" || item.id === "deployment-baselines"))',
    'const blockedChecks = deploymentChecks.filter((item) => item.status === "blocked")',
    'const deploymentFindings = ((releaseRisk && releaseRisk.findings) || []).filter((item) => item && item.category === "deployment")',
    'const blockedFindings = deploymentFindings.filter((item) => item.severity === "critical" || item.severity === "high")',
    'const summary = (releaseRisk && releaseRisk.summary) || (readiness && readiness.summary) || {}',
    'console.log("Deployment references: " + (summary.deploymentReferenceCount || 0))',
    'console.log("Floating deployment refs: " + (summary.floatingDeploymentRefCount || 0))',
    'console.log("Missing deployment baselines: " + (summary.missingDeploymentBaselineCount || 0))',
    'if (!readiness && !releaseRisk) {',
    '  console.log("No readiness or release risk reports found; skipping deployment evidence enforcement.")',
    '  process.exit(0)',
    '}',
    'if (blockedChecks.length > 0 || blockedFindings.length > 0) {',
    '  console.error("Deployment release gates failed.")',
    '  for (const item of blockedChecks) console.error("- " + item.title + ": " + item.summary)',
    '  for (const item of blockedFindings) console.error("- " + item.title + ": " + item.summary)',
    '  process.exit(1)',
    '}',
    'console.log("Deployment evidence gate passed.")',
    'NODE'
  ].join('\n')
}

function setupWorkflowSteps(managerIds: DependencyManagerId[]): string[][] {
  const steps: string[][] = []
  if (managerIds.some((managerId) => ['npm', 'pnpm', 'yarn'].includes(managerId))) {
    steps.push([
      '      - name: Setup Node.js',
      `        if: ${managersIf(['npm', 'pnpm', 'yarn'])}`,
      '        uses: actions/setup-node@v4',
      '        with:',
      '          node-version-file: .nvmrc',
      '          cache: npm'
    ])
    steps.push([
      '      - name: Enable Corepack',
      `        if: ${managersIf(['pnpm', 'yarn'])}`,
      '        run: corepack enable'
    ])
  }
  if (managerIds.includes('bun')) {
    steps.push(['      - name: Setup Bun', `        if: ${managerIf('bun')}`, '        uses: oven-sh/setup-bun@v2'])
  }
  if (managerIds.some((managerId) => ['pip', 'uv', 'poetry', 'pipenv', 'conda'].includes(managerId))) {
    steps.push([
      '      - name: Setup Python',
      `        if: ${managersIf(['pip', 'uv', 'poetry', 'pipenv', 'conda'])}`,
      '        uses: actions/setup-python@v5',
      '        with:',
      '          python-version: "3.12"',
      '          cache: pip'
    ])
  }
  if (managerIds.some((managerId) => ['maven', 'gradle'].includes(managerId))) {
    steps.push([
      '      - name: Setup Java',
      `        if: ${managersIf(['maven', 'gradle'])}`,
      '        uses: actions/setup-java@v4',
      '        with:',
      '          distribution: temurin',
      '          java-version: "21"'
    ])
  }
  if (managerIds.includes('go')) {
    steps.push(['      - name: Setup Go', `        if: ${managerIf('go')}`, '        uses: actions/setup-go@v5', '        with:', '          go-version-file: go.mod'])
  }
  if (managerIds.includes('cargo')) {
    steps.push(['      - name: Setup Rust', `        if: ${managerIf('cargo')}`, '        uses: dtolnay/rust-toolchain@stable'])
  }
  if (managerIds.includes('flutter')) {
    steps.push(['      - name: Setup Flutter', `        if: ${managerIf('flutter')}`, '        uses: subosito/flutter-action@v2'])
  }
  if (managerIds.includes('deno')) {
    steps.push(['      - name: Setup Deno', `        if: ${managerIf('deno')}`, '        uses: denoland/setup-deno@v2'])
  }
  if (managerIds.includes('nuget')) {
    steps.push(['      - name: Setup .NET', `        if: ${managerIf('nuget')}`, '        uses: actions/setup-dotnet@v4'])
  }
  if (managerIds.includes('composer')) {
    steps.push(['      - name: Setup PHP', `        if: ${managerIf('composer')}`, '        uses: shivammathur/setup-php@v2'])
  }
  if (managerIds.includes('bundler')) {
    steps.push(['      - name: Setup Ruby', `        if: ${managerIf('bundler')}`, '        uses: ruby/setup-ruby@v1'])
  }
  if (managerIds.includes('helm')) {
    steps.push(['      - name: Setup Helm', `        if: ${managerIf('helm')}`, '        uses: azure/setup-helm@v4'])
  }
  if (managerIds.includes('docker')) {
    steps.push(['      - name: Setup Docker Buildx', `        if: ${managerIf('docker')}`, '        uses: docker/setup-buildx-action@v3'])
  }
  return steps
}

function fallbackInstallCommand(managerId: DependencyManagerId): string {
  switch (managerId) {
    case 'npm':
      return 'npm ci --prefer-offline'
    case 'pnpm':
      return 'pnpm install --frozen-lockfile --offline'
    case 'yarn':
      return 'yarn install --immutable --offline'
    case 'bun':
      return 'bun install --frozen-lockfile'
    case 'deno':
      return 'deno cache --lock=deno.lock --cached-only'
    case 'pip':
      return 'python -m pip install --no-index --find-links wheelhouse -r requirements.txt'
    case 'uv':
      return 'uv sync --locked --offline'
    case 'poetry':
      return 'poetry install --sync --no-root'
    case 'pipenv':
      return 'pipenv sync --deploy'
    case 'conda':
      return 'conda env create --offline -f environment.yml'
    case 'maven':
      return 'mvn -o verify'
    case 'gradle':
      return 'gradle --offline build'
    case 'cargo':
      return 'cargo build --locked --offline'
    case 'go':
      return 'go test -mod=vendor ./...'
    case 'flutter':
      return 'flutter pub get --offline'
    case 'nuget':
      return 'dotnet restore --locked-mode --ignore-failed-sources'
    case 'composer':
      return 'composer install --prefer-dist --no-interaction'
    case 'bundler':
      return 'bundle install --local'
    case 'swiftpm':
      return 'swift package resolve'
    case 'cocoapods':
      return 'pod install --deployment'
    case 'helm':
      return 'helm dependency build --skip-refresh'
    case 'docker':
      return 'docker compose config'
    case 'bazel':
      return 'bazel mod graph'
    case 'pants':
      return 'pants dependencies ::'
    case 'buck':
      return 'buck2 query //...'
    case 'native':
      return 'cmake --build build'
    default:
      return 'echo "No install command generated for this manager"'
  }
}

function fallbackVerificationCommand(managerId: DependencyManagerId): string {
  switch (managerId) {
    case 'npm':
    case 'pnpm':
    case 'yarn':
    case 'bun':
      return 'npm test --if-present'
    case 'deno':
      return 'deno task test || deno test'
    case 'pip':
    case 'uv':
    case 'poetry':
    case 'pipenv':
    case 'conda':
      return 'python -m pytest || python -m pip check'
    case 'maven':
      return 'mvn -B test'
    case 'gradle':
      return 'gradle test'
    case 'cargo':
      return 'cargo test --locked'
    case 'go':
      return 'go test ./...'
    case 'flutter':
      return 'flutter test'
    case 'nuget':
      return 'dotnet test --no-restore'
    case 'composer':
      return 'composer audit || composer validate --strict'
    case 'bundler':
      return 'bundle exec rake test || bundle audit check'
    case 'swiftpm':
      return 'swift test'
    case 'cocoapods':
      return 'pod lib lint --quick || pod install --deployment'
    case 'helm':
      return 'helm lint .'
    case 'docker':
      return 'docker compose config'
    case 'bazel':
      return 'bazel query //...'
    case 'pants':
      return 'pants lint ::'
    case 'buck':
      return 'buck2 targets //...'
    case 'native':
      return 'cmake --build build --target test'
    default:
      return 'echo "No verification command generated for this manager"'
  }
}

function cacheKeyForManager(managerId: DependencyManagerId): string {
  switch (managerId) {
    case 'npm':
      return '${{ runner.os }}-npm-${{ hashFiles(\'**/package-lock.json\') }}'
    case 'pnpm':
      return '${{ runner.os }}-pnpm-${{ hashFiles(\'**/pnpm-lock.yaml\') }}'
    case 'yarn':
      return '${{ runner.os }}-yarn-${{ hashFiles(\'**/yarn.lock\') }}'
    case 'bun':
      return '${{ runner.os }}-bun-${{ hashFiles(\'**/bun.lock*\') }}'
    case 'pip':
    case 'uv':
    case 'poetry':
    case 'pipenv':
    case 'conda':
      return '${{ runner.os }}-python-${{ hashFiles(\'**/requirements*.txt\', \'**/uv.lock\', \'**/poetry.lock\', \'**/Pipfile.lock\', \'**/conda-lock.*\') }}'
    case 'maven':
      return '${{ runner.os }}-maven-${{ hashFiles(\'**/pom.xml\') }}'
    case 'gradle':
      return '${{ runner.os }}-gradle-${{ hashFiles(\'**/*.gradle*\', \'**/gradle.lockfile\') }}'
    case 'cargo':
      return '${{ runner.os }}-cargo-${{ hashFiles(\'**/Cargo.lock\') }}'
    case 'go':
      return '${{ runner.os }}-go-${{ hashFiles(\'**/go.sum\') }}'
    case 'flutter':
      return '${{ runner.os }}-flutter-${{ hashFiles(\'**/pubspec.lock\') }}'
    case 'nuget':
      return '${{ runner.os }}-nuget-${{ hashFiles(\'**/packages.lock.json\') }}'
    case 'composer':
      return '${{ runner.os }}-composer-${{ hashFiles(\'**/composer.lock\') }}'
    case 'bundler':
      return '${{ runner.os }}-bundler-${{ hashFiles(\'**/Gemfile.lock\') }}'
    case 'swiftpm':
      return '${{ runner.os }}-swiftpm-${{ hashFiles(\'**/Package.resolved\') }}'
    case 'cocoapods':
      return '${{ runner.os }}-cocoapods-${{ hashFiles(\'**/Podfile.lock\') }}'
    case 'helm':
      return '${{ runner.os }}-helm-${{ hashFiles(\'**/Chart.lock\') }}'
    case 'docker':
      return '${{ runner.os }}-docker-${{ hashFiles(\'**/Dockerfile\', \'**/*compose*.yml\', \'**/*compose*.yaml\') }}'
    case 'bazel':
      return '${{ runner.os }}-bazel-${{ hashFiles(\'**/MODULE.bazel\', \'**/MODULE.bazel.lock\', \'**/WORKSPACE*\', \'**/.bazelrc\') }}'
    case 'pants':
      return '${{ runner.os }}-pants-${{ hashFiles(\'**/pants.toml\', \'**/*lock\', \'**/BUILD*\') }}'
    case 'buck':
      return '${{ runner.os }}-buck-${{ hashFiles(\'**/.buckconfig\', \'**/BUCK*\') }}'
    case 'native':
      return '${{ runner.os }}-native-${{ hashFiles(\'**/vcpkg-lock.json\', \'**/conan.lock\', \'**/CMakePresets.json\') }}'
    default:
      return '${{ runner.os }}-dependencies-${{ github.sha }}'
  }
}

function requiredSecretsForManager(managerId: DependencyManagerId): string[] {
  switch (managerId) {
    case 'npm':
    case 'pnpm':
    case 'yarn':
    case 'bun':
      return ['NPM_TOKEN']
    case 'pip':
    case 'uv':
    case 'poetry':
    case 'pipenv':
      return ['PYPI_TOKEN']
    case 'conda':
      return ['CONDA_TOKEN']
    case 'maven':
    case 'gradle':
      return ['MAVEN_USERNAME', 'MAVEN_PASSWORD']
    case 'cargo':
      return ['CARGO_REGISTRY_TOKEN']
    case 'flutter':
      return ['PUB_CREDENTIALS_JSON']
    case 'nuget':
      return ['NUGET_API_KEY']
    case 'composer':
      return ['COMPOSER_AUTH']
    case 'bundler':
      return ['RUBYGEMS_API_KEY']
    case 'cocoapods':
      return ['COCOAPODS_TRUNK_TOKEN']
    case 'helm':
      return ['HELM_REGISTRY_USERNAME', 'HELM_REGISTRY_PASSWORD']
    case 'docker':
      return ['DOCKERHUB_USERNAME', 'DOCKERHUB_TOKEN']
    default:
      return []
  }
}

const offlineInstallManagers = new Set<DependencyManagerId>([
  'npm',
  'pnpm',
  'yarn',
  'deno',
  'pip',
  'uv',
  'conda',
  'maven',
  'gradle',
  'cargo',
  'go',
  'flutter',
  'nuget',
  'bundler',
  'cocoapods',
  'helm',
  'bazel',
  'pants',
  'buck'
])

function managerLabel(managerId: DependencyManagerId): string {
  return MANAGER_BY_ID.get(managerId)?.shortName || managerId
}

function managersIf(managerIds: DependencyManagerId[]): string {
  return githubExpression(managerIds.map((managerId) => `contains(matrix.manager_ids, ',${managerId},')`).join(' || '))
}

function managerIf(managerId: DependencyManagerId): string {
  return managersIf([managerId])
}

function managerMarker(managerIds: DependencyManagerId[]): string {
  return `,${managerIds.join(',')},`
}

function githubExpression(expression: string): string {
  return '${{ ' + expression + ' }}'
}

function yamlRunLines(command: string, indent: number): string[] {
  const prefix = ' '.repeat(indent)
  return command.split(/\r?\n/).map((line) => `${prefix}${line}`)
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function relativizeWorkspaceCommand(root: string, workspace: WorkspaceNode, command: string): string {
  if (workspace.relativePath === '.') return command
  return command.replaceAll(root, '.')
}

function step(input: Omit<CiIntegrationStep, 'source'> & Partial<Pick<CiIntegrationStep, 'source'>>): CiIntegrationStep {
  return {
    ...input,
    source: input.source || 'generated'
  }
}

function warning(input: CiIntegrationWarning): CiIntegrationWarning {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function sourceErrors(
  readinessResult: CaptureResult<ReadinessGateReport>,
  lockfileResult: CaptureResult<LockfileDriftReport>,
  runtimeResult: CaptureResult<RuntimePinningReport>,
  offlineResult: CaptureResult<OfflineCacheReadinessReport>,
  riskResult: CaptureResult<ReleaseRiskProfileReport>
): Partial<Record<CiIntegrationWarningSource, string>> {
  return {
    ...(readinessResult.error ? { 'readiness-gate': readinessResult.error } : {}),
    ...(lockfileResult.error ? { 'lockfile-drift': lockfileResult.error } : {}),
    ...(runtimeResult.error ? { 'runtime-pinning': runtimeResult.error } : {}),
    ...(offlineResult.error ? { 'offline-cache-readiness': offlineResult.error } : {}),
    ...(riskResult.error ? { 'release-risk-profile': riskResult.error } : {})
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function exportResult(
  path: string,
  format: CiIntegrationPlanExportFormat,
  report: CiIntegrationPlanReport
): CiIntegrationPlanExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    workspaceCount: report.summary.workspaceCount,
    jobCount: report.summary.jobCount,
    warningCount: report.summary.warningCount,
    count: report.summary.warningCount,
    summary: report.summary
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const key = keyFor(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
