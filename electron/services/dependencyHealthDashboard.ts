import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  SupplyChainService,
  type DependencyComponentDiff,
  type DependencyRiskLevel,
  type DependencyPolicyEvaluation,
  type LicenseComplianceReport,
  type SupplyChainReport
} from './supplyChain'
import {
  ReadinessGateService,
  type ReadinessGateReport,
  type ReadinessGateStatus
} from './readinessGate'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport
} from './workspaceDiscovery'
import {
  WorkspaceGovernanceService,
  type WorkspaceGovernanceReport
} from './workspaceGovernance'
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
  type OfflineCacheReadinessReport
} from './offlineCacheReadiness'
import {
  ReleaseRiskProfileService,
  type ReleaseRiskProfileReport,
  type ReleaseRiskSeverity
} from './releaseRiskProfile'
import {
  CredentialUsageService,
  type CredentialUsageReport
} from './credentialUsage'
import {
  RegistryReachabilityService,
  type RegistryReachabilityReport
} from './registryReachability'
import {
  AuditEvidenceService,
  type AuditEvidenceReport,
  type AuditEvidenceSeverity
} from './auditEvidence'

export type DependencyHealthDashboardStatus = ReadinessGateStatus
export type DependencyHealthDashboardSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type DependencyHealthDashboardSourceId =
  | 'supply-chain'
  | 'dependency-policy'
  | 'license-compliance'
  | 'dependency-diff'
  | 'readiness'
  | 'workspace-discovery'
  | 'workspace-governance'
  | 'lockfile-drift'
  | 'runtime-pinning'
  | 'offline-cache-readiness'
  | 'release-risk-profile'
  | 'credential-usage'
  | 'registry-reachability'
  | 'audit-evidence'

export interface DependencyHealthDashboardRisk {
  id: string
  source: DependencyHealthDashboardSourceId
  severity: DependencyHealthDashboardSeverity
  title: string
  summary: string
  recommendation: string
  evidence: string[]
  managerId?: DependencyManagerId
  packageName?: string
  workspaceName?: string
  workspaceRelativePath?: string
}

export interface DependencyHealthDashboardSourceStatus {
  id: DependencyHealthDashboardSourceId
  label: string
  ok: boolean
  generatedAt?: string
  status?: string
  count?: number
  error?: string
}

export interface DependencyHealthDashboardSummary {
  status: DependencyHealthDashboardStatus
  score: number
  componentCount: number
  workspaceCount: number
  managerCount: number
  managers: DependencyManagerId[]
  policyViolationCount: number
  criticalPolicyViolationCount: number
  highPolicyViolationCount: number
  mediumPolicyViolationCount: number
  licenseRiskCount: number
  blockedLicenseComponentCount: number
  unknownLicenseComponentCount: number
  dependencyChangeCount: number
  criticalDependencyRiskCount: number
  highDependencyRiskCount: number
  mediumDependencyRiskCount: number
  auditFindingCount: number
  auditCriticalFindingCount: number
  auditHighFindingCount: number
  readinessBlockedCheckCount: number
  readinessWarningCheckCount: number
  blockedWorkspaceCount: number
  warningWorkspaceCount: number
  lockfileDriftFindingCount: number
  lockfileDriftBlockedCount: number
  runtimePinningFindingCount: number
  runtimePinningBlockedCount: number
  offlineCacheFindingCount: number
  offlineCacheBlockedCount: number
  registryEndpointCount: number
  unreachableRegistryCount: number
  insecureRegistryCount: number
  credentialEndpointCount: number
  missingCredentialEndpointCount: number
  insecureCredentialEndpointCount: number
  weakCredentialMatchCount: number
  releaseRiskFindingCount: number
  releaseRiskCriticalCount: number
  releaseRiskHighCount: number
  floatingExecutionRiskCount: number
  deploymentReferenceCount: number
  floatingDeploymentRefCount: number
  deploymentBaselineEvidenceCount: number
  missingDeploymentBaselineCount: number
  blockingRiskCount: number
  warningRiskCount: number
  sourceErrorCount: number
}

export interface DependencyHealthDashboardReport {
  generatedAt: string
  projectPath: string
  status: DependencyHealthDashboardStatus
  score: number
  summary: DependencyHealthDashboardSummary
  sources: DependencyHealthDashboardSourceStatus[]
  topRisks: DependencyHealthDashboardRisk[]
  reports: {
    supplyChain?: Pick<SupplyChainReport, 'generatedAt' | 'componentCount' | 'managers'>
    license?: Pick<LicenseComplianceReport, 'generatedAt' | 'summary'>
    dependencyDiff?: Pick<DependencyComponentDiff, 'fromSnapshotId' | 'comparedAt' | 'summary'>
    policy?: Pick<DependencyPolicyEvaluation, 'generatedAt' | 'componentCount' | 'violationCount'>
    readiness?: Pick<ReadinessGateReport, 'generatedAt' | 'status' | 'score' | 'summary'>
    discovery?: Pick<WorkspaceDiscoveryReport, 'generatedAt' | 'summary'>
    governance?: Pick<WorkspaceGovernanceReport, 'generatedAt' | 'summary'>
    lockfileDrift?: Pick<LockfileDriftReport, 'generatedAt' | 'summary'>
    runtimePinning?: Pick<RuntimePinningReport, 'generatedAt' | 'summary'>
    offlineCache?: Pick<OfflineCacheReadinessReport, 'generatedAt' | 'summary'>
    releaseRisk?: Pick<ReleaseRiskProfileReport, 'generatedAt' | 'status' | 'score' | 'summary'>
    credentials?: Pick<CredentialUsageReport, 'generatedAt' | 'summary'>
    registries?: Pick<RegistryReachabilityReport, 'generatedAt' | 'summary'>
    auditEvidence?: Pick<AuditEvidenceReport, 'generatedAt' | 'summary'>
  }
}

export interface DependencyHealthDashboardExportResult {
  path: string
  generatedAt: string
  status: DependencyHealthDashboardStatus
  score: number
  componentCount: number
  workspaceCount: number
  riskCount: number
  summary: DependencyHealthDashboardSummary
}

