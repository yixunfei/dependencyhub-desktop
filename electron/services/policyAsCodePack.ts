import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  SupplyChainService,
  type DependencyPolicy,
  type DependencyPolicyEvaluation
} from './supplyChain'
import {
  ReadinessGateService,
  type ReadinessGateReport,
  type ReadinessGateStatus,
  type ReadinessPolicy
} from './readinessGate'
import {
  DependencyAutomationPlanService,
  type DependencyAutomationPlanReport
} from './dependencyAutomationPlan'
import {
  AutomationSafetyPlanService,
  type AutomationSafetyPlanReport
} from './automationSafetyPlan'
import {
  DependencyOwnershipPlanService,
  type DependencyOwnershipPlanReport
} from './dependencyOwnershipPlan'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport
} from './workspaceDiscovery'

export type PolicyAsCodeExportFormat = 'markdown' | 'json' | 'policy-json' | 'github-actions'
export type PolicyAsCodeStatus = 'ready' | 'warning' | 'blocked'
export type PolicyAsCodeFindingSeverity = 'info' | 'warning' | 'blocked'
export type PolicyAsCodeFindingSource =
  | 'dependency-policy'
  | 'readiness-policy'
  | 'dependency-automation'
  | 'automation-safety'
  | 'dependency-ownership'
  | 'workspace-discovery'
  | 'policy-as-code'

export interface PolicyAsCodeDependencyPolicySource {
  path: string
  policy: DependencyPolicy
  evaluation?: Pick<DependencyPolicyEvaluation, 'generatedAt' | 'componentCount' | 'violationCount'>
}

export interface PolicyAsCodeReadinessPolicySource {
  path: string
  policy: ReadinessPolicy
  status?: ReadinessGateStatus
  score?: number
}

export interface PolicyAsCodePack {
  schemaVersion: string
  generatedAt: string
  projectPath: string
  managers: DependencyManagerId[]
  policies: {
    dependencyPolicy?: PolicyAsCodeDependencyPolicySource
    readinessPolicy?: PolicyAsCodeReadinessPolicySource
  }
  enforcement: {
    dependencyPolicyRules: string[]
    readinessGates: string[]
    deploymentPolicyGates: string[]
    automationSafetyRules: Array<{
      id: string
      provider: string
      workspace: string
      managerId: DependencyManagerId
      updateType: string
      decision: string
      requiredApprovals: number
      requiredEvidence: string[]
    }>
    reviewRoutes: Array<{
      id: string
      workspace: string
      managerId: DependencyManagerId
      updateType: string
      provider: string
      status: string
      owners: string[]
      requiredApprovals: number
    }>
  }
  ci: {
    requiredSecrets: string[]
    requiredArtifacts: string[]
    suggestedWorkflowPath: string
    commands: string[]
  }
}

