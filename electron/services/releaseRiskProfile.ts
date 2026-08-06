import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  SupplyChainService,
  type DependencyComponentDiff,
  type LicenseComplianceReport
} from './supplyChain'
import {
  ReadinessGateService,
  type ReadinessGateCheck,
  type ReadinessGateReport,
  type ReadinessGateStatus
} from './readinessGate'
import {
  RegistryReachabilityService,
  type RegistryReachabilityReport,
  type RegistryReachabilitySummary
} from './registryReachability'
import {
  CredentialUsageService,
  type CredentialUsageReport,
  type CredentialUsageSummary
} from './credentialUsage'
import {
  LockfileDriftService,
  type LockfileDriftReport,
  type LockfileDriftSummary
} from './lockfileDrift'
import {
  RuntimePinningService,
  type RuntimePinningReport,
  type RuntimePinningSummary
} from './runtimePinning'
import {
  OfflineCacheReadinessService,
  type OfflineCacheReadinessReport,
  type OfflineCacheReadinessSummary
} from './offlineCacheReadiness'
import {
  AuditEvidenceService,
  type AuditEvidenceFinding,
  type AuditEvidenceReport,
  type AuditEvidenceSummary
} from './auditEvidence'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport,
  type WorkspaceDiscoverySummary
} from './workspaceDiscovery'
import {
  listOperationHistory,
  summarizeOperationHistory,
  type OperationHistoryRecord,
  type OperationHistorySummary
} from './operationHistory'

export type ReleaseRiskProfileExportFormat = 'markdown' | 'json'
export type ReleaseRiskProfileStatus = 'ready' | 'warning' | 'blocked'
export type ReleaseRiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type ReleaseRiskCategory =
  | 'readiness'
  | 'security'
  | 'supply-chain'
  | 'license'
  | 'registries'
  | 'credentials'
  | 'reproducibility'
  | 'deployment'
  | 'workspaces'
  | 'operations'
export type ReleaseRiskSource =
  | 'readiness-gate'
  | 'supply-chain'
  | 'license-compliance'
  | 'dependency-diff'
  | 'registry-reachability'
  | 'credential-usage'
  | 'lockfile-drift'
  | 'runtime-pinning'
  | 'offline-cache-readiness'
  | 'audit-evidence'
  | 'workspace-discovery'
  | 'operation-history'

export interface ReleaseRiskProfileFinding {
  id: string
  category: ReleaseRiskCategory
  source: ReleaseRiskSource
  severity: ReleaseRiskSeverity
  title: string
  summary: string
  recommendation: string
  evidence: string[]
  managerId?: DependencyManagerId
  workspaceId?: string
  workspaceName?: string
  workspaceRelativePath?: string
}

export interface ReleaseRiskCategorySummary {
  category: ReleaseRiskCategory
  title: string
  status: ReleaseRiskProfileStatus
  score: number
  findingCount: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface ReleaseRiskProfileSummary {
  status: ReleaseRiskProfileStatus
  score: number
  findingCount: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
  topRiskCount: number
  categoryCount: number
  sourceErrorCount: number
  readinessStatus?: ReadinessGateStatus
  readinessScore?: number
  readinessBlockedCheckCount: number
  readinessWarningCheckCount: number
  componentCount: number
  dependencyCriticalRiskCount: number
  dependencyHighRiskCount: number
  dependencyMediumRiskCount: number
  licenseRiskCount: number
  policyViolationComponentCount: number
  registryEndpointCount: number
  unreachableRegistryCount: number
  insecureRegistryCount: number
  credentialEndpointCount: number
  missingCredentialEndpointCount: number
  weakCredentialMatchCount: number
  insecureCredentialCount: number
  unusedCredentialCount: number
  workspaceCount: number
  workspaceManagerCount: number
  lockfileDriftFindingCount: number
  runtimePinningFindingCount: number
  offlineCacheFindingCount: number
  deploymentReferenceCount: number
  floatingDeploymentRefCount: number
  deploymentBaselineEvidenceCount: number
  missingDeploymentBaselineCount: number
  auditEvidenceFindingCount: number
  auditCriticalFindingCount: number
  auditHighFindingCount: number
  auditMediumFindingCount: number
  auditFixAvailableCount: number
  missingOfflineCacheLockfileCount: number
  missingOfflineCacheConfigCount: number
  missingOfflineCommandCount: number
  floatingContainerTagCount: number
  operationCount: number
  failedOperationCount: number
  failedMutatingOperationCount: number
}

export interface ReleaseRiskProfileSources {
  readiness?: Pick<ReadinessGateReport, 'generatedAt' | 'status' | 'score' | 'summary'>
  license?: Pick<LicenseComplianceReport, 'generatedAt' | 'policy' | 'summary'>
  dependencyDiff?: Pick<DependencyComponentDiff, 'fromSnapshotId' | 'comparedAt' | 'summary'>
  registries?: Pick<RegistryReachabilityReport, 'generatedAt' | 'summary'>
  credentials?: Pick<CredentialUsageReport, 'generatedAt' | 'vaultStatus' | 'summary'>
  lockfileDrift?: Pick<LockfileDriftReport, 'generatedAt' | 'summary'>
  runtimePinning?: Pick<RuntimePinningReport, 'generatedAt' | 'summary'>
  offlineCache?: Pick<OfflineCacheReadinessReport, 'generatedAt' | 'summary'>
  auditEvidence?: Pick<AuditEvidenceReport, 'generatedAt' | 'summary'>
  workspaces?: Pick<WorkspaceDiscoveryReport, 'generatedAt' | 'summary'>
  operations?: OperationHistorySummary
  errors: Partial<Record<ReleaseRiskSource, string>>
}

export interface ReleaseRiskProfileReport {
  generatedAt: string
  projectPath: string
  status: ReleaseRiskProfileStatus
  score: number
  summary: ReleaseRiskProfileSummary
  categories: ReleaseRiskCategorySummary[]
  topRisks: ReleaseRiskProfileFinding[]
  findings: ReleaseRiskProfileFinding[]
  sources: ReleaseRiskProfileSources
}

export interface ReleaseRiskProfileExportResult {
  path: string
  format: ReleaseRiskProfileExportFormat
  generatedAt: string
  status: ReleaseRiskProfileStatus
  score: number
  findingCount: number
  count: number
  summary: ReleaseRiskProfileSummary
}

export interface ReleaseRiskProfileDependencies {
  supplyChainService?: SupplyChainService
  readinessGateService?: ReadinessGateService
  registryReachabilityService?: RegistryReachabilityService
  credentialUsageService?: CredentialUsageService
  lockfileDriftService?: LockfileDriftService
  runtimePinningService?: RuntimePinningService
  offlineCacheReadinessService?: OfflineCacheReadinessService
  auditEvidenceService?: AuditEvidenceService
  workspaceDiscoveryService?: WorkspaceDiscoveryService
  listHistory?: (cwd: string, limit?: number) => Promise<OperationHistoryRecord[]>
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const CATEGORY_ORDER: ReleaseRiskCategory[] = [
  'readiness',
  'security',
  'supply-chain',
  'license',
  'registries',
  'credentials',
  'reproducibility',
  'deployment',
  'workspaces',
  'operations'
]
const CATEGORY_TITLES: Record<ReleaseRiskCategory, string> = {
  readiness: 'Production readiness',
  security: 'Vulnerability audit',
  'supply-chain': 'Supply chain change risk',
  license: 'License and policy',
  registries: 'Registry reachability',
  credentials: 'Credential coverage',
  reproducibility: 'Reproducibility',
  deployment: 'Deployment inputs',
  workspaces: 'Workspace topology',
  operations: 'Operation history'
}

export class ReleaseRiskProfileService {
  private readonly supplyChainService: SupplyChainService
  private readonly readinessGateService: ReadinessGateService
  private readonly registryReachabilityService: RegistryReachabilityService
  private readonly credentialUsageService: CredentialUsageService
  private readonly lockfileDriftService: LockfileDriftService
  private readonly runtimePinningService: RuntimePinningService
  private readonly offlineCacheReadinessService: OfflineCacheReadinessService
  private readonly auditEvidenceService: AuditEvidenceService
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService
  private readonly historyReader: (cwd: string, limit?: number) => Promise<OperationHistoryRecord[]>