export interface DependencyHealthDashboardDependencies {
  supplyChainService?: SupplyChainService
  readinessGateService?: ReadinessGateService
  workspaceDiscoveryService?: WorkspaceDiscoveryService
  workspaceGovernanceService?: WorkspaceGovernanceService
  lockfileDriftService?: LockfileDriftService
  runtimePinningService?: RuntimePinningService
  offlineCacheReadinessService?: OfflineCacheReadinessService
  releaseRiskProfileService?: ReleaseRiskProfileService
  credentialUsageService?: CredentialUsageService
  registryReachabilityService?: RegistryReachabilityService
  auditEvidenceService?: AuditEvidenceService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

interface DashboardSourceInput<T> {
  id: DependencyHealthDashboardSourceId
  label: string
  result: CaptureResult<T>
  generatedAt?: (value: T) => string | undefined
  status?: (value: T) => string | undefined
  count?: (value: T) => number | undefined
}

interface DashboardCaptures {
  supplyChain: CaptureResult<SupplyChainReport>
  license: CaptureResult<LicenseComplianceReport>
  dependencyDiff: CaptureResult<DependencyComponentDiff | null>
  policy: CaptureResult<DependencyPolicyEvaluation>
  readiness: CaptureResult<ReadinessGateReport>
  discovery: CaptureResult<WorkspaceDiscoveryReport>
  governance: CaptureResult<WorkspaceGovernanceReport>
  lockfileDrift: CaptureResult<LockfileDriftReport>
  runtimePinning: CaptureResult<RuntimePinningReport>
  offlineCache: CaptureResult<OfflineCacheReadinessReport>
  releaseRisk: CaptureResult<ReleaseRiskProfileReport>
  credentials: CaptureResult<CredentialUsageReport>
  registries: CaptureResult<RegistryReachabilityReport>
  auditEvidence: CaptureResult<AuditEvidenceReport>
}

const REPORT_DIR = '.npmDesktopManager/reports'
const DASHBOARD_FILE = 'dependency-health-dashboard.html'

export class DependencyHealthDashboardService {
  private readonly supplyChainService: SupplyChainService
  private readonly readinessGateService: ReadinessGateService
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService
  private readonly workspaceGovernanceService: WorkspaceGovernanceService
  private readonly lockfileDriftService: LockfileDriftService
  private readonly runtimePinningService: RuntimePinningService
  private readonly offlineCacheReadinessService: OfflineCacheReadinessService
  private readonly releaseRiskProfileService: ReleaseRiskProfileService
  private readonly credentialUsageService: CredentialUsageService
  private readonly registryReachabilityService: RegistryReachabilityService
  private readonly auditEvidenceService: AuditEvidenceService

