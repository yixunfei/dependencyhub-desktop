import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  DependencyImpactAnalysisService,
  type DependencyImpactAnalysisItem,
  type DependencyImpactAnalysisReport,
  type DependencyImpactSeverity
} from './dependencyImpactAnalysis'
import {
  DependencyRollbackPlanService,
  type DependencyRollbackPlanReport
} from './dependencyRollbackPlan'
import {
  DependencyUpgradePlaybookService,
  type DependencyUpgradePlaybookReport
} from './dependencyUpgradePlaybook'
import {
  ReleaseApprovalService,
  type ReleaseApprovalReport
} from './releaseApproval'
import {
  ReleaseExceptionService,
  type ReleaseExceptionReport
} from './releaseException'
import {
  ReleaseTrustPolicyService,
  type ReleaseTrustPolicyReport
} from './releaseTrustPolicy'

export type DependencyChangeApprovalPacketStatus = 'ready' | 'warning' | 'blocked'
export type DependencyChangeApprovalDecision = 'approved' | 'needs-review' | 'blocked'
export type DependencyChangeApprovalCheckStatus = 'passed' | 'warning' | 'blocked' | 'info'
export type DependencyChangeApprovalCheckSource =
  | 'dependency-impact-analysis'
  | 'dependency-upgrade-playbook'
  | 'dependency-rollback-plan'
  | 'release-trust-policy'
  | 'release-approval'
  | 'release-exception'
  | 'approval-packet'

export interface DependencyChangeApprovalChecklistItem {
  id: string
  source: DependencyChangeApprovalCheckSource
  status: DependencyChangeApprovalCheckStatus
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface DependencyChangeApprovalParticipant {
  owner: string
  role: 'owner' | 'reviewer' | 'exception-reviewer'
  workspaceCount: number
  managerIds: DependencyManagerId[]
  approvalCount: number
}

export interface DependencyChangeApprovalScopeItem {
  id: string
  severity: DependencyImpactSeverity
  status: DependencyChangeApprovalPacketStatus
  workspaceName: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  managerName: string
  owners: string[]
  ciJobCount: number
  riskFindingCount: number
  rollbackStatus?: DependencyChangeApprovalPacketStatus
  verificationCommandCount: number
  releaseGateCount: number
  recommendation: string
}

export interface DependencyChangeApprovalPacketSummary {
  status: DependencyChangeApprovalPacketStatus
  decision: DependencyChangeApprovalDecision
  scopeItemCount: number
  blockedScopeItemCount: number
  warningScopeItemCount: number
  criticalImpactCount: number
  highImpactCount: number
  workspaceCount: number
  managerCount: number
  ownerCount: number
  missingOwnerItemCount: number
  participantCount: number
  approvalRecordCount: number
  approvedRecordCount: number
  rejectedRecordCount: number
  activeExceptionCount: number
  trustBlockedCheckCount: number
  trustWarningCheckCount: number
  rollbackBlockedItemCount: number
  rollbackWarningItemCount: number
  ciJobCount: number
  verificationCommandCount: number
  checklistCount: number
  blockedChecklistCount: number
  warningChecklistCount: number
  passedChecklistCount: number
  sourceErrorCount: number
}

export interface DependencyChangeApprovalPacketReport {
  generatedAt: string
  projectPath: string
  status: DependencyChangeApprovalPacketStatus
  decision: DependencyChangeApprovalDecision
  summary: DependencyChangeApprovalPacketSummary
  checklist: DependencyChangeApprovalChecklistItem[]
  participants: DependencyChangeApprovalParticipant[]
  scope: DependencyChangeApprovalScopeItem[]
  sources: {
    impactAnalysis?: Pick<DependencyImpactAnalysisReport, 'generatedAt' | 'status' | 'summary'>
    upgradePlaybook?: Pick<DependencyUpgradePlaybookReport, 'generatedAt' | 'status' | 'summary'>
    rollbackPlan?: Pick<DependencyRollbackPlanReport, 'generatedAt' | 'status' | 'summary'>
    trustPolicy?: Pick<ReleaseTrustPolicyReport, 'generatedAt' | 'status' | 'summary'>
    approvals?: Pick<ReleaseApprovalReport, 'generatedAt' | 'summary'>
    exceptions?: Pick<ReleaseExceptionReport, 'generatedAt' | 'summary'>
    errors: Partial<Record<DependencyChangeApprovalCheckSource, string>>
  }
}

export interface DependencyChangeApprovalPacketExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: DependencyChangeApprovalPacketStatus
  decision: DependencyChangeApprovalDecision
  checklistCount: number
  scopeItemCount: number
  summary: DependencyChangeApprovalPacketSummary
}