  constructor(dependencies: ReleaseRiskProfileDependencies = {}) {
    this.supplyChainService = dependencies.supplyChainService || new SupplyChainService()
    this.readinessGateService = dependencies.readinessGateService || new ReadinessGateService({
      supplyChainService: this.supplyChainService,
      workspaceDiscoveryService: dependencies.workspaceDiscoveryService
    })
    this.registryReachabilityService = dependencies.registryReachabilityService || new RegistryReachabilityService()
    this.credentialUsageService = dependencies.credentialUsageService || new CredentialUsageService({
      registryReachabilityService: this.registryReachabilityService
    })
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.lockfileDriftService = dependencies.lockfileDriftService || new LockfileDriftService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.runtimePinningService = dependencies.runtimePinningService || new RuntimePinningService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.offlineCacheReadinessService = dependencies.offlineCacheReadinessService || new OfflineCacheReadinessService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.auditEvidenceService = dependencies.auditEvidenceService || new AuditEvidenceService()
    this.historyReader = dependencies.listHistory || listOperationHistory
  }

  async report(projectPath: string): Promise<ReleaseRiskProfileReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const [
      readinessResult,
      licenseResult,
      dependencyDiffResult,
      registryResult,
      credentialResult,
      lockfileDriftResult,
      runtimePinningResult,
      offlineCacheResult,
      auditEvidenceResult,
      workspaceResult,
      operationResult
    ] = await Promise.all([
      capture(() => this.readinessGateService.report(root)),
      capture(() => this.supplyChainService.licenseReport(root)),
      capture(() => this.supplyChainService.dependencyDiffLatestSnapshot(root)),
      capture(() => this.registryReachabilityService.check(root)),
      capture(() => this.credentialUsageService.report(root)),
      capture(() => this.lockfileDriftService.report(root)),
      capture(() => this.runtimePinningService.report(root)),
      capture(() => this.offlineCacheReadinessService.report(root)),
      capture(() => this.auditEvidenceService.report(root)),
      capture(() => this.workspaceDiscoveryService.report(root)),
      capture(() => this.historyReader(root, 100))
    ])
    const operationSummary = operationResult.value ? summarizeOperationHistory(operationResult.value) : undefined
    const failedMutatingOperationCount = operationResult.value
      ? operationResult.value.filter((record) => record.status === 'error' && (record.classification?.mutating ?? false)).length
      : 0
    const findings = normalizeFindings({
      readinessResult,
      licenseResult,
      dependencyDiffResult,
      registryResult,
      credentialResult,
      lockfileDriftResult,
      runtimePinningResult,
      offlineCacheResult,
      auditEvidenceResult,
      workspaceResult,
      operationResult,
      operationSummary
    })
    const categories = CATEGORY_ORDER.map((category) => summarizeCategory(category, findings))
    const sourceErrors = sourceErrorMap({
      readinessResult,
      licenseResult,
      dependencyDiffResult,
      registryResult,
      credentialResult,
      lockfileDriftResult,
      runtimePinningResult,
      offlineCacheResult,
      auditEvidenceResult,
      workspaceResult,
      operationResult
    })
    const summary = summarizeProfile(
      findings,
      categories,
      sourceErrors,
      readinessResult.value,
      licenseResult.value,
      dependencyDiffResult.value,
      registryResult.value?.summary,
      credentialResult.value?.summary,
      lockfileDriftResult.value?.summary,
      runtimePinningResult.value?.summary,
      offlineCacheResult.value?.summary,
      auditEvidenceResult.value?.summary,
      workspaceResult.value?.summary,
      operationSummary,
      failedMutatingOperationCount
    )
    const topRisks = sortFindings(findings)
      .filter((finding) => finding.severity !== 'info')
      .slice(0, 10)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      score: summary.score,
      summary,
      categories,
      topRisks,
      findings: sortFindings(findings),
      sources: {
        readiness: readinessResult.value && {
          generatedAt: readinessResult.value.generatedAt,
          status: readinessResult.value.status,
          score: readinessResult.value.score,
          summary: readinessResult.value.summary
        },
        license: licenseResult.value && {
          generatedAt: licenseResult.value.generatedAt,
          policy: licenseResult.value.policy,
          summary: licenseResult.value.summary
        },
        dependencyDiff: dependencyDiffResult.value
          ? {
              fromSnapshotId: dependencyDiffResult.value.fromSnapshotId,
              comparedAt: dependencyDiffResult.value.comparedAt,
              summary: dependencyDiffResult.value.summary
            }
          : undefined,
        registries: registryResult.value && {
          generatedAt: registryResult.value.generatedAt,
          summary: registryResult.value.summary
        },
        credentials: credentialResult.value && {
          generatedAt: credentialResult.value.generatedAt,
          vaultStatus: credentialResult.value.vaultStatus,
          summary: credentialResult.value.summary
        },
        lockfileDrift: lockfileDriftResult.value && {
          generatedAt: lockfileDriftResult.value.generatedAt,
          summary: lockfileDriftResult.value.summary
        },
        runtimePinning: runtimePinningResult.value && {
          generatedAt: runtimePinningResult.value.generatedAt,
          summary: runtimePinningResult.value.summary
        },
        offlineCache: offlineCacheResult.value && {
          generatedAt: offlineCacheResult.value.generatedAt,
          summary: offlineCacheResult.value.summary
        },
        auditEvidence: auditEvidenceResult.value && {
          generatedAt: auditEvidenceResult.value.generatedAt,
          summary: auditEvidenceResult.value.summary
        },
        workspaces: workspaceResult.value && {
          generatedAt: workspaceResult.value.generatedAt,
          summary: workspaceResult.value.summary
        },
        operations: operationSummary,
        errors: sourceErrors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<ReleaseRiskProfileExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'release-risk-profile.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderReleaseRiskProfileMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      status: report.status,
      score: report.score,
      findingCount: report.summary.findingCount,
      count: report.summary.findingCount,
      summary: report.summary
    }
  }

