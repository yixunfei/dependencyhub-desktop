import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'

export type AuditEvidenceTool =
  | 'npm-audit'
  | 'pip-audit'
  | 'osv'
  | 'sarif'
  | 'cargo-audit'
  | 'trivy'
  | 'govulncheck'
  | 'generic'
export type AuditEvidenceSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown'
export type AuditEvidenceExportFormat = 'markdown' | 'json' | 'html'

export interface AuditEvidenceImportOptions {
  tool?: AuditEvidenceTool
  managerId?: DependencyManagerId
  workspaceRelativePath?: string
  sourceName?: string
}

export interface AuditEvidenceSourceRecord {
  id: string
  tool: AuditEvidenceTool
  sourceName: string
  path: string
  importedAt: string
  contentHash: string
  findingCount: number
  managerIds: DependencyManagerId[]
  workspaceRelativePath?: string
}

export interface AuditEvidenceFinding {
  id: string
  tool: AuditEvidenceTool
  severity: AuditEvidenceSeverity
  vulnerabilityId?: string
  aliases: string[]
  packageName?: string
  installedVersion?: string
  fixedVersion?: string
  managerId?: DependencyManagerId
  workspaceRelativePath?: string
  title: string
  summary: string
  recommendation: string
  url?: string
  sourceFile?: string
  rawFile: string
  importedAt: string
  evidence: string[]
}

export interface AuditEvidenceSummary {
  sourceCount: number
  findingCount: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
  unknown: number
  affectedPackageCount: number
  fixAvailableCount: number
  managerCount: number
  managers: DependencyManagerId[]
  toolCount: number
  tools: AuditEvidenceTool[]
}

export interface AuditEvidenceReport {
  generatedAt: string
  projectPath: string
  sources: AuditEvidenceSourceRecord[]
  findings: AuditEvidenceFinding[]
  summary: AuditEvidenceSummary
}

export interface AuditEvidenceImportResult {
  path: string
  importedAt: string
  source: AuditEvidenceSourceRecord
  findings: AuditEvidenceFinding[]
  summary: AuditEvidenceSummary
}

export interface AuditEvidenceExportResult {
  path: string
  format: AuditEvidenceExportFormat
  generatedAt: string
  count: number
  summary: AuditEvidenceSummary
}

interface AuditEvidenceStore {
  sources: AuditEvidenceSourceRecord[]
  findings: AuditEvidenceFinding[]
}

interface ParsedAuditFile {
  tool: AuditEvidenceTool
  findings: Array<Omit<AuditEvidenceFinding, 'id' | 'tool' | 'rawFile' | 'importedAt'>>
}

const AUDIT_EVIDENCE_FILE = '.npmDesktopManager/audits/audit-evidence.json'
const REPORT_DIR = '.npmDesktopManager/reports'

export class AuditEvidenceService {
  async report(cwd: string): Promise<AuditEvidenceReport> {
    const store = await readStore(cwd)
    const findings = sortFindings(store.findings)
    const sources = [...store.sources].sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt))
    return {
      generatedAt: new Date().toISOString(),
      projectPath: resolve(cwd),
      sources,
      findings,
      summary: summarize(sources, findings)
    }
  }

  async importFromFile(cwd: string, filePath: string, options: AuditEvidenceImportOptions = {}): Promise<AuditEvidenceImportResult> {
    if (!filePath?.trim()) {
      throw new Error('Audit evidence file path is required')
    }

    const absolutePath = resolve(filePath)
    const content = await readFile(absolutePath, 'utf-8')
    const importedAt = new Date().toISOString()
    const contentHash = sha256(content)
    const parsed = parseAuditFile(absolutePath, content, options)
    const findings = parsed.findings.map((finding) => normalizeFinding({
      ...finding,
      tool: parsed.tool,
      rawFile: absolutePath,
      importedAt,
      managerId: finding.managerId || options.managerId,
      workspaceRelativePath: finding.workspaceRelativePath || options.workspaceRelativePath
    }))
    const source: AuditEvidenceSourceRecord = {
      id: sha1([parsed.tool, absolutePath, contentHash].join(':')),
      tool: parsed.tool,
      sourceName: options.sourceName || basename(absolutePath),
      path: absolutePath,
      importedAt,
      contentHash,
      findingCount: findings.length,
      managerIds: sortManagers(unique(findings.map((finding) => finding.managerId).filter(Boolean) as DependencyManagerId[])),
      workspaceRelativePath: options.workspaceRelativePath
    }
    const existing = await readStore(cwd)
    const nextStore: AuditEvidenceStore = {
      sources: [source, ...existing.sources.filter((item) => item.path !== absolutePath)].slice(0, 200),
      findings: uniqueBy([
        ...findings,
        ...existing.findings.filter((item) => item.rawFile !== absolutePath)
      ], (item) => item.id).slice(0, 2000)
    }
    await writeStore(cwd, nextStore)
    return {
      path: absolutePath,
      importedAt,
      source,
      findings,
      summary: summarize([source], findings)
    }
  }

  async exportMarkdown(cwd: string): Promise<AuditEvidenceExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'audit-evidence-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      count: report.findings.length,
      summary: report.summary
    }
  }

  async exportJson(cwd: string): Promise<AuditEvidenceExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'audit-evidence-report.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      count: report.findings.length,
      summary: report.summary
    }
  }

  async exportHtml(cwd: string): Promise<AuditEvidenceExportResult> {
    const report = await this.report(cwd)
    const path = join(resolve(cwd), REPORT_DIR, 'audit-evidence-dashboard.html')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderHtmlDashboard(report), 'utf-8')
    return {
      path,
      format: 'html',
      generatedAt: report.generatedAt,
      count: report.findings.length,
      summary: report.summary
    }
  }
}

