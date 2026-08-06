import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  DependencyChangeApprovalPacketService,
  type DependencyChangeApprovalPacketReport,
  type DependencyChangeApprovalScopeItem,
  type DependencyChangeApprovalPacketStatus
} from './dependencyChangeApprovalPacket'
import {
  DependencyImpactAnalysisService,
  type DependencyImpactAnalysisReport,
  type DependencyImpactSeverity
} from './dependencyImpactAnalysis'

export type DependencyChangeCalendarStatus = 'ready' | 'warning' | 'blocked'
export type DependencyChangeWindowKind =
  | 'automation'
  | 'standard'
  | 'manual-review'
  | 'security-hotfix'
  | 'frozen'
export type DependencyChangeWindowStatus = 'scheduled' | 'needs-review' | 'frozen' | 'blocked'
export type DependencyChangeFreezeReason =
  | 'approval-blocked'
  | 'trust-policy-blocked'
  | 'rollback-blocked'
  | 'missing-owner'
  | 'critical-impact'
  | 'active-exception'
  | 'calendar-policy'
export type DependencyChangeCalendarSource =
  | 'dependency-change-approval-packet'
  | 'dependency-impact-analysis'
export type DependencyChangeCalendarExportFormat =
  | 'markdown'
  | 'json'
  | 'ics'
  | 'github-actions'
  | 'ticket-template'

export interface DependencyChangeCalendarWindow {
  id: string
  kind: DependencyChangeWindowKind
  status: DependencyChangeWindowStatus
  title: string
  startAt?: string
  endAt?: string
  timezone: 'UTC'
  severity: DependencyImpactSeverity
  workspaceName: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  managerName: string
  owners: string[]
  releaseGateCount: number
  verificationCommandCount: number
  requiredActions: string[]
  evidence: string[]
}

export interface DependencyChangeFreezeWindow {
  id: string
  status: DependencyChangeCalendarStatus
  reason: DependencyChangeFreezeReason
  title: string
  startsAt: string
  endsAt?: string
  scope: string
  affectedWorkspaceCount: number
  affectedManagerCount: number
  recommendation: string
  evidence: string[]
}

export interface DependencyChangeCalendarSummary {
  status: DependencyChangeCalendarStatus
  windowCount: number
  scheduledWindowCount: number
  needsReviewWindowCount: number
  frozenWindowCount: number
  blockedWindowCount: number
  freezeWindowCount: number
  blockedFreezeWindowCount: number
  warningFreezeWindowCount: number
  automationWindowCount: number
  manualReviewWindowCount: number
  securityHotfixWindowCount: number
  workspaceCount: number
  managerCount: number
  ownerCount: number
  missingOwnerItemCount: number
  activeExceptionCount: number
  rejectedApprovalCount: number
  trustBlockedCheckCount: number
  rollbackBlockedItemCount: number
  verificationCommandCount: number
  sourceErrorCount: number
}

export interface DependencyChangeCalendarReport {
  generatedAt: string
  projectPath: string
  status: DependencyChangeCalendarStatus
  summary: DependencyChangeCalendarSummary
  freezeWindows: DependencyChangeFreezeWindow[]
  windows: DependencyChangeCalendarWindow[]
  sources: {
    approvalPacket?: Pick<DependencyChangeApprovalPacketReport, 'generatedAt' | 'status' | 'decision' | 'summary'>
    impactAnalysis?: Pick<DependencyImpactAnalysisReport, 'generatedAt' | 'status' | 'summary'>
    errors: Partial<Record<DependencyChangeCalendarSource, string>>
  }
}

export interface DependencyChangeCalendarExportResult {
  path: string
  format: DependencyChangeCalendarExportFormat
  generatedAt: string
  status: DependencyChangeCalendarStatus
  windowCount: number
  freezeWindowCount: number
  summary: DependencyChangeCalendarSummary
}

export interface DependencyChangeCalendarDependencies {
  dependencyChangeApprovalPacketService?: DependencyChangeApprovalPacketService
  dependencyImpactAnalysisService?: DependencyImpactAnalysisService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'dependency-change-calendar'

export class DependencyChangeCalendarService {
  private readonly dependencyChangeApprovalPacketService: DependencyChangeApprovalPacketService
  private readonly dependencyImpactAnalysisService: DependencyImpactAnalysisService

