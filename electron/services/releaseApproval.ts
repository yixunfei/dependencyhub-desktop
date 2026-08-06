import { mkdir, readFile, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import { dirname, join, resolve } from 'path'

export type ReleaseApprovalDecision = 'approved' | 'rejected' | 'revoked'
export type ReleaseApprovalScope = 'release' | 'dependency-change' | 'policy-exception' | 'publish'
export type ReleaseApprovalExportFormat = 'markdown' | 'json'

export interface ReleaseApprovalInput {
  reviewer: string
  decision: ReleaseApprovalDecision
  scope?: ReleaseApprovalScope
  summary?: string
  ticket?: string
  url?: string
  decidedAt?: string
  expiresAt?: string
  annotations?: string[]
}

export interface ReleaseApprovalRecord extends Required<Pick<ReleaseApprovalInput, 'reviewer' | 'decision' | 'scope'>> {
  id: string
  summary?: string
  ticket?: string
  url?: string
  decidedAt: string
  expiresAt?: string
  importedAt: string
  annotations: string[]
}

export interface ReleaseApprovalSummary {
  total: number
  approved: number
  rejected: number
  revoked: number
  latest?: ReleaseApprovalRecord
  latestApproved?: ReleaseApprovalRecord
  latestRejected?: ReleaseApprovalRecord
}

export interface ReleaseApprovalReport {
  generatedAt: string
  projectPath: string
  records: ReleaseApprovalRecord[]
  summary: ReleaseApprovalSummary
}

export interface ReleaseApprovalExportResult {
  path: string
  format: ReleaseApprovalExportFormat
  generatedAt: string
  count: number
  summary: ReleaseApprovalSummary
}

const APPROVAL_FILE = '.npmDesktopManager/approvals/release-approvals.json'
const REPORT_DIR = '.npmDesktopManager/reports'

export class ReleaseApprovalService {
  async report(cwd: string): Promise<ReleaseApprovalReport> {
    const records = await this.list(cwd, 200)
    return {
      generatedAt: new Date().toISOString(),
      projectPath: resolve(cwd),
      records,
      summary: summarize(records)
    }
  }

  async list(cwd: string, limit = 50): Promise<ReleaseApprovalRecord[]> {
    if (!cwd) return []
    try {
      const content = await readFile(approvalPath(cwd), 'utf-8')
      const parsed = JSON.parse(content)
      const records = Array.isArray(parsed?.records) ? parsed.records : Array.isArray(parsed) ? parsed : []
      return records
        .map((record) => normalizeRecord(record))
        .filter((record): record is ReleaseApprovalRecord => Boolean(record))
        .sort((a, b) => recordTime(b) - recordTime(a))
        .slice(0, Math.max(1, limit))
    } catch {
      return []
    }
  }

  async record(cwd: string, input: ReleaseApprovalInput): Promise<ReleaseApprovalRecord> {
    const existing = await this.list(cwd, 500)
    const record = normalizeInput(input)
    await writeRecords(cwd, upsertRecord(existing, record))
    return record
  }

  async exportMarkdown(cwd: string): Promise<ReleaseApprovalExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'release-approval-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      count: report.records.length,
      summary: report.summary
    }
  }

  async exportJson(cwd: string): Promise<ReleaseApprovalExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'release-approval-report.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      count: report.records.length,
      summary: report.summary
    }
  }
}

function normalizeInput(input: ReleaseApprovalInput): ReleaseApprovalRecord {
  const importedAt = new Date().toISOString()
  const decidedAt = validIso(input.decidedAt) || importedAt
  const record: Omit<ReleaseApprovalRecord, 'id'> = {
    reviewer: clean(input.reviewer) || 'unknown-reviewer',
    decision: normalizeDecision(input.decision),
    scope: normalizeScope(input.scope),
    summary: clean(input.summary),
    ticket: clean(input.ticket),
    url: clean(input.url),
    decidedAt,
    expiresAt: validIso(input.expiresAt),
    importedAt,
    annotations: uniqueStrings(input.annotations || [])
  }
  return {
    ...record,
    id: approvalId(record)
  }
}

function normalizeRecord(record: any): ReleaseApprovalRecord | null {
  if (!record || typeof record !== 'object') return null
  const normalized = normalizeInput({
    ...record,
    reviewer: record.reviewer || 'unknown-reviewer',
    decision: record.decision || 'approved'
  })
  return {
    ...normalized,
    id: clean(record.id) || normalized.id,
    importedAt: validIso(record.importedAt) || normalized.importedAt
  }
}

function summarize(records: ReleaseApprovalRecord[]): ReleaseApprovalSummary {
  const sorted = [...records].sort((a, b) => recordTime(b) - recordTime(a))
  return {
    total: sorted.length,
    approved: sorted.filter((record) => record.decision === 'approved').length,
    rejected: sorted.filter((record) => record.decision === 'rejected').length,
    revoked: sorted.filter((record) => record.decision === 'revoked').length,
    latest: sorted[0],
    latestApproved: sorted.find((record) => record.decision === 'approved'),
    latestRejected: sorted.find((record) => record.decision === 'rejected')
  }
}

function renderMarkdown(report: ReleaseApprovalReport): string {
  const lines = [
    '# Release Approval Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Summary',
    '',
    `- Records: ${report.summary.total}`,
    `- Approved: ${report.summary.approved}`,
    `- Rejected: ${report.summary.rejected}`,
    `- Revoked: ${report.summary.revoked}`,
    `- Latest: ${formatApproval(report.summary.latest)}`,
    '',
    '## Records',
    '',
    '| Decision | Reviewer | Scope | Decided | Expires | Summary |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.records.map((record) => [
      record.decision,
      escapeMarkdownTable(record.reviewer),
      record.scope,
      record.decidedAt,
      record.expiresAt || '-',
      escapeMarkdownTable(record.summary || record.ticket || '-')
    ].join(' | ')).map((row) => `| ${row} |`)
  ]
  return lines.join('\n')
}

async function writeRecords(cwd: string, records: ReleaseApprovalRecord[]): Promise<void> {
  const path = approvalPath(cwd)
  await mkdir(dirname(path), { recursive: true })
  const sorted = [...records].sort((a, b) => recordTime(b) - recordTime(a)).slice(0, 500)
  await writeFile(path, JSON.stringify({ records: sorted }, null, 2), 'utf-8')
}

function upsertRecord(records: ReleaseApprovalRecord[], record: ReleaseApprovalRecord): ReleaseApprovalRecord[] {
  const withoutExisting = records.filter((item) => item.id !== record.id)
  return [record, ...withoutExisting]
}

function approvalPath(cwd: string): string {
  return join(resolve(cwd), APPROVAL_FILE)
}

function approvalId(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

function recordTime(record: ReleaseApprovalRecord): number {
  return Date.parse(record.decidedAt || record.importedAt) || 0
}

function normalizeDecision(value: unknown): ReleaseApprovalDecision {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'rejected') return 'rejected'
  if (normalized === 'revoked') return 'revoked'
  return 'approved'
}

function normalizeScope(value: unknown): ReleaseApprovalScope {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'dependency-change' || normalized === 'policy-exception' || normalized === 'publish') return normalized
  return 'release'
}

function validIso(value: unknown): string | undefined {
  if (!value) return undefined
  const timestamp = Date.parse(String(value))
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

function clean(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text || undefined
}

function uniqueStrings(value: string[]): string[] {
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}

function formatApproval(record?: ReleaseApprovalRecord): string {
  if (!record) return '-'
  return `${record.decision} by ${record.reviewer} (${record.decidedAt})`
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