  async exportJson(projectPath: string): Promise<ReleaseRiskProfileExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'release-risk-profile.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      status: report.status,
      score: report.score,
      findingCount: report.summary.findingCount,
      count: report.summary.findingCount,
      summary: report.summary
    }
  }
}

function normalizeFindings(results: {
  readinessResult: CaptureResult<ReadinessGateReport>
  licenseResult: CaptureResult<LicenseComplianceReport>
  dependencyDiffResult: CaptureResult<DependencyComponentDiff | null>
  registryResult: CaptureResult<RegistryReachabilityReport>
  credentialResult: CaptureResult<CredentialUsageReport>
  lockfileDriftResult: CaptureResult<LockfileDriftReport>
  runtimePinningResult: CaptureResult<RuntimePinningReport>
  offlineCacheResult: CaptureResult<OfflineCacheReadinessReport>
  auditEvidenceResult: CaptureResult<AuditEvidenceReport>
  workspaceResult: CaptureResult<WorkspaceDiscoveryReport>
  operationResult: CaptureResult<OperationHistoryRecord[]>
  operationSummary?: OperationHistorySummary
}): ReleaseRiskProfileFinding[] {
  const findings: ReleaseRiskProfileFinding[] = []
  findings.push(...sourceErrorFindings(results))

  if (results.readinessResult.value) {
    findings.push(...readinessFindings(results.readinessResult.value))
  }
  if (results.licenseResult.value) {
    findings.push(...licenseFindings(results.licenseResult.value))
  }
  if (results.dependencyDiffResult.value) {
    findings.push(...dependencyDiffFindings(results.dependencyDiffResult.value))
  }
  if (results.registryResult.value) {
    findings.push(...registryFindings(results.registryResult.value))
  }
  if (results.credentialResult.value) {
    findings.push(...credentialFindings(results.credentialResult.value))
  }
  if (results.lockfileDriftResult.value) {
    findings.push(...lockfileDriftFindings(results.lockfileDriftResult.value))
  }
  if (results.runtimePinningResult.value) {
    findings.push(...runtimePinningFindings(results.runtimePinningResult.value))
  }
  if (results.offlineCacheResult.value) {
    findings.push(...offlineCacheFindings(results.offlineCacheResult.value))
  }
  if (results.auditEvidenceResult.value) {
    findings.push(...auditEvidenceFindings(results.auditEvidenceResult.value))
  }
  if (results.workspaceResult.value) {
    findings.push(...workspaceFindings(results.workspaceResult.value))
  }
  if (results.operationSummary && results.operationResult.value) {
    findings.push(...operationFindings(results.operationSummary, results.operationResult.value))
  }

  return dedupeFindings(findings)
}

function readinessFindings(report: ReadinessGateReport): ReleaseRiskProfileFinding[] {
  const findings: ReleaseRiskProfileFinding[] = []
  if (report.status !== 'ready') {
    findings.push(finding({
      id: `readiness:overall:${report.status}`,
      category: 'readiness',
      source: 'readiness-gate',
      severity: report.status === 'blocked' ? 'high' : 'medium',
      title: `Production readiness is ${report.status}`,
      summary: `Readiness score is ${report.score}/100 with ${report.checks.filter((check) => check.status === 'blocked').length} blocked and ${report.checks.filter((check) => check.status === 'warning').length} warning gate(s).`,
      recommendation: report.status === 'blocked'
        ? 'Resolve blocked readiness gates or attach reviewed release exceptions before publishing.'
        : 'Review warning gates before release and document accepted risk when needed.',
      evidence: [
        `Policy: ${report.policy.path}`,
        `Generated: ${report.generatedAt}`,
        `Minimum score: ${report.policy.policy.minimumScore}`
      ]
    }))
  }

  for (const check of report.checks) {
    if (check.status !== 'blocked' && check.status !== 'warning') continue
    findings.push(finding({
      id: `readiness:gate:${check.id}`,
      category: releaseCategoryFromReadinessCheck(check),
      source: 'readiness-gate',
      severity: releaseSeverityFromReadinessCheck(check),
      title: check.title,
      summary: check.summary,
      recommendation: check.recommendation,
      evidence: check.evidence
    }))
  }
  return findings
}

function licenseFindings(report: LicenseComplianceReport): ReleaseRiskProfileFinding[] {
  const summary = report.summary
  const findings: ReleaseRiskProfileFinding[] = []
  const licenseRiskCount = summary.blockedLicenseComponentCount
    + summary.notAllowedLicenseComponentCount
    + (report.policy.requireKnownLicenses ? summary.unknownLicenseComponentCount : 0)

  if (summary.policyViolationComponentCount > 0 || licenseRiskCount > 0) {
    findings.push(finding({
      id: 'license:policy-violations',
      category: 'license',
      source: 'license-compliance',
      severity: summary.blockedLicenseComponentCount > 0 ? 'high' : 'medium',
      title: 'License policy has release findings',
      summary: `${licenseRiskCount} component(s) require license review across ${summary.licenseCount} normalized license value(s).`,
      recommendation: 'Resolve blocked/not-allowed licenses or capture a release exception with reviewer approval.',
      evidence: [
        `Policy: ${report.policy.path}`,
        `Blocked components: ${summary.blockedLicenseComponentCount}`,
        `Not allowed components: ${summary.notAllowedLicenseComponentCount}`,
        `Unknown components: ${summary.unknownLicenseComponentCount}`,
        ...report.licenses
          .filter((entry) => entry.status === 'blocked' || entry.status === 'not-allowed' || entry.status === 'unknown')
          .slice(0, 8)
          .map((entry) => `${entry.status}: ${entry.license} (${entry.componentCount} component(s))`)
      ]
    }))
  }

  if (!report.policy.requireKnownLicenses && summary.unknownLicenseComponentCount > 0) {
    findings.push(finding({
      id: 'license:unknown-unrestricted',
      category: 'license',
      source: 'license-compliance',
      severity: 'low',
      title: 'Unknown licenses are visible but not enforced',
      summary: `${summary.unknownLicenseComponentCount} component(s) do not expose license metadata.`,
      recommendation: 'Require known licenses in dependency policy for release-sensitive repositories.',
      evidence: report.components
        .filter((component) => component.status === 'unknown')
        .slice(0, 8)
        .map((component) => `${component.managerId}:${component.name}@${component.version || 'unknown'}`)
    }))
  }
  return findings
}