  constructor(dependencies: DependencyChangeCalendarDependencies = {}) {
    this.dependencyImpactAnalysisService = dependencies.dependencyImpactAnalysisService || new DependencyImpactAnalysisService()
    this.dependencyChangeApprovalPacketService = dependencies.dependencyChangeApprovalPacketService || new DependencyChangeApprovalPacketService({
      dependencyImpactAnalysisService: this.dependencyImpactAnalysisService
    })
  }

  async report(projectPath: string): Promise<DependencyChangeCalendarReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [packetResult, impactResult] = await Promise.all([
      capture(() => this.dependencyChangeApprovalPacketService.report(root)),
      capture(() => this.dependencyImpactAnalysisService.report(root))
    ])
    const generatedAt = new Date().toISOString()
    const errors = sourceErrors(packetResult, impactResult)
    const freezeWindows = buildFreezeWindows(generatedAt, packetResult.value)
    const windows = buildWindows(generatedAt, packetResult.value)
    const summary = summarize(windows, freezeWindows, packetResult.value, errors)

    return {
      generatedAt,
      projectPath: root,
      status: summary.status,
      summary,
      freezeWindows,
      windows,
      sources: {
        approvalPacket: packetResult.value
          ? {
              generatedAt: packetResult.value.generatedAt,
              status: packetResult.value.status,
              decision: packetResult.value.decision,
              summary: packetResult.value.summary
            }
          : undefined,
        impactAnalysis: impactResult.value
          ? {
              generatedAt: impactResult.value.generatedAt,
              status: impactResult.value.status,
              summary: impactResult.value.summary
            }
          : undefined,
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<DependencyChangeCalendarExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyChangeCalendarExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }

  async exportIcs(projectPath: string): Promise<DependencyChangeCalendarExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.ics`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderIcs(report), 'utf-8')
    return exportResult(path, 'ics', report)
  }

  async exportFreezeGate(projectPath: string): Promise<DependencyChangeCalendarExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'ci', 'dependency-change-freeze-gate.yml')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderFreezeGateWorkflow(report), 'utf-8')
    return exportResult(path, 'github-actions', report)
  }

  async exportTicketTemplate(projectPath: string): Promise<DependencyChangeCalendarExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-change-ticket-template.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderTicketTemplate(report), 'utf-8')
    return exportResult(path, 'ticket-template', report)
  }
}

function buildFreezeWindows(
  generatedAt: string,
  packet: DependencyChangeApprovalPacketReport | undefined
): DependencyChangeFreezeWindow[] {
  if (!packet) {
    return [{
      id: 'freeze:missing-approval-packet',
      status: 'blocked',
      reason: 'calendar-policy',
      title: 'Freeze dependency changes until approval packet exists',
      startsAt: generatedAt,
      scope: 'all dependency changes',
      affectedWorkspaceCount: 0,
      affectedManagerCount: 0,
      recommendation: 'Generate a dependency change approval packet before scheduling dependency changes.',
      evidence: ['Missing dependency change approval packet.']
    }]
  }

  const freezes: DependencyChangeFreezeWindow[] = []
  if (packet.status === 'blocked' || packet.decision === 'blocked') {
    freezes.push({
      id: 'freeze:approval-packet-blocked',
      status: 'blocked',
      reason: 'approval-blocked',
      title: 'Freeze blocked dependency changes',
      startsAt: generatedAt,
      scope: 'blocked approval packet scopes',
      affectedWorkspaceCount: packet.summary.workspaceCount,
      affectedManagerCount: packet.summary.managerCount,
      recommendation: 'Do not schedule blocked dependency changes until approval checklist blockers are cleared.',
      evidence: [
        `Blocked checklist items: ${packet.summary.blockedChecklistCount}`,
        `Blocked scope items: ${packet.summary.blockedScopeItemCount}`,
        `Decision: ${packet.decision}`
      ]
    })
  }

  if (packet.summary.trustBlockedCheckCount > 0) {
    freezes.push({
      id: 'freeze:trust-policy-blocked',
      status: 'blocked',
      reason: 'trust-policy-blocked',
      title: 'Freeze changes with blocked trust policy checks',
      startsAt: generatedAt,
      scope: 'release trust policy',
      affectedWorkspaceCount: packet.summary.workspaceCount,
      affectedManagerCount: packet.summary.managerCount,
      recommendation: 'Resolve blocked trust policy checks or record a scoped, time-boxed exception before scheduling.',
      evidence: [`Trust blocked checks: ${packet.summary.trustBlockedCheckCount}`]
    })
  }

  if (packet.summary.rollbackBlockedItemCount > 0) {
    freezes.push({
      id: 'freeze:rollback-blocked',
      status: 'blocked',
      reason: 'rollback-blocked',
      title: 'Freeze changes with blocked rollback coverage',
      startsAt: generatedAt,
      scope: 'rollback-blocked dependency scopes',
      affectedWorkspaceCount: packet.summary.workspaceCount,
      affectedManagerCount: packet.summary.managerCount,
      recommendation: 'Create managed snapshots or source-control rollback coverage before scheduling these changes.',
      evidence: [`Rollback blocked items: ${packet.summary.rollbackBlockedItemCount}`]
    })
  }

  if (packet.summary.missingOwnerItemCount > 0) {
    freezes.push({
      id: 'freeze:missing-owners',
      status: 'warning',
      reason: 'missing-owner',
      title: 'Hold ownerless dependency changes for routing',
      startsAt: generatedAt,
      endsAt: datePlusHours(generatedAt, 72),
      scope: 'ownerless dependency scopes',
      affectedWorkspaceCount: packet.summary.workspaceCount,
      affectedManagerCount: packet.summary.managerCount,
      recommendation: 'Assign dependency owners or use the dependency ownership plan before scheduling ownerless changes.',
      evidence: [`Missing owner items: ${packet.summary.missingOwnerItemCount}`]
    })
  }

  if (packet.summary.activeExceptionCount > 0) {
    freezes.push({
      id: 'freeze:active-exceptions',
      status: 'warning',
      reason: 'active-exception',
      title: 'Review active exceptions before scheduling',
      startsAt: generatedAt,
      endsAt: datePlusHours(generatedAt, 48),
      scope: 'exceptioned dependency changes',
      affectedWorkspaceCount: packet.summary.workspaceCount,
      affectedManagerCount: packet.summary.managerCount,
      recommendation: 'Confirm active exceptions are scoped to the scheduled window and have expiry dates.',
      evidence: [`Active exceptions: ${packet.summary.activeExceptionCount}`]
    })
  }

  return freezes
}

function buildWindows(
  generatedAt: string,
  packet: DependencyChangeApprovalPacketReport | undefined
): DependencyChangeCalendarWindow[] {
  return (packet?.scope || []).map((scope, index) => {
    const kind = windowKind(scope)
    const status = windowStatus(scope, packet)
    const startAt = status === 'blocked' || status === 'frozen'
      ? undefined
      : scheduledStart(generatedAt, kind, index)
    const endAt = startAt ? datePlusHours(startAt, windowDurationHours(kind)) : undefined
    return {
      id: `change-window:${scope.workspaceRelativePath}:${scope.managerId}:${index}`,
      kind,
      status,
      title: `${scope.managerName} dependency change in ${scope.workspaceName}`,
      startAt,
      endAt,
      timezone: 'UTC',
      severity: scope.severity,
      workspaceName: scope.workspaceName,
      workspaceRelativePath: scope.workspaceRelativePath,
      managerId: scope.managerId,
      managerName: scope.managerName,
      owners: scope.owners,
      releaseGateCount: scope.releaseGateCount,
      verificationCommandCount: scope.verificationCommandCount,
      requiredActions: requiredActions(scope, status),
      evidence: [
        `Approval decision: ${packet.decision}`,
        `Scope status: ${scope.status}`,
        `Severity: ${scope.severity}`,
        `CI jobs: ${scope.ciJobCount}`,
        `Release gates: ${scope.releaseGateCount}`,
        `Rollback status: ${scope.rollbackStatus || 'missing'}`
      ]
    }
  })
}

function windowKind(scope: DependencyChangeApprovalScopeItem): DependencyChangeWindowKind {
  if (scope.status === 'blocked' || scope.rollbackStatus === 'blocked') return 'frozen'
  if (scope.severity === 'critical') return 'security-hotfix'
  if (scope.severity === 'high' || scope.owners.length === 0 || scope.releaseGateCount > 0) return 'manual-review'
  if (scope.severity === 'medium') return 'standard'
  return 'automation'
}

function windowStatus(
  scope: DependencyChangeApprovalScopeItem,
  packet: DependencyChangeApprovalPacketReport
): DependencyChangeWindowStatus {
  if (packet.decision === 'blocked' || scope.status === 'blocked') return 'blocked'
  if (scope.rollbackStatus === 'blocked') return 'frozen'
  if (packet.decision === 'needs-review' || scope.status === 'warning' || scope.owners.length === 0) return 'needs-review'
  return 'scheduled'
}

function requiredActions(
  scope: DependencyChangeApprovalScopeItem,
  status: DependencyChangeWindowStatus
): string[] {
  const actions = [
    status === 'blocked' || status === 'frozen' ? 'Resolve blockers before assigning a calendar window.' : undefined,
    scope.owners.length === 0 ? 'Assign dependency owners before scheduling.' : undefined,
    scope.releaseGateCount > 0 ? 'Attach release-gate evidence and reviewer decision.' : undefined,
    scope.rollbackStatus !== 'ready' ? 'Review rollback plan and create missing rollback coverage.' : undefined,
    scope.verificationCommandCount > 0 ? 'Run or schedule all listed verification commands.' : 'Add verification commands for this manager.'
  ].filter(Boolean) as string[]
  return unique(actions)
}

function summarize(
  windows: DependencyChangeCalendarWindow[],
  freezes: DependencyChangeFreezeWindow[],
  packet: DependencyChangeApprovalPacketReport | undefined,
  errors: Partial<Record<DependencyChangeCalendarSource, string>>
): DependencyChangeCalendarSummary {
  const blockedFreezeWindowCount = freezes.filter((item) => item.status === 'blocked').length
  const warningFreezeWindowCount = freezes.filter((item) => item.status === 'warning').length
  const blockedWindowCount = windows.filter((item) => item.status === 'blocked').length
  const frozenWindowCount = windows.filter((item) => item.status === 'frozen').length
  const needsReviewWindowCount = windows.filter((item) => item.status === 'needs-review').length
  const status: DependencyChangeCalendarStatus = blockedFreezeWindowCount > 0 || blockedWindowCount > 0 || Object.keys(errors).length > 0
    ? 'blocked'
    : warningFreezeWindowCount > 0 || frozenWindowCount > 0 || needsReviewWindowCount > 0
      ? 'warning'
      : 'ready'

  return {
    status,
    windowCount: windows.length,
    scheduledWindowCount: windows.filter((item) => item.status === 'scheduled').length,
    needsReviewWindowCount,
    frozenWindowCount,
    blockedWindowCount,
    freezeWindowCount: freezes.length,
    blockedFreezeWindowCount,
    warningFreezeWindowCount,
    automationWindowCount: windows.filter((item) => item.kind === 'automation').length,
    manualReviewWindowCount: windows.filter((item) => item.kind === 'manual-review').length,
    securityHotfixWindowCount: windows.filter((item) => item.kind === 'security-hotfix').length,
    workspaceCount: unique(windows.map((item) => item.workspaceRelativePath)).length,
    managerCount: unique(windows.map((item) => item.managerId)).length,
    ownerCount: unique(windows.flatMap((item) => item.owners)).length,
    missingOwnerItemCount: packet?.summary.missingOwnerItemCount || 0,
    activeExceptionCount: packet?.summary.activeExceptionCount || 0,
    rejectedApprovalCount: packet?.summary.rejectedRecordCount || 0,
    trustBlockedCheckCount: packet?.summary.trustBlockedCheckCount || 0,
    rollbackBlockedItemCount: packet?.summary.rollbackBlockedItemCount || 0,
    verificationCommandCount: sum(windows.map((item) => item.verificationCommandCount)),
    sourceErrorCount: Object.keys(errors).length
  }
}

function renderMarkdown(report: DependencyChangeCalendarReport): string {
  const lines = [
    '# Dependency Change Calendar',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Change windows: ${report.summary.windowCount}`,
    `- Scheduled / needs-review / frozen / blocked: ${report.summary.scheduledWindowCount}/${report.summary.needsReviewWindowCount}/${report.summary.frozenWindowCount}/${report.summary.blockedWindowCount}`,
    `- Freeze windows: ${report.summary.freezeWindowCount}`,
    `- Blocked freeze windows: ${report.summary.blockedFreezeWindowCount}`,
    `- Automation/manual/security windows: ${report.summary.automationWindowCount}/${report.summary.manualReviewWindowCount}/${report.summary.securityHotfixWindowCount}`,
    `- Missing owner items: ${report.summary.missingOwnerItemCount}`,
    `- Active exceptions: ${report.summary.activeExceptionCount}`,
    `- Trust blocked checks: ${report.summary.trustBlockedCheckCount}`,
    `- Rollback blocked items: ${report.summary.rollbackBlockedItemCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    '',
    '## Freeze Windows',
    '',
    '| Status | Reason | Scope | Starts | Ends | Recommendation |',
    '| --- | --- | --- | --- | --- | --- |'
  ]

  if (report.freezeWindows.length === 0) {
    lines.push('| ready | none | - | - | - | No freeze windows are currently required. |')
  } else {
    for (const item of report.freezeWindows) {
      lines.push([
        item.status,
        item.reason,
        markdownCell(item.scope),
        item.startsAt,
        item.endsAt || '-',
        markdownCell(item.recommendation)
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
  }

  lines.push(
    '',
    '## Change Windows',
    '',
    '| Kind | Status | Start | End | Workspace | Manager | Owners | Verify | Actions |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: | --- |'
  )

  for (const item of report.windows) {
    lines.push([
      item.kind,
      item.status,
      item.startAt || '-',
      item.endAt || '-',
      markdownCell(item.workspaceRelativePath || '.'),
      item.managerId,
      markdownCell(item.owners.join(', ') || 'missing'),
      item.verificationCommandCount,
      markdownCell(item.requiredActions.join('; '))
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
  format: DependencyChangeCalendarExportFormat,
  report: DependencyChangeCalendarReport
): DependencyChangeCalendarExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    windowCount: report.summary.windowCount,
    freezeWindowCount: report.summary.freezeWindowCount,
    summary: report.summary
  }
}

function renderIcs(report: DependencyChangeCalendarReport): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DependencyHub Desktop//Dependency Change Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText('Dependency Change Calendar')}`,
    `X-WR-CALDESC:${icsText(`${report.status} dependency change windows for ${report.projectPath}`)}`
  ]