  constructor(dependencies: DependencyHealthDashboardDependencies = {}) {
    this.supplyChainService = dependencies.supplyChainService || new SupplyChainService()
    this.readinessGateService = dependencies.readinessGateService || new ReadinessGateService()
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.workspaceGovernanceService = dependencies.workspaceGovernanceService || new WorkspaceGovernanceService({
      workspaceDiscoveryService: this.workspaceDiscoveryService,
      supplyChainService: this.supplyChainService,
      readinessGateService: this.readinessGateService
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
    this.registryReachabilityService = dependencies.registryReachabilityService || new RegistryReachabilityService()
    this.credentialUsageService = dependencies.credentialUsageService || new CredentialUsageService({
      registryReachabilityService: this.registryReachabilityService
    })
    this.auditEvidenceService = dependencies.auditEvidenceService || new AuditEvidenceService()
    this.releaseRiskProfileService = dependencies.releaseRiskProfileService || new ReleaseRiskProfileService({
      supplyChainService: this.supplyChainService,
      readinessGateService: this.readinessGateService,
      registryReachabilityService: this.registryReachabilityService,
      credentialUsageService: this.credentialUsageService,
      lockfileDriftService: this.lockfileDriftService,
      runtimePinningService: this.runtimePinningService,
      offlineCacheReadinessService: this.offlineCacheReadinessService,
      auditEvidenceService: this.auditEvidenceService,
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
  }

  async report(projectPath: string): Promise<DependencyHealthDashboardReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const [
      supplyChain,
      license,
      dependencyDiff,
      policy,
      readiness,
      discovery,
      governance,
      lockfileDrift,
      runtimePinning,
      offlineCache,
      releaseRisk,
      credentials,
      registries,
      auditEvidence
    ] = await Promise.all([
      capture(() => this.supplyChainService.report(root)),
      capture(() => this.supplyChainService.licenseReport(root)),
      capture(() => this.supplyChainService.dependencyDiffLatestSnapshot(root)),
      capture(() => this.supplyChainService.evaluatePolicy(root)),
      capture(() => this.readinessGateService.report(root)),
      capture(() => this.workspaceDiscoveryService.report(root)),
      capture(() => this.workspaceGovernanceService.report(root)),
      capture(() => this.lockfileDriftService.report(root)),
      capture(() => this.runtimePinningService.report(root)),
      capture(() => this.offlineCacheReadinessService.report(root)),
      capture(() => this.releaseRiskProfileService.report(root)),
      capture(() => this.credentialUsageService.report(root)),
      capture(() => this.registryReachabilityService.check(root, { timeoutMs: 1500 })),
      capture(() => this.auditEvidenceService.report(root))
    ])

    const captures: DashboardCaptures = {
      supplyChain,
      license,
      dependencyDiff,
      policy,
      readiness,
      discovery,
      governance,
      lockfileDrift,
      runtimePinning,
      offlineCache,
      releaseRisk,
      credentials,
      registries,
      auditEvidence
    }
    const sources = sourceStatuses(captures)
    const summary = summarizeDashboard(captures, sources)
    const topRisks = collectTopRisks(captures)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      score: summary.score,
      summary,
      sources,
      topRisks,
      reports: reportSnapshots(captures)
    }
  }

  async exportHtml(projectPath: string): Promise<DependencyHealthDashboardExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, DASHBOARD_FILE)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderHtml(report), 'utf-8')
    return {
      path,
      generatedAt: report.generatedAt,
      status: report.status,
      score: report.score,
      componentCount: report.summary.componentCount,
      workspaceCount: report.summary.workspaceCount,
      riskCount: report.summary.blockingRiskCount + report.summary.warningRiskCount,
      summary: report.summary
    }
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function sourceStatuses(captures: DashboardCaptures): DependencyHealthDashboardSourceStatus[] {
  const inputs: DashboardSourceInput<any>[] = [
    {
      id: 'supply-chain',
      label: 'Supply chain inventory',
      result: captures.supplyChain,
      generatedAt: (value: SupplyChainReport) => value.generatedAt,
      count: (value: SupplyChainReport) => value.componentCount
    },
    {
      id: 'dependency-policy',
      label: 'Dependency Policy',
      result: captures.policy,
      generatedAt: (value: DependencyPolicyEvaluation) => value.generatedAt,
      count: (value: DependencyPolicyEvaluation) => value.violationCount
    },
    {
      id: 'license-compliance',
      label: 'License Compliance',
      result: captures.license,
      generatedAt: (value: LicenseComplianceReport) => value.generatedAt,
      count: (value: LicenseComplianceReport) => value.summary.policyViolationComponentCount
    },
    {
      id: 'dependency-diff',
      label: 'Dependency risk diff',
      result: captures.dependencyDiff,
      generatedAt: (value: DependencyComponentDiff | null) => value?.comparedAt,
      count: (value: DependencyComponentDiff | null) => value ? value.summary.added + value.summary.removed + value.summary.updated : 0
    },
    {
      id: 'readiness',
      label: 'Readiness',
      result: captures.readiness,
      generatedAt: (value: ReadinessGateReport) => value.generatedAt,
      status: (value: ReadinessGateReport) => value.status,
      count: (value: ReadinessGateReport) => value.summary.policyViolationCount
    },
    {
      id: 'workspace-discovery',
      label: 'Workspace discovery',
      result: captures.discovery,
      generatedAt: (value: WorkspaceDiscoveryReport) => value.generatedAt,
      count: (value: WorkspaceDiscoveryReport) => value.summary.workspaceCount
    },
    {
      id: 'workspace-governance',
      label: 'Workspace Governance',
      result: captures.governance,
      generatedAt: (value: WorkspaceGovernanceReport) => value.generatedAt,
      status: (value: WorkspaceGovernanceReport) => statusFromWorkspaceSummary(value.summary),
      count: (value: WorkspaceGovernanceReport) => value.summary.blocked + value.summary.warning
    },
    {
      id: 'lockfile-drift',
      label: 'Lockfile drift',
      result: captures.lockfileDrift,
      generatedAt: (value: LockfileDriftReport) => value.generatedAt,
      status: (value: LockfileDriftReport) => statusFromCounts(value.summary.blocked, value.summary.warning),
      count: (value: LockfileDriftReport) => value.summary.findingCount
    },
    {
      id: 'runtime-pinning',
      label: 'Runtime pinning',
      result: captures.runtimePinning,
      generatedAt: (value: RuntimePinningReport) => value.generatedAt,
      status: (value: RuntimePinningReport) => statusFromCounts(value.summary.blocked, value.summary.warning),
      count: (value: RuntimePinningReport) => value.summary.findingCount
    },
    {
      id: 'offline-cache-readiness',
      label: 'Offline cache readiness',
      result: captures.offlineCache,
      generatedAt: (value: OfflineCacheReadinessReport) => value.generatedAt,
      status: (value: OfflineCacheReadinessReport) => statusFromCounts(value.summary.blocked, value.summary.warning),
      count: (value: OfflineCacheReadinessReport) => value.summary.findingCount
    },
    {
      id: 'release-risk-profile',
      label: 'Release risk profile',
      result: captures.releaseRisk,
      generatedAt: (value: ReleaseRiskProfileReport) => value.generatedAt,
      status: (value: ReleaseRiskProfileReport) => value.status,
      count: (value: ReleaseRiskProfileReport) => value.summary.findingCount
    },
    {
      id: 'credential-usage',
      label: 'Credential usage',
      result: captures.credentials,
      generatedAt: (value: CredentialUsageReport) => value.generatedAt,
      count: (value: CredentialUsageReport) => value.summary.missingCredentialEndpointCount + value.summary.weakMatchEndpointCount + value.summary.insecureStorageEndpointCount
    },
    {
      id: 'registry-reachability',
      label: 'Registry reachability',
      result: captures.registries,
      generatedAt: (value: RegistryReachabilityReport) => value.generatedAt,
      count: (value: RegistryReachabilityReport) => value.summary.unreachable + value.summary.insecure
    },
    {
      id: 'audit-evidence',
      label: 'Audit evidence',
      result: captures.auditEvidence,
      generatedAt: (value: AuditEvidenceReport) => value.generatedAt,
      count: (value: AuditEvidenceReport) => value.summary.findingCount
    }
  ]

  return inputs.map((input) => {
    if (input.result.error) {
      return {
        id: input.id,
        label: input.label,
        ok: false,
        error: input.result.error
      }
    }
    return {
      id: input.id,
      label: input.label,
      ok: true,
      generatedAt: input.result.value === undefined ? undefined : input.generatedAt?.(input.result.value),
      status: input.result.value === undefined ? undefined : input.status?.(input.result.value),
      count: input.result.value === undefined ? undefined : input.count?.(input.result.value)
    }
  })
}

function summarizeDashboard(
  captures: DashboardCaptures,
  sources: DependencyHealthDashboardSourceStatus[]
): DependencyHealthDashboardSummary {
  const policySeverity = severityCounts(captures.policy.value?.violations.map((violation) => violation.severity) || [])
  const managers = sortManagers(unique([
    ...(captures.supplyChain.value?.managers.filter((manager) => manager.detected).map((manager) => manager.id) || []),
    ...(captures.discovery.value?.summary.managers || []),
    ...(captures.governance.value?.summary.managers || []),
    ...(captures.readiness.value?.summary.detectedManagers || [])
  ]))
  const componentCount = captures.supplyChain.value?.componentCount
    ?? captures.releaseRisk.value?.summary.componentCount
    ?? captures.readiness.value?.summary.componentCount
    ?? captures.governance.value?.summary.componentCount
    ?? 0
  const workspaceCount = captures.discovery.value?.summary.workspaceCount
    ?? captures.governance.value?.summary.workspaceCount
    ?? captures.readiness.value?.summary.workspaceCount
    ?? captures.releaseRisk.value?.summary.workspaceCount
    ?? 0
  const license = captures.license.value?.summary
  const diff = captures.dependencyDiff.value?.summary
  const audit = captures.auditEvidence.value?.summary
  const readiness = captures.readiness.value?.summary
  const governance = captures.governance.value?.summary
  const lockfile = captures.lockfileDrift.value?.summary
  const runtime = captures.runtimePinning.value?.summary
  const offline = captures.offlineCache.value?.summary
  const credentials = captures.credentials.value?.summary
  const registries = captures.registries.value?.summary
  const releaseRisk = captures.releaseRisk.value?.summary
  const readinessBlockedCheckCount = captures.readiness.value?.checks.filter((check) => check.status === 'blocked').length || 0
  const readinessWarningCheckCount = captures.readiness.value?.checks.filter((check) => check.status === 'warning').length || 0
  const floatingExecutionRiskCount = countFloatingExecutionRisks(captures)
  const deploymentReferenceCount = readiness?.deploymentReferenceCount ?? countDeploymentReferences(captures)
  const floatingDeploymentRefCount = readiness?.floatingDeploymentRefCount ?? countFloatingDeploymentRefs(captures)
  const missingDeploymentBaselineCount = readiness?.missingDeploymentBaselineCount ?? countMissingDeploymentBaselines(captures)
  const deploymentBaselineEvidenceCount = readiness?.deploymentBaselineEvidenceCount
    ?? Math.max(0, deploymentReferenceCount - missingDeploymentBaselineCount)
  const sourceErrorCount = sources.filter((source) => !source.ok).length

  const criticalPolicyViolationCount = policySeverity.critical
  const highPolicyViolationCount = policySeverity.high
  const mediumPolicyViolationCount = policySeverity.medium
  const licenseRiskCount = license?.policyViolationComponentCount
    ?? ((license?.blockedLicenseComponentCount || 0) + (license?.notAllowedLicenseComponentCount || 0))
  const blockingRiskCount = sum([
    criticalPolicyViolationCount,
    highPolicyViolationCount,
    diff?.criticalRisk,
    diff?.highRisk,
    license?.blockedLicenseComponentCount,
    audit?.critical,
    audit?.high,
    readinessBlockedCheckCount,
    governance?.blocked,
    lockfile?.blockedFindingCount,
    runtime?.blockedFindingCount,
    offline?.blockedFindingCount,
    registries?.unreachable,
    registries?.insecure,
    credentials?.missingCredentialEndpointCount,
    credentials?.insecureStorageEndpointCount,
    credentials?.insecureEndpointCount,
    releaseRisk?.critical,
    releaseRisk?.high
  ])
  const warningRiskCount = sum([
    mediumPolicyViolationCount,
    policySeverity.low,
    policySeverity.info,
    diff?.mediumRisk,
    license?.notAllowedLicenseComponentCount,
    license?.unknownLicenseComponentCount,
    audit?.medium,
    readinessWarningCheckCount,
    governance?.warning,
    lockfile?.warningFindingCount,
    runtime?.warningFindingCount,
    offline?.warningFindingCount,
    credentials?.weakMatchEndpointCount,
    credentials?.unusedCredentialCount,
    releaseRisk?.medium,
    releaseRisk?.low,
    releaseRisk?.info
  ])
  const derivedStatus = statusFromRisk(blockingRiskCount, warningRiskCount + sourceErrorCount)
  const baseStatus = captures.releaseRisk.value?.status || captures.readiness.value?.status || derivedStatus
  const status: DependencyHealthDashboardStatus = baseStatus === 'ready' && sourceErrorCount > 0 ? 'warning' : baseStatus
  const score = captures.releaseRisk.value?.score
    ?? captures.readiness.value?.score
    ?? Math.max(0, Math.min(100, 100 - (blockingRiskCount * 8) - (warningRiskCount * 3) - (sourceErrorCount * 5)))

  return {
    status,
    score,
    componentCount,
    workspaceCount,
    managerCount: managers.length,
    managers,
    policyViolationCount: captures.policy.value?.violationCount || 0,
    criticalPolicyViolationCount,
    highPolicyViolationCount,
    mediumPolicyViolationCount,
    licenseRiskCount,
    blockedLicenseComponentCount: license?.blockedLicenseComponentCount || 0,
    unknownLicenseComponentCount: license?.unknownLicenseComponentCount || 0,
    dependencyChangeCount: diff ? diff.added + diff.removed + diff.updated : 0,
    criticalDependencyRiskCount: diff?.criticalRisk || 0,
    highDependencyRiskCount: diff?.highRisk || 0,
    mediumDependencyRiskCount: diff?.mediumRisk || 0,
    auditFindingCount: audit?.findingCount || 0,
    auditCriticalFindingCount: audit?.critical || 0,
    auditHighFindingCount: audit?.high || 0,
    readinessBlockedCheckCount,
    readinessWarningCheckCount,
    blockedWorkspaceCount: governance?.blocked || 0,
    warningWorkspaceCount: governance?.warning || 0,
    lockfileDriftFindingCount: lockfile?.findingCount || 0,
    lockfileDriftBlockedCount: lockfile?.blockedFindingCount || 0,
    runtimePinningFindingCount: runtime?.findingCount || 0,
    runtimePinningBlockedCount: runtime?.blockedFindingCount || 0,
    offlineCacheFindingCount: offline?.findingCount || 0,
    offlineCacheBlockedCount: offline?.blockedFindingCount || 0,
    registryEndpointCount: registries?.endpointCount || 0,
    unreachableRegistryCount: registries?.unreachable || 0,
    insecureRegistryCount: registries?.insecure || 0,
    credentialEndpointCount: credentials?.endpointCount || 0,
    missingCredentialEndpointCount: credentials?.missingCredentialEndpointCount || 0,
    insecureCredentialEndpointCount: (credentials?.insecureStorageEndpointCount || 0) + (credentials?.insecureEndpointCount || 0),
    weakCredentialMatchCount: credentials?.weakMatchEndpointCount || 0,
    releaseRiskFindingCount: releaseRisk?.findingCount || 0,
    releaseRiskCriticalCount: releaseRisk?.critical || 0,
    releaseRiskHighCount: releaseRisk?.high || 0,
    floatingExecutionRiskCount,
    deploymentReferenceCount,
    floatingDeploymentRefCount,
    deploymentBaselineEvidenceCount,
    missingDeploymentBaselineCount,
    blockingRiskCount,
    warningRiskCount,
    sourceErrorCount
  }
}

function collectTopRisks(captures: DashboardCaptures): DependencyHealthDashboardRisk[] {
  const risks: DependencyHealthDashboardRisk[] = []

  for (const finding of captures.releaseRisk.value?.topRisks || []) {
    risks.push({
      id: `release-risk:${finding.id}`,
      source: 'release-risk-profile',
      severity: normalizeSeverity(finding.severity),
      title: finding.title,
      summary: finding.summary,
      recommendation: finding.recommendation,
      evidence: finding.evidence,
      managerId: finding.managerId,
      workspaceName: finding.workspaceName,
      workspaceRelativePath: finding.workspaceRelativePath
    })
  }

  for (const check of captures.readiness.value?.checks || []) {
    if (check.status !== 'blocked' && check.status !== 'warning') continue
    risks.push({
      id: `readiness:${check.id}`,
      source: 'readiness',
      severity: normalizeSeverity(check.severity),
      title: check.title,
      summary: check.summary,
      recommendation: check.recommendation,
      evidence: check.evidence
    })
  }

  for (const violation of captures.policy.value?.violations || []) {
    risks.push({
      id: `dependency-policy:${violation.managerId || 'project'}:${violation.packageName || violation.title}:${violation.severity}`,
      source: 'dependency-policy',
      severity: normalizeSeverity(violation.severity),
      title: violation.title,
      summary: violation.description,
      recommendation: violation.recommendation,
      evidence: [
        violation.managerId ? `Manager: ${violation.managerId}` : '',
        violation.packageName ? `Package: ${violation.packageName}` : '',
        violation.version ? `Version: ${violation.version}` : ''
      ].filter(Boolean),
      managerId: violation.managerId,
      packageName: violation.packageName
    })
  }

  for (const finding of captures.auditEvidence.value?.findings || []) {
    risks.push({
      id: `audit-evidence:${finding.id}`,
      source: 'audit-evidence',
      severity: normalizeAuditSeverity(finding.severity),
      title: finding.title,
      summary: finding.summary,
      recommendation: finding.recommendation,
      evidence: finding.evidence,
      managerId: finding.managerId,
      packageName: finding.packageName,
      workspaceRelativePath: finding.workspaceRelativePath
    })
  }

  for (const change of captures.dependencyDiff.value?.changes || []) {
    if (!isTopDependencyRisk(change.risk)) continue
    risks.push({
      id: `dependency-diff:${change.id}`,
      source: 'dependency-diff',
      severity: normalizeDependencyRisk(change.risk),
      title: `${change.kind} ${change.name}`,
      summary: change.riskReasons.join('; ') || `${change.name} changed in the latest dependency snapshot comparison.`,
      recommendation: change.recommendation,
      evidence: [
        `Manager: ${change.managerId}`,
        change.before?.version ? `Before: ${change.before.version}` : '',
        change.after?.version ? `After: ${change.after.version}` : ''
      ].filter(Boolean),
      managerId: change.managerId,
      packageName: change.name
    })
  }

  for (const component of captures.license.value?.components || []) {
    if (!component.policyViolation) continue
    risks.push({
      id: `license-compliance:${component.managerId}:${component.name}`,
      source: 'license-compliance',
      severity: component.status === 'blocked' ? 'high' : 'medium',
      title: `License review required for ${component.name}`,
      summary: component.reasons.join('; ') || `${component.name} has a license compliance finding.`,
      recommendation: component.recommendation,
      evidence: [
        `Manager: ${component.managerId}`,
        `License: ${component.license || component.licenses.join(', ') || 'unknown'}`,
        `Source: ${component.sourceFile}`
      ],
      managerId: component.managerId,
      packageName: component.name
    })
  }

  for (const workspace of captures.governance.value?.workspaces || []) {
    for (const finding of workspace.findings) {
      risks.push({
        id: `workspace-governance:${workspace.workspace.id}:${finding.id}`,
        source: 'workspace-governance',
        severity: finding.severity === 'blocked' ? 'high' : finding.severity === 'warning' ? 'medium' : 'info',
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        evidence: finding.evidence,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      })
    }
  }

  for (const workspace of captures.lockfileDrift.value?.workspaces || []) {
    for (const finding of workspace.findings) {
      risks.push({
        id: `lockfile-drift:${workspace.workspace.id}:${finding.id}`,
        source: 'lockfile-drift',
        severity: finding.severity === 'blocked' ? 'high' : finding.severity === 'warning' ? 'medium' : 'info',
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        evidence: finding.evidence,
        managerId: finding.managerId,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      })
    }
  }

  for (const workspace of captures.runtimePinning.value?.workspaces || []) {
    for (const finding of workspace.findings) {
      risks.push({
        id: `runtime-pinning:${workspace.workspace.id}:${finding.id}`,
        source: 'runtime-pinning',
        severity: finding.severity === 'blocked' ? 'high' : finding.severity === 'warning' ? 'medium' : 'info',
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        evidence: finding.evidence,
        managerId: finding.managerId,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      })
    }
  }

  for (const workspace of captures.offlineCache.value?.workspaces || []) {
    for (const finding of workspace.findings) {
      risks.push({
        id: `offline-cache-readiness:${workspace.workspace.id}:${finding.id}`,
        source: 'offline-cache-readiness',
        severity: finding.severity === 'blocked' ? 'high' : finding.severity === 'warning' ? 'medium' : 'info',
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        evidence: finding.evidence,
        managerId: finding.managerId,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      })
    }
  }

  for (const endpoint of captures.credentials.value?.endpoints || []) {
    if (endpoint.status === 'covered' || endpoint.status === 'public') continue
    risks.push({
      id: `credential-usage:${endpoint.endpoint.id}`,
      source: 'credential-usage',
      severity: endpoint.status === 'missing' || endpoint.status === 'insecure-storage' || endpoint.status === 'insecure-endpoint' ? 'high' : 'medium',
      title: `Credential coverage issue for ${endpoint.endpoint.name}`,
      summary: `${endpoint.endpoint.url} is ${endpoint.status}.`,
      recommendation: endpoint.recommendation,
      evidence: endpoint.warnings,
      managerId: endpoint.endpoint.managerId
    })
  }

  for (const result of captures.registries.value?.results || []) {
    if (result.status === 'reachable' && result.secure) continue
    risks.push({
      id: `registry-reachability:${result.id}`,
      source: 'registry-reachability',
      severity: result.status === 'unreachable' || !result.secure ? 'high' : 'medium',
      title: `Registry reachability issue for ${result.name}`,
      summary: `${result.url} is ${result.status}${result.secure ? '' : ' and uses an insecure URL'}.`,
      recommendation: 'Verify registry availability, TLS settings, proxy configuration, and credentials before production dependency operations.',
      evidence: [result.message || '', result.statusCode ? `HTTP ${result.statusCode}` : ''].filter(Boolean),
      managerId: result.managerId
    })
  }

  return uniqueRisks(risks)
    .sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity) || a.title.localeCompare(b.title))
    .slice(0, 30)
}