export interface DependencyChangeApprovalPacketDependencies {
  dependencyImpactAnalysisService?: DependencyImpactAnalysisService
  dependencyUpgradePlaybookService?: DependencyUpgradePlaybookService
  dependencyRollbackPlanService?: DependencyRollbackPlanService
  releaseTrustPolicyService?: ReleaseTrustPolicyService
  releaseApprovalService?: ReleaseApprovalService
  releaseExceptionService?: ReleaseExceptionService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'dependency-change-approval-packet'

export class DependencyChangeApprovalPacketService {
  private readonly dependencyImpactAnalysisService: DependencyImpactAnalysisService
  private readonly dependencyUpgradePlaybookService: DependencyUpgradePlaybookService
  private readonly dependencyRollbackPlanService: DependencyRollbackPlanService
  private readonly releaseTrustPolicyService: ReleaseTrustPolicyService
  private readonly releaseApprovalService: ReleaseApprovalService
  private readonly releaseExceptionService: ReleaseExceptionService

  constructor(dependencies: DependencyChangeApprovalPacketDependencies = {}) {
    this.dependencyImpactAnalysisService = dependencies.dependencyImpactAnalysisService || new DependencyImpactAnalysisService()
    this.dependencyUpgradePlaybookService = dependencies.dependencyUpgradePlaybookService || new DependencyUpgradePlaybookService()
    this.dependencyRollbackPlanService = dependencies.dependencyRollbackPlanService || new DependencyRollbackPlanService()
    this.releaseTrustPolicyService = dependencies.releaseTrustPolicyService || new ReleaseTrustPolicyService()
    this.releaseApprovalService = dependencies.releaseApprovalService || new ReleaseApprovalService()
    this.releaseExceptionService = dependencies.releaseExceptionService || new ReleaseExceptionService()
  }

  async report(projectPath: string): Promise<DependencyChangeApprovalPacketReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)

