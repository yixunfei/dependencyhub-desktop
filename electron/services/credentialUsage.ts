import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  RegistryReachabilityService,
  type RegistryEndpoint
} from './registryReachability'
import type {
  CredentialFilter,
  CredentialMetadata,
  CredentialVaultStatus
} from './credentialVaultCore'

export type CredentialUsageExportFormat = 'markdown' | 'json'
export type CredentialUsageStatus =
  | 'covered'
  | 'missing'
  | 'weak-match'
  | 'insecure-storage'
  | 'insecure-endpoint'
  | 'public'
export type CredentialUsageMatchType = 'exact-service' | 'exact-url' | 'host' | 'manager'

export interface CredentialUsageMatch {
  id: string
  label: string
  managerId: DependencyManagerId
  service: string
  account?: string
  kind: CredentialMetadata['kind']
  url?: string
  encrypted: boolean
  storage: CredentialMetadata['storage']
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  matchType: CredentialUsageMatchType
}

export interface CredentialUsageEndpoint {
  endpoint: RegistryEndpoint
  requiresCredential: boolean
  status: CredentialUsageStatus
  matches: CredentialUsageMatch[]
  warnings: string[]
  recommendation: string
}

export interface CredentialUsageUnusedCredential {
  id: string
  label: string
  managerId: DependencyManagerId
  service: string
  account?: string
  kind: CredentialMetadata['kind']
  url?: string
  encrypted: boolean
  storage: CredentialMetadata['storage']
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export interface CredentialUsageSummary {
  endpointCount: number
  privateEndpointCount: number
  credentialCount: number
  coveredEndpointCount: number
  missingCredentialEndpointCount: number
  weakMatchEndpointCount: number
  insecureStorageEndpointCount: number
  insecureEndpointCount: number
  publicEndpointCount: number
  unusedCredentialCount: number
  encryptedCredentialCount: number
  unencryptedCredentialCount: number
}

export interface CredentialUsageReport {
  generatedAt: string
  projectPath: string
  vaultStatus: CredentialVaultStatus
  endpoints: CredentialUsageEndpoint[]
  unusedCredentials: CredentialUsageUnusedCredential[]
  summary: CredentialUsageSummary
}

export interface CredentialUsageExportResult {
  path: string
  format: CredentialUsageExportFormat
  generatedAt: string
  summary: CredentialUsageSummary
}

export interface CredentialUsageVaultReader {
  status(): CredentialVaultStatus
  list(filter?: CredentialFilter): Promise<CredentialMetadata[]>
}

const REPORT_DIR = '.npmDesktopManager/reports'

const EMPTY_VAULT: CredentialUsageVaultReader = {
  status: () => ({
    available: true,
    encrypted: true,
    storage: 'test-adapter'
  }),
  list: async () => []
}

export class CredentialUsageService {
  private readonly registryReachabilityService: RegistryReachabilityService
  private readonly credentialVault: CredentialUsageVaultReader

  constructor(dependencies: {
    registryReachabilityService?: RegistryReachabilityService
    credentialVault?: CredentialUsageVaultReader
  } = {}) {
    this.registryReachabilityService = dependencies.registryReachabilityService || new RegistryReachabilityService()
    this.credentialVault = dependencies.credentialVault || EMPTY_VAULT
  }

  async report(projectPath: string): Promise<CredentialUsageReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const [endpoints, credentials] = await Promise.all([
      this.registryReachabilityService.discover(root),
      this.credentialVault.list()
    ])
    const endpointReports = endpoints.map((endpoint) => endpointCredentialUsage(endpoint, credentials))
    const matchedCredentialIds = new Set(endpointReports.flatMap((endpoint) => endpoint.matches.map((match) => match.id)))
    const unusedCredentials = credentials
      .filter((credential) => !matchedCredentialIds.has(credential.id))
      .map(unusedCredential)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      vaultStatus: this.credentialVault.status(),
      endpoints: endpointReports,
      unusedCredentials,
      summary: summarizeCredentialUsage(endpointReports, credentials, unusedCredentials)
    }
  }

  async exportMarkdown(projectPath: string): Promise<CredentialUsageExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'credential-usage-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderCredentialUsageMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      summary: report.summary
    }
  }

  async exportJson(projectPath: string): Promise<CredentialUsageExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'credential-usage-report.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      summary: report.summary
    }
  }
}

function endpointCredentialUsage(
  endpoint: RegistryEndpoint,
  credentials: CredentialMetadata[]
): CredentialUsageEndpoint {
  const requiresCredential = endpointRequiresCredential(endpoint)
  const matches = credentialMatches(endpoint, credentials, requiresCredential)
  const status = credentialUsageStatus(endpoint, requiresCredential, matches)
  const warnings = credentialUsageWarnings(endpoint, requiresCredential, matches)
  return {
    endpoint,
    requiresCredential,
    status,
    matches,
    warnings,
    recommendation: credentialUsageRecommendation(status, requiresCredential)
  }
}

