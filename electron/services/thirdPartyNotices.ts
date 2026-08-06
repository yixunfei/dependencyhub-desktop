import { createHash } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  SupplyChainService,
  type LicenseComplianceComponent,
  type LicenseComplianceLicenseEntry,
  type LicenseCompliancePolicySnapshot,
  type LicenseComplianceReport,
  type LicenseComplianceStatus,
  type LicenseComplianceSummary
} from './supplyChain'

export type ThirdPartyNoticeFormat = 'text' | 'markdown' | 'json'

export interface ThirdPartyNoticeEntry {
  id: string
  managerId: DependencyManagerId
  ecosystem: string
  name: string
  version?: string
  scope: string
  sourceFile: string
  packageUrl?: string
  licenses: string[]
  normalizedLicenses: string[]
  licenseExpression: string
  status: LicenseComplianceStatus
  policyViolation: boolean
  reasons: string[]
  recommendation: string
  licenseTextIncluded: boolean
  licenseTextNote: string
  notice: string
}

export interface ThirdPartyNoticesSummary {
  componentCount: number
  noticeCount: number
  knownLicenseComponentCount: number
  unknownLicenseComponentCount: number
  distinctLicenseCount: number
  policyViolationCount: number
  managerCount: number
  blockedLicenseComponentCount: number
  notAllowedLicenseComponentCount: number
}

export interface ThirdPartyNoticesReport {
  generatedAt: string
  projectPath: string
  policy: LicenseCompliancePolicySnapshot
  summary: ThirdPartyNoticesSummary
  licenses: LicenseComplianceLicenseEntry[]
  entries: ThirdPartyNoticeEntry[]
  sources: {
    licenseCompliance: {
      generatedAt: string
      summary: LicenseComplianceSummary
    }
  }
}

export interface ThirdPartyNoticesExportResult {
  path: string
  format: ThirdPartyNoticeFormat
  generatedAt: string
  noticeCount: number
  componentCount: number
  count: number
  summary: ThirdPartyNoticesSummary
}

export interface ThirdPartyNoticesDependencies {
  supplyChainService?: SupplyChainService
}

const REPORT_DIR = '.npmDesktopManager/reports'
const LICENSE_TEXT_NOTE = 'License text is not embedded in this generated notice; verify upstream package metadata and packaged license files before distribution.'

export class ThirdPartyNoticesService {
  private readonly supplyChainService: SupplyChainService

  constructor(dependencies: ThirdPartyNoticesDependencies = {}) {
    this.supplyChainService = dependencies.supplyChainService || new SupplyChainService()
  }

  async report(projectPath: string): Promise<ThirdPartyNoticesReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const licenseReport = await this.supplyChainService.licenseReport(root)
    return buildReport(root, licenseReport)
  }

  async exportText(projectPath: string): Promise<ThirdPartyNoticesExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'THIRD-PARTY-NOTICES.txt')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderText(report), 'utf-8')
    return exportResult(path, 'text', report)
  }

  async exportMarkdown(projectPath: string): Promise<ThirdPartyNoticesExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'third-party-notices.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<ThirdPartyNoticesExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'third-party-notices.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function buildReport(root: string, licenseReport: LicenseComplianceReport): ThirdPartyNoticesReport {
  const entries = licenseReport.components
    .map(noticeEntry)
    .sort(compareNoticeEntries)

  return {
    generatedAt: new Date().toISOString(),
    projectPath: root,
    policy: licenseReport.policy,
    summary: {
      componentCount: licenseReport.summary.componentCount,
      noticeCount: entries.length,
      knownLicenseComponentCount: licenseReport.summary.knownLicenseComponentCount,
      unknownLicenseComponentCount: licenseReport.summary.unknownLicenseComponentCount,
      distinctLicenseCount: licenseReport.summary.licenseCount,
      policyViolationCount: licenseReport.summary.policyViolationComponentCount,
      managerCount: licenseReport.summary.managerCount,
      blockedLicenseComponentCount: licenseReport.summary.blockedLicenseComponentCount,
      notAllowedLicenseComponentCount: licenseReport.summary.notAllowedLicenseComponentCount
    },
    licenses: licenseReport.licenses,
    entries,
    sources: {
      licenseCompliance: {
        generatedAt: licenseReport.generatedAt,
        summary: licenseReport.summary
      }
    }
  }
}

function noticeEntry(component: LicenseComplianceComponent): ThirdPartyNoticeEntry {
  const entry: ThirdPartyNoticeEntry = {
    id: noticeId(component),
    managerId: component.managerId,
    ecosystem: component.ecosystem,
    name: component.name,
    version: component.version,
    scope: component.scope,
    sourceFile: component.sourceFile,
    packageUrl: component.packageUrl,
    licenses: component.licenses,
    normalizedLicenses: component.normalizedLicenses,
    licenseExpression: component.licenses.join(' OR ') || 'UNKNOWN',
    status: component.status,
    policyViolation: component.policyViolation,
    reasons: component.reasons,
    recommendation: component.recommendation,
    licenseTextIncluded: false,
    licenseTextNote: LICENSE_TEXT_NOTE,
    notice: ''
  }
  entry.notice = renderNoticeText(entry)
  return entry
}

