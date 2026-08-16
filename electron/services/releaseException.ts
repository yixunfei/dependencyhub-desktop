import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

export type ReleaseExceptionDecision = 'approved' | 'revoked'
export type ReleaseExceptionScope = 'release' | 'dependency-change' | 'policy-exception' | 'publish'
export type ReleaseExceptionExportFormat = 'markdown' | 'json'

export interface ReleaseExceptionInput {
  reviewer: string
  reason: string
  scope?: ReleaseExceptionScope
  checkIds?: string[]
  ticket?: string
  url?: string
  decidedAt?: string
  expiresAt?: string
  annotations?: string[]
}

export interface ReleaseExceptionRecord extends Required<Pick<ReleaseExceptionInput, 'reviewer' | 'reason' | 'scope' | 'checkIds'>> {
  id: string
  decision: ReleaseExceptionDecision
  ticket?: string
  url?: string
  decidedAt: string
  expiresAt?: string
  importedAt: string
  annotations: string[]
}

export interface ReleaseExceptionSummary {
  total: number
  approved: number
  revoked: number
  active: number
  expired: number
  latest?: ReleaseExceptionRecord
  latestActive?: ReleaseExceptionRecord
}

export interface ReleaseExceptionReport {
  generatedAt: string
  projectPath: string
  records: ReleaseExceptionRecord[]
  summary: ReleaseExceptionSummary
}

export interface ReleaseExceptionExportResult {
  path: string
  format: ReleaseExceptionExportFormat
  generatedAt: string
  count: number
  summary: ReleaseExceptionSummary
}

const EXCEPTION_FILE = '.npmDesktopManager/exceptions/release-exceptions.json'
const REPORT_DIR = '.npmDesktopManager/reports'

export class ReleaseExceptionService {
  async report(cwd: string): Promise<ReleaseExceptionReport> {
    const records = await this.list(cwd, 200)
    return {
      generatedAt: new Date().toISOString(),
      projectPath: resolve(cwd),
      records,
      summary: summarize(records, new Date())
    }
  }

  async list(cwd: string, limit = 50): Promise<ReleaseExceptionRecord[]> {
    if (!cwd) return []
    try {
      const content = await readFile(exceptionPath(cwd), 'utf-8')
      const parsed = JSON.parse(content)
      const records: unknown[] = Array.isArray(parsed?.records) ? parsed.records : Array.isArray(parsed) ? parsed : []
      return records
        .map((record) => normalizeRecord(record))
        .filter((record): record is ReleaseExceptionRecord => Boolean(record))
        .sort((a, b) => recordTime(b) - recordTime(a))
        .slice(0, Math.max(1, limit))
    } catch {
      return []
    }
  }

  async record(cwd: string, input: ReleaseExceptionInput): Promise<ReleaseExceptionRecord> {
    const existing = await this.list(cwd, 500)
    const record = normalizeInput(input)
    await writeRecords(cwd, upsertRecord(existing, record))
    return record
  }

  async revoke(cwd: string, id: string, input: Partial<Pick<ReleaseExceptionInput, 'reviewer' | 'reason' | 'annotations'>> = {}): Promise<ReleaseExceptionRecord> {
    const existing = await this.list(cwd, 500)
    const record = existing.find((item) => item.id === id)
    if (!record) {
      throw new Error(`Release exception was not found: ${id}`)
    }

    const revoked: ReleaseExceptionRecord = {
      ...record,
      reviewer: clean(input.reviewer) || record.reviewer,
      decision: 'revoked',
      reason: clean(input.reason) || record.reason,
      decidedAt: new Date().toISOString(),
      importedAt: new Date().toISOString(),
      annotations: uniqueStrings([
        ...record.annotations,
        ...uniqueStrings(input.annotations || [])
      ])
    }
    await writeRecords(cwd, upsertRecord(existing, revoked))
    return revoked
  }

  async exportMarkdown(cwd: string): Promise<ReleaseExceptionExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'release-exception-report.md')
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

  async exportJson(cwd: string): Promise<ReleaseExceptionExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'release-exception-report.json')
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

export function activeReleaseExceptions(records: ReleaseExceptionRecord[], now: Date): ReleaseExceptionRecord[] {
  return records.filter((record) => record.decision === 'approved' && !isExpired(record, now))
}