function parseAuditFile(path: string, content: string, options: AuditEvidenceImportOptions): ParsedAuditFile {
  const parsed = parseJsonLenient(content)
  const tool = options.tool || detectTool(path, parsed, content)
  switch (tool) {
    case 'npm-audit':
      return { tool, findings: parseNpmAudit(parsed, options) }
    case 'pip-audit':
      return { tool, findings: parsePipAudit(parsed, options) }
    case 'osv':
      return { tool, findings: parseOsv(parsed, options) }
    case 'sarif':
      return { tool, findings: parseSarif(parsed, options) }
    case 'cargo-audit':
      return { tool, findings: parseCargoAudit(parsed, options) }
    case 'trivy':
      return { tool, findings: parseTrivy(parsed, options) }
    case 'govulncheck':
      return { tool, findings: parseGovulncheck(parsed, options) }
    default:
      return { tool, findings: parseGeneric(parsed, options) }
  }
}

function parseNpmAudit(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  if (parsed?.vulnerabilities && typeof parsed.vulnerabilities === 'object') {
    return Object.entries(parsed.vulnerabilities).map(([name, value]: [string, any]) => {
      const viaObjects = arrayValue(value?.via).filter((item) => item && typeof item === 'object')
      const primary = viaObjects[0] || {}
      const aliases = unique([
        ...viaObjects.map((item) => clean(item?.source || item?.id)).filter(Boolean),
        ...viaObjects.flatMap((item) => arrayValue(item?.cves))
      ])
      const fixedVersion = typeof value?.fixAvailable === 'object' ? clean(value.fixAvailable.version) : undefined
      return partialFinding({
        severity: normalizeSeverity(value?.severity || primary?.severity),
        vulnerabilityId: clean(primary?.source || primary?.id),
        aliases,
        packageName: clean(value?.name || name),
        fixedVersion,
        managerId: options.managerId || 'npm',
        title: clean(primary?.title) || `${name} vulnerability`,
        summary: clean(primary?.title || primary?.name) || `${name} is affected by ${value?.severity || 'an'} npm audit finding.`,
        recommendation: fixedVersion ? `Update ${name} to ${fixedVersion} or later.` : 'Review npm audit remediation guidance and update the affected dependency.',
        url: clean(primary?.url),
        evidence: [
          `Range: ${value?.range || primary?.range || '-'}`,
          `Effects: ${arrayValue(value?.effects).join(', ') || '-'}`
        ]
      })
    })
  }

  if (parsed?.advisories && typeof parsed.advisories === 'object') {
    return Object.values(parsed.advisories).map((advisory: any) => partialFinding({
      severity: normalizeSeverity(advisory?.severity),
      vulnerabilityId: clean(advisory?.id || advisory?.github_advisory_id),
      aliases: unique([...arrayValue(advisory?.cves), ...arrayValue(advisory?.cwe)]),
      packageName: clean(advisory?.module_name),
      managerId: options.managerId || 'npm',
      title: clean(advisory?.title) || 'npm advisory',
      summary: clean(advisory?.overview) || clean(advisory?.title) || 'npm audit advisory imported.',
      recommendation: clean(advisory?.recommendation) || `Update to a patched version: ${advisory?.patched_versions || 'review advisory'}.`,
      url: clean(advisory?.url),
      evidence: [`Patched versions: ${advisory?.patched_versions || '-'}`]
    }))
  }

  return []
}