  for (const item of report.freezeWindows) {
    lines.push(...renderIcsEvent({
      uid: `${item.id}@DependencyHub Desktop`,
      generatedAt: report.generatedAt,
      startAt: item.startsAt,
      endAt: item.endsAt || datePlusHours(item.startsAt, item.status === 'blocked' ? 168 : 72),
      summary: `[Freeze] ${item.title}`,
      status: item.status === 'blocked' ? 'CONFIRMED' : 'TENTATIVE',
      categories: ['DEPENDENCY-FREEZE', item.reason.toUpperCase()],
      description: [
        `Status: ${item.status}`,
        `Reason: ${item.reason}`,
        `Scope: ${item.scope}`,
        `Affected workspaces: ${item.affectedWorkspaceCount}`,
        `Affected managers: ${item.affectedManagerCount}`,
        `Recommendation: ${item.recommendation}`,
        ...item.evidence.map((entry) => `Evidence: ${entry}`)
      ].join('\n')
    }))
  }

  for (const item of report.windows) {
    if (!item.startAt || !item.endAt) continue
    lines.push(...renderIcsEvent({
      uid: `${item.id}@DependencyHub Desktop`,
      generatedAt: report.generatedAt,
      startAt: item.startAt,
      endAt: item.endAt,
      summary: item.title,
      status: item.status === 'scheduled' ? 'CONFIRMED' : 'TENTATIVE',
      categories: ['DEPENDENCY-CHANGE', item.kind.toUpperCase(), item.status.toUpperCase()],
      description: [
        `Status: ${item.status}`,
        `Kind: ${item.kind}`,
        `Severity: ${item.severity}`,
        `Workspace: ${item.workspaceRelativePath || '.'}`,
        `Manager: ${item.managerId}`,
        `Owners: ${item.owners.join(', ') || 'missing'}`,
        `Verification commands: ${item.verificationCommandCount}`,
        ...item.requiredActions.map((entry) => `Required action: ${entry}`),
        ...item.evidence.map((entry) => `Evidence: ${entry}`)
      ].join('\n')
    }))
  }

