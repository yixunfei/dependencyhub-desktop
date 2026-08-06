import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  type DependencyManagerDefinition,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import { ProjectService, type ProjectInfo, type ProjectInventory } from './project'
import {
  SupplyChainService,
  type DependencyComponentDiff,
  type DependencyPolicyEvaluation,
  type SnapshotSummary,
  type SupplyChainReport
} from './supplyChain'
import {
  listOperationHistory,
  type OperationHistoryRecord
} from './operationHistory'
import type {
  CredentialFilter,
  CredentialMetadata,
  CredentialVaultStatus
} from './credentialVaultCore'
import {
  CiEvidenceService,
  type CiEvidenceReport,
  type CiEvidenceStatus
} from './ciEvidence'
import {
  ReleaseApprovalService,
  type ReleaseApprovalDecision,
  type ReleaseApprovalRecord,
  type ReleaseApprovalReport
} from './releaseApproval'
import {
  activeReleaseExceptions,
  ReleaseExceptionService,
  type ReleaseExceptionRecord,
  type ReleaseExceptionReport
} from './releaseException'
import {
  RegistryReachabilityService,
  type RegistryReachabilityReport
} from './registryReachability'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport
} from './workspaceDiscovery'
import {
  LockfileDriftService,
  type LockfileDriftReport
} from './lockfileDrift'
import {
  RuntimePinningService,
  type RuntimePinningReport
} from './runtimePinning'
import {
  CredentialUsageService,
  type CredentialUsageReport
} from './credentialUsage'
import {
  AuditEvidenceService,
  type AuditEvidenceFinding,
  type AuditEvidenceReport,
  type AuditEvidenceSeverity
} from './auditEvidence'

export type ReadinessGateStatus = 'ready' | 'warning' | 'blocked'
export type ReadinessGateCheckStatus = 'passed' | 'warning' | 'blocked' | 'info'
export type ReadinessGateSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type ReadinessGateExportFormat = 'markdown' | 'json'

export interface ReadinessPolicy {
  recentOperationDays: number
  snapshotStaleDays: number
  blockOnMissingSnapshots: boolean
  blockOnStaleSnapshots: boolean
  blockOnMissingTools: boolean
  blockOnFailedMutatingOperations: boolean
  maxHighRiskDependencyChanges: number
  maxMediumRiskDependencyChanges: number
  maxHighSeverityPolicyViolations: number
  maxPolicyWarnings: number
  maxPolicyViolations: number
  maxRecentFailedPublishOperations: number
  maxRecentFailedMutatingOperations: number
  ciEvidenceMaxAgeDays: number
  blockOnMissingCiEvidence: boolean
  blockOnStaleCiEvidence: boolean
  blockOnFailedCiEvidence: boolean
  auditEvidenceMaxAgeDays: number
  blockOnMissingAuditEvidence: boolean
  blockOnStaleAuditEvidence: boolean
  maxCriticalAuditFindings: number
  maxHighAuditFindings: number
  maxMediumAuditFindings: number
  blockOnCriticalAuditFindings: boolean
  blockOnHighAuditFindings: boolean
  requiredReleaseApprovals: number
  releaseApprovalMaxAgeDays: number
  blockOnMissingReleaseApprovals: boolean
  blockOnRejectedReleaseApproval: boolean
  registryReachabilityTimeoutMs: number
  blockOnMissingRegistryEndpoints: boolean
  blockOnUnreachableRegistries: boolean
  blockOnInsecureRegistries: boolean
  maxUnreachableRegistries: number
  maxLockfileDriftWarnings: number
  blockOnLockfileDrift: boolean
  maxRuntimePinningWarnings: number
  blockOnRuntimePinning: boolean
  blockOnFloatingContainerTags: boolean
  maxFloatingDeploymentRefs: number
  blockOnFloatingDeploymentRefs: boolean
  maxMissingDeploymentBaselines: number
  blockOnMissingDeploymentBaselines: boolean
  maxMissingCredentialEndpoints: number
  blockOnMissingCredentialEndpoints: boolean
  blockOnInsecureCredentialUsage: boolean
  maxWeakCredentialMatches: number
  blockOnWeakCredentialMatches: boolean
  maxUnusedCredentials: number
  blockOnUnusedCredentials: boolean
  minimumScore: number
  blockBelowMinimumScore: boolean
}

export interface ReadinessPolicyFile {
  path: string
  policy: ReadinessPolicy
}

export interface ReadinessToolStatus {
  tool: string
  available: boolean
  version: string
  configuredPath?: string
  downloadUrl?: string
  message?: string
}

export interface ReadinessGateCheck {
  id: string
  title: string
  status: ReadinessGateCheckStatus
  severity: ReadinessGateSeverity
  passed: boolean
  summary: string
  recommendation: string
  evidence: string[]
}

export interface ReadinessGateSummary {
  detectedManagerCount: number
  detectedManagers: DependencyManagerId[]
  implementedManagerCount: number
  extendedManagerCount: number
  componentCount: number
  policyViolationCount: number
  snapshotCount: number
  recentOperationCount: number
  failedOperationCount: number
  requiredToolCount: number
  missingToolCount: number
  dependencyChangeCount: number
  dependencyHighRiskCount: number
  dependencyMediumRiskCount: number
  dependencyMajorUpdateCount: number
  dependencyPrereleaseChangeCount: number
  ciEvidenceCount: number
  latestCiStatus?: CiEvidenceStatus
  latestCiFinishedAt?: string
  auditEvidenceSourceCount: number
  auditEvidenceFindingCount: number
  auditCriticalFindingCount: number
  auditHighFindingCount: number
  auditMediumFindingCount: number
  auditFixAvailableCount: number
  latestAuditImportedAt?: string
  releaseApprovalCount: number
  activeReleaseApprovalCount: number
  latestReleaseApprovalDecision?: ReleaseApprovalDecision
  releaseExceptionCount: number
  activeReleaseExceptionCount: number
  exceptionedCheckCount: number
  registryEndpointCount: number
  unreachableRegistryCount: number
  insecureRegistryCount: number
  workspaceCount: number
  explicitWorkspaceCount: number
  workspaceManagerCount: number
  lockfileDriftFindingCount: number
  lockfileDriftBlockedCount: number
  lockfileDriftWarningCount: number
  runtimePinningFindingCount: number
  runtimePinningBlockedCount: number
  runtimePinningWarningCount: number
  floatingContainerTagCount: number
  deploymentReferenceCount: number
  floatingDeploymentRefCount: number
  deploymentBaselineEvidenceCount: number
  missingDeploymentBaselineCount: number
  credentialEndpointCount: number
  missingCredentialEndpointCount: number
  weakCredentialMatchCount: number
  insecureCredentialStorageEndpointCount: number
  insecureCredentialEndpointCount: number
  unusedCredentialCount: number
  credentialStorage?: string
}

export interface ReadinessGateReport {
  generatedAt: string
  projectPath: string
  status: ReadinessGateStatus
  score: number
  policy: ReadinessPolicyFile
  summary: ReadinessGateSummary
  checks: ReadinessGateCheck[]
}

export interface ReadinessGateExportResult {
  path: string
  format: ReadinessGateExportFormat
  generatedAt: string
  status: ReadinessGateStatus
  score: number
}

export interface ReadinessEvidenceOverrides {
  snapshots?: SnapshotSummary[]
  snapshotsError?: string
  ciEvidenceReport?: CiEvidenceReport
  ciEvidenceError?: string
  auditEvidenceReport?: AuditEvidenceReport
  auditEvidenceError?: string
  releaseApprovalReport?: ReleaseApprovalReport
  releaseApprovalError?: string
  releaseExceptionReport?: ReleaseExceptionReport
  releaseExceptionError?: string
}

export interface ReadinessGatePublishOptions {
  overrideReadinessGate?: boolean
  dryRun?: boolean | string
  allowDryRun?: boolean
}

export interface ReadinessCredentialVault {
  status(): CredentialVaultStatus | Promise<CredentialVaultStatus>
  list(filter?: CredentialFilter): Promise<CredentialMetadata[]>
}

export interface ReadinessGateDependencies {
  projectService?: ProjectService
  supplyChainService?: SupplyChainService
  ciEvidenceService?: CiEvidenceService
  releaseApprovalService?: ReleaseApprovalService
  releaseExceptionService?: ReleaseExceptionService
  registryReachabilityService?: RegistryReachabilityService
  auditEvidenceService?: AuditEvidenceService
  workspaceDiscoveryService?: WorkspaceDiscoveryService
  lockfileDriftService?: LockfileDriftService
  runtimePinningService?: RuntimePinningService
  credentialUsageService?: CredentialUsageService
  listHistory?: (cwd: string, limit?: number) => Promise<OperationHistoryRecord[]>
  credentialVault?: ReadinessCredentialVault
  checkTool?: (tool: string, projectPath?: string) => Promise<ReadinessToolStatus>
  now?: () => Date
}

const REPORT_DIR = '.npmDesktopManager/reports'
const DEPENDENCY_POLICY_FILE = '.npmDesktopManager/dependency-policy.json'
const READINESS_POLICY_FILE = '.npmDesktopManager/readiness-policy.json'
const DEPLOYMENT_REFERENCE_MANAGERS = new Set<DependencyManagerId>([
  'docker',
  'helm',
  'kustomize',
  'helmfile',
  'skaffold',
  'argocd',
  'flux'
])
const IGNORED_DEPLOYMENT_SCOPES = new Set(['repository', 'kustomization', 'helmrepository'])
const FLOATING_DEPLOYMENT_LABELS = new Set([
  'latest',
  'main',
  'master',
  'develop',
  'development',
  'dev',
  'trunk',
  'head',
  'edge',
  'nightly',
  'snapshot',
  'stable'
])

export const DEFAULT_READINESS_POLICY: ReadinessPolicy = {
  recentOperationDays: 14,
  snapshotStaleDays: 7,
  blockOnMissingSnapshots: false,
  blockOnStaleSnapshots: false,
  blockOnMissingTools: true,
  blockOnFailedMutatingOperations: false,
  maxHighRiskDependencyChanges: 0,
  maxMediumRiskDependencyChanges: 0,
  maxHighSeverityPolicyViolations: 0,
  maxPolicyWarnings: 0,
  maxPolicyViolations: 1000,
  maxRecentFailedPublishOperations: 0,
  maxRecentFailedMutatingOperations: 0,
  ciEvidenceMaxAgeDays: 7,
  blockOnMissingCiEvidence: false,
  blockOnStaleCiEvidence: false,
  blockOnFailedCiEvidence: true,
  auditEvidenceMaxAgeDays: 7,
  blockOnMissingAuditEvidence: false,
  blockOnStaleAuditEvidence: false,
  maxCriticalAuditFindings: 0,
  maxHighAuditFindings: 0,
  maxMediumAuditFindings: 0,
  blockOnCriticalAuditFindings: false,
  blockOnHighAuditFindings: false,
  requiredReleaseApprovals: 0,
  releaseApprovalMaxAgeDays: 14,
  blockOnMissingReleaseApprovals: false,
  blockOnRejectedReleaseApproval: true,
  registryReachabilityTimeoutMs: 3000,
  blockOnMissingRegistryEndpoints: false,
  blockOnUnreachableRegistries: true,
  blockOnInsecureRegistries: false,
  maxUnreachableRegistries: 0,
  maxLockfileDriftWarnings: 0,
  blockOnLockfileDrift: false,
  maxRuntimePinningWarnings: 0,
  blockOnRuntimePinning: false,
  blockOnFloatingContainerTags: false,
  maxFloatingDeploymentRefs: 0,
  blockOnFloatingDeploymentRefs: false,
  maxMissingDeploymentBaselines: 0,
  blockOnMissingDeploymentBaselines: false,
  maxMissingCredentialEndpoints: 0,
  blockOnMissingCredentialEndpoints: false,
  blockOnInsecureCredentialUsage: false,
  maxWeakCredentialMatches: 0,
  blockOnWeakCredentialMatches: false,
  maxUnusedCredentials: 1000,
  blockOnUnusedCredentials: false,
  minimumScore: 0,
  blockBelowMinimumScore: false
}

const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))

export class ReadinessGateService {
  private readonly projectService: ProjectService
  private readonly supplyChainService: SupplyChainService
  private readonly ciEvidenceService: CiEvidenceService
  private readonly releaseApprovalService: ReleaseApprovalService
  private readonly releaseExceptionService: ReleaseExceptionService
  private readonly registryReachabilityService: RegistryReachabilityService
  private readonly auditEvidenceService: AuditEvidenceService
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService
  private readonly lockfileDriftService: LockfileDriftService
  private readonly runtimePinningService: RuntimePinningService
  private readonly credentialUsageService: CredentialUsageService
  private readonly historyReader: (cwd: string, limit?: number) => Promise<OperationHistoryRecord[]>
  private readonly credentialVault?: ReadinessCredentialVault
  private readonly toolChecker?: (tool: string, projectPath?: string) => Promise<ReadinessToolStatus>
  private readonly now: () => Date

  constructor(dependencies: ReadinessGateDependencies = {}) {
    this.projectService = dependencies.projectService || new ProjectService()
    this.supplyChainService = dependencies.supplyChainService || new SupplyChainService()
    this.ciEvidenceService = dependencies.ciEvidenceService || new CiEvidenceService()
    this.releaseApprovalService = dependencies.releaseApprovalService || new ReleaseApprovalService()
    this.releaseExceptionService = dependencies.releaseExceptionService || new ReleaseExceptionService()
    this.registryReachabilityService = dependencies.registryReachabilityService || new RegistryReachabilityService()
    this.auditEvidenceService = dependencies.auditEvidenceService || new AuditEvidenceService()
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.lockfileDriftService = dependencies.lockfileDriftService || new LockfileDriftService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.runtimePinningService = dependencies.runtimePinningService || new RuntimePinningService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.credentialUsageService = dependencies.credentialUsageService || new CredentialUsageService({
      registryReachabilityService: this.registryReachabilityService
    })
    this.historyReader = dependencies.listHistory || listOperationHistory
    this.credentialVault = dependencies.credentialVault
    this.toolChecker = dependencies.checkTool
    this.now = dependencies.now || (() => new Date())
  }