function parsePipAudit(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  const dependencies = Array.isArray(parsed?.dependencies) ? parsed.dependencies : Array.isArray(parsed) ? parsed : []
  return dependencies.flatMap((dependency: any) => arrayValue(dependency?.vulns).map((vuln: any) => partialFinding({
    severity: normalizeSeverity(vuln?.severity),
    vulnerabilityId: clean(vuln?.id),
    aliases: arrayValue(vuln?.aliases),
    packageName: clean(dependency?.name),
    installedVersion: clean(dependency?.version),
    fixedVersion: arrayValue(vuln?.fix_versions).join(', ') || undefined,
    managerId: options.managerId || 'pip',
    title: clean(vuln?.id) || `${dependency?.name || 'Python package'} vulnerability`,
    summary: clean(vuln?.description) || 'pip-audit vulnerability imported.',
    recommendation: arrayValue(vuln?.fix_versions).length > 0
      ? `Upgrade ${dependency?.name || 'package'} to ${arrayValue(vuln?.fix_versions).join(', ')}.`
      : 'Review pip-audit remediation guidance for this package.',
    url: clean(vuln?.link),
    evidence: [`Installed: ${dependency?.version || '-'}`]
  })))
}

function parseOsv(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  const packages = [
    ...arrayValue(parsed?.results).flatMap((result: any) => arrayValue(result?.packages)),
    ...arrayValue(parsed?.packages)
  ]
  const directVulns = arrayValue(parsed?.vulns)
  const packageFindings = packages.flatMap((pkg: any) => {
    const packageInfo = pkg?.package || pkg
    const managerId = options.managerId || managerFromEcosystem(packageInfo?.ecosystem)
    return arrayValue(pkg?.vulnerabilities || pkg?.vulns).map((vuln: any) => osvFinding(vuln, packageInfo, managerId))
  })
  const directFindings = directVulns.map((vuln: any) => osvFinding(vuln, vuln?.package || {}, options.managerId))
  return [...packageFindings, ...directFindings]
}

function osvFinding(vuln: any, packageInfo: any, managerId?: DependencyManagerId): ParsedAuditFile['findings'][number] {
  const fixedVersions = osvFixedVersions(vuln)
  return partialFinding({
    severity: normalizeSeverity(vuln?.database_specific?.severity || osvSeverity(vuln)),
    vulnerabilityId: clean(vuln?.id),
    aliases: arrayValue(vuln?.aliases),
    packageName: clean(packageInfo?.name),
    installedVersion: clean(packageInfo?.version),
    fixedVersion: fixedVersions.join(', ') || undefined,
    managerId,
    title: clean(vuln?.summary || vuln?.id) || 'OSV vulnerability',
    summary: clean(vuln?.details || vuln?.summary) || 'OSV vulnerability imported.',
    recommendation: fixedVersions.length > 0 ? `Upgrade to ${fixedVersions.join(', ')} or later.` : 'Review OSV affected ranges and update the dependency.',
    url: clean(vuln?.references?.[0]?.url),
    evidence: arrayValue(vuln?.affected).slice(0, 3).map((item: any) => `Affected package: ${item?.package?.name || packageInfo?.name || '-'}`)
  })
}

function parseSarif(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  return arrayValue(parsed?.runs).flatMap((run: any) => {
    const rules = new Map(arrayValue(run?.tool?.driver?.rules).map((rule: any) => [rule.id, rule]))
    const toolName = clean(run?.tool?.driver?.name) || 'SARIF'
    return arrayValue(run?.results).map((result: any) => {
      const rule: any = rules.get(result?.ruleId) || {}
      const location = result?.locations?.[0]?.physicalLocation
      const file = clean(location?.artifactLocation?.uri)
      const securitySeverity = rule?.properties?.['security-severity'] || result?.properties?.['security-severity']
      return partialFinding({
        severity: normalizeSeverity(securitySeverity || result?.level),
        vulnerabilityId: clean(result?.ruleId),
        aliases: [],
        managerId: options.managerId,
        title: clean(rule?.shortDescription?.text || result?.ruleId) || `${toolName} finding`,
        summary: clean(result?.message?.text || rule?.fullDescription?.text) || 'SARIF security finding imported.',
        recommendation: clean(rule?.help?.text) || 'Review the SARIF finding and apply the scanner recommendation.',
        url: clean(rule?.helpUri),
        sourceFile: file,
        evidence: [file ? `File: ${file}` : '', toolName ? `Tool: ${toolName}` : ''].filter(Boolean)
      })
    })
  })
}

function parseCargoAudit(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  const list = arrayValue(parsed?.vulnerabilities?.list || parsed?.vulnerabilities)
  return list.map((item: any) => {
    const advisory = item?.advisory || item
    const versions = item?.versions || {}
    return partialFinding({
      severity: normalizeSeverity(advisory?.severity),
      vulnerabilityId: clean(advisory?.id),
      aliases: arrayValue(advisory?.aliases),
      packageName: clean(advisory?.package),
      fixedVersion: arrayValue(versions?.patched).join(', ') || undefined,
      managerId: options.managerId || 'cargo',
      title: clean(advisory?.title) || 'Cargo advisory',
      summary: clean(advisory?.description) || 'cargo audit advisory imported.',
      recommendation: arrayValue(versions?.patched).length > 0 ? `Upgrade to ${arrayValue(versions?.patched).join(', ')}.` : 'Review cargo audit advisory remediation.',
      url: clean(advisory?.url),
      evidence: [`Unaffected: ${arrayValue(versions?.unaffected).join(', ') || '-'}`]
    })
  })
}

