import { createHash, randomUUID } from 'crypto'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { pathToFileURL } from 'url'
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
  SupplyChainService,
  type DependencyPolicy,
  type DependencyPolicyEvaluation,
  type SnapshotSummary,
  type SupplyChainReport
} from './supplyChain'
import {
  exportOperationHistory,
  listOperationHistory,
  type OperationHistoryRecord
} from './operationHistory'
import {
  DEFAULT_READINESS_POLICY,
  ReadinessGateService,
  type ReadinessGateReport,
  type ReadinessGateStatus,
  type ReadinessPolicy
} from './readinessGate'
import {
  ReleaseApprovalService,
  type ReleaseApprovalDecision,
  type ReleaseApprovalRecord,
  type ReleaseApprovalReport
} from './releaseApproval'
import {
  activeReleaseExceptions,
  ReleaseExceptionService,
  type ReleaseExceptionDecision,
  type ReleaseExceptionReport
} from './releaseException'
import {
  CiEvidenceService,
  type CiEvidenceReport,
  type CiEvidenceStatus
} from './ciEvidence'
import {
  AuditEvidenceService,
  type AuditEvidenceReport
} from './auditEvidence'
import { VulnerabilityRemediationPlanService } from './vulnerabilityRemediationPlan'
import { RegistryReachabilityService } from './registryReachability'
import { CredentialUsageService } from './credentialUsage'
import { LockfileDriftService } from './lockfileDrift'
import { RuntimePinningService } from './runtimePinning'
import { OfflineCacheReadinessService } from './offlineCacheReadiness'
import {
  ReleaseRiskProfileService,
  type ReleaseRiskProfileFinding,
  type ReleaseRiskProfileReport
} from './releaseRiskProfile'
import { CiIntegrationPlanService } from './ciIntegrationPlan'
import { DependencyAutomationPlanService } from './dependencyAutomationPlan'
import { CredentialRotationPlanService } from './credentialRotationPlan'
import { AutomationSafetyPlanService } from './automationSafetyPlan'
import { DependencyOwnershipPlanService } from './dependencyOwnershipPlan'
import { PolicyAsCodePackService } from './policyAsCodePack'
import { ThirdPartyNoticesService } from './thirdPartyNotices'
import { ReleaseProvenanceAttestationService } from './releaseProvenanceAttestation'

export type WorkspaceGovernanceStatus = 'ready' | 'warning' | 'blocked'
export type WorkspaceGovernanceFindingSeverity = 'info' | 'warning' | 'blocked'
export type WorkspaceGovernanceExportFormat = 'markdown' | 'json'
export type WorkspaceReleaseEvidenceExportFormat = 'markdown' | 'json'
export type WorkspaceSbomExportFormat = 'cyclonedx' | 'spdx'
export type WorkspaceRemediationPlanExportFormat = 'markdown' | 'json'
export type WorkspaceUpdatePlanExportFormat = 'markdown' | 'json'
export type RemediationPlanItemScope = 'project' | 'workspace'
export type RemediationPlanItemSource =
  | 'readiness'
  | 'release-risk'
  | 'workspace-governance'
  | 'workspace-readiness'
  | 'export-error'
export type RemediationPlanPriority = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type WorkspaceUpdatePlanRisk = 'blocked' | 'high' | 'medium' | 'low' | 'info'
export type WorkspaceUpdatePlanItemStatus = 'ready' | 'needs-review' | 'blocked'
export type WorkspaceUpdatePlanCommandStage = 'inspect' | 'update' | 'verify' | 'audit' | 'lock'
export type ReleaseBundleArtifactKind =
  | 'readiness'
  | 'workspace-discovery'
  | 'workspace-governance'
  | 'workspace-release-evidence'
  | 'remediation-plan'
  | 'update-plan'
  | 'workspace-sbom'
  | 'root-sbom'
  | 'license-compliance'
  | 'third-party-notices'
  | 'dependency-diff'
  | 'operation-history'
  | 'ci-evidence'
  | 'audit-evidence'
  | 'vulnerability-remediation-plan'
  | 'release-provenance-attestation'
  | 'release-approval'
  | 'release-exception'
  | 'credential-usage'
  | 'lockfile-drift'
  | 'runtime-pinning'
  | 'offline-cache-readiness'
  | 'release-risk-profile'
  | 'ci-integration-plan'
  | 'dependency-automation-plan'
  | 'credential-rotation-plan'
  | 'automation-safety-plan'
  | 'dependency-ownership-plan'
  | 'dependency-upgrade-playbook'
  | 'dependency-rollback-plan'
  | 'dependency-impact-analysis'
  | 'dependency-change-approval-packet'
  | 'dependency-change-calendar'
  | 'dependency-change-execution-record'
  | 'policy-as-code-pack'
  | 'registry-reachability'
export type WorkspacePolicySource = 'workspace' | 'inherited-root' | 'none'
export type WorkspaceReadinessPolicySource = 'workspace' | 'inherited-root' | 'default'
export type WorkspaceSnapshotSource = 'workspace' | 'inherited-root' | 'none'
export type WorkspaceReleaseApprovalSource = 'workspace' | 'inherited-root' | 'none'
export type WorkspaceCiEvidenceSource = 'workspace' | 'inherited-root' | 'none'
export type WorkspaceReleaseExceptionSource = 'workspace' | 'inherited-root' | 'none'
type WorkspaceAuditEvidenceSource = 'workspace' | 'inherited-root' | 'none'

export interface WorkspaceGovernanceFinding {
  id: string
  title: string
  severity: WorkspaceGovernanceFindingSeverity
  summary: string
  recommendation: string
  evidence: string[]
}

export interface WorkspaceReadinessCheckSummary {
  id: string
  title: string
  status: ReadinessGateReport['checks'][number]['status']
  severity: ReadinessGateReport['checks'][number]['severity']
  summary: string
  recommendation: string
  evidence: string[]
}

export interface WorkspaceGovernanceNode {
  workspace: WorkspaceNode
  status: WorkspaceGovernanceStatus
  score: number
  componentCount: number
  policyViolationCount: number
  highSeverityPolicyViolationCount: number
  snapshotCount: number
  snapshotSource: WorkspaceSnapshotSource
  snapshotPath?: string
  snapshotCoveredFileCount: number
  snapshotCoveredFiles: string[]
  recentOperationCount: number
  failedOperationCount: number
  manifestFileCount: number
  lockFileCount: number
  missingLockManagers: DependencyManagerId[]
  policySource: WorkspacePolicySource
  policyPath?: string
  readinessStatus: ReadinessGateStatus
  readinessScore: number
  readinessBlockedCheckCount: number
  readinessWarningCheckCount: number
  readinessBlockedChecks: WorkspaceReadinessCheckSummary[]
  readinessWarningChecks: WorkspaceReadinessCheckSummary[]
  readinessPolicySource: WorkspaceReadinessPolicySource
  readinessPolicyPath?: string
  ciEvidenceSource: WorkspaceCiEvidenceSource
  ciEvidencePath?: string
  ciEvidenceCount: number
  latestCiStatus?: CiEvidenceStatus
  latestCiFinishedAt?: string
  releaseApprovalSource: WorkspaceReleaseApprovalSource
  releaseApprovalPath?: string
  releaseApprovalCount: number
  activeReleaseApprovalCount: number
  latestReleaseApprovalDecision?: ReleaseApprovalDecision
  releaseExceptionSource: WorkspaceReleaseExceptionSource
  releaseExceptionPath?: string
  releaseExceptionCount: number
  activeReleaseExceptionCount: number
  latestReleaseExceptionDecision?: ReleaseExceptionDecision
  findings: WorkspaceGovernanceFinding[]
}

export interface WorkspaceGovernanceSummary {
  workspaceCount: number
  ready: number
  warning: number
  blocked: number
  componentCount: number
  policyViolationCount: number
  highSeverityPolicyViolationCount: number
  snapshotCount: number
  recentOperationCount: number
  failedOperationCount: number
  missingLockWorkspaceCount: number
  workspaceSnapshotCount: number
  inheritedSnapshotWorkspaceCount: number
  missingSnapshotWorkspaceCount: number
  inheritedSnapshotCoveredFileCount: number
  workspacePolicyCount: number
  inheritedPolicyWorkspaceCount: number
  missingPolicyWorkspaceCount: number
  readinessReady: number
  readinessWarning: number
  readinessBlocked: number
  workspaceReadinessPolicyCount: number
  inheritedReadinessPolicyWorkspaceCount: number
  defaultReadinessPolicyWorkspaceCount: number
  ciEvidenceRecordCount: number
  workspaceCiEvidenceCount: number
  inheritedCiEvidenceWorkspaceCount: number
  missingCiEvidenceWorkspaceCount: number
  failedCiEvidenceWorkspaceCount: number
  releaseApprovalRecordCount: number
  activeReleaseApprovalCount: number
  workspaceReleaseApprovalEvidenceCount: number
  inheritedReleaseApprovalEvidenceWorkspaceCount: number
  missingReleaseApprovalEvidenceWorkspaceCount: number
  rejectedReleaseApprovalWorkspaceCount: number
  releaseExceptionRecordCount: number
  activeReleaseExceptionCount: number
  workspaceReleaseExceptionEvidenceCount: number
  inheritedReleaseExceptionEvidenceWorkspaceCount: number
  missingReleaseExceptionEvidenceWorkspaceCount: number
  managers: DependencyManagerId[]
  byManager: Record<string, number>
}

export interface WorkspaceGovernanceReport {
  generatedAt: string
  projectPath: string
  discovery: WorkspaceDiscoveryReport
  workspaces: WorkspaceGovernanceNode[]
  summary: WorkspaceGovernanceSummary
}

export interface WorkspaceGovernanceExportResult {
  path: string
  format: WorkspaceGovernanceExportFormat
  generatedAt: string
  workspaceCount: number
  summary: WorkspaceGovernanceSummary
}

export interface WorkspaceReleaseEvidenceManifest {
  generatedAt: string
  projectPath: string
  governanceGeneratedAt: string
  summary: WorkspaceGovernanceSummary
  workspaces: WorkspaceReleaseEvidenceWorkspace[]
}

export interface WorkspaceReleaseEvidenceWorkspace {
  workspace: WorkspaceNode
  status: WorkspaceGovernanceStatus
  score: number
  managers: DependencyManagerId[]
  manifests: string[]
  lockfiles: string[]
  configs: string[]
  components: SupplyChainReport['components']
  componentError?: string
  snapshots: {
    source: WorkspaceSnapshotSource
    count: number
    latest?: SnapshotSummary
    path?: string
    coveredFileCount: number
    coveredFiles: string[]
    error?: string
  }
  operations: {
    recentCount: number
    failedCount: number
    failed: Array<Pick<OperationHistoryRecord, 'id' | 'command' | 'status' | 'finishedAt' | 'summary'>>
    error?: string
  }
  policy: {
    source: WorkspacePolicySource
    path?: string
    violationCount: number
    highSeverityViolationCount: number
  }
  readiness: {
    status: ReadinessGateStatus
    score: number
    policySource: WorkspaceReadinessPolicySource
    policyPath?: string
    blockedChecks: WorkspaceReadinessCheckSummary[]
    warningChecks: WorkspaceReadinessCheckSummary[]
  }
  ciEvidence: {
    source: WorkspaceCiEvidenceSource
    path?: string
    count: number
    latestStatus?: CiEvidenceStatus
    latestFinishedAt?: string
  }
  releaseApprovals: {
    source: WorkspaceReleaseApprovalSource
    path?: string
    count: number
    activeCount: number
    latestDecision?: ReleaseApprovalDecision
  }
  releaseExceptions: {
    source: WorkspaceReleaseExceptionSource
    path?: string
    count: number
    activeCount: number
    latestDecision?: ReleaseExceptionDecision
  }
  findings: WorkspaceGovernanceFinding[]
}

export interface WorkspaceReleaseEvidenceExportResult {
  path: string
  format: WorkspaceReleaseEvidenceExportFormat
  generatedAt: string
  workspaceCount: number
  summary: WorkspaceGovernanceSummary
}

export interface RemediationPlanItem {
  id: string
  scope: RemediationPlanItemScope
  source: RemediationPlanItemSource
  priority: RemediationPlanPriority
  title: string
  status: string
  summary: string
  recommendation: string
  evidence: string[]
  workspaceId?: string
  workspaceName?: string
  workspacePath?: string
  workspaceRelativePath?: string
  managers?: DependencyManagerId[]
}

export interface WorkspaceRemediationPlanSummary {
  itemCount: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
  projectItemCount: number
  workspaceItemCount: number
  releaseRiskItemCount: number
  deploymentItemCount: number
  affectedWorkspaceCount: number
  blockedWorkspaceCount: number
  warningWorkspaceCount: number
  activeReleaseExceptionCount: number
}

export interface WorkspaceRemediationPlan {
  generatedAt: string
  projectPath: string
  readinessGeneratedAt?: string
  governanceGeneratedAt?: string
  releaseRiskGeneratedAt?: string
  summary: WorkspaceRemediationPlanSummary
  items: RemediationPlanItem[]
}

export interface WorkspaceRemediationPlanExportResult {
  path: string
  format: WorkspaceRemediationPlanExportFormat
  generatedAt: string
  itemCount: number
  summary: WorkspaceRemediationPlanSummary
}

export interface WorkspaceUpdatePlanCommand {
  stage: WorkspaceUpdatePlanCommandStage
  command: string
  mutating: boolean
  dryRunCommand?: string
  purpose: string
}

export interface WorkspaceUpdatePlanItem {
  id: string
  workspaceId: string
  workspaceName: string
  workspacePath: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  managerName: string
  ecosystem: string
  tool: string
  status: WorkspaceUpdatePlanItemStatus
  risk: WorkspaceUpdatePlanRisk
  componentCount: number
  manifestFiles: string[]
  lockFiles: string[]
  missingLockfile: boolean
  snapshotSource: WorkspaceSnapshotSource
  snapshotCount: number
  readinessStatus: ReadinessGateStatus
  readinessBlockedCheckCount: number
  readinessWarningCheckCount: number
  policySource: WorkspacePolicySource
  recentOperationCount: number
  failedOperationCount: number
  releaseExceptionCount: number
  commands: WorkspaceUpdatePlanCommand[]
  warnings: string[]
  evidence: string[]
  recommendation: string
}

export interface WorkspaceUpdatePlanSummary {
  itemCount: number
  workspaceCount: number
  managerCount: number
  blocked: number
  needsReview: number
  ready: number
  highRisk: number
  mediumRisk: number
  missingLockfile: number
  missingSnapshot: number
  mutatingCommandCount: number
  dryRunCommandCount: number
  auditCommandCount: number
  lockCommandCount: number
}

export interface WorkspaceUpdatePlan {
  generatedAt: string
  projectPath: string
  governanceGeneratedAt: string
  summary: WorkspaceUpdatePlanSummary
  items: WorkspaceUpdatePlanItem[]
}

export interface WorkspaceUpdatePlanExportResult {
  path: string
  format: WorkspaceUpdatePlanExportFormat
  generatedAt: string
  itemCount: number
  summary: WorkspaceUpdatePlanSummary
}

export interface WorkspaceSbomArtifact {
  workspaceId: string
  workspaceName: string
  relativePath: string
  status: WorkspaceGovernanceStatus
  managers: DependencyManagerId[]
  path: string
  format: WorkspaceSbomExportFormat
  componentCount: number
}

export interface WorkspaceSbomManifest {
  generatedAt: string
  projectPath: string
  format: WorkspaceSbomExportFormat
  workspaceCount: number
  componentCount: number
  artifacts: WorkspaceSbomArtifact[]
}

export interface WorkspaceSbomExportResult {
  path: string
  format: WorkspaceSbomExportFormat
  generatedAt: string
  workspaceCount: number
  componentCount: number
  artifacts: WorkspaceSbomArtifact[]
}

export interface ReleaseBundleArtifact {
  id: string
  kind: ReleaseBundleArtifactKind
  label: string
  format: string
  path?: string
  ok: boolean
  required: boolean
  sha256?: string
  sizeBytes?: number
  workspaceCount?: number
  componentCount?: number
  count?: number
  status?: string
  error?: string
}

export interface ReleaseBundleManifest {
  generatedAt: string
  projectPath: string
  status: ReadinessGateStatus
  score: number
  summary: {
    workspaceCount: number
    readyWorkspaces: number
    warningWorkspaces: number
    blockedWorkspaces: number
    componentCount: number
    artifactCount: number
    failedArtifactCount: number
    requiredArtifactCount: number
    requiredFailedArtifactCount: number
    optionalFailedArtifactCount: number
  }
  artifacts: ReleaseBundleArtifact[]
}

export interface ReleaseBundleExportResult {
  path: string
  markdownPath: string
  generatedAt: string
  status: ReadinessGateStatus
  score: number
  artifactCount: number
  failedArtifactCount: number
  summary: ReleaseBundleManifest['summary']
}

export interface ReleaseDashboardExportResult {
  path: string
  bundleManifestPath: string
  markdownPath: string
  generatedAt: string
  status: ReadinessGateStatus
  score: number
  artifactCount: number
  failedArtifactCount: number
  summary: ReleaseBundleManifest['summary']
}

export interface WorkspaceGovernanceDependencies {
  workspaceDiscoveryService?: WorkspaceDiscoveryService
  supplyChainService?: SupplyChainService
  readinessGateService?: ReadinessGateService
  releaseApprovalService?: ReleaseApprovalService
  releaseExceptionService?: ReleaseExceptionService
  ciEvidenceService?: CiEvidenceService
  auditEvidenceService?: AuditEvidenceService
  vulnerabilityRemediationPlanService?: VulnerabilityRemediationPlanService
  registryReachabilityService?: RegistryReachabilityService
  credentialUsageService?: CredentialUsageService
  lockfileDriftService?: LockfileDriftService
  runtimePinningService?: RuntimePinningService
  offlineCacheReadinessService?: OfflineCacheReadinessService
  releaseRiskProfileService?: ReleaseRiskProfileService
  ciIntegrationPlanService?: CiIntegrationPlanService
  dependencyAutomationPlanService?: DependencyAutomationPlanService
  credentialRotationPlanService?: CredentialRotationPlanService
  automationSafetyPlanService?: AutomationSafetyPlanService
  dependencyOwnershipPlanService?: DependencyOwnershipPlanService
  policyAsCodePackService?: PolicyAsCodePackService
  thirdPartyNoticesService?: ThirdPartyNoticesService
  releaseProvenanceAttestationService?: ReleaseProvenanceAttestationService
  listHistory?: (cwd: string, limit?: number) => Promise<OperationHistoryRecord[]>
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

interface PolicyContext {
  source: WorkspacePolicySource
  path?: string
  policy?: DependencyPolicy
}

interface ReadinessPolicyContext {
  source: WorkspaceReadinessPolicySource
  path: string
  policy: ReadinessPolicy
}

interface ReleaseApprovalContext {
  source: WorkspaceReleaseApprovalSource
  path?: string
  report?: ReleaseApprovalReport
}

interface CiEvidenceContext {
  source: WorkspaceCiEvidenceSource
  path?: string
  report?: CiEvidenceReport
}

interface AuditEvidenceContext {
  source: WorkspaceAuditEvidenceSource
  path?: string
  report?: AuditEvidenceReport
}

interface ReleaseExceptionContext {
  source: WorkspaceReleaseExceptionSource
  path?: string
  report?: ReleaseExceptionReport
}

interface SnapshotContext {
  source: WorkspaceSnapshotSource
  snapshots: SnapshotSummary[]
  path?: string
  coveredFiles: string[]
}

interface RootSnapshotContext {
  snapshots: SnapshotSummary[]
  filesBySnapshotId: Map<string, string[]>
}

const REPORT_DIR = '.npmDesktopManager/reports'
const DEPENDENCY_POLICY_FILE = '.npmDesktopManager/dependency-policy.json'
const READINESS_POLICY_FILE = '.npmDesktopManager/readiness-policy.json'
const CI_EVIDENCE_FILE = '.npmDesktopManager/ci/ci-evidence.json'
const AUDIT_EVIDENCE_FILE = '.npmDesktopManager/audits/audit-evidence.json'
const RELEASE_APPROVAL_FILE = '.npmDesktopManager/approvals/release-approvals.json'
const RELEASE_EXCEPTION_FILE = '.npmDesktopManager/exceptions/release-exceptions.json'
const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))