function renderText(report: ThirdPartyNoticesReport): string {
  const lines = [
    'THIRD-PARTY-NOTICES',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Policy: ${report.policy.path}`,
    '',
    'Summary:',
    `  Components: ${report.summary.componentCount}`,
    `  Notices: ${report.summary.noticeCount}`,
    `  Known-license components: ${report.summary.knownLicenseComponentCount}`,
    `  Unknown-license components: ${report.summary.unknownLicenseComponentCount}`,
    `  Distinct license values: ${report.summary.distinctLicenseCount}`,
    `  Policy-violation components: ${report.summary.policyViolationCount}`,
    `  Managers: ${report.summary.managerCount}`,
    '',
    'Distribution note:',
    `  ${LICENSE_TEXT_NOTE}`,
    ''
  ]

  if (report.entries.length === 0) {
    lines.push('No third-party dependency components were captured.')
  } else {
    lines.push('Notices:')
    for (const entry of report.entries) {
      lines.push(
        '',
        '--------------------------------------------------------------------------------',
        `${entry.name}${entry.version ? `@${entry.version}` : ''}`,
        `Manager: ${entry.managerId}`,
        `Ecosystem: ${entry.ecosystem}`,
        `Scope: ${entry.scope}`,
        `License: ${entry.licenseExpression}`,
        `Policy status: ${entry.status}${entry.policyViolation ? ' (policy violation)' : ''}`,
        `Source: ${entry.sourceFile}`,
        `Package URL: ${entry.packageUrl || '-'}`,
        `Recommendation: ${entry.recommendation}`,
        `Notice: ${entry.notice}`
      )
      if (entry.reasons.length > 0) {
        lines.push('Review reasons:')
        lines.push(...entry.reasons.map((reason) => `  - ${reason}`))
      }
    }
  }

  return `${lines.join('\n')}\n`
}

function renderMarkdown(report: ThirdPartyNoticesReport): string {
  const lines = [
    '# Third-Party Notices',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Policy: ${report.policy.path}`,
    '',
    '## Distribution Note',
    '',
    LICENSE_TEXT_NOTE,
    '',
    '## Summary',
    '',
    `- Components: ${report.summary.componentCount}`,
    `- Notices: ${report.summary.noticeCount}`,
    `- Known-license components: ${report.summary.knownLicenseComponentCount}`,
    `- Unknown-license components: ${report.summary.unknownLicenseComponentCount}`,
    `- Distinct license values: ${report.summary.distinctLicenseCount}`,
    `- Policy-violation components: ${report.summary.policyViolationCount}`,
    `- Managers: ${report.summary.managerCount}`,
    '',
    '## Notice Index',
    '',
    '| Status | Manager | Package | Version | License | Source | Recommendation |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ]

  for (const entry of report.entries) {
    lines.push([
      entry.status,
      entry.managerId,
      markdownCell(entry.name),
      markdownCell(entry.version || '-'),
      markdownCell(entry.licenseExpression),
      markdownCell(entry.sourceFile),
      markdownCell(entry.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (report.entries.length === 0) {
    lines.push('| unrestricted | - | - | - | - | - | No third-party dependency components were captured. |')
  }

  lines.push('', '## Notices', '')
  if (report.entries.length === 0) {
    lines.push('No third-party dependency components were captured.')
  } else {
    for (const entry of report.entries) {
      lines.push(
        `### ${entry.name}${entry.version ? `@${entry.version}` : ''}`,
        '',
        `- Manager: ${entry.managerId}`,
        `- Ecosystem: ${entry.ecosystem}`,
        `- Scope: ${entry.scope}`,
        `- License: ${entry.licenseExpression}`,
        `- Policy status: ${entry.status}${entry.policyViolation ? ' (policy violation)' : ''}`,
        `- Source: ${entry.sourceFile}`,
        `- Package URL: ${entry.packageUrl || '-'}`,
        `- License text included: ${entry.licenseTextIncluded ? 'yes' : 'no'}`,
        `- Recommendation: ${entry.recommendation}`,
        '',
        entry.notice,
        ''
      )
      if (entry.reasons.length > 0) {
        lines.push('Review reasons:', '')
        lines.push(...entry.reasons.map((reason) => `- ${reason}`), '')
      }
    }
  }

  lines.push(
    '## License Summary',
    '',
    '| Status | License | Components | Managers | Packages |',
    '| --- | --- | ---: | --- | --- |'
  )

  for (const license of report.licenses) {
    lines.push([
      license.status,
      markdownCell(license.license),
      String(license.componentCount),
      markdownCell(license.managers.join(', ')),
      markdownCell(license.packages.join(', '))
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (report.licenses.length === 0) {
    lines.push('| unrestricted | - | 0 | - | - |')
  }

  return `${lines.join('\n')}\n`
}

function renderNoticeText(entry: ThirdPartyNoticeEntry): string {
  return [
    `${entry.name}${entry.version ? ` ${entry.version}` : ''} is included from ${entry.sourceFile}.`,
    `Recorded license: ${entry.licenseExpression}.`,
    `Policy status: ${entry.status}.`,
    LICENSE_TEXT_NOTE
  ].join(' ')
}

function exportResult(
  path: string,
  format: ThirdPartyNoticeFormat,
  report: ThirdPartyNoticesReport
): ThirdPartyNoticesExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    noticeCount: report.summary.noticeCount,
    componentCount: report.summary.componentCount,
    count: report.summary.noticeCount,
    summary: report.summary
  }
}

function compareNoticeEntries(a: ThirdPartyNoticeEntry, b: ThirdPartyNoticeEntry): number {
  return a.managerId.localeCompare(b.managerId) ||
    a.name.localeCompare(b.name) ||
    (a.version || '').localeCompare(b.version || '') ||
    a.sourceFile.localeCompare(b.sourceFile)
}

function noticeId(component: LicenseComplianceComponent): string {
  return createHash('sha1')
    .update([
      component.managerId,
      component.name,
      component.version || '',
      component.scope,
      component.sourceFile
    ].join('\0'))
    .digest('hex')
    .slice(0, 16)
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