export interface PolicyAsCodeFinding {
  id: string
  severity: PolicyAsCodeFindingSeverity
  source: PolicyAsCodeFindingSource
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface PolicyAsCodeSummary {
  status: PolicyAsCodeStatus
  managerCount: number
  managers: DependencyManagerId[]
  dependencyPolicyRuleCount: number
  readinessGateCount: number
  deploymentPolicyGateCount: number
  automationSafetyRuleCount: number
  blockedAutomationSafetyRuleCount: number
  reviewRouteCount: number
  missingOwnerRouteCount: number
  requiredSecretCount: number
  requiredArtifactCount: number
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
  readinessStatus?: ReadinessGateStatus
  automationSafetyStatus?: PolicyAsCodeStatus
  ownershipStatus?: PolicyAsCodeStatus
}

export interface PolicyAsCodeReport {
  generatedAt: string
  projectPath: string
  status: PolicyAsCodeStatus
  summary: PolicyAsCodeSummary
  pack: PolicyAsCodePack
  githubActionsWorkflow: string
  findings: PolicyAsCodeFinding[]
  sources: {
    discovery?: Pick<WorkspaceDiscoveryReport, 'generatedAt' | 'summary'>
    readiness?: Pick<ReadinessGateReport, 'generatedAt' | 'status' | 'score' | 'summary'>
    dependencyAutomation?: Pick<DependencyAutomationPlanReport, 'generatedAt' | 'status' | 'summary'>
    automationSafety?: Pick<AutomationSafetyPlanReport, 'generatedAt' | 'status' | 'summary'>
    dependencyOwnership?: Pick<DependencyOwnershipPlanReport, 'generatedAt' | 'status' | 'summary'>
    errors: Partial<Record<PolicyAsCodeFindingSource, string>>
  }
}

export interface PolicyAsCodeExportResult {
  path: string
  format: PolicyAsCodeExportFormat
  generatedAt: string
  status: PolicyAsCodeStatus
  findingCount: number
  count: number
  summary: PolicyAsCodeSummary
}

export interface PolicyAsCodeDependencies {
  supplyChainService?: SupplyChainService
  readinessGateService?: ReadinessGateService
  dependencyAutomationPlanService?: DependencyAutomationPlanService
  automationSafetyPlanService?: AutomationSafetyPlanService
  dependencyOwnershipPlanService?: DependencyOwnershipPlanService
  workspaceDiscoveryService?: WorkspaceDiscoveryService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const POLICY_AS_CODE_DIR = '.npmDesktopManager/reports/policy-as-code'
const SCHEMA_VERSION = '1.0.0'

export class PolicyAsCodePackService {
  private readonly supplyChainService: SupplyChainService
  private readonly readinessGateService: ReadinessGateService
  private readonly dependencyAutomationPlanService: DependencyAutomationPlanService
  private readonly automationSafetyPlanService: AutomationSafetyPlanService
  private readonly dependencyOwnershipPlanService: DependencyOwnershipPlanService
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService

  constructor(dependencies: PolicyAsCodeDependencies = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.supplyChainService = dependencies.supplyChainService || new SupplyChainService()
    this.readinessGateService = dependencies.readinessGateService || new ReadinessGateService({
      supplyChainService: this.supplyChainService,
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.dependencyAutomationPlanService = dependencies.dependencyAutomationPlanService || new DependencyAutomationPlanService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.automationSafetyPlanService = dependencies.automationSafetyPlanService || new AutomationSafetyPlanService({
      dependencyAutomationPlanService: this.dependencyAutomationPlanService,
      readinessGateService: this.readinessGateService
    })
    this.dependencyOwnershipPlanService = dependencies.dependencyOwnershipPlanService || new DependencyOwnershipPlanService({
      workspaceDiscoveryService: this.workspaceDiscoveryService,
      dependencyAutomationPlanService: this.dependencyAutomationPlanService,
      automationSafetyPlanService: this.automationSafetyPlanService
    })
  }

  async report(projectPath: string): Promise<PolicyAsCodeReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [discoveryResult, dependencyPolicyResult, policyEvaluationResult, readinessPolicyResult, readinessResult, automationResult, safetyResult, ownershipResult] = await Promise.all([
      capture(() => this.workspaceDiscoveryService.report(root)),
      capture(() => this.supplyChainService.getPolicy(root)),
      capture(() => this.supplyChainService.evaluatePolicy(root)),
      capture(() => this.readinessGateService.getPolicy(root)),
      capture(() => this.readinessGateService.report(root)),
      capture(() => this.dependencyAutomationPlanService.plan(root)),
      capture(() => this.automationSafetyPlanService.plan(root)),
      capture(() => this.dependencyOwnershipPlanService.plan(root))
    ])

    const generatedAt = new Date().toISOString()
    const managers = sortManagers(discoveryResult.value?.summary.managers || automationResult.value?.summary.managers || [])
    const dependencyPolicyRules = dependencyPolicyResult.value
      ? dependencyPolicyRuleLabels(dependencyPolicyResult.value.policy)
      : []
    const readinessGates = readinessPolicyResult.value
      ? readinessGateLabels(readinessPolicyResult.value.policy)
      : []
    const pack = buildPack({
      generatedAt,
      projectPath: root,
      managers,
      dependencyPolicy: dependencyPolicyResult.value,
      policyEvaluation: policyEvaluationResult.value,
      readinessPolicy: readinessPolicyResult.value,
      readiness: readinessResult.value,
      automation: automationResult.value,
      safety: safetyResult.value,
      ownership: ownershipResult.value,
      dependencyPolicyRules,
      readinessGates
    })
    const findings = buildFindings({
      dependencyPolicyRules,
      readinessGates,
      discoveryResult,
      dependencyPolicyResult,
      readinessPolicyResult,
      automationResult,
      safetyResult,
      ownershipResult
    })
    const summary = summarize(pack, findings, readinessResult.value, safetyResult.value, ownershipResult.value)
    const githubActionsWorkflow = renderGithubActionsWorkflow(pack)

    return {
      generatedAt,
      projectPath: root,
      status: summary.status,
      summary,
      pack,
      githubActionsWorkflow,
      findings,
      sources: {
        discovery: discoveryResult.value
          ? {
              generatedAt: discoveryResult.value.generatedAt,
              summary: discoveryResult.value.summary
            }
          : undefined,
        readiness: readinessResult.value
          ? {
              generatedAt: readinessResult.value.generatedAt,
              status: readinessResult.value.status,
              score: readinessResult.value.score,
              summary: readinessResult.value.summary
            }
          : undefined,
        dependencyAutomation: automationResult.value
          ? {
              generatedAt: automationResult.value.generatedAt,
              status: automationResult.value.status,
              summary: automationResult.value.summary
            }
          : undefined,
        automationSafety: safetyResult.value
          ? {
              generatedAt: safetyResult.value.generatedAt,
              status: safetyResult.value.status,
              summary: safetyResult.value.summary
            }
          : undefined,
        dependencyOwnership: ownershipResult.value
          ? {
              generatedAt: ownershipResult.value.generatedAt,
              status: ownershipResult.value.status,
              summary: ownershipResult.value.summary
            }
          : undefined,
        errors: sourceErrors({
          discoveryResult,
          dependencyPolicyResult,
          readinessPolicyResult,
          automationResult,
          safetyResult,
          ownershipResult
        })
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<PolicyAsCodeExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'policy-as-code-pack.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderPolicyAsCodeMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<PolicyAsCodeExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'policy-as-code-pack.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }

  async exportPolicyJson(projectPath: string): Promise<PolicyAsCodeExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), POLICY_AS_CODE_DIR, 'dependency-governance.policy.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report.pack, null, 2), 'utf-8')
    return exportResult(path, 'policy-json', report)
  }

  async exportGithubActions(projectPath: string): Promise<PolicyAsCodeExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), POLICY_AS_CODE_DIR, 'github-actions-policy-check.yml')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, report.githubActionsWorkflow, 'utf-8')
    return exportResult(path, 'github-actions', report)
  }
}