export class WorkspaceGovernanceService {
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService
  private readonly supplyChainService: SupplyChainService
  private readonly readinessGateService: ReadinessGateService
  private readonly releaseApprovalService: ReleaseApprovalService
  private readonly releaseExceptionService: ReleaseExceptionService
  private readonly ciEvidenceService: CiEvidenceService
  private readonly auditEvidenceService: AuditEvidenceService
  private readonly vulnerabilityRemediationPlanService: VulnerabilityRemediationPlanService
  private readonly registryReachabilityService: RegistryReachabilityService
  private readonly credentialUsageService: CredentialUsageService
  private readonly lockfileDriftService: LockfileDriftService
  private readonly runtimePinningService: RuntimePinningService
  private readonly offlineCacheReadinessService: OfflineCacheReadinessService
  private readonly releaseRiskProfileService: ReleaseRiskProfileService
  private readonly ciIntegrationPlanService: CiIntegrationPlanService
  private readonly dependencyAutomationPlanService: DependencyAutomationPlanService
  private readonly credentialRotationPlanService: CredentialRotationPlanService
  private readonly automationSafetyPlanService: AutomationSafetyPlanService
  private readonly dependencyOwnershipPlanService: DependencyOwnershipPlanService
  private readonly policyAsCodePackService: PolicyAsCodePackService
  private readonly thirdPartyNoticesService: ThirdPartyNoticesService
  private readonly releaseProvenanceAttestationService: ReleaseProvenanceAttestationService
  private readonly historyReader: (cwd: string, limit?: number) => Promise<OperationHistoryRecord[]>

  constructor(dependencies: WorkspaceGovernanceDependencies = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.supplyChainService = dependencies.supplyChainService || new SupplyChainService()
    this.auditEvidenceService = dependencies.auditEvidenceService || new AuditEvidenceService()
    this.readinessGateService = dependencies.readinessGateService || new ReadinessGateService({
      supplyChainService: this.supplyChainService,
      auditEvidenceService: this.auditEvidenceService,
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.releaseApprovalService = dependencies.releaseApprovalService || new ReleaseApprovalService()
    this.releaseExceptionService = dependencies.releaseExceptionService || new ReleaseExceptionService()
    this.ciEvidenceService = dependencies.ciEvidenceService || new CiEvidenceService()
    this.vulnerabilityRemediationPlanService = dependencies.vulnerabilityRemediationPlanService || new VulnerabilityRemediationPlanService({
      auditEvidenceService: this.auditEvidenceService
    })
    this.registryReachabilityService = dependencies.registryReachabilityService || new RegistryReachabilityService()
    this.credentialUsageService = dependencies.credentialUsageService || new CredentialUsageService({
      registryReachabilityService: this.registryReachabilityService
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
      supplyChainService: this.supplyChainService,
      readinessGateService: this.readinessGateService,
      registryReachabilityService: this.registryReachabilityService,
      credentialUsageService: this.credentialUsageService,
      workspaceDiscoveryService: this.workspaceDiscoveryService,
      lockfileDriftService: this.lockfileDriftService,
      runtimePinningService: this.runtimePinningService,
      offlineCacheReadinessService: this.offlineCacheReadinessService,
      auditEvidenceService: this.auditEvidenceService
    })
    this.ciIntegrationPlanService = dependencies.ciIntegrationPlanService || new CiIntegrationPlanService({
      workspaceDiscoveryService: this.workspaceDiscoveryService,
      readinessGateService: this.readinessGateService,
      lockfileDriftService: this.lockfileDriftService,
      runtimePinningService: this.runtimePinningService,
      offlineCacheReadinessService: this.offlineCacheReadinessService,
      releaseRiskProfileService: this.releaseRiskProfileService
    })
    this.dependencyAutomationPlanService = dependencies.dependencyAutomationPlanService || new DependencyAutomationPlanService({
      workspaceDiscoveryService: this.workspaceDiscoveryService,
      lockfileDriftService: this.lockfileDriftService
    })
    this.credentialRotationPlanService = dependencies.credentialRotationPlanService || new CredentialRotationPlanService({
      credentialUsageService: this.credentialUsageService,
      dependencyAutomationPlanService: this.dependencyAutomationPlanService
    })
    this.automationSafetyPlanService = dependencies.automationSafetyPlanService || new AutomationSafetyPlanService({
      dependencyAutomationPlanService: this.dependencyAutomationPlanService,
      credentialRotationPlanService: this.credentialRotationPlanService,
      readinessGateService: this.readinessGateService,
      releaseRiskProfileService: this.releaseRiskProfileService
    })
    this.dependencyOwnershipPlanService = dependencies.dependencyOwnershipPlanService || new DependencyOwnershipPlanService({
      workspaceDiscoveryService: this.workspaceDiscoveryService,
      dependencyAutomationPlanService: this.dependencyAutomationPlanService,
      automationSafetyPlanService: this.automationSafetyPlanService
    })
    this.policyAsCodePackService = dependencies.policyAsCodePackService || new PolicyAsCodePackService({
      supplyChainService: this.supplyChainService,
      readinessGateService: this.readinessGateService,
      dependencyAutomationPlanService: this.dependencyAutomationPlanService,
      automationSafetyPlanService: this.automationSafetyPlanService,
      dependencyOwnershipPlanService: this.dependencyOwnershipPlanService,
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.thirdPartyNoticesService = dependencies.thirdPartyNoticesService || new ThirdPartyNoticesService({
      supplyChainService: this.supplyChainService
    })
    this.releaseProvenanceAttestationService = dependencies.releaseProvenanceAttestationService || new ReleaseProvenanceAttestationService()
    this.historyReader = dependencies.listHistory || listOperationHistory
  }

  async report(projectPath: string): Promise<WorkspaceGovernanceReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const discovery = await this.workspaceDiscoveryService.report(root)
    const rootSnapshots = await this.rootSnapshotContext(root)
    const rootPolicy = await this.rootPolicyContext(root)
    const rootReadinessPolicy = await this.rootReadinessPolicyContext(root)
    const rootCiEvidence = await this.rootCiEvidenceContext(root)
    const rootAuditEvidence = await this.rootAuditEvidenceContext(root)
    const rootReleaseApproval = await this.rootReleaseApprovalContext(root)
    const rootReleaseException = await this.rootReleaseExceptionContext(root)
    const workspaces = await Promise.all(discovery.workspaces.map((workspace) => (
      this.inspectWorkspace(root, workspace, rootSnapshots, rootPolicy, rootReadinessPolicy, rootCiEvidence, rootAuditEvidence, rootReleaseApproval, rootReleaseException)
    )))

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      discovery,
      workspaces,
      summary: summarize(workspaces)
    }
  }

  async exportMarkdown(projectPath: string): Promise<WorkspaceGovernanceExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-governance-report.md')
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

  async exportJson(projectPath: string): Promise<WorkspaceGovernanceExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-governance-report.json')
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

  async evidenceManifest(projectPath: string): Promise<WorkspaceReleaseEvidenceManifest> {
    const governance = await this.report(projectPath)
    const workspaces = await Promise.all(governance.workspaces.map((node) => this.workspaceEvidence(node)))

    return {
      generatedAt: new Date().toISOString(),
      projectPath: governance.projectPath,
      governanceGeneratedAt: governance.generatedAt,
      summary: governance.summary,
      workspaces
    }
  }

  async exportEvidenceMarkdown(projectPath: string): Promise<WorkspaceReleaseEvidenceExportResult> {
    const manifest = await this.evidenceManifest(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-release-evidence.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderEvidenceMarkdown(manifest), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: manifest.generatedAt,
      workspaceCount: manifest.workspaces.length,
      summary: manifest.summary
    }
  }

  async exportEvidenceJson(projectPath: string): Promise<WorkspaceReleaseEvidenceExportResult> {
    const manifest = await this.evidenceManifest(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-release-evidence.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(manifest, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: manifest.generatedAt,
      workspaceCount: manifest.workspaces.length,
      summary: manifest.summary
    }
  }

  async remediationPlan(projectPath: string): Promise<WorkspaceRemediationPlan> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const [readinessResult, governanceResult, releaseRiskResult] = await Promise.all([
      capture(() => this.readinessGateService.report(root)),
      capture(() => this.report(root)),
      capture(() => this.releaseRiskProfileService.report(root))
    ])
    const items: RemediationPlanItem[] = []

    if (readinessResult.error) {
      items.push(remediationItem({
        id: 'project:readiness-report',
        scope: 'project',
        source: 'export-error',
        priority: 'high',
        title: 'Project readiness report',
        status: 'error',
        summary: 'Project readiness could not be evaluated.',
        recommendation: 'Repair unreadable readiness policy or evidence files, then rerun the readiness gate.',
        evidence: [readinessResult.error]
      }))
    } else if (readinessResult.value) {
      for (const check of readinessResult.value.checks) {
        if (check.status !== 'blocked' && check.status !== 'warning') continue
        items.push(remediationItem({
          id: `project:${check.id}`,
          scope: 'project',
          source: 'readiness',
          priority: readinessCheckPriority(check),
          title: check.title,
          status: check.status,
          summary: check.summary,
          recommendation: check.recommendation,
          evidence: check.evidence
        }))
      }
    }

    if (governanceResult.error) {
      items.push(remediationItem({
        id: 'workspace:governance-report',
        scope: 'workspace',
        source: 'export-error',
        priority: 'high',
        title: 'Workspace governance report',
        status: 'error',
        summary: 'Workspace governance could not be evaluated.',
        recommendation: 'Repair workspace discovery or governance evidence files, then rerun workspace governance.',
        evidence: [governanceResult.error]
      }))
    } else if (governanceResult.value) {
      for (const node of governanceResult.value.workspaces) {
        for (const finding of node.findings) {
          if (finding.severity !== 'blocked' && finding.severity !== 'warning') continue
          items.push(remediationItem({
            id: `workspace:${node.workspace.id}:finding:${finding.id}:${items.length + 1}`,
            scope: 'workspace',
            source: 'workspace-governance',
            priority: governanceFindingPriority(finding),
            title: finding.title,
            status: finding.severity,
            summary: finding.summary,
            recommendation: finding.recommendation,
            evidence: finding.evidence,
            workspaceId: node.workspace.id,
            workspaceName: node.workspace.name,
            workspacePath: node.workspace.path,
            workspaceRelativePath: node.workspace.relativePath,
            managers: node.workspace.managerIds
          }))
        }

        for (const check of [...node.readinessBlockedChecks, ...node.readinessWarningChecks]) {
          items.push(remediationItem({
            id: `workspace:${node.workspace.id}:readiness:${check.id}`,
            scope: 'workspace',
            source: 'workspace-readiness',
            priority: readinessCheckPriority(check),
            title: check.title,
            status: check.status,
            summary: check.summary,
            recommendation: check.recommendation,
            evidence: check.evidence,
            workspaceId: node.workspace.id,
            workspaceName: node.workspace.name,
            workspacePath: node.workspace.path,
            workspaceRelativePath: node.workspace.relativePath,
            managers: node.workspace.managerIds
          }))
        }
      }
    }

    if (releaseRiskResult.error) {
      items.push(remediationItem({
        id: 'project:release-risk-profile',
        scope: 'project',
        source: 'export-error',
        priority: 'high',
        title: 'Release risk profile',
        status: 'error',
        summary: 'Release risk profile could not be evaluated.',
        recommendation: 'Repair release evidence sources, then rerun the release risk profile before approving dependency or deployment changes.',
        evidence: [releaseRiskResult.error]
      }))
    } else if (releaseRiskResult.value) {
      for (const risk of releaseRiskRemediationFindings(releaseRiskResult.value)) {
        items.push(remediationItem({
          id: `project:release-risk:${risk.id}`,
          scope: 'project',
          source: 'release-risk',
          priority: releaseRiskFindingPriority(risk),
          title: risk.title,
          status: risk.severity,
          summary: risk.summary,
          recommendation: risk.recommendation,
          evidence: [
            `Category: ${risk.category}`,
            `Source: ${risk.source}`,
            ...risk.evidence
          ],
          managers: risk.managerId ? [risk.managerId] : undefined
        }))
      }
    }

    const sortedItems = sortRemediationItems(dedupeRemediationItems(items))
    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      readinessGeneratedAt: readinessResult.value?.generatedAt,
      governanceGeneratedAt: governanceResult.value?.generatedAt,
      releaseRiskGeneratedAt: releaseRiskResult.value?.generatedAt,
      summary: summarizeRemediationPlan(sortedItems, governanceResult.value),
      items: sortedItems
    }
  }

  async exportRemediationMarkdown(projectPath: string): Promise<WorkspaceRemediationPlanExportResult> {
    const plan = await this.remediationPlan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-remediation-plan.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderRemediationPlanMarkdown(plan), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: plan.generatedAt,
      itemCount: plan.items.length,
      summary: plan.summary
    }
  }

  async exportRemediationJson(projectPath: string): Promise<WorkspaceRemediationPlanExportResult> {
    const plan = await this.remediationPlan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-remediation-plan.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(plan, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: plan.generatedAt,
      itemCount: plan.items.length,
      summary: plan.summary
    }
  }

  async updatePlan(projectPath: string): Promise<WorkspaceUpdatePlan> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const governance = await this.report(projectPath)
    const items = governance.workspaces.flatMap((node) => (
      node.workspace.managerIds.map((managerId) => updatePlanItem(node, managerId))
    ))

