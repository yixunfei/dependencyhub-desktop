import { mkdir, readFile, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import { basename, dirname, extname, join, resolve } from 'path'

export type CiEvidenceStatus = 'success' | 'failed' | 'cancelled' | 'unknown'
export type CiEvidenceSource = 'manual' | 'json' | 'junit' | 'github-actions' | 'generic'
export type CiEvidenceExportFormat = 'markdown' | 'json'

export interface CiEvidenceInput {
  source?: CiEvidenceSource
  provider?: string
  workflow?: string
  job?: string
  status: CiEvidenceStatus
  branch?: string
  commit?: string
  url?: string
  runId?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  totalTests?: number
  passedTests?: number
  failedTests?: number
  skippedTests?: number
  summary?: string
  annotations?: string[]
  rawFile?: string
}

export interface CiEvidenceRecord extends Required<Pick<CiEvidenceInput, 'source' | 'status'>> {
  id: string
  provider?: string
  workflow?: string
  job?: string
  branch?: string
  commit?: string
  url?: string
  runId?: string
  startedAt?: string
  finishedAt: string
  importedAt: string
  durationMs?: number
  totalTests?: number
  passedTests?: number
  failedTests?: number
  skippedTests?: number
  summary?: string
  annotations: string[]
  rawFile?: string
}

export interface CiEvidenceSummary {
  total: number
  success: number
  failed: number
  cancelled: number
  unknown: number
  latest?: CiEvidenceRecord
  latestSuccessful?: CiEvidenceRecord
  latestFailed?: CiEvidenceRecord
}

export interface CiEvidenceReport {
  generatedAt: string
  projectPath: string
  records: CiEvidenceRecord[]
  summary: CiEvidenceSummary
}

export interface CiEvidenceImportResult {
  path: string
  importedAt: string
  records: CiEvidenceRecord[]
  summary: CiEvidenceSummary
}

export interface CiEvidenceExportResult {
  path: string
  format: CiEvidenceExportFormat
  generatedAt: string
  count: number
  summary: CiEvidenceSummary
}

const CI_EVIDENCE_FILE = '.npmDesktopManager/ci/ci-evidence.json'
const REPORT_DIR = '.npmDesktopManager/reports'

export class CiEvidenceService {
  async report(cwd: string): Promise<CiEvidenceReport> {
    const records = await this.list(cwd, 200)
    return {
      generatedAt: new Date().toISOString(),
      projectPath: resolve(cwd),
      records,
      summary: summarize(records)
    }
  }

  async list(cwd: string, limit = 50): Promise<CiEvidenceRecord[]> {
    if (!cwd) return []
    try {
      const content = await readFile(evidencePath(cwd), 'utf-8')
      const parsed = JSON.parse(content)
      const records = Array.isArray(parsed?.records) ? parsed.records : Array.isArray(parsed) ? parsed : []
      return records
        .map((record) => normalizeRecord(record))
        .filter((record): record is CiEvidenceRecord => Boolean(record))
        .sort((a, b) => recordTime(b) - recordTime(a))
        .slice(0, Math.max(1, limit))
    } catch {
      return []
    }
  }

  async record(cwd: string, input: CiEvidenceInput): Promise<CiEvidenceRecord> {
    const existing = await this.list(cwd, 500)
    const record = normalizeInput(input)
    await writeRecords(cwd, upsertRecord(existing, record))
    return record
  }

  async importFromFile(cwd: string, filePath: string, overrides: Partial<CiEvidenceInput> = {}): Promise<CiEvidenceImportResult> {
    if (!filePath?.trim()) {
      throw new Error('CI evidence file path is required')
    }

    const absolutePath = resolve(filePath)
    const content = await readFile(absolutePath, 'utf-8')
    const records = parseEvidenceFile(absolutePath, content, overrides)
    const existing = await this.list(cwd, 500)
    await writeRecords(cwd, records.reduce((all, record) => upsertRecord(all, record), existing))
    return {
      path: absolutePath,
      importedAt: new Date().toISOString(),
      records,
      summary: summarize(records)
    }
  }

  async exportMarkdown(cwd: string): Promise<CiEvidenceExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'ci-evidence-report.md')
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

  async exportJson(cwd: string): Promise<CiEvidenceExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'ci-evidence-report.json')
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

function parseEvidenceFile(path: string, content: string, overrides: Partial<CiEvidenceInput>): CiEvidenceRecord[] {
  const extension = extname(path).toLowerCase()
  if (extension === '.xml' || /^\s*</.test(content)) {
    return [parseJUnitEvidence(path, content, overrides)]
  }

  const parsed = JSON.parse(content)
  const inputs = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.records)
      ? parsed.records
      : Array.isArray(parsed?.workflow_runs)
        ? parsed.workflow_runs
        : [parsed]

  return inputs.map((item) => normalizeInput(jsonEvidenceInput(path, item, overrides)))
}