function dependencyDiffFindings(diff: DependencyComponentDiff): ReleaseRiskProfileFinding[] {
  const summary = diff.summary
  const findings: ReleaseRiskProfileFinding[] = []
  const highRisk = summary.criticalRisk + summary.highRisk
  const changed = summary.added + summary.updated + summary.removed

  if (highRisk > 0 || summary.mediumRisk > 0) {
    findings.push(finding({
      id: 'supply-chain:dependency-diff-risk',
      category: 'supply-chain',
      source: 'dependency-diff',
      severity: summary.criticalRisk > 0 ? 'critical' : highRisk > 0 ? 'high' : 'medium',
      title: 'Dependency change risk needs review',
      summary: `${changed} dependency change(s), including ${highRisk} high+ risk and ${summary.mediumRisk} medium risk change(s).`,
      recommendation: 'Review high-risk dependency additions, major updates, prerelease changes, unpinned versions, and license changes before release.',
      evidence: [
        `Compared snapshot: ${diff.fromSnapshotId}`,
        `Compared at: ${diff.comparedAt}`,
        `Major updates: ${summary.majorUpdates}`,
        `Prerelease changes: ${summary.prereleaseChanges}`,
        `Unpinned changes: ${summary.unpinnedChanges}`,
        ...diff.changes
          .filter((change) => change.risk === 'critical' || change.risk === 'high' || change.risk === 'medium')
          .slice(0, 8)
          .map((change) => `${change.risk}: ${change.kind} ${change.managerId}:${change.name} (${change.riskReasons.join('; ') || 'risk flagged'})`)
      ]
    }))
  }

  if (summary.licenseChanges > 0) {
    findings.push(finding({
      id: 'supply-chain:dependency-license-changes',
      category: 'supply-chain',
      source: 'dependency-diff',
      severity: 'medium',
      title: 'Dependency changes include license changes',
      summary: `${summary.licenseChanges} changed dependency component(s) have license metadata changes.`,
      recommendation: 'Review license deltas in the dependency risk report and refresh compliance approvals.',
      evidence: diff.changes
        .filter((change) => change.riskReasons.some((reason) => /license/i.test(reason)))
        .slice(0, 8)
        .map((change) => `${change.kind} ${change.managerId}:${change.name}`)
    }))
  }
  return findings
}

function registryFindings(report: RegistryReachabilityReport): ReleaseRiskProfileFinding[] {
  const summary = report.summary
  const findings: ReleaseRiskProfileFinding[] = []

  if (summary.unreachable > 0) {
    findings.push(finding({
      id: 'registries:unreachable',
      category: 'registries',
      source: 'registry-reachability',
      severity: 'high',
      title: 'Registry endpoints are unreachable',
      summary: `${summary.unreachable}/${summary.endpointCount} configured registry endpoint(s) could not be reached.`,
      recommendation: 'Fix registry URLs, credentials, proxy settings, or network allowlists before release automation runs.',
      evidence: report.results
        .filter((result) => result.status === 'unreachable')
        .slice(0, 8)
        .map((result) => `${result.managerId || 'unknown'} ${result.url}: ${result.message || result.status}`)
    }))
  }

  if (summary.insecure > 0) {
    findings.push(finding({
      id: 'registries:insecure',
      category: 'registries',
      source: 'registry-reachability',
      severity: 'medium',
      title: 'Registry endpoints use insecure transport',
      summary: `${summary.insecure} registry endpoint(s) use HTTP or otherwise insecure URLs.`,
      recommendation: 'Move package registries and mirrors to HTTPS before release or credentialed operations.',
      evidence: report.endpoints
        .filter((endpoint) => !endpoint.secure)
        .slice(0, 8)
        .map((endpoint) => `${endpoint.managerId || 'unknown'} ${endpoint.url}`)
    }))
  }
  return findings
}

function credentialFindings(report: CredentialUsageReport): ReleaseRiskProfileFinding[] {
  const summary = report.summary
  const findings: ReleaseRiskProfileFinding[] = []

  if (summary.missingCredentialEndpointCount > 0) {
    findings.push(finding({
      id: 'credentials:missing-endpoints',
      category: 'credentials',
      source: 'credential-usage',
      severity: 'high',
      title: 'Private registry endpoints lack matching credentials',
      summary: `${summary.missingCredentialEndpointCount} endpoint(s) require credentials but have no matching vault metadata.`,
      recommendation: 'Store metadata-only credential entries for private registries and feed endpoints before release.',
      evidence: report.endpoints
        .filter((endpoint) => endpoint.status === 'missing')
        .slice(0, 8)
        .map((endpoint) => `${endpoint.endpoint.managerId || 'unknown'} ${endpoint.endpoint.url}`)
    }))
  }

  if (summary.insecureStorageEndpointCount > 0 || summary.insecureEndpointCount > 0) {
    findings.push(finding({
      id: 'credentials:insecure-usage',
      category: 'credentials',
      source: 'credential-usage',
      severity: summary.insecureStorageEndpointCount > 0 ? 'high' : 'medium',
      title: 'Credential usage has insecure storage or endpoints',
      summary: `${summary.insecureStorageEndpointCount} endpoint(s) match unencrypted credentials and ${summary.insecureEndpointCount} endpoint(s) use insecure URLs.`,
      recommendation: 'Move credentials into encrypted storage and avoid sending credentials to HTTP endpoints.',
      evidence: [
        `Vault storage: ${report.vaultStatus.storage}`,
        `Vault encrypted: ${report.vaultStatus.encrypted ? 'yes' : 'no'}`,
        ...report.endpoints
          .filter((endpoint) => endpoint.status === 'insecure-storage' || endpoint.status === 'insecure-endpoint')
          .slice(0, 8)
          .map((endpoint) => `${endpoint.status}: ${endpoint.endpoint.url}`)
      ]
    }))
  }

  if (summary.weakMatchEndpointCount > 0) {
    findings.push(finding({
      id: 'credentials:weak-matches',
      category: 'credentials',
      source: 'credential-usage',
      severity: 'medium',
      title: 'Credential matches are too broad',
      summary: `${summary.weakMatchEndpointCount} endpoint(s) only match credentials by manager-level metadata.`,
      recommendation: 'Record service URL or host-specific credential metadata so publish and registry operations bind to the intended feed.',
      evidence: report.endpoints
        .filter((endpoint) => endpoint.status === 'weak-match')
        .slice(0, 8)
        .map((endpoint) => `${endpoint.endpoint.managerId || 'unknown'} ${endpoint.endpoint.url}`)
    }))
  }

  if (summary.unusedCredentialCount > 0) {
    findings.push(finding({
      id: 'credentials:unused',
      category: 'credentials',
      source: 'credential-usage',
      severity: 'low',
      title: 'Credential vault contains unused entries',
      summary: `${summary.unusedCredentialCount} credential record(s) are not matched to discovered endpoints.`,
      recommendation: 'Remove unused credentials or attach them to explicit registry/feed URLs to reduce stale access.',
      evidence: report.unusedCredentials
        .slice(0, 8)
        .map((credential) => `${credential.managerId}:${credential.label} (${credential.service})`)
    }))
  }
  return findings
}