    return {
      generatedAt: new Date().toISOString(),
      projectPath: governance.projectPath,
      governanceGeneratedAt: governance.generatedAt,
      summary: summarizeUpdatePlan(items),
      items: sortUpdatePlanItems(items)
    }
  }

  async exportUpdatePlanMarkdown(projectPath: string): Promise<WorkspaceUpdatePlanExportResult> {
    const plan = await this.updatePlan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-update-plan.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderUpdatePlanMarkdown(plan), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: plan.generatedAt,
      itemCount: plan.items.length,
      summary: plan.summary
    }
  }

  async exportUpdatePlanJson(projectPath: string): Promise<WorkspaceUpdatePlanExportResult> {
    const plan = await this.updatePlan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'workspace-update-plan.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(plan, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: plan.generatedAt,
      itemCount: plan.items.length,
      summary: plan.summary
    }
  }

  async exportWorkspaceSboms(projectPath: string, format: WorkspaceSbomExportFormat): Promise<WorkspaceSbomExportResult> {
    if (format !== 'cyclonedx' && format !== 'spdx') {
      throw new Error(`Unsupported workspace SBOM format: ${format}`)
    }

    const governance = await this.report(projectPath)
    const root = resolve(projectPath)
    const outputDir = join(root, REPORT_DIR, 'workspace-sboms', format)
    await mkdir(outputDir, { recursive: true })

    const artifacts: WorkspaceSbomArtifact[] = []
    for (const node of governance.workspaces) {
      const report = await this.supplyChainService.report(node.workspace.path)
      const fileName = `${workspaceArtifactName(node.workspace)}.${format === 'cyclonedx' ? 'cdx.json' : 'spdx.json'}`
      const path = join(outputDir, fileName)
      const payload = format === 'cyclonedx'
        ? renderWorkspaceCycloneDx(report, node)
        : renderWorkspaceSpdx(report, node)
      await writeFile(path, JSON.stringify(payload, null, 2), 'utf-8')
      artifacts.push({
        workspaceId: node.workspace.id,
        workspaceName: node.workspace.name,
        relativePath: node.workspace.relativePath,
        status: node.status,
        managers: node.workspace.managerIds,
        path,
        format,
        componentCount: report.componentCount
      })
    }

    const manifest: WorkspaceSbomManifest = {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      format,
      workspaceCount: artifacts.length,
      componentCount: sum(artifacts.map((artifact) => artifact.componentCount)),
      artifacts
    }
    const manifestPath = join(outputDir, 'manifest.json')
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    return {
      path: manifestPath,
      format,
      generatedAt: manifest.generatedAt,
      workspaceCount: manifest.workspaceCount,
      componentCount: manifest.componentCount,
      artifacts
    }
  }

  async exportReleaseBundle(projectPath: string): Promise<ReleaseBundleExportResult> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const generatedAt = new Date().toISOString()
    const governance = await this.report(root)
    const readinessResult = await capture(() => this.readinessGateService.report(root))
    const readinessStatus = readinessResult.value?.status || statusFromGovernanceSummary(governance.summary)
    const readinessScore = readinessResult.value?.score ?? (
      governance.summary.ready > 0
        ? Math.max(0, 100 - (governance.summary.blocked * 30) - (governance.summary.warning * 10))
        : 0
    )
    const artifacts: ReleaseBundleArtifact[] = []

    await this.addBundleArtifact(artifacts, 'readiness', 'Readiness report', 'markdown', true, () => this.readinessGateService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'readiness', 'Readiness report', 'json', true, () => this.readinessGateService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'workspace-discovery', 'Workspace discovery', 'markdown', true, () => this.workspaceDiscoveryService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'workspace-discovery', 'Workspace discovery', 'json', true, () => this.workspaceDiscoveryService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'workspace-governance', 'Workspace governance', 'markdown', true, () => this.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'workspace-governance', 'Workspace governance', 'json', true, () => this.exportJson(root))
    await this.addBundleArtifact(artifacts, 'workspace-release-evidence', 'Workspace release evidence', 'markdown', true, () => this.exportEvidenceMarkdown(root))
    await this.addBundleArtifact(artifacts, 'workspace-release-evidence', 'Workspace release evidence', 'json', true, () => this.exportEvidenceJson(root))
    await this.addBundleArtifact(artifacts, 'remediation-plan', 'Remediation plan', 'markdown', true, () => this.exportRemediationMarkdown(root))
    await this.addBundleArtifact(artifacts, 'remediation-plan', 'Remediation plan', 'json', true, () => this.exportRemediationJson(root))
    await this.addBundleArtifact(artifacts, 'update-plan', 'Workspace dependency update plan', 'markdown', true, () => this.exportUpdatePlanMarkdown(root))
    await this.addBundleArtifact(artifacts, 'update-plan', 'Workspace dependency update plan', 'json', true, () => this.exportUpdatePlanJson(root))
    await this.addBundleArtifact(artifacts, 'workspace-sbom', 'Workspace CycloneDX SBOMs', 'cyclonedx', true, () => this.exportWorkspaceSboms(root, 'cyclonedx'))
    await this.addBundleArtifact(artifacts, 'workspace-sbom', 'Workspace SPDX SBOMs', 'spdx', true, () => this.exportWorkspaceSboms(root, 'spdx'))
    await this.addBundleArtifact(artifacts, 'root-sbom', 'Root CycloneDX SBOM', 'cyclonedx', true, () => this.supplyChainService.exportCycloneDx(root))
    await this.addBundleArtifact(artifacts, 'root-sbom', 'Root SPDX SBOM', 'spdx', true, () => this.supplyChainService.exportSpdx(root))
    await this.addBundleArtifact(artifacts, 'root-sbom', 'Root dependency report', 'markdown', true, () => this.supplyChainService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'license-compliance', 'License compliance matrix', 'markdown', true, () => this.supplyChainService.exportLicenseMarkdown(root))
    await this.addBundleArtifact(artifacts, 'license-compliance', 'License compliance matrix', 'json', true, () => this.supplyChainService.exportLicenseJson(root))
    await this.addBundleArtifact(artifacts, 'third-party-notices', 'Third-party notices', 'text', true, () => this.thirdPartyNoticesService.exportText(root))
    await this.addBundleArtifact(artifacts, 'third-party-notices', 'Third-party notices', 'markdown', true, () => this.thirdPartyNoticesService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'third-party-notices', 'Third-party notices', 'json', true, () => this.thirdPartyNoticesService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'dependency-diff', 'Dependency risk diff', 'markdown', false, () => this.supplyChainService.exportDependencyDiffMarkdown(root))
    await this.addBundleArtifact(artifacts, 'operation-history', 'Operation history', 'markdown', false, () => exportOperationHistory(root, 'markdown'))
    await this.addBundleArtifact(artifacts, 'operation-history', 'Operation history', 'json', false, () => exportOperationHistory(root, 'json'))
    await this.addBundleArtifact(artifacts, 'ci-evidence', 'CI evidence', 'markdown', false, () => this.ciEvidenceService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'ci-evidence', 'CI evidence', 'json', false, () => this.ciEvidenceService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'audit-evidence', 'Audit evidence', 'markdown', true, () => this.auditEvidenceService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'audit-evidence', 'Audit evidence', 'json', true, () => this.auditEvidenceService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'audit-evidence', 'Audit evidence dashboard', 'html', false, () => this.auditEvidenceService.exportHtml(root))
    await this.addBundleArtifact(artifacts, 'vulnerability-remediation-plan', 'Vulnerability remediation plan', 'markdown', true, () => this.vulnerabilityRemediationPlanService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'vulnerability-remediation-plan', 'Vulnerability remediation plan', 'json', true, () => this.vulnerabilityRemediationPlanService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'release-provenance-attestation', 'Release provenance attestation', 'markdown', true, () => this.releaseProvenanceAttestationService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'release-provenance-attestation', 'Release provenance attestation', 'json', true, () => this.releaseProvenanceAttestationService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'release-approval', 'Release approvals', 'markdown', false, () => this.releaseApprovalService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'release-approval', 'Release approvals', 'json', false, () => this.releaseApprovalService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'release-exception', 'Release exceptions', 'markdown', true, () => this.releaseExceptionService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'release-exception', 'Release exceptions', 'json', true, () => this.releaseExceptionService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'credential-usage', 'Credential usage map', 'markdown', true, () => this.credentialUsageService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'credential-usage', 'Credential usage map', 'json', true, () => this.credentialUsageService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'lockfile-drift', 'Lockfile drift report', 'markdown', true, () => this.lockfileDriftService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'lockfile-drift', 'Lockfile drift report', 'json', true, () => this.lockfileDriftService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'runtime-pinning', 'Runtime pinning report', 'markdown', true, () => this.runtimePinningService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'runtime-pinning', 'Runtime pinning report', 'json', true, () => this.runtimePinningService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'offline-cache-readiness', 'Offline cache readiness', 'markdown', true, () => this.offlineCacheReadinessService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'offline-cache-readiness', 'Offline cache readiness', 'json', true, () => this.offlineCacheReadinessService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'release-risk-profile', 'Release risk profile', 'markdown', true, () => this.releaseRiskProfileService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'release-risk-profile', 'Release risk profile', 'json', true, () => this.releaseRiskProfileService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'ci-integration-plan', 'CI integration plan', 'markdown', true, () => this.ciIntegrationPlanService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'ci-integration-plan', 'CI integration plan', 'json', true, () => this.ciIntegrationPlanService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'ci-integration-plan', 'GitHub Actions dependency governance workflow', 'github-actions', false, () => this.ciIntegrationPlanService.exportGithubActions(root))
    await this.addBundleArtifact(artifacts, 'dependency-automation-plan', 'Dependency automation plan', 'markdown', true, () => this.dependencyAutomationPlanService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'dependency-automation-plan', 'Dependency automation plan', 'json', true, () => this.dependencyAutomationPlanService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'dependency-automation-plan', 'Dependabot configuration', 'dependabot', false, () => this.dependencyAutomationPlanService.exportDependabot(root))
    await this.addBundleArtifact(artifacts, 'dependency-automation-plan', 'Renovate configuration', 'renovate', false, () => this.dependencyAutomationPlanService.exportRenovate(root))
    await this.addBundleArtifact(artifacts, 'credential-rotation-plan', 'Credential rotation plan', 'markdown', true, () => this.credentialRotationPlanService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'credential-rotation-plan', 'Credential rotation plan', 'json', true, () => this.credentialRotationPlanService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'automation-safety-plan', 'Automation safety plan', 'markdown', true, () => this.automationSafetyPlanService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'automation-safety-plan', 'Automation safety plan', 'json', true, () => this.automationSafetyPlanService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'dependency-ownership-plan', 'Dependency ownership plan', 'markdown', true, () => this.dependencyOwnershipPlanService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'dependency-ownership-plan', 'Dependency ownership plan', 'json', true, () => this.dependencyOwnershipPlanService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'dependency-ownership-plan', 'Suggested CODEOWNERS entries', 'codeowners', false, () => this.dependencyOwnershipPlanService.exportCodeowners(root))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-upgrade-playbook', 'Dependency upgrade playbook', 'json', false, join(REPORT_DIR, 'dependency-upgrade-playbook.json'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-rollback-plan', 'Dependency rollback plan', 'json', false, join(REPORT_DIR, 'dependency-rollback-plan.json'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-impact-analysis', 'Dependency impact analysis', 'json', false, join(REPORT_DIR, 'dependency-impact-analysis.json'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-change-approval-packet', 'Dependency change approval packet', 'json', false, join(REPORT_DIR, 'dependency-change-approval-packet.json'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-change-calendar', 'Dependency change calendar', 'json', false, join(REPORT_DIR, 'dependency-change-calendar.json'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-change-calendar', 'Dependency change calendar ICS', 'calendar', false, join(REPORT_DIR, 'dependency-change-calendar.ics'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-change-calendar', 'Dependency change freeze gate', 'github-actions', false, join(REPORT_DIR, 'ci', 'dependency-change-freeze-gate.yml'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-change-calendar', 'Dependency change ticket template', 'markdown', false, join(REPORT_DIR, 'dependency-change-ticket-template.md'))
    await this.addExistingBundleArtifact(artifacts, root, 'dependency-change-execution-record', 'Dependency change execution record', 'json', false, join(REPORT_DIR, 'dependency-change-execution-record.json'))
    await this.addBundleArtifact(artifacts, 'policy-as-code-pack', 'Policy-as-code pack', 'markdown', true, () => this.policyAsCodePackService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'policy-as-code-pack', 'Policy-as-code pack', 'json', true, () => this.policyAsCodePackService.exportJson(root))
    await this.addBundleArtifact(artifacts, 'policy-as-code-pack', 'Governance policy JSON', 'policy-json', false, () => this.policyAsCodePackService.exportPolicyJson(root))
    await this.addBundleArtifact(artifacts, 'policy-as-code-pack', 'Policy check GitHub Actions workflow', 'github-actions', false, () => this.policyAsCodePackService.exportGithubActions(root))
    await this.addBundleArtifact(artifacts, 'registry-reachability', 'Registry reachability', 'markdown', false, () => this.registryReachabilityService.exportMarkdown(root))
    await this.addBundleArtifact(artifacts, 'registry-reachability', 'Registry reachability', 'json', false, () => this.registryReachabilityService.exportJson(root))

    const failedArtifacts = artifacts.filter((artifact) => !artifact.ok)
    const requiredFailedArtifactCount = failedArtifacts.filter((artifact) => artifact.required).length
    const bundleStatus: ReadinessGateStatus = requiredFailedArtifactCount > 0 ? 'blocked' : readinessStatus
    const bundleScore = requiredFailedArtifactCount > 0 ? Math.min(readinessScore, 50) : readinessScore
    const manifest: ReleaseBundleManifest = {
      generatedAt,
      projectPath: root,
      status: bundleStatus,
      score: bundleScore,
      summary: {
        workspaceCount: governance.summary.workspaceCount,
        readyWorkspaces: governance.summary.ready,
        warningWorkspaces: governance.summary.warning,
        blockedWorkspaces: governance.summary.blocked,
        componentCount: governance.summary.componentCount,
        artifactCount: artifacts.length,
        failedArtifactCount: failedArtifacts.length,
        requiredArtifactCount: artifacts.filter((artifact) => artifact.required).length,
        requiredFailedArtifactCount,
        optionalFailedArtifactCount: failedArtifacts.length - requiredFailedArtifactCount
      },
      artifacts
    }
    const bundleDir = join(root, REPORT_DIR, 'release-bundle')
    await mkdir(bundleDir, { recursive: true })
    const manifestPath = join(bundleDir, 'release-bundle-manifest.json')
    const markdownPath = join(bundleDir, 'release-bundle.md')
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    await writeFile(markdownPath, renderReleaseBundleMarkdown(manifest), 'utf-8')

    return {
      path: manifestPath,
      markdownPath,
      generatedAt,
      status: manifest.status,
      score: manifest.score,
      artifactCount: manifest.summary.artifactCount,
      failedArtifactCount: manifest.summary.failedArtifactCount,
      summary: manifest.summary
    }
  }

  async exportReleaseDashboard(projectPath: string): Promise<ReleaseDashboardExportResult> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const bundle = await this.exportReleaseBundle(root)
    const manifest = JSON.parse(await readFile(bundle.path, 'utf-8')) as ReleaseBundleManifest
    const dashboardPath = join(root, REPORT_DIR, 'release-bundle', 'release-dashboard.html')
    await mkdir(dirname(dashboardPath), { recursive: true })
    await writeFile(dashboardPath, renderReleaseDashboardHtml(manifest), 'utf-8')

    return {
      path: dashboardPath,
      bundleManifestPath: bundle.path,
      markdownPath: bundle.markdownPath,
      generatedAt: manifest.generatedAt,
      status: manifest.status,
      score: manifest.score,
      artifactCount: manifest.summary.artifactCount,
      failedArtifactCount: manifest.summary.failedArtifactCount,
      summary: manifest.summary
    }
  }

  private async addBundleArtifact(
    artifacts: ReleaseBundleArtifact[],
    kind: ReleaseBundleArtifactKind,
    label: string,
    format: string,
    required: boolean,
    exportOperation: () => Promise<{ path: string; [key: string]: any }>
  ): Promise<void> {
    try {
      const result = await exportOperation()
      const metadata = await fileDigest(result.path)
      artifacts.push({
        id: releaseBundleArtifactId(kind, label, format),
        kind,
        label,
        format,
        path: result.path,
        ok: true,
        required,
        sha256: metadata.sha256,
        sizeBytes: metadata.sizeBytes,
        workspaceCount: numberOrUndefined(result.workspaceCount),
        componentCount: numberOrUndefined(result.componentCount),
        count: numberOrUndefined(result.count),
        status: typeof result.status === 'string' ? result.status : undefined
      })
    } catch (error: any) {
      artifacts.push({
        id: releaseBundleArtifactId(kind, label, format),
        kind,
        label,
        format,
        ok: false,
        required,
        error: error?.message || String(error)
      })
    }
  }

  private async addExistingBundleArtifact(
    artifacts: ReleaseBundleArtifact[],
    root: string,
    kind: ReleaseBundleArtifactKind,
    label: string,
    format: string,
    required: boolean,
    relativePath: string
  ): Promise<void> {
    const path = join(root, relativePath)
    try {
      await access(path)
      const metadata = await fileDigest(path)
      artifacts.push({
        id: releaseBundleArtifactId(kind, label, format),
        kind,
        label,
        format,
        path,
        ok: true,
        required,
        sha256: metadata.sha256,
        sizeBytes: metadata.sizeBytes
      })
    } catch (error: any) {
      artifacts.push({
        id: releaseBundleArtifactId(kind, label, format),
        kind,
        label,
        format,
        ok: false,
        required,
        error: `Existing evidence not found at ${relativePath}: ${error?.message || String(error)}`
      })
    }
  }

  private async workspaceEvidence(node: WorkspaceGovernanceNode): Promise<WorkspaceReleaseEvidenceWorkspace> {
    const [
      supplyChainResult,
      snapshotResult,
      historyResult
    ] = await Promise.all([
      capture(() => this.supplyChainService.report(node.workspace.path)),
      capture(() => this.supplyChainService.listSnapshots(node.workspace.path)),
      capture(() => this.historyReader(node.workspace.path, 80))
    ])
    const snapshots = snapshotResult.value || []
    const history = historyResult.value || []
    const failed = history.filter((record) => record.status === 'error')

    return {
      workspace: node.workspace,
      status: node.status,
      score: node.score,
      managers: node.workspace.managerIds,
      manifests: node.workspace.manifestFiles,
      lockfiles: node.workspace.lockFiles,
      configs: node.workspace.configFiles,
      components: supplyChainResult.value?.components || [],
      componentError: supplyChainResult.error,
      snapshots: {
        source: node.snapshotSource,
        count: node.snapshotCount,
        latest: latestSnapshot(snapshots),
        path: node.snapshotPath,
        coveredFileCount: node.snapshotCoveredFileCount,
        coveredFiles: node.snapshotCoveredFiles,
        error: snapshotResult.error
      },
      operations: {
        recentCount: history.length,
        failedCount: failed.length,
        failed: failed.slice(0, 10).map((record) => ({
          id: record.id,
          command: record.command,
          status: record.status,
          finishedAt: record.finishedAt,
          summary: record.summary
        })),
        error: historyResult.error
      },
      policy: {
        source: node.policySource,
        path: node.policyPath,
        violationCount: node.policyViolationCount,
        highSeverityViolationCount: node.highSeverityPolicyViolationCount
      },
      readiness: {
        status: node.readinessStatus,
        score: node.readinessScore,
        policySource: node.readinessPolicySource,
        policyPath: node.readinessPolicyPath,
        blockedChecks: node.readinessBlockedChecks,
        warningChecks: node.readinessWarningChecks
      },
      ciEvidence: {
        source: node.ciEvidenceSource,
        path: node.ciEvidencePath,
        count: node.ciEvidenceCount,
        latestStatus: node.latestCiStatus,
        latestFinishedAt: node.latestCiFinishedAt
      },
      releaseApprovals: {
        source: node.releaseApprovalSource,
        path: node.releaseApprovalPath,
        count: node.releaseApprovalCount,
        activeCount: node.activeReleaseApprovalCount,
        latestDecision: node.latestReleaseApprovalDecision
      },
      releaseExceptions: {
        source: node.releaseExceptionSource,
        path: node.releaseExceptionPath,
        count: node.releaseExceptionCount,
        activeCount: node.activeReleaseExceptionCount,
        latestDecision: node.latestReleaseExceptionDecision
      },
      findings: node.findings
    }
  }

  private async rootPolicyContext(root: string): Promise<PolicyContext | undefined> {
    if (!await exists(join(root, DEPENDENCY_POLICY_FILE))) return undefined
    const result = await capture(() => this.supplyChainService.getPolicy(root))
    if (!result.value) return undefined
    return {
      source: 'workspace',
      path: result.value.path,
      policy: result.value.policy
    }
  }

  private async rootReadinessPolicyContext(root: string): Promise<ReadinessPolicyContext | undefined> {
    if (!await exists(join(root, READINESS_POLICY_FILE))) return undefined
    const result = await capture(() => this.readinessGateService.getPolicy(root))
    if (!result.value) return undefined
    return {
      source: 'workspace',
      path: result.value.path,
      policy: result.value.policy
    }
  }

  private async rootSnapshotContext(root: string): Promise<RootSnapshotContext | undefined> {
    const result = await capture(() => this.supplyChainService.listSnapshots(root))
    const snapshots = result.value || []
    if (snapshots.length === 0) return undefined

    const filesBySnapshotId = new Map<string, string[]>()
    await Promise.all(snapshots.map(async (snapshot) => {
      filesBySnapshotId.set(snapshot.id, await snapshotFileList(snapshot.path))
    }))

    return { snapshots, filesBySnapshotId }
  }

  private async rootCiEvidenceContext(root: string): Promise<CiEvidenceContext | undefined> {
    const path = join(root, CI_EVIDENCE_FILE)
    if (!await exists(path)) return undefined
    const result = await capture(() => this.ciEvidenceService.report(root))
    if (!result.value || result.value.records.length === 0) return undefined
    return {
      source: 'workspace',
      path,
      report: result.value
    }
  }

  private async rootAuditEvidenceContext(root: string): Promise<AuditEvidenceContext | undefined> {
    const path = join(root, AUDIT_EVIDENCE_FILE)
    if (!await exists(path)) return undefined
    const result = await capture(() => this.auditEvidenceService.report(root))
    if (!result.value || result.value.summary.sourceCount === 0) return undefined
    return {
      source: 'workspace',
      path,
      report: result.value
    }
  }

  private async rootReleaseApprovalContext(root: string): Promise<ReleaseApprovalContext | undefined> {
    const path = join(root, RELEASE_APPROVAL_FILE)
    if (!await exists(path)) return undefined
    const result = await capture(() => this.releaseApprovalService.report(root))
    if (!result.value || result.value.records.length === 0) return undefined
    return {
      source: 'workspace',
      path,
      report: result.value
    }
  }

  private async rootReleaseExceptionContext(root: string): Promise<ReleaseExceptionContext | undefined> {
    const path = join(root, RELEASE_EXCEPTION_FILE)
    if (!await exists(path)) return undefined
    const result = await capture(() => this.releaseExceptionService.report(root))
    if (!result.value || result.value.records.length === 0) return undefined
    return {
      source: 'workspace',
      path,
      report: result.value
    }
  }

  private async inspectWorkspace(
    root: string,
    workspace: WorkspaceNode,
    rootSnapshots: RootSnapshotContext | undefined,
    rootPolicy: PolicyContext | undefined,
    rootReadinessPolicy: ReadinessPolicyContext | undefined,
    rootCiEvidence: CiEvidenceContext | undefined,
    rootAuditEvidence: AuditEvidenceContext | undefined,
    rootReleaseApproval: ReleaseApprovalContext | undefined,
    rootReleaseException: ReleaseExceptionContext | undefined
  ): Promise<WorkspaceGovernanceNode> {
    const policyExists = await exists(join(workspace.path, DEPENDENCY_POLICY_FILE))
    const readinessPolicyExists = await exists(join(workspace.path, READINESS_POLICY_FILE))
    const ciEvidenceExists = await exists(join(workspace.path, CI_EVIDENCE_FILE))
    const auditEvidenceExists = await exists(join(workspace.path, AUDIT_EVIDENCE_FILE))
    const releaseApprovalExists = await exists(join(workspace.path, RELEASE_APPROVAL_FILE))
    const releaseExceptionExists = await exists(join(workspace.path, RELEASE_EXCEPTION_FILE))
    const policyContext: PolicyContext = policyExists
      ? { source: 'workspace' as const, path: join(workspace.path, DEPENDENCY_POLICY_FILE) }
      : rootPolicy && workspace.path !== root
        ? {
            source: 'inherited-root' as const,
            path: rootPolicy.path,
            policy: rootPolicy.policy
          }
        : { source: 'none' as const }
    const readinessPolicyContext: ReadinessPolicyContext = readinessPolicyExists
      ? {
          source: 'workspace',
          path: join(workspace.path, READINESS_POLICY_FILE),
          policy: (await this.readinessGateService.getPolicy(workspace.path)).policy
        }
      : rootReadinessPolicy && workspace.path !== root
        ? {
            source: 'inherited-root',
            path: rootReadinessPolicy.path,
            policy: rootReadinessPolicy.policy
          }
        : {
            source: 'default',
            path: 'default readiness policy',
            policy: DEFAULT_READINESS_POLICY
          }
    const ciEvidenceContext: CiEvidenceContext = ciEvidenceExists
      ? {
          source: 'workspace',
          path: join(workspace.path, CI_EVIDENCE_FILE)
        }
      : rootCiEvidence && workspace.path !== root
        ? {
            source: 'inherited-root',
            path: rootCiEvidence.path,
            report: rootCiEvidence.report
          }
        : { source: 'none' }
    const auditEvidenceContext: AuditEvidenceContext = auditEvidenceExists
      ? {
          source: 'workspace',
          path: join(workspace.path, AUDIT_EVIDENCE_FILE)
        }
      : rootAuditEvidence && workspace.path !== root
        ? {
            source: 'inherited-root',
            path: rootAuditEvidence.path,
            report: rootAuditEvidence.report
          }
        : { source: 'none' }
    const releaseApprovalContext: ReleaseApprovalContext = releaseApprovalExists
      ? {
          source: 'workspace',
          path: join(workspace.path, RELEASE_APPROVAL_FILE)
        }
      : rootReleaseApproval && workspace.path !== root
        ? {
            source: 'inherited-root',
            path: rootReleaseApproval.path,
            report: rootReleaseApproval.report
          }
        : { source: 'none' }
    const releaseExceptionContext: ReleaseExceptionContext = releaseExceptionExists
      ? {
          source: 'workspace',
          path: join(workspace.path, RELEASE_EXCEPTION_FILE)
        }
      : rootReleaseException && workspace.path !== root
        ? {
            source: 'inherited-root',
            path: rootReleaseException.path,
            report: rootReleaseException.report
          }
        : { source: 'none' }
    const [
      supplyChainResult,
      snapshotResult,
      historyResult,
      policyResult,
      ciEvidenceResult,
      releaseApprovalResult,
      releaseExceptionResult
    ] = await Promise.all([
      capture(() => this.supplyChainService.report(workspace.path)),
      capture(() => this.supplyChainService.listSnapshots(workspace.path)),
      capture(() => this.historyReader(workspace.path, 80)),
      policyExists
        ? capture(() => this.supplyChainService.evaluatePolicy(workspace.path))
        : policyContext.source === 'inherited-root' && policyContext.policy
          ? capture(() => this.supplyChainService.evaluatePolicyWithPolicy(
              workspace.path,
              policyContext.policy,
              `${policyContext.path} (inherited by ${workspace.relativePath})`
            ))
        : Promise.resolve({ value: undefined, error: undefined } as CaptureResult<DependencyPolicyEvaluation | undefined>),
      ciEvidenceContext.source === 'workspace'
        ? capture(() => this.ciEvidenceService.report(workspace.path))
        : ciEvidenceContext.source === 'inherited-root' && ciEvidenceContext.report
          ? Promise.resolve({ value: ciEvidenceContext.report, error: undefined } as CaptureResult<CiEvidenceReport>)
          : Promise.resolve({ value: undefined, error: undefined } as CaptureResult<CiEvidenceReport | undefined>),
      releaseApprovalContext.source === 'workspace'
        ? capture(() => this.releaseApprovalService.report(workspace.path))
        : releaseApprovalContext.source === 'inherited-root' && releaseApprovalContext.report
          ? Promise.resolve({ value: releaseApprovalContext.report, error: undefined } as CaptureResult<ReleaseApprovalReport>)
          : Promise.resolve({ value: undefined, error: undefined } as CaptureResult<ReleaseApprovalReport | undefined>),
      releaseExceptionContext.source === 'workspace'
        ? capture(() => this.releaseExceptionService.report(workspace.path))
        : releaseExceptionContext.source === 'inherited-root' && releaseExceptionContext.report
          ? Promise.resolve({ value: releaseExceptionContext.report, error: undefined } as CaptureResult<ReleaseExceptionReport>)
          : Promise.resolve({ value: undefined, error: undefined } as CaptureResult<ReleaseExceptionReport | undefined>)
    ])
    const snapshotContext = workspaceSnapshotContext(root, workspace, snapshotResult.value || [], rootSnapshots)
    const effectiveSnapshotResult: CaptureResult<SnapshotSummary[]> = {
      value: snapshotContext.snapshots,
      error: snapshotResult.error
    }
    const readinessResult = await capture(() => this.readinessGateService.reportWithPolicy(
      workspace.path,
      readinessPolicyContext.policy,
      readinessPolicyContext.source === 'inherited-root'
        ? `${readinessPolicyContext.path} (inherited by ${workspace.relativePath})`
        : readinessPolicyContext.path,
      {
        ...(snapshotContext.source === 'inherited-root'
          ? { snapshots: snapshotContext.snapshots }
          : {}),
        ...(ciEvidenceContext.source === 'inherited-root' && ciEvidenceContext.report
          ? { ciEvidenceReport: ciEvidenceContext.report }
          : {}),
        ...(auditEvidenceContext.source === 'inherited-root' && auditEvidenceContext.report
          ? { auditEvidenceReport: auditEvidenceContext.report }
          : {}),
        ...(releaseApprovalContext.source === 'inherited-root' && releaseApprovalContext.report
          ? { releaseApprovalReport: releaseApprovalContext.report }
          : {}),
        ...(releaseExceptionContext.source === 'inherited-root' && releaseExceptionContext.report
          ? { releaseExceptionReport: releaseExceptionContext.report }
          : {})
      }
    ))

    const findings = buildFindings(
      workspace,
      supplyChainResult,
      effectiveSnapshotResult,
      snapshotContext,
      historyResult,
      policyResult,
      policyContext,
      ciEvidenceResult,
      ciEvidenceContext,
      releaseApprovalResult,
      releaseApprovalContext,
      releaseExceptionResult,
      releaseExceptionContext,
      readinessResult,
      readinessPolicyContext
    )
    const status = statusFromFindings(findings)
    const score = scoreFromFindings(findings)
    const policyEvaluation = policyResult.value
    const history = historyResult.value || []
    const snapshots = snapshotContext.snapshots
    const activeApprovals = releaseApprovalResult.value
      ? activeReleaseApprovals(releaseApprovalResult.value.records, new Date(), readinessPolicyContext.policy)
      : []
    const activeExceptions = releaseExceptionResult.value
      ? activeReleaseExceptions(releaseExceptionResult.value.records, new Date())
      : []
    const readinessChecks = readinessResult.value?.checks || []

    return {
      workspace,
      status,
      score,
      componentCount: supplyChainResult.value?.componentCount || 0,
      policyViolationCount: policyEvaluation?.violationCount || 0,
      highSeverityPolicyViolationCount: highSeverityPolicyViolations(policyEvaluation),
      snapshotCount: snapshots.length,
      snapshotSource: snapshotContext.source,
      snapshotPath: snapshotContext.path,
      snapshotCoveredFileCount: snapshotContext.coveredFiles.length,
      snapshotCoveredFiles: snapshotContext.coveredFiles,
      recentOperationCount: history.length,
      failedOperationCount: history.filter((record) => record.status === 'error').length,
      manifestFileCount: workspace.manifestFiles.length,
      lockFileCount: workspace.lockFiles.length,
      missingLockManagers: missingLockManagers(workspace),
      policySource: policyContext.source,
      policyPath: policyContext.path,
      readinessStatus: readinessResult.value?.status || 'warning',
      readinessScore: readinessResult.value?.score || 0,
      readinessBlockedCheckCount: readinessResult.value?.checks.filter((check) => check.status === 'blocked').length || 0,
      readinessWarningCheckCount: readinessResult.value?.checks.filter((check) => check.status === 'warning').length || 0,
      readinessBlockedChecks: readinessChecks.filter((check) => check.status === 'blocked').map(readinessCheckSummary),
      readinessWarningChecks: readinessChecks.filter((check) => check.status === 'warning').map(readinessCheckSummary),
      readinessPolicySource: readinessPolicyContext.source,
      readinessPolicyPath: readinessPolicyContext.path,
      ciEvidenceSource: ciEvidenceContext.source,
      ciEvidencePath: ciEvidenceContext.path,
      ciEvidenceCount: ciEvidenceResult.value?.records.length || 0,
      latestCiStatus: ciEvidenceResult.value?.summary.latest?.status,
      latestCiFinishedAt: ciEvidenceResult.value?.summary.latest?.finishedAt,
      releaseApprovalSource: releaseApprovalContext.source,
      releaseApprovalPath: releaseApprovalContext.path,
      releaseApprovalCount: releaseApprovalResult.value?.records.length || 0,
      activeReleaseApprovalCount: activeApprovals.length,
      latestReleaseApprovalDecision: releaseApprovalResult.value?.summary.latest?.decision,
      releaseExceptionSource: releaseExceptionContext.source,
      releaseExceptionPath: releaseExceptionContext.path,
      releaseExceptionCount: releaseExceptionResult.value?.records.length || 0,
      activeReleaseExceptionCount: activeExceptions.length,
      latestReleaseExceptionDecision: releaseExceptionResult.value?.summary.latest?.decision,
      findings
    }
  }
}