function credentialMatches(
  endpoint: RegistryEndpoint,
  credentials: CredentialMetadata[],
  requiresCredential: boolean
): CredentialUsageMatch[] {
  return credentials
    .map((credential) => {
      const matchType = credentialMatchType(endpoint, credential, requiresCredential)
      return matchType ? credentialUsageMatch(credential, matchType) : null
    })
    .filter((match): match is CredentialUsageMatch => Boolean(match))
    .sort((a, b) => matchRank(a.matchType) - matchRank(b.matchType) || a.label.localeCompare(b.label))
}

function credentialMatchType(
  endpoint: RegistryEndpoint,
  credential: CredentialMetadata,
  requiresCredential: boolean
): CredentialUsageMatchType | null {
  const endpointUrl = endpoint.normalizedUrl
  const endpointHost = hostName(endpoint.url)
  const service = normalizeComparableUrl(credential.service)
  const credentialUrl = normalizeComparableUrl(credential.url || credential.service)
  const credentialHost = hostName(credential.url || credential.service)
  const managerCompatible = credential.managerId === endpoint.managerId
    || managerAliases(endpoint.managerId).includes(credential.managerId)

  if (managerCompatible && service === endpointUrl) return 'exact-service'
  if (managerCompatible && credentialUrl === endpointUrl) return 'exact-url'
  if (managerCompatible && endpointHost && credentialHost && endpointHost === credentialHost) return 'host'
  if (managerCompatible && credential.service && endpoint.name.toLowerCase().includes(credential.service.toLowerCase())) return 'manager'
  if (managerCompatible && requiresCredential && !endpoint.privateHost) return 'manager'
  return null
}

function credentialUsageMatch(
  credential: CredentialMetadata,
  matchType: CredentialUsageMatchType
): CredentialUsageMatch {
  return {
    id: credential.id,
    label: credential.label,
    managerId: credential.managerId,
    service: credential.service,
    account: credential.account,
    kind: credential.kind,
    url: credential.url,
    encrypted: credential.encrypted,
    storage: credential.storage,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
    lastUsedAt: credential.lastUsedAt,
    matchType
  }
}

function credentialUsageStatus(
  endpoint: RegistryEndpoint,
  requiresCredential: boolean,
  matches: CredentialUsageMatch[]
): CredentialUsageStatus {
  if (requiresCredential && matches.length === 0) return 'missing'
  if (matches.some((match) => !match.encrypted)) return 'insecure-storage'
  if (!endpoint.secure) return 'insecure-endpoint'
  if (matches.length > 0 && matches.every((match) => match.matchType === 'manager')) return 'weak-match'
  if (matches.length > 0) return 'covered'
  return 'public'
}

function endpointRequiresCredential(endpoint: RegistryEndpoint): boolean {
  return Boolean(
    endpoint.privateHost ||
    !endpoint.secure ||
    /publish/i.test(endpoint.name) ||
    /upload/i.test(endpoint.name)
  )
}

function credentialUsageWarnings(
  endpoint: RegistryEndpoint,
  requiresCredential: boolean,
  matches: CredentialUsageMatch[]
): string[] {
  const warnings: string[] = []
  if (requiresCredential && matches.length === 0) {
    warnings.push('No credential metadata matches this endpoint.')
  }
  if (!endpoint.secure) {
    warnings.push('Endpoint uses HTTP; credentials may be exposed in transit.')
  }
  if (matches.some((match) => !match.encrypted)) {
    warnings.push('One or more matching credentials are stored without OS-backed encryption.')
  }
  if (matches.length > 0 && matches.every((match) => match.matchType === 'manager')) {
    warnings.push('Only weak manager-level credential matches were found; prefer URL or host-scoped credentials.')
  }
  return warnings
}

function credentialUsageRecommendation(status: CredentialUsageStatus, requiresCredential: boolean): string {
  if (status === 'missing') return 'Create a scoped credential for this endpoint before restore, install, publish, or deploy operations.'
  if (status === 'insecure-storage') return 'Rotate or re-save the matching credential after enabling OS-backed secure storage.'
  if (status === 'insecure-endpoint') return 'Move this endpoint to HTTPS or avoid sending credentials to it.'
  if (status === 'weak-match') return 'Add a URL-scoped credential so automated operations do not rely on broad manager-level metadata.'
  if (status === 'covered') return 'Credential metadata is available; verify expiry and least privilege before release.'
  return requiresCredential
    ? 'Credential metadata is not required by current heuristics, but review access before production changes.'
    : 'No credential action required for this public endpoint.'
}

function summarizeCredentialUsage(
  endpoints: CredentialUsageEndpoint[],
  credentials: CredentialMetadata[],
  unusedCredentials: CredentialUsageUnusedCredential[]
): CredentialUsageSummary {
  return {
    endpointCount: endpoints.length,
    privateEndpointCount: endpoints.filter((endpoint) => endpoint.endpoint.privateHost).length,
    credentialCount: credentials.length,
    coveredEndpointCount: endpoints.filter((endpoint) => endpoint.status === 'covered').length,
    missingCredentialEndpointCount: endpoints.filter((endpoint) => endpoint.status === 'missing').length,
    weakMatchEndpointCount: endpoints.filter((endpoint) => endpoint.status === 'weak-match').length,
    insecureStorageEndpointCount: endpoints.filter((endpoint) => endpoint.status === 'insecure-storage').length,
    insecureEndpointCount: endpoints.filter((endpoint) => endpoint.status === 'insecure-endpoint').length,
    publicEndpointCount: endpoints.filter((endpoint) => endpoint.status === 'public').length,
    unusedCredentialCount: unusedCredentials.length,
    encryptedCredentialCount: credentials.filter((credential) => credential.encrypted).length,
    unencryptedCredentialCount: credentials.filter((credential) => !credential.encrypted).length
  }
}

