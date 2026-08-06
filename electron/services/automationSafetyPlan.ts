import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  DependencyAutomationPlanService,
  type DependencyAutomationPlanReport,
  type DependencyAutomationProvider,
  type DependencyAutomationTarget
} from './dependencyAutomationPlan'
import {
  CredentialRotationPlanService,
  type CredentialRotationPlanReport
} from './credentialRotationPlan'
import {
  ReadinessGateService,
  type ReadinessGateReport,
  type ReadinessGateStatus
} from './readinessGate'
import {
  ReleaseRiskProfileService,
  type ReleaseRiskProfileReport,
  type ReleaseRiskProfileStatus
} from './releaseRiskProfile'

export type AutomationSafetyPlanExportFormat = 'markdown' | 'json'
export type AutomationSafetyStatus = 'ready' | 'warning' | 'blocked'
export type AutomationUpdateType = 'security' | 'patch' | 'minor' | 'major'
export type AutomationSafetyDecision = 'auto-merge' | 'review' | 'blocked'
export type AutomationSafetyFindingSeverity = 'info' | 'warning' | 'blocked'
export type AutomationSafetyFindingSource =
  | 'dependency-automation'
  | 'credential-rotation'
  | 'readiness-gate'
  | 'release-risk-profile'
  | 'automation-safety'

export interface AutomationSafetyRule {
  id: string
  provider: DependencyAutomationProvider
  managerId: DependencyManagerId
  workspaceId: string
  workspaceName: string
  workspaceRelativePath: string
  directory: string
  updateType: AutomationUpdateType
  decision: AutomationSafetyDecision
  requiredEvidence: string[]
  requiredApprovals: number
  rationale: string
  blockers: string[]
  warnings: string[]
}

export interface AutomationSafetyFinding {
  id: string
  severity: AutomationSafetyFindingSeverity
  source: AutomationSafetyFindingSource
  title: string
  summary: string
  recommendation: string
  evidence: string[]
  managerId?: DependencyManagerId
  workspaceId?: string
  workspaceName?: string
  workspaceRelativePath?: string
}

export interface AutomationSafetyPlanSummary {
  status: AutomationSafetyStatus
  targetCount: number
  supportedTargetCount: number
  ruleCount: number
  autoMergeRuleCount: number
  reviewRuleCount: number
  blockedRuleCount: number
  securityRuleCount: number
  patchRuleCount: number
  minorRuleCount: number
  majorRuleCount: number
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
  managerCount: number
  managers: DependencyManagerId[]
  workspaceCount: number
  readinessStatus?: ReadinessGateStatus
  releaseRiskStatus?: ReleaseRiskProfileStatus
  credentialRotationStatus?: AutomationSafetyStatus
  dependencyAutomationStatus?: AutomationSafetyStatus
}

export interface AutomationSafetyPlanReport {
  generatedAt: string
  projectPath: string
  status: AutomationSafetyStatus
  summary: AutomationSafetyPlanSummary
  rules: AutomationSafetyRule[]
  findings: AutomationSafetyFinding[]
  renovateSafetyPreset: string
  sources: {
    dependencyAutomation?: Pick<DependencyAutomationPlanReport, 'generatedAt' | 'status' | 'summary'>
    credentialRotation?: Pick<CredentialRotationPlanReport, 'generatedAt' | 'status' | 'summary'>
    readiness?: Pick<ReadinessGateReport, 'generatedAt' | 'status' | 'score' | 'summary'>
    releaseRisk?: Pick<ReleaseRiskProfileReport, 'generatedAt' | 'status' | 'score' | 'summary'>
    errors: Partial<Record<AutomationSafetyFindingSource, string>>
  }
}

export interface AutomationSafetyPlanExportResult {
  path: string
  format: AutomationSafetyPlanExportFormat
  generatedAt: string
  status: AutomationSafetyStatus
  ruleCount: number
  findingCount: number
  count: number
  summary: AutomationSafetyPlanSummary
}