function buildPack(input: {
  generatedAt: string
  projectPath: string
  managers: DependencyManagerId[]
  dependencyPolicy?: { path: string; policy: DependencyPolicy }
  policyEvaluation?: DependencyPolicyEvaluation
  readinessPolicy?: { path: string; policy: ReadinessPolicy }
  readiness?: ReadinessGateReport
  automation?: DependencyAutomationPlanReport
  safety?: AutomationSafetyPlanReport
  ownership?: DependencyOwnershipPlanReport
  dependencyPolicyRules: string[]
  readinessGates: string[]
}): PolicyAsCodePack {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    projectPath: input.projectPath,
    managers: input.managers,
    policies: {
      dependencyPolicy: input.dependencyPolicy
        ? {
            path: input.dependencyPolicy.path,
            policy: input.dependencyPolicy.policy,
            evaluation: input.policyEvaluation
              ? {
                  generatedAt: input.policyEvaluation.generatedAt,
                  componentCount: input.policyEvaluation.componentCount,
                  violationCount: input.policyEvaluation.violationCount
                }
              : undefined
          }
        : undefined,
      readinessPolicy: input.readinessPolicy
        ? {
            path: input.readinessPolicy.path,
            policy: input.readinessPolicy.policy,
            status: input.readiness?.status,
            score: input.readiness?.score
          }
        : undefined
    },
    enforcement: {
      dependencyPolicyRules: input.dependencyPolicyRules,
      readinessGates: input.readinessGates,
      deploymentPolicyGates: deploymentPolicyGateLabels(input.readinessPolicy?.policy),
      automationSafetyRules: (input.safety?.rules || []).map((rule) => ({
        id: rule.id,
        provider: rule.provider,
        workspace: rule.workspaceRelativePath,
        managerId: rule.managerId,
        updateType: rule.updateType,
        decision: rule.decision,
        requiredApprovals: rule.requiredApprovals,
        requiredEvidence: rule.requiredEvidence
      })),
      reviewRoutes: (input.ownership?.reviewRoutes || []).map((route) => ({
        id: route.id,
        workspace: route.workspaceRelativePath,
        managerId: route.managerId,
        updateType: route.updateType,
        provider: route.provider,
        status: route.status,
        owners: route.owners,
        requiredApprovals: route.requiredApprovals
      }))
    },
    ci: {
      requiredSecrets: input.automation?.requiredSecrets || [],
      requiredArtifacts: [
        'readiness-report.json',
        'release-risk-profile.json',
        'workspace-remediation-plan.json',
        'ci-integration-plan.json',
        'dependency-automation-plan.json',
        'automation-safety-plan.json',
        'dependency-ownership-plan.json',
        'audit-evidence-report.json',
        'vulnerability-remediation-plan.json',
        'release-provenance-attestation.json',
        'THIRD-PARTY-NOTICES.txt',
        'third-party-notices.json',
        'policy-as-code-pack.json'
      ],
      suggestedWorkflowPath: '.github/workflows/dependency-policy-check.yml',
      commands: [
        'npm ci --ignore-scripts',
        'npx tsc --noEmit',
        'npm run verify:framework --if-present',
        'npm run verify:release-integrity --if-present -- optional json silent',
        'npm run verify:release-signature --if-present -- optional json silent',
        'npm run verify:release-trust --if-present -- optional json silent'
      ]
    }
  }
}

function dependencyPolicyRuleLabels(policy: DependencyPolicy): string[] {
  const rules: string[] = []
  if (policy.requirePinnedVersions) rules.push('require pinned versions')
  if (policy.disallowPrerelease) rules.push('disallow prerelease versions')
  if (policy.requireKnownLicenses) rules.push('require known licenses')
  if (policy.blockedManagers.length > 0) rules.push(`blocked managers: ${policy.blockedManagers.join(', ')}`)
  if (policy.blockedPackages.length > 0) rules.push(`blocked packages: ${policy.blockedPackages.join(', ')}`)
  if (policy.blockedLicenses.length > 0) rules.push(`blocked licenses: ${policy.blockedLicenses.join(', ')}`)
  if (policy.allowedManagers.length > 0) rules.push(`allowed managers: ${policy.allowedManagers.join(', ')}`)
  if (policy.allowedLicenses.length > 0) rules.push(`allowed licenses: ${policy.allowedLicenses.join(', ')}`)
  if (typeof policy.maxComponents === 'number') rules.push(`max components: ${policy.maxComponents}`)
  for (const rule of policy.packageRules) {
    rules.push(`package rule ${rule.id}: ${rule.packagePatterns.join(', ')}`)
  }
  return rules
}

function readinessGateLabels(policy: ReadinessPolicy): string[] {
  const gates: string[] = []
  for (const [key, value] of Object.entries(policy)) {
    if (typeof value === 'boolean' && value && key.startsWith('block')) {
      gates.push(key)
    }
  }
  if (policy.requiredReleaseApprovals > 0) gates.push(`required release approvals: ${policy.requiredReleaseApprovals}`)
  if (policy.minimumScore > 0 || policy.blockBelowMinimumScore) gates.push(`minimum readiness score: ${policy.minimumScore}`)
  gates.push(`max high-risk dependency changes: ${policy.maxHighRiskDependencyChanges}`)
  gates.push(`max high-severity policy violations: ${policy.maxHighSeverityPolicyViolations}`)
  gates.push(`max unreachable registries: ${policy.maxUnreachableRegistries}`)
  gates.push(`max lockfile drift warnings: ${policy.maxLockfileDriftWarnings}`)
  gates.push(`max runtime pinning warnings: ${policy.maxRuntimePinningWarnings}`)
  gates.push(`max floating deployment refs: ${policy.maxFloatingDeploymentRefs}`)
  gates.push(`max missing deployment baselines: ${policy.maxMissingDeploymentBaselines}`)
  gates.push(`max missing credential endpoints: ${policy.maxMissingCredentialEndpoints}`)
  gates.push(`audit evidence max age days: ${policy.auditEvidenceMaxAgeDays}`)
  gates.push(`max critical audit findings: ${policy.maxCriticalAuditFindings}`)
  gates.push(`max high audit findings: ${policy.maxHighAuditFindings}`)
  gates.push(`max medium audit findings: ${policy.maxMediumAuditFindings}`)
  return unique(gates)
}