function parseTrivy(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  return arrayValue(parsed?.Results).flatMap((result: any) => arrayValue(result?.Vulnerabilities).map((vuln: any) => partialFinding({
    severity: normalizeSeverity(vuln?.Severity),
    vulnerabilityId: clean(vuln?.VulnerabilityID),
    aliases: [],
    packageName: clean(vuln?.PkgName),
    installedVersion: clean(vuln?.InstalledVersion),
    fixedVersion: clean(vuln?.FixedVersion),
    managerId: options.managerId || managerFromTrivyType(result?.Type),
    title: clean(vuln?.Title || vuln?.VulnerabilityID) || 'Trivy vulnerability',
    summary: clean(vuln?.Description) || 'Trivy vulnerability imported.',
    recommendation: vuln?.FixedVersion ? `Upgrade ${vuln?.PkgName || 'package'} to ${vuln.FixedVersion}.` : 'Review Trivy remediation guidance.',
    url: clean(vuln?.PrimaryURL),
    sourceFile: clean(result?.Target),
    evidence: [`Target: ${result?.Target || '-'}`, `Class: ${result?.Class || '-'}`]
  })))
}

function parseGovulncheck(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  const records = Array.isArray(parsed?.jsonLines) ? parsed.jsonLines : Array.isArray(parsed) ? parsed : [parsed]
  return records.flatMap((record: any) => {
    const vuln = record?.osv || record?.vulnerability || record
    const finding = record?.finding || record
    if (!vuln?.id && !finding?.osv) return []
    return [partialFinding({
      severity: normalizeSeverity(vuln?.database_specific?.severity),
      vulnerabilityId: clean(vuln?.id || finding?.osv),
      aliases: arrayValue(vuln?.aliases),
      packageName: clean(finding?.package || vuln?.affected?.[0]?.package?.name),
      managerId: options.managerId || 'go',
      title: clean(vuln?.summary || vuln?.id || finding?.osv) || 'Go vulnerability',
      summary: clean(vuln?.details || vuln?.summary || finding?.trace?.[0]?.function) || 'govulncheck finding imported.',
      recommendation: 'Update the affected Go module or upgrade to a fixed Go/toolchain version.',
      url: clean(vuln?.references?.[0]?.url),
      evidence: [`Symbol: ${finding?.symbol || '-'}`]
    })]
  })
}

function parseGeneric(parsed: any, options: AuditEvidenceImportOptions): ParsedAuditFile['findings'] {
  const items = Array.isArray(parsed?.findings)
    ? parsed.findings
    : Array.isArray(parsed?.vulnerabilities)
      ? parsed.vulnerabilities
      : Array.isArray(parsed)
        ? parsed
        : [parsed]
  return items.map((item: any) => partialFinding({
    severity: normalizeSeverity(item?.severity || item?.level),
    vulnerabilityId: clean(item?.id || item?.vulnerabilityId || item?.cve),
    aliases: arrayValue(item?.aliases || item?.cves),
    packageName: clean(item?.packageName || item?.package || item?.name),
    installedVersion: clean(item?.installedVersion || item?.version),
    fixedVersion: clean(item?.fixedVersion || item?.patchedVersion),
    managerId: options.managerId || managerFromEcosystem(item?.ecosystem),
    title: clean(item?.title || item?.summary || item?.id) || 'Audit finding',
    summary: clean(item?.description || item?.summary || item?.message) || 'Generic audit finding imported.',
    recommendation: clean(item?.recommendation) || 'Review the imported audit finding and update the affected dependency.',
    url: clean(item?.url),
    sourceFile: clean(item?.sourceFile),
    evidence: arrayValue(item?.evidence)
  }))
}

function detectTool(path: string, parsed: any, content: string): AuditEvidenceTool {
  const name = basename(path).toLowerCase()
  const extension = extname(path).toLowerCase()
  if (parsed?.runs && (parsed?.version || parsed?.$schema)) return 'sarif'
  if (extension === '.sarif') return 'sarif'
  if (parsed?.vulnerabilities && (parsed?.metadata || parsed?.auditReportVersion || parsed?.advisories)) return 'npm-audit'
  if (parsed?.advisories && parsed?.metadata) return 'npm-audit'
  if (Array.isArray(parsed?.dependencies) && parsed.dependencies.some((item: any) => Array.isArray(item?.vulns))) return 'pip-audit'
  if (parsed?.results || parsed?.vulns || parsed?.affected) return 'osv'
  if (parsed?.vulnerabilities?.list || name.includes('cargo-audit')) return 'cargo-audit'
  if (Array.isArray(parsed?.Results) && parsed.Results.some((item: any) => Array.isArray(item?.Vulnerabilities))) return 'trivy'
  if (parsed?.jsonLines || name.includes('govuln') || content.includes('"finding"') && content.includes('"osv"')) return 'govulncheck'
  if (name.includes('npm')) return 'npm-audit'
  if (name.includes('pip')) return 'pip-audit'
  if (name.includes('osv')) return 'osv'
  if (name.includes('trivy')) return 'trivy'
  return 'generic'
}