    const [impactResult, upgradeResult, rollbackResult, trustResult, approvalResult, exceptionResult] = await Promise.all([
      capture(() => this.dependencyImpactAnalysisService.report(root)),
      capture(() => this.dependencyUpgradePlaybookService.report(root)),
      capture(() => this.dependencyRollbackPlanService.report(root)),
      capture(() => this.releaseTrustPolicyService.report(root)),
      capture(() => this.releaseApprovalService.report(root)),
      capture(() => this.releaseExceptionService.report(root))
    ])
    const errors = sourceErrors(impactResult, upgradeResult, rollbackResult, trustResult, approvalResult, exceptionResult)
    const scope = scopeItems(impactResult.value)
    const participants = participantList(impactResult.value, approvalResult.value, exceptionResult.value)
    const checklist = buildChecklist({
      impact: impactResult.value,
      upgrade: upgradeResult.value,
      rollback: rollbackResult.value,
      trust: trustResult.value,
      approvals: approvalResult.value,
      exceptions: exceptionResult.value,
      errors
    })
    const summary = summarize(scope, participants, checklist, {
      impact: impactResult.value,
      rollback: rollbackResult.value,
      trust: trustResult.value,
      approvals: approvalResult.value,
      exceptions: exceptionResult.value,
      errors
    })

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      decision: summary.decision,
      summary,
      checklist,
      participants,
      scope,
      sources: {
        impactAnalysis: impactResult.value
          ? {
              generatedAt: impactResult.value.generatedAt,
              status: impactResult.value.status,
              summary: impactResult.value.summary
            }
          : undefined,
        upgradePlaybook: upgradeResult.value
          ? {
              generatedAt: upgradeResult.value.generatedAt,
              status: upgradeResult.value.status,
              summary: upgradeResult.value.summary
            }
          : undefined,
        rollbackPlan: rollbackResult.value
          ? {
              generatedAt: rollbackResult.value.generatedAt,
              status: rollbackResult.value.status,
              summary: rollbackResult.value.summary
            }
          : undefined,
        trustPolicy: trustResult.value
          ? {
              generatedAt: trustResult.value.generatedAt,
              status: trustResult.value.status,
              summary: trustResult.value.summary
            }
          : undefined,
        approvals: approvalResult.value
          ? {
              generatedAt: approvalResult.value.generatedAt,
              summary: approvalResult.value.summary
            }
          : undefined,
        exceptions: exceptionResult.value
          ? {
              generatedAt: exceptionResult.value.generatedAt,
              summary: exceptionResult.value.summary
            }
          : undefined,
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<DependencyChangeApprovalPacketExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyChangeApprovalPacketExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function scopeItems(impact: DependencyImpactAnalysisReport | undefined): DependencyChangeApprovalScopeItem[] {
  return (impact?.items || [])
    .map((item) => ({
      id: `approval-scope:${item.id}`,
      severity: item.severity,
      status: scopeStatus(item),
      workspaceName: item.workspaceName,
      workspaceRelativePath: item.workspaceRelativePath,
      managerId: item.managerId,
      managerName: item.managerName,
      owners: item.owners,
      ciJobCount: item.ciJobs.length,
      riskFindingCount: item.riskFindings.length,
      rollbackStatus: item.rollbackStatus,
      verificationCommandCount: item.verificationCommands.length,
      releaseGateCount: item.releaseGateCount,
      recommendation: item.recommendation
    }))
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) ||
      severityRank(a.severity) - severityRank(b.severity) ||
      a.workspaceRelativePath.localeCompare(b.workspaceRelativePath) ||
      a.managerId.localeCompare(b.managerId))
}

function scopeStatus(item: DependencyImpactAnalysisItem): DependencyChangeApprovalPacketStatus {
  if (item.status === 'blocked' || item.severity === 'critical' || item.rollbackStatus === 'blocked') return 'blocked'
  if (item.status === 'warning' || item.severity === 'high' || item.ownerStatus === 'missing' || item.rollbackStatus === 'warning') return 'warning'
  return 'ready'
}

function participantList(
  impact: DependencyImpactAnalysisReport | undefined,
  approvals: ReleaseApprovalReport | undefined,
  exceptions: ReleaseExceptionReport | undefined
): DependencyChangeApprovalParticipant[] {
  const byOwner = new Map<string, DependencyChangeApprovalParticipant>()
  const approvalCounts = new Map<string, number>()
  for (const record of approvals?.records || []) {
    if (record.decision === 'approved') {
      approvalCounts.set(record.reviewer, (approvalCounts.get(record.reviewer) || 0) + 1)
    }
  }

  for (const item of impact?.items || []) {
    for (const owner of item.owners) {
      const existing = byOwner.get(owner) || {
        owner,
        role: 'owner' as const,
        workspaceCount: 0,
        managerIds: [],
        approvalCount: approvalCounts.get(owner) || 0
      }
      existing.workspaceCount += 1
      existing.managerIds = unique([...existing.managerIds, item.managerId])
      byOwner.set(owner, existing)
    }
  }

  for (const record of approvals?.records || []) {
    const existing = byOwner.get(record.reviewer)
    if (existing) continue
    byOwner.set(record.reviewer, {
      owner: record.reviewer,
      role: 'reviewer',
      workspaceCount: 0,
      managerIds: [],
      approvalCount: record.decision === 'approved' ? 1 : 0
    })
  }

  for (const record of exceptions?.records || []) {
    const existing = byOwner.get(record.reviewer)
    if (existing) {
      if (existing.role !== 'owner') existing.role = 'exception-reviewer'
      continue
    }
    byOwner.set(record.reviewer, {
      owner: record.reviewer,
      role: 'exception-reviewer',
      workspaceCount: 0,
      managerIds: [],
      approvalCount: 0
    })
  }

  return [...byOwner.values()]
    .sort((a, b) => b.workspaceCount - a.workspaceCount || b.approvalCount - a.approvalCount || a.owner.localeCompare(b.owner))
}