export interface AutomationSafetyPlanDependencies {
  dependencyAutomationPlanService?: DependencyAutomationPlanService
  credentialRotationPlanService?: CredentialRotationPlanService
  readinessGateService?: ReadinessGateService
  releaseRiskProfileService?: ReleaseRiskProfileService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const UPDATE_TYPES: AutomationUpdateType[] = ['security', 'patch', 'minor', 'major']

export class AutomationSafetyPlanService {
  private readonly dependencyAutomationPlanService: DependencyAutomationPlanService
  private readonly credentialRotationPlanService: CredentialRotationPlanService
  private readonly readinessGateService: ReadinessGateService
  private readonly releaseRiskProfileService: ReleaseRiskProfileService

  constructor(dependencies: AutomationSafetyPlanDependencies = {}) {
    this.dependencyAutomationPlanService = dependencies.dependencyAutomationPlanService || new DependencyAutomationPlanService()
    this.credentialRotationPlanService = dependencies.credentialRotationPlanService || new CredentialRotationPlanService({
      dependencyAutomationPlanService: this.dependencyAutomationPlanService
    })
    this.readinessGateService = dependencies.readinessGateService || new ReadinessGateService()
    this.releaseRiskProfileService = dependencies.releaseRiskProfileService || new ReleaseRiskProfileService({
      readinessGateService: this.readinessGateService
    })
  }

