import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  DependencyChangeCalendarService,
  type DependencyChangeCalendarReport,
  type DependencyChangeCalendarWindow,
  type DependencyChangeWindowKind,
  type DependencyChangeWindowStatus
} from './dependencyChangeCalendar'
import {
  DependencyChangeApprovalPacketService,
  type DependencyChangeApprovalDecision,
  type DependencyChangeApprovalPacketReport
} from './dependencyChangeApprovalPacket'
import {
  CiEvidenceService,
  type CiEvidenceRecord,
  type CiEvidenceReport,
  type CiEvidenceStatus
} from './ciEvidence'
import {
  listOperationHistory,
  type OperationHistoryOperationKind,
  type OperationHistoryRecord,
  type OperationHistoryRisk,
  type OperationHistoryStatus
} from './operationHistory'
import type { DependencyImpactSeverity } from './dependencyImpactAnalysis'

export type DependencyChangeExecutionStatus = 'ready' | 'warning' | 'blocked'
export type DependencyChangeExecutionRecordStatus =
  | 'completed'
  | 'pending'
  | 'failed'
  | 'blocked'
  | 'unscheduled'
export type DependencyChangeExecutionVerificationStatus =
  | 'passed'
  | 'failed'
  | 'missing'
  | 'pending'
export type DependencyChangeExecutionSource =
  | 'dependency-change-calendar'
  | 'dependency-change-approval-packet'
  | 'ci-evidence'
  | 'operation-history'

export interface DependencyChangeExecutionOperation {
  id: string
  command: string
  cwd: string
  status: OperationHistoryStatus
  operation: OperationHistoryOperationKind
  risk: OperationHistoryRisk
  startedAt: string
  finishedAt: string
  durationMs: number
  summary?: string
}

export interface DependencyChangeExecutionCiEvidence {
  id: string
  status: CiEvidenceStatus
  provider?: string
  workflow?: string
  job?: string
  branch?: string
  commit?: string
  url?: string
  finishedAt: string
  summary?: string
}

export interface DependencyChangeExecutionRecordItem {
  id: string
  status: DependencyChangeExecutionRecordStatus
  verificationStatus: DependencyChangeExecutionVerificationStatus
  title: string
  windowKind: DependencyChangeWindowKind
  windowStatus: DependencyChangeWindowStatus
  scheduledStartAt?: string
  scheduledEndAt?: string
  severity: DependencyImpactSeverity
  workspaceName: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  managerName: string
  owners: string[]
  approvalDecision?: DependencyChangeApprovalDecision
  operationCount: number
  successfulOperationCount: number
  failedOperationCount: number
  ciEvidenceCount: number
  latestCiStatus?: CiEvidenceStatus
  relatedOperations: DependencyChangeExecutionOperation[]
  relatedCiEvidence: DependencyChangeExecutionCiEvidence[]
  requiredActions: string[]
  gaps: string[]
  evidence: string[]
  recommendation: string
}

export interface DependencyChangeExecutionSummary {
  status: DependencyChangeExecutionStatus
  recordCount: number
  completedRecordCount: number
  pendingRecordCount: number
  failedRecordCount: number
  blockedRecordCount: number
  unscheduledRecordCount: number
  operationCount: number
  successfulOperationCount: number
  failedOperationCount: number
  ciEvidenceCount: number
  ciSuccessRecordCount: number
  ciFailedRecordCount: number
  missingOperationEvidenceCount: number
  missingCiEvidenceCount: number
  approvalBlockedCount: number
  freezeBlockedCount: number
  verificationPassedCount: number
  verificationFailedCount: number
  sourceErrorCount: number
}

export interface DependencyChangeExecutionReport {
  generatedAt: string
  projectPath: string
  status: DependencyChangeExecutionStatus
  summary: DependencyChangeExecutionSummary
  records: DependencyChangeExecutionRecordItem[]
  sources: {
    calendar?: Pick<DependencyChangeCalendarReport, 'generatedAt' | 'status' | 'summary'>
    approvalPacket?: Pick<DependencyChangeApprovalPacketReport, 'generatedAt' | 'status' | 'decision' | 'summary'>
    ciEvidence?: Pick<CiEvidenceReport, 'generatedAt' | 'summary'>
    operationHistory: {
      count: number
      mutatingCount: number
      failedCount: number
    }
    errors: Partial<Record<DependencyChangeExecutionSource, string>>
  }
}