function buildChecklist(input: {
  impact?: DependencyImpactAnalysisReport
  upgrade?: DependencyUpgradePlaybookReport
  rollback?: DependencyRollbackPlanReport
  trust?: ReleaseTrustPolicyReport
  approvals?: ReleaseApprovalReport
  exceptions?: ReleaseExceptionReport
  errors: Partial<Record<DependencyChangeApprovalCheckSource, string>>
}): DependencyChangeApprovalChecklistItem[] {
  const checks: DependencyChangeApprovalChecklistItem[] = [
    impactCheck(input.impact),
    upgradeCheck(input.upgrade),
    rollbackCheck(input.rollback),
    trustCheck(input.trust),
    approvalCheck(input.approvals),
    exceptionCheck(input.exceptions),
    verificationCheck(input.impact)
  ]

  for (const [source, error] of Object.entries(input.errors)) {
    checks.push({
      id: `source-error:${source}`,
      source: source as DependencyChangeApprovalCheckSource,
      status: 'blocked',
      title: `Source collection failed: ${source}`,
      summary: error,
      recommendation: 'Regenerate the source report before requesting approval.',
      evidence: [error]
    })
  }

  return checks
}

function impactCheck(report: DependencyImpactAnalysisReport | undefined): DependencyChangeApprovalChecklistItem {
  if (!report) return missingCheck('dependency-impact-analysis', 'Dependency impact analysis')
  const blocked = report.summary.blockedItemCount + report.summary.criticalItemCount
  const warning = report.summary.highItemCount + report.summary.warningItemCount
  return {
    id: 'impact:blast-radius',
    source: 'dependency-impact-analysis',
    status: blocked > 0 ? 'blocked' : warning > 0 ? 'warning' : 'passed',
    title: 'Blast-radius review',
    summary: `${report.summary.itemCount} impacted item(s), ${report.summary.criticalItemCount} critical, ${report.summary.highItemCount} high.`,
    recommendation: blocked > 0
      ? 'Resolve critical or blocked impact items before approval.'
      : warning > 0
        ? 'Route high-impact changes through named owners and CI verification.'
        : 'Attach the impact matrix to the approval record.',
    evidence: [
      `Workspaces: ${report.summary.workspaceCount}`,
      `Managers: ${report.summary.managerCount}`,
      `CI jobs: ${report.summary.ciJobCount}`,
      `Release gate impacts: ${report.summary.releaseGateImpactCount}`
    ]
  }
}

function upgradeCheck(report: DependencyUpgradePlaybookReport | undefined): DependencyChangeApprovalChecklistItem {
  if (!report) return missingCheck('dependency-upgrade-playbook', 'Dependency upgrade playbook')
  return {
    id: 'upgrade:runbook',
    source: 'dependency-upgrade-playbook',
    status: report.status === 'blocked' ? 'blocked' : report.status === 'warning' ? 'warning' : 'passed',
    title: 'Upgrade execution runbook',
    summary: `${report.summary.itemCount} item(s) across ${report.summary.laneCount} lane(s).`,
    recommendation: report.summary.blockedItemCount > 0
      ? 'Clear blocked upgrade items before requesting final approval.'
      : 'Use the lane order as the implementation sequence.',
    evidence: [
      `Security items: ${report.summary.securityItemCount}`,
      `Release blockers: ${report.summary.releaseBlockerItemCount}`,
      `Commands: ${report.summary.commandCount}`,
      `Verification commands: ${report.summary.verificationCommandCount}`
    ]
  }
}