  async ensurePolicy(projectPath: string): Promise<string> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const path = join(resolve(projectPath), READINESS_POLICY_FILE)
    try {
      await access(path)
    } catch {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(DEFAULT_READINESS_POLICY, null, 2), 'utf-8')
      return path
    }

    const existing = await readReadinessPolicyFile(path)
    const normalized = normalizeReadinessPolicy(existing)
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
      await writeFile(path, JSON.stringify(normalized, null, 2), 'utf-8')
    }
    return path
  }

  async getPolicy(projectPath: string): Promise<ReadinessPolicyFile> {
    const path = await this.ensurePolicy(projectPath)
    return {
      path,
      policy: normalizeReadinessPolicy(await readReadinessPolicyFile(path))
    }
  }

  async savePolicy(projectPath: string, policy: Partial<ReadinessPolicy>): Promise<ReadinessPolicyFile> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const path = join(resolve(projectPath), READINESS_POLICY_FILE)
    const normalized = normalizeReadinessPolicy(policy)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(normalized, null, 2), 'utf-8')
    return {
      path,
      policy: normalized
    }
  }

  async report(projectPath: string): Promise<ReadinessGateReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const cwd = resolve(projectPath)
    const readinessPolicyResult = await capture(() => this.getPolicy(cwd))
    const readinessPolicyFile = readinessPolicyResult.value || {
      path: join(cwd, READINESS_POLICY_FILE),
      policy: DEFAULT_READINESS_POLICY
    }
    return await this.reportWithPolicyFile(cwd, readinessPolicyFile, readinessPolicyResult.error)
  }

  async reportWithPolicy(
    projectPath: string,
    policy: Partial<ReadinessPolicy>,
    policyPath = 'inherited readiness policy',
    evidenceOverrides: ReadinessEvidenceOverrides = {}
  ): Promise<ReadinessGateReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    return await this.reportWithPolicyFile(resolve(projectPath), {
      path: policyPath,
      policy: normalizeReadinessPolicy(policy)
    }, undefined, evidenceOverrides)
  }

  private async reportWithPolicyFile(
    cwd: string,
    readinessPolicyFile: ReadinessPolicyFile,
    readinessPolicyError?: string,
    evidenceOverrides: ReadinessEvidenceOverrides = {}
  ): Promise<ReadinessGateReport> {
    const generatedAt = this.now().toISOString()
    const readinessPolicy = readinessPolicyFile.policy
    const project = await this.projectService.detectProject(cwd)
    const detectedDefinitions = detectedManagerDefinitions(project)
    const policyExists = await exists(join(cwd, DEPENDENCY_POLICY_FILE))

    const [
      inventoryResult,
      supplyChainResult,
      snapshotsResult,
      historyResult,
      policyResult,
      dependencyDiffResult,
      ciEvidenceResult,
      auditEvidenceResult,
      releaseApprovalResult,
      releaseExceptionResult,
      registryReachabilityResult,
      workspaceDiscoveryResult,
      lockfileDriftResult,
      runtimePinningResult,
      credentialUsageResult,
      credentialStatusResult,
      credentialListResult
    ] = await Promise.all([
      capture(() => this.projectService.inventory(cwd)),
      capture(() => this.supplyChainService.report(cwd)),
      evidenceOverrides.snapshots || evidenceOverrides.snapshotsError
        ? Promise.resolve({
            value: evidenceOverrides.snapshots,
            error: evidenceOverrides.snapshotsError
          } as CaptureResult<SnapshotSummary[] | undefined>)
        : capture(() => this.supplyChainService.listSnapshots(cwd)),
      capture(() => this.historyReader(cwd, 100)),
      policyExists
        ? capture(() => this.supplyChainService.evaluatePolicy(cwd))
        : Promise.resolve({ value: null, error: undefined } as CaptureResult<DependencyPolicyEvaluation | null>),
      capture(() => this.supplyChainService.dependencyDiffLatestSnapshot(cwd)),
      evidenceOverrides.ciEvidenceReport || evidenceOverrides.ciEvidenceError
        ? Promise.resolve({
            value: evidenceOverrides.ciEvidenceReport,
            error: evidenceOverrides.ciEvidenceError
          } as CaptureResult<CiEvidenceReport | undefined>)
        : capture(() => this.ciEvidenceService.report(cwd)),
      evidenceOverrides.auditEvidenceReport || evidenceOverrides.auditEvidenceError
        ? Promise.resolve({
            value: evidenceOverrides.auditEvidenceReport,
            error: evidenceOverrides.auditEvidenceError
          } as CaptureResult<AuditEvidenceReport | undefined>)
        : capture(() => this.auditEvidenceService.report(cwd)),
      evidenceOverrides.releaseApprovalReport || evidenceOverrides.releaseApprovalError
        ? Promise.resolve({
            value: evidenceOverrides.releaseApprovalReport,
            error: evidenceOverrides.releaseApprovalError
          } as CaptureResult<ReleaseApprovalReport | undefined>)
        : capture(() => this.releaseApprovalService.report(cwd)),
      evidenceOverrides.releaseExceptionReport || evidenceOverrides.releaseExceptionError
        ? Promise.resolve({
            value: evidenceOverrides.releaseExceptionReport,
            error: evidenceOverrides.releaseExceptionError
          } as CaptureResult<ReleaseExceptionReport | undefined>)
        : capture(() => this.releaseExceptionService.report(cwd)),
      capture(() => this.registryReachabilityService.check(cwd, { timeoutMs: readinessPolicy.registryReachabilityTimeoutMs })),
      capture(() => this.workspaceDiscoveryService.report(cwd)),
      capture(() => this.lockfileDriftService.report(cwd)),
      capture(() => this.runtimePinningService.report(cwd)),
      capture(() => this.credentialUsageService.report(cwd)),
      this.credentialVault
        ? capture(() => Promise.resolve(this.credentialVault!.status()))
        : Promise.resolve({ value: undefined, error: undefined } as CaptureResult<CredentialVaultStatus | undefined>),
      this.credentialVault
        ? capture(() => this.credentialVault!.list())
        : Promise.resolve({ value: [] as CredentialMetadata[], error: undefined } as CaptureResult<CredentialMetadata[]>)
    ])

    const toolStatuses = await this.checkDetectedTools(cwd, detectedDefinitions)
    const rawChecks = [
      readinessPolicyCheck(readinessPolicyFile, readinessPolicyError),
      projectDetectionCheck(project, detectedDefinitions),
      ecosystemCoverageCheck(detectedDefinitions),
      toolchainCheck(detectedDefinitions, toolStatuses, Boolean(this.toolChecker), readinessPolicy),
      lockfileCheck(detectedDefinitions, inventoryResult.value, inventoryResult.error),
      supplyChainCheck(supplyChainResult.value, supplyChainResult.error, detectedDefinitions),
      policyCheck(policyExists, policyResult.value, policyResult.error, readinessPolicy),
      snapshotCheck(snapshotsResult.value, snapshotsResult.error, this.now(), readinessPolicy),
      dependencyChangeRiskCheck(dependencyDiffResult.value, dependencyDiffResult.error, readinessPolicy),
      operationHistoryCheck(historyResult.value, historyResult.error, this.now(), readinessPolicy),
      ciEvidenceCheck(ciEvidenceResult.value, ciEvidenceResult.error, this.now(), readinessPolicy),
      auditEvidenceCheck(auditEvidenceResult.value, auditEvidenceResult.error, this.now(), readinessPolicy),
      releaseApprovalCheck(releaseApprovalResult.value, releaseApprovalResult.error, this.now(), readinessPolicy),
      registryReachabilityCheck(registryReachabilityResult.value, registryReachabilityResult.error, readinessPolicy),
      workspaceTopologyCheck(workspaceDiscoveryResult.value, workspaceDiscoveryResult.error),
      lockfileDriftCheck(lockfileDriftResult.value, lockfileDriftResult.error, readinessPolicy),
      runtimePinningCheck(runtimePinningResult.value, runtimePinningResult.error, readinessPolicy),
      deploymentReferenceCheck(supplyChainResult.value, supplyChainResult.error, readinessPolicy),
      deploymentBaselineCheck(supplyChainResult.value, supplyChainResult.error, readinessPolicy),
      credentialUsageCheck(credentialUsageResult.value, credentialUsageResult.error, readinessPolicy),
      credentialVaultCheck(
        credentialStatusResult.value,
        credentialStatusResult.error,
        credentialListResult.value || [],
        detectedDefinitions
      )
    ]
    rawChecks.push(minimumScoreCheck(scoreFromChecks(rawChecks), readinessPolicy))
    const exceptionApplication = applyReleaseExceptions(
      rawChecks,
      activeReleaseExceptions(releaseExceptionResult.value?.records || [], this.now())
    )
    const checks = [
      ...exceptionApplication.checks,
      releaseExceptionCheck(
        releaseExceptionResult.value,
        releaseExceptionResult.error,
        exceptionApplication.exceptionedCheckIds
      )
    ]

    const status = statusFromChecks(checks)
    const score = scoreFromChecks(checks)
    const history = historyResult.value || []
    const toolSummary = summarizeToolStatuses(toolStatuses)
    const dependencyRiskSummary = summarizeDependencyRisk(dependencyDiffResult.value)
    const ciSummary = summarizeCiEvidence(ciEvidenceResult.value)
    const auditSummary = summarizeAuditEvidence(auditEvidenceResult.value)
    const approvalSummary = summarizeReleaseApprovals(releaseApprovalResult.value, this.now(), readinessPolicy)
    const exceptionSummary = summarizeReleaseExceptions(releaseExceptionResult.value, this.now(), exceptionApplication.exceptionedCheckIds.length)
    const registrySummary = summarizeRegistryReachability(registryReachabilityResult.value)
    const workspaceSummary = summarizeWorkspaceDiscovery(workspaceDiscoveryResult.value)
    const lockfileDriftSummary = summarizeLockfileDrift(lockfileDriftResult.value)
    const runtimePinningSummary = summarizeRuntimePinning(runtimePinningResult.value)
    const deploymentReferenceSummary = summarizeDeploymentReferences(supplyChainResult.value)
    const deploymentBaselineSummary = summarizeDeploymentBaselines(supplyChainResult.value)
    const credentialUsageSummary = summarizeCredentialUsage(credentialUsageResult.value)

    return {
      generatedAt,
      projectPath: cwd,
      status,
      score,
      policy: readinessPolicyFile,
      summary: {
        detectedManagerCount: detectedDefinitions.length,
        detectedManagers: detectedDefinitions.map((manager) => manager.id),
        implementedManagerCount: detectedDefinitions.filter((manager) => manager.implemented).length,
        extendedManagerCount: detectedDefinitions.filter((manager) => !manager.implemented).length,
        componentCount: supplyChainResult.value?.componentCount || 0,
        policyViolationCount: policyResult.value?.violationCount || 0,
        snapshotCount: snapshotsResult.value?.length || 0,
        recentOperationCount: recentOperations(history, this.now(), readinessPolicy.recentOperationDays).length,
        failedOperationCount: history.filter((record) => record.status === 'error').length,
        requiredToolCount: toolSummary.total,
        missingToolCount: toolSummary.missing,
        dependencyChangeCount: dependencyRiskSummary.changeCount,
        dependencyHighRiskCount: dependencyRiskSummary.highRiskCount,
        dependencyMediumRiskCount: dependencyRiskSummary.mediumRiskCount,
        dependencyMajorUpdateCount: dependencyRiskSummary.majorUpdateCount,
        dependencyPrereleaseChangeCount: dependencyRiskSummary.prereleaseChangeCount,
        ciEvidenceCount: ciSummary.count,
        latestCiStatus: ciSummary.latestStatus,
        latestCiFinishedAt: ciSummary.latestFinishedAt,
        auditEvidenceSourceCount: auditSummary.sourceCount,
        auditEvidenceFindingCount: auditSummary.findingCount,
        auditCriticalFindingCount: auditSummary.critical,
        auditHighFindingCount: auditSummary.high,
        auditMediumFindingCount: auditSummary.medium,
        auditFixAvailableCount: auditSummary.fixAvailableCount,
        latestAuditImportedAt: auditSummary.latestImportedAt,
        releaseApprovalCount: approvalSummary.count,
        activeReleaseApprovalCount: approvalSummary.activeCount,
        latestReleaseApprovalDecision: approvalSummary.latestDecision,
        releaseExceptionCount: exceptionSummary.count,
        activeReleaseExceptionCount: exceptionSummary.activeCount,
        exceptionedCheckCount: exceptionSummary.exceptionedCheckCount,
        registryEndpointCount: registrySummary.endpointCount,
        unreachableRegistryCount: registrySummary.unreachable,
        insecureRegistryCount: registrySummary.insecure,
        workspaceCount: workspaceSummary.workspaceCount,
        explicitWorkspaceCount: workspaceSummary.explicitWorkspaceCount,
        workspaceManagerCount: workspaceSummary.managerCount,
        lockfileDriftFindingCount: lockfileDriftSummary.findingCount,
        lockfileDriftBlockedCount: lockfileDriftSummary.blockedCount,
        lockfileDriftWarningCount: lockfileDriftSummary.warningCount,
        runtimePinningFindingCount: runtimePinningSummary.findingCount,
        runtimePinningBlockedCount: runtimePinningSummary.blockedCount,
        runtimePinningWarningCount: runtimePinningSummary.warningCount,
        floatingContainerTagCount: runtimePinningSummary.floatingContainerTagCount,
        deploymentReferenceCount: deploymentReferenceSummary.deploymentReferenceCount,
        floatingDeploymentRefCount: deploymentReferenceSummary.floatingDeploymentRefCount,
        deploymentBaselineEvidenceCount: deploymentBaselineSummary.deploymentBaselineEvidenceCount,
        missingDeploymentBaselineCount: deploymentBaselineSummary.missingDeploymentBaselineCount,
        credentialEndpointCount: credentialUsageSummary.endpointCount,
        missingCredentialEndpointCount: credentialUsageSummary.missingCredentialEndpointCount,
        weakCredentialMatchCount: credentialUsageSummary.weakCredentialMatchCount,
        insecureCredentialStorageEndpointCount: credentialUsageSummary.insecureStorageEndpointCount,
        insecureCredentialEndpointCount: credentialUsageSummary.insecureEndpointCount,
        unusedCredentialCount: credentialUsageSummary.unusedCredentialCount,
        credentialStorage: credentialStatusResult.value?.storage
      },
      checks
    }
  }

  async exportMarkdown(projectPath: string): Promise<ReadinessGateExportResult> {
    const report = await this.report(projectPath)
    const path = await writeTextReport(report.projectPath, 'readiness-report.md', renderMarkdownReport(report))
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      status: report.status,
      score: report.score
    }
  }

  async exportJson(projectPath: string): Promise<ReadinessGateExportResult> {
    const report = await this.report(projectPath)
    const path = await writeTextReport(report.projectPath, 'readiness-report.json', JSON.stringify(report, null, 2))
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      status: report.status,
      score: report.score
    }
  }

  async assertPublishAllowed(
    projectPath: string | undefined,
    label: string,
    options: ReadinessGatePublishOptions = {}
  ): Promise<ReadinessGateReport | null> {
    if (!projectPath || options.overrideReadinessGate) return null
    if (options.allowDryRun && isDryRunPublish(options.dryRun)) return null

    const report = await this.report(projectPath)
    if (report.status === 'blocked') {
      throw new Error(renderReadinessGateBlockedMessage(label, report))
    }
    return report
  }

  private async checkDetectedTools(cwd: string, managers: DependencyManagerDefinition[]): Promise<ReadinessToolStatus[]> {
    if (!this.toolChecker || managers.length === 0) return []

    const tools = unique(managers.flatMap((manager) => manager.tools))
    return await Promise.all(tools.map(async (tool) => {
      try {
        const status = await this.toolChecker!(tool, cwd)
        return {
          ...status,
          tool
        }
      } catch (error: any) {
        return {
          tool,
          available: false,
          version: '',
          message: error?.message || String(error)
        }
      }
    }))
  }
}

function readinessPolicyCheck(policyFile: ReadinessPolicyFile, error?: string): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'readiness-policy',
      title: 'Readiness policy',
      status: 'warning',
      severity: 'medium',
      summary: 'Project readiness policy could not be loaded; default thresholds were used for this run.',
      recommendation: 'Fix .npmDesktopManager/readiness-policy.json or save a fresh policy from the health center.',
      evidence: [error]
    })
  }

  return check({
    id: 'readiness-policy',
    title: 'Readiness policy',
    status: 'passed',
    severity: 'info',
    summary: 'Project readiness thresholds were loaded.',
    recommendation: 'Commit readiness-policy.json when release gates should be shared by the team or CI.',
    evidence: [
      `Policy: ${policyFile.path}`,
      `Recent operation window: ${policyFile.policy.recentOperationDays} day(s)`,
      `Snapshot stale window: ${policyFile.policy.snapshotStaleDays} day(s)`,
      `CI evidence max age: ${policyFile.policy.ciEvidenceMaxAgeDays} day(s)`,
      `Audit evidence max age: ${policyFile.policy.auditEvidenceMaxAgeDays} day(s)`,
      `Required release approvals: ${policyFile.policy.requiredReleaseApprovals}`,
      `Registry timeout: ${policyFile.policy.registryReachabilityTimeoutMs} ms`,
      `High-risk dependency changes: ${policyFile.policy.maxHighRiskDependencyChanges}`,
      `Audit critical/high/medium maximums: ${policyFile.policy.maxCriticalAuditFindings}/${policyFile.policy.maxHighAuditFindings}/${policyFile.policy.maxMediumAuditFindings}`
    ]
  })
}