function deploymentPolicyGateLabels(policy?: ReadinessPolicy): string[] {
  if (!policy) return []
  const gates: string[] = [
    `max floating deployment refs: ${policy.maxFloatingDeploymentRefs}`,
    `max missing deployment baselines: ${policy.maxMissingDeploymentBaselines}`
  ]
  if (policy.blockOnFloatingDeploymentRefs) gates.push('blockOnFloatingDeploymentRefs')
  if (policy.blockOnMissingDeploymentBaselines) gates.push('blockOnMissingDeploymentBaselines')
  return unique(gates)
}

function buildFindings(input: {
  dependencyPolicyRules: string[]
  readinessGates: string[]
  discoveryResult: CaptureResult<WorkspaceDiscoveryReport>
  dependencyPolicyResult: CaptureResult<{ path: string; policy: DependencyPolicy }>
  readinessPolicyResult: CaptureResult<{ path: string; policy: ReadinessPolicy }>
  automationResult: CaptureResult<DependencyAutomationPlanReport>
  safetyResult: CaptureResult<AutomationSafetyPlanReport>
  ownershipResult: CaptureResult<DependencyOwnershipPlanReport>
}): PolicyAsCodeFinding[] {
  const findings: PolicyAsCodeFinding[] = []
  for (const [source, error] of Object.entries(sourceErrors(input))) {
    if (!error) continue
    findings.push(finding({
      id: `${source}:source-error`,
      severity: 'warning',
      source: source as PolicyAsCodeFindingSource,
      title: `${source} is unavailable`,
      summary: error,
      recommendation: 'Regenerate the policy-as-code pack after this policy source is available.',
      evidence: [error]
    }))
  }

  if (input.dependencyPolicyRules.length === 0) {
    findings.push(finding({
      id: 'dependency-policy:no-rules',
      severity: 'warning',
      source: 'dependency-policy',
      title: 'Dependency policy has no enforceable rules',
      summary: 'The exported policy pack would not restrict versions, licenses, managers, packages, or package families.',
      recommendation: 'Add dependency policy rules before treating the pack as production enforcement.',
      evidence: ['No dependency policy rules were found.']
    }))
  }

  if (input.readinessGates.length < 4) {
    findings.push(finding({
      id: 'readiness-policy:weak-gates',
      severity: 'warning',
      source: 'readiness-policy',
      title: 'Readiness policy has few explicit gates',
      summary: 'The exported readiness policy does not yet express a broad production release contract.',
      recommendation: 'Enable CI, approval, registry, reproducibility, credential, and score gates for stricter production use.',
      evidence: input.readinessGates
    }))
  }

  for (const item of input.safetyResult.value?.findings || []) {
    if (item.severity === 'info') continue
    findings.push(finding({
      id: `automation-safety:${item.id}`,
      severity: item.severity,
      source: 'automation-safety',
      title: item.title,
      summary: item.summary,
      recommendation: item.recommendation,
      evidence: item.evidence
    }))
  }

  for (const item of input.ownershipResult.value?.findings || []) {
    if (item.severity === 'info') continue
    findings.push(finding({
      id: `dependency-ownership:${item.id}`,
      severity: item.severity,
      source: 'dependency-ownership',
      title: item.title,
      summary: item.summary,
      recommendation: item.recommendation,
      evidence: item.evidence
    }))
  }

  if ((input.automationResult.value?.requiredSecrets.length || 0) > 0) {
    findings.push(finding({
      id: 'dependency-automation:required-secrets',
      severity: 'info',
      source: 'dependency-automation',
      title: 'Automation secrets must be configured in CI',
      summary: `Required secret placeholders: ${input.automationResult.value?.requiredSecrets.join(', ')}.`,
      recommendation: 'Create these secrets in the CI provider before enabling automated dependency workflows.',
      evidence: input.automationResult.value?.requiredSecrets || []
    }))
  }

  return uniqueBy(findings, (item) => item.id).slice(0, 300)
}