function normalizeInput(input: ReleaseExceptionInput): ReleaseExceptionRecord {
  const importedAt = new Date().toISOString()
  const decidedAt = validIso(input.decidedAt) || importedAt
  const checkIds = uniqueStrings(input.checkIds || []).length > 0
    ? uniqueStrings(input.checkIds || [])
    : ['*']
  const record: Omit<ReleaseExceptionRecord, 'id'> = {
    reviewer: clean(input.reviewer) || 'unknown-reviewer',
    decision: 'approved',
    reason: clean(input.reason) || 'Temporary release exception',
    scope: normalizeScope(input.scope),
    checkIds,
    ticket: clean(input.ticket),
    url: clean(input.url),
    decidedAt,
    expiresAt: validIso(input.expiresAt),
    importedAt,
    annotations: uniqueStrings(input.annotations || [])
  }
  return {
    ...record,
    id: exceptionId(record)
  }
}

function normalizeRecord(record: any): ReleaseExceptionRecord | null {
  if (!record || typeof record !== 'object') return null
  const normalized = normalizeInput({
    ...record,
    reviewer: record.reviewer || 'unknown-reviewer',
    reason: record.reason || record.summary || 'Temporary release exception'
  })
  return {
    ...normalized,
    id: clean(record.id) || normalized.id,
    decision: normalizeDecision(record.decision),
    importedAt: validIso(record.importedAt) || normalized.importedAt
  }
}

function summarize(records: ReleaseExceptionRecord[], now: Date): ReleaseExceptionSummary {
  const sorted = [...records].sort((a, b) => recordTime(b) - recordTime(a))
  const active = activeReleaseExceptions(sorted, now)
  return {
    total: sorted.length,
    approved: sorted.filter((record) => record.decision === 'approved').length,
    revoked: sorted.filter((record) => record.decision === 'revoked').length,
    active: active.length,
    expired: sorted.filter((record) => record.decision === 'approved' && isExpired(record, now)).length,
    latest: sorted[0],
    latestActive: active[0]
  }
}

function renderMarkdown(report: ReleaseExceptionReport): string {
  const lines = [
    '# Release Exception Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Summary',
    '',
    `- Records: ${report.summary.total}`,
    `- Approved: ${report.summary.approved}`,
    `- Active: ${report.summary.active}`,
    `- Expired: ${report.summary.expired}`,
    `- Revoked: ${report.summary.revoked}`,
    `- Latest active: ${formatException(report.summary.latestActive)}`,
    '',
    '## Records',
    '',
    '| Decision | Reviewer | Scope | Checks | Decided | Expires | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.records.map((record) => [
      record.decision,
      escapeMarkdownTable(record.reviewer),
      record.scope,
      escapeMarkdownTable(record.checkIds.join(', ')),
      record.decidedAt,
      record.expiresAt || '-',
      escapeMarkdownTable(record.reason || record.ticket || '-')
    ].join(' | ')).map((row) => `| ${row} |`)
  ]
  return `${lines.join('\n')}\n`
}

async function writeRecords(cwd: string, records: ReleaseExceptionRecord[]): Promise<void> {
  const path = exceptionPath(cwd)
  await mkdir(dirname(path), { recursive: true })
  const sorted = [...records].sort((a, b) => recordTime(b) - recordTime(a)).slice(0, 500)
  await writeFile(path, JSON.stringify({ records: sorted }, null, 2), 'utf-8')
}

function upsertRecord(records: ReleaseExceptionRecord[], record: ReleaseExceptionRecord): ReleaseExceptionRecord[] {
  const withoutExisting = records.filter((item) => item.id !== record.id)
  return [record, ...withoutExisting]
}

function exceptionPath(cwd: string): string {
  return join(resolve(cwd), EXCEPTION_FILE)
}

function exceptionId(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

function recordTime(record: ReleaseExceptionRecord): number {
  return Date.parse(record.decidedAt || record.importedAt) || 0
}

function isExpired(record: ReleaseExceptionRecord, now: Date): boolean {
  if (!record.expiresAt) return false
  const timestamp = Date.parse(record.expiresAt)
  return Number.isFinite(timestamp) && timestamp < now.getTime()
}

function normalizeDecision(value: unknown): ReleaseExceptionDecision {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'revoked' ? 'revoked' : 'approved'
}

function normalizeScope(value: unknown): ReleaseExceptionScope {
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

function formatException(record?: ReleaseExceptionRecord): string {
  if (!record) return '-'
  return `${record.reason} by ${record.reviewer} (${record.decidedAt})`
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