function buildFindings(
  workspace: WorkspaceNode,
  supplyChainResult: CaptureResult<SupplyChainReport>,
  snapshotResult: CaptureResult<SnapshotSummary[]>,
  snapshotContext: SnapshotContext,
  historyResult: CaptureResult<OperationHistoryRecord[]>,
  policyResult: CaptureResult<DependencyPolicyEvaluation | undefined>,
  policyContext: PolicyContext,
  ciEvidenceResult: CaptureResult<CiEvidenceReport | undefined>,
  ciEvidenceContext: CiEvidenceContext,
  releaseApprovalResult: CaptureResult<ReleaseApprovalReport | undefined>,
  releaseApprovalContext: ReleaseApprovalContext,
  releaseExceptionResult: CaptureResult<ReleaseExceptionReport | undefined>,
  releaseExceptionContext: ReleaseExceptionContext,
  readinessResult: CaptureResult<ReadinessGateReport>,
  readinessPolicyContext: ReadinessPolicyContext
): WorkspaceGovernanceFinding[] {
  const findings: WorkspaceGovernanceFinding[] = []

  if (workspace.managerIds.length === 0) {
    findings.push(finding({
      id: 'manager-coverage',
      title: 'Manager coverage',
      severity: 'blocked',
      summary: 'No supported dependency manager was recognized for this workspace.',
      recommendation: 'Add a supported manifest or exclude this folder from release dependency governance.',
      evidence: [workspace.relativePath]
    }))
  }

  if (supplyChainResult.error) {
    findings.push(finding({
      id: 'component-scan',
      title: 'Component inventory',
      severity: 'warning',
      summary: 'Dependency components could not be scanned for this workspace.',
      recommendation: 'Fix unreadable or invalid manifest files before generating workspace SBOM evidence.',
      evidence: [supplyChainResult.error]
    }))
  } else if ((supplyChainResult.value?.componentCount || 0) === 0 && workspace.manifestFiles.length > 0) {
    findings.push(finding({
      id: 'component-scan',
      title: 'Component inventory',
      severity: 'warning',
      summary: 'No dependency components were found even though manifests exist.',
      recommendation: 'Confirm the workspace has dependencies or document it as metadata-only.',
      evidence: workspace.manifestFiles.slice(0, 8)
    }))
  }

  const missingLocks = missingLockManagers(workspace)
  if (missingLocks.length > 0) {
    findings.push(finding({
      id: 'lockfile-coverage',
      title: 'Lockfile coverage',
      severity: 'warning',
      summary: `${missingLocks.length} detected manager(s) have no lockfile in this workspace.`,
      recommendation: 'Commit lockfiles or document why this workspace resolves dependencies dynamically.',
      evidence: missingLocks.map((managerId) => {
        const manager = MANAGER_BY_ID.get(managerId)
        return `${manager?.name || managerId}: expected ${(manager?.lockFiles || []).join(', ')}`
      })
    }))
  }

  if (snapshotResult.error) {
    findings.push(finding({
      id: 'snapshot-coverage',
      title: 'Rollback snapshots',
      severity: 'warning',
      summary: 'Workspace snapshots could not be listed.',
      recommendation: 'Verify `.npmDesktopManager/snapshots` is readable or create a fresh workspace snapshot.',
      evidence: [snapshotResult.error]
    }))
  } else if (snapshotContext.source === 'inherited-root' && snapshotContext.snapshots.length > 0) {
    findings.push(finding({
      id: 'snapshot-inheritance',
      title: 'Rollback snapshot inheritance',
      severity: 'info',
      summary: 'Repository root rollback snapshot covers this workspace dependency surface.',
      recommendation: 'Create a workspace-local snapshot when this package needs independent restore boundaries.',
      evidence: [
        snapshotContext.path || 'root dependency snapshot',
        `${snapshotContext.coveredFiles.length} covered file(s)`,
        ...snapshotContext.coveredFiles.slice(0, 8)
      ]
    }))
  } else if ((snapshotResult.value?.length || 0) === 0 && workspace.manifestFiles.length > 0) {
    findings.push(finding({
      id: 'snapshot-coverage',
      title: 'Rollback snapshots',
      severity: 'warning',
      summary: 'No rollback snapshot exists for this workspace.',
      recommendation: 'Create a snapshot before applying dependency changes in this workspace.',
      evidence: [workspace.relativePath]
    }))
  }

  if (policyContext.source === 'none') {
    findings.push(finding({
      id: 'dependency-policy',
      title: 'Dependency policy',
      severity: 'info',
      summary: 'No workspace-local or inherited dependency policy is configured.',
      recommendation: 'Add a repository root policy or a workspace policy when this package needs pinning, license, or package-family rules.',
      evidence: [join(workspace.relativePath, DEPENDENCY_POLICY_FILE).replace(/\\/g, '/')]
    }))
  } else if (policyResult.error) {
    findings.push(finding({
      id: 'dependency-policy',
      title: 'Dependency policy',
      severity: 'warning',
      summary: 'Workspace dependency policy evaluation failed.',
      recommendation: 'Open the policy editor for this workspace and repair invalid rules.',
      evidence: [policyResult.error]
    }))
  } else {
    if (policyContext.source === 'inherited-root') {
      findings.push(finding({
        id: 'dependency-policy-inheritance',
        title: 'Dependency policy inheritance',
        severity: 'info',
        summary: 'Repository root dependency policy is inherited by this workspace.',
        recommendation: 'Add a workspace-local policy only when this package needs stricter or different rules.',
        evidence: [policyContext.path || 'root dependency policy']
      }))
    }

    if ((policyResult.value?.violationCount || 0) > 0) {
      const highSeverity = highSeverityPolicyViolations(policyResult.value)
      findings.push(finding({
        id: 'dependency-policy',
        title: 'Dependency policy',
        severity: highSeverity > 0 ? 'blocked' : 'warning',
        summary: `${policyResult.value?.violationCount || 0} dependency policy finding(s) were found.`,
        recommendation: highSeverity > 0
          ? 'Resolve high-severity policy violations before release approval.'
          : 'Review policy warnings before merging workspace dependency changes.',
        evidence: (policyResult.value?.violations || []).slice(0, 8).map(formatPolicyViolation)
      }))
    }
  }

  if (historyResult.error) {
    findings.push(finding({
      id: 'operation-history',
      title: 'Operation history',
      severity: 'warning',
      summary: 'Workspace operation history could not be read.',
      recommendation: 'Verify operation logs are readable before relying on local release evidence.',
      evidence: [historyResult.error]
    }))
  } else {
    const failed = (historyResult.value || []).filter((record) => record.status === 'error')
    if (failed.length > 0) {
      findings.push(finding({
        id: 'operation-history',
        title: 'Operation history',
        severity: 'warning',
        summary: `${failed.length} failed operation(s) were recorded for this workspace.`,
        recommendation: 'Resolve failed install/update/publish operations before release review.',
        evidence: failed.slice(0, 5).map((record) => `${record.finishedAt}: ${record.command}`)
      }))
    }
  }

  if (ciEvidenceResult.error) {
    findings.push(finding({
      id: 'workspace-ci-evidence',
      title: 'CI evidence',
      severity: 'warning',
      summary: 'Workspace CI evidence could not be read.',
      recommendation: 'Repair the workspace CI evidence file or remove it to inherit root CI evidence.',
      evidence: [ciEvidenceResult.error]
    }))
  } else {
    const ciReport = ciEvidenceResult.value
    const latest = ciReport?.summary.latest

    if (ciEvidenceContext.source === 'inherited-root' && ciReport) {
      findings.push(finding({
        id: 'ci-evidence-inheritance',
        title: 'CI evidence inheritance',
        severity: 'info',
        summary: 'Repository root CI evidence is inherited by this workspace.',
        recommendation: 'Add workspace-local CI evidence only when this package has an independent build or test workflow.',
        evidence: [
          ciEvidenceContext.path || 'root CI evidence',
          latest ? `${latest.status}: ${latest.workflow || latest.provider || latest.id} at ${latest.finishedAt}` : 'No latest CI evidence'
        ]
      }))
    }

    if (!ciReport || ciReport.records.length === 0 || !latest) {
      if (readinessPolicyContext.policy.blockOnMissingCiEvidence) {
        findings.push(finding({
          id: 'workspace-ci-evidence',
          title: 'CI evidence',
          severity: 'blocked',
          summary: 'No CI evidence exists; readiness policy blocks missing CI evidence.',
          recommendation: 'Run or import CI evidence locally or inherit root CI evidence before release.',
          evidence: [
            `Source: ${ciEvidenceContext.source}`,
            `Policy blockOnMissingCiEvidence: ${readinessPolicyContext.policy.blockOnMissingCiEvidence}`
          ]
        }))
      }
    } else if (latest.status !== 'success') {
      findings.push(finding({
        id: 'workspace-ci-evidence',
        title: 'CI evidence',
        severity: readinessPolicyContext.policy.blockOnFailedCiEvidence ? 'blocked' : 'warning',
        summary: `Latest CI evidence is ${latest.status}.`,
        recommendation: 'Resolve failed or inconclusive CI runs before this workspace release.',
        evidence: [
          `Source: ${ciEvidenceContext.source}`,
          formatCiEvidence(latest),
          ...latest.annotations.slice(0, 5)
        ]
      }))
    } else {
      const age = ageInDays(latest.finishedAt, new Date())
      if (age !== null && age > readinessPolicyContext.policy.ciEvidenceMaxAgeDays) {
        findings.push(finding({
          id: 'workspace-ci-evidence',
          title: 'CI evidence',
          severity: readinessPolicyContext.policy.blockOnStaleCiEvidence ? 'blocked' : 'warning',
          summary: `Latest successful CI evidence is ${Math.round(age)} day(s) old; policy limit is ${readinessPolicyContext.policy.ciEvidenceMaxAgeDays} day(s).`,
          recommendation: 'Run or import fresh CI evidence before this workspace release.',
          evidence: [
            `Source: ${ciEvidenceContext.source}`,
            `Policy blockOnStaleCiEvidence: ${readinessPolicyContext.policy.blockOnStaleCiEvidence}`,
            formatCiEvidence(latest)
          ]
        }))
      }
    }
  }

  if (releaseApprovalResult.error) {
    findings.push(finding({
      id: 'workspace-release-approvals',
      title: 'Release approvals',
      severity: 'warning',
      summary: 'Workspace release approval evidence could not be read.',
      recommendation: 'Repair the workspace approval file or remove it to inherit root approval evidence.',
      evidence: [releaseApprovalResult.error]
    }))
  } else {
    const approvalReport = releaseApprovalResult.value
    const activeApprovals = approvalReport
      ? activeReleaseApprovals(approvalReport.records, new Date(), readinessPolicyContext.policy)
      : []
    const requiredApprovals = readinessPolicyContext.policy.requiredReleaseApprovals
    const latestByReviewer = approvalReport
      ? Array.from(latestApprovalByReviewer(approvalReport.records).values())
      : []
    const rejected = latestByReviewer.filter((record) => record.decision === 'rejected' || record.decision === 'revoked')

    if (releaseApprovalContext.source === 'inherited-root' && approvalReport) {
      findings.push(finding({
        id: 'release-approval-inheritance',
        title: 'Release approval inheritance',
        severity: 'info',
        summary: 'Repository root release approval evidence is inherited by this workspace.',
        recommendation: 'Add workspace-local approval evidence only when this package needs an independent release decision.',
        evidence: [
          releaseApprovalContext.path || 'root release approvals',
          `${activeApprovals.length}/${requiredApprovals} active approval(s)`
        ]
      }))
    }

    if (!approvalReport || approvalReport.records.length === 0) {
      if (requiredApprovals > 0) {
        findings.push(finding({
          id: 'workspace-release-approvals',
          title: 'Release approvals',
          severity: readinessPolicyContext.policy.blockOnMissingReleaseApprovals ? 'blocked' : 'warning',
          summary: `No release approval evidence exists; policy requires ${requiredApprovals} approval(s).`,
          recommendation: 'Record reviewer approval locally or inherit root approval evidence before release.',
          evidence: [
            `Source: ${releaseApprovalContext.source}`,
            `Policy blockOnMissingReleaseApprovals: ${readinessPolicyContext.policy.blockOnMissingReleaseApprovals}`
          ]
        }))
      }
    } else if (rejected.length > 0) {
      findings.push(finding({
        id: 'workspace-release-approvals',
        title: 'Release approvals',
        severity: readinessPolicyContext.policy.blockOnRejectedReleaseApproval ? 'blocked' : 'warning',
        summary: `${rejected.length} reviewer approval state(s) are rejected or revoked.`,
        recommendation: 'Resolve rejected reviews or record fresh approvals before this workspace release.',
        evidence: rejected.slice(0, 5).map(formatReleaseApproval)
      }))
    } else if (activeApprovals.length < requiredApprovals) {
      findings.push(finding({
        id: 'workspace-release-approvals',
        title: 'Release approvals',
        severity: readinessPolicyContext.policy.blockOnMissingReleaseApprovals ? 'blocked' : 'warning',
        summary: `${activeApprovals.length}/${requiredApprovals} required release approval(s) are active.`,
        recommendation: 'Record enough fresh reviewer approvals before this workspace release.',
        evidence: [
          `Source: ${releaseApprovalContext.source}`,
          ...approvalReport.records.slice(0, 5).map(formatReleaseApproval)
        ]
      }))
    }
  }

  if (releaseExceptionResult.error) {
    findings.push(finding({
      id: 'workspace-release-exceptions',
      title: 'Release exceptions',
      severity: 'warning',
      summary: 'Workspace release exception evidence could not be read.',
      recommendation: 'Repair the workspace exception file or remove it to inherit root exception evidence.',
      evidence: [releaseExceptionResult.error]
    }))
  } else {
    const exceptionReport = releaseExceptionResult.value
    const activeExceptions = exceptionReport ? activeReleaseExceptions(exceptionReport.records, new Date()) : []

    if (releaseExceptionContext.source === 'inherited-root' && exceptionReport) {
      findings.push(finding({
        id: 'release-exception-inheritance',
        title: 'Release exception inheritance',
        severity: 'info',
        summary: 'Repository root release exception evidence is inherited by this workspace.',
        recommendation: 'Add workspace-local exception evidence only when this package needs an independent reviewed risk acceptance.',
        evidence: [
          releaseExceptionContext.path || 'root release exceptions',
          `${activeExceptions.length}/${exceptionReport.records.length} active exception(s)`
        ]
      }))
    }

    if (activeExceptions.length > 0) {
      findings.push(finding({
        id: 'workspace-release-exceptions',
        title: 'Release exceptions',
        severity: 'warning',
        summary: `${activeExceptions.length} active release exception(s) apply to this workspace readiness evidence.`,
        recommendation: 'Track exceptions in the release bundle and remove them after the approved risk window closes.',
        evidence: activeExceptions.slice(0, 5).map(formatReleaseException)
      }))
    }
  }

  if (readinessResult.error) {
    findings.push(finding({
      id: 'workspace-readiness-gate',
      title: 'Workspace readiness gate',
      severity: 'warning',
      summary: 'Workspace readiness gate could not be evaluated.',
      recommendation: 'Run the readiness gate for this workspace and fix unreadable policy or evidence files.',
      evidence: [readinessResult.error]
    }))
  } else if (readinessResult.value?.status === 'blocked') {
    const blocked = readinessResult.value.checks.filter((check) => check.status === 'blocked')
    findings.push(finding({
      id: 'workspace-readiness-gate',
      title: 'Workspace readiness gate',
      severity: 'blocked',
      summary: `${blocked.length} readiness gate(s) block this workspace release.`,
      recommendation: 'Resolve blocked readiness checks or record a reviewed release exception before publishing this workspace.',
      evidence: [
        `Policy source: ${readinessPolicyContext.source}`,
        ...blocked.slice(0, 6).map((check) => `${check.title}: ${check.summary}`)
      ]
    }))
  } else if (readinessResult.value?.status === 'warning') {
    const warnings = readinessResult.value.checks.filter((check) => check.status === 'warning')
    findings.push(finding({
      id: 'workspace-readiness-gate',
      title: 'Workspace readiness gate',
      severity: 'warning',
      summary: `${warnings.length} readiness gate warning(s) need review for this workspace.`,
      recommendation: 'Review warning gates before approving dependency changes in this workspace.',
      evidence: [
        `Policy source: ${readinessPolicyContext.source}`,
        ...warnings.slice(0, 6).map((check) => `${check.title}: ${check.summary}`)
      ]
    }))
  } else if (readinessPolicyContext.source === 'inherited-root') {
    findings.push(finding({
      id: 'readiness-policy-inheritance',
      title: 'Readiness policy inheritance',
      severity: 'info',
      summary: 'Repository root readiness policy is inherited by this workspace.',
      recommendation: 'Add a workspace-local readiness policy only when release gates need stricter or different thresholds.',
      evidence: [readinessPolicyContext.path]
    }))
  }

  if (findings.length === 0) {
    findings.push(finding({
      id: 'workspace-ready',
      title: 'Workspace readiness',
      severity: 'info',
      summary: 'Workspace governance evidence has no blocking or warning findings.',
      recommendation: 'Export the governance report with release artifacts.',
      evidence: [`${workspace.relativePath}: ${workspace.managerIds.join(', ') || '-'}`]
    }))
  }

  return findings
}