function rollbackCheck(report: DependencyRollbackPlanReport | undefined): DependencyChangeApprovalChecklistItem {
  if (!report) return missingCheck('dependency-rollback-plan', 'Dependency rollback plan')
  return {
    id: 'rollback:coverage',
    source: 'dependency-rollback-plan',
    status: report.summary.blockedItemCount > 0 ? 'blocked' : report.summary.warningItemCount > 0 ? 'warning' : 'passed',
    title: 'Rollback coverage',
    summary: `${report.summary.snapshotCoveredItemCount}/${report.summary.itemCount} item(s) have managed snapshot coverage.`,
    recommendation: report.summary.blockedItemCount > 0
      ? 'Create rollback anchors for blocked scopes before approval.'
      : report.summary.warningItemCount > 0
        ? 'Review warning scopes and attach explicit recovery notes.'
        : 'Attach rollback commands to the change ticket.',
    evidence: [
      `Lockfile-covered items: ${report.summary.lockfileCoveredItemCount}`,
      `Rollback actions: ${report.summary.rollbackActionCount}`,
      `Verification commands: ${report.summary.verificationCommandCount}`
    ]
  }
}

function trustCheck(report: ReleaseTrustPolicyReport | undefined): DependencyChangeApprovalChecklistItem {
  if (!report) return missingCheck('release-trust-policy', 'Release trust policy')
  return {
    id: 'trust:policy',
    source: 'release-trust-policy',
    status: report.status === 'blocked' ? 'blocked' : report.status === 'warning' ? 'warning' : 'passed',
    title: 'Release trust policy',
    summary: `${report.summary.checkCount} trust check(s), ${report.summary.blockedCheckCount} blocked, ${report.summary.warningCheckCount} warning.`,
    recommendation: report.summary.blockedCheckCount > 0
      ? 'Resolve blocked trust checks or record a scoped exception before approval.'
      : 'Keep the trust policy artifact with approval evidence.',
    evidence: [
      `Signature verified: ${report.summary.signatureVerified ? 'yes' : 'no'}`,
      `Evidence missing required: ${report.summary.evidenceMissingRequiredCount}`,
      `Active exceptions: ${report.summary.activeExceptionCount}`
    ]
  }
}

function approvalCheck(report: ReleaseApprovalReport | undefined): DependencyChangeApprovalChecklistItem {
  if (!report) return missingCheck('release-approval', 'Release approvals')
  return {
    id: 'approval:evidence',
    source: 'release-approval',
    status: report.summary.rejected > 0 ? 'blocked' : report.summary.approved > 0 ? 'passed' : 'warning',
    title: 'Approval evidence',
    summary: `${report.summary.approved} approved, ${report.summary.rejected} rejected, ${report.summary.revoked} revoked.`,
    recommendation: report.summary.rejected > 0
      ? 'Resolve rejected approval evidence before merge or publish.'
      : report.summary.approved > 0
        ? 'Confirm approvals cover the impacted owners and scope.'
        : 'Record at least one dependency-change approval before merge.',
    evidence: [
      `Latest decision: ${report.summary.latest?.decision || '-'}`,
      `Latest reviewer: ${report.summary.latest?.reviewer || '-'}`
    ]
  }
}

function exceptionCheck(report: ReleaseExceptionReport | undefined): DependencyChangeApprovalChecklistItem {
  if (!report) return missingCheck('release-exception', 'Release exceptions')
  return {
    id: 'exception:evidence',
    source: 'release-exception',
    status: report.summary.active > 0 ? 'warning' : 'passed',
    title: 'Exception evidence',
    summary: `${report.summary.active} active exception(s), ${report.summary.expired} expired.`,
    recommendation: report.summary.active > 0
      ? 'Confirm every active exception is scoped, time-boxed, and referenced in the change ticket.'
      : 'No active exceptions are needed for this approval packet.',
    evidence: [
      `Approved exceptions: ${report.summary.approved}`,
      `Revoked exceptions: ${report.summary.revoked}`
    ]
  }
}

function verificationCheck(report: DependencyImpactAnalysisReport | undefined): DependencyChangeApprovalChecklistItem {
  const commandCount = report?.summary.verificationCommandCount || 0
  return {
    id: 'approval:verification',
    source: 'approval-packet',
    status: commandCount > 0 ? 'passed' : 'warning',
    title: 'Verification commands',
    summary: `${commandCount} verification command(s) are attached to impacted scopes.`,
    recommendation: commandCount > 0
      ? 'Run or schedule the listed verification commands before final sign-off.'
      : 'Add manager-specific verification commands before approval.',
    evidence: [`Verification commands: ${commandCount}`]
  }
}