function minimumScoreCheck(score: number, policy: ReadinessPolicy): ReadinessGateCheck {
  if (policy.minimumScore <= 0) {
    return check({
      id: 'minimum-score',
      title: 'Minimum score',
      status: 'info',
      severity: 'info',
      summary: 'No minimum readiness score is configured.',
      recommendation: 'Set a minimum score when release reviews need a numeric threshold in addition to blocking gates.',
      evidence: []
    })
  }

  if (score < policy.minimumScore) {
    return check({
      id: 'minimum-score',
      title: 'Minimum score',
      status: policy.blockBelowMinimumScore ? 'blocked' : 'warning',
      severity: policy.blockBelowMinimumScore ? 'high' : 'medium',
      summary: `Readiness score ${score}/100 is below the configured minimum of ${policy.minimumScore}.`,
      recommendation: 'Resolve warning and blocked gates or lower the score threshold only after release approval.',
      evidence: [`Policy blockBelowMinimumScore: ${policy.blockBelowMinimumScore}`]
    })
  }

  return check({
    id: 'minimum-score',
    title: 'Minimum score',
    status: 'passed',
    severity: 'info',
    summary: `Readiness score ${score}/100 satisfies the configured minimum of ${policy.minimumScore}.`,
    recommendation: 'Keep the score threshold aligned with release risk and compliance expectations.',
    evidence: []
  })
}

function projectDetectionCheck(project: ProjectInfo, detectedManagers: DependencyManagerDefinition[]): ReadinessGateCheck {
  if (detectedManagers.length === 0) {
    return check({
      id: 'project-detection',
      title: 'Project ecosystem detection',
      status: 'blocked',
      severity: 'high',
      summary: 'No supported dependency ecosystem was detected in this directory.',
      recommendation: 'Select the project root or add a supported manifest such as package.json, requirements.txt, pom.xml, Cargo.toml, go.mod, or pubspec.yaml.',
      evidence: [`Project: ${project.path}`]
    })
  }

  return check({
    id: 'project-detection',
    title: 'Project ecosystem detection',
    status: 'passed',
    severity: 'info',
    summary: `${detectedManagers.length} ecosystem(s) detected.`,
    recommendation: 'Keep manifests and lockfiles committed so future reports remain reproducible.',
    evidence: detectedManagers.map((manager) => `${manager.name}: ${manager.manifestFiles.join(', ')}`)
  })
}

function ecosystemCoverageCheck(detectedManagers: DependencyManagerDefinition[]): ReadinessGateCheck {
  const extended = detectedManagers.filter((manager) => !manager.implemented)
  if (extended.length === 0) {
    return check({
      id: 'ecosystem-coverage',
      title: 'Manager coverage',
      status: 'passed',
      severity: 'info',
      summary: 'Detected ecosystems are covered by dedicated manager workspaces.',
      recommendation: 'Use the dedicated manager pages for day-to-day dependency changes.',
      evidence: detectedManagers.map((manager) => manager.name)
    })
  }

  return check({
    id: 'ecosystem-coverage',
    title: 'Manager coverage',
    status: 'warning',
    severity: 'low',
    summary: `${extended.length} detected ecosystem(s) currently use the extended generic adapter.`,
    recommendation: 'Use extended plans for command preview and backups, then prioritize a dedicated page for high-traffic ecosystems.',
    evidence: extended.map((manager) => `${manager.name} (${manager.status})`)
  })
}

function toolchainCheck(
  detectedManagers: DependencyManagerDefinition[],
  toolStatuses: ReadinessToolStatus[],
  checkerAvailable: boolean,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (!checkerAvailable) {
    return check({
      id: 'toolchain',
      title: 'Toolchain availability',
      status: 'info',
      severity: 'info',
      summary: 'Toolchain checking was not configured for this readiness run.',
      recommendation: 'Run the report from the Electron app to verify local tool availability.',
      evidence: []
    })
  }

  if (detectedManagers.length === 0) {
    return check({
      id: 'toolchain',
      title: 'Toolchain availability',
      status: 'info',
      severity: 'info',
      summary: 'No detected managers require toolchain checks.',
      recommendation: 'Select a project with dependency manifests before release gating.',
      evidence: []
    })
  }

  const statusMap = new Map(toolStatuses.map((status) => [status.tool, status]))
  const managersWithNoTools = detectedManagers.filter((manager) => {
    if (manager.tools.length === 0) return false
    return manager.tools.every((tool) => !statusMap.get(tool)?.available)
  })
  const managersWithPartialTools = detectedManagers.filter((manager) => {
    const statuses = manager.tools.map((tool) => statusMap.get(tool)).filter(Boolean)
    if (statuses.length === 0) return false
    const availableCount = statuses.filter((status) => status?.available).length
    return availableCount > 0 && availableCount < manager.tools.length
  })

  if (managersWithNoTools.length > 0) {
    const blocked = policy.blockOnMissingTools
    return check({
      id: 'toolchain',
      title: 'Toolchain availability',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'medium',
      summary: `${managersWithNoTools.length} detected manager(s) have no available command-line tool.`,
      recommendation: 'Install or bind the missing tool paths in Environment and Toolchains before production changes.',
      evidence: [
        `Policy blockOnMissingTools: ${policy.blockOnMissingTools}`,
        ...managersWithNoTools.map((manager) => `${manager.name}: missing ${manager.tools.join(', ')}`),
        ...toolStatuses.filter((status) => !status.available).map((status) => `${status.tool}: ${status.message || 'not available'}`)
      ]
    })
  }

  if (managersWithPartialTools.length > 0) {
    return check({
      id: 'toolchain',
      title: 'Toolchain availability',
      status: 'warning',
      severity: 'medium',
      summary: `${managersWithPartialTools.length} detected manager(s) have optional or companion tools missing.`,
      recommendation: 'Install companion tools used for audits, dependency trees, offline caches, or native builds.',
      evidence: managersWithPartialTools.map((manager) => {
        const missing = manager.tools.filter((tool) => !statusMap.get(tool)?.available)
        return `${manager.name}: missing ${missing.join(', ')}`
      })
    })
  }

  return check({
    id: 'toolchain',
    title: 'Toolchain availability',
    status: 'passed',
    severity: 'info',
    summary: 'Required tools for detected ecosystems are available.',
    recommendation: 'Keep project-level tool paths pinned when releases need reproducible local tooling.',
    evidence: toolStatuses.map((status) => `${status.tool}: ${status.version || 'available'}`)
  })
}

function lockfileCheck(
  detectedManagers: DependencyManagerDefinition[],
  inventory?: ProjectInventory,
  error?: string
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'lockfiles',
      title: 'Lockfile and manifest inventory',
      status: 'warning',
      severity: 'medium',
      summary: 'Project inventory could not be generated.',
      recommendation: 'Verify the selected directory can be read and retry the readiness report.',
      evidence: [error]
    })
  }

  if (!inventory) {
    return check({
      id: 'lockfiles',
      title: 'Lockfile and manifest inventory',
      status: 'info',
      severity: 'info',
      summary: 'Project inventory was not available.',
      recommendation: 'Generate dependency inventory from the health center.',
      evidence: []
    })
  }

  const lockFiles = new Set(inventory.files.filter((file) => file.role === 'lock').map((file) => file.managerId))
  const missingLockManagers = detectedManagers.filter((manager) => {
    if (manager.lockFiles.length === 0) return false
    return !lockFiles.has(manager.id)
  })

  if (missingLockManagers.length > 0) {
    return check({
      id: 'lockfiles',
      title: 'Lockfile and manifest inventory',
      status: 'warning',
      severity: 'medium',
      summary: `${missingLockManagers.length} detected ecosystem(s) have no lockfile in the project root.`,
      recommendation: 'Commit lockfiles or document why this project intentionally resolves dependencies dynamically.',
      evidence: missingLockManagers.map((manager) => `${manager.name}: expected ${manager.lockFiles.join(', ')}`)
    })
  }

  return check({
    id: 'lockfiles',
    title: 'Lockfile and manifest inventory',
    status: 'passed',
    severity: 'info',
    summary: 'Detected ecosystems have manifest and lockfile inventory data.',
    recommendation: 'Review lockfile diffs before accepting production dependency changes.',
    evidence: inventory.files
      .filter((file) => file.role === 'lock')
      .slice(0, 12)
      .map((file) => `${file.managerId}: ${file.file}`)
  })
}

function supplyChainCheck(
  report: SupplyChainReport | undefined,
  error: string | undefined,
  detectedManagers: DependencyManagerDefinition[]
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'supply-chain-report',
      title: 'Supply-chain inventory',
      status: 'warning',
      severity: 'medium',
      summary: 'Supply-chain inventory could not be generated.',
      recommendation: 'Fix manifest parsing errors and retry before exporting SBOMs.',
      evidence: [error]
    })
  }

  if (!report || report.componentCount === 0) {
    return check({
      id: 'supply-chain-report',
      title: 'Supply-chain inventory',
      status: detectedManagers.length > 0 ? 'warning' : 'info',
      severity: detectedManagers.length > 0 ? 'medium' : 'info',
      summary: 'No dependency components were found in the supply-chain report.',
      recommendation: 'Confirm manifests contain dependencies and generate CycloneDX or SPDX before release.',
      evidence: []
    })
  }

  return check({
    id: 'supply-chain-report',
    title: 'Supply-chain inventory',
    status: 'passed',
    severity: 'info',
    summary: `${report.componentCount} component(s) are available for SBOM and policy evaluation.`,
    recommendation: 'Export CycloneDX or SPDX reports for CI, release review, and downstream compliance.',
    evidence: report.managers
      .filter((manager) => manager.detected || manager.componentCount > 0)
      .map((manager) => `${manager.name}: ${manager.componentCount} component(s)`)
  })
}

function policyCheck(
  policyExists: boolean,
  evaluation: DependencyPolicyEvaluation | null | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (!policyExists) {
    return check({
      id: 'dependency-policy',
      title: 'Dependency policy',
      status: 'warning',
      severity: 'low',
      summary: 'No dependency policy file exists for this project.',
      recommendation: 'Initialize .npmDesktopManager/dependency-policy.json and define pinning, license, manager, and blocked-package rules.',
      evidence: []
    })
  }

  if (error) {
    return check({
      id: 'dependency-policy',
      title: 'Dependency policy',
      status: 'warning',
      severity: 'medium',
      summary: 'Dependency policy evaluation failed.',
      recommendation: 'Open the policy editor, fix invalid rules, and run the readiness check again.',
      evidence: [error]
    })
  }

  if (!evaluation || evaluation.violationCount === 0) {
    return check({
      id: 'dependency-policy',
      title: 'Dependency policy',
      status: 'passed',
      severity: 'info',
      summary: 'Dependency policy evaluation passed.',
      recommendation: 'Keep the policy file under source control with project-specific release criteria.',
      evidence: evaluation ? [`Policy: ${evaluation.policyPath}`] : []
    })
  }

  const critical = evaluation.violations.filter((violation) => violation.severity === 'critical').length
  const high = evaluation.violations.filter((violation) => violation.severity === 'high').length
  const medium = evaluation.violations.filter((violation) => violation.severity === 'medium').length
  const warnings = evaluation.violations.length - critical - high
  const blocking = critical + high

  if (evaluation.violationCount > policy.maxPolicyViolations) {
    return check({
      id: 'dependency-policy',
      title: 'Dependency policy',
      status: 'blocked',
      severity: 'high',
      summary: `${evaluation.violationCount} policy violation(s) exceed the configured maximum of ${policy.maxPolicyViolations}.`,
      recommendation: 'Resolve dependency policy findings or raise the project readiness threshold only after release approval.',
      evidence: [
        `Policy maxPolicyViolations: ${policy.maxPolicyViolations}`,
        ...evaluation.violations.slice(0, 8).map(formatPolicyViolation)
      ]
    })
  }

  if (blocking > policy.maxHighSeverityPolicyViolations) {
    return check({
      id: 'dependency-policy',
      title: 'Dependency policy',
      status: 'blocked',
      severity: critical > 0 ? 'critical' : 'high',
      summary: `${blocking} high-severity policy violation(s) exceed the configured maximum of ${policy.maxHighSeverityPolicyViolations}.`,
      recommendation: 'Resolve blocked packages, blocked managers, or disallowed licenses before release approval.',
      evidence: [
        `Policy maxHighSeverityPolicyViolations: ${policy.maxHighSeverityPolicyViolations}`,
        ...evaluation.violations.slice(0, 8).map(formatPolicyViolation)
      ]
    })
  }

  if (warnings <= policy.maxPolicyWarnings) {
    return check({
      id: 'dependency-policy',
      title: 'Dependency policy',
      status: 'passed',
      severity: 'info',
      summary: `${evaluation.violationCount} dependency policy finding(s) are within configured review thresholds.`,
      recommendation: 'Keep the policy file under source control with project-specific release criteria.',
      evidence: [
        `Policy maxPolicyWarnings: ${policy.maxPolicyWarnings}`,
        ...evaluation.violations.slice(0, 8).map(formatPolicyViolation)
      ]
    })
  }

  return check({
    id: 'dependency-policy',
    title: 'Dependency policy',
    status: 'warning',
    severity: medium > 0 ? 'medium' : 'low',
    summary: `${warnings} dependency policy warning(s) exceed the configured review threshold of ${policy.maxPolicyWarnings}.`,
    recommendation: 'Review unpinned, prerelease, unknown-license, or component-count findings before release.',
    evidence: [
      `Policy maxPolicyWarnings: ${policy.maxPolicyWarnings}`,
      ...evaluation.violations.slice(0, 8).map(formatPolicyViolation)
    ]
  })
}

function snapshotCheck(
  snapshots: SnapshotSummary[] | undefined,
  error: string | undefined,
  now: Date,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'dependency-snapshots',
      title: 'Rollback snapshots',
      status: 'warning',
      severity: 'medium',
      summary: 'Dependency snapshots could not be listed.',
      recommendation: 'Verify .npmDesktopManager/snapshots is readable and create a new snapshot before production changes.',
      evidence: [error]
    })
  }

  if (!snapshots || snapshots.length === 0) {
    const blocked = policy.blockOnMissingSnapshots
    return check({
      id: 'dependency-snapshots',
      title: 'Rollback snapshots',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'medium',
      summary: 'No manifest or lockfile snapshot exists for this project.',
      recommendation: 'Create a dependency snapshot before batch updates, lockfile regeneration, or package publishing.',
      evidence: [`Policy blockOnMissingSnapshots: ${policy.blockOnMissingSnapshots}`]
    })
  }

  const latest = snapshots[0]
  const latestAgeDays = ageInDays(latest.createdAt, now)
  if (latestAgeDays !== null && latestAgeDays > policy.snapshotStaleDays) {
    const blocked = policy.blockOnStaleSnapshots
    return check({
      id: 'dependency-snapshots',
      title: 'Rollback snapshots',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'medium' : 'low',
      summary: `Latest snapshot is ${Math.round(latestAgeDays)} day(s) old; policy limit is ${policy.snapshotStaleDays} day(s).`,
      recommendation: 'Create a fresh snapshot before releasing or running mutating dependency operations.',
      evidence: [
        `Policy blockOnStaleSnapshots: ${policy.blockOnStaleSnapshots}`,
        `Latest: ${latest.id} (${latest.createdAt})`,
        `Snapshots: ${snapshots.length}`
      ]
    })
  }

  return check({
    id: 'dependency-snapshots',
    title: 'Rollback snapshots',
    status: 'passed',
    severity: 'info',
    summary: `${snapshots.length} rollback snapshot(s) are available.`,
    recommendation: 'Use snapshot diff before and after dependency changes to keep releases auditable.',
    evidence: snapshots.slice(0, 5).map((snapshot) => `${snapshot.id}: ${snapshot.source || 'manual'} ${snapshot.reason || ''}`.trim())
  })
}