  async plan(projectPath: string): Promise<AutomationSafetyPlanReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [automationResult, rotationResult, readinessResult, riskResult] = await Promise.all([
      capture(() => this.dependencyAutomationPlanService.plan(root)),
      capture(() => this.credentialRotationPlanService.plan(root)),
      capture(() => this.readinessGateService.report(root)),
      capture(() => this.releaseRiskProfileService.report(root))
    ])
    const findings = normalizeFindings(automationResult, rotationResult, readinessResult, riskResult)
    const rules = buildRules({
      automation: automationResult.value,
      rotation: rotationResult.value,
      readiness: readinessResult.value,
      releaseRisk: riskResult.value
    })
    const summary = summarize(rules, findings, automationResult.value, rotationResult.value, readinessResult.value, riskResult.value)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      rules,
      findings,
      renovateSafetyPreset: renderRenovateSafetyPreset(rules),
      sources: {
        dependencyAutomation: automationResult.value
          ? {
              generatedAt: automationResult.value.generatedAt,
              status: automationResult.value.status,
              summary: automationResult.value.summary
            }
          : undefined,
        credentialRotation: rotationResult.value
          ? {
              generatedAt: rotationResult.value.generatedAt,
              status: rotationResult.value.status,
              summary: rotationResult.value.summary
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
        releaseRisk: riskResult.value
          ? {
              generatedAt: riskResult.value.generatedAt,
              status: riskResult.value.status,
              score: riskResult.value.score,
              summary: riskResult.value.summary
            }
          : undefined,
        errors: sourceErrors(automationResult, rotationResult, readinessResult, riskResult)
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<AutomationSafetyPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'automation-safety-plan.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderAutomationSafetyMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<AutomationSafetyPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'automation-safety-plan.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function buildRules(input: {
  automation?: DependencyAutomationPlanReport
  rotation?: CredentialRotationPlanReport
  readiness?: ReadinessGateReport
  releaseRisk?: ReleaseRiskProfileReport
}): AutomationSafetyRule[] {
  const targets = input.automation?.targets.filter((target) => target.supported) || []
  return targets.flatMap((target) => UPDATE_TYPES.map((updateType) => ruleFor(target, updateType, input)))
}

function ruleFor(
  target: DependencyAutomationTarget,
  updateType: AutomationUpdateType,
  input: {
    automation?: DependencyAutomationPlanReport
    rotation?: CredentialRotationPlanReport
    readiness?: ReadinessGateReport
    releaseRisk?: ReleaseRiskProfileReport
  }
): AutomationSafetyRule {
  const blockers = ruleBlockers(target, input)
  const warnings = ruleWarnings(target, input)
  const decision = decisionFor(updateType, blockers, warnings, input.readiness)
  return {
    id: `${target.provider}:${target.workspaceId}:${target.managerId}:${updateType}`,
    provider: target.provider,
    managerId: target.managerId,
    workspaceId: target.workspaceId,
    workspaceName: target.workspaceName,
    workspaceRelativePath: target.workspaceRelativePath,
    directory: target.directory,
    updateType,
    decision,
    requiredEvidence: requiredEvidence(updateType, decision),
    requiredApprovals: updateType === 'major' || decision === 'blocked' ? 1 : updateType === 'security' || updateType === 'minor' ? 1 : 0,
    rationale: rationaleFor(updateType, decision, blockers, warnings),
    blockers,
    warnings
  }
}

function ruleBlockers(
  target: DependencyAutomationTarget,
  input: {
    automation?: DependencyAutomationPlanReport
    rotation?: CredentialRotationPlanReport
    readiness?: ReadinessGateReport
    releaseRisk?: ReleaseRiskProfileReport
  }
): string[] {
  const blockers: string[] = []
  if (input.automation?.status === 'blocked') blockers.push('Dependency automation plan has blocking findings.')
  if (input.rotation?.status === 'blocked') blockers.push('Credential rotation plan has blocking actions.')
  if (input.readiness?.status === 'blocked') blockers.push('Production readiness gate is blocked.')
  if (input.releaseRisk?.status === 'blocked') blockers.push('Release risk profile is blocked.')
  if (target.requiredSecrets.length > 0 && input.rotation?.summary.blockedActionCount) {
    blockers.push(`Automation secrets need credential review: ${target.requiredSecrets.join(', ')}.`)
  }
  return unique(blockers)
}

function ruleWarnings(
  target: DependencyAutomationTarget,
  input: {
    automation?: DependencyAutomationPlanReport
    rotation?: CredentialRotationPlanReport
    readiness?: ReadinessGateReport
    releaseRisk?: ReleaseRiskProfileReport
  }
): string[] {
  const warnings: string[] = []
  if (input.automation?.status === 'warning') warnings.push('Dependency automation plan has warnings.')
  if (input.rotation?.status === 'warning') warnings.push('Credential rotation plan has warnings.')
  if (input.readiness?.status === 'warning') warnings.push('Production readiness gate is warning.')
  if (input.releaseRisk?.status === 'warning') warnings.push('Release risk profile is warning.')
  if (target.requiredSecrets.length > 0) warnings.push(`Provider secrets required: ${target.requiredSecrets.join(', ')}.`)
  return unique(warnings)
}

function decisionFor(
  updateType: AutomationUpdateType,
  blockers: string[],
  warnings: string[],
  readiness?: ReadinessGateReport
): AutomationSafetyDecision {
  if (blockers.length > 0) return 'blocked'
  if (updateType === 'patch' && warnings.length === 0 && readiness?.status === 'ready') return 'auto-merge'
  return 'review'
}

function requiredEvidence(updateType: AutomationUpdateType, decision: AutomationSafetyDecision): string[] {
  const evidence = [
    'current release bundle',
    'dependency automation plan',
    'credential rotation plan',
    'readiness gate'
  ]
  if (updateType === 'security') evidence.push('security advisory or vulnerability reference')
  if (updateType === 'major') evidence.push('breaking-change review and owner approval')
  if (decision === 'auto-merge') evidence.push('green CI evidence after update')
  if (decision === 'blocked') evidence.push('resolved blocker evidence or release exception')
  return evidence
}

function rationaleFor(
  updateType: AutomationUpdateType,
  decision: AutomationSafetyDecision,
  blockers: string[],
  warnings: string[]
): string {
  if (decision === 'blocked') return `Blocked ${updateType} automation because ${blockers.join(' ')}`
  if (decision === 'auto-merge') return 'Patch updates can be auto-merged only when all production evidence is ready and CI remains green.'
  if (warnings.length > 0) return `Manual review required because ${warnings.join(' ')}`
  if (updateType === 'major') return 'Major updates require owner approval and release evidence even when baseline checks are healthy.'
  if (updateType === 'minor') return 'Minor updates require review because behavior changes can be larger than patch updates.'
  if (updateType === 'security') return 'Security updates require review to confirm advisory scope, exploitability, and release urgency.'
  return 'Manual review required by default.'
}

function normalizeFindings(
  automationResult: CaptureResult<DependencyAutomationPlanReport>,
  rotationResult: CaptureResult<CredentialRotationPlanReport>,
  readinessResult: CaptureResult<ReadinessGateReport>,
  riskResult: CaptureResult<ReleaseRiskProfileReport>
): AutomationSafetyFinding[] {
  const findings: AutomationSafetyFinding[] = []
  for (const [source, error] of Object.entries(sourceErrors(automationResult, rotationResult, readinessResult, riskResult))) {
    if (!error) continue
    findings.push(finding({
      id: `${source}:source-error`,
      severity: 'warning',
      source: source as AutomationSafetyFindingSource,
      title: `${source} unavailable`,
      summary: error,
      recommendation: 'Regenerate automation safety after this evidence source is available.',
      evidence: [error]
    }))
  }

  for (const item of automationResult.value?.warnings || []) {
    findings.push(finding({
      id: `automation:${item.id}`,
      severity: item.severity === 'blocked' ? 'blocked' : item.severity === 'warning' ? 'warning' : 'info',
      source: 'dependency-automation',
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

  for (const item of rotationResult.value?.actions || []) {
    if (item.severity === 'info') continue
    findings.push(finding({
      id: `rotation:${item.id}`,
      severity: item.severity,
      source: 'credential-rotation',
      title: item.title,
      summary: item.summary,
      recommendation: item.recommendation,
      evidence: item.evidence,
      managerId: item.managerId
    }))
  }

  for (const item of readinessResult.value?.checks || []) {
    if (item.status !== 'blocked' && item.status !== 'warning') continue
    findings.push(finding({
      id: `readiness:${item.id}`,
      severity: item.status === 'blocked' ? 'blocked' : 'warning',
      source: 'readiness-gate',
      title: item.title,
      summary: item.summary,
      recommendation: item.recommendation,
      evidence: item.evidence
    }))
  }

  for (const item of riskResult.value?.topRisks || []) {
    findings.push(finding({
      id: `risk:${item.id}`,
      severity: item.severity === 'critical' || item.severity === 'high' ? 'blocked' : item.severity === 'info' ? 'info' : 'warning',
      source: 'release-risk-profile',
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

  return uniqueBy(findings, (item) => item.id).slice(0, 250)
}

function summarize(
  rules: AutomationSafetyRule[],
  findings: AutomationSafetyFinding[],
  automation?: DependencyAutomationPlanReport,
  rotation?: CredentialRotationPlanReport,
  readiness?: ReadinessGateReport,
  releaseRisk?: ReleaseRiskProfileReport
): AutomationSafetyPlanSummary {
  const managers = unique(rules.map((rule) => rule.managerId)).sort() as DependencyManagerId[]
  const workspaceCount = new Set(rules.map((rule) => rule.workspaceId)).size
  const blockedFindingCount = findings.filter((item) => item.severity === 'blocked').length
  const warningFindingCount = findings.filter((item) => item.severity === 'warning').length
  const status: AutomationSafetyStatus = rules.some((rule) => rule.decision === 'blocked') || blockedFindingCount > 0
    ? 'blocked'
    : warningFindingCount > 0 || rules.some((rule) => rule.decision === 'review')
      ? 'warning'
      : 'ready'

  return {
    status,
    targetCount: automation?.summary.targetCount || 0,
    supportedTargetCount: automation?.targets.filter((target) => target.supported).length || 0,
    ruleCount: rules.length,
    autoMergeRuleCount: rules.filter((rule) => rule.decision === 'auto-merge').length,
    reviewRuleCount: rules.filter((rule) => rule.decision === 'review').length,
    blockedRuleCount: rules.filter((rule) => rule.decision === 'blocked').length,
    securityRuleCount: rules.filter((rule) => rule.updateType === 'security').length,
    patchRuleCount: rules.filter((rule) => rule.updateType === 'patch').length,
    minorRuleCount: rules.filter((rule) => rule.updateType === 'minor').length,
    majorRuleCount: rules.filter((rule) => rule.updateType === 'major').length,
    findingCount: findings.length,
    blockedFindingCount,
    warningFindingCount,
    managerCount: managers.length,
    managers,
    workspaceCount,
    readinessStatus: readiness?.status,
    releaseRiskStatus: releaseRisk?.status,
    credentialRotationStatus: rotation?.status,
    dependencyAutomationStatus: automation?.status
  }
}

function renderAutomationSafetyMarkdown(report: AutomationSafetyPlanReport): string {
  const lines = [
    '# Automation Safety Plan',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Targets: ${report.summary.supportedTargetCount}/${report.summary.targetCount}`,
    `- Rules: ${report.summary.ruleCount}`,
    `- Auto-merge rules: ${report.summary.autoMergeRuleCount}`,
    `- Review rules: ${report.summary.reviewRuleCount}`,
    `- Blocked rules: ${report.summary.blockedRuleCount}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Blocked/warning findings: ${report.summary.blockedFindingCount}/${report.summary.warningFindingCount}`,
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    `- Readiness: ${report.summary.readinessStatus || '-'}`,
    `- Release risk: ${report.summary.releaseRiskStatus || '-'}`,
    `- Credential rotation: ${report.summary.credentialRotationStatus || '-'}`,
    `- Dependency automation: ${report.summary.dependencyAutomationStatus || '-'}`,
    '',
    '## Safety Rules',
    '',
    '| Decision | Provider | Workspace | Manager | Update | Approvals | Rationale |',
    '| --- | --- | --- | --- | --- | ---: | --- |'
  ]

  for (const rule of report.rules.slice(0, 120)) {
    lines.push([
      rule.decision,
      rule.provider,
      markdownCell(`${rule.workspaceName} (${rule.workspaceRelativePath})`),
      rule.managerId,
      rule.updateType,
      String(rule.requiredApprovals),
      markdownCell(rule.rationale)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.findings.length === 0) {
    lines.push('- No automation safety findings.')
  } else {
    for (const item of report.findings.slice(0, 80)) {
      lines.push(`- ${item.severity} / ${item.source}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
  }

  lines.push('', '## Renovate Safety Preset', '', '```json', report.renovateSafetyPreset.trimEnd(), '```')
  return `${lines.join('\n')}\n`
}

function renderRenovateSafetyPreset(rules: AutomationSafetyRule[]): string {
  const blockedManagers = unique(rules
    .filter((rule) => rule.decision === 'blocked')
    .map((rule) => rule.managerId))
    .sort()
  const automergeManagers = unique(rules
    .filter((rule) => rule.decision === 'auto-merge' && rule.updateType === 'patch')
    .map((rule) => rule.managerId))
    .sort()

  return `${JSON.stringify({
    description: 'Generated by npmDesktopManager automation safety plan.',
    dependencyDashboard: true,
    packageRules: [
      ...(automergeManagers.length > 0 ? [{
        matchManagers: automergeManagers,
        matchUpdateTypes: ['patch'],
        automerge: true,
        platformAutomerge: true,
        addLabels: ['automation-safe', 'patch']
      }] : []),
      {
        matchUpdateTypes: ['minor', 'major'],
        dependencyDashboardApproval: true,
        automerge: false,
        addLabels: ['needs-review']
      },
      {
        matchUpdateTypes: ['digest', 'pin', 'rollback'],
        dependencyDashboardApproval: true,
        automerge: false,
        addLabels: ['needs-review']
      },
      ...(blockedManagers.length > 0 ? [{
        matchManagers: blockedManagers,
        enabled: false,
        addLabels: ['automation-blocked']
      }] : [])
    ]
  }, null, 2)}\n`
}

function sourceErrors(
  automationResult: CaptureResult<DependencyAutomationPlanReport>,
  rotationResult: CaptureResult<CredentialRotationPlanReport>,
  readinessResult: CaptureResult<ReadinessGateReport>,
  riskResult: CaptureResult<ReleaseRiskProfileReport>
): Partial<Record<AutomationSafetyFindingSource, string>> {
  return {
    ...(automationResult.error ? { 'dependency-automation': automationResult.error } : {}),
    ...(rotationResult.error ? { 'credential-rotation': rotationResult.error } : {}),
    ...(readinessResult.error ? { 'readiness-gate': readinessResult.error } : {}),
    ...(riskResult.error ? { 'release-risk-profile': riskResult.error } : {})
  }
}

function finding(input: AutomationSafetyFinding): AutomationSafetyFinding {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function exportResult(
  path: string,
  format: AutomationSafetyPlanExportFormat,
  report: AutomationSafetyPlanReport
): AutomationSafetyPlanExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    ruleCount: report.summary.ruleCount,
    findingCount: report.summary.findingCount,
    count: report.summary.findingCount,
    summary: report.summary
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
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