function workspaceSnapshotContext(
  root: string,
  workspace: WorkspaceNode,
  localSnapshots: SnapshotSummary[],
  rootSnapshots: RootSnapshotContext | undefined
): SnapshotContext {
  if (localSnapshots.length > 0) {
    const latest = latestSnapshot(localSnapshots)
    return {
      source: 'workspace',
      snapshots: localSnapshots,
      path: latest?.path,
      coveredFiles: workspaceDependencyFiles(workspace)
    }
  }

  if (!rootSnapshots || workspace.path === root) {
    return {
      source: 'none',
      snapshots: [],
      coveredFiles: []
    }
  }

  const dependencyFiles = workspaceDependencyFiles(workspace)
  const inherited = rootSnapshots.snapshots.filter((snapshot) => {
    const files = rootSnapshots.filesBySnapshotId.get(snapshot.id) || []
    return dependencyFiles.some((file) => files.includes(file))
  })
  if (inherited.length === 0) {
    return {
      source: 'none',
      snapshots: [],
      coveredFiles: []
    }
  }

  const coveredFiles = dependencyFiles.filter((file) => (
    inherited.some((snapshot) => (rootSnapshots.filesBySnapshotId.get(snapshot.id) || []).includes(file))
  ))
  const latest = latestSnapshot(inherited)
  return {
    source: 'inherited-root',
    snapshots: inherited,
    path: latest?.path,
    coveredFiles
  }
}

function workspaceDependencyFiles(workspace: WorkspaceNode): string[] {
  return [...new Set([
    ...workspace.manifestFiles,
    ...workspace.lockFiles,
    ...workspace.configFiles
  ])].sort()
}

function missingLockManagers(workspace: WorkspaceNode): DependencyManagerId[] {
  return workspace.managerIds.filter((managerId) => {
    const manager = MANAGER_BY_ID.get(managerId)
    if (!manager || manager.lockFiles.length === 0) return false
    return !manager.lockFiles.some((pattern) => workspace.lockFiles.some((file) => fileMatchesPattern(file, pattern)))
  })
}

function fileMatchesPattern(file: string, pattern: string): boolean {
  const fileName = basename(file).toLowerCase()
  const normalizedPattern = pattern.toLowerCase()
  if (!normalizedPattern.includes('*')) {
    return fileName === basename(normalizedPattern)
  }

  const regex = new RegExp(`^${escapeRegExp(basename(normalizedPattern)).replace(/\\\*/g, '.*')}$`, 'i')
  return regex.test(fileName)
}

function statusFromFindings(findings: WorkspaceGovernanceFinding[]): WorkspaceGovernanceStatus {
  if (findings.some((item) => item.severity === 'blocked')) return 'blocked'
  if (findings.some((item) => item.severity === 'warning')) return 'warning'
  return 'ready'
}

function scoreFromFindings(findings: WorkspaceGovernanceFinding[]): number {
  const penalty = findings.reduce((total, item) => {
    if (item.severity === 'blocked') return total + 30
    if (item.severity === 'warning') return total + 10
    return total
  }, 0)
  return Math.max(0, 100 - penalty)
}

function summarize(workspaces: WorkspaceGovernanceNode[]): WorkspaceGovernanceSummary {
  const managers = [...new Set(workspaces.flatMap((node) => node.workspace.managerIds))]
    .sort((a, b) => a.localeCompare(b)) as DependencyManagerId[]
  return {
    workspaceCount: workspaces.length,
    ready: workspaces.filter((node) => node.status === 'ready').length,
    warning: workspaces.filter((node) => node.status === 'warning').length,
    blocked: workspaces.filter((node) => node.status === 'blocked').length,
    componentCount: sum(workspaces.map((node) => node.componentCount)),
    policyViolationCount: sum(workspaces.map((node) => node.policyViolationCount)),
    highSeverityPolicyViolationCount: sum(workspaces.map((node) => node.highSeverityPolicyViolationCount)),
    snapshotCount: sum(workspaces.map((node) => node.snapshotCount)),
    recentOperationCount: sum(workspaces.map((node) => node.recentOperationCount)),
    failedOperationCount: sum(workspaces.map((node) => node.failedOperationCount)),
    missingLockWorkspaceCount: workspaces.filter((node) => node.missingLockManagers.length > 0).length,
    workspaceSnapshotCount: workspaces.filter((node) => node.snapshotSource === 'workspace').length,
    inheritedSnapshotWorkspaceCount: workspaces.filter((node) => node.snapshotSource === 'inherited-root').length,
    missingSnapshotWorkspaceCount: workspaces.filter((node) => node.snapshotSource === 'none').length,
    inheritedSnapshotCoveredFileCount: sum(workspaces.map((node) => (
      node.snapshotSource === 'inherited-root' ? node.snapshotCoveredFileCount : 0
    ))),
    workspacePolicyCount: workspaces.filter((node) => node.policySource === 'workspace').length,
    inheritedPolicyWorkspaceCount: workspaces.filter((node) => node.policySource === 'inherited-root').length,
    missingPolicyWorkspaceCount: workspaces.filter((node) => node.policySource === 'none').length,
    readinessReady: workspaces.filter((node) => node.readinessStatus === 'ready').length,
    readinessWarning: workspaces.filter((node) => node.readinessStatus === 'warning').length,
    readinessBlocked: workspaces.filter((node) => node.readinessStatus === 'blocked').length,
    workspaceReadinessPolicyCount: workspaces.filter((node) => node.readinessPolicySource === 'workspace').length,
    inheritedReadinessPolicyWorkspaceCount: workspaces.filter((node) => node.readinessPolicySource === 'inherited-root').length,
    defaultReadinessPolicyWorkspaceCount: workspaces.filter((node) => node.readinessPolicySource === 'default').length,
    ciEvidenceRecordCount: sum(workspaces.map((node) => node.ciEvidenceCount)),
    workspaceCiEvidenceCount: workspaces.filter((node) => node.ciEvidenceSource === 'workspace').length,
    inheritedCiEvidenceWorkspaceCount: workspaces.filter((node) => node.ciEvidenceSource === 'inherited-root').length,
    missingCiEvidenceWorkspaceCount: workspaces.filter((node) => node.ciEvidenceSource === 'none').length,
    failedCiEvidenceWorkspaceCount: workspaces.filter((node) => (
      node.latestCiStatus === 'failed' || node.latestCiStatus === 'cancelled' || node.latestCiStatus === 'unknown'
    )).length,
    releaseApprovalRecordCount: sum(workspaces.map((node) => node.releaseApprovalCount)),
    activeReleaseApprovalCount: sum(workspaces.map((node) => node.activeReleaseApprovalCount)),
    workspaceReleaseApprovalEvidenceCount: workspaces.filter((node) => node.releaseApprovalSource === 'workspace').length,
    inheritedReleaseApprovalEvidenceWorkspaceCount: workspaces.filter((node) => node.releaseApprovalSource === 'inherited-root').length,
    missingReleaseApprovalEvidenceWorkspaceCount: workspaces.filter((node) => node.releaseApprovalSource === 'none').length,
    rejectedReleaseApprovalWorkspaceCount: workspaces.filter((node) => (
      node.latestReleaseApprovalDecision === 'rejected' || node.latestReleaseApprovalDecision === 'revoked'
    )).length,
    releaseExceptionRecordCount: sum(workspaces.map((node) => node.releaseExceptionCount)),
    activeReleaseExceptionCount: sum(workspaces.map((node) => node.activeReleaseExceptionCount)),
    workspaceReleaseExceptionEvidenceCount: workspaces.filter((node) => node.releaseExceptionSource === 'workspace').length,
    inheritedReleaseExceptionEvidenceWorkspaceCount: workspaces.filter((node) => node.releaseExceptionSource === 'inherited-root').length,
    missingReleaseExceptionEvidenceWorkspaceCount: workspaces.filter((node) => node.releaseExceptionSource === 'none').length,
    managers,
    byManager: countBy(workspaces.flatMap((node) => node.workspace.managerIds))
  }
}

function highSeverityPolicyViolations(evaluation?: DependencyPolicyEvaluation): number {
  return evaluation?.violations.filter((violation) => violation.severity === 'critical' || violation.severity === 'high').length || 0
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
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

async function snapshotFileList(path: string): Promise<string[]> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8'))
    const files = Array.isArray(parsed?.files) ? parsed.files : []
    return files
      .map((file: any) => typeof file?.file === 'string' ? file.file.replace(/\\/g, '/') : '')
      .filter(Boolean)
      .sort()
  } catch {
    return []
  }
}

function finding(input: WorkspaceGovernanceFinding): WorkspaceGovernanceFinding {
  return input
}

function formatPolicyViolation(violation: DependencyPolicyEvaluation['violations'][number]): string {
  const target = [
    violation.managerId,
    violation.packageName,
    violation.version
  ].filter(Boolean).join(':')
  return `${violation.severity}: ${violation.title}${target ? ` (${target})` : ''}`
}

function readinessCheckSummary(check: ReadinessGateReport['checks'][number]): WorkspaceReadinessCheckSummary {
  return {
    id: check.id,
    title: check.title,
    status: check.status,
    severity: check.severity,
    summary: check.summary,
    recommendation: check.recommendation,
    evidence: check.evidence
  }
}