function jsonEvidenceInput(path: string, item: any, overrides: Partial<CiEvidenceInput>): CiEvidenceInput {
  const status = normalizeStatus(
    overrides.status ||
    item?.status ||
    item?.conclusion ||
    item?.result ||
    item?.outcome
  )
  const source = overrides.source || detectJsonSource(item)
  const summary = item?.summary || item?.message || item?.name || item?.display_title
  return {
    source,
    provider: overrides.provider || item?.provider || source,
    workflow: overrides.workflow || item?.workflow || item?.workflowName || item?.name,
    job: overrides.job || item?.job || item?.jobName,
    status,
    branch: overrides.branch || item?.branch || item?.head_branch,
    commit: overrides.commit || item?.commit || item?.head_sha || item?.sha,
    url: overrides.url || item?.url || item?.html_url,
    runId: overrides.runId || String(item?.runId || item?.run_id || item?.id || ''),
    startedAt: overrides.startedAt || item?.startedAt || item?.run_started_at || item?.created_at,
    finishedAt: overrides.finishedAt || item?.finishedAt || item?.completed_at || item?.updated_at,
    durationMs: numberValue(overrides.durationMs ?? item?.durationMs),
    totalTests: numberValue(overrides.totalTests ?? item?.totalTests ?? item?.tests),
    passedTests: numberValue(overrides.passedTests ?? item?.passedTests ?? item?.passed),
    failedTests: numberValue(overrides.failedTests ?? item?.failedTests ?? item?.failures),
    skippedTests: numberValue(overrides.skippedTests ?? item?.skippedTests ?? item?.skipped),
    summary: overrides.summary || summary,
    annotations: uniqueStrings([...(arrayValue(item?.annotations)), ...(arrayValue(overrides.annotations))]),
    rawFile: path
  }
}

function parseJUnitEvidence(path: string, content: string, overrides: Partial<CiEvidenceInput>): CiEvidenceRecord {
  const suiteTags = Array.from(content.matchAll(/<testsuite\b[^>]*>/gi)).map((match) => match[0])
  const tags = suiteTags.length > 0
    ? suiteTags
    : Array.from(content.matchAll(/<testsuites\b[^>]*>/gi)).map((match) => match[0])
  const totals = tags.reduce((acc, tag) => {
    const attributes = extractAttributes(tag)
    acc.tests += integerValue(attributes.tests)
    acc.failures += integerValue(attributes.failures)
    acc.errors += integerValue(attributes.errors)
    acc.skipped += integerValue(attributes.skipped)
    acc.time += numberValue(attributes.time) || 0
    return acc
  }, { tests: 0, failures: 0, errors: 0, skipped: 0, time: 0 })
  const failed = totals.failures + totals.errors
  const status = normalizeStatus(overrides.status || (failed > 0 ? 'failed' : 'success'))
  const workflow = overrides.workflow || basename(path)
  const annotations = [
    failed > 0 ? `${failed} failed/error test case(s)` : '',
    totals.skipped > 0 ? `${totals.skipped} skipped test case(s)` : '',
    ...arrayValue(overrides.annotations)
  ].filter(Boolean)

  return normalizeInput({
    source: overrides.source || 'junit',
    provider: overrides.provider || 'junit',
    workflow,
    job: overrides.job,
    status,
    branch: overrides.branch,
    commit: overrides.commit,
    url: overrides.url,
    runId: overrides.runId,
    startedAt: overrides.startedAt,
    finishedAt: overrides.finishedAt || new Date().toISOString(),
    durationMs: overrides.durationMs ?? (totals.time > 0 ? Math.round(totals.time * 1000) : undefined),
    totalTests: overrides.totalTests ?? totals.tests,
    passedTests: overrides.passedTests ?? Math.max(0, totals.tests - failed - totals.skipped),
    failedTests: overrides.failedTests ?? failed,
    skippedTests: overrides.skippedTests ?? totals.skipped,
    summary: overrides.summary || `${workflow}: ${totals.tests} tests, ${failed} failed, ${totals.skipped} skipped`,
    annotations,
    rawFile: path
  })
}