function unusedCredential(credential: CredentialMetadata): CredentialUsageUnusedCredential {
  return {
    id: credential.id,
    label: credential.label,
    managerId: credential.managerId,
    service: credential.service,
    account: credential.account,
    kind: credential.kind,
    url: credential.url,
    encrypted: credential.encrypted,
    storage: credential.storage,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
    lastUsedAt: credential.lastUsedAt
  }
}

function renderCredentialUsageMarkdown(report: CredentialUsageReport): string {
  const lines = [
    '# Credential Usage Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Vault',
    '',
    `- Available: ${report.vaultStatus.available ? 'yes' : 'no'}`,
    `- Encrypted: ${report.vaultStatus.encrypted ? 'yes' : 'no'}`,
    `- Storage: ${report.vaultStatus.storage}`,
    `- Warning: ${report.vaultStatus.warning || '-'}`,
    '',
    '## Summary',
    '',
    `- Endpoints: ${report.summary.endpointCount}`,
    `- Private/internal endpoints: ${report.summary.privateEndpointCount}`,
    `- Credentials: ${report.summary.credentialCount}`,
    `- Covered endpoints: ${report.summary.coveredEndpointCount}`,
    `- Missing credentials: ${report.summary.missingCredentialEndpointCount}`,
    `- Weak matches: ${report.summary.weakMatchEndpointCount}`,
    `- Insecure storage matches: ${report.summary.insecureStorageEndpointCount}`,
    `- Insecure endpoints: ${report.summary.insecureEndpointCount}`,
    `- Public endpoints: ${report.summary.publicEndpointCount}`,
    `- Unused credentials: ${report.summary.unusedCredentialCount}`,
    '',
    '## Endpoint Mapping',
    '',
    '| Status | Manager | Kind | URL | Source | Required | Matches | Warnings | Recommendation |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ]

  for (const endpoint of report.endpoints) {
    lines.push([
      endpoint.status,
      endpoint.endpoint.managerId || '-',
      endpoint.endpoint.kind,
      escapeMarkdownTable(endpoint.endpoint.url),
      escapeMarkdownTable(endpoint.endpoint.sourceFile),
      endpoint.requiresCredential ? 'yes' : 'no',
      escapeMarkdownTable(endpoint.matches.map(formatMatch).join('; ') || '-'),
      escapeMarkdownTable(endpoint.warnings.join('; ') || '-'),
      escapeMarkdownTable(endpoint.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (report.endpoints.length === 0) {
    lines.push('| public | - | - | - | - | no | - | - | No registry endpoints were discovered. |')
  }

  lines.push('', '## Unused Credentials', '', '| Manager | Label | Service | Account | Encrypted | Storage | Updated | Last used |', '| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const credential of report.unusedCredentials) {
    lines.push([
      credential.managerId,
      escapeMarkdownTable(credential.label),
      escapeMarkdownTable(credential.service),
      escapeMarkdownTable(credential.account || '-'),
      credential.encrypted ? 'yes' : 'no',
      credential.storage,
      credential.updatedAt,
      credential.lastUsedAt || '-'
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (report.unusedCredentials.length === 0) {
    lines.push('| - | - | - | - | - | - | - | - |')
  }

  return `${lines.join('\n')}\n`
}

function formatMatch(match: CredentialUsageMatch): string {
  const scope = [
    match.label,
    match.matchType,
    match.encrypted ? 'encrypted' : 'not encrypted'
  ].join(' / ')
  return `${scope}${match.account ? ` (${match.account})` : ''}`
}

function managerAliases(managerId?: DependencyManagerId): DependencyManagerId[] {
  if (!managerId) return []
  if (managerId === 'pnpm' || managerId === 'yarn' || managerId === 'bun') return ['npm', managerId]
  if (managerId === 'uv' || managerId === 'poetry' || managerId === 'pipenv') return ['pip', managerId]
  if (managerId === 'gradle') return ['maven', 'gradle']
  if (managerId === 'bundler') return ['bundler']
  return [managerId]
}

function matchRank(matchType: CredentialUsageMatchType): number {
  return {
    'exact-service': 0,
    'exact-url': 1,
    host: 2,
    manager: 3
  }[matchType]
}

function normalizeComparableUrl(value: string): string {
  const text = value.trim()
  if (!text) return ''
  const withProtocol = /^[a-z]+:\/\//i.test(text) ? text : `https://${text}`
  return withProtocol.replace(/\/+$/, '').toLowerCase()
}

function hostName(value: string): string {
  try {
    const text = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`
    return new URL(text).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