function summarize(
  pack: PolicyAsCodePack,
  findings: PolicyAsCodeFinding[],
  readiness?: ReadinessGateReport,
  safety?: AutomationSafetyPlanReport,
  ownership?: DependencyOwnershipPlanReport
): PolicyAsCodeSummary {
  const blockedFindingCount = findings.filter((item) => item.severity === 'blocked').length
  const warningFindingCount = findings.filter((item) => item.severity === 'warning').length
  const blockedSafetyRules = pack.enforcement.automationSafetyRules.filter((rule) => rule.decision === 'blocked').length
  const missingOwnerRoutes = pack.enforcement.reviewRoutes.filter((route) => route.owners.length === 0 || route.status === 'blocked').length
  const status: PolicyAsCodeStatus = blockedFindingCount > 0 || blockedSafetyRules > 0 || missingOwnerRoutes > 0
    ? 'blocked'
    : warningFindingCount > 0 || readiness?.status === 'warning' || safety?.status === 'warning' || ownership?.status === 'warning'
      ? 'warning'
      : 'ready'

  return {
    status,
    managerCount: pack.managers.length,
    managers: pack.managers,
    dependencyPolicyRuleCount: pack.enforcement.dependencyPolicyRules.length,
    readinessGateCount: pack.enforcement.readinessGates.length,
    deploymentPolicyGateCount: pack.enforcement.deploymentPolicyGates.length,
    automationSafetyRuleCount: pack.enforcement.automationSafetyRules.length,
    blockedAutomationSafetyRuleCount: blockedSafetyRules,
    reviewRouteCount: pack.enforcement.reviewRoutes.length,
    missingOwnerRouteCount: missingOwnerRoutes,
    requiredSecretCount: pack.ci.requiredSecrets.length,
    requiredArtifactCount: pack.ci.requiredArtifacts.length,
    findingCount: findings.length,
    blockedFindingCount,
    warningFindingCount,
    readinessStatus: readiness?.status,
    automationSafetyStatus: safety?.status,
    ownershipStatus: ownership?.status
  }
}