function normalizeFinding(input: AuditEvidenceFinding): AuditEvidenceFinding {
  const evidence = unique(input.evidence.map((item) => String(item || '').trim()).filter(Boolean)).slice(0, 20)
  const normalized: Omit<AuditEvidenceFinding, 'id'> = {
    tool: input.tool,
    severity: normalizeSeverity(input.severity),
    vulnerabilityId: clean(input.vulnerabilityId),
    aliases: unique(input.aliases.map((item) => String(item || '').trim()).filter(Boolean)),
    packageName: clean(input.packageName),
    installedVersion: clean(input.installedVersion),
    fixedVersion: clean(input.fixedVersion),
    managerId: input.managerId,
    workspaceRelativePath: clean(input.workspaceRelativePath),
    title: clean(input.title) || clean(input.vulnerabilityId) || 'Audit finding',
    summary: clean(input.summary) || 'Audit evidence finding imported.',
    recommendation: clean(input.recommendation) || 'Review and remediate the finding according to the scanner output.',
    url: clean(input.url),
    sourceFile: clean(input.sourceFile),
    rawFile: input.rawFile,
    importedAt: input.importedAt,
    evidence
  }
  return {
    ...normalized,
    id: sha1(JSON.stringify([
      normalized.tool,
      normalized.vulnerabilityId,
      normalized.packageName,
      normalized.installedVersion,
      normalized.sourceFile,
      normalized.rawFile
    ]))
  }
}

function partialFinding(input: Partial<AuditEvidenceFinding> & Pick<AuditEvidenceFinding, 'title' | 'summary' | 'recommendation'>): ParsedAuditFile['findings'][number] {
  return {
    severity: normalizeSeverity(input.severity),
    vulnerabilityId: clean(input.vulnerabilityId),
    aliases: input.aliases || [],
    packageName: clean(input.packageName),
    installedVersion: clean(input.installedVersion),
    fixedVersion: clean(input.fixedVersion),
    managerId: input.managerId,
    workspaceRelativePath: clean(input.workspaceRelativePath),
    title: input.title,
    summary: input.summary,
    recommendation: input.recommendation,
    url: clean(input.url),
    sourceFile: clean(input.sourceFile),
    evidence: input.evidence || []
  }
}

async function readStore(cwd: string): Promise<AuditEvidenceStore> {
  try {
    const parsed = JSON.parse(await readFile(storePath(cwd), 'utf-8'))
    return {
      sources: Array.isArray(parsed?.sources) ? parsed.sources.map(normalizeSource).filter(Boolean) : [],
      findings: Array.isArray(parsed?.findings) ? parsed.findings.map(normalizeStoredFinding).filter(Boolean) : []
    }
  } catch {
    return { sources: [], findings: [] }
  }
}

async function writeStore(cwd: string, store: AuditEvidenceStore): Promise<void> {
  const path = storePath(cwd)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify({
    sources: store.sources,
    findings: sortFindings(store.findings)
  }, null, 2), 'utf-8')
}

function normalizeSource(source: any): AuditEvidenceSourceRecord | null {
  if (!source || typeof source !== 'object') return null
  return {
    id: clean(source.id) || sha1(JSON.stringify(source)),
    tool: normalizeTool(source.tool),
    sourceName: clean(source.sourceName) || basename(clean(source.path) || 'audit-report'),
    path: clean(source.path) || '',
    importedAt: validIso(source.importedAt) || new Date().toISOString(),
    contentHash: clean(source.contentHash) || '',
    findingCount: integerValue(source.findingCount),
    managerIds: sortManagers(arrayValue(source.managerIds).filter(Boolean) as DependencyManagerId[]),
    workspaceRelativePath: clean(source.workspaceRelativePath)
  }
}

function normalizeStoredFinding(finding: any): AuditEvidenceFinding | null {
  if (!finding || typeof finding !== 'object') return null
  return normalizeFinding({
    ...finding,
    tool: normalizeTool(finding.tool),
    severity: normalizeSeverity(finding.severity),
    aliases: arrayValue(finding.aliases),
    rawFile: clean(finding.rawFile) || '',
    importedAt: validIso(finding.importedAt) || new Date().toISOString(),
    evidence: arrayValue(finding.evidence)
  })
}