function reportSnapshots(captures: DashboardCaptures): DependencyHealthDashboardReport['reports'] {
  return {
    supplyChain: captures.supplyChain.value && {
      generatedAt: captures.supplyChain.value.generatedAt,
      componentCount: captures.supplyChain.value.componentCount,
      managers: captures.supplyChain.value.managers
    },
    license: captures.license.value && {
      generatedAt: captures.license.value.generatedAt,
      summary: captures.license.value.summary
    },
    dependencyDiff: captures.dependencyDiff.value ? {
      fromSnapshotId: captures.dependencyDiff.value.fromSnapshotId,
      comparedAt: captures.dependencyDiff.value.comparedAt,
      summary: captures.dependencyDiff.value.summary
    } : undefined,
    policy: captures.policy.value && {
      generatedAt: captures.policy.value.generatedAt,
      componentCount: captures.policy.value.componentCount,
      violationCount: captures.policy.value.violationCount
    },
    readiness: captures.readiness.value && {
      generatedAt: captures.readiness.value.generatedAt,
      status: captures.readiness.value.status,
      score: captures.readiness.value.score,
      summary: captures.readiness.value.summary
    },
    discovery: captures.discovery.value && {
      generatedAt: captures.discovery.value.generatedAt,
      summary: captures.discovery.value.summary
    },
    governance: captures.governance.value && {
      generatedAt: captures.governance.value.generatedAt,
      summary: captures.governance.value.summary
    },
    lockfileDrift: captures.lockfileDrift.value && {
      generatedAt: captures.lockfileDrift.value.generatedAt,
      summary: captures.lockfileDrift.value.summary
    },
    runtimePinning: captures.runtimePinning.value && {
      generatedAt: captures.runtimePinning.value.generatedAt,
      summary: captures.runtimePinning.value.summary
    },
    offlineCache: captures.offlineCache.value && {
      generatedAt: captures.offlineCache.value.generatedAt,
      summary: captures.offlineCache.value.summary
    },
    releaseRisk: captures.releaseRisk.value && {
      generatedAt: captures.releaseRisk.value.generatedAt,
      status: captures.releaseRisk.value.status,
      score: captures.releaseRisk.value.score,
      summary: captures.releaseRisk.value.summary
    },
    credentials: captures.credentials.value && {
      generatedAt: captures.credentials.value.generatedAt,
      summary: captures.credentials.value.summary
    },
    registries: captures.registries.value && {
      generatedAt: captures.registries.value.generatedAt,
      summary: captures.registries.value.summary
    },
    auditEvidence: captures.auditEvidence.value && {
      generatedAt: captures.auditEvidence.value.generatedAt,
      summary: captures.auditEvidence.value.summary
    }
  }
}