export interface DependencyChangeExecutionExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: DependencyChangeExecutionStatus
  recordCount: number
  summary: DependencyChangeExecutionSummary
}

export interface DependencyChangeExecutionDependencies {
  dependencyChangeCalendarService?: DependencyChangeCalendarService
  dependencyChangeApprovalPacketService?: DependencyChangeApprovalPacketService
  ciEvidenceService?: CiEvidenceService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'dependency-change-execution-record'

export class DependencyChangeExecutionRecordService {
  private readonly dependencyChangeCalendarService: DependencyChangeCalendarService
  private readonly dependencyChangeApprovalPacketService: DependencyChangeApprovalPacketService
  private readonly ciEvidenceService: CiEvidenceService

  constructor(dependencies: DependencyChangeExecutionDependencies = {}) {
    this.dependencyChangeApprovalPacketService = dependencies.dependencyChangeApprovalPacketService || new DependencyChangeApprovalPacketService()
    this.dependencyChangeCalendarService = dependencies.dependencyChangeCalendarService || new DependencyChangeCalendarService({
      dependencyChangeApprovalPacketService: this.dependencyChangeApprovalPacketService
    })
    this.ciEvidenceService = dependencies.ciEvidenceService || new CiEvidenceService()
  }

  async report(projectPath: string): Promise<DependencyChangeExecutionReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [calendarResult, approvalResult, ciResult, operationResult] = await Promise.all([
      capture(() => this.dependencyChangeCalendarService.report(root)),
      capture(() => this.dependencyChangeApprovalPacketService.report(root)),
      capture(() => this.ciEvidenceService.report(root)),
      capture(() => listOperationHistory(root, { limit: 300 }))
    ])
    const operations = operationResult.value || []
    const ciRecords = ciResult.value?.records || []
    const generatedAt = new Date().toISOString()
    const errors = sourceErrors(calendarResult, approvalResult, ciResult, operationResult)
    const records = buildRecords({
      root,
      calendar: calendarResult.value,
      approval: approvalResult.value,
      operations,
      ciRecords
    })
    const summary = summarize(records, calendarResult.value, approvalResult.value, operations, ciRecords, errors)