function dependencyChangeRiskCheck(
  diff: DependencyComponentDiff | null | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'dependency-change-risk',
      title: 'Dependency change risk',
      status: 'warning',
      severity: 'medium',
      summary: 'Dependency change risk diff could not be generated.',
      recommendation: 'Create a fresh dependency snapshot and rerun the readiness gate before release.',
      evidence: [error]
    })
  }

  if (!diff) {
    return check({
      id: 'dependency-change-risk',
      title: 'Dependency change risk',
      status: 'info',
      severity: 'info',
      summary: 'No dependency component baseline is available for risk diff.',
      recommendation: 'Create a dependency snapshot before dependency changes so future release gates can compare components.',
      evidence: []
    })
  }

  const changed = diff.changes.filter((change) => change.kind !== 'unchanged')
  const highRisk = diff.summary.criticalRisk + diff.summary.highRisk
  if (highRisk > policy.maxHighRiskDependencyChanges) {
    return check({
      id: 'dependency-change-risk',
      title: 'Dependency change risk',
      status: 'blocked',
      severity: diff.summary.criticalRisk > 0 ? 'critical' : 'high',
      summary: `${highRisk} high-risk dependency change(s) exceed the configured maximum of ${policy.maxHighRiskDependencyChanges}.`,
      recommendation: 'Review major updates, prerelease versions, license changes, and unpinned additions before publishing or deploying.',
      evidence: [
        `Policy maxHighRiskDependencyChanges: ${policy.maxHighRiskDependencyChanges}`,
        ...topDependencyRiskEvidence(diff)
      ]
    })
  }

  if (highRisk > 0) {
    return check({
      id: 'dependency-change-risk',
      title: 'Dependency change risk',
      status: 'warning',
      severity: 'high',
      summary: `${highRisk} high-risk dependency change(s) are within the configured release threshold.`,
      recommendation: 'Confirm these high-risk changes have explicit review notes before publishing or deploying.',
      evidence: [
        `Policy maxHighRiskDependencyChanges: ${policy.maxHighRiskDependencyChanges}`,
        ...topDependencyRiskEvidence(diff)
      ]
    })
  }

  if (diff.summary.mediumRisk > policy.maxMediumRiskDependencyChanges) {
    return check({
      id: 'dependency-change-risk',
      title: 'Dependency change risk',
      status: 'warning',
      severity: 'medium',
      summary: `${diff.summary.mediumRisk} medium-risk dependency change(s) exceed the configured review threshold of ${policy.maxMediumRiskDependencyChanges}.`,
      recommendation: 'Review compatibility, lockfile changes, and policy impact before merging or releasing.',
      evidence: [
        `Policy maxMediumRiskDependencyChanges: ${policy.maxMediumRiskDependencyChanges}`,
        ...topDependencyRiskEvidence(diff)
      ]
    })
  }

  return check({
    id: 'dependency-change-risk',
    title: 'Dependency change risk',
    status: 'passed',
    severity: 'info',
    summary: changed.length > 0
      ? `${changed.length} dependency change(s) found without high or medium risk.`
      : 'No dependency component changes found against the latest snapshot.',
    recommendation: 'Export the dependency risk report when attaching release review artifacts.',
    evidence: topDependencyRiskEvidence(diff)
  })
}

function operationHistoryCheck(
  history: OperationHistoryRecord[] | undefined,
  error: string | undefined,
  now: Date,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'operation-history',
      title: 'Operation audit trail',
      status: 'warning',
      severity: 'medium',
      summary: 'Operation history could not be loaded.',
      recommendation: 'Verify .npmDesktopManager/operations is readable and run dependency changes through the managed command runner.',
      evidence: [error]
    })
  }

  if (!history || history.length === 0) {
    return check({
      id: 'operation-history',
      title: 'Operation audit trail',
      status: 'warning',
      severity: 'low',
      summary: 'No managed dependency operation history exists for this project.',
      recommendation: 'Run dependency changes through the app so production reviews include command, status, duration, and redacted output.',
      evidence: []
    })
  }

  const recent = recentOperations(history, now, policy.recentOperationDays)
  const failedPublish = recent.filter((record) => (
    record.status === 'error' &&
    (record.classification?.operation === 'publish' || record.classification?.risk === 'publish')
  ))
  const failedMutating = recent.filter((record) => record.status === 'error' && record.classification?.mutating)

  if (failedPublish.length > policy.maxRecentFailedPublishOperations) {
    return check({
      id: 'operation-history',
      title: 'Operation audit trail',
      status: 'blocked',
      severity: 'high',
      summary: `${failedPublish.length} recent publish operation(s) failed in the last ${policy.recentOperationDays} day(s); policy maximum is ${policy.maxRecentFailedPublishOperations}.`,
      recommendation: 'Resolve failed publish attempts and confirm credentials, registry target, and package metadata before release.',
      evidence: [
        `Policy maxRecentFailedPublishOperations: ${policy.maxRecentFailedPublishOperations}`,
        ...failedPublish.slice(0, 5).map((record) => `${record.finishedAt}: ${record.command}`)
      ]
    })
  }

  if (failedMutating.length > policy.maxRecentFailedMutatingOperations) {
    const blocked = policy.blockOnFailedMutatingOperations
    return check({
      id: 'operation-history',
      title: 'Operation audit trail',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'medium',
      summary: `${failedMutating.length} recent mutating operation(s) failed in the last ${policy.recentOperationDays} day(s); policy maximum is ${policy.maxRecentFailedMutatingOperations}.`,
      recommendation: 'Review failed install/update/remove/build commands and restore from snapshots if the project was left inconsistent.',
      evidence: [
        `Policy blockOnFailedMutatingOperations: ${policy.blockOnFailedMutatingOperations}`,
        ...failedMutating.slice(0, 5).map((record) => `${record.finishedAt}: ${record.command}`)
      ]
    })
  }

  return check({
    id: 'operation-history',
    title: 'Operation audit trail',
    status: 'passed',
    severity: 'info',
    summary: `${history.length} managed operation record(s) are available; no failed publish or mutating command exceeded the ${policy.recentOperationDays}-day policy window.`,
    recommendation: 'Export operation history with release artifacts for traceability.',
    evidence: history.slice(0, 5).map((record) => `${record.status}: ${record.command}`)
  })
}

function ciEvidenceCheck(
  report: CiEvidenceReport | undefined,
  error: string | undefined,
  now: Date,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'ci-evidence',
      title: 'CI evidence',
      status: 'warning',
      severity: 'medium',
      summary: 'CI evidence could not be loaded.',
      recommendation: 'Verify .npmDesktopManager/ci is readable and import the latest CI or test report again.',
      evidence: [error]
    })
  }

  if (!report || report.records.length === 0 || !report.summary.latest) {
    const blocked = policy.blockOnMissingCiEvidence
    return check({
      id: 'ci-evidence',
      title: 'CI evidence',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'low',
      summary: 'No CI or test evidence has been recorded for this project.',
      recommendation: 'Import a CI run, JUnit report, or manual verification record before production release.',
      evidence: [`Policy blockOnMissingCiEvidence: ${policy.blockOnMissingCiEvidence}`]
    })
  }

  const latest = report.summary.latest
  const latestAgeDays = ageInDays(latest.finishedAt, now)
  if (latest.status === 'failed' || latest.status === 'cancelled' || latest.status === 'unknown') {
    const blocked = policy.blockOnFailedCiEvidence
    return check({
      id: 'ci-evidence',
      title: 'CI evidence',
      status: blocked ? 'blocked' : 'warning',
      severity: latest.status === 'failed' ? (blocked ? 'high' : 'medium') : 'medium',
      summary: `Latest CI evidence is ${latest.status}.`,
      recommendation: 'Resolve failed or inconclusive CI runs before publishing or deploying dependency changes.',
      evidence: [
        `Policy blockOnFailedCiEvidence: ${policy.blockOnFailedCiEvidence}`,
        formatCiEvidence(latest),
        ...latest.annotations.slice(0, 5)
      ]
    })
  }

  if (latestAgeDays !== null && latestAgeDays > policy.ciEvidenceMaxAgeDays) {
    const blocked = policy.blockOnStaleCiEvidence
    return check({
      id: 'ci-evidence',
      title: 'CI evidence',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'medium' : 'low',
      summary: `Latest successful CI evidence is ${Math.round(latestAgeDays)} day(s) old; policy limit is ${policy.ciEvidenceMaxAgeDays} day(s).`,
      recommendation: 'Run or import fresh CI evidence after dependency changes and before release approval.',
      evidence: [
        `Policy blockOnStaleCiEvidence: ${policy.blockOnStaleCiEvidence}`,
        formatCiEvidence(latest)
      ]
    })
  }

  return check({
    id: 'ci-evidence',
    title: 'CI evidence',
    status: 'passed',
    severity: 'info',
    summary: `Latest CI evidence passed; ${report.records.length} record(s) are available.`,
    recommendation: 'Export CI evidence with release artifacts for traceable production dependency changes.',
    evidence: [
      formatCiEvidence(latest),
      ...report.records.slice(1, 5).map(formatCiEvidence)
    ]
  })
}

function auditEvidenceCheck(
  report: AuditEvidenceReport | undefined,
  error: string | undefined,
  now: Date,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'audit-evidence',
      title: 'Vulnerability audit evidence',
      status: 'warning',
      severity: 'medium',
      summary: 'Vulnerability audit evidence could not be loaded.',
      recommendation: 'Verify .npmDesktopManager/audits is readable and import current scanner output again.',
      evidence: [error]
    })
  }

  if (!report || report.summary.sourceCount === 0) {
    const blocked = policy.blockOnMissingAuditEvidence
    return check({
      id: 'audit-evidence',
      title: 'Vulnerability audit evidence',
      status: blocked ? 'blocked' : 'info',
      severity: blocked ? 'high' : 'info',
      summary: 'No vulnerability scanner evidence has been imported for this project.',
      recommendation: 'Import npm audit, pip-audit, OSV, SARIF, Trivy, cargo audit, or equivalent scanner output before production release.',
      evidence: [`Policy blockOnMissingAuditEvidence: ${policy.blockOnMissingAuditEvidence}`]
    })
  }

  const summary = report.summary
  const latestImportedAt = latestAuditImportedAt(report)
  const latestAgeDays = latestImportedAt ? ageInDays(latestImportedAt, now) : null
  const stale = latestAgeDays !== null && latestAgeDays > policy.auditEvidenceMaxAgeDays
  const criticalOverflow = summary.critical > policy.maxCriticalAuditFindings
  const highOverflow = summary.high > policy.maxHighAuditFindings
  const mediumOverflow = summary.medium > policy.maxMediumAuditFindings
  const unknown = summary.unknown > 0

  if (stale || criticalOverflow || highOverflow || mediumOverflow || unknown) {
    const blocked = (
      (stale && policy.blockOnStaleAuditEvidence) ||
      (criticalOverflow && policy.blockOnCriticalAuditFindings) ||
      (highOverflow && policy.blockOnHighAuditFindings)
    )
    const severity: ReadinessGateSeverity = summary.critical > 0
      ? 'critical'
      : summary.high > 0
        ? 'high'
        : summary.medium > 0
          ? 'medium'
          : stale
            ? 'medium'
            : 'low'
    const staleText = stale && latestAgeDays !== null
      ? ` Latest evidence is ${Math.round(latestAgeDays)} day(s) old; policy limit is ${policy.auditEvidenceMaxAgeDays} day(s).`
      : ''
    return check({
      id: 'audit-evidence',
      title: 'Vulnerability audit evidence',
      status: blocked ? 'blocked' : 'warning',
      severity,
      summary: `${summary.findingCount} audit finding(s): ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low, ${summary.unknown} unknown.${staleText}`,
      recommendation: blocked
        ? 'Resolve critical/high vulnerabilities, document reviewed exceptions, or update the readiness policy only after release approval.'
        : 'Review scanner findings, prioritize fixed-version upgrades, and enable blocking audit gates for stricter production releases.',
      evidence: [
        `Policy blockOnStaleAuditEvidence: ${policy.blockOnStaleAuditEvidence}`,
        `Policy blockOnCriticalAuditFindings: ${policy.blockOnCriticalAuditFindings}`,
        `Policy blockOnHighAuditFindings: ${policy.blockOnHighAuditFindings}`,
        `Policy max critical/high/medium: ${policy.maxCriticalAuditFindings}/${policy.maxHighAuditFindings}/${policy.maxMediumAuditFindings}`,
        `Latest imported: ${latestImportedAt || '-'}`,
        `Tools: ${summary.tools.join(', ') || '-'}`,
        ...topAuditFindingEvidence(report)
      ]
    })
  }

  return check({
    id: 'audit-evidence',
    title: 'Vulnerability audit evidence',
    status: 'passed',
    severity: 'info',
    summary: `${summary.findingCount} vulnerability audit finding(s) are within configured thresholds across ${summary.sourceCount} scanner source(s).`,
    recommendation: 'Keep scanner output fresh and attach audit evidence to release bundles for reviewer traceability.',
    evidence: [
      `Latest imported: ${latestImportedAt || '-'}`,
      `Fixes available: ${summary.fixAvailableCount}`,
      `Managers: ${summary.managers.join(', ') || '-'}`,
      ...topAuditFindingEvidence(report).slice(0, 6)
    ]
  })
}

function releaseApprovalCheck(
  report: ReleaseApprovalReport | undefined,
  error: string | undefined,
  now: Date,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'release-approvals',
      title: 'Release approvals',
      status: 'warning',
      severity: 'medium',
      summary: 'Release approval evidence could not be loaded.',
      recommendation: 'Verify .npmDesktopManager/approvals is readable and record approval evidence again.',
      evidence: [error]
    })
  }

  const required = policy.requiredReleaseApprovals
  if (!report || report.records.length === 0 || !report.summary.latest) {
    if (required <= 0) {
      return check({
        id: 'release-approvals',
        title: 'Release approvals',
        status: 'info',
        severity: 'info',
        summary: 'No release approval requirement is configured.',
        recommendation: 'Set required release approvals when production dependency changes need reviewer sign-off.',
        evidence: []
      })
    }

    const blocked = policy.blockOnMissingReleaseApprovals
    return check({
      id: 'release-approvals',
      title: 'Release approvals',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'medium',
      summary: `No release approval evidence exists; policy requires ${required} approval(s).`,
      recommendation: 'Record reviewer approval before publishing or deploying dependency changes.',
      evidence: [`Policy blockOnMissingReleaseApprovals: ${policy.blockOnMissingReleaseApprovals}`]
    })
  }

  const latestByReviewer = latestApprovalByReviewer(report.records)
  const rejected = Array.from(latestByReviewer.values()).filter((record) => record.decision === 'rejected' || record.decision === 'revoked')
  if (rejected.length > 0) {
    const blocked = policy.blockOnRejectedReleaseApproval
    return check({
      id: 'release-approvals',
      title: 'Release approvals',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'medium',
      summary: `${rejected.length} reviewer approval state(s) are rejected or revoked.`,
      recommendation: 'Resolve rejected reviews or record fresh approvals before production release.',
      evidence: [
        `Policy blockOnRejectedReleaseApproval: ${policy.blockOnRejectedReleaseApproval}`,
        ...rejected.slice(0, 5).map(formatReleaseApproval)
      ]
    })
  }

  const active = activeReleaseApprovals(report.records, now, policy)
  if (active.length < required) {
    if (required <= 0) {
      return check({
        id: 'release-approvals',
        title: 'Release approvals',
        status: 'passed',
        severity: 'info',
        summary: `${active.length} active approval(s) are recorded; no minimum approval count is configured.`,
        recommendation: 'Export release approvals with the readiness report for auditability.',
        evidence: report.records.slice(0, 5).map(formatReleaseApproval)
      })
    }

    const blocked = policy.blockOnMissingReleaseApprovals
    return check({
      id: 'release-approvals',
      title: 'Release approvals',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'medium',
      summary: `${active.length}/${required} required release approval(s) are active.`,
      recommendation: 'Record enough fresh reviewer approvals before production release.',
      evidence: [
        `Policy releaseApprovalMaxAgeDays: ${policy.releaseApprovalMaxAgeDays}`,
        ...report.records.slice(0, 5).map(formatReleaseApproval)
      ]
    })
  }

  return check({
    id: 'release-approvals',
    title: 'Release approvals',
    status: 'passed',
    severity: 'info',
    summary: `${active.length}/${required} required release approval(s) are active.`,
    recommendation: 'Attach approval evidence to release artifacts and rotate approvals after material dependency changes.',
    evidence: active.slice(0, 5).map(formatReleaseApproval)
  })
}

