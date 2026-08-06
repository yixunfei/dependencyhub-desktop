import { createHash } from 'crypto'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'path'

export type ReportArtifactCategory =
  | 'inventory'
  | 'workspace'
  | 'release'
  | 'risk'
  | 'evidence'
  | 'automation'
  | 'policy'
  | 'security'
  | 'reproducibility'
  | 'operations'
  | 'other'
export type ReportArtifactFormat =
  | 'markdown'
  | 'json'
  | 'html'
  | 'yaml'
  | 'text'
  | 'calendar'
  | 'codeowners'
  | 'sbom'
  | 'unknown'

export interface ReportArtifactRecord {
  id: string
  name: string
  category: ReportArtifactCategory
  format: ReportArtifactFormat
  path: string
  relativePath: string
  sizeBytes: number
  sha256: string
  modifiedAt: string
}

export interface ReportArtifactIndexSummary {
  artifactCount: number
  totalSizeBytes: number
  latestModifiedAt?: string
  categoryCounts: Record<ReportArtifactCategory, number>
  formatCounts: Record<ReportArtifactFormat, number>
}

export interface ReportArtifactIndexReport {
  generatedAt: string
  projectPath: string
  reportDir: string
  artifacts: ReportArtifactRecord[]
  summary: ReportArtifactIndexSummary
}

export interface ReportArtifactIndexExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  artifactCount: number
  totalSizeBytes: number
  summary: ReportArtifactIndexSummary
}

const REPORT_DIR = '.npmDesktopManager/reports'
const CATEGORY_ORDER: ReportArtifactCategory[] = [
  'inventory',
  'workspace',
  'release',
  'risk',
  'evidence',
  'automation',
  'policy',
  'security',
  'reproducibility',
  'operations',
  'other'
]
const FORMAT_ORDER: ReportArtifactFormat[] = [
  'markdown',
  'json',
  'html',
  'yaml',
  'text',
  'calendar',
  'codeowners',
  'sbom',
  'unknown'
]

export class ReportArtifactIndexService {
  async report(projectPath: string): Promise<ReportArtifactIndexReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const reportDir = join(root, REPORT_DIR)
    const artifacts = await exists(reportDir)
      ? await scanReportArtifacts(root, reportDir)
      : []

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      reportDir,
      artifacts,
      summary: summarizeArtifacts(artifacts)
    }
  }

  async exportMarkdown(projectPath: string): Promise<ReportArtifactIndexExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'report-artifact-index.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      artifactCount: report.summary.artifactCount,
      totalSizeBytes: report.summary.totalSizeBytes,
      summary: report.summary
    }
  }

  async exportJson(projectPath: string): Promise<ReportArtifactIndexExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'report-artifact-index.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      artifactCount: report.summary.artifactCount,
      totalSizeBytes: report.summary.totalSizeBytes,
      summary: report.summary
    }
  }
}

async function scanReportArtifacts(root: string, reportDir: string): Promise<ReportArtifactRecord[]> {
  const files = await walkFiles(reportDir)
  const artifacts = await Promise.all(files.map((file) => artifactRecord(root, file)))
  return artifacts.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt) || a.relativePath.localeCompare(b.relativePath))
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const groups = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) return []
    if (entry.isDirectory()) return await walkFiles(path)
    if (entry.isFile()) return [path]
    return []
  }))
  return groups.flat()
}

async function artifactRecord(root: string, path: string): Promise<ReportArtifactRecord> {
  const [metadata, content] = await Promise.all([
    stat(path),
    readFile(path)
  ])
  const relativePath = normalizePath(relative(root, path))
  const reportRelativePath = normalizePath(relative(join(root, REPORT_DIR), path))
  return {
    id: createHash('sha1').update(relativePath).digest('hex').slice(0, 16),
    name: artifactName(reportRelativePath),
    category: classifyArtifact(reportRelativePath),
    format: artifactFormat(reportRelativePath),
    path,
    relativePath,
    sizeBytes: metadata.size,
    sha256: createHash('sha256').update(content).digest('hex'),
    modifiedAt: metadata.mtime.toISOString()
  }
}

function summarizeArtifacts(artifacts: ReportArtifactRecord[]): ReportArtifactIndexSummary {
  const categoryCounts = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<ReportArtifactCategory, number>
  const formatCounts = Object.fromEntries(FORMAT_ORDER.map((format) => [format, 0])) as Record<ReportArtifactFormat, number>
  let totalSizeBytes = 0
  let latestModifiedAt: string | undefined

  for (const artifact of artifacts) {
    categoryCounts[artifact.category] += 1
    formatCounts[artifact.format] += 1
    totalSizeBytes += artifact.sizeBytes
    if (!latestModifiedAt || Date.parse(artifact.modifiedAt) > Date.parse(latestModifiedAt)) {
      latestModifiedAt = artifact.modifiedAt
    }
  }

  return {
    artifactCount: artifacts.length,
    totalSizeBytes,
    latestModifiedAt,
    categoryCounts,
    formatCounts
  }
}