function renderHtml(report: DependencyHealthDashboardReport): string {
  const summary = report.summary
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Dependency Health Dashboard</title>',
    '<style>',
    ':root { color-scheme: light dark; font-family: Inter, Segoe UI, Arial, sans-serif; background: #11161b; color: #edf4f8; }',
    '* { box-sizing: border-box; }',
    'body { margin: 0; background: #11161b; color: #edf4f8; }',
    'main { max-width: 1320px; margin: 0 auto; padding: 28px; }',
    'header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 22px; }',
    'h1, h2, h3 { margin: 0; letter-spacing: 0; }',
    'h1 { font-size: 28px; line-height: 1.2; }',
    'h2 { font-size: 18px; margin-bottom: 12px; }',
    'h3 { font-size: 14px; margin-bottom: 8px; color: #cbd8e3; }',
    '.subtle { color: #9fb1c0; font-size: 13px; word-break: break-all; }',
    '.badge { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; border: 1px solid transparent; }',
    '.ready, .passed, .reachable, .covered { background: #143d2a; color: #8ef0b8; border-color: #2b8556; }',
    '.warning, .medium, .low, .unknown, .weak-match { background: #44310d; color: #ffd37d; border-color: #94691d; }',
    '.blocked, .critical, .high, .missing, .unreachable, .insecure-storage, .insecure-endpoint { background: #4a171d; color: #ffa0ab; border-color: #9e3341; }',
    '.info, .skipped, .public { background: #17283d; color: #9dc9ff; border-color: #315783; }',
    '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(178px, 1fr)); gap: 12px; margin-bottom: 18px; }',
    '.metric, section { background: #171e24; border: 1px solid #2a3540; border-radius: 8px; }',
    '.metric { padding: 14px; min-height: 94px; }',
    '.metric .label { color: #9fb1c0; font-size: 12px; }',
    '.metric .value { display: block; margin-top: 8px; font-size: 24px; font-weight: 850; }',
    'section { padding: 16px; margin-top: 14px; }',
    '.columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }',
    '.summary { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }',
    '.summary span { border: 1px solid #2a3540; border-radius: 999px; padding: 5px 9px; color: #cbd8e3; font-size: 12px; }',
    'table { width: 100%; border-collapse: collapse; font-size: 13px; }',
    'th, td { border-bottom: 1px solid #2a3540; padding: 8px 7px; text-align: left; vertical-align: top; }',
    'th { color: #b9c8d6; font-size: 12px; text-transform: uppercase; }',
    'td.path, td.summary-cell { max-width: 380px; word-break: break-word; }',
    '.decision { border-left: 4px solid #315783; padding-left: 12px; color: #d9e4ee; }',
    `.decision.${summary.status} { border-left-color: ${summary.status === 'blocked' ? '#d0485a' : summary.status === 'warning' ? '#d49a35' : '#2b8556'}; }`,
    '@media (max-width: 760px) { main { padding: 16px; } header { flex-direction: column; } table { display: block; overflow-x: auto; white-space: nowrap; } }',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<header>',
    '<div>',
    '<h1>Dependency Health Dashboard</h1>',
    `<div class="subtle">Generated ${htmlEscape(report.generatedAt)} for ${htmlEscape(report.projectPath)}</div>`,
    '</div>',
    `<span class="badge ${htmlClassName(report.status)}">${htmlEscape(report.status)}</span>`,
    '</header>',
    '<div class="grid">',
    metricCard('Score', `${summary.score}/100`),
    metricCard('Components', String(summary.componentCount)),
    metricCard('Workspaces', String(summary.workspaceCount)),
    metricCard('Managers', String(summary.managerCount)),
    metricCard('Blocking risks', String(summary.blockingRiskCount)),
    metricCard('Source errors', String(summary.sourceErrorCount)),
    '</div>',
    '<section>',
    '<h2>Executive Decision</h2>',
    `<p class="decision ${summary.status}">${htmlEscape(decisionText(summary))}</p>`,
    '<div class="summary">',
    `<span>Managers: ${htmlEscape(summary.managers.join(', ') || '-')}</span>`,
    `<span>Policy violations: ${summary.policyViolationCount}</span>`,
    `<span>License risk: ${summary.licenseRiskCount}</span>`,
    `<span>Vulnerability findings: ${summary.auditFindingCount}</span>`,
    `<span>Floating execution risks: ${summary.floatingExecutionRiskCount}</span>`,
    `<span>Floating deployment refs: ${summary.floatingDeploymentRefCount}</span>`,
    `<span>Missing deployment baselines: ${summary.missingDeploymentBaselineCount}</span>`,
    '</div>',
    '</section>',
    '<section>',
    '<h2>Production Health</h2>',
    '<div class="columns">',
    healthPanel('Readiness', [
      ['Status', report.reports.readiness?.status || report.status],
      ['Score', `${report.reports.readiness?.score ?? report.score}/100`],
      ['Blocked checks', summary.readinessBlockedCheckCount],
      ['Warning checks', summary.readinessWarningCheckCount]
    ]),
    healthPanel('Dependency Policy', [
      ['Violations', summary.policyViolationCount],
      ['Critical', summary.criticalPolicyViolationCount],
      ['High', summary.highPolicyViolationCount],
      ['Floating execution', summary.floatingExecutionRiskCount]
    ]),
    healthPanel('License Compliance', [
      ['Policy risk', summary.licenseRiskCount],
      ['Blocked licenses', summary.blockedLicenseComponentCount],
      ['Unknown licenses', summary.unknownLicenseComponentCount],
      ['Components', report.reports.license?.summary.componentCount || summary.componentCount]
    ]),
    healthPanel('Workspace Governance', [
      ['Workspaces', summary.workspaceCount],
      ['Blocked', summary.blockedWorkspaceCount],
      ['Warning', summary.warningWorkspaceCount],
      ['Managers', summary.managerCount]
    ]),
    healthPanel('Reproducibility', [
      ['Lockfile drift', summary.lockfileDriftFindingCount],
      ['Runtime pinning', summary.runtimePinningFindingCount],
      ['Offline cache', summary.offlineCacheFindingCount],
      ['Floating deploy refs', summary.floatingDeploymentRefCount],
      ['Missing deploy baselines', summary.missingDeploymentBaselineCount],
      ['Blocked findings', summary.lockfileDriftBlockedCount + summary.runtimePinningBlockedCount + summary.offlineCacheBlockedCount]
    ]),
    healthPanel('Security Operations', [
      ['Audit findings', summary.auditFindingCount],
      ['Registry issues', summary.unreachableRegistryCount + summary.insecureRegistryCount],
      ['Credential issues', summary.missingCredentialEndpointCount + summary.insecureCredentialEndpointCount + summary.weakCredentialMatchCount],
      ['Release risk findings', summary.releaseRiskFindingCount]
    ]),
    '</div>',
    '</section>',
    '<section>',
    '<h2>Top Risks</h2>',
    '<table>',
    '<thead><tr><th>Severity</th><th>Source</th><th>Risk</th><th>Scope</th><th>Recommendation</th></tr></thead>',
    '<tbody>',
    ...(report.topRisks.length > 0 ? report.topRisks.map(renderRiskRow) : [emptyRow(5, 'No blocking or warning risks were detected by the available evidence sources.')]),
    '</tbody>',
    '</table>',
    '</section>',
    '<section>',
    '<h2>Evidence Sources</h2>',
    '<table>',
    '<thead><tr><th>Source</th><th>Status</th><th>Generated</th><th>Count</th><th>Details</th></tr></thead>',
    '<tbody>',
    ...report.sources.map(renderSourceRow),
    '</tbody>',
    '</table>',
    '</section>',
    '<section>',
    '<h2>Release Checklist</h2>',
    '<div class="summary">',
    ...checklist(report).map((item) => `<span>${htmlEscape(item)}</span>`),
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

function healthPanel(title: string, rows: Array<[string, string | number]>): string {
  return [
    '<div>',
    `<h3>${htmlEscape(title)}</h3>`,
    '<div class="summary">',
    ...rows.map(([label, value]) => `<span>${htmlEscape(label)}: ${htmlEscape(String(value))}</span>`),
    '</div>',
    '</div>'
  ].join('\n')
}

function renderRiskRow(risk: DependencyHealthDashboardRisk): string {
  const scope = [
    risk.managerId ? `Manager: ${risk.managerId}` : '',
    risk.packageName ? `Package: ${risk.packageName}` : '',
    risk.workspaceRelativePath ? `Workspace: ${risk.workspaceRelativePath}` : risk.workspaceName ? `Workspace: ${risk.workspaceName}` : ''
  ].filter(Boolean).join(' | ') || '-'
  return [
    '<tr>',
    `<td><span class="badge ${htmlClassName(risk.severity)}">${htmlEscape(risk.severity)}</span></td>`,
    `<td>${htmlEscape(sourceLabel(risk.source))}</td>`,
    `<td class="summary-cell"><strong>${htmlEscape(risk.title)}</strong><br><span class="subtle">${htmlEscape(risk.summary)}</span></td>`,
    `<td>${htmlEscape(scope)}</td>`,
    `<td class="summary-cell">${htmlEscape(risk.recommendation)}</td>`,
    '</tr>'
  ].join('')
}

function renderSourceRow(source: DependencyHealthDashboardSourceStatus): string {
  const status = source.ok ? source.status || 'ok' : 'failed'
  return [
    '<tr>',
    `<td>${htmlEscape(source.label)}</td>`,
    `<td><span class="badge ${htmlClassName(status)}">${htmlEscape(status)}</span></td>`,
    `<td>${htmlEscape(source.generatedAt || '-')}</td>`,
    `<td>${source.count ?? '-'}</td>`,
    `<td class="summary-cell">${htmlEscape(source.error || 'Evidence source collected successfully.')}</td>`,
    '</tr>'
  ].join('')
}

function emptyRow(columns: number, message: string): string {
  return `<tr><td colspan="${columns}">${htmlEscape(message)}</td></tr>`
}

function decisionText(summary: DependencyHealthDashboardSummary): string {
  if (summary.status === 'blocked') {
    return 'Production dependency operations should not proceed until blocking dependency, workspace, security, reproducibility, or evidence gaps are resolved or explicitly exceptioned.'
  }
  if (summary.status === 'warning') {
    return 'Production dependency operations can proceed only after reviewer assessment of warnings, optional source failures, floating execution references, and release risk evidence.'
  }
  return 'Dependency evidence is healthy for the available production checks. Keep snapshots, audit evidence, registry credentials, and release policy current.'
}

function checklist(report: DependencyHealthDashboardReport): string[] {
  return [
    `${report.sources.find((source) => source.id === 'readiness')?.ok ? 'OK' : 'Missing'} - Readiness gate`,
    `${report.sources.find((source) => source.id === 'workspace-governance')?.ok ? 'OK' : 'Missing'} - Workspace Governance`,
    `${report.sources.find((source) => source.id === 'dependency-policy')?.ok ? 'OK' : 'Missing'} - Dependency Policy`,
    `${report.sources.find((source) => source.id === 'license-compliance')?.ok ? 'OK' : 'Missing'} - License Compliance`,
    `${report.sources.find((source) => source.id === 'audit-evidence')?.ok ? 'OK' : 'Missing'} - Vulnerability audit evidence`,
    `${report.sources.find((source) => source.id === 'lockfile-drift')?.ok ? 'OK' : 'Missing'} - Lockfile drift`,
    `${report.sources.find((source) => source.id === 'runtime-pinning')?.ok ? 'OK' : 'Missing'} - Runtime pinning`,
    `${report.sources.find((source) => source.id === 'offline-cache-readiness')?.ok ? 'OK' : 'Missing'} - Offline cache readiness`,
    `${report.sources.find((source) => source.id === 'credential-usage')?.ok ? 'OK' : 'Missing'} - Credential usage`,
    `${report.summary.floatingExecutionRiskCount === 0 ? 'OK' : 'Review'} - Floating execution dependency references`,
    `${report.summary.floatingDeploymentRefCount === 0 ? 'OK' : 'Review'} - Floating deployment and GitOps references`,
    `${report.summary.missingDeploymentBaselineCount === 0 ? 'OK' : 'Review'} - Deployment baseline evidence`
  ]
}

function countDeploymentReferences(captures: DashboardCaptures): number {
  return captures.supplyChain.value?.components.filter(isDeploymentReferenceComponent).length || 0
}

function countFloatingDeploymentRefs(captures: DashboardCaptures): number {
  return captures.supplyChain.value?.components.filter((component) => (
    isDeploymentReferenceComponent(component) && isFloatingDeploymentVersion(component.version)
  )).length || 0
}

function countMissingDeploymentBaselines(captures: DashboardCaptures): number {
  const report = captures.supplyChain.value
  if (!report) return 0
  const helmLockKeys = new Set(report.components
    .filter((component) => component.managerId === 'helm' && component.scope.toLowerCase() === 'lockfile')
    .map(deploymentComponentKey))
  return report.components.filter((component) => (
    isDeploymentBaselineComponent(component) && !hasDeploymentBaseline(component, helmLockKeys)
  )).length
}

function isDeploymentReferenceComponent(component: SupplyChainReport['components'][number]): boolean {
  if (!['docker', 'helm', 'kustomize', 'helmfile', 'skaffold', 'argocd', 'flux'].includes(component.managerId)) return false
  if (['repository', 'kustomization', 'helmrepository'].includes(component.scope.toLowerCase())) return false
  if ((component.managerId === 'kustomize' || component.managerId === 'skaffold') && isLocalDeploymentReference(component.name)) {
    return Boolean(component.version)
  }
  return true
}

function isDeploymentBaselineComponent(component: SupplyChainReport['components'][number]): boolean {
  return isDeploymentReferenceComponent(component) && component.scope.toLowerCase() !== 'lockfile'
}

function hasDeploymentBaseline(
  component: SupplyChainReport['components'][number],
  helmLockKeys: Set<string>
): boolean {
  const scope = component.scope.toLowerCase()
  if (isContainerDeploymentComponent(component)) return isDigestPinnedDeploymentVersion(component.version)
  if (component.managerId === 'helm' && scope === 'chart') return helmLockKeys.has(deploymentComponentKey(component))
  if (isChartDeploymentComponent(component)) return false
  if (isGitOpsSourceComponent(component)) return isImmutableDeploymentVersion(component.version)
  return true
}

function isContainerDeploymentComponent(component: SupplyChainReport['components'][number]): boolean {
  const scope = component.scope.toLowerCase()
  return (
    component.managerId === 'docker'
    || scope.includes('image')
    || component.name.includes('/')
      && (
        component.name.includes('.')
        || component.name.includes(':')
        || component.name.startsWith('ghcr.io/')
        || component.name.startsWith('docker.io/')
        || component.name.startsWith('quay.io/')
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
  return Boolean(value && /^sha256:[a-f0-9]{12,}$/i.test(value.trim().replace(/^['"]|['"]$/g, '')))
}

function isImmutableDeploymentVersion(value?: string): boolean {
  if (!value) return false
  const clean = value.trim().replace(/^['"]|['"]$/g, '')
  return isDigestPinnedDeploymentVersion(clean) || /^[a-f0-9]{12,}$/i.test(clean)
}

function deploymentComponentKey(component: SupplyChainReport['components'][number]): string {
  return [
    component.managerId,
    component.name.toLowerCase(),
    (component.version || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  ].join(':')
}

function isFloatingDeploymentVersion(value?: string): boolean {
  if (!value) return true
  const clean = value.trim().replace(/^['"]|['"]$/g, '')
  if (!clean) return true
  const normalized = clean.toLowerCase().replace(/^refs\/heads\//, '')
  if (['latest', 'main', 'master', 'develop', 'development', 'dev', 'trunk', 'head', 'edge', 'nightly', 'snapshot', 'stable'].includes(normalized)) return true
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
  const clean = value.trim().replace(/^['"]|['"]$/g, '')
  return clean === '.' || clean === '..' || clean.startsWith('./') || clean.startsWith('../') || clean.startsWith('/') || clean.startsWith('\\')
}

function countFloatingExecutionRisks(captures: DashboardCaptures): number {
  const policyCount = captures.policy.value?.violations.filter((violation) => (
    `${violation.title} ${violation.description}`.toLowerCase().includes('floating')
  )).length || 0
  const diffCount = captures.dependencyDiff.value?.changes.filter((change) => (
    change.riskReasons.some((reason) => reason.toLowerCase().includes('floating execution'))
  )).length || 0
  const releaseRiskCount = captures.releaseRisk.value?.findings.filter((finding) => (
    `${finding.title} ${finding.summary}`.toLowerCase().includes('floating')
    && `${finding.title} ${finding.summary}`.toLowerCase().includes('execution')
  )).length || 0
  return policyCount + diffCount + releaseRiskCount
}

function statusFromWorkspaceSummary(summary: WorkspaceGovernanceReport['summary']): DependencyHealthDashboardStatus {
  return statusFromCounts(summary.blocked, summary.warning)
}

function statusFromCounts(blocked: number, warning: number): DependencyHealthDashboardStatus {
  if (blocked > 0) return 'blocked'
  if (warning > 0) return 'warning'
  return 'ready'
}

function statusFromRisk(blocking: number, warning: number): DependencyHealthDashboardStatus {
  if (blocking > 0) return 'blocked'
  if (warning > 0) return 'warning'
  return 'ready'
}

function sourceLabel(source: DependencyHealthDashboardSourceId): string {
  const labels: Record<DependencyHealthDashboardSourceId, string> = {
    'supply-chain': 'Supply chain',
    'dependency-policy': 'Dependency Policy',
    'license-compliance': 'License Compliance',
    'dependency-diff': 'Dependency diff',
    'readiness': 'Readiness',
    'workspace-discovery': 'Workspace discovery',
    'workspace-governance': 'Workspace Governance',
    'lockfile-drift': 'Lockfile drift',
    'runtime-pinning': 'Runtime pinning',
    'offline-cache-readiness': 'Offline cache',
    'release-risk-profile': 'Release risk',
    'credential-usage': 'Credential usage',
    'registry-reachability': 'Registry reachability',
    'audit-evidence': 'Audit evidence'
  }
  return labels[source]
}

function severityCounts(severities: Array<DependencyHealthDashboardSeverity | ReleaseRiskSeverity>): Record<DependencyHealthDashboardSeverity, number> {
  return severities.reduce<Record<DependencyHealthDashboardSeverity, number>>((counts, severity) => {
    const normalized = normalizeSeverity(severity)
    counts[normalized] += 1
    return counts
  }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 })
}

function normalizeSeverity(severity: DependencyHealthDashboardSeverity | ReleaseRiskSeverity): DependencyHealthDashboardSeverity {
  if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
    return severity
  }
  return 'info'
}

function normalizeAuditSeverity(severity: AuditEvidenceSeverity): DependencyHealthDashboardSeverity {
  if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
    return severity
  }
  return 'info'
}

function normalizeDependencyRisk(risk: DependencyRiskLevel): DependencyHealthDashboardSeverity {
  if (risk === 'critical' || risk === 'high' || risk === 'medium' || risk === 'low') {
    return risk
  }
  return 'info'
}

function isTopDependencyRisk(risk: DependencyRiskLevel): boolean {
  return risk === 'critical' || risk === 'high' || risk === 'medium'
}

function uniqueRisks(risks: DependencyHealthDashboardRisk[]): DependencyHealthDashboardRisk[] {
  const seen = new Set<string>()
  const result: DependencyHealthDashboardRisk[] = []
  for (const risk of risks) {
    const key = [risk.source, risk.title, risk.summary, risk.packageName || '', risk.workspaceRelativePath || ''].join(':')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(risk)
  }
  return result
}

function severityWeight(severity: DependencyHealthDashboardSeverity): number {
  const weights: Record<DependencyHealthDashboardSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4
  }
  return weights[severity]
}

function sortManagers(managers: DependencyManagerId[]): DependencyManagerId[] {
  return [...managers].sort()
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function sum(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0)
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