function applyReleaseExceptions(
  checks: ReadinessGateCheck[],
  exceptions: ReleaseExceptionRecord[]
): { checks: ReadinessGateCheck[]; exceptionedCheckIds: string[] } {
  const exceptionedCheckIds: string[] = []
  const nextChecks = checks.map((item) => {
    if (item.status !== 'blocked' && item.status !== 'warning') return item
    const exception = exceptions.find((record) => releaseExceptionMatchesCheck(record, item.id))
    if (!exception) return item

    exceptionedCheckIds.push(item.id)
    return check({
      ...item,
      status: 'info',
      summary: `Release exception accepted for ${item.title}. Original ${item.status}: ${item.summary}`,
      recommendation: 'Track this exception through the release bundle and remove it after the approved risk window closes.',
      evidence: [
        `Original status: ${item.status}`,
        `Exception reviewer: ${exception.reviewer}`,
        `Exception reason: ${exception.reason}`,
        `Exception scope: ${exception.scope}`,
        `Exception expires: ${exception.expiresAt || '-'}`,
        ...(exception.ticket ? [`Exception ticket: ${exception.ticket}`] : []),
        ...(exception.url ? [`Exception URL: ${exception.url}`] : []),
        ...item.evidence.slice(0, 8)
      ]
    })
  })
  return {
    checks: nextChecks,
    exceptionedCheckIds
  }
}

function releaseExceptionCheck(
  report: ReleaseExceptionReport | undefined,
  error: string | undefined,
  exceptionedCheckIds: string[]
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'release-exceptions',
      title: 'Release exceptions',
      status: 'warning',
      severity: 'medium',
      summary: 'Release exception evidence could not be loaded.',
      recommendation: 'Verify .npmDesktopManager/exceptions is readable and record exception evidence again.',
      evidence: [error]
    })
  }

  if (!report || report.records.length === 0) {
    return check({
      id: 'release-exceptions',
      title: 'Release exceptions',
      status: 'info',
      severity: 'info',
      summary: 'No release exceptions are recorded.',
      recommendation: 'Prefer fixing blocked gates; record a short-lived exception only after review.',
      evidence: []
    })
  }

  const active = activeReleaseExceptions(report.records, new Date(report.generatedAt))
  if (active.length === 0) {
    return check({
      id: 'release-exceptions',
      title: 'Release exceptions',
      status: 'info',
      severity: 'info',
      summary: `${report.records.length} release exception record(s) exist, but none are active.`,
      recommendation: 'Keep expired or revoked exceptions in release artifacts for audit history.',
      evidence: report.records.slice(0, 5).map(formatReleaseException)
    })
  }

  return check({
    id: 'release-exceptions',
    title: 'Release exceptions',
    status: 'warning',
    severity: 'low',
    summary: `${active.length} active release exception(s) cover ${exceptionedCheckIds.length} readiness check(s).`,
    recommendation: 'Export the release bundle so exception approvals travel with the readiness and SBOM evidence.',
    evidence: [
      `Exceptioned checks: ${exceptionedCheckIds.join(', ') || '-'}`,
      ...active.slice(0, 5).map(formatReleaseException)
    ]
  })
}

function releaseExceptionMatchesCheck(record: ReleaseExceptionRecord, checkId: string): boolean {
  return record.checkIds.includes('*') || record.checkIds.includes(checkId)
}

function registryReachabilityCheck(
  report: RegistryReachabilityReport | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'registry-reachability',
      title: 'Registry reachability',
      status: 'warning',
      severity: 'medium',
      summary: 'Registry reachability could not be checked.',
      recommendation: 'Verify package-manager configuration files are readable and retry the reachability check.',
      evidence: [error]
    })
  }

  if (!report || report.summary.endpointCount === 0) {
    const blocked = policy.blockOnMissingRegistryEndpoints
    return check({
      id: 'registry-reachability',
      title: 'Registry reachability',
      status: blocked ? 'blocked' : 'info',
      severity: blocked ? 'medium' : 'info',
      summary: 'No configured registry, mirror, or repository endpoints were discovered in the project.',
      recommendation: 'Add explicit registry configuration when releases must prove private feed or mirror reachability.',
      evidence: [`Policy blockOnMissingRegistryEndpoints: ${policy.blockOnMissingRegistryEndpoints}`]
    })
  }

  const insecure = report.results.filter((result) => !result.secure)
  if (insecure.length > 0 && policy.blockOnInsecureRegistries) {
    return check({
      id: 'registry-reachability',
      title: 'Registry reachability',
      status: 'blocked',
      severity: 'high',
      summary: `${insecure.length} configured registry endpoint(s) use insecure HTTP.`,
      recommendation: 'Move package registry, mirror, and repository URLs to HTTPS or document an approved internal exception.',
      evidence: insecure.slice(0, 6).map(formatRegistryResult)
    })
  }

  const unreachable = report.results.filter((result) => result.status === 'unreachable')
  if (unreachable.length > policy.maxUnreachableRegistries) {
    const blocked = policy.blockOnUnreachableRegistries
    return check({
      id: 'registry-reachability',
      title: 'Registry reachability',
      status: blocked ? 'blocked' : 'warning',
      severity: blocked ? 'high' : 'medium',
      summary: `${unreachable.length} registry endpoint(s) are unreachable; policy maximum is ${policy.maxUnreachableRegistries}.`,
      recommendation: 'Fix registry URLs, credentials, proxy settings, or private network access before dependency updates or publishing.',
      evidence: [
        `Policy timeout: ${policy.registryReachabilityTimeoutMs} ms`,
        ...unreachable.slice(0, 6).map(formatRegistryResult)
      ]
    })
  }

  const unknown = report.results.filter((result) => result.status === 'unknown')
  if (unknown.length > 0) {
    return check({
      id: 'registry-reachability',
      title: 'Registry reachability',
      status: 'warning',
      severity: 'low',
      summary: `${unknown.length} registry endpoint(s) returned inconclusive reachability results.`,
      recommendation: 'Retry from the release network or increase the readiness timeout for slow private registries.',
      evidence: unknown.slice(0, 6).map(formatRegistryResult)
    })
  }

  if (insecure.length > 0) {
    return check({
      id: 'registry-reachability',
      title: 'Registry reachability',
      status: 'warning',
      severity: 'medium',
      summary: `${insecure.length} configured registry endpoint(s) use insecure HTTP.`,
      recommendation: 'Prefer HTTPS for package registries and repository mirrors.',
      evidence: insecure.slice(0, 6).map(formatRegistryResult)
    })
  }

  return check({
    id: 'registry-reachability',
    title: 'Registry reachability',
    status: 'passed',
    severity: 'info',
    summary: `${report.summary.reachable}/${report.summary.endpointCount} configured registry endpoint(s) are reachable.`,
    recommendation: 'Export registry reachability with release artifacts when private feeds or mirrors are required.',
    evidence: report.results.slice(0, 8).map(formatRegistryResult)
  })
}

function workspaceTopologyCheck(
  report: WorkspaceDiscoveryReport | undefined,
  error: string | undefined
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'workspace-topology',
      title: 'Workspace topology',
      status: 'warning',
      severity: 'medium',
      summary: 'Workspace discovery could not be generated.',
      recommendation: 'Verify monorepo manifest files are readable and retry workspace discovery from the health center.',
      evidence: [error]
    })
  }

  if (!report) {
    return check({
      id: 'workspace-topology',
      title: 'Workspace topology',
      status: 'info',
      severity: 'info',
      summary: 'Workspace discovery was not available.',
      recommendation: 'Run workspace discovery before release review for monorepos or mixed-language repositories.',
      evidence: []
    })
  }

  const unmanaged = report.workspaces.filter((workspace) => workspace.managerIds.length === 0)
  if (unmanaged.length > 0) {
    return check({
      id: 'workspace-topology',
      title: 'Workspace topology',
      status: 'warning',
      severity: 'medium',
      summary: `${unmanaged.length} workspace node(s) have no recognized dependency manager.`,
      recommendation: 'Add supported manifests or document unmanaged folders before applying repository-level dependency policies.',
      evidence: unmanaged.slice(0, 8).map((workspace) => `${workspace.relativePath}: ${workspace.kind}`)
    })
  }

  if (report.summary.workspaceCount <= 1) {
    return check({
      id: 'workspace-topology',
      title: 'Workspace topology',
      status: 'passed',
      severity: 'info',
      summary: 'Single-project workspace topology detected.',
      recommendation: 'Use workspace discovery again after adding packages, services, modules, or charts.',
      evidence: report.workspaces.map((workspace) => `${workspace.relativePath}: ${workspace.managerIds.join(', ') || '-'}`)
    })
  }

  return check({
    id: 'workspace-topology',
    title: 'Workspace topology',
    status: 'passed',
    severity: 'info',
    summary: `${report.summary.workspaceCount} workspace node(s) discovered across ${report.summary.managerCount} manager(s).`,
    recommendation: 'Use workspace boundaries to scope policy reviews, release approvals, and future partitioned readiness gates.',
    evidence: report.workspaces.slice(0, 12).map((workspace) => (
      `${workspace.relativePath}: ${workspace.kind} (${workspace.managerIds.join(', ') || '-'})`
    ))
  })
}

function lockfileDriftCheck(
  report: LockfileDriftReport | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'lockfile-drift',
      title: 'Lockfile drift',
      status: 'warning',
      severity: 'medium',
      summary: 'Lockfile drift report could not be generated.',
      recommendation: 'Verify workspace manifests and lockfiles are readable, then export the lockfile drift report from the health center.',
      evidence: [error]
    })
  }

  if (!report) {
    return check({
      id: 'lockfile-drift',
      title: 'Lockfile drift',
      status: 'info',
      severity: 'info',
      summary: 'Lockfile drift report was not available.',
      recommendation: 'Run lockfile drift export before release review for reproducible dependency installs.',
      evidence: []
    })
  }

  const blockedFindings = report.workspaces.flatMap((workspace) => workspace.findings.filter((finding) => finding.severity === 'blocked'))
  const warningFindings = report.workspaces.flatMap((workspace) => workspace.findings.filter((finding) => finding.severity === 'warning'))
  const warningOverflow = warningFindings.length > policy.maxLockfileDriftWarnings

  if (blockedFindings.length > 0 || warningOverflow) {
    const blocked = policy.blockOnLockfileDrift
    return check({
      id: 'lockfile-drift',
      title: 'Lockfile drift',
      status: blocked ? 'blocked' : 'warning',
      severity: blockedFindings.length > 0 ? 'high' : 'medium',
      summary: `${blockedFindings.length} blocked and ${warningFindings.length} warning lockfile drift finding(s); warning maximum is ${policy.maxLockfileDriftWarnings}.`,
      recommendation: 'Regenerate missing or stale lockfiles, align package managers, and attach the lockfile drift report to release review.',
      evidence: [
        `Policy blockOnLockfileDrift: ${policy.blockOnLockfileDrift}`,
        `Policy maxLockfileDriftWarnings: ${policy.maxLockfileDriftWarnings}`,
        ...report.workspaces.flatMap((workspace) => workspace.findings.map((finding) => formatLockfileDriftFinding(workspace.workspace.relativePath, finding))).slice(0, 10)
      ]
    })
  }

  if (report.summary.findingCount > 0) {
    return check({
      id: 'lockfile-drift',
      title: 'Lockfile drift',
      status: 'passed',
      severity: 'info',
      summary: `${report.summary.findingCount} informational lockfile drift finding(s) are within policy thresholds.`,
      recommendation: 'Keep inherited lockfile coverage visible in the release bundle for workspace reviews.',
      evidence: report.workspaces.flatMap((workspace) => workspace.findings.map((finding) => formatLockfileDriftFinding(workspace.workspace.relativePath, finding))).slice(0, 8)
    })
  }

  return check({
    id: 'lockfile-drift',
    title: 'Lockfile drift',
    status: 'passed',
    severity: 'info',
    summary: `${report.summary.workspaceCount} workspace(s) have no actionable lockfile drift findings.`,
    recommendation: 'Continue reviewing lockfile diffs with dependency update plans.',
    evidence: [`Workspaces checked: ${report.summary.workspaceCount}`]
  })
}

function runtimePinningCheck(
  report: RuntimePinningReport | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'runtime-pinning',
      title: 'Runtime pinning',
      status: 'warning',
      severity: 'medium',
      summary: 'Runtime pinning report could not be generated.',
      recommendation: 'Verify runtime manifests are readable, then export the runtime pinning report from the health center.',
      evidence: [error]
    })
  }

  if (!report) {
    return check({
      id: 'runtime-pinning',
      title: 'Runtime pinning',
      status: 'info',
      severity: 'info',
      summary: 'Runtime pinning report was not available.',
      recommendation: 'Run runtime pinning export before release review for reproducible build environments.',
      evidence: []
    })
  }

  const blockedFindings = report.workspaces.flatMap((workspace) => workspace.findings.filter((finding) => finding.severity === 'blocked'))
  const warningFindings = report.workspaces.flatMap((workspace) => workspace.findings.filter((finding) => finding.severity === 'warning'))
  const floatingTagFindings = report.workspaces.flatMap((workspace) => workspace.findings.filter((finding) => finding.kind === 'floating-container-tag'))
  const warningOverflow = warningFindings.length > policy.maxRuntimePinningWarnings

  if (blockedFindings.length > 0 || warningOverflow || (floatingTagFindings.length > 0 && policy.blockOnFloatingContainerTags)) {
    const blocked = policy.blockOnRuntimePinning || (floatingTagFindings.length > 0 && policy.blockOnFloatingContainerTags)
    return check({
      id: 'runtime-pinning',
      title: 'Runtime pinning',
      status: blocked ? 'blocked' : 'warning',
      severity: blockedFindings.length > 0 || floatingTagFindings.length > 0 ? 'high' : 'medium',
      summary: `${blockedFindings.length} blocked and ${warningFindings.length} warning runtime pinning finding(s); ${floatingTagFindings.length} floating container tag(s).`,
      recommendation: 'Pin language runtimes, SDKs, package-manager versions, build wrappers, and container image tags before production release.',
      evidence: [
        `Policy blockOnRuntimePinning: ${policy.blockOnRuntimePinning}`,
        `Policy blockOnFloatingContainerTags: ${policy.blockOnFloatingContainerTags}`,
        `Policy maxRuntimePinningWarnings: ${policy.maxRuntimePinningWarnings}`,
        ...report.workspaces.flatMap((workspace) => workspace.findings.map((finding) => formatRuntimePinningFinding(workspace.workspace.relativePath, finding))).slice(0, 10)
      ]
    })
  }

  if (report.summary.findingCount > 0) {
    return check({
      id: 'runtime-pinning',
      title: 'Runtime pinning',
      status: 'passed',
      severity: 'info',
      summary: `${report.summary.findingCount} runtime pinning finding(s) are within policy thresholds.`,
      recommendation: 'Attach runtime pinning evidence to release review so build and install environments remain reproducible.',
      evidence: report.workspaces.flatMap((workspace) => workspace.findings.map((finding) => formatRuntimePinningFinding(workspace.workspace.relativePath, finding))).slice(0, 8)
    })
  }

  return check({
    id: 'runtime-pinning',
    title: 'Runtime pinning',
    status: 'passed',
    severity: 'info',
    summary: `${report.summary.evidenceCount} runtime pinning evidence record(s) were found across ${report.summary.workspaceCount} workspace(s).`,
    recommendation: 'Keep runtime and SDK pin files under source control with dependency manifests.',
    evidence: report.workspaces.flatMap((workspace) => workspace.evidence.map((item) => `${workspace.workspace.relativePath}: ${item.kind} ${item.value} (${item.relativePath})`)).slice(0, 10)
  })
}