function lockfileDriftFindings(report: LockfileDriftReport): ReleaseRiskProfileFinding[] {
  return report.workspaces.flatMap((workspace) => workspace.findings.map((item) => finding({
    id: `lockfile:${item.id}`,
    category: 'reproducibility',
    source: 'lockfile-drift',
    severity: item.severity === 'blocked' ? 'high' : item.severity === 'warning' ? 'medium' : 'info',
    title: item.title,
    summary: item.summary,
    recommendation: item.recommendation,
    evidence: item.evidence,
    managerId: item.managerId,
    workspaceId: workspace.workspace.id,
    workspaceName: workspace.workspace.name,
    workspaceRelativePath: workspace.workspace.relativePath
  })))
}

function runtimePinningFindings(report: RuntimePinningReport): ReleaseRiskProfileFinding[] {
  return report.workspaces.flatMap((workspace) => workspace.findings.map((item) => finding({
    id: `runtime:${item.id}`,
    category: 'reproducibility',
    source: 'runtime-pinning',
    severity: item.kind === 'floating-container-tag'
      ? 'high'
      : item.severity === 'blocked'
        ? 'high'
        : item.severity === 'warning'
          ? 'medium'
          : 'info',
    title: item.title,
    summary: item.summary,
    recommendation: item.recommendation,
    evidence: item.evidence,
    managerId: item.managerId,
    workspaceId: workspace.workspace.id,
    workspaceName: workspace.workspace.name,
    workspaceRelativePath: workspace.workspace.relativePath
  })))
}

function offlineCacheFindings(report: OfflineCacheReadinessReport): ReleaseRiskProfileFinding[] {
  return report.workspaces.flatMap((workspace) => workspace.findings.map((item) => finding({
    id: `offline-cache:${item.id}`,
    category: 'reproducibility',
    source: 'offline-cache-readiness',
    severity: item.severity === 'blocked' ? 'high' : item.severity === 'warning' ? 'medium' : 'info',
    title: item.title,
    summary: item.summary,
    recommendation: item.recommendation,
    evidence: item.evidence,
    managerId: item.managerId,
    workspaceId: workspace.workspace.id,
    workspaceName: workspace.workspace.name,
    workspaceRelativePath: workspace.workspace.relativePath
  })))
}

function auditEvidenceFindings(report: AuditEvidenceReport): ReleaseRiskProfileFinding[] {
  return report.findings
    .filter((item) => item.severity !== 'info')
    .map((item) => finding({
      id: `audit:${item.id}`,
      category: 'security',
      source: 'audit-evidence',
      severity: releaseSeverityFromAuditFinding(item),
      title: item.title,
      summary: `${item.severity} vulnerability${item.packageName ? ` in ${item.packageName}` : ''}${item.installedVersion ? `@${item.installedVersion}` : ''}. ${item.summary}`,
      recommendation: item.fixedVersion
        ? `Update ${item.packageName || 'the affected package'} to ${item.fixedVersion} or later, then re-import scanner evidence.`
        : item.recommendation,
      evidence: [
        `Tool: ${item.tool}`,
        `Vulnerability: ${item.vulnerabilityId || item.aliases[0] || '-'}`,
        `Aliases: ${item.aliases.join(', ') || '-'}`,
        `Fixed version: ${item.fixedVersion || '-'}`,
        `Source file: ${item.sourceFile || '-'}`,
        `Imported: ${item.importedAt}`,
        ...item.evidence
      ],
      managerId: item.managerId,
      workspaceRelativePath: item.workspaceRelativePath
    }))
}

function workspaceFindings(report: WorkspaceDiscoveryReport): ReleaseRiskProfileFinding[] {
  const findings: ReleaseRiskProfileFinding[] = []
  if (report.summary.workspaceCount > 1 && report.summary.explicitWorkspaceCount === 0) {
    findings.push(finding({
      id: 'workspaces:implicit-topology',
      category: 'workspaces',
      source: 'workspace-discovery',
      severity: 'low',
      title: 'Workspace topology is inferred from manifests',
      summary: `${report.summary.workspaceCount} workspace-like project(s) were found without explicit workspace metadata.`,
      recommendation: 'Prefer explicit workspace declarations or governance evidence for repositories released as a unit.',
      evidence: report.workspaces
        .slice(0, 8)
        .map((workspace) => `${workspace.relativePath}: ${workspace.managerIds.join(', ') || 'no manager'}`)
    }))
  }

  const managerless = report.workspaces.filter((workspace) => workspace.managerIds.length === 0)
  if (managerless.length > 0) {
    findings.push(finding({
      id: 'workspaces:managerless',
      category: 'workspaces',
      source: 'workspace-discovery',
      severity: 'low',
      title: 'Some workspaces have no detected dependency manager',
      summary: `${managerless.length} workspace(s) have no manager classification.`,
      recommendation: 'Add manifest/config evidence or exclude generated folders so governance reports track only releasable workspaces.',
      evidence: managerless.slice(0, 8).map((workspace) => workspace.relativePath)
    }))
  }
  return findings
}

function operationFindings(summary: OperationHistorySummary, records: OperationHistoryRecord[]): ReleaseRiskProfileFinding[] {
  const failed = records.filter((record) => record.status === 'error')
  const failedMutating = failed.filter((record) => (record.classification?.mutating ?? false))
  if (failed.length === 0) return []

  return [finding({
    id: 'operations:recent-failures',
    category: 'operations',
    source: 'operation-history',
    severity: failedMutating.length > 0 ? 'high' : 'medium',
    title: 'Recent operations include failures',
    summary: `${summary.error}/${summary.total} recorded operation(s) failed; ${failedMutating.length} failed operation(s) were mutating.`,
    recommendation: 'Resolve failed install/update/publish/config operations and rerun release evidence before packaging.',
    evidence: failed.slice(0, 8).map((record) => {
      const classification = record.classification || { operation: 'unknown', summary: 'Unclassified operation' }
      return `${record.finishedAt}: ${classification.operation} ${record.command} (${record.error || record.stderr || record.summary || classification.summary || 'failed'})`
    })
  })]
}