function renderPolicyAsCodeMarkdown(report: PolicyAsCodeReport): string {
  const lines = [
    '# Policy-as-Code Pack',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    `- Dependency policy rules: ${report.summary.dependencyPolicyRuleCount}`,
    `- Readiness gates: ${report.summary.readinessGateCount}`,
    `- Deployment policy gates: ${report.summary.deploymentPolicyGateCount}`,
    `- Automation safety rules: ${report.summary.automationSafetyRuleCount}`,
    `- Review routes: ${report.summary.reviewRouteCount}`,
    `- Missing owner routes: ${report.summary.missingOwnerRouteCount}`,
    `- Required secrets: ${report.pack.ci.requiredSecrets.join(', ') || '-'}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Blocked/warning findings: ${report.summary.blockedFindingCount}/${report.summary.warningFindingCount}`,
    '',
    '## Dependency Policy Rules',
    ''
  ]

  if (report.pack.enforcement.dependencyPolicyRules.length === 0) {
    lines.push('- No dependency policy rules were exported.')
  } else {
    lines.push(...report.pack.enforcement.dependencyPolicyRules.map((rule) => `- ${rule}`))
  }

  lines.push('', '## Readiness Gates', '')
  if (report.pack.enforcement.readinessGates.length === 0) {
    lines.push('- No readiness gates were exported.')
  } else {
    lines.push(...report.pack.enforcement.readinessGates.map((gate) => `- ${gate}`))
  }

  lines.push('', '## Deployment Policy Gates', '')
  if (report.pack.enforcement.deploymentPolicyGates.length === 0) {
    lines.push('- No deployment policy gates were exported.')
  } else {
    lines.push(...report.pack.enforcement.deploymentPolicyGates.map((gate) => `- ${gate}`))
  }

  lines.push(
    '',
    '## Automation Safety',
    '',
    '| Decision | Provider | Workspace | Manager | Update | Approvals |',
    '| --- | --- | --- | --- | --- | ---: |'
  )
  for (const rule of report.pack.enforcement.automationSafetyRules.slice(0, 120)) {
    lines.push([
      rule.decision,
      rule.provider,
      markdownCell(rule.workspace),
      rule.managerId,
      rule.updateType,
      String(rule.requiredApprovals)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push(
    '',
    '## Review Routing',
    '',
    '| Status | Provider | Workspace | Manager | Update | Owners | Approvals |',
    '| --- | --- | --- | --- | --- | --- | ---: |'
  )
  for (const route of report.pack.enforcement.reviewRoutes.slice(0, 120)) {
    lines.push([
      route.status,
      route.provider,
      markdownCell(route.workspace),
      route.managerId,
      route.updateType,
      markdownCell(route.owners.join(', ') || '-'),
      String(route.requiredApprovals)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.findings.length === 0) {
    lines.push('- No policy-as-code findings.')
  } else {
    for (const item of report.findings.slice(0, 100)) {
      lines.push(`- ${item.severity} / ${item.source}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
  }

  lines.push('', '## GitHub Actions Workflow', '', '```yaml', report.githubActionsWorkflow.trimEnd(), '```')
  return `${lines.join('\n')}\n`
}

function renderGithubActionsWorkflow(pack: PolicyAsCodePack): string {
  const lines = [
    'name: Dependency Policy Check',
    '',
    'on:',
    '  pull_request:',
    '  push:',
    '    branches: [main]',
    '',
    'jobs:',
    '  policy-as-code:',
    '    runs-on: ubuntu-latest',
    '    permissions:',
    '      contents: read',
    '      security-events: write',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version-file: .nvmrc',
    '          cache: npm',
    '      - name: Install dependencies',
    '        run: npm ci --ignore-scripts',
    '      - name: Type check',
    '        run: npx tsc --noEmit',
      '      - name: Framework policy verification',
      '        run: npm run verify:framework --if-present',
      '      - name: Policy source inventory',
    '        shell: bash',
    '        run: |',
      '          test -f .npmDesktopManager/dependency-policy.json && echo "dependency policy present" || echo "dependency policy missing"',
      '          test -f .npmDesktopManager/readiness-policy.json && echo "readiness policy present" || echo "readiness policy missing"',
      '          test -f .github/CODEOWNERS || test -f CODEOWNERS || test -f docs/CODEOWNERS',
      '      - name: Deployment evidence gate',
      '        shell: bash',
      '        run: |',
      ...yamlRunLines(deploymentEvidenceGateCommand(pack.enforcement.deploymentPolicyGates.length), 10),
      '      - name: Release evidence completeness gate',
      '        shell: bash',
      '        run: |',
      ...yamlRunLines(releaseEvidenceCompletenessGateCommand(), 10),
      '      - name: Release integrity verification gate',
      '        run: npm run verify:release-integrity --if-present -- optional json silent',
      '      - name: Release signature verification gate',
      '        run: npm run verify:release-signature --if-present -- optional json silent',
      '      - name: Release trust policy gate',
      '        run: npm run verify:release-trust --if-present -- optional json silent',
      '      - name: Upload policy pack',
      '        uses: actions/upload-artifact@v4',
    '        with:',
    '          name: dependency-policy-as-code',
    '          path: |',
      '            .npmDesktopManager/dependency-policy.json',
      '            .npmDesktopManager/readiness-policy.json',
      '            .npmDesktopManager/reports/readiness-report.json',
      '            .npmDesktopManager/reports/release-risk-profile.json',
      '            .npmDesktopManager/reports/workspace-remediation-plan.json',
      '            .npmDesktopManager/reports/ci-integration-plan.json',
      '            .npmDesktopManager/reports/release-evidence-completeness.json',
      '            .npmDesktopManager/reports/release-bundle/release-bundle-manifest.json',
      '            .npmDesktopManager/reports/audit-evidence-report.json',
      '            .npmDesktopManager/reports/vulnerability-remediation-plan.json',
      '            .npmDesktopManager/reports/release-provenance-attestation.json',
      '            .npmDesktopManager/reports/release-integrity-verification.json',
      '            .npmDesktopManager/reports/release-signature.json',
      '            .npmDesktopManager/reports/release-trust-policy.json',
      '            .npmDesktopManager/reports/dependency-upgrade-playbook.json',
      '            .npmDesktopManager/reports/dependency-rollback-plan.json',
      '            .npmDesktopManager/reports/dependency-impact-analysis.json',
      '            .npmDesktopManager/reports/dependency-change-approval-packet.json',
      '            .npmDesktopManager/reports/dependency-change-calendar.json',
      '            .npmDesktopManager/reports/dependency-change-calendar.ics',
      '            .npmDesktopManager/reports/dependency-change-ticket-template.md',
      '            .npmDesktopManager/reports/ci/dependency-change-freeze-gate.yml',
      '            .npmDesktopManager/reports/dependency-change-execution-record.json',
      '            .npmDesktopManager/reports/THIRD-PARTY-NOTICES.txt',
      '            .npmDesktopManager/reports/third-party-notices.json',
    '            .npmDesktopManager/reports/policy-as-code-pack.json',
    '            .npmDesktopManager/reports/policy-as-code/dependency-governance.policy.json'
  ]

  if (pack.ci.requiredSecrets.length > 0) {
    lines.push(
      '',
      '# Configure these repository or organization secrets before enabling private registry automation:',
      ...pack.ci.requiredSecrets.map((secret) => `# - ${secret}`)
    )
  }

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

function deploymentEvidenceGateCommand(gateCount: number): string {
  return [
    `echo "deployment policy gates: ${gateCount}"`,
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
    '  console.error("Deployment evidence gate failed.")',
    '  for (const item of blockedChecks) console.error("- " + item.title + ": " + item.summary)',
    '  for (const item of blockedFindings) console.error("- " + item.title + ": " + item.summary)',
    '  process.exit(1)',
    '}',
    'console.log("Deployment evidence gate passed.")',
    'NODE'
  ].join('\n')
}

function yamlRunLines(command: string, indent: number): string[] {
  const prefix = ' '.repeat(indent)
  return command.split(/\r?\n/).map((line) => `${prefix}${line}`)
}

function exportResult(path: string, format: PolicyAsCodeExportFormat, report: PolicyAsCodeReport): PolicyAsCodeExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    findingCount: report.summary.findingCount,
    count: report.summary.findingCount,
    summary: report.summary
  }
}

function sourceErrors(input: {
  discoveryResult: CaptureResult<WorkspaceDiscoveryReport>
  dependencyPolicyResult: CaptureResult<{ path: string; policy: DependencyPolicy }>
  readinessPolicyResult: CaptureResult<{ path: string; policy: ReadinessPolicy }>
  automationResult: CaptureResult<DependencyAutomationPlanReport>
  safetyResult: CaptureResult<AutomationSafetyPlanReport>
  ownershipResult: CaptureResult<DependencyOwnershipPlanReport>
}): Partial<Record<PolicyAsCodeFindingSource, string>> {
  return {
    ...(input.discoveryResult.error ? { 'workspace-discovery': input.discoveryResult.error } : {}),
    ...(input.dependencyPolicyResult.error ? { 'dependency-policy': input.dependencyPolicyResult.error } : {}),
    ...(input.readinessPolicyResult.error ? { 'readiness-policy': input.readinessPolicyResult.error } : {}),
    ...(input.automationResult.error ? { 'dependency-automation': input.automationResult.error } : {}),
    ...(input.safetyResult.error ? { 'automation-safety': input.safetyResult.error } : {}),
    ...(input.ownershipResult.error ? { 'dependency-ownership': input.ownershipResult.error } : {})
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function finding(input: PolicyAsCodeFinding): PolicyAsCodeFinding {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function sortManagers(ids: DependencyManagerId[]): DependencyManagerId[] {
  return [...new Set(ids)].sort()
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