    return {
      generatedAt,
      projectPath: root,
      status: summary.status,
      summary,
      records,
      sources: {
        calendar: calendarResult.value
          ? {
              generatedAt: calendarResult.value.generatedAt,
              status: calendarResult.value.status,
              summary: calendarResult.value.summary
            }
          : undefined,
        approvalPacket: approvalResult.value
          ? {
              generatedAt: approvalResult.value.generatedAt,
              status: approvalResult.value.status,
              decision: approvalResult.value.decision,
              summary: approvalResult.value.summary
            }
          : undefined,
        ciEvidence: ciResult.value
          ? {
              generatedAt: ciResult.value.generatedAt,
              summary: ciResult.value.summary
            }
          : undefined,
        operationHistory: {
          count: operations.length,
          mutatingCount: operations.filter((record) => record.classification?.mutating).length,
          failedCount: operations.filter((record) => record.status === 'error').length
        },
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<DependencyChangeExecutionExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyChangeExecutionExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function buildRecords(input: {
  root: string
  calendar?: DependencyChangeCalendarReport
  approval?: DependencyChangeApprovalPacketReport
  operations: OperationHistoryRecord[]
  ciRecords: CiEvidenceRecord[]
}): DependencyChangeExecutionRecordItem[] {
  const windows = input.calendar?.windows || []
  const approvalDecision = input.approval?.decision
  return windows.map((window) => {
    const relatedOperations = input.operations
      .filter((record) => operationMatchesWindow(input.root, record, window))
      .slice(0, 12)
      .map(executionOperation)
    const relatedCiEvidence = input.ciRecords.slice(0, 8).map(executionCiEvidence)
    const failedOperationCount = relatedOperations.filter((record) => record.status === 'error').length
    const successfulOperationCount = relatedOperations.filter((record) => record.status === 'success').length
    const latestCiStatus = relatedCiEvidence[0]?.status
    const verificationStatus = verificationStatusFor(window, relatedCiEvidence, failedOperationCount)
    const status = recordStatus(window, verificationStatus, successfulOperationCount, failedOperationCount)
    const gaps = recordGaps(window, relatedOperations, relatedCiEvidence, status, verificationStatus)

    return {
      id: `execution:${window.id}`,
      status,
      verificationStatus,
      title: window.title,
      windowKind: window.kind,
      windowStatus: window.status,
      scheduledStartAt: window.startAt,
      scheduledEndAt: window.endAt,
      severity: window.severity,
      workspaceName: window.workspaceName,
      workspaceRelativePath: window.workspaceRelativePath,
      managerId: window.managerId,
      managerName: window.managerName,
      owners: window.owners,
      approvalDecision,
      operationCount: relatedOperations.length,
      successfulOperationCount,
      failedOperationCount,
      ciEvidenceCount: relatedCiEvidence.length,
      latestCiStatus,
      relatedOperations,
      relatedCiEvidence,
      requiredActions: window.requiredActions,
      gaps,
      evidence: recordEvidence(window, relatedOperations, relatedCiEvidence),
      recommendation: recommendationFor(status, verificationStatus, gaps)
    }
  })
}

function operationMatchesWindow(root: string, record: OperationHistoryRecord, window: DependencyChangeCalendarWindow): boolean {
  const classification = record.classification
  if (!classification?.mutating) return false
  const managerMatches = classification.managerId === window.managerId || record.command.toLowerCase().includes(String(window.managerId).toLowerCase())
  const workspace = normalizePath(window.workspaceRelativePath || '.')
  const cwd = normalizePath(record.cwd)
  const rootPath = normalizePath(root)
  const workspacePath = workspace === '.' ? rootPath : normalizePath(join(root, workspace))
  const workspaceMatches = workspace === '.' || cwd === workspacePath || cwd.startsWith(`${workspacePath}/`) || record.command.includes(window.workspaceRelativePath)
  return managerMatches && workspaceMatches
}

function executionOperation(record: OperationHistoryRecord): DependencyChangeExecutionOperation {
  const classification = record.classification
  return {
    id: record.id,
    command: record.command,
    cwd: record.cwd,
    status: record.status,
    operation: classification?.operation || 'unknown',
    risk: classification?.risk || 'unknown',
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    durationMs: record.durationMs,
    summary: record.summary || record.error
  }
}

function executionCiEvidence(record: CiEvidenceRecord): DependencyChangeExecutionCiEvidence {
  return {
    id: record.id,
    status: record.status,
    provider: record.provider,
    workflow: record.workflow,
    job: record.job,
    branch: record.branch,
    commit: record.commit,
    url: record.url,
    finishedAt: record.finishedAt,
    summary: record.summary
  }
}

function recordStatus(
  window: DependencyChangeCalendarWindow,
  verificationStatus: DependencyChangeExecutionVerificationStatus,
  successfulOperationCount: number,
  failedOperationCount: number
): DependencyChangeExecutionRecordStatus {
  if (window.status === 'blocked' || window.status === 'frozen') return 'blocked'
  if (!window.startAt) return 'unscheduled'
  if (failedOperationCount > 0 || verificationStatus === 'failed') return 'failed'
  if (successfulOperationCount > 0 && verificationStatus === 'passed') return 'completed'
  return 'pending'
}

function verificationStatusFor(
  window: DependencyChangeCalendarWindow,
  ciRecords: DependencyChangeExecutionCiEvidence[],
  failedOperationCount: number
): DependencyChangeExecutionVerificationStatus {
  if (failedOperationCount > 0) return 'failed'
  if (ciRecords.some((record) => record.status === 'failed' || record.status === 'cancelled')) return 'failed'
  if (ciRecords.some((record) => record.status === 'success')) return 'passed'
  if (window.verificationCommandCount > 0) return 'missing'
  return 'pending'
}

function recordGaps(
  window: DependencyChangeCalendarWindow,
  operations: DependencyChangeExecutionOperation[],
  ciRecords: DependencyChangeExecutionCiEvidence[],
  status: DependencyChangeExecutionRecordStatus,
  verificationStatus: DependencyChangeExecutionVerificationStatus
): string[] {
  return unique([
    status === 'blocked' ? 'Change window is blocked or frozen.' : undefined,
    !window.startAt ? 'No scheduled execution window was assigned.' : undefined,
    operations.length === 0 ? 'No matching mutating operation history was found for this manager/workspace.' : undefined,
    operations.some((record) => record.status === 'error') ? 'At least one matching operation failed.' : undefined,
    ciRecords.length === 0 ? 'No CI evidence is attached to this dependency change.' : undefined,
    verificationStatus === 'failed' ? 'Verification evidence failed or was cancelled.' : undefined,
    verificationStatus === 'missing' ? 'Verification commands exist but no successful CI evidence was found.' : undefined,
    window.owners.length === 0 ? 'No dependency owner is assigned.' : undefined
  ].filter(Boolean) as string[])
}

function recordEvidence(
  window: DependencyChangeCalendarWindow,
  operations: DependencyChangeExecutionOperation[],
  ciRecords: DependencyChangeExecutionCiEvidence[]
): string[] {
  return [
    `Calendar window status: ${window.status}`,
    `Calendar window kind: ${window.kind}`,
    `Severity: ${window.severity}`,
    `Required actions: ${window.requiredActions.length}`,
    `Matched operations: ${operations.length}`,
    `Successful operations: ${operations.filter((record) => record.status === 'success').length}`,
    `Failed operations: ${operations.filter((record) => record.status === 'error').length}`,
    `CI evidence records: ${ciRecords.length}`,
    `Latest CI status: ${ciRecords[0]?.status || 'missing'}`
  ]
}

function recommendationFor(
  status: DependencyChangeExecutionRecordStatus,
  verificationStatus: DependencyChangeExecutionVerificationStatus,
  gaps: string[]
): string {
  if (status === 'completed') return 'Attach this execution record to the dependency change ticket and close the scheduled change.'
  if (status === 'failed') return 'Stop further rollout, attach failed operation/CI evidence, and use the dependency rollback plan.'
  if (status === 'blocked') return 'Do not execute this dependency change until freeze and approval blockers are cleared.'
  if (verificationStatus === 'missing') return 'Run the listed verification commands or import CI evidence before sign-off.'
  if (gaps.length > 0) return 'Collect the missing execution evidence before marking the dependency change complete.'
  return 'Keep this dependency change open until operation and verification evidence is available.'
}

function summarize(
  records: DependencyChangeExecutionRecordItem[],
  calendar: DependencyChangeCalendarReport | undefined,
  approval: DependencyChangeApprovalPacketReport | undefined,
  operations: OperationHistoryRecord[],
  ciRecords: CiEvidenceRecord[],
  errors: Partial<Record<DependencyChangeExecutionSource, string>>
): DependencyChangeExecutionSummary {
  const failedRecordCount = records.filter((record) => record.status === 'failed').length
  const blockedRecordCount = records.filter((record) => record.status === 'blocked').length
  const pendingRecordCount = records.filter((record) => record.status === 'pending').length
  const unscheduledRecordCount = records.filter((record) => record.status === 'unscheduled').length
  const failedOperationCount = records.reduce((total, record) => total + record.failedOperationCount, 0)
  const missingOperationEvidenceCount = records.filter((record) => record.operationCount === 0).length
  const missingCiEvidenceCount = records.filter((record) => record.ciEvidenceCount === 0 || record.verificationStatus === 'missing').length
  const status: DependencyChangeExecutionStatus = failedRecordCount > 0 || blockedRecordCount > 0 || failedOperationCount > 0 || Object.keys(errors).length > 0
    ? 'blocked'
    : pendingRecordCount > 0 || unscheduledRecordCount > 0 || missingOperationEvidenceCount > 0 || missingCiEvidenceCount > 0
      ? 'warning'
      : 'ready'

  return {
    status,
    recordCount: records.length,
    completedRecordCount: records.filter((record) => record.status === 'completed').length,
    pendingRecordCount,
    failedRecordCount,
    blockedRecordCount,
    unscheduledRecordCount,
    operationCount: records.reduce((total, record) => total + record.operationCount, 0),
    successfulOperationCount: records.reduce((total, record) => total + record.successfulOperationCount, 0),
    failedOperationCount,
    ciEvidenceCount: ciRecords.length,
    ciSuccessRecordCount: ciRecords.filter((record) => record.status === 'success').length,
    ciFailedRecordCount: ciRecords.filter((record) => record.status === 'failed' || record.status === 'cancelled').length,
    missingOperationEvidenceCount,
    missingCiEvidenceCount,
    approvalBlockedCount: approval?.decision === 'blocked' ? 1 : 0,
    freezeBlockedCount: calendar?.summary.blockedFreezeWindowCount || 0,
    verificationPassedCount: records.filter((record) => record.verificationStatus === 'passed').length,
    verificationFailedCount: records.filter((record) => record.verificationStatus === 'failed').length,
    sourceErrorCount: Object.keys(errors).length
  }
}

function renderMarkdown(report: DependencyChangeExecutionReport): string {
  const lines = [
    '# Dependency Change Execution Record',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Execution records: ${report.summary.recordCount}`,
    `- Completed / pending / failed / blocked / unscheduled: ${report.summary.completedRecordCount}/${report.summary.pendingRecordCount}/${report.summary.failedRecordCount}/${report.summary.blockedRecordCount}/${report.summary.unscheduledRecordCount}`,
    `- Matched operations: ${report.summary.operationCount}`,
    `- Successful / failed operations: ${report.summary.successfulOperationCount}/${report.summary.failedOperationCount}`,
    `- CI evidence records: ${report.summary.ciEvidenceCount}`,
    `- CI success / failed: ${report.summary.ciSuccessRecordCount}/${report.summary.ciFailedRecordCount}`,
    `- Missing operation evidence: ${report.summary.missingOperationEvidenceCount}`,
    `- Missing CI evidence: ${report.summary.missingCiEvidenceCount}`,
    `- Freeze blockers: ${report.summary.freezeBlockedCount}`,
    '',
    '## Execution Records',
    '',
    '| Status | Verify | Window | Workspace | Manager | Owners | Ops | CI | Recommendation |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: | --- |'
  ]

  for (const record of report.records) {
    lines.push([
      record.status,
      record.verificationStatus,
      record.windowKind,
      markdownCell(record.workspaceRelativePath || '.'),
      record.managerId,
      markdownCell(record.owners.join(', ') || 'missing'),
      record.operationCount,
      record.ciEvidenceCount,
      markdownCell(record.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Evidence Gaps', '')
  const recordsWithGaps = report.records.filter((record) => record.gaps.length > 0)
  if (recordsWithGaps.length === 0) {
    lines.push('- No execution evidence gaps.')
  } else {
    for (const record of recordsWithGaps) {
      lines.push(`- ${record.managerId} / ${record.workspaceRelativePath || '.'}: ${record.gaps.join('; ')}`)
    }
  }

  lines.push('', '## Source Errors', '')
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
  report: DependencyChangeExecutionReport
): DependencyChangeExecutionExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    recordCount: report.summary.recordCount,
    summary: report.summary
  }
}

function sourceErrors(
  calendarResult: CaptureResult<DependencyChangeCalendarReport>,
  approvalResult: CaptureResult<DependencyChangeApprovalPacketReport>,
  ciResult: CaptureResult<CiEvidenceReport>,
  operationResult: CaptureResult<OperationHistoryRecord[]>
): Partial<Record<DependencyChangeExecutionSource, string>> {
  return {
    ...(calendarResult.error ? { 'dependency-change-calendar': calendarResult.error } : {}),
    ...(approvalResult.error ? { 'dependency-change-approval-packet': approvalResult.error } : {}),
    ...(ciResult.error ? { 'ci-evidence': ciResult.error } : {}),
    ...(operationResult.error ? { 'operation-history': operationResult.error } : {})
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