function classifyArtifact(path: string): ReportArtifactCategory {
  const value = path.toLowerCase()
  if (value.includes('workspace-sboms') || value.startsWith('workspace-')) return 'workspace'
  if (value.includes('framework-coverage')) return 'inventory'
  if (value.includes('release-bundle') || value.includes('release-dashboard') || value.includes('release-approval') || value.includes('release-exception') || value.includes('release-provenance') || value.includes('release-integrity-verification') || value.includes('release-signature') || value.includes('release-trust-policy')) return 'release'
  if (value.includes('vulnerability-remediation')) return 'security'
  if (value.includes('dependency-impact-analysis')) return 'risk'
  if (value.includes('dependency-change-approval-packet')) return 'policy'
  if (value.includes('dependency-change-execution-record')) return 'operations'
  if (value.includes('dependency-change-calendar')) return 'operations'
  if (value.includes('dependency-change-freeze-gate') || value.includes('dependency-change-ticket')) return 'operations'
  if (value.includes('release-risk') || value.includes('dependency-diff') || value.includes('remediation')) return 'risk'
  if (value.includes('audit-evidence') || value.includes('ci-evidence') || value.includes('operation-history')) return 'evidence'
  if (value.includes('dependency-rollback-plan')) return 'operations'
  if (value.includes('ci-integration') || value.includes('dependency-automation') || value.includes('dependency-upgrade-playbook') || value.includes('automation-safety') || value.includes('dependency-ownership') || value.includes('codeowners')) return 'automation'
  if (value.includes('policy') || value.includes('license') || value.includes('third-party-notices') || value.includes('notices')) return 'policy'
  if (value.includes('registry') || value.includes('credential')) return 'security'
  if (value.includes('lockfile') || value.includes('runtime-pinning') || value.includes('offline-cache') || value.includes('snapshot')) return 'reproducibility'
  if (value.includes('operation')) return 'operations'
  if (value.includes('cyclonedx') || value.includes('spdx') || value.includes('sbom') || value.includes('supply-chain')) return 'inventory'
  return 'other'
}

function artifactFormat(path: string): ReportArtifactFormat {
  const value = path.toLowerCase()
  if (value.endsWith('codeowners.suggested')) return 'codeowners'
  if (value.endsWith('.cdx.json') || value.endsWith('.spdx.json')) return 'sbom'
  const extension = extname(value)
  if (extension === '.md') return 'markdown'
  if (extension === '.json') return 'json'
  if (extension === '.html' || extension === '.htm') return 'html'
  if (extension === '.yml' || extension === '.yaml') return 'yaml'
  if (extension === '.ics') return 'calendar'
  if (extension === '.txt' || extension === '.log') return 'text'
  return 'unknown'
}

function artifactName(path: string): string {
  const fileName = basename(path)
  return fileName
    .replace(/\.(cdx|spdx)\.json$/i, '')
    .replace(/\.(md|json|html|htm|yml|yaml|txt|log)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function renderMarkdown(report: ReportArtifactIndexReport): string {
  const lines = [
    '# Report Artifact Index',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Report directory: ${report.reportDir}`,
    '',
    '## Summary',
    '',
    `- Artifacts: ${report.summary.artifactCount}`,
    `- Total size: ${formatBytes(report.summary.totalSizeBytes)}`,
    `- Latest modified: ${report.summary.latestModifiedAt || '-'}`,
    '',
    '## Category Counts',
    '',
    '| Category | Count |',
    '| --- | ---: |',
    ...CATEGORY_ORDER.filter((category) => report.summary.categoryCounts[category] > 0)
      .map((category) => `| ${category} | ${report.summary.categoryCounts[category]} |`),
    '',
    '## Artifacts',
    '',
    '| Name | Category | Format | Size | SHA-256 | Modified | Path |',
    '| --- | --- | --- | ---: | --- | --- | --- |'
  ]

  for (const artifact of report.artifacts) {
    lines.push([
      markdownCell(artifact.name),
      artifact.category,
      artifact.format,
      formatBytes(artifact.sizeBytes),
      artifact.sha256.slice(0, 16),
      artifact.modifiedAt,
      markdownCell(artifact.relativePath)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  return `${lines.join('\n')}\n`
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