function latestSnapshot(snapshots: SnapshotSummary[]): SnapshotSummary | undefined {
  return [...snapshots]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function statusFromGovernanceSummary(summary: WorkspaceGovernanceSummary): ReadinessGateStatus {
  if (summary.blocked > 0 || summary.readinessBlocked > 0) return 'blocked'
  if (summary.warning > 0 || summary.readinessWarning > 0) return 'warning'
  return 'ready'
}

async function fileDigest(path: string): Promise<{ sha256: string; sizeBytes: number }> {
  const content = await readFile(path)
  return {
    sha256: createHash('sha256').update(content).digest('hex'),
    sizeBytes: content.byteLength
  }
}

function releaseBundleArtifactId(kind: ReleaseBundleArtifactKind, label: string, format: string): string {
  const slug = `${kind}-${format}-${label}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `${kind}-${format}`
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function remediationItem(input: RemediationPlanItem): RemediationPlanItem {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20),
    managers: input.managers ? [...new Set(input.managers)].sort() as DependencyManagerId[] : undefined
  }
}

function readinessCheckPriority(check: Pick<ReadinessGateReport['checks'][number], 'status' | 'severity'>): RemediationPlanPriority {
  if (check.status === 'blocked') {
    if (check.severity === 'critical') return 'critical'
    if (check.severity === 'high') return 'high'
    return 'medium'
  }

  if (check.severity === 'critical' || check.severity === 'high') return 'high'
  if (check.severity === 'medium') return 'medium'
  if (check.severity === 'low') return 'low'
  return 'info'
}

function governanceFindingPriority(finding: WorkspaceGovernanceFinding): RemediationPlanPriority {
  if (finding.severity === 'blocked') return 'high'
  if (finding.severity === 'warning') return 'medium'
  return 'info'
}

function releaseRiskRemediationFindings(report: ReleaseRiskProfileReport): ReleaseRiskProfileFinding[] {
  return report.findings.filter((finding) => {
    if (finding.severity === 'info') return false
    if (finding.category === 'deployment') return true
    if (finding.source === 'readiness-gate') return false
    return finding.severity === 'critical' || finding.severity === 'high' || finding.severity === 'medium'
  })
}

function releaseRiskFindingPriority(finding: Pick<ReleaseRiskProfileFinding, 'severity'>): RemediationPlanPriority {
  if (finding.severity === 'critical') return 'critical'
  if (finding.severity === 'high') return 'high'
  if (finding.severity === 'medium') return 'medium'
  if (finding.severity === 'low') return 'low'
  return 'info'
}

function dedupeRemediationItems(items: RemediationPlanItem[]): RemediationPlanItem[] {
  const byKey = new Map<string, RemediationPlanItem>()
  for (const item of items) {
    const key = [
      item.scope,
      item.source,
      item.workspaceRelativePath || '.',
      item.title,
      item.summary
    ].join('\n')
    const existing = byKey.get(key)
    if (!existing || priorityRank(item.priority) > priorityRank(existing.priority)) {
      byKey.set(key, item)
    }
  }
  return Array.from(byKey.values())
}

function sortRemediationItems(items: RemediationPlanItem[]): RemediationPlanItem[] {
  return [...items].sort((a, b) => {
    const priority = priorityRank(b.priority) - priorityRank(a.priority)
    if (priority !== 0) return priority
    const scope = a.scope.localeCompare(b.scope)
    if (scope !== 0) return scope
    return (a.workspaceRelativePath || '.').localeCompare(b.workspaceRelativePath || '.')
      || a.title.localeCompare(b.title)
  })
}

function summarizeRemediationPlan(
  items: RemediationPlanItem[],
  governance?: WorkspaceGovernanceReport
): WorkspaceRemediationPlanSummary {
  const affectedWorkspaces = new Set(items
    .map((item) => item.workspaceId)
    .filter((id): id is string => Boolean(id)))
  return {
    itemCount: items.length,
    critical: items.filter((item) => item.priority === 'critical').length,
    high: items.filter((item) => item.priority === 'high').length,
    medium: items.filter((item) => item.priority === 'medium').length,
    low: items.filter((item) => item.priority === 'low').length,
    info: items.filter((item) => item.priority === 'info').length,
    projectItemCount: items.filter((item) => item.scope === 'project').length,
    workspaceItemCount: items.filter((item) => item.scope === 'workspace').length,
    releaseRiskItemCount: items.filter((item) => item.source === 'release-risk').length,
    deploymentItemCount: items.filter((item) => (
      item.source === 'release-risk'
      && (
        /deployment/i.test(item.summary)
        || /deploy/i.test(item.summary)
        || item.evidence.some((evidence) => /Category:\s*deployment/i.test(evidence))
      )
    )).length,
    affectedWorkspaceCount: affectedWorkspaces.size,
    blockedWorkspaceCount: governance?.summary.blocked || 0,
    warningWorkspaceCount: governance?.summary.warning || 0,
    activeReleaseExceptionCount: governance?.summary.activeReleaseExceptionCount || 0
  }
}

function priorityRank(priority: RemediationPlanPriority): number {
  return {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  }[priority]
}

function updatePlanItem(node: WorkspaceGovernanceNode, managerId: DependencyManagerId): WorkspaceUpdatePlanItem {
  const manager = MANAGER_BY_ID.get(managerId)
  const missingLockfile = managerHasLockfiles(managerId) && !workspaceHasManagerLockfile(node.workspace, managerId)
  const risk = updatePlanRisk(node, missingLockfile)
  const status: WorkspaceUpdatePlanItemStatus = risk === 'blocked'
    ? 'blocked'
    : risk === 'high' || risk === 'medium'
      ? 'needs-review'
      : 'ready'
  const commands = updatePlanCommands(managerId)
  const warnings = updatePlanWarnings(node, missingLockfile, commands)

  return {
    id: `update:${node.workspace.id}:${managerId}`,
    workspaceId: node.workspace.id,
    workspaceName: node.workspace.name,
    workspacePath: node.workspace.path,
    workspaceRelativePath: node.workspace.relativePath,
    managerId,
    managerName: manager?.name || managerId,
    ecosystem: manager?.ecosystem || managerId,
    tool: manager?.tools[0] || managerId,
    status,
    risk,
    componentCount: node.componentCount,
    manifestFiles: node.workspace.manifestFiles,
    lockFiles: node.workspace.lockFiles,
    missingLockfile,
    snapshotSource: node.snapshotSource,
    snapshotCount: node.snapshotCount,
    readinessStatus: node.readinessStatus,
    readinessBlockedCheckCount: node.readinessBlockedCheckCount,
    readinessWarningCheckCount: node.readinessWarningCheckCount,
    policySource: node.policySource,
    recentOperationCount: node.recentOperationCount,
    failedOperationCount: node.failedOperationCount,
    releaseExceptionCount: node.activeReleaseExceptionCount,
    commands,
    warnings,
    evidence: updatePlanEvidence(node, missingLockfile),
    recommendation: updatePlanRecommendation(risk, missingLockfile, commands)
  }
}

function managerHasLockfiles(managerId: DependencyManagerId): boolean {
  return (MANAGER_BY_ID.get(managerId)?.lockFiles.length || 0) > 0
}

function workspaceHasManagerLockfile(workspace: WorkspaceNode, managerId: DependencyManagerId): boolean {
  const lockFiles = MANAGER_BY_ID.get(managerId)?.lockFiles || []
  if (lockFiles.length === 0) return true
  return workspace.lockFiles.some((file) => lockFiles.some((lockFile) => basename(file) === lockFile || file.endsWith(`/${lockFile}`)))
}

function updatePlanRisk(node: WorkspaceGovernanceNode, missingLockfile: boolean): WorkspaceUpdatePlanRisk {
  if (node.status === 'blocked' || node.readinessStatus === 'blocked') return 'blocked'
  if (node.highSeverityPolicyViolationCount > 0 || node.failedOperationCount > 0 || node.snapshotSource === 'none') return 'high'
  if (missingLockfile || node.status === 'warning' || node.readinessStatus === 'warning' || node.readinessWarningCheckCount > 0) return 'medium'
  if (node.componentCount === 0) return 'info'
  return 'low'
}

function updatePlanWarnings(
  node: WorkspaceGovernanceNode,
  missingLockfile: boolean,
  commands: WorkspaceUpdatePlanCommand[]
): string[] {
  const warnings: string[] = []
  if (node.status === 'blocked' || node.readinessStatus === 'blocked') {
    warnings.push('Resolve blocked governance/readiness checks before running mutating update commands.')
  }
  if (missingLockfile) {
    warnings.push('No manager-specific lockfile was detected for this workspace; generate or review a lockfile before release.')
  }
  if (node.snapshotSource === 'none') {
    warnings.push('No rollback snapshot evidence is available for this workspace.')
  }
  if (node.failedOperationCount > 0) {
    warnings.push(`${node.failedOperationCount} recent failed operation(s) may indicate update instability.`)
  }
  if (node.activeReleaseExceptionCount > 0) {
    warnings.push(`${node.activeReleaseExceptionCount} active release exception(s) should be reviewed before dependency updates.`)
  }
  if (!commands.some((command) => command.stage === 'update' && command.mutating)) {
    warnings.push('No safe generic mutating update command is defined; use inspect/audit commands and manager-specific review.')
  }
  return warnings
}

function updatePlanEvidence(node: WorkspaceGovernanceNode, missingLockfile: boolean): string[] {
  const evidence = [
    `Workspace status: ${node.status}; readiness: ${node.readinessStatus} (${node.readinessScore}/100)`,
    `Managers: ${node.workspace.managerIds.join(', ') || '-'}`,
    `Components: ${node.componentCount}; manifests: ${node.manifestFileCount}; lockfiles: ${node.lockFileCount}`,
    `Policy source: ${node.policySource}; snapshot source: ${node.snapshotSource}; snapshots: ${node.snapshotCount}`,
    `Readiness findings: ${node.readinessBlockedCheckCount} blocked / ${node.readinessWarningCheckCount} warning`,
    `Operations: ${node.recentOperationCount} recent / ${node.failedOperationCount} failed`
  ]
  if (missingLockfile) evidence.push('Manager lockfile coverage is missing.')
  if (node.findings[0]) evidence.push(`Top governance finding: ${node.findings[0].title} - ${node.findings[0].summary}`)
  return evidence
}

function updatePlanRecommendation(
  risk: WorkspaceUpdatePlanRisk,
  missingLockfile: boolean,
  commands: WorkspaceUpdatePlanCommand[]
): string {
  if (risk === 'blocked') {
    return 'Export remediation actions, resolve blocked release gates, create a fresh snapshot, then rerun inspect/audit commands before updating.'
  }
  if (missingLockfile) {
    return 'Generate or refresh a lockfile first, then review outdated/audit output and run the mutating update command in a short-lived branch.'
  }
  if (commands.some((command) => command.dryRunCommand)) {
    return 'Run dry-run or inspect commands first, create a snapshot, then run the update command and regenerate SBOM/readiness evidence.'
  }
  if (!commands.some((command) => command.stage === 'update' && command.mutating)) {
    return 'Use the inspect/audit commands to prepare a manual manager-specific update PR.'
  }
  return 'Create a snapshot, run inspect/audit commands, apply the update command, then regenerate lockfiles, SBOMs, readiness, and release evidence.'
}

function updatePlanCommands(managerId: DependencyManagerId): WorkspaceUpdatePlanCommand[] {
  const command = (
    stage: WorkspaceUpdatePlanCommandStage,
    value: string,
    mutating: boolean,
    purpose: string,
    dryRunCommand?: string
  ): WorkspaceUpdatePlanCommand => ({
    stage,
    command: value,
    mutating,
    purpose,
    dryRunCommand
  })

  switch (managerId) {
    case 'npm':
      return [
        command('inspect', 'npm outdated', false, 'List outdated direct and transitive npm packages.'),
        command('update', 'npm update', true, 'Update dependencies within package.json version ranges.'),
        command('audit', 'npm audit', false, 'Check npm advisory exposure.'),
        command('lock', 'npm install --package-lock-only', true, 'Refresh package-lock.json without installing packages.')
      ]
    case 'pnpm':
      return [
        command('inspect', 'pnpm outdated', false, 'List outdated pnpm dependencies.'),
        command('update', 'pnpm update', true, 'Update dependencies within configured ranges.', 'pnpm update --dry-run'),
        command('audit', 'pnpm audit', false, 'Check npm advisory exposure through pnpm.'),
        command('lock', 'pnpm install --lockfile-only', true, 'Refresh pnpm-lock.yaml.')
      ]
    case 'yarn':
      return [
        command('inspect', 'yarn outdated', false, 'List outdated Yarn dependencies.'),
        command('update', 'yarn upgrade', true, 'Update dependencies according to Yarn rules.'),
        command('audit', 'yarn npm audit', false, 'Check advisory exposure through Yarn.'),
        command('lock', 'yarn install --mode=update-lockfile', true, 'Refresh yarn.lock.')
      ]
    case 'bun':
      return [
        command('inspect', 'bun outdated', false, 'List outdated Bun dependencies.'),
        command('update', 'bun update', true, 'Update Bun-managed dependencies.'),
        command('audit', 'bun audit', false, 'Check Bun advisory exposure where supported.')
      ]
    case 'pip':
      return [
        command('inspect', 'python -m pip list --outdated', false, 'List outdated packages in the selected Python environment.'),
        command('update', 'python -m pip install --upgrade -r requirements.txt', true, 'Upgrade packages declared in requirements.txt.'),
        command('verify', 'python -m pip check', false, 'Verify installed package compatibility.'),
        command('audit', 'pip-audit -r requirements.txt', false, 'Audit Python dependencies.')
      ]
    case 'uv':
      return [
        command('inspect', 'uv pip list --outdated', false, 'List outdated packages in the uv environment.'),
        command('update', 'uv lock --upgrade', true, 'Upgrade and refresh uv.lock.'),
        command('verify', 'uv pip check', false, 'Verify installed package compatibility.')
      ]
    case 'poetry':
      return [
        command('inspect', 'poetry show --outdated', false, 'List outdated Poetry dependencies.'),
        command('update', 'poetry update', true, 'Update Poetry dependencies and lockfile.', 'poetry update --dry-run'),
        command('verify', 'poetry check', false, 'Validate pyproject and poetry.lock.'),
        command('lock', 'poetry lock', true, 'Refresh poetry.lock.')
      ]
    case 'pipenv':
      return [
        command('inspect', 'pipenv update --outdated', false, 'List outdated Pipenv dependencies.'),
        command('update', 'pipenv update', true, 'Update Pipenv packages and lockfile.'),
        command('audit', 'pipenv check', false, 'Run Pipenv vulnerability and marker checks where available.'),
        command('lock', 'pipenv lock', true, 'Refresh Pipfile.lock.')
      ]
    case 'conda':
      return [
        command('inspect', 'conda update --all --dry-run', false, 'Preview Conda environment updates.'),
        command('update', 'conda update --all', true, 'Update Conda environment packages.', 'conda update --all --dry-run'),
        command('lock', 'conda env export', false, 'Export the resolved environment after update.')
      ]
    case 'maven':
      return [
        command('inspect', 'mvn versions:display-dependency-updates', false, 'List Maven dependency updates.'),
        command('update', 'mvn versions:use-latest-releases', true, 'Rewrite pom.xml dependencies to latest releases.'),
        command('verify', 'mvn test', false, 'Run Maven tests after dependency changes.'),
        command('audit', 'mvn org.owasp:dependency-check-maven:check', false, 'Run OWASP Dependency-Check for Maven.')
      ]
    case 'gradle':
      return [
        command('inspect', 'gradle dependencies', false, 'Inspect Gradle dependency graph.'),
        command('verify', 'gradle test', false, 'Run Gradle tests after dependency changes.'),
        command('lock', 'gradle dependencies --write-locks', true, 'Refresh Gradle dependency locks when dependency locking is enabled.')
      ]
    case 'cargo':
      return [
        command('inspect', 'cargo tree', false, 'Inspect Cargo dependency graph.'),
        command('update', 'cargo update', true, 'Update Cargo.lock to latest compatible versions.', 'cargo update --dry-run'),
        command('audit', 'cargo audit', false, 'Audit Rust dependencies.'),
        command('verify', 'cargo test', false, 'Run Rust tests after dependency changes.')
      ]
    case 'go':
      return [
        command('inspect', 'go list -m -u all', false, 'List available Go module updates.'),
        command('update', 'go get -u ./...', true, 'Update Go modules used by packages in this module.'),
        command('lock', 'go mod tidy', true, 'Refresh go.mod and go.sum.'),
        command('audit', 'govulncheck ./...', false, 'Audit Go vulnerabilities.')
      ]
    case 'flutter':
      return [
        command('inspect', 'flutter pub outdated', false, 'List outdated Flutter/Dart packages.'),
        command('update', 'flutter pub upgrade', true, 'Upgrade pub dependencies.', 'flutter pub upgrade --dry-run'),
        command('lock', 'flutter pub get', true, 'Refresh pubspec.lock.'),
        command('verify', 'flutter test', false, 'Run Flutter tests after dependency changes.')
      ]
    case 'native':
      return [
        command('inspect', 'vcpkg x-update-baseline --dry-run', false, 'Preview vcpkg baseline updates where vcpkg is used.'),
        command('update', 'vcpkg x-update-baseline', true, 'Update vcpkg baseline for manifest projects.', 'vcpkg x-update-baseline --dry-run'),
        command('verify', 'cmake --build build', false, 'Build the native project after dependency changes.')
      ]
    case 'deno':
      return [
        command('inspect', 'deno outdated', false, 'List outdated Deno imports.'),
        command('update', 'deno outdated --update', true, 'Update Deno dependencies where supported.'),
        command('lock', 'deno cache --reload', true, 'Refresh Deno cache and lock evidence.'),
        command('verify', 'deno test', false, 'Run Deno tests after dependency changes.')
      ]
    case 'nuget':
      return [
        command('inspect', 'dotnet list package --outdated', false, 'List outdated NuGet packages.'),
        command('audit', 'dotnet list package --vulnerable', false, 'List vulnerable NuGet packages.'),
        command('verify', 'dotnet test', false, 'Run .NET tests after dependency changes.'),
        command('lock', 'dotnet restore --use-lock-file', true, 'Refresh packages.lock.json.')
      ]
    case 'composer':
      return [
        command('inspect', 'composer outdated', false, 'List outdated Composer packages.'),
        command('update', 'composer update', true, 'Update Composer dependencies and lockfile.', 'composer update --dry-run'),
        command('audit', 'composer audit', false, 'Audit Composer advisories.'),
        command('verify', 'composer validate', false, 'Validate composer.json and composer.lock.')
      ]
    case 'bundler':
      return [
        command('inspect', 'bundle outdated', false, 'List outdated Ruby gems.'),
        command('update', 'bundle update', true, 'Update Bundler dependencies and Gemfile.lock.'),
        command('audit', 'bundle audit check', false, 'Audit Ruby gems where bundle-audit is installed.'),
        command('lock', 'bundle lock', true, 'Refresh Gemfile.lock.')
      ]
    case 'swiftpm':
      return [
        command('inspect', 'swift package show-dependencies', false, 'Inspect Swift package dependencies.'),
        command('update', 'swift package update', true, 'Update Package.resolved.'),
        command('verify', 'swift test', false, 'Run Swift tests after dependency changes.')
      ]
    case 'cocoapods':
      return [
        command('inspect', 'pod outdated', false, 'List outdated CocoaPods dependencies.'),
        command('update', 'pod update', true, 'Update Pods and Podfile.lock.'),
        command('lock', 'pod install', true, 'Install and refresh Podfile.lock.')
      ]
    case 'helm':
      return [
        command('inspect', 'helm dependency list', false, 'List Helm chart dependencies.'),
        command('update', 'helm dependency update', true, 'Update Chart.lock and chart archives.'),
        command('verify', 'helm lint .', false, 'Lint the chart after dependency changes.'),
        command('lock', 'helm dependency build', true, 'Rebuild chart dependencies from Chart.lock.')
      ]
    case 'docker':
      return [
        command('inspect', 'docker compose images', false, 'Inspect currently resolved Compose images.'),
        command('update', 'docker compose pull', true, 'Pull newer service image tags.'),
        command('verify', 'docker compose config', false, 'Validate Compose configuration after image changes.')
      ]
    case 'bazel':
      return [
        command('inspect', 'bazel mod graph', false, 'Inspect Bazel module and ruleset dependencies.'),
        command('update', 'bazel mod tidy', true, 'Refresh MODULE.bazel and MODULE.bazel.lock after module changes.'),
        command('verify', 'bazel query //...', false, 'Validate build graph query resolution.'),
        command('lock', 'bazel mod tidy', true, 'Regenerate Bazel module lock evidence.')
      ]
    case 'pants':
      return [
        command('inspect', 'pants dependencies ::', false, 'Inspect inferred Pants dependency graph.'),
        command('update', 'pants generate-lockfiles', true, 'Refresh Pants resolve lockfiles.'),
        command('verify', 'pants lint ::', false, 'Lint Pants targets after dependency changes.'),
        command('lock', 'pants generate-lockfiles', true, 'Regenerate Pants lockfiles.')
      ]
    case 'buck':
      return [
        command('inspect', 'buck2 query //...', false, 'Inspect Buck target graph.'),
        command('audit', 'buck2 audit dependencies //...', false, 'Audit Buck dependencies where Buck2 supports dependency audit output.'),
        command('verify', 'buck2 targets //...', false, 'Validate Buck target discovery after dependency changes.')
      ]
    default:
      return []
  }
}

function sortUpdatePlanItems(items: WorkspaceUpdatePlanItem[]): WorkspaceUpdatePlanItem[] {
  return [...items].sort((a, b) => {
    const risk = updateRiskRank(b.risk) - updateRiskRank(a.risk)
    if (risk !== 0) return risk
    return a.workspaceRelativePath.localeCompare(b.workspaceRelativePath)
      || a.managerId.localeCompare(b.managerId)
  })
}

function summarizeUpdatePlan(items: WorkspaceUpdatePlanItem[]): WorkspaceUpdatePlanSummary {
  return {
    itemCount: items.length,
    workspaceCount: new Set(items.map((item) => item.workspaceId)).size,
    managerCount: new Set(items.map((item) => item.managerId)).size,
    blocked: items.filter((item) => item.status === 'blocked').length,
    needsReview: items.filter((item) => item.status === 'needs-review').length,
    ready: items.filter((item) => item.status === 'ready').length,
    highRisk: items.filter((item) => item.risk === 'blocked' || item.risk === 'high').length,
    mediumRisk: items.filter((item) => item.risk === 'medium').length,
    missingLockfile: items.filter((item) => item.missingLockfile).length,
    missingSnapshot: items.filter((item) => item.snapshotSource === 'none').length,
    mutatingCommandCount: items.flatMap((item) => item.commands).filter((command) => command.mutating).length,
    dryRunCommandCount: items.flatMap((item) => item.commands).filter((command) => command.dryRunCommand).length,
    auditCommandCount: items.flatMap((item) => item.commands).filter((command) => command.stage === 'audit').length,
    lockCommandCount: items.flatMap((item) => item.commands).filter((command) => command.stage === 'lock').length
  }
}

function updateRiskRank(risk: WorkspaceUpdatePlanRisk): number {
  return {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    blocked: 4
  }[risk]
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})
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

function ageInDays(value: string | undefined, now: Date): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, (now.getTime() - timestamp) / 86400000)
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

function formatReleaseException(record: ReleaseExceptionReport['records'][number]): string {
  const expires = record.expiresAt ? `; expires ${record.expiresAt}` : ''
  const target = [
    record.reviewer,
    record.scope,
    record.ticket
  ].filter(Boolean).join(' / ')
  return `${record.decision}: ${target} for ${record.checkIds.join(', ')} at ${record.decidedAt}${expires} (${record.reason})`
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

function renderWorkspaceCycloneDx(report: SupplyChainReport, node: WorkspaceGovernanceNode): unknown {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: report.generatedAt,
      tools: [
        {
          vendor: 'DependencyHub Desktop',
          name: 'Dependency Manager Framework',
          version: '1.0.0'
        }
      ],
      component: {
        type: 'application',
        name: node.workspace.name,
        version: node.workspace.version || 'NOASSERTION',
        properties: workspaceSbomProperties(node)
      }
    },
    components: report.components.map((component) => ({
      type: component.managerId === 'docker' ? 'container' : 'library',
      name: component.name,
      version: component.version || 'NOASSERTION',
      purl: component.packageUrl,
      licenses: component.license ? [{ license: { id: component.license } }] : undefined,
      properties: [
        { name: 'dependency.manager', value: component.managerId },
        { name: 'dependency.ecosystem', value: component.ecosystem },
        { name: 'dependency.scope', value: component.scope },
        { name: 'dependency.sourceFile', value: component.sourceFile },
        { name: 'workspace.id', value: node.workspace.id },
        { name: 'workspace.relativePath', value: node.workspace.relativePath }
      ]
    }))
  }
}

function renderWorkspaceSpdx(report: SupplyChainReport, node: WorkspaceGovernanceNode): unknown {
  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `Dependency inventory for ${node.workspace.name}`,
    documentNamespace: `https://npm-desktop-manager.local/spdx/workspace/${encodeURIComponent(node.workspace.id)}/${randomUUID()}`,
    creationInfo: {
      created: report.generatedAt,
      creators: ['Tool: DependencyHub Desktop-Dependency-Manager-Framework-1.0.0'],
      comment: `workspace=${node.workspace.relativePath}; status=${node.status}; managers=${node.workspace.managerIds.join(',') || '-'}`
    },
    packages: report.components.map((component, index) => ({
      SPDXID: `SPDXRef-Package-${safeSpdxId(component.name)}-${index + 1}`,
      name: component.name,
      versionInfo: component.version || 'NOASSERTION',
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded: component.license || 'NOASSERTION',
      licenseDeclared: component.license || 'NOASSERTION',
      supplier: 'NOASSERTION',
      externalRefs: component.packageUrl ? [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: component.packageUrl
        }
      ] : [],
      annotations: [
        {
          annotationType: 'OTHER',
          annotator: 'Tool: DependencyHub Desktop',
          annotationDate: report.generatedAt,
          comment: `workspace=${node.workspace.relativePath}; manager=${component.managerId}; ecosystem=${component.ecosystem}; scope=${component.scope}; source=${component.sourceFile}`
        }
      ]
    }))
  }
}