function deploymentReferenceCheck(
  report: SupplyChainReport | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'deployment-references',
      title: 'Deployment references',
      status: 'warning',
      severity: 'medium',
      summary: 'Deployment dependency references could not be checked.',
      recommendation: 'Regenerate the supply-chain inventory, then review cloud-native and GitOps deployment refs before release.',
      evidence: [error]
    })
  }

  if (!report) {
    return check({
      id: 'deployment-references',
      title: 'Deployment references',
      status: 'info',
      severity: 'info',
      summary: 'Deployment dependency inventory was not available.',
      recommendation: 'Run supply-chain inventory before release so deployment images, charts, overlays, and GitOps sources are reviewed.',
      evidence: []
    })
  }

  const references = deploymentReferenceComponents(report)
  const floatingReferences = references.filter((component) => isFloatingDeploymentReference(component))
  if (floatingReferences.length > policy.maxFloatingDeploymentRefs) {
    const blocked = policy.blockOnFloatingDeploymentRefs
    return check({
      id: 'deployment-references',
      title: 'Deployment references',
      status: blocked ? 'blocked' : 'warning',
      severity: 'high',
      summary: `${floatingReferences.length} floating deployment reference(s) exceed the configured maximum of ${policy.maxFloatingDeploymentRefs}.`,
      recommendation: 'Pin container images, Helm charts, Kustomize remote bases, Skaffold deploy charts, and GitOps source revisions to reviewed tags, versions, or immutable digests.',
      evidence: [
        `Policy blockOnFloatingDeploymentRefs: ${policy.blockOnFloatingDeploymentRefs}`,
        `Policy maxFloatingDeploymentRefs: ${policy.maxFloatingDeploymentRefs}`,
        ...floatingReferences.slice(0, 12).map(formatDeploymentReference)
      ]
    })
  }

  if (references.length > 0) {
    return check({
      id: 'deployment-references',
      title: 'Deployment references',
      status: 'passed',
      severity: 'info',
      summary: `${references.length} deployment dependency reference(s) are within policy thresholds.`,
      recommendation: 'Keep deployment dependency pins in release evidence alongside SBOM and runtime pinning reports.',
      evidence: references.slice(0, 10).map(formatDeploymentReference)
    })
  }

  return check({
    id: 'deployment-references',
    title: 'Deployment references',
    status: 'info',
    severity: 'info',
    summary: 'No cloud-native or GitOps deployment dependency references were found.',
    recommendation: 'Add deployment manifests to the project inventory when release artifacts include images, charts, overlays, or GitOps sources.',
    evidence: []
  })
}

function deploymentBaselineCheck(
  report: SupplyChainReport | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'deployment-baselines',
      title: 'Deployment baselines',
      status: 'warning',
      severity: 'medium',
      summary: 'Deployment baseline evidence could not be checked.',
      recommendation: 'Regenerate the supply-chain inventory, then attach image digest, Helm lock, or immutable GitOps baseline evidence before release.',
      evidence: [error]
    })
  }

  if (!report) {
    return check({
      id: 'deployment-baselines',
      title: 'Deployment baselines',
      status: 'info',
      severity: 'info',
      summary: 'Deployment baseline inventory was not available.',
      recommendation: 'Run supply-chain inventory before release so deployment images, charts, overlays, and GitOps sources can be checked for immutable baselines.',
      evidence: []
    })
  }

  const references = deploymentBaselineComponents(report)
  const findings = deploymentBaselineFindings(report)
  if (findings.length > policy.maxMissingDeploymentBaselines) {
    const blocked = policy.blockOnMissingDeploymentBaselines
    return check({
      id: 'deployment-baselines',
      title: 'Deployment baselines',
      status: blocked ? 'blocked' : 'warning',
      severity: findings.some((finding) => finding.severity === 'high') ? 'high' : 'medium',
      summary: `${findings.length} deployment baseline gap(s) exceed the configured maximum of ${policy.maxMissingDeploymentBaselines}.`,
      recommendation: 'Pin production images by digest, commit Helm lockfiles or rendered chart baselines, and use immutable commit or digest refs for GitOps sources before release.',
      evidence: [
        `Policy blockOnMissingDeploymentBaselines: ${policy.blockOnMissingDeploymentBaselines}`,
        `Policy maxMissingDeploymentBaselines: ${policy.maxMissingDeploymentBaselines}`,
        ...findings.slice(0, 12).map(formatDeploymentBaselineFinding)
      ]
    })
  }

  if (references.length > 0) {
    return check({
      id: 'deployment-baselines',
      title: 'Deployment baselines',
      status: 'passed',
      severity: 'info',
      summary: `${references.length - findings.length}/${references.length} deployment reference(s) have acceptable baseline evidence.`,
      recommendation: 'Keep image digests, chart locks, and immutable GitOps revisions in release evidence for repeatable deploys.',
      evidence: findings.length > 0
        ? findings.slice(0, 8).map(formatDeploymentBaselineFinding)
        : references.slice(0, 10).map(formatDeploymentReference)
    })
  }

  return check({
    id: 'deployment-baselines',
    title: 'Deployment baselines',
    status: 'info',
    severity: 'info',
    summary: 'No deployment references require baseline evidence.',
    recommendation: 'Add deployment manifests to the project inventory when release artifacts include images, charts, overlays, or GitOps sources.',
    evidence: []
  })
}

function credentialUsageCheck(
  report: CredentialUsageReport | undefined,
  error: string | undefined,
  policy: ReadinessPolicy
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'credential-usage',
      title: 'Credential usage',
      status: 'warning',
      severity: 'medium',
      summary: 'Credential usage map could not be generated.',
      recommendation: 'Verify registry configuration and credential vault metadata, then export the credential usage map from the health center.',
      evidence: [error]
    })
  }

  if (!report) {
    return check({
      id: 'credential-usage',
      title: 'Credential usage',
      status: 'info',
      severity: 'info',
      summary: 'Credential usage map was not available.',
      recommendation: 'Run credential usage export before publishing to private registries or internal package feeds.',
      evidence: []
    })
  }

  const missing = report.summary.missingCredentialEndpointCount
  const weak = report.summary.weakMatchEndpointCount
  const insecureStorage = report.summary.insecureStorageEndpointCount
  const insecureEndpoint = report.summary.insecureEndpointCount
  const unused = report.summary.unusedCredentialCount
  const missingOverflow = missing > policy.maxMissingCredentialEndpoints
  const weakOverflow = weak > policy.maxWeakCredentialMatches
  const unusedOverflow = unused > policy.maxUnusedCredentials
  const insecure = insecureStorage + insecureEndpoint

  if (missingOverflow || weakOverflow || unusedOverflow || insecure > 0) {
    const blocked = (
      (missingOverflow && policy.blockOnMissingCredentialEndpoints) ||
      (weakOverflow && policy.blockOnWeakCredentialMatches) ||
      (unusedOverflow && policy.blockOnUnusedCredentials) ||
      (insecure > 0 && policy.blockOnInsecureCredentialUsage)
    )
    return check({
      id: 'credential-usage',
      title: 'Credential usage',
      status: blocked ? 'blocked' : 'warning',
      severity: missingOverflow || insecure > 0 ? 'high' : 'medium',
      summary: `${missing} missing credential endpoint(s), ${weak} weak match(es), ${insecureStorage} insecure storage match(es), ${insecureEndpoint} insecure endpoint(s), ${unused} unused credential(s).`,
      recommendation: 'Add URL-scoped credentials for private feeds, rotate or remove unused credentials, and avoid sending credentials to HTTP endpoints.',
      evidence: [
        `Policy blockOnMissingCredentialEndpoints: ${policy.blockOnMissingCredentialEndpoints}`,
        `Policy blockOnInsecureCredentialUsage: ${policy.blockOnInsecureCredentialUsage}`,
        `Policy blockOnWeakCredentialMatches: ${policy.blockOnWeakCredentialMatches}`,
        `Policy blockOnUnusedCredentials: ${policy.blockOnUnusedCredentials}`,
        ...report.endpoints
          .filter((endpoint) => endpoint.status !== 'covered' && endpoint.status !== 'public')
          .slice(0, 8)
          .map(formatCredentialUsageEndpoint),
        ...report.unusedCredentials.slice(0, 4).map((credential) => `unused: ${credential.managerId} ${credential.label} (${credential.service})`)
      ]
    })
  }

  return check({
    id: 'credential-usage',
    title: 'Credential usage',
    status: 'passed',
    severity: 'info',
    summary: `${report.summary.coveredEndpointCount}/${report.summary.endpointCount} endpoint(s) have acceptable credential coverage.`,
    recommendation: 'Keep credential usage maps in release bundles for private registry and publish reviews.',
    evidence: [
      `Vault storage: ${report.vaultStatus.storage}`,
      `Credentials: ${report.summary.credentialCount}`,
      ...report.endpoints.slice(0, 8).map(formatCredentialUsageEndpoint)
    ]
  })
}

function credentialVaultCheck(
  status: CredentialVaultStatus | undefined,
  error: string | undefined,
  credentials: CredentialMetadata[],
  detectedManagers: DependencyManagerDefinition[]
): ReadinessGateCheck {
  if (error) {
    return check({
      id: 'credential-vault',
      title: 'Credential vault',
      status: 'warning',
      severity: 'medium',
      summary: 'Credential vault status could not be read.',
      recommendation: 'Open Settings and verify secure credential storage before publishing or accessing private registries.',
      evidence: [error]
    })
  }

  if (!status) {
    return check({
      id: 'credential-vault',
      title: 'Credential vault',
      status: 'info',
      severity: 'info',
      summary: 'Credential vault integration was not provided for this readiness run.',
      recommendation: 'Use the Electron app readiness check to verify OS-backed credential storage.',
      evidence: []
    })
  }

  if (!status.available || !status.encrypted) {
    return check({
      id: 'credential-vault',
      title: 'Credential vault',
      status: 'warning',
      severity: 'medium',
      summary: `Credential vault is using ${status.storage}${status.encrypted ? '' : ' without OS encryption'}.`,
      recommendation: 'Avoid saving long-lived production tokens until OS secure storage is available, or use one-time credentials for publish operations.',
      evidence: [status.warning || 'Secure storage is not fully available.']
    })
  }

  const publishManagers = detectedManagers.filter((manager) => manager.capabilities.includes('publish'))
  const detectedIds = new Set(detectedManagers.map((manager) => manager.id))
  const projectCredentials = credentials.filter((credential) => detectedIds.has(credential.managerId))
  const publishCredentialManagers = new Set(projectCredentials.map((credential) => credential.managerId))
  const missingPublishCredentials = publishManagers.filter((manager) => !publishCredentialManagers.has(manager.id))

  if (missingPublishCredentials.length > 0) {
    return check({
      id: 'credential-vault',
      title: 'Credential vault',
      status: 'info',
      severity: 'info',
      summary: `Vault encryption is available; ${missingPublishCredentials.length} publish-capable manager(s) have no saved credential metadata.`,
      recommendation: 'Save registry credentials only when this project publishes packages or uses private feeds.',
      evidence: [
        `Storage: ${status.storage}`,
        ...missingPublishCredentials.map((manager) => `${manager.name}: no saved credential metadata`)
      ]
    })
  }

  return check({
    id: 'credential-vault',
    title: 'Credential vault',
    status: 'passed',
    severity: 'info',
    summary: `Credential vault is encrypted with ${status.storage}.`,
    recommendation: 'Rotate package-publishing tokens periodically and remove credentials that no longer map to active registries.',
    evidence: [`Saved metadata records: ${credentials.length}`]
  })
}

function detectedManagerDefinitions(project: ProjectInfo): DependencyManagerDefinition[] {
  const ids = unique(project.detectedManagers.filter((manager) => manager.detected).map((manager) => manager.id))
  return ids
    .map((id) => MANAGER_BY_ID.get(id))
    .filter((manager): manager is DependencyManagerDefinition => Boolean(manager))
}

function recentOperations(history: OperationHistoryRecord[], now: Date, days: number): OperationHistoryRecord[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
  return history.filter((record) => {
    const timestamp = Date.parse(record.finishedAt || record.startedAt)
    return Number.isFinite(timestamp) && timestamp >= cutoff
  })
}

function summarizeDependencyRisk(diff?: DependencyComponentDiff | null): {
  changeCount: number
  highRiskCount: number
  mediumRiskCount: number
  majorUpdateCount: number
  prereleaseChangeCount: number
} {
  if (!diff) {
    return {
      changeCount: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      majorUpdateCount: 0,
      prereleaseChangeCount: 0
    }
  }

  return {
    changeCount: diff.changes.filter((change) => change.kind !== 'unchanged').length,
    highRiskCount: diff.summary.criticalRisk + diff.summary.highRisk,
    mediumRiskCount: diff.summary.mediumRisk,
    majorUpdateCount: diff.summary.majorUpdates,
    prereleaseChangeCount: diff.summary.prereleaseChanges
  }
}

function summarizeCiEvidence(report?: CiEvidenceReport): {
  count: number
  latestStatus?: CiEvidenceStatus
  latestFinishedAt?: string
} {
  return {
    count: report?.records.length || 0,
    latestStatus: report?.summary.latest?.status,
    latestFinishedAt: report?.summary.latest?.finishedAt
  }
}

function summarizeAuditEvidence(report?: AuditEvidenceReport): {
  sourceCount: number
  findingCount: number
  critical: number
  high: number
  medium: number
  fixAvailableCount: number
  latestImportedAt?: string
} {
  return {
    sourceCount: report?.summary.sourceCount || 0,
    findingCount: report?.summary.findingCount || 0,
    critical: report?.summary.critical || 0,
    high: report?.summary.high || 0,
    medium: report?.summary.medium || 0,
    fixAvailableCount: report?.summary.fixAvailableCount || 0,
    latestImportedAt: report ? latestAuditImportedAt(report) : undefined
  }
}

function summarizeReleaseApprovals(
  report: ReleaseApprovalReport | undefined,
  now: Date,
  policy: ReadinessPolicy
): {
  count: number
  activeCount: number
  latestDecision?: ReleaseApprovalDecision
} {
  return {
    count: report?.records.length || 0,
    activeCount: report ? activeReleaseApprovals(report.records, now, policy).length : 0,
    latestDecision: report?.summary.latest?.decision
  }
}

function summarizeReleaseExceptions(
  report: ReleaseExceptionReport | undefined,
  now: Date,
  exceptionedCheckCount: number
): {
  count: number
  activeCount: number
  exceptionedCheckCount: number
} {
  return {
    count: report?.records.length || 0,
    activeCount: report ? activeReleaseExceptions(report.records, now).length : 0,
    exceptionedCheckCount
  }
}

function summarizeRegistryReachability(report?: RegistryReachabilityReport): {
  endpointCount: number
  unreachable: number
  insecure: number
} {
  return {
    endpointCount: report?.summary.endpointCount || 0,
    unreachable: report?.summary.unreachable || 0,
    insecure: report?.summary.insecure || 0
  }
}

function summarizeWorkspaceDiscovery(report?: WorkspaceDiscoveryReport): {
  workspaceCount: number
  explicitWorkspaceCount: number
  managerCount: number
} {
  return {
    workspaceCount: report?.summary.workspaceCount || 0,
    explicitWorkspaceCount: report?.summary.explicitWorkspaceCount || 0,
    managerCount: report?.summary.managerCount || 0
  }
}

function summarizeLockfileDrift(report?: LockfileDriftReport): {
  findingCount: number
  blockedCount: number
  warningCount: number
} {
  return {
    findingCount: report?.summary.findingCount || 0,
    blockedCount: report?.summary.blockedFindingCount || 0,
    warningCount: report?.summary.warningFindingCount || 0
  }
}

function summarizeRuntimePinning(report?: RuntimePinningReport): {
  findingCount: number
  blockedCount: number
  warningCount: number
  floatingContainerTagCount: number
} {
  return {
    findingCount: report?.summary.findingCount || 0,
    blockedCount: report?.summary.blockedFindingCount || 0,
    warningCount: report?.summary.warningFindingCount || 0,
    floatingContainerTagCount: report?.summary.floatingContainerTagCount || 0
  }
}

function summarizeDeploymentReferences(report?: SupplyChainReport): {
  deploymentReferenceCount: number
  floatingDeploymentRefCount: number
} {
  if (!report) {
    return {
      deploymentReferenceCount: 0,
      floatingDeploymentRefCount: 0
    }
  }
  const references = deploymentReferenceComponents(report)
  return {
    deploymentReferenceCount: references.length,
    floatingDeploymentRefCount: references.filter(isFloatingDeploymentReference).length
  }
}

function summarizeDeploymentBaselines(report?: SupplyChainReport): {
  deploymentBaselineEvidenceCount: number
  missingDeploymentBaselineCount: number
} {
  if (!report) {
    return {
      deploymentBaselineEvidenceCount: 0,
      missingDeploymentBaselineCount: 0
    }
  }
  const components = deploymentBaselineComponents(report)
  const findings = deploymentBaselineFindings(report)
  return {
    deploymentBaselineEvidenceCount: Math.max(0, components.length - findings.length),
    missingDeploymentBaselineCount: findings.length
  }
}