function normalizeInput(input: CiEvidenceInput): CiEvidenceRecord {
  const importedAt = new Date().toISOString()
  const finishedAt = validIso(input.finishedAt) || importedAt
  const record: Omit<CiEvidenceRecord, 'id'> = {
    source: input.source || 'manual',
    provider: clean(input.provider),
    workflow: clean(input.workflow),
    job: clean(input.job),
    status: normalizeStatus(input.status),
    branch: clean(input.branch),
    commit: clean(input.commit),
    url: clean(input.url),
    runId: clean(input.runId),
    startedAt: validIso(input.startedAt),
    finishedAt,
    importedAt,
    durationMs: numberValue(input.durationMs),
    totalTests: numberValue(input.totalTests),
    passedTests: numberValue(input.passedTests),
    failedTests: numberValue(input.failedTests),
    skippedTests: numberValue(input.skippedTests),
    summary: clean(input.summary),
    annotations: uniqueStrings(input.annotations || []),
    rawFile: clean(input.rawFile)
  }
  return {
    ...record,
    id: evidenceId(record)
  }
}

function normalizeRecord(record: any): CiEvidenceRecord | null {
  if (!record || typeof record !== 'object') return null
  return {
    ...normalizeInput({
      ...record,
      source: record.source,
      status: record.status || 'unknown'
    }),
    id: clean(record.id) || evidenceId(record),
    importedAt: validIso(record.importedAt) || new Date().toISOString()
  }
}

function summarize(records: CiEvidenceRecord[]): CiEvidenceSummary {
  const sorted = [...records].sort((a, b) => recordTime(b) - recordTime(a))
  return {
    total: sorted.length,
    success: sorted.filter((record) => record.status === 'success').length,
    failed: sorted.filter((record) => record.status === 'failed').length,
    cancelled: sorted.filter((record) => record.status === 'cancelled').length,
    unknown: sorted.filter((record) => record.status === 'unknown').length,
    latest: sorted[0],
    latestSuccessful: sorted.find((record) => record.status === 'success'),
    latestFailed: sorted.find((record) => record.status === 'failed')
  }
}

function renderMarkdown(report: CiEvidenceReport): string {
  const lines = [
    '# CI Evidence Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Summary',
    '',
    `- Records: ${report.summary.total}`,
    `- Success: ${report.summary.success}`,
    `- Failed: ${report.summary.failed}`,
    `- Cancelled: ${report.summary.cancelled}`,
    `- Unknown: ${report.summary.unknown}`,
    `- Latest: ${formatRecordTitle(report.summary.latest)}`,
    '',
    '## Records',
    '',
    '| Status | Workflow | Job | Finished | Tests | Summary |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.records.map((record) => [
      record.status,
      escapeMarkdownTable(record.workflow || '-'),
      escapeMarkdownTable(record.job || '-'),
      record.finishedAt,
      formatTests(record),
      escapeMarkdownTable(record.summary || '-')
    ].join(' | ')).map((row) => `| ${row} |`)
  ]
  return lines.join('\n')
}

async function writeRecords(cwd: string, records: CiEvidenceRecord[]): Promise<void> {
  const path = evidencePath(cwd)
  await mkdir(dirname(path), { recursive: true })
  const sorted = [...records].sort((a, b) => recordTime(b) - recordTime(a)).slice(0, 500)
  await writeFile(path, JSON.stringify({ records: sorted }, null, 2), 'utf-8')
}

function upsertRecord(records: CiEvidenceRecord[], record: CiEvidenceRecord): CiEvidenceRecord[] {
  const withoutExisting = records.filter((item) => item.id !== record.id)
  return [record, ...withoutExisting]
}

function evidencePath(cwd: string): string {
  return join(resolve(cwd), CI_EVIDENCE_FILE)
}

function evidenceId(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

function recordTime(record: CiEvidenceRecord): number {
  return Date.parse(record.finishedAt || record.importedAt) || 0
}

function detectJsonSource(item: any): CiEvidenceSource {
  if (item?.workflow_id || item?.head_sha || item?.html_url) return 'github-actions'
  return 'json'
}

function normalizeStatus(value: unknown): CiEvidenceStatus {
  const normalized = String(value || '').trim().toLowerCase()
  if (['success', 'successful', 'passed', 'pass', 'ok', 'completed'].includes(normalized)) return 'success'
  if (['failed', 'failure', 'error', 'timed_out', 'action_required'].includes(normalized)) return 'failed'
  if (['cancelled', 'canceled', 'skipped', 'neutral'].includes(normalized)) return 'cancelled'
  return 'unknown'
}

function extractAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attributes[match[1]] = match[3]
  }
  return attributes
}

function integerValue(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0
}

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined
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

function arrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function uniqueStrings(value: string[]): string[] {
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}

function formatRecordTitle(record?: CiEvidenceRecord): string {
  if (!record) return '-'
  return `${record.status} ${record.workflow || record.provider || record.id} (${record.finishedAt})`
}

function formatTests(record: CiEvidenceRecord): string {
  if (record.totalTests === undefined) return '-'
  return `${record.passedTests ?? '-'} passed / ${record.failedTests ?? 0} failed / ${record.totalTests} total`
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