function sourceErrorFindings(results: {
  readinessResult: CaptureResult<ReadinessGateReport>
  licenseResult: CaptureResult<LicenseComplianceReport>
  dependencyDiffResult: CaptureResult<DependencyComponentDiff | null>
  registryResult: CaptureResult<RegistryReachabilityReport>
  credentialResult: CaptureResult<CredentialUsageReport>
  lockfileDriftResult: CaptureResult<LockfileDriftReport>
  runtimePinningResult: CaptureResult<RuntimePinningReport>
  offlineCacheResult: CaptureResult<OfflineCacheReadinessReport>
  auditEvidenceResult: CaptureResult<AuditEvidenceReport>
  workspaceResult: CaptureResult<WorkspaceDiscoveryReport>
  operationResult: CaptureResult<OperationHistoryRecord[]>
}): ReleaseRiskProfileFinding[] {
  return [
    sourceErrorFinding(results.readinessResult, 'readiness-gate', 'readiness', 'Readiness gate failed'),
    sourceErrorFinding(results.licenseResult, 'license-compliance', 'license', 'License compliance failed'),
    sourceErrorFinding(results.dependencyDiffResult, 'dependency-diff', 'supply-chain', 'Dependency diff failed', 'low'),
    sourceErrorFinding(results.registryResult, 'registry-reachability', 'registries', 'Registry reachability failed'),
    sourceErrorFinding(results.credentialResult, 'credential-usage', 'credentials', 'Credential usage report failed'),
    sourceErrorFinding(results.lockfileDriftResult, 'lockfile-drift', 'reproducibility', 'Lockfile drift report failed'),
    sourceErrorFinding(results.runtimePinningResult, 'runtime-pinning', 'reproducibility', 'Runtime pinning report failed'),
    sourceErrorFinding(results.offlineCacheResult, 'offline-cache-readiness', 'reproducibility', 'Offline cache readiness report failed'),
    sourceErrorFinding(results.auditEvidenceResult, 'audit-evidence', 'security', 'Audit evidence report failed'),
    sourceErrorFinding(results.workspaceResult, 'workspace-discovery', 'workspaces', 'Workspace discovery failed'),
    sourceErrorFinding(results.operationResult, 'operation-history', 'operations', 'Operation history failed', 'medium')
  ].filter((item): item is ReleaseRiskProfileFinding => Boolean(item))
}

function sourceErrorFinding(
  result: CaptureResult<unknown>,
  source: ReleaseRiskSource,
  category: ReleaseRiskCategory,
  title: string,
  severity: ReleaseRiskSeverity = 'high'
): ReleaseRiskProfileFinding | null {
  if (!result.error) return null
  return finding({
    id: `${source}:error`,
    category,
    source,
    severity,
    title,
    summary: `${title}; release risk evidence is incomplete.`,
    recommendation: 'Repair unreadable or malformed project evidence files, then regenerate the release risk profile.',
    evidence: [result.error]
  })
}

function summarizeProfile(
  findings: ReleaseRiskProfileFinding[],
  categories: ReleaseRiskCategorySummary[],
  sourceErrors: Partial<Record<ReleaseRiskSource, string>>,
  readiness?: ReadinessGateReport,
  license?: LicenseComplianceReport,
  dependencyDiff?: DependencyComponentDiff | null,
  registrySummary?: RegistryReachabilitySummary,
  credentialSummary?: CredentialUsageSummary,
  lockfileDriftSummary?: LockfileDriftSummary,
  runtimePinningSummary?: RuntimePinningSummary,
  offlineCacheSummary?: OfflineCacheReadinessSummary,
  auditEvidenceSummary?: AuditEvidenceSummary,
  workspaceSummary?: WorkspaceDiscoverySummary,
  operationSummary?: OperationHistorySummary,
  failedMutatingOperationCount = 0
): ReleaseRiskProfileSummary {
  const severityCounts = countSeverities(findings)
  const computedScore = profileScore(findings, readiness?.score)
  const status = profileStatus(findings, readiness?.status)
  const topRiskCount = sortFindings(findings).filter((item) => item.severity !== 'info').slice(0, 10).length
  const licenseRiskCount = license
    ? license.summary.blockedLicenseComponentCount
      + license.summary.notAllowedLicenseComponentCount
      + (license.policy.requireKnownLicenses ? license.summary.unknownLicenseComponentCount : 0)
    : 0

  return {
    status,
    score: computedScore,
    findingCount: findings.length,
    critical: severityCounts.critical,
    high: severityCounts.high,
    medium: severityCounts.medium,
    low: severityCounts.low,
    info: severityCounts.info,
    topRiskCount,
    categoryCount: categories.length,
    sourceErrorCount: Object.keys(sourceErrors).length,
    readinessStatus: readiness?.status,
    readinessScore: readiness?.score,
    readinessBlockedCheckCount: readiness?.checks.filter((check) => check.status === 'blocked').length || 0,
    readinessWarningCheckCount: readiness?.checks.filter((check) => check.status === 'warning').length || 0,
    componentCount: license?.summary.componentCount || readiness?.summary.componentCount || 0,
    dependencyCriticalRiskCount: dependencyDiff?.summary.criticalRisk || readiness?.summary.dependencyHighRiskCount || 0,
    dependencyHighRiskCount: dependencyDiff?.summary.highRisk || readiness?.summary.dependencyHighRiskCount || 0,
    dependencyMediumRiskCount: dependencyDiff?.summary.mediumRisk || readiness?.summary.dependencyMediumRiskCount || 0,
    licenseRiskCount,
    policyViolationComponentCount: license?.summary.policyViolationComponentCount || readiness?.summary.policyViolationCount || 0,
    registryEndpointCount: registrySummary?.endpointCount || readiness?.summary.registryEndpointCount || 0,
    unreachableRegistryCount: registrySummary?.unreachable || readiness?.summary.unreachableRegistryCount || 0,
    insecureRegistryCount: registrySummary?.insecure || readiness?.summary.insecureRegistryCount || 0,
    credentialEndpointCount: credentialSummary?.endpointCount || readiness?.summary.credentialEndpointCount || 0,
    missingCredentialEndpointCount: credentialSummary?.missingCredentialEndpointCount || readiness?.summary.missingCredentialEndpointCount || 0,
    weakCredentialMatchCount: credentialSummary?.weakMatchEndpointCount || readiness?.summary.weakCredentialMatchCount || 0,
    insecureCredentialCount: (credentialSummary?.insecureStorageEndpointCount || 0) + (credentialSummary?.insecureEndpointCount || 0),
    unusedCredentialCount: credentialSummary?.unusedCredentialCount || readiness?.summary.unusedCredentialCount || 0,
    workspaceCount: workspaceSummary?.workspaceCount || readiness?.summary.workspaceCount || 0,
    workspaceManagerCount: workspaceSummary?.managerCount || readiness?.summary.workspaceManagerCount || 0,
    lockfileDriftFindingCount: lockfileDriftSummary?.findingCount || readiness?.summary.lockfileDriftFindingCount || 0,
    runtimePinningFindingCount: runtimePinningSummary?.findingCount || readiness?.summary.runtimePinningFindingCount || 0,
    offlineCacheFindingCount: offlineCacheSummary?.findingCount || 0,
    deploymentReferenceCount: readiness?.summary.deploymentReferenceCount || 0,
    floatingDeploymentRefCount: readiness?.summary.floatingDeploymentRefCount || 0,
    deploymentBaselineEvidenceCount: readiness?.summary.deploymentBaselineEvidenceCount || 0,
    missingDeploymentBaselineCount: readiness?.summary.missingDeploymentBaselineCount || 0,
    auditEvidenceFindingCount: auditEvidenceSummary?.findingCount || readiness?.summary.auditEvidenceFindingCount || 0,
    auditCriticalFindingCount: auditEvidenceSummary?.critical || readiness?.summary.auditCriticalFindingCount || 0,
    auditHighFindingCount: auditEvidenceSummary?.high || readiness?.summary.auditHighFindingCount || 0,
    auditMediumFindingCount: auditEvidenceSummary?.medium || readiness?.summary.auditMediumFindingCount || 0,
    auditFixAvailableCount: auditEvidenceSummary?.fixAvailableCount || readiness?.summary.auditFixAvailableCount || 0,
    missingOfflineCacheLockfileCount: offlineCacheSummary?.missingLockfileManagerCount || 0,
    missingOfflineCacheConfigCount: offlineCacheSummary?.missingCacheConfigManagerCount || 0,
    missingOfflineCommandCount: offlineCacheSummary?.missingOfflineCommandManagerCount || 0,
    floatingContainerTagCount: runtimePinningSummary?.floatingContainerTagCount || readiness?.summary.floatingContainerTagCount || 0,
    operationCount: operationSummary?.total || readiness?.summary.recentOperationCount || 0,
    failedOperationCount: operationSummary?.error || readiness?.summary.failedOperationCount || 0,
    failedMutatingOperationCount
  }
}