function missingCheck(source: DependencyChangeApprovalCheckSource, title: string): DependencyChangeApprovalChecklistItem {
  return {
    id: `missing:${source}`,
    source,
    status: 'blocked',
    title,
    summary: `${title} is not available.`,
    recommendation: `Generate ${title} before requesting approval.`,
    evidence: [`Missing source: ${source}`]
  }
}

function summarize(
  scope: DependencyChangeApprovalScopeItem[],
  participants: DependencyChangeApprovalParticipant[],
  checklist: DependencyChangeApprovalChecklistItem[],
  input: {
    impact?: DependencyImpactAnalysisReport
    rollback?: DependencyRollbackPlanReport
    trust?: ReleaseTrustPolicyReport
    approvals?: ReleaseApprovalReport
    exceptions?: ReleaseExceptionReport
    errors: Partial<Record<DependencyChangeApprovalCheckSource, string>>
  }
): DependencyChangeApprovalPacketSummary {
  const blockedChecklistCount = checklist.filter((item) => item.status === 'blocked').length
  const warningChecklistCount = checklist.filter((item) => item.status === 'warning').length
  const status: DependencyChangeApprovalPacketStatus = blockedChecklistCount > 0 || Object.keys(input.errors).length > 0
    ? 'blocked'
    : warningChecklistCount > 0
      ? 'warning'
      : 'ready'
  const decision: DependencyChangeApprovalDecision = status === 'blocked'
    ? 'blocked'
    : status === 'warning'
      ? 'needs-review'
      : 'approved'

  return {
    status,
    decision,
    scopeItemCount: scope.length,
    blockedScopeItemCount: scope.filter((item) => item.status === 'blocked').length,
    warningScopeItemCount: scope.filter((item) => item.status === 'warning').length,
    criticalImpactCount: input.impact?.summary.criticalItemCount || 0,
    highImpactCount: input.impact?.summary.highItemCount || 0,
    workspaceCount: unique(scope.map((item) => item.workspaceRelativePath)).length,
    managerCount: unique(scope.map((item) => item.managerId)).length,
    ownerCount: unique(scope.flatMap((item) => item.owners)).length,
    missingOwnerItemCount: input.impact?.summary.missingOwnerItemCount || 0,
    participantCount: participants.length,
    approvalRecordCount: input.approvals?.summary.total || 0,
    approvedRecordCount: input.approvals?.summary.approved || 0,
    rejectedRecordCount: input.approvals?.summary.rejected || 0,
    activeExceptionCount: input.exceptions?.summary.active || 0,
    trustBlockedCheckCount: input.trust?.summary.blockedCheckCount || 0,
    trustWarningCheckCount: input.trust?.summary.warningCheckCount || 0,
    rollbackBlockedItemCount: input.rollback?.summary.blockedItemCount || 0,
    rollbackWarningItemCount: input.rollback?.summary.warningItemCount || 0,
    ciJobCount: input.impact?.summary.ciJobCount || 0,
    verificationCommandCount: input.impact?.summary.verificationCommandCount || 0,
    checklistCount: checklist.length,
    blockedChecklistCount,
    warningChecklistCount,
    passedChecklistCount: checklist.filter((item) => item.status === 'passed').length,
    sourceErrorCount: Object.keys(input.errors).length
  }
}