  lines.push('END:VCALENDAR')
  return `${lines.flatMap(foldIcsLine).join('\r\n')}\r\n`
}

function renderIcsEvent(input: {
  uid: string
  generatedAt: string
  startAt: string
  endAt: string
  summary: string
  status: 'CONFIRMED' | 'TENTATIVE'
  categories: string[]
  description: string
}): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${icsText(input.uid)}`,
    `DTSTAMP:${icsDate(input.generatedAt)}`,
    `DTSTART:${icsDate(input.startAt)}`,
    `DTEND:${icsDate(input.endAt)}`,
    `SUMMARY:${icsText(input.summary)}`,
    `DESCRIPTION:${icsText(input.description)}`,
    `STATUS:${input.status}`,
    'TRANSP:OPAQUE',
    `CATEGORIES:${input.categories.map(icsText).join(',')}`,
    'END:VEVENT'
  ]
}

function renderFreezeGateWorkflow(report: DependencyChangeCalendarReport): string {
  const lines = [
    'name: Dependency Change Freeze Gate',
    '',
    'on:',
    '  pull_request:',
    '  push:',
    '    branches: [main]',
    '',
    'jobs:',
    '  dependency-change-freeze-gate:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Check dependency change calendar freeze windows',
    '        shell: bash',
    '        run: |',
    '          node <<\'NODE\'',
    '          const fs = require("fs")',
    '          const path = ".npmDesktopManager/reports/dependency-change-calendar.json"',
    '          if (!fs.existsSync(path)) {',
    '            console.log("No dependency change calendar report found; skipping freeze enforcement.")',
    '            console.log("Export dependency-change-calendar.json before enforcing change freezes in CI.")',
    '            process.exit(0)',
    '          }',
    '          const report = JSON.parse(fs.readFileSync(path, "utf8"))',
    '          const summary = report.summary || {}',
    '          const freezeWindows = Array.isArray(report.freezeWindows) ? report.freezeWindows : []',
    '          const changeWindows = Array.isArray(report.windows) ? report.windows : []',
    '          const blockedFreezes = freezeWindows.filter((item) => item.status === "blocked")',
    '          const blockedChanges = changeWindows.filter((item) => item.status === "blocked" || item.status === "frozen")',
    '          console.log("Dependency change calendar status: " + (report.status || "unknown"))',
    '          console.log("Change windows: " + (summary.windowCount || changeWindows.length))',
    '          console.log("Freeze windows: " + (summary.freezeWindowCount || freezeWindows.length))',
    '          if (blockedFreezes.length > 0 || blockedChanges.length > 0 || report.status === "blocked") {',
    '            console.error("Dependency change freeze gate failed.")',
    '            for (const item of blockedFreezes.slice(0, 20)) {',
    '              console.error("- Freeze: " + item.reason + " / " + item.scope + " / " + item.recommendation)',
    '            }',
    '            for (const item of blockedChanges.slice(0, 20)) {',
    '              console.error("- Change: " + item.managerId + " / " + item.workspaceRelativePath + " / " + item.status)',
    '            }',
    '            process.exit(1)',
    '          }',
    '          console.log("Dependency change freeze gate passed.")',
    '          NODE'
  ]

  lines.push(
    '',
    '# Generated from dependency-change-calendar at ' + report.generatedAt,
    '# Current summary: ' + report.summary.windowCount + ' change window(s), ' + report.summary.freezeWindowCount + ' freeze window(s).'
  )
  return `${lines.join('\n')}\n`
}

function renderTicketTemplate(report: DependencyChangeCalendarReport): string {
  const lines = [
    '# Dependency Change Ticket',
    '',
    'Labels: dependency-change, dependency-governance',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Calendar status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Change windows: ${report.summary.windowCount}`,
    `- Scheduled / needs-review / frozen / blocked: ${report.summary.scheduledWindowCount}/${report.summary.needsReviewWindowCount}/${report.summary.frozenWindowCount}/${report.summary.blockedWindowCount}`,
    `- Freeze windows: ${report.summary.freezeWindowCount}`,
    `- Missing owner items: ${report.summary.missingOwnerItemCount}`,
    `- Trust blocked checks: ${report.summary.trustBlockedCheckCount}`,
    `- Rollback blocked items: ${report.summary.rollbackBlockedItemCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    '',
    '## Approval Checklist',
    '',
    '- [ ] Dependency change approval packet reviewed.',
    '- [ ] Impact analysis reviewed by affected owners.',
    '- [ ] Rollback plan reviewed and usable for every scheduled scope.',
    '- [ ] Required CI and verification commands are scheduled.',
    '- [ ] Active release exceptions are scoped and time-boxed.',
    '- [ ] Freeze windows below are accepted or resolved.',
    '',
    '## Freeze Window Review',
    '',
    '| Status | Reason | Scope | Starts | Ends | Recommendation |',
    '| --- | --- | --- | --- | --- | --- |'
  ]

  if (report.freezeWindows.length === 0) {
    lines.push('| ready | none | - | - | - | No freeze windows are currently required. |')
  } else {
    for (const item of report.freezeWindows) {
      lines.push([
        item.status,
        item.reason,
        markdownCell(item.scope),
        item.startsAt,
        item.endsAt || 'open',
        markdownCell(item.recommendation)
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
  }

  lines.push(
    '',
    '## Scheduled Changes',
    '',
    '| Status | Kind | Start | End | Workspace | Manager | Owners | Required actions |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'
  )

  for (const item of report.windows) {
    lines.push([
      item.status,
      item.kind,
      item.startAt || 'unscheduled',
      item.endAt || '-',
      markdownCell(item.workspaceRelativePath || '.'),
      item.managerId,
      markdownCell(item.owners.join(', ') || 'missing'),
      markdownCell(item.requiredActions.join('; '))
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push(
    '',
    '## Reviewer Notes',
    '',
    '- Decision:',
    '- Reviewer:',
    '- Related pull request:',
    '- Related release:',
    '- Rollback owner:',
    '- Verification evidence:',
    '',
    '## Final Sign-off',
    '',
    '- [ ] Approved for the scheduled window.',
    '- [ ] Freeze gate result attached.',
    '- [ ] Rollback path tested or accepted by reviewer.'
  )

  return `${lines.join('\n')}\n`
}

function sourceErrors(
  packetResult: CaptureResult<DependencyChangeApprovalPacketReport>,
  impactResult: CaptureResult<DependencyImpactAnalysisReport>
): Partial<Record<DependencyChangeCalendarSource, string>> {
  return {
    ...(packetResult.error ? { 'dependency-change-approval-packet': packetResult.error } : {}),
    ...(impactResult.error ? { 'dependency-impact-analysis': impactResult.error } : {})
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

function scheduledStart(generatedAt: string, kind: DependencyChangeWindowKind, index: number): string {
  const base = new Date(generatedAt)
  const offsetDays = kind === 'security-hotfix'
    ? 1
    : kind === 'manual-review'
      ? 2
      : kind === 'standard'
        ? 3
        : 1
  const hour = kind === 'automation' ? 9 : kind === 'standard' ? 14 : 16
  const date = addBusinessDays(base, offsetDays + Math.floor(index / 4))
  date.setUTCHours(hour, (index % 4) * 15, 0, 0)
  return date.toISOString()
}

function addBusinessDays(base: Date, days: number): Date {
  const date = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    0,
    0,
    0,
    0
  ))
  let remaining = Math.max(0, days)
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return date
}

function windowDurationHours(kind: DependencyChangeWindowKind): number {
  if (kind === 'security-hotfix' || kind === 'manual-review') return 3
  if (kind === 'standard') return 2
  return 1
}

function datePlusHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1000).toISOString()
}

function icsDate(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function foldIcsLine(line: string): string[] {
  if (line.length <= 74) return [line]
  const chunks: string[] = []
  let remaining = line
  while (remaining.length > 74) {
    chunks.push(remaining.slice(0, 74))
    remaining = ` ${remaining.slice(74)}`
  }
  chunks.push(remaining)
  return chunks
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