function summarizeCategory(category: ReleaseRiskCategory, findings: ReleaseRiskProfileFinding[]): ReleaseRiskCategorySummary {
  const scoped = findings.filter((finding) => finding.category === category)
  const severityCounts = countSeverities(scoped)
  return {
    category,
    title: CATEGORY_TITLES[category],
    status: categoryStatus(scoped),
    score: Math.max(0, 100 - severityPenalty(scoped)),
    findingCount: scoped.length,
    critical: severityCounts.critical,
    high: severityCounts.high,
    medium: severityCounts.medium,
    low: severityCounts.low,
    info: severityCounts.info
  }
}

function countSeverities(findings: ReleaseRiskProfileFinding[]): Record<ReleaseRiskSeverity, number> {
  return {
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    low: findings.filter((finding) => finding.severity === 'low').length,
    info: findings.filter((finding) => finding.severity === 'info').length
  }
}

function categoryStatus(findings: ReleaseRiskProfileFinding[]): ReleaseRiskProfileStatus {
  if (findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high')) return 'blocked'
  if (findings.some((finding) => finding.severity === 'medium' || finding.severity === 'low')) return 'warning'
  return 'ready'
}

function profileStatus(findings: ReleaseRiskProfileFinding[], readinessStatus?: ReadinessGateStatus): ReleaseRiskProfileStatus {
  if (readinessStatus === 'blocked') return 'blocked'
  if (findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high')) return 'blocked'
  if (readinessStatus === 'warning') return 'warning'
  if (findings.some((finding) => finding.severity === 'medium' || finding.severity === 'low')) return 'warning'
  return 'ready'
}

function profileScore(findings: ReleaseRiskProfileFinding[], readinessScore?: number): number {
  const computed = Math.max(0, 100 - severityPenalty(findings))
  return typeof readinessScore === 'number' ? Math.min(readinessScore, computed) : computed
}

function severityPenalty(findings: ReleaseRiskProfileFinding[]): number {
  return findings.reduce((total, finding) => {
    return total + {
      critical: 22,
      high: 14,
      medium: 6,
      low: 2,
      info: 0
    }[finding.severity]
  }, 0)
}

function releaseSeverityFromReadinessCheck(check: ReadinessGateCheck): ReleaseRiskSeverity {
  if (check.status === 'blocked') {
    if (check.severity === 'critical' || check.severity === 'high' || check.severity === 'medium') return check.severity
    return 'medium'
  }
  if (check.status === 'warning') {
    if (check.severity === 'critical' || check.severity === 'high') return 'high'
    if (check.severity === 'info') return 'low'
    return check.severity
  }
  return 'info'
}

function releaseCategoryFromReadinessCheck(check: ReadinessGateCheck): ReleaseRiskCategory {
  if (check.id === 'deployment-references' || check.id === 'deployment-baselines') return 'deployment'
  return 'readiness'
}

function releaseSeverityFromAuditFinding(finding: Pick<AuditEvidenceFinding, 'severity' | 'fixedVersion'>): ReleaseRiskSeverity {
  if (finding.severity === 'critical' || finding.severity === 'high' || finding.severity === 'medium' || finding.severity === 'low') {
    return finding.severity
  }
  return finding.fixedVersion ? 'low' : 'info'
}

function finding(input: ReleaseRiskProfileFinding): ReleaseRiskProfileFinding {
  return {
    ...input,
    evidence: input.evidence.filter(Boolean).slice(0, 20)
  }
}

function sortFindings(findings: ReleaseRiskProfileFinding[]): ReleaseRiskProfileFinding[] {
  return [...findings].sort((a, b) => {
    const severity = severityRank(b.severity) - severityRank(a.severity)
    if (severity !== 0) return severity
    const category = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (category !== 0) return category
    return a.title.localeCompare(b.title)
  })
}

function severityRank(severity: ReleaseRiskSeverity): number {
  return {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  }[severity]
}

function dedupeFindings(findings: ReleaseRiskProfileFinding[]): ReleaseRiskProfileFinding[] {
  const byKey = new Map<string, ReleaseRiskProfileFinding>()
  for (const item of findings) {
    const key = `${item.category}\n${item.source}\n${item.title}\n${item.workspaceRelativePath || ''}`
    const existing = byKey.get(key)
    if (!existing || severityRank(item.severity) > severityRank(existing.severity)) {
      byKey.set(key, item)
    }
  }
  return Array.from(byKey.values())
}

function sourceErrorMap(results: {
  readinessResult: CaptureResult<unknown>
  licenseResult: CaptureResult<unknown>
  dependencyDiffResult: CaptureResult<unknown>
  registryResult: CaptureResult<unknown>
  credentialResult: CaptureResult<unknown>
  lockfileDriftResult: CaptureResult<unknown>
  runtimePinningResult: CaptureResult<unknown>
  offlineCacheResult: CaptureResult<unknown>
  auditEvidenceResult: CaptureResult<unknown>
  workspaceResult: CaptureResult<unknown>
  operationResult: CaptureResult<unknown>
}): Partial<Record<ReleaseRiskSource, string>> {
  const entries: Array<[ReleaseRiskSource, string | undefined]> = [
    ['readiness-gate', results.readinessResult.error],
    ['license-compliance', results.licenseResult.error],
    ['dependency-diff', results.dependencyDiffResult.error],
    ['registry-reachability', results.registryResult.error],
    ['credential-usage', results.credentialResult.error],
    ['lockfile-drift', results.lockfileDriftResult.error],
    ['runtime-pinning', results.runtimePinningResult.error],
    ['offline-cache-readiness', results.offlineCacheResult.error],
    ['audit-evidence', results.auditEvidenceResult.error],
    ['workspace-discovery', results.workspaceResult.error],
    ['operation-history', results.operationResult.error]
  ]
  return entries.reduce<Partial<Record<ReleaseRiskSource, string>>>((errors, [source, error]) => {
    if (error) errors[source] = error
    return errors
  }, {})
}

function renderReleaseRiskProfileMarkdown(report: ReleaseRiskProfileReport): string {
  const lines = [
    '# Release Risk Profile',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    `Score: ${report.score}/100`,
    '',
    '## Summary',
    '',
    `- Findings: ${report.summary.findingCount}`,
    `- Critical/high/medium/low/info: ${report.summary.critical}/${report.summary.high}/${report.summary.medium}/${report.summary.low}/${report.summary.info}`,
    `- Readiness: ${report.summary.readinessStatus || '-'} ${report.summary.readinessScore ?? '-'}`,
    `- Components: ${report.summary.componentCount}`,
    `- Dependency high+ risk: ${report.summary.dependencyCriticalRiskCount + report.summary.dependencyHighRiskCount}`,
    `- License risk: ${report.summary.licenseRiskCount}`,
    `- Registry failures: ${report.summary.unreachableRegistryCount}`,
    `- Credential gaps: ${report.summary.missingCredentialEndpointCount}`,
    `- Lockfile drift findings: ${report.summary.lockfileDriftFindingCount}`,
    `- Runtime pinning findings: ${report.summary.runtimePinningFindingCount}`,
    `- Offline cache findings: ${report.summary.offlineCacheFindingCount}`,
    `- Deployment references: ${report.summary.deploymentReferenceCount}`,
    `- Floating deployment refs: ${report.summary.floatingDeploymentRefCount}`,
    `- Missing deployment baselines: ${report.summary.missingDeploymentBaselineCount}`,
    `- Audit findings critical/high/medium: ${report.summary.auditCriticalFindingCount}/${report.summary.auditHighFindingCount}/${report.summary.auditMediumFindingCount}`,
    `- Audit fixes available: ${report.summary.auditFixAvailableCount}`,
    `- Missing offline lock/cache/command: ${report.summary.missingOfflineCacheLockfileCount}/${report.summary.missingOfflineCacheConfigCount}/${report.summary.missingOfflineCommandCount}`,
    `- Floating container tags: ${report.summary.floatingContainerTagCount}`,
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Failed operations: ${report.summary.failedOperationCount}`,
    `- Source errors: ${report.summary.sourceErrorCount}`,
    '',
    '## Categories',
    '',
    '| Category | Status | Score | Findings | Critical | High | Medium | Low | Info |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.categories.map((category) => [
      escapeMarkdownTable(category.title),
      category.status,
      String(category.score),
      String(category.findingCount),
      String(category.critical),
      String(category.high),
      String(category.medium),
      String(category.low),
      String(category.info)
    ].join(' | ')).map((row) => `| ${row} |`),
    '',
    '## Top Risks',
    ''
  ]

  if (report.topRisks.length === 0) {
    lines.push('- No blocking or warning release risks were found.')
  } else {
    lines.push('| Severity | Category | Source | Risk | Recommendation |')
    lines.push('| --- | --- | --- | --- | --- |')
    lines.push(...report.topRisks.map((risk) => `| ${risk.severity} | ${CATEGORY_TITLES[risk.category]} | ${risk.source} | ${escapeMarkdownTable(risk.summary)} | ${escapeMarkdownTable(risk.recommendation)} |`))
  }

  lines.push('', '## Source Summaries', '')
  lines.push(`- Readiness blocked/warning gates: ${report.summary.readinessBlockedCheckCount}/${report.summary.readinessWarningCheckCount}`)
  lines.push(`- Policy violation components: ${report.summary.policyViolationComponentCount}`)
  lines.push(`- Registry endpoints: ${report.summary.registryEndpointCount}`)
  lines.push(`- Credential endpoints: ${report.summary.credentialEndpointCount}`)
  lines.push(`- Offline/cache findings: ${report.summary.offlineCacheFindingCount}`)
  lines.push(`- Deployment references: ${report.summary.deploymentReferenceCount}`)
  lines.push(`- Missing deployment baselines: ${report.summary.missingDeploymentBaselineCount}`)
  lines.push(`- Vulnerability audit findings: ${report.summary.auditEvidenceFindingCount}`)
  lines.push(`- Workspace managers: ${report.summary.workspaceManagerCount}`)
  lines.push(`- Operations: ${report.summary.operationCount}`)

  if (Object.keys(report.sources.errors).length > 0) {
    lines.push('', '## Source Errors', '')
    for (const [source, error] of Object.entries(report.sources.errors)) {
      lines.push(`- ${source}: ${error}`)
    }
  }

  lines.push('', '## Findings', '')
  for (const category of report.categories) {
    const findings = report.findings.filter((item) => item.category === category.category)
    lines.push(`### ${category.title}`)
    if (findings.length === 0) {
      lines.push('- No findings.')
      lines.push('')
      continue
    }
    for (const item of findings) {
      lines.push(`- [${item.severity}] ${item.title} (${item.source})`)
      lines.push(`  - Summary: ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
      if (item.workspaceRelativePath) lines.push(`  - Workspace: ${item.workspaceRelativePath}`)
      if (item.evidence.length > 0) {
        lines.push(...item.evidence.slice(0, 5).map((evidence) => `  - Evidence: ${evidence}`))
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