function renderMarkdown(report: DependencyChangeApprovalPacketReport): string {
  const lines = [
    '# Dependency Change Approval Packet',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    `Decision: ${report.decision}`,
    '',
    '## Summary',
    '',
    `- Scope items: ${report.summary.scopeItemCount}`,
    `- Blocked/warning scope items: ${report.summary.blockedScopeItemCount}/${report.summary.warningScopeItemCount}`,
    `- Critical/high impacts: ${report.summary.criticalImpactCount}/${report.summary.highImpactCount}`,
    `- Missing owner items: ${report.summary.missingOwnerItemCount}`,
    `- Participants: ${report.summary.participantCount}`,
    `- Approvals approved/rejected: ${report.summary.approvedRecordCount}/${report.summary.rejectedRecordCount}`,
    `- Active exceptions: ${report.summary.activeExceptionCount}`,
    `- Trust blocked/warning: ${report.summary.trustBlockedCheckCount}/${report.summary.trustWarningCheckCount}`,
    `- Rollback blocked/warning: ${report.summary.rollbackBlockedItemCount}/${report.summary.rollbackWarningItemCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    '',
    '## Approval Checklist',
    '',
    '| Status | Source | Check | Summary | Recommendation |',
    '| --- | --- | --- | --- | --- |'
  ]

  for (const item of report.checklist) {
    lines.push([
      item.status,
      item.source,
      markdownCell(item.title),
      markdownCell(item.summary),
      markdownCell(item.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push(
    '',
    '## Participants',
    '',
    '| Role | Owner / Reviewer | Workspaces | Managers | Approvals |',
    '| --- | --- | ---: | --- | ---: |'
  )
  for (const participant of report.participants) {
    lines.push([
      participant.role,
      markdownCell(participant.owner),
      participant.workspaceCount,
      participant.managerIds.join(', ') || '-',
      participant.approvalCount
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push(
    '',
    '## Scope Matrix',
    '',
    '| Severity | Status | Workspace | Manager | Owners | CI | Gates | Rollback | Verify | Recommendation |',
    '| --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | --- |'
  )
  for (const item of report.scope) {
    lines.push([
      item.severity,
      item.status,
      markdownCell(item.workspaceRelativePath || '.'),
      item.managerId,
      markdownCell(item.owners.join(', ') || 'missing'),
      item.ciJobCount,
      item.releaseGateCount,
      item.rollbackStatus || '-',
      item.verificationCommandCount,
      markdownCell(item.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('## Source Errors', '')
  const errors = Object.entries(report.sources.errors)
  if (errors.length === 0) {
    lines.push('- No source collection errors.')
  } else {
    for (const [source, error] of errors) {
      lines.push(`- ${source}: ${error}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function exportResult(
  path: string,
  format: 'markdown' | 'json',
  report: DependencyChangeApprovalPacketReport
): DependencyChangeApprovalPacketExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    decision: report.decision,
    checklistCount: report.summary.checklistCount,
    scopeItemCount: report.summary.scopeItemCount,
    summary: report.summary
  }
}

function sourceErrors(
  impactResult: CaptureResult<DependencyImpactAnalysisReport>,
  upgradeResult: CaptureResult<DependencyUpgradePlaybookReport>,
  rollbackResult: CaptureResult<DependencyRollbackPlanReport>,
  trustResult: CaptureResult<ReleaseTrustPolicyReport>,
  approvalResult: CaptureResult<ReleaseApprovalReport>,
  exceptionResult: CaptureResult<ReleaseExceptionReport>
): Partial<Record<DependencyChangeApprovalCheckSource, string>> {
  return {
    ...(impactResult.error ? { 'dependency-impact-analysis': impactResult.error } : {}),
    ...(upgradeResult.error ? { 'dependency-upgrade-playbook': upgradeResult.error } : {}),
    ...(rollbackResult.error ? { 'dependency-rollback-plan': rollbackResult.error } : {}),
    ...(trustResult.error ? { 'release-trust-policy': trustResult.error } : {}),
    ...(approvalResult.error ? { 'release-approval': approvalResult.error } : {}),
    ...(exceptionResult.error ? { 'release-exception': exceptionResult.error } : {})
  }
}

async function capture<T>(factory: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await factory() }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function severityRank(severity: DependencyImpactSeverity): number {
  if (severity === 'critical') return 1
  if (severity === 'high') return 2
  if (severity === 'medium') return 3
  if (severity === 'low') return 4
  return 5
}

function statusRank(status: DependencyChangeApprovalPacketStatus): number {
  if (status === 'blocked') return 3
  if (status === 'warning') return 2
  return 1
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