function summarizeCredentialUsage(report?: CredentialUsageReport): {
  endpointCount: number
  missingCredentialEndpointCount: number
  weakCredentialMatchCount: number
  insecureStorageEndpointCount: number
  insecureEndpointCount: number
  unusedCredentialCount: number
} {
  return {
    endpointCount: report?.summary.endpointCount || 0,
    missingCredentialEndpointCount: report?.summary.missingCredentialEndpointCount || 0,
    weakCredentialMatchCount: report?.summary.weakMatchEndpointCount || 0,
    insecureStorageEndpointCount: report?.summary.insecureStorageEndpointCount || 0,
    insecureEndpointCount: report?.summary.insecureEndpointCount || 0,
    unusedCredentialCount: report?.summary.unusedCredentialCount || 0
  }
}

function topDependencyRiskEvidence(diff: DependencyComponentDiff): string[] {
  const changed = diff.changes
    .filter((change) => change.kind !== 'unchanged')
    .sort((a, b) => riskRank(b.risk) - riskRank(a.risk))
    .slice(0, 8)
    .map((change) => {
      const before = change.before?.version || '-'
      const after = change.after?.version || '-'
      return `${change.risk}: ${change.managerId}:${change.name} ${change.kind} ${before} -> ${after} (${change.riskReasons.join('; ')})`
    })

  return changed.length > 0
    ? changed
    : [`Baseline ${diff.fromSnapshotId}: ${diff.beforeComponentCount} -> ${diff.afterComponentCount} components`]
}

function formatCiEvidence(record: CiEvidenceReport['records'][number]): string {
  const target = [
    record.provider,
    record.workflow,
    record.job
  ].filter(Boolean).join(' / ') || record.id
  const tests = typeof record.totalTests === 'number'
    ? `; tests ${record.passedTests ?? '-'} passed, ${record.failedTests ?? 0} failed, ${record.totalTests} total`
    : ''
  return `${record.status}: ${target} at ${record.finishedAt}${tests}${record.url ? ` (${record.url})` : ''}`
}

function topAuditFindingEvidence(report: AuditEvidenceReport): string[] {
  return [...report.findings]
    .sort((a, b) => auditSeverityRank(b.severity) - auditSeverityRank(a.severity))
    .slice(0, 8)
    .map(formatAuditFinding)
}

function formatAuditFinding(finding: AuditEvidenceFinding): string {
  const target = [
    finding.managerId,
    finding.packageName,
    finding.installedVersion
  ].filter(Boolean).join(':') || finding.title
  const fix = finding.fixedVersion ? `; fixed ${finding.fixedVersion}` : ''
  const vuln = finding.vulnerabilityId || finding.aliases[0] || '-'
  const workspace = finding.workspaceRelativePath ? `; workspace ${finding.workspaceRelativePath}` : ''
  return `${finding.severity}: ${target} (${finding.tool}; ${vuln}${fix}${workspace})`
}

function latestAuditImportedAt(report: AuditEvidenceReport): string | undefined {
  const timestamps = [
    ...report.sources.map((source) => source.importedAt),
    ...report.findings.map((finding) => finding.importedAt)
  ]
    .map((value) => ({ value, timestamp: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
  return timestamps[0]?.value
}

function auditSeverityRank(severity: AuditEvidenceSeverity): number {
  return {
    unknown: 0,
    info: 1,
    low: 2,
    medium: 3,
    high: 4,
    critical: 5
  }[severity]
}

function activeReleaseApprovals(
  records: ReleaseApprovalRecord[],
  now: Date,
  policy: ReadinessPolicy
): ReleaseApprovalRecord[] {
  return Array.from(latestApprovalByReviewer(records).values()).filter((record) => {
    if (record.decision !== 'approved') return false
    const age = ageInDays(record.decidedAt, now)
    if (age !== null && age > policy.releaseApprovalMaxAgeDays) return false
    if (record.expiresAt) {
      const expiresAt = Date.parse(record.expiresAt)
      if (Number.isFinite(expiresAt) && expiresAt < now.getTime()) return false
    }
    return true
  })
}

function latestApprovalByReviewer(records: ReleaseApprovalRecord[]): Map<string, ReleaseApprovalRecord> {
  const latest = new Map<string, ReleaseApprovalRecord>()
  for (const record of [...records].sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))) {
    const key = record.reviewer.toLowerCase()
    if (!latest.has(key)) {
      latest.set(key, record)
    }
  }
  return latest
}

function formatReleaseApproval(record: ReleaseApprovalRecord): string {
  const expires = record.expiresAt ? `; expires ${record.expiresAt}` : ''
  const target = [
    record.reviewer,
    record.scope,
    record.ticket
  ].filter(Boolean).join(' / ')
  return `${record.decision}: ${target} at ${record.decidedAt}${expires}${record.summary ? ` (${record.summary})` : ''}`
}

function formatReleaseException(record: ReleaseExceptionRecord): string {
  const expires = record.expiresAt ? `; expires ${record.expiresAt}` : ''
  const target = [
    record.reviewer,
    record.scope,
    record.ticket
  ].filter(Boolean).join(' / ')
  return `${record.decision}: ${target} for ${record.checkIds.join(', ')} at ${record.decidedAt}${expires} (${record.reason})`
}

function formatRegistryResult(result: RegistryReachabilityReport['results'][number]): string {
  const code = result.statusCode ? ` ${result.statusCode}` : ''
  const secure = result.secure ? 'https' : 'insecure-http'
  return `${result.status}${code}: ${result.managerId || 'registry'} ${result.kind} ${result.url} (${secure}; ${result.sourceFile})${result.message ? ` - ${result.message}` : ''}`
}

function formatLockfileDriftFinding(
  workspacePath: string,
  finding: LockfileDriftReport['workspaces'][number]['findings'][number]
): string {
  return `${workspacePath}: ${finding.severity} ${finding.kind}${finding.managerId ? `/${finding.managerId}` : ''} - ${finding.title}`
}

function formatRuntimePinningFinding(
  workspacePath: string,
  finding: RuntimePinningReport['workspaces'][number]['findings'][number]
): string {
  return `${workspacePath}: ${finding.severity} ${finding.kind}${finding.managerId ? `/${finding.managerId}` : ''} - ${finding.title}`
}

function deploymentReferenceComponents(report: SupplyChainReport): SupplyChainReport['components'] {
  return report.components.filter(isDeploymentReferenceComponent)
}

function deploymentBaselineComponents(report: SupplyChainReport): SupplyChainReport['components'] {
  return deploymentReferenceComponents(report).filter((component) => component.scope.toLowerCase() !== 'lockfile')
}

function isDeploymentReferenceComponent(component: SupplyChainReport['components'][number]): boolean {
  if (!DEPLOYMENT_REFERENCE_MANAGERS.has(component.managerId)) return false
  if (IGNORED_DEPLOYMENT_SCOPES.has(component.scope.toLowerCase())) return false
  if ((component.managerId === 'kustomize' || component.managerId === 'skaffold') && isLocalDeploymentReference(component.name)) {
    return Boolean(component.version)
  }
  return true
}

function isFloatingDeploymentReference(component: SupplyChainReport['components'][number]): boolean {
  return isFloatingDeploymentVersion(component.version)
}

interface DeploymentBaselineFinding {
  id: string
  severity: 'high' | 'medium'
  title: string
  summary: string
  recommendation: string
  component: SupplyChainReport['components'][number]
}

function deploymentBaselineFindings(report: SupplyChainReport): DeploymentBaselineFinding[] {
  const helmLockKeys = new Set(report.components
    .filter((component) => component.managerId === 'helm' && component.scope.toLowerCase() === 'lockfile')
    .map(deploymentComponentKey))
  const findings: DeploymentBaselineFinding[] = []

  for (const component of deploymentBaselineComponents(report)) {
    const scope = component.scope.toLowerCase()
    if (isContainerDeploymentComponent(component)) {
      if (!isDigestPinnedDeploymentVersion(component.version)) {
        findings.push(deploymentBaselineFinding(
          component,
          'high',
          'Container image digest is not pinned',
          `${component.managerId}:${component.name}@${component.version || '<unversioned>'} is not pinned to an immutable image digest.`,
          'Use an image digest such as image@sha256:... in production manifests, or attach a reviewed image lock artifact to the release bundle.'
        ))
      }
      continue
    }

    if (component.managerId === 'helm' && scope === 'chart') {
      if (!helmLockKeys.has(deploymentComponentKey(component))) {
        findings.push(deploymentBaselineFinding(
          component,
          'medium',
          'Helm chart lockfile evidence is missing',
          `${component.name}@${component.version || '<unversioned>'} is declared in Chart.yaml but no matching Chart.lock entry was found.`,
          'Run helm dependency update, commit Chart.lock, and include the lockfile in release evidence.'
        ))
      }
      continue
    }

    if (isChartDeploymentComponent(component)) {
      findings.push(deploymentBaselineFinding(
        component,
        'medium',
        'Chart deployment baseline is missing',
        `${component.managerId}:${component.name}@${component.version || '<unversioned>'} is declared without portable chart lock or rendered baseline evidence.`,
        'Attach the resolved chart lock, helmfile dependency output, rendered manifests, or a reviewed release artifact digest before production deployment.'
      ))
      continue
    }

    if (isGitOpsSourceComponent(component) && !isImmutableDeploymentVersion(component.version)) {
      findings.push(deploymentBaselineFinding(
        component,
        'medium',
        'GitOps source ref is not immutable',
        `${component.managerId}:${component.name}@${component.version || '<unversioned>'} is not a commit SHA or digest-backed source reference.`,
        'Use an immutable commit SHA, signed tag policy evidence, or an exported GitOps source baseline before release approval.'
      ))
    }
  }

  return findings
}

function isContainerDeploymentComponent(component: SupplyChainReport['components'][number]): boolean {
  const scope = component.scope.toLowerCase()
  return (
    component.managerId === 'docker'
    || scope.includes('image')
    || component.name.includes('/')
      && (
        component.name.includes('.') ||
        component.name.includes(':') ||
        component.name.startsWith('ghcr.io/') ||
        component.name.startsWith('docker.io/') ||
        component.name.startsWith('quay.io/')
      )
  )
}

function isChartDeploymentComponent(component: SupplyChainReport['components'][number]): boolean {
  const scope = component.scope.toLowerCase()
  return (
    scope === 'helmchart'
    || scope === 'release'
    || scope === 'deploy-chart'
    || scope === 'helm-source'
    || scope === 'helmrelease'
  )
}

function isGitOpsSourceComponent(component: SupplyChainReport['components'][number]): boolean {
  const scope = component.scope.toLowerCase()
  return (
    component.managerId === 'argocd'
    || component.managerId === 'flux'
    || component.managerId === 'kustomize' && (scope === 'resources' || scope === 'bases' || scope === 'components')
  )
}

function isDigestPinnedDeploymentVersion(value?: string): boolean {
  return Boolean(value && /^sha256:[a-f0-9]{12,}$/i.test(stripDeploymentQuotes(value.trim())))
}

function isImmutableDeploymentVersion(value?: string): boolean {
  if (!value) return false
  const clean = stripDeploymentQuotes(value.trim())
  return isDigestPinnedDeploymentVersion(clean) || /^[a-f0-9]{12,}$/i.test(clean)
}

function deploymentComponentKey(component: SupplyChainReport['components'][number]): string {
  return [
    component.managerId,
    component.name.toLowerCase(),
    stripDeploymentQuotes(component.version || '').toLowerCase()
  ].join(':')
}

function deploymentBaselineFinding(
  component: SupplyChainReport['components'][number],
  severity: DeploymentBaselineFinding['severity'],
  title: string,
  summary: string,
  recommendation: string
): DeploymentBaselineFinding {
  return {
    id: `${component.managerId}:${component.sourceFile}:${component.scope}:${component.name}:${component.version || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120),
    severity,
    title,
    summary,
    recommendation,
    component
  }
}

function isFloatingDeploymentVersion(value?: string): boolean {
  if (!value) return true
  const clean = stripDeploymentQuotes(value.trim())
  if (!clean) return true
  const normalized = clean.toLowerCase().replace(/^refs\/heads\//, '')
  if (FLOATING_DEPLOYMENT_LABELS.has(normalized)) return true
  if (/^sha256:[a-f0-9]{12,}$/i.test(clean)) return false
  if (/^refs\/tags\//i.test(clean)) return false
  if (/^refs\/heads\//i.test(clean)) return true
  if (/^(branch|ref)\s*[:=]\s*/i.test(clean)) return true
  if (/^(any|\{\})$/i.test(clean)) return true
  if (/^[~^<>=!*]/.test(clean)) return true
  if (/[xX*]/.test(clean)) return true
  if (/\|\||,/.test(clean)) return true
  return false
}

function isLocalDeploymentReference(value: string): boolean {
  const clean = stripDeploymentQuotes(value.trim())
  return clean === '.' || clean === '..' || clean.startsWith('./') || clean.startsWith('../') || clean.startsWith('/') || clean.startsWith('\\')
}

function stripDeploymentQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim()
}

function formatDeploymentReference(component: SupplyChainReport['components'][number]): string {
  return `${component.managerId}:${component.name}@${component.version || '<unversioned>'} (${component.scope}; ${component.sourceFile})`
}

function formatDeploymentBaselineFinding(finding: DeploymentBaselineFinding): string {
  return `${finding.severity}: ${finding.title} - ${formatDeploymentReference(finding.component)}`
}

function formatCredentialUsageEndpoint(endpoint: CredentialUsageReport['endpoints'][number]): string {
  const matches = endpoint.matches.length > 0
    ? endpoint.matches.map((match) => `${match.label}/${match.matchType}`).join(', ')
    : 'no matches'
  return `${endpoint.status}: ${endpoint.endpoint.managerId || 'registry'} ${endpoint.endpoint.url} (${matches})`
}

function riskRank(level: string): number {
  return {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  }[level] ?? 0
}

function summarizeToolStatuses(toolStatuses: ReadinessToolStatus[]): { total: number; missing: number } {
  return {
    total: toolStatuses.length,
    missing: toolStatuses.filter((status) => !status.available).length
  }
}

function statusFromChecks(checks: ReadinessGateCheck[]): ReadinessGateStatus {
  if (checks.some((item) => item.status === 'blocked')) return 'blocked'
  if (checks.some((item) => item.status === 'warning')) return 'warning'
  return 'ready'
}

function scoreFromChecks(checks: ReadinessGateCheck[]): number {
  const penalty = checks.reduce((total, item) => {
    if (item.status === 'passed' || item.status === 'info') return total
    return total + severityPenalty(item.severity, item.status)
  }, 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}

function severityPenalty(severity: ReadinessGateSeverity, status: ReadinessGateCheckStatus): number {
  const base = {
    critical: 35,
    high: 25,
    medium: 12,
    low: 6,
    info: 0
  }[severity]
  return status === 'blocked' ? base + 10 : base
}

function check(input: Omit<ReadinessGateCheck, 'passed'>): ReadinessGateCheck {
  return {
    ...input,
    passed: input.status === 'passed' || input.status === 'info'
  }
}

function formatPolicyViolation(violation: DependencyPolicyEvaluation['violations'][number]): string {
  const target = [
    violation.managerId,
    violation.packageName,
    violation.version
  ].filter(Boolean).join(':')
  return `${violation.severity}: ${violation.title}${target ? ` (${target})` : ''}`
}

function renderMarkdownReport(report: ReadinessGateReport): string {
  const lines = [
    '# Production Readiness Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    `Score: ${report.score}`,
    `Readiness policy: ${report.policy.path}`,
    '',
    '## Summary',
    '',
    `- Detected managers: ${report.summary.detectedManagers.join(', ') || '-'}`,
    `- Components: ${report.summary.componentCount}`,
    `- Policy violations: ${report.summary.policyViolationCount}`,
    `- Snapshots: ${report.summary.snapshotCount}`,
    `- Dependency changes: ${report.summary.dependencyChangeCount}`,
    `- High-risk dependency changes: ${report.summary.dependencyHighRiskCount}`,
    `- Medium-risk dependency changes: ${report.summary.dependencyMediumRiskCount}`,
    `- Major dependency updates: ${report.summary.dependencyMajorUpdateCount}`,
    `- Prerelease dependency changes: ${report.summary.dependencyPrereleaseChangeCount}`,
    `- CI evidence records: ${report.summary.ciEvidenceCount}`,
    `- Latest CI evidence: ${report.summary.latestCiStatus || '-'} ${report.summary.latestCiFinishedAt || ''}`.trim(),
    `- Audit evidence sources: ${report.summary.auditEvidenceSourceCount}`,
    `- Audit findings critical/high/medium: ${report.summary.auditCriticalFindingCount}/${report.summary.auditHighFindingCount}/${report.summary.auditMediumFindingCount}`,
    `- Audit fixes available: ${report.summary.auditFixAvailableCount}`,
    `- Latest audit evidence: ${report.summary.latestAuditImportedAt || '-'}`,
    `- Release approvals: ${report.summary.activeReleaseApprovalCount}/${report.policy.policy.requiredReleaseApprovals} active (${report.summary.releaseApprovalCount} records)`,
    `- Latest release approval: ${report.summary.latestReleaseApprovalDecision || '-'}`,
    `- Release exceptions: ${report.summary.activeReleaseExceptionCount} active (${report.summary.releaseExceptionCount} records)`,
    `- Exceptioned checks: ${report.summary.exceptionedCheckCount}`,
    `- Registry endpoints: ${report.summary.registryEndpointCount}`,
    `- Unreachable registries: ${report.summary.unreachableRegistryCount}`,
    `- Insecure registries: ${report.summary.insecureRegistryCount}`,
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Explicit workspaces: ${report.summary.explicitWorkspaceCount}`,
    `- Workspace managers: ${report.summary.workspaceManagerCount}`,
    `- Lockfile drift findings: ${report.summary.lockfileDriftFindingCount}`,
    `- Lockfile drift blocked/warning: ${report.summary.lockfileDriftBlockedCount}/${report.summary.lockfileDriftWarningCount}`,
    `- Runtime pinning findings: ${report.summary.runtimePinningFindingCount}`,
    `- Runtime pinning blocked/warning: ${report.summary.runtimePinningBlockedCount}/${report.summary.runtimePinningWarningCount}`,
    `- Floating container tags: ${report.summary.floatingContainerTagCount}`,
    `- Deployment references: ${report.summary.deploymentReferenceCount}`,
    `- Floating deployment refs: ${report.summary.floatingDeploymentRefCount}`,
    `- Deployment baseline evidence: ${report.summary.deploymentBaselineEvidenceCount}`,
    `- Missing deployment baselines: ${report.summary.missingDeploymentBaselineCount}`,
    `- Credential endpoints: ${report.summary.credentialEndpointCount}`,
    `- Missing credential endpoints: ${report.summary.missingCredentialEndpointCount}`,
    `- Weak credential matches: ${report.summary.weakCredentialMatchCount}`,
    `- Insecure credential storage matches: ${report.summary.insecureCredentialStorageEndpointCount}`,
    `- Insecure credential endpoints: ${report.summary.insecureCredentialEndpointCount}`,
    `- Unused credentials: ${report.summary.unusedCredentialCount}`,
    `- Recent operations: ${report.summary.recentOperationCount}`,
    `- Missing tools: ${report.summary.missingToolCount}/${report.summary.requiredToolCount}`,
    `- Credential storage: ${report.summary.credentialStorage || '-'}`,
    `- Recent operation window: ${report.policy.policy.recentOperationDays} day(s)`,
    `- Snapshot stale window: ${report.policy.policy.snapshotStaleDays} day(s)`,
    `- Minimum score: ${report.policy.policy.minimumScore || '-'}`,
    '',
    '## Gates',
    '',
    '| Gate | Status | Severity | Summary | Recommendation |',
    '| --- | --- | --- | --- | --- |',
    ...report.checks.map((item) => [
      escapeMarkdownTable(item.title),
      item.status,
      item.severity,
      escapeMarkdownTable(item.summary),
      escapeMarkdownTable(item.recommendation)
    ].join(' | ')).map((row) => `| ${row} |`),
    '',
    '## Evidence',
    ''
  ]

  for (const item of report.checks) {
    lines.push(`### ${item.title}`)
    if (item.evidence.length === 0) {
      lines.push('- No additional evidence.')
    } else {
      lines.push(...item.evidence.map((evidence) => `- ${evidence}`))
    }
    lines.push('')
  }

  return lines.join('\n')
}

function renderReadinessGateBlockedMessage(label: string, report: ReadinessGateReport): string {
  const blockedChecks = report.checks
    .filter((check) => check.status === 'blocked')
    .slice(0, 5)
    .map((check) => `${check.title}: ${check.summary}`)
  return [
    `Production readiness gate blocked ${label}.`,
    `Status: ${report.status}; score: ${report.score}/100.`,
    ...blockedChecks,
    'Set overrideReadinessGate only after manual approval.'
  ].join('\n')
}

function isDryRunPublish(value: boolean | string | undefined): boolean {
  return value === true || value === 'true'
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

async function writeTextReport(cwd: string, fileName: string, content: string): Promise<string> {
  const path = join(cwd, REPORT_DIR, fileName)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf-8')
  return path
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)]
}