function summarize(sources: AuditEvidenceSourceRecord[], findings: AuditEvidenceFinding[]): AuditEvidenceSummary {
  const managers = sortManagers(unique(findings.map((finding) => finding.managerId).filter(Boolean) as DependencyManagerId[]))
  const tools = unique(sources.map((source) => source.tool).concat(findings.map((finding) => finding.tool))).sort() as AuditEvidenceTool[]
  return {
    sourceCount: sources.length,
    findingCount: findings.length,
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    low: findings.filter((finding) => finding.severity === 'low').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
    unknown: findings.filter((finding) => finding.severity === 'unknown').length,
    affectedPackageCount: unique(findings.map((finding) => finding.packageName).filter(Boolean)).length,
    fixAvailableCount: findings.filter((finding) => finding.fixedVersion).length,
    managerCount: managers.length,
    managers,
    toolCount: tools.length,
    tools
  }
}

function renderMarkdown(report: AuditEvidenceReport): string {
  const lines = [
    '# Audit Evidence Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Summary',
    '',
    `- Sources: ${report.summary.sourceCount}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Critical/high: ${report.summary.critical}/${report.summary.high}`,
    `- Medium/low/info/unknown: ${report.summary.medium}/${report.summary.low}/${report.summary.info}/${report.summary.unknown}`,
    `- Affected packages: ${report.summary.affectedPackageCount}`,
    `- Fixes available: ${report.summary.fixAvailableCount}`,
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    `- Tools: ${report.summary.tools.join(', ') || '-'}`,
    '',
    '## Sources',
    '',
    '| Tool | Findings | Imported | Path |',
    '| --- | ---: | --- | --- |'
  ]

  for (const source of report.sources) {
    lines.push(`| ${source.tool} | ${source.findingCount} | ${source.importedAt} | ${markdownCell(source.path)} |`)
  }
  if (report.sources.length === 0) {
    lines.push('| - | 0 | - | No audit evidence imported. |')
  }

  lines.push(
    '',
    '## Findings',
    '',
    '| Severity | Tool | Package | Vulnerability | Fixed | Summary |',
    '| --- | --- | --- | --- | --- | --- |'
  )

  for (const finding of report.findings.slice(0, 200)) {
    lines.push([
      finding.severity,
      finding.tool,
      markdownCell(finding.packageName || '-'),
      markdownCell(finding.vulnerabilityId || finding.aliases[0] || '-'),
      markdownCell(finding.fixedVersion || '-'),
      markdownCell(finding.summary)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  if (report.findings.length === 0) {
    lines.push('| info | - | - | - | - | No audit findings imported. |')
  }

  return `${lines.join('\n')}\n`
}

function renderHtmlDashboard(report: AuditEvidenceReport): string {
  const severityCards = [
    ['critical', report.summary.critical],
    ['high', report.summary.high],
    ['medium', report.summary.medium],
    ['low', report.summary.low],
    ['info', report.summary.info],
    ['unknown', report.summary.unknown]
  ] as Array<[AuditEvidenceSeverity, number]>
  const sourceRows = report.sources.length > 0
    ? report.sources.map((source) => [
        '<tr>',
        `<td><span class="pill">${htmlText(source.tool)}</span></td>`,
        `<td>${source.findingCount}</td>`,
        `<td>${htmlText(source.importedAt)}</td>`,
        `<td>${htmlText(source.managerIds.join(', ') || '-')}</td>`,
        `<td class="path">${htmlText(source.path)}</td>`,
        '</tr>'
      ].join('')).join('\n')
    : '<tr><td colspan="5">No audit evidence imported.</td></tr>'
  const findingRows = report.findings.length > 0
    ? report.findings.slice(0, 1000).map((finding) => {
        const searchable = [
          finding.severity,
          finding.tool,
          finding.packageName,
          finding.vulnerabilityId,
          finding.aliases.join(' '),
          finding.managerId,
          finding.workspaceRelativePath,
          finding.summary
        ].filter(Boolean).join(' ').toLowerCase()
        return [
          `<tr data-severity="${htmlAttr(finding.severity)}" data-search="${htmlAttr(searchable)}">`,
          `<td><span class="severity ${htmlAttr(finding.severity)}">${htmlText(finding.severity)}</span></td>`,
          `<td>${htmlText(finding.tool)}</td>`,
          `<td>${htmlText(finding.managerId || '-')}</td>`,
          `<td>${htmlText(finding.packageName || '-')}<small>${htmlText(finding.installedVersion || '')}</small></td>`,
          `<td>${htmlText(finding.vulnerabilityId || finding.aliases[0] || '-')}</td>`,
          `<td>${htmlText(finding.fixedVersion || '-')}</td>`,
          `<td>${htmlText(finding.workspaceRelativePath || '-')}</td>`,
          `<td>${htmlText(finding.summary)}</td>`,
          '</tr>'
        ].join('')
      }).join('\n')
    : '<tr><td colspan="8">No audit findings imported.</td></tr>'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Audit Evidence Dashboard</title>
  <style>
    :root { color-scheme: light; --bg: #f6f7f9; --panel: #ffffff; --text: #17202a; --muted: #5d6d7e; --line: #d8dee8; --critical: #9f1239; --high: #c2410c; --medium: #b45309; --low: #2563eb; --info: #475569; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; color: var(--text); background: var(--bg); }
    header { padding: 24px 32px 16px; background: #111827; color: #fff; }
    h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; }
    header p { margin: 0; color: #cbd5e1; font-size: 13px; }
    main { padding: 24px 32px 40px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .card, section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .card { padding: 14px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .value { display: block; margin-top: 6px; font-size: 24px; font-weight: 700; }
    section { margin-top: 18px; overflow: hidden; }
    .section-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--line); }
    h2 { margin: 0; font-size: 16px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
    button { border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 7px 10px; cursor: pointer; }
    button.active { background: #111827; color: #fff; border-color: #111827; }
    input { min-width: 240px; flex: 1; border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-weight: 600; }
    small { display: block; margin-top: 3px; color: var(--muted); }
    .path { font-family: Consolas, monospace; font-size: 12px; color: #334155; }
    .pill, .severity { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; }
    .pill { background: #e2e8f0; color: #334155; }
    .severity { color: #fff; background: var(--info); }
    .severity.critical { background: var(--critical); }
    .severity.high { background: var(--high); }
    .severity.medium { background: var(--medium); }
    .severity.low { background: var(--low); }
    .severity.info { background: var(--info); }
    .severity.unknown { background: #64748b; }
    @media (max-width: 760px) { header, main { padding-left: 16px; padding-right: 16px; } .section-head { align-items: flex-start; flex-direction: column; } table { min-width: 860px; } section { overflow-x: auto; } }
  </style>
</head>
<body>
  <header>
    <h1>Audit Evidence Dashboard</h1>
    <p>Generated ${htmlText(report.generatedAt)} for ${htmlText(report.projectPath)}</p>
  </header>
  <main>
    <div class="grid">
      <div class="card"><span class="label">Sources</span><span class="value">${report.summary.sourceCount}</span></div>
      <div class="card"><span class="label">Findings</span><span class="value">${report.summary.findingCount}</span></div>
      <div class="card"><span class="label">High+</span><span class="value">${report.summary.critical + report.summary.high}</span></div>
      <div class="card"><span class="label">Affected packages</span><span class="value">${report.summary.affectedPackageCount}</span></div>
      <div class="card"><span class="label">Fixes available</span><span class="value">${report.summary.fixAvailableCount}</span></div>
      <div class="card"><span class="label">Managers</span><span class="value">${report.summary.managerCount}</span></div>
    </div>
    <div class="grid">
      ${severityCards.map(([severity, count]) => `<div class="card"><span class="label">${htmlText(severity)}</span><span class="value">${count}</span></div>`).join('\n      ')}
    </div>
    <section>
      <div class="section-head"><h2>Scanner Sources</h2><span>${htmlText(report.summary.tools.join(', ') || '-')}</span></div>
      <table>
        <thead><tr><th>Tool</th><th>Findings</th><th>Imported</th><th>Managers</th><th>Path</th></tr></thead>
        <tbody>${sourceRows}</tbody>
      </table>
    </section>
    <section>
      <div class="section-head"><h2>Findings</h2><span id="visible-count">${report.findings.length}</span></div>
      <div class="toolbar">
        <button class="active" data-filter="all">All</button>
        ${severityCards.map(([severity]) => `<button data-filter="${htmlAttr(severity)}">${htmlText(severity)}</button>`).join('\n        ')}
        <input id="search" type="search" placeholder="Filter by package, CVE, manager, workspace, or summary" />
      </div>
      <table>
        <thead><tr><th>Severity</th><th>Tool</th><th>Manager</th><th>Package</th><th>Vulnerability</th><th>Fixed</th><th>Workspace</th><th>Summary</th></tr></thead>
        <tbody>${findingRows}</tbody>
      </table>
    </section>
  </main>
  <script>
    const rows = Array.from(document.querySelectorAll('tr[data-severity]'));
    const buttons = Array.from(document.querySelectorAll('button[data-filter]'));
    const search = document.getElementById('search');
    const visible = document.getElementById('visible-count');
    let current = 'all';
    function applyFilter() {
      const text = (search.value || '').trim().toLowerCase();
      let count = 0;
      for (const row of rows) {
        const severityOk = current === 'all' || row.dataset.severity === current;
        const textOk = !text || (row.dataset.search || '').includes(text);
        const show = severityOk && textOk;
        row.style.display = show ? '' : 'none';
        if (show) count += 1;
      }
      visible.textContent = String(count);
    }
    for (const button of buttons) {
      button.addEventListener('click', () => {
        current = button.dataset.filter || 'all';
        buttons.forEach((item) => item.classList.toggle('active', item === button));
        applyFilter();
      });
    }
    search.addEventListener('input', applyFilter);
  </script>
</body>
</html>
`
}

function parseJsonLenient(content: string): any {
  try {
    return JSON.parse(content)
  } catch {
    const jsonLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    if (jsonLines.length > 0) return { jsonLines }
    throw new Error('Audit evidence file must be JSON, SARIF, or newline-delimited JSON')
  }
}

function normalizeSeverity(value: unknown): AuditEvidenceSeverity {
  const text = String(value || '').trim().toLowerCase()
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    if (numeric >= 9) return 'critical'
    if (numeric >= 7) return 'high'
    if (numeric >= 4) return 'medium'
    if (numeric > 0) return 'low'
  }
  if (['critical', 'crit'].includes(text)) return 'critical'
  if (['high', 'error'].includes(text)) return 'high'
  if (['moderate', 'medium', 'warning'].includes(text)) return 'medium'
  if (['low', 'note'].includes(text)) return 'low'
  if (['info', 'informational', 'none'].includes(text)) return 'info'
  return 'unknown'
}

function normalizeTool(value: unknown): AuditEvidenceTool {
  const text = String(value || '').trim().toLowerCase()
  if (['npm-audit', 'npm'].includes(text)) return 'npm-audit'
  if (['pip-audit', 'pip'].includes(text)) return 'pip-audit'
  if (['osv', 'osv-scanner'].includes(text)) return 'osv'
  if (text === 'sarif') return 'sarif'
  if (['cargo-audit', 'cargo'].includes(text)) return 'cargo-audit'
  if (text === 'trivy') return 'trivy'
  if (text === 'govulncheck') return 'govulncheck'
  return 'generic'
}

function managerFromEcosystem(value: unknown): DependencyManagerId | undefined {
  const text = String(value || '').trim().toLowerCase()
  if (['npm', 'node', 'node.js'].includes(text)) return 'npm'
  if (['pypi', 'python', 'pip'].includes(text)) return 'pip'
  if (['crates.io', 'cargo', 'rust'].includes(text)) return 'cargo'
  if (['go', 'golang'].includes(text)) return 'go'
  if (['maven'].includes(text)) return 'maven'
  if (['nuget'].includes(text)) return 'nuget'
  if (['packagist', 'composer'].includes(text)) return 'composer'
  if (['rubygems', 'bundler'].includes(text)) return 'bundler'
  if (['pub', 'dart', 'flutter'].includes(text)) return 'flutter'
  if (['docker', 'container'].includes(text)) return 'docker'
  return undefined
}

function managerFromTrivyType(value: unknown): DependencyManagerId | undefined {
  const text = String(value || '').trim().toLowerCase()
  if (['npm', 'node-pkg'].includes(text)) return 'npm'
  if (['pip', 'python-pkg'].includes(text)) return 'pip'
  if (['cargo'].includes(text)) return 'cargo'
  if (['gomod'].includes(text)) return 'go'
  if (['maven', 'jar'].includes(text)) return 'maven'
  if (['nuget'].includes(text)) return 'nuget'
  if (['composer'].includes(text)) return 'composer'
  if (['bundler', 'gemspec'].includes(text)) return 'bundler'
  if (['dockerfile', 'os'].includes(text)) return 'docker'
  return undefined
}

function osvSeverity(vuln: any): string | undefined {
  const severity = arrayValue(vuln?.severity)[0]
  return severity?.score || severity?.type
}

function osvFixedVersions(vuln: any): string[] {
  return unique(arrayValue(vuln?.affected).flatMap((affected: any) => arrayValue(affected?.ranges).flatMap((range: any) => arrayValue(range?.events)
    .map((event: any) => clean(event?.fixed))
    .filter(Boolean))))
}

function sortFindings(findings: AuditEvidenceFinding[]): AuditEvidenceFinding[] {
  const severityOrder: Record<AuditEvidenceSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
    unknown: 5
  }
  return [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.packageName?.localeCompare(b.packageName || '') || a.title.localeCompare(b.title))
}

function sortManagers(ids: DependencyManagerId[]): DependencyManagerId[] {
  return [...new Set(ids)].sort()
}

function storePath(cwd: string): string {
  return join(resolve(cwd), AUDIT_EVIDENCE_FILE)
}

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
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

function integerValue(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : []
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

function htmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlAttr(value: unknown): string {
  return htmlText(value).replace(/`/g, '&#96;')
}