function workspaceSbomProperties(node: WorkspaceGovernanceNode): Array<{ name: string; value: string }> {
  return [
    { name: 'workspace.id', value: node.workspace.id },
    { name: 'workspace.relativePath', value: node.workspace.relativePath },
    { name: 'workspace.kind', value: node.workspace.kind },
    { name: 'workspace.status', value: node.status },
    { name: 'workspace.managers', value: node.workspace.managerIds.join(',') || '-' },
    { name: 'workspace.readinessStatus', value: node.readinessStatus },
    { name: 'workspace.policySource', value: node.policySource },
    { name: 'workspace.snapshotSource', value: node.snapshotSource }
  ]
}

function workspaceArtifactName(workspace: WorkspaceNode): string {
  const base = workspace.relativePath === '.'
    ? 'root'
    : workspace.relativePath
  return base
    .replace(/\\/g, '/')
    .replace(/[^a-zA-Z0-9._/-]+/g, '-')
    .replace(/[/.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'workspace'
}

function safeSpdxId(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/^-+|-+$/g, '') || 'dependency'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderMarkdown(report: WorkspaceGovernanceReport): string {
  const lines = [
    '# Workspace Governance Report',
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
    `- Components: ${report.summary.componentCount}`,
    `- Policy violations: ${report.summary.policyViolationCount}`,
    `- High-severity policy violations: ${report.summary.highSeverityPolicyViolationCount}`,
    `- Snapshots: ${report.summary.snapshotCount}`,
    `- Workspace-local snapshots: ${report.summary.workspaceSnapshotCount}`,
    `- Inherited snapshot workspaces: ${report.summary.inheritedSnapshotWorkspaceCount}`,
    `- Missing snapshot workspaces: ${report.summary.missingSnapshotWorkspaceCount}`,
    `- Inherited snapshot covered files: ${report.summary.inheritedSnapshotCoveredFileCount}`,
    `- Missing-lock workspaces: ${report.summary.missingLockWorkspaceCount}`,
    `- Workspace-local policies: ${report.summary.workspacePolicyCount}`,
    `- Inherited policies: ${report.summary.inheritedPolicyWorkspaceCount}`,
    `- Missing policies: ${report.summary.missingPolicyWorkspaceCount}`,
    `- Readiness ready: ${report.summary.readinessReady}`,
    `- Readiness warning: ${report.summary.readinessWarning}`,
    `- Readiness blocked: ${report.summary.readinessBlocked}`,
    `- Workspace-local readiness policies: ${report.summary.workspaceReadinessPolicyCount}`,
    `- Inherited readiness policies: ${report.summary.inheritedReadinessPolicyWorkspaceCount}`,
    `- Default readiness policies: ${report.summary.defaultReadinessPolicyWorkspaceCount}`,
    `- CI evidence records: ${report.summary.ciEvidenceRecordCount}`,
    `- Workspace-local CI evidence: ${report.summary.workspaceCiEvidenceCount}`,
    `- Inherited CI evidence: ${report.summary.inheritedCiEvidenceWorkspaceCount}`,
    `- Missing CI evidence: ${report.summary.missingCiEvidenceWorkspaceCount}`,
    `- Failed CI evidence workspaces: ${report.summary.failedCiEvidenceWorkspaceCount}`,
    `- Release approval records: ${report.summary.releaseApprovalRecordCount}`,
    `- Active release approvals: ${report.summary.activeReleaseApprovalCount}`,
    `- Workspace-local release approval evidence: ${report.summary.workspaceReleaseApprovalEvidenceCount}`,
    `- Inherited release approval evidence: ${report.summary.inheritedReleaseApprovalEvidenceWorkspaceCount}`,
    `- Missing release approval evidence: ${report.summary.missingReleaseApprovalEvidenceWorkspaceCount}`,
    `- Rejected release approval workspaces: ${report.summary.rejectedReleaseApprovalWorkspaceCount}`,
    `- Release exception records: ${report.summary.releaseExceptionRecordCount}`,
    `- Active release exceptions: ${report.summary.activeReleaseExceptionCount}`,
    `- Workspace-local release exception evidence: ${report.summary.workspaceReleaseExceptionEvidenceCount}`,
    `- Inherited release exception evidence: ${report.summary.inheritedReleaseExceptionEvidenceWorkspaceCount}`,
    `- Missing release exception evidence: ${report.summary.missingReleaseExceptionEvidenceWorkspaceCount}`,
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    '',
    '## Workspaces',
    '',
    '| Workspace | Status | Score | Release gate | CI | CI source | Approvals | Approval source | Exceptions | Exception source | Managers | Components | Policy | Source | Snapshots | Snapshot source | Missing locks |',
    '| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | --- | --- |'
  ]

  for (const node of report.workspaces) {
    lines.push([
      markdownCell(`${node.workspace.name} (${node.workspace.relativePath})`),
      node.status,
      String(node.score),
      `${node.readinessStatus} ${node.readinessScore}`,
      `${node.ciEvidenceCount} ${node.latestCiStatus || '-'}`,
      node.ciEvidenceSource,
      `${node.activeReleaseApprovalCount}/${node.releaseApprovalCount} ${node.latestReleaseApprovalDecision || '-'}`,
      node.releaseApprovalSource,
      `${node.activeReleaseExceptionCount}/${node.releaseExceptionCount} ${node.latestReleaseExceptionDecision || '-'}`,
      node.releaseExceptionSource,
      markdownCell(node.workspace.managerIds.join(', ') || '-'),
      String(node.componentCount),
      String(node.policyViolationCount),
      node.policySource,
      String(node.snapshotCount),
      node.snapshotSource,
      markdownCell(node.missingLockManagers.join(', ') || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  for (const node of report.workspaces) {
    lines.push(`### ${node.workspace.name} (${node.workspace.relativePath})`, '')
    for (const item of node.findings) {
      lines.push(`- ${item.severity}: ${item.title} - ${item.summary}`)
      if (item.evidence.length > 0) {
        lines.push(...item.evidence.slice(0, 6).map((evidence) => `  - ${evidence}`))
      }
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function renderEvidenceMarkdown(manifest: WorkspaceReleaseEvidenceManifest): string {
  const lines = [
    '# Workspace Release Evidence Manifest',
    '',
    `Generated: ${manifest.generatedAt}`,
    `Project: ${manifest.projectPath}`,
    `Governance report: ${manifest.governanceGeneratedAt}`,
    '',
    '## Summary',
    '',
    `- Workspaces: ${manifest.summary.workspaceCount}`,
    `- Ready: ${manifest.summary.ready}`,
    `- Warning: ${manifest.summary.warning}`,
    `- Blocked: ${manifest.summary.blocked}`,
    `- Components: ${manifest.summary.componentCount}`,
    `- Policy violations: ${manifest.summary.policyViolationCount}`,
    `- High-severity policy violations: ${manifest.summary.highSeverityPolicyViolationCount}`,
    `- Workspace-local snapshots: ${manifest.summary.workspaceSnapshotCount}`,
    `- Inherited snapshot workspaces: ${manifest.summary.inheritedSnapshotWorkspaceCount}`,
    `- Inherited snapshot covered files: ${manifest.summary.inheritedSnapshotCoveredFileCount}`,
    `- CI evidence records: ${manifest.summary.ciEvidenceRecordCount}`,
    `- Inherited CI evidence workspaces: ${manifest.summary.inheritedCiEvidenceWorkspaceCount}`,
    `- Failed CI evidence workspaces: ${manifest.summary.failedCiEvidenceWorkspaceCount}`,
    `- Release approval records: ${manifest.summary.releaseApprovalRecordCount}`,
    `- Active release approvals: ${manifest.summary.activeReleaseApprovalCount}`,
    `- Inherited approval workspaces: ${manifest.summary.inheritedReleaseApprovalEvidenceWorkspaceCount}`,
    `- Rejected approval workspaces: ${manifest.summary.rejectedReleaseApprovalWorkspaceCount}`,
    `- Release exception records: ${manifest.summary.releaseExceptionRecordCount}`,
    `- Active release exceptions: ${manifest.summary.activeReleaseExceptionCount}`,
    `- Inherited exception workspaces: ${manifest.summary.inheritedReleaseExceptionEvidenceWorkspaceCount}`,
    `- Managers: ${manifest.summary.managers.join(', ') || '-'}`,
    '',
    '## Evidence Index',
    '',
    '| Workspace | Status | Gate | CI | Approvals | Exceptions | Components | Snapshots | Snapshot source | Policy | CI source | Approval source | Exception source | Top finding |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |'
  ]

  for (const item of manifest.workspaces) {
    const topFinding = item.findings.find((finding) => finding.severity === 'blocked')
      || item.findings.find((finding) => finding.severity === 'warning')
      || item.findings[0]
    lines.push([
      markdownCell(`${item.workspace.name} (${item.workspace.relativePath})`),
      item.status,
      `${item.readiness.status} ${item.readiness.score}`,
      `${item.ciEvidence.count} ${item.ciEvidence.latestStatus || '-'}`,
      `${item.releaseApprovals.activeCount}/${item.releaseApprovals.count} ${item.releaseApprovals.latestDecision || '-'}`,
      `${item.releaseExceptions.activeCount}/${item.releaseExceptions.count} ${item.releaseExceptions.latestDecision || '-'}`,
      String(item.components.length),
      String(item.snapshots.count),
      item.snapshots.source,
      item.policy.source,
      item.ciEvidence.source,
      item.releaseApprovals.source,
      item.releaseExceptions.source,
      markdownCell(topFinding?.summary || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  for (const item of manifest.workspaces) {
    lines.push(
      '',
      `## ${item.workspace.name} (${item.workspace.relativePath})`,
      '',
      `- Status: ${item.status} (${item.score})`,
      `- Managers: ${item.managers.join(', ') || '-'}`,
      `- Manifests: ${item.manifests.join(', ') || '-'}`,
      `- Lockfiles: ${item.lockfiles.join(', ') || '-'}`,
      `- Components: ${item.components.length}${item.componentError ? ` (${item.componentError})` : ''}`,
      `- Snapshots: ${item.snapshots.count}; source ${item.snapshots.source}; covered files ${item.snapshots.coveredFileCount}${item.snapshots.latest ? `; latest ${item.snapshots.latest.id} at ${item.snapshots.latest.createdAt}` : ''}`,
      `- Snapshot path: ${item.snapshots.path || '-'}`,
      `- Operations: ${item.operations.recentCount} recent, ${item.operations.failedCount} failed`,
      `- Policy: ${item.policy.source}${item.policy.path ? ` (${item.policy.path})` : ''}; ${item.policy.violationCount} finding(s)`,
      `- Readiness: ${item.readiness.status} ${item.readiness.score}; policy ${item.readiness.policySource}`,
      `- CI evidence: ${item.ciEvidence.count} record(s); source ${item.ciEvidence.source}; latest ${item.ciEvidence.latestStatus || '-'} ${item.ciEvidence.latestFinishedAt || ''}`.trim(),
      `- Approvals: ${item.releaseApprovals.activeCount}/${item.releaseApprovals.count} active; source ${item.releaseApprovals.source}; latest ${item.releaseApprovals.latestDecision || '-'}`,
      `- Exceptions: ${item.releaseExceptions.activeCount}/${item.releaseExceptions.count} active; source ${item.releaseExceptions.source}; latest ${item.releaseExceptions.latestDecision || '-'}`,
      '',
      '### Readiness Checks',
      ''
    )

    const checks = [...item.readiness.blockedChecks, ...item.readiness.warningChecks]
    if (checks.length === 0) {
      lines.push('- No blocked or warning readiness checks.')
    } else {
      for (const check of checks.slice(0, 12)) {
        lines.push(`- ${check.status}: ${check.title} - ${check.summary}`)
      }
    }

    lines.push('', '### Findings', '')
    for (const finding of item.findings.slice(0, 12)) {
      lines.push(`- ${finding.severity}: ${finding.title} - ${finding.summary}`)
    }

    lines.push('', '### Components', '')
    if (item.components.length === 0) {
      lines.push('- No dependency components were captured for this workspace.')
    } else {
      lines.push('| Manager | Package | Version | Scope | Source |', '| --- | --- | --- | --- | --- |')
      for (const component of item.components.slice(0, 25)) {
        lines.push([
          component.managerId,
          markdownCell(component.name),
          markdownCell(component.version || '-'),
          markdownCell(component.scope || '-'),
          markdownCell(component.sourceFile || '-')
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
      }
      if (item.components.length > 25) {
        lines.push(``, `_${item.components.length - 25} additional component(s) omitted from Markdown; JSON export contains the full manifest._`)
      }
    }
  }

  return `${lines.join('\n')}\n`
}

function renderRemediationPlanMarkdown(plan: WorkspaceRemediationPlan): string {
  const lines = [
    '# Workspace Remediation Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Project: ${plan.projectPath}`,
    `Readiness report: ${plan.readinessGeneratedAt || '-'}`,
    `Governance report: ${plan.governanceGeneratedAt || '-'}`,
    `Release risk profile: ${plan.releaseRiskGeneratedAt || '-'}`,
    '',
    '## Summary',
    '',
    `- Items: ${plan.summary.itemCount}`,
    `- Critical: ${plan.summary.critical}`,
    `- High: ${plan.summary.high}`,
    `- Medium: ${plan.summary.medium}`,
    `- Low: ${plan.summary.low}`,
    `- Project actions: ${plan.summary.projectItemCount}`,
    `- Workspace actions: ${plan.summary.workspaceItemCount}`,
    `- Release risk actions: ${plan.summary.releaseRiskItemCount}`,
    `- Deployment actions: ${plan.summary.deploymentItemCount}`,
    `- Affected workspaces: ${plan.summary.affectedWorkspaceCount}`,
    `- Blocked workspaces: ${plan.summary.blockedWorkspaceCount}`,
    `- Warning workspaces: ${plan.summary.warningWorkspaceCount}`,
    `- Active release exceptions: ${plan.summary.activeReleaseExceptionCount}`,
    '',
    '## Action Index',
    '',
    '| Priority | Scope | Source | Workspace | Status | Action | Recommendation |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ]

  for (const item of plan.items) {
    lines.push([
      item.priority,
      item.scope,
      item.source,
      markdownCell(item.workspaceRelativePath || '-'),
      item.status,
      markdownCell(item.title),
      markdownCell(item.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (plan.items.length === 0) {
    lines.push('| info | project | readiness | - | ready | No remediation required | Keep exporting release evidence before production changes. |')
  }

  lines.push('', '## Details', '')
  if (plan.items.length === 0) {
    lines.push('No blocked or warning remediation actions were found.')
  }

  for (const item of plan.items) {
    lines.push(
      `### ${item.priority.toUpperCase()} - ${item.title}`,
      '',
      `- Scope: ${item.scope}`,
      `- Source: ${item.source}`,
      `- Status: ${item.status}`,
      `- Workspace: ${item.workspaceName ? `${item.workspaceName} (${item.workspaceRelativePath})` : '-'}`,
      `- Managers: ${item.managers?.join(', ') || '-'}`,
      `- Summary: ${item.summary}`,
      `- Recommendation: ${item.recommendation}`,
      '',
      'Evidence:'
    )

    if (item.evidence.length === 0) {
      lines.push('- No additional evidence.')
    } else {
      lines.push(...item.evidence.slice(0, 12).map((evidence) => `- ${evidence}`))
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function renderUpdatePlanMarkdown(plan: WorkspaceUpdatePlan): string {
  const lines = [
    '# Workspace Dependency Update Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Project: ${plan.projectPath}`,
    `Governance report: ${plan.governanceGeneratedAt}`,
    '',
    '## Summary',
    '',
    `- Manager plans: ${plan.summary.itemCount}`,
    `- Workspaces: ${plan.summary.workspaceCount}`,
    `- Managers: ${plan.summary.managerCount}`,
    `- Blocked plans: ${plan.summary.blocked}`,
    `- Needs review: ${plan.summary.needsReview}`,
    `- Ready: ${plan.summary.ready}`,
    `- High risk: ${plan.summary.highRisk}`,
    `- Medium risk: ${plan.summary.mediumRisk}`,
    `- Missing lockfiles: ${plan.summary.missingLockfile}`,
    `- Missing snapshots: ${plan.summary.missingSnapshot}`,
    `- Mutating commands: ${plan.summary.mutatingCommandCount}`,
    `- Dry-run commands: ${plan.summary.dryRunCommandCount}`,
    `- Audit commands: ${plan.summary.auditCommandCount}`,
    `- Lock commands: ${plan.summary.lockCommandCount}`,
    '',
    '## Plan Index',
    '',
    '| Risk | Status | Workspace | Manager | Components | Lock | Snapshot | Commands | Recommendation |',
    '| --- | --- | --- | --- | ---: | --- | --- | ---: | --- |'
  ]

  for (const item of plan.items) {
    lines.push([
      item.risk,
      item.status,
      markdownCell(item.workspaceRelativePath),
      item.managerId,
      item.componentCount,
      item.missingLockfile ? 'missing' : 'covered',
      item.snapshotSource,
      item.commands.length,
      markdownCell(item.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (plan.items.length === 0) {
    lines.push('| info | ready | - | - | 0 | - | - | 0 | No dependency managers were detected. |')
  }

  lines.push('', '## Workspace Commands', '')
  for (const item of plan.items) {
    lines.push(
      `### ${item.workspaceRelativePath} - ${item.managerId}`,
      '',
      `- Status: ${item.status}`,
      `- Risk: ${item.risk}`,
      `- Ecosystem: ${item.ecosystem}`,
      `- Tool: ${item.tool}`,
      `- Components: ${item.componentCount}`,
      `- Manifest files: ${item.manifestFiles.join(', ') || '-'}`,
      `- Lock files: ${item.lockFiles.join(', ') || '-'}`,
      `- Snapshot source: ${item.snapshotSource} (${item.snapshotCount})`,
      `- Readiness: ${item.readinessStatus}; ${item.readinessBlockedCheckCount} blocked / ${item.readinessWarningCheckCount} warning`,
      `- Recommendation: ${item.recommendation}`,
      '',
      '| Stage | Mutating | Command | Dry run | Purpose |',
      '| --- | --- | --- | --- | --- |'
    )

    for (const command of item.commands) {
      lines.push([
        command.stage,
        command.mutating ? 'yes' : 'no',
        markdownCell(command.command),
        markdownCell(command.dryRunCommand || '-'),
        markdownCell(command.purpose)
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }

    if (item.commands.length === 0) {
      lines.push('| inspect | no | - | - | No generic command is available for this manager. |')
    }

    if (item.warnings.length > 0) {
      lines.push('', 'Warnings:', ...item.warnings.map((warning) => `- ${warning}`))
    }

    lines.push('', 'Evidence:', ...item.evidence.map((evidence) => `- ${evidence}`), '')
  }

  return `${lines.join('\n')}\n`
}

function renderReleaseBundleMarkdown(manifest: ReleaseBundleManifest): string {
  const requiredFailures = manifest.artifacts.filter((artifact) => artifact.required && !artifact.ok)
  const optionalFailures = manifest.artifacts.filter((artifact) => !artifact.required && !artifact.ok)
  const successfulArtifacts = manifest.artifacts.filter((artifact) => artifact.ok)
  const lines = [
    '# Release Bundle',
    '',
    `Generated: ${manifest.generatedAt}`,
    `Project: ${manifest.projectPath}`,
    `Status: ${manifest.status}`,
    `Score: ${manifest.score}`,
    '',
    '## Summary',
    '',
    `- Workspaces: ${manifest.summary.workspaceCount}`,
    `- Ready workspaces: ${manifest.summary.readyWorkspaces}`,
    `- Warning workspaces: ${manifest.summary.warningWorkspaces}`,
    `- Blocked workspaces: ${manifest.summary.blockedWorkspaces}`,
    `- Components: ${manifest.summary.componentCount}`,
    `- Artifacts: ${manifest.summary.artifactCount}`,
    `- Successful artifacts: ${successfulArtifacts.length}`,
    `- Failed artifacts: ${manifest.summary.failedArtifactCount}`,
    `- Required artifacts: ${manifest.summary.requiredArtifactCount}`,
    `- Required artifact failures: ${manifest.summary.requiredFailedArtifactCount}`,
    `- Optional artifact failures: ${manifest.summary.optionalFailedArtifactCount}`,
    '',
    '## Artifact Index',
    '',
    '| Artifact | Kind | Format | Required | Status | Count | Components | Size | SHA-256 | Path |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |'
  ]

  for (const artifact of manifest.artifacts) {
    lines.push([
      markdownCell(artifact.label),
      artifact.kind,
      artifact.format,
      artifact.required ? 'yes' : 'no',
      artifact.ok ? 'ok' : 'failed',
      artifact.workspaceCount ?? artifact.count ?? '-',
      artifact.componentCount ?? '-',
      artifact.sizeBytes ?? '-',
      artifact.sha256 ? artifact.sha256.slice(0, 16) : '-',
      markdownCell(artifact.path || artifact.error || '-')
    ].map(String).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (requiredFailures.length > 0) {
    lines.push('', '## Required Failures', '')
    for (const artifact of requiredFailures) {
      lines.push(`- ${artifact.label} (${artifact.format}): ${artifact.error || 'unknown error'}`)
    }
  }

  if (optionalFailures.length > 0) {
    lines.push('', '## Optional Gaps', '')
    for (const artifact of optionalFailures) {
      lines.push(`- ${artifact.label} (${artifact.format}): ${artifact.error || 'not available'}`)
    }
  }

  lines.push(
    '',
    '## Release Evidence Coverage',
    '',
    '- Readiness reports: release gate status, policy thresholds, toolchain state, supply-chain checks, CI, approvals, registries, and publish blockers.',
    '- Workspace discovery and governance: monorepo partitions, manager coverage, inherited root evidence, local overrides, lockfile gaps, and per-workspace findings.',
    '- Workspace release evidence: manifests, lockfiles, SBOM components, snapshots, failed operations, CI source, approval source, and readiness findings for each workspace.',
    '- Remediation plan: prioritized project and workspace actions derived from readiness gates, governance findings, and release evidence gaps.',
    '- Workspace dependency update plan: non-mutating review plan with inspect, update, audit, verification, lockfile, dry-run, and rollback guidance for every workspace manager.',
    '- Workspace CycloneDX SBOMs and Workspace SPDX SBOMs: per-workspace machine-readable dependency artifacts plus root manifests.',
    '- Root SBOMs and dependency report: repository-level supply-chain exports for consumers that do not consume workspace partition evidence.',
    '- License compliance matrix: allowed, blocked, not-allowed, unrestricted, and unknown license evidence tied back to dependency policy.',
    '- Third-party notices: release-ready dependency attribution files generated from the license compliance inventory for distribution review.',
    '- Release exceptions: short-lived reviewer-approved readiness gate exceptions that explain any temporary production risk acceptance.',
    '- Audit evidence: imported npm audit, pip-audit, OSV, SARIF, cargo audit, Trivy, govulncheck, and generic vulnerability scan findings normalized for release review.',
    '- Vulnerability remediation plan: package-level security fix actions, recommended manager commands, and verification commands derived from imported audit evidence.',
    '- Release provenance attestation: project, Git source, release bundle, evidence completeness, and SHA-256 report digests for audit and reproducibility sign-off.',
    '- Credential usage map: metadata-only registry credential coverage, missing private-feed credentials, insecure storage warnings, and unused credentials.',
    '- Lockfile drift report: manifest-to-lockfile freshness, inherited workspace lock coverage, mixed lockfile families, and packageManager alignment.',
    '- Runtime pinning report: language/runtime version pins, package-manager pins, build-tool wrappers, inherited runtime evidence, and floating container tags.',
    '- Offline cache readiness: lockfile coverage, cache/mirror configuration, offline restore commands, and vendored dependency evidence for isolated installs.',
    '- Release risk profile: normalized release-decision risk across readiness, supply chain, licenses, registries, credentials, reproducibility, workspaces, and operations.',
    '- Dependency ownership plan: CODEOWNERS-backed workspace and manager ownership map with automated update review routing, missing owner findings, and suggested CODEOWNERS entries.',
    '- Dependency upgrade playbook: lane-based dependency upgrade runbook with owners, commands, verification steps, and security/risk prioritization.',
    '- Dependency rollback plan: managed snapshot, source-control restore, lockfile restore, rehydration, and verification coverage for planned dependency changes.',
    '- Dependency impact analysis: blast-radius matrix mapping planned dependency updates to workspaces, owners, CI jobs, release gates, rollback readiness, and verification commands.',
    '- Dependency change approval packet: reviewer-ready approval checklist, participant list, trust/rollback/approval counters, and impacted scope matrix.',
    '- Dependency change calendar: change windows, freeze windows, calendar events, CI freeze gate, and ticket template for scheduling governed dependency changes.',
    '- Dependency change execution record: post-change audit trail joining scheduled windows, operation history, CI evidence, evidence gaps, and sign-off or rollback recommendations.',
    '- Policy-as-code pack: normalized dependency policy, readiness policy, automation safety, ownership routing, required CI secrets, and a suggested GitHub Actions policy check.',
    '- Optional operational evidence: dependency risk diff, operation history, CI evidence, release approvals, and registry reachability when available.'
  )

  return `${lines.join('\n')}\n`
}

function renderReleaseDashboardHtml(manifest: ReleaseBundleManifest): string {
  const requiredFailures = manifest.artifacts.filter((artifact) => artifact.required && !artifact.ok)
  const optionalFailures = manifest.artifacts.filter((artifact) => !artifact.required && !artifact.ok)
  const successfulArtifacts = manifest.artifacts.filter((artifact) => artifact.ok)
  const requiredOk = manifest.summary.requiredArtifactCount - manifest.summary.requiredFailedArtifactCount
  const statusClass = htmlClassName(manifest.status)
  const riskClass = manifest.summary.requiredFailedArtifactCount > 0
    ? 'blocked'
    : manifest.summary.failedArtifactCount > 0 || manifest.status === 'warning'
      ? 'warning'
      : 'ready'

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Release Review Dashboard</title>',
    '<style>',
    ':root { color-scheme: light dark; font-family: Inter, Segoe UI, Arial, sans-serif; background: #101418; color: #eef3f8; }',
    '* { box-sizing: border-box; }',
    'body { margin: 0; background: #101418; color: #eef3f8; }',
    'main { max-width: 1280px; margin: 0 auto; padding: 28px; }',
    'header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 22px; }',
    'h1, h2 { margin: 0; letter-spacing: 0; }',
    'h1 { font-size: 28px; line-height: 1.2; }',
    'h2 { font-size: 18px; margin-bottom: 12px; }',
    '.subtle { color: #9fb0c0; font-size: 13px; word-break: break-all; }',
    '.badge { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }',
    '.ready { background: #143d2a; color: #88f0b4; border: 1px solid #2b8556; }',
    '.warning { background: #44310d; color: #ffd27d; border: 1px solid #94691d; }',
    '.blocked { background: #4a171d; color: #ff9aa6; border: 1px solid #9e3341; }',
    '.info { background: #17283d; color: #9dc9ff; border: 1px solid #315783; }',
    '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(178px, 1fr)); gap: 12px; margin-bottom: 18px; }',
    '.metric, section { background: #171d23; border: 1px solid #2a3540; border-radius: 8px; }',
    '.metric { padding: 14px; }',
    '.metric .label { color: #9fb0c0; font-size: 12px; }',
    '.metric .value { display: block; margin-top: 8px; font-size: 24px; font-weight: 800; }',
    'section { padding: 16px; margin-top: 14px; }',
    '.summary { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }',
    '.summary span { border: 1px solid #2a3540; border-radius: 999px; padding: 5px 9px; color: #c9d6e2; font-size: 12px; }',
    'table { width: 100%; border-collapse: collapse; font-size: 13px; }',
    'th, td { border-bottom: 1px solid #2a3540; padding: 8px 7px; text-align: left; vertical-align: top; }',
    'th { color: #b9c8d6; font-size: 12px; text-transform: uppercase; }',
    'td.path { max-width: 340px; word-break: break-all; }',
    'a { color: #8dc7ff; text-decoration: none; }',
    'a:hover { text-decoration: underline; }',
    '.decision { border-left: 4px solid #315783; padding-left: 12px; color: #d9e4ee; }',
    `.decision.${riskClass} { border-left-color: ${riskClass === 'blocked' ? '#d0485a' : riskClass === 'warning' ? '#d49a35' : '#2b8556'}; }`,
    '@media (max-width: 760px) { main { padding: 16px; } header { flex-direction: column; } table { display: block; overflow-x: auto; white-space: nowrap; } }',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<header>',
    '<div>',
    '<h1>Release Review Dashboard</h1>',
    `<div class="subtle">Generated ${htmlEscape(manifest.generatedAt)} for ${htmlEscape(manifest.projectPath)}</div>`,
    '</div>',
    `<span class="badge ${statusClass}">${htmlEscape(manifest.status)}</span>`,
    '</header>',
    '<div class="grid">',
    metricCard('Score', `${manifest.score}/100`),
    metricCard('Workspaces', String(manifest.summary.workspaceCount)),
    metricCard('Blocked workspaces', String(manifest.summary.blockedWorkspaces)),
    metricCard('Components', String(manifest.summary.componentCount)),
    metricCard('Artifacts', String(manifest.summary.artifactCount)),
    metricCard('Required coverage', `${requiredOk}/${manifest.summary.requiredArtifactCount}`),
    '</div>',
    '<section>',
    '<h2>Release Decision</h2>',
    `<p class="decision ${riskClass}">${htmlEscape(releaseDashboardDecision(manifest))}</p>`,
    '<div class="summary">',
    `<span>Ready workspaces: ${manifest.summary.readyWorkspaces}</span>`,
    `<span>Warning workspaces: ${manifest.summary.warningWorkspaces}</span>`,
    `<span>Blocked workspaces: ${manifest.summary.blockedWorkspaces}</span>`,
    `<span>Successful artifacts: ${successfulArtifacts.length}</span>`,
    `<span>Failed artifacts: ${manifest.summary.failedArtifactCount}</span>`,
    `<span>Required failures: ${manifest.summary.requiredFailedArtifactCount}</span>`,
    `<span>Optional gaps: ${manifest.summary.optionalFailedArtifactCount}</span>`,
    '</div>',
    '</section>',
    renderDashboardFailureSection('Required Failures', requiredFailures),
    renderDashboardFailureSection('Optional Evidence Gaps', optionalFailures),
    '<section>',
    '<h2>Evidence Artifacts</h2>',
    '<table>',
    '<thead><tr><th>Artifact</th><th>Kind</th><th>Format</th><th>Required</th><th>Status</th><th>Count</th><th>Components</th><th>Size</th><th>SHA-256</th><th>Path</th></tr></thead>',
    '<tbody>',
    ...manifest.artifacts.map(renderDashboardArtifactRow),
    '</tbody>',
    '</table>',
    '</section>',
    '<section>',
    '<h2>Coverage Checklist</h2>',
    '<div class="summary">',
    ...releaseDashboardChecklist(manifest).map((item) => `<span>${htmlEscape(item)}</span>`),
    '</div>',
    '</section>',
    '</main>',
    '</body>',
    '</html>'
  ].join('\n')
}

function metricCard(label: string, value: string): string {
  return `<div class="metric"><span class="label">${htmlEscape(label)}</span><span class="value">${htmlEscape(value)}</span></div>`
}

function releaseDashboardDecision(manifest: ReleaseBundleManifest): string {
  if (manifest.summary.requiredFailedArtifactCount > 0) {
    return 'Do not approve release yet: at least one required evidence artifact failed to export. Resolve required failures and regenerate the bundle.'
  }
  if (manifest.status === 'blocked') {
    return 'Release is blocked by readiness or workspace governance evidence. Review remediation actions, exceptions, approvals, and CI before publishing.'
  }
  if (manifest.status === 'warning' || manifest.summary.optionalFailedArtifactCount > 0) {
    return 'Release can move to reviewer assessment with warnings. Inspect optional evidence gaps, active exceptions, registry results, and remediation actions.'
  }
  return 'Release evidence is complete and ready for reviewer sign-off.'
}

function renderDashboardFailureSection(title: string, artifacts: ReleaseBundleArtifact[]): string {
  if (artifacts.length === 0) return ''
  return [
    '<section>',
    `<h2>${htmlEscape(title)}</h2>`,
    '<table>',
    '<thead><tr><th>Artifact</th><th>Format</th><th>Error</th></tr></thead>',
    '<tbody>',
    ...artifacts.map((artifact) => [
      '<tr>',
      `<td>${htmlEscape(artifact.label)}</td>`,
      `<td>${htmlEscape(artifact.format)}</td>`,
      `<td>${htmlEscape(artifact.error || 'Unknown error')}</td>`,
      '</tr>'
    ].join('')),
    '</tbody>',
    '</table>',
    '</section>'
  ].join('\n')
}

function renderDashboardArtifactRow(artifact: ReleaseBundleArtifact): string {
  const statusClass = artifact.ok ? 'ready' : artifact.required ? 'blocked' : 'warning'
  const count = artifact.workspaceCount ?? artifact.count ?? '-'
  const components = artifact.componentCount ?? '-'
  const path = artifact.path || artifact.error || '-'
  return [
    '<tr>',
    `<td>${htmlEscape(artifact.label)}</td>`,
    `<td>${htmlEscape(artifact.kind)}</td>`,
    `<td>${htmlEscape(artifact.format)}</td>`,
    `<td>${artifact.required ? 'yes' : 'no'}</td>`,
    `<td><span class="badge ${statusClass}">${artifact.ok ? 'ok' : 'failed'}</span></td>`,
    `<td>${htmlEscape(String(count))}</td>`,
    `<td>${htmlEscape(String(components))}</td>`,
    `<td>${artifact.sizeBytes ? htmlEscape(formatBytes(artifact.sizeBytes)) : '-'}</td>`,
    `<td>${artifact.sha256 ? htmlEscape(artifact.sha256.slice(0, 16)) : '-'}</td>`,
    `<td class="path">${artifact.path ? `<a href="${htmlEscape(fileHref(artifact.path))}">${htmlEscape(artifact.path)}</a>` : htmlEscape(path)}</td>`,
    '</tr>'
  ].join('')
}

function releaseDashboardChecklist(manifest: ReleaseBundleManifest): string[] {
  const kinds = new Set(manifest.artifacts.filter((artifact) => artifact.ok).map((artifact) => artifact.kind))
  const checks = [
    ['Readiness gate', 'readiness'],
    ['Workspace discovery', 'workspace-discovery'],
    ['Workspace governance', 'workspace-governance'],
    ['Workspace release evidence', 'workspace-release-evidence'],
    ['Remediation plan', 'remediation-plan'],
    ['Dependency update plan', 'update-plan'],
    ['Workspace SBOMs', 'workspace-sbom'],
    ['Root SBOMs', 'root-sbom'],
    ['License compliance', 'license-compliance'],
    ['Third-party notices', 'third-party-notices'],
    ['Release exceptions', 'release-exception'],
    ['Audit evidence', 'audit-evidence'],
    ['Vulnerability remediation plan', 'vulnerability-remediation-plan'],
    ['Release provenance attestation', 'release-provenance-attestation'],
    ['Credential usage map', 'credential-usage'],
    ['Lockfile drift report', 'lockfile-drift'],
    ['Runtime pinning report', 'runtime-pinning'],
    ['Offline cache readiness', 'offline-cache-readiness'],
    ['Release risk profile', 'release-risk-profile'],
    ['CI integration plan', 'ci-integration-plan'],
    ['Dependency automation plan', 'dependency-automation-plan'],
    ['Credential rotation plan', 'credential-rotation-plan'],
    ['Automation safety plan', 'automation-safety-plan'],
    ['Dependency ownership plan', 'dependency-ownership-plan'],
    ['Dependency upgrade playbook', 'dependency-upgrade-playbook'],
    ['Dependency rollback plan', 'dependency-rollback-plan'],
    ['Dependency impact analysis', 'dependency-impact-analysis'],
    ['Dependency change approval packet', 'dependency-change-approval-packet'],
    ['Dependency change calendar', 'dependency-change-calendar'],
    ['Dependency change execution record', 'dependency-change-execution-record'],
    ['Policy-as-code pack', 'policy-as-code-pack'],
    ['Registry reachability', 'registry-reachability']
  ] as const

  return checks.map(([label, kind]) => `${kinds.has(kind) ? 'OK' : 'Missing'} - ${label}`)
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlClassName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
}

function fileHref(path: string): string {
  return pathToFileURL(path).href
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