async function readReadinessPolicyFile(path: string): Promise<Partial<ReadinessPolicy>> {
  try {
    const text = await readFile(path, 'utf-8')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Policy file must contain a JSON object')
    }
    return parsed as Partial<ReadinessPolicy>
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid readiness policy JSON in ${path}: ${error.message}`)
    }
    throw error
  }
}

function normalizeReadinessPolicy(policy: Partial<ReadinessPolicy>): ReadinessPolicy {
  return {
    recentOperationDays: integerPolicyValue(policy.recentOperationDays, DEFAULT_READINESS_POLICY.recentOperationDays, 1, 365),
    snapshotStaleDays: integerPolicyValue(policy.snapshotStaleDays, DEFAULT_READINESS_POLICY.snapshotStaleDays, 1, 365),
    blockOnMissingSnapshots: booleanPolicyValue(policy.blockOnMissingSnapshots, DEFAULT_READINESS_POLICY.blockOnMissingSnapshots),
    blockOnStaleSnapshots: booleanPolicyValue(policy.blockOnStaleSnapshots, DEFAULT_READINESS_POLICY.blockOnStaleSnapshots),
    blockOnMissingTools: booleanPolicyValue(policy.blockOnMissingTools, DEFAULT_READINESS_POLICY.blockOnMissingTools),
    blockOnFailedMutatingOperations: booleanPolicyValue(
      policy.blockOnFailedMutatingOperations,
      DEFAULT_READINESS_POLICY.blockOnFailedMutatingOperations
    ),
    maxHighRiskDependencyChanges: integerPolicyValue(
      policy.maxHighRiskDependencyChanges,
      DEFAULT_READINESS_POLICY.maxHighRiskDependencyChanges,
      0,
      10000
    ),
    maxMediumRiskDependencyChanges: integerPolicyValue(
      policy.maxMediumRiskDependencyChanges,
      DEFAULT_READINESS_POLICY.maxMediumRiskDependencyChanges,
      0,
      10000
    ),
    maxHighSeverityPolicyViolations: integerPolicyValue(
      policy.maxHighSeverityPolicyViolations,
      DEFAULT_READINESS_POLICY.maxHighSeverityPolicyViolations,
      0,
      10000
    ),
    maxPolicyWarnings: integerPolicyValue(policy.maxPolicyWarnings, DEFAULT_READINESS_POLICY.maxPolicyWarnings, 0, 10000),
    maxPolicyViolations: integerPolicyValue(policy.maxPolicyViolations, DEFAULT_READINESS_POLICY.maxPolicyViolations, 0, 100000),
    maxRecentFailedPublishOperations: integerPolicyValue(
      policy.maxRecentFailedPublishOperations,
      DEFAULT_READINESS_POLICY.maxRecentFailedPublishOperations,
      0,
      10000
    ),
    maxRecentFailedMutatingOperations: integerPolicyValue(
      policy.maxRecentFailedMutatingOperations,
      DEFAULT_READINESS_POLICY.maxRecentFailedMutatingOperations,
      0,
      10000
    ),
    ciEvidenceMaxAgeDays: integerPolicyValue(policy.ciEvidenceMaxAgeDays, DEFAULT_READINESS_POLICY.ciEvidenceMaxAgeDays, 1, 365),
    blockOnMissingCiEvidence: booleanPolicyValue(policy.blockOnMissingCiEvidence, DEFAULT_READINESS_POLICY.blockOnMissingCiEvidence),
    blockOnStaleCiEvidence: booleanPolicyValue(policy.blockOnStaleCiEvidence, DEFAULT_READINESS_POLICY.blockOnStaleCiEvidence),
    blockOnFailedCiEvidence: booleanPolicyValue(policy.blockOnFailedCiEvidence, DEFAULT_READINESS_POLICY.blockOnFailedCiEvidence),
    auditEvidenceMaxAgeDays: integerPolicyValue(
      policy.auditEvidenceMaxAgeDays,
      DEFAULT_READINESS_POLICY.auditEvidenceMaxAgeDays,
      1,
      365
    ),
    blockOnMissingAuditEvidence: booleanPolicyValue(
      policy.blockOnMissingAuditEvidence,
      DEFAULT_READINESS_POLICY.blockOnMissingAuditEvidence
    ),
    blockOnStaleAuditEvidence: booleanPolicyValue(
      policy.blockOnStaleAuditEvidence,
      DEFAULT_READINESS_POLICY.blockOnStaleAuditEvidence
    ),
    maxCriticalAuditFindings: integerPolicyValue(
      policy.maxCriticalAuditFindings,
      DEFAULT_READINESS_POLICY.maxCriticalAuditFindings,
      0,
      10000
    ),
    maxHighAuditFindings: integerPolicyValue(
      policy.maxHighAuditFindings,
      DEFAULT_READINESS_POLICY.maxHighAuditFindings,
      0,
      10000
    ),
    maxMediumAuditFindings: integerPolicyValue(
      policy.maxMediumAuditFindings,
      DEFAULT_READINESS_POLICY.maxMediumAuditFindings,
      0,
      10000
    ),
    blockOnCriticalAuditFindings: booleanPolicyValue(
      policy.blockOnCriticalAuditFindings,
      DEFAULT_READINESS_POLICY.blockOnCriticalAuditFindings
    ),
    blockOnHighAuditFindings: booleanPolicyValue(
      policy.blockOnHighAuditFindings,
      DEFAULT_READINESS_POLICY.blockOnHighAuditFindings
    ),
    requiredReleaseApprovals: integerPolicyValue(policy.requiredReleaseApprovals, DEFAULT_READINESS_POLICY.requiredReleaseApprovals, 0, 20),
    releaseApprovalMaxAgeDays: integerPolicyValue(policy.releaseApprovalMaxAgeDays, DEFAULT_READINESS_POLICY.releaseApprovalMaxAgeDays, 1, 365),
    blockOnMissingReleaseApprovals: booleanPolicyValue(
      policy.blockOnMissingReleaseApprovals,
      DEFAULT_READINESS_POLICY.blockOnMissingReleaseApprovals
    ),
    blockOnRejectedReleaseApproval: booleanPolicyValue(
      policy.blockOnRejectedReleaseApproval,
      DEFAULT_READINESS_POLICY.blockOnRejectedReleaseApproval
    ),
    registryReachabilityTimeoutMs: integerPolicyValue(
      policy.registryReachabilityTimeoutMs,
      DEFAULT_READINESS_POLICY.registryReachabilityTimeoutMs,
      500,
      15000
    ),
    blockOnMissingRegistryEndpoints: booleanPolicyValue(
      policy.blockOnMissingRegistryEndpoints,
      DEFAULT_READINESS_POLICY.blockOnMissingRegistryEndpoints
    ),
    blockOnUnreachableRegistries: booleanPolicyValue(
      policy.blockOnUnreachableRegistries,
      DEFAULT_READINESS_POLICY.blockOnUnreachableRegistries
    ),
    blockOnInsecureRegistries: booleanPolicyValue(
      policy.blockOnInsecureRegistries,
      DEFAULT_READINESS_POLICY.blockOnInsecureRegistries
    ),
    maxUnreachableRegistries: integerPolicyValue(
      policy.maxUnreachableRegistries,
      DEFAULT_READINESS_POLICY.maxUnreachableRegistries,
      0,
      10000
    ),
    maxLockfileDriftWarnings: integerPolicyValue(
      policy.maxLockfileDriftWarnings,
      DEFAULT_READINESS_POLICY.maxLockfileDriftWarnings,
      0,
      10000
    ),
    blockOnLockfileDrift: booleanPolicyValue(
      policy.blockOnLockfileDrift,
      DEFAULT_READINESS_POLICY.blockOnLockfileDrift
    ),
    maxRuntimePinningWarnings: integerPolicyValue(
      policy.maxRuntimePinningWarnings,
      DEFAULT_READINESS_POLICY.maxRuntimePinningWarnings,
      0,
      10000
    ),
    blockOnRuntimePinning: booleanPolicyValue(
      policy.blockOnRuntimePinning,
      DEFAULT_READINESS_POLICY.blockOnRuntimePinning
    ),
    blockOnFloatingContainerTags: booleanPolicyValue(
      policy.blockOnFloatingContainerTags,
      DEFAULT_READINESS_POLICY.blockOnFloatingContainerTags
    ),
    maxFloatingDeploymentRefs: integerPolicyValue(
      policy.maxFloatingDeploymentRefs,
      DEFAULT_READINESS_POLICY.maxFloatingDeploymentRefs,
      0,
      10000
    ),
    blockOnFloatingDeploymentRefs: booleanPolicyValue(
      policy.blockOnFloatingDeploymentRefs,
      DEFAULT_READINESS_POLICY.blockOnFloatingDeploymentRefs
    ),
    maxMissingDeploymentBaselines: integerPolicyValue(
      policy.maxMissingDeploymentBaselines,
      DEFAULT_READINESS_POLICY.maxMissingDeploymentBaselines,
      0,
      10000
    ),
    blockOnMissingDeploymentBaselines: booleanPolicyValue(
      policy.blockOnMissingDeploymentBaselines,
      DEFAULT_READINESS_POLICY.blockOnMissingDeploymentBaselines
    ),
    maxMissingCredentialEndpoints: integerPolicyValue(
      policy.maxMissingCredentialEndpoints,
      DEFAULT_READINESS_POLICY.maxMissingCredentialEndpoints,
      0,
      10000
    ),
    blockOnMissingCredentialEndpoints: booleanPolicyValue(
      policy.blockOnMissingCredentialEndpoints,
      DEFAULT_READINESS_POLICY.blockOnMissingCredentialEndpoints
    ),
    blockOnInsecureCredentialUsage: booleanPolicyValue(
      policy.blockOnInsecureCredentialUsage,
      DEFAULT_READINESS_POLICY.blockOnInsecureCredentialUsage
    ),
    maxWeakCredentialMatches: integerPolicyValue(
      policy.maxWeakCredentialMatches,
      DEFAULT_READINESS_POLICY.maxWeakCredentialMatches,
      0,
      10000
    ),
    blockOnWeakCredentialMatches: booleanPolicyValue(
      policy.blockOnWeakCredentialMatches,
      DEFAULT_READINESS_POLICY.blockOnWeakCredentialMatches
    ),
    maxUnusedCredentials: integerPolicyValue(
      policy.maxUnusedCredentials,
      DEFAULT_READINESS_POLICY.maxUnusedCredentials,
      0,
      100000
    ),
    blockOnUnusedCredentials: booleanPolicyValue(
      policy.blockOnUnusedCredentials,
      DEFAULT_READINESS_POLICY.blockOnUnusedCredentials
    ),
    minimumScore: integerPolicyValue(policy.minimumScore, DEFAULT_READINESS_POLICY.minimumScore, 0, 100),
    blockBelowMinimumScore: booleanPolicyValue(policy.blockBelowMinimumScore, DEFAULT_READINESS_POLICY.blockBelowMinimumScore)
  }
}

function integerPolicyValue(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.floor(numeric)))
}

function booleanPolicyValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function ageInDays(value: string, now: Date): number | null {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return (now.getTime() - timestamp) / (24 * 60 * 60 * 1000)
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}
