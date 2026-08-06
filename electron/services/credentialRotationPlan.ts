import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  CredentialUsageService,
  type CredentialUsageEndpoint,
  type CredentialUsageMatch,
  type CredentialUsageReport,
  type CredentialUsageUnusedCredential
} from './credentialUsage'
import {
  DependencyAutomationPlanService,
  type DependencyAutomationPlanReport
} from './dependencyAutomationPlan'

export type CredentialRotationPlanExportFormat = 'markdown' | 'json'
export type CredentialRotationStatus = 'ready' | 'warning' | 'blocked'
export type CredentialRotationSeverity = 'info' | 'warning' | 'blocked'
export type CredentialRotationActionKind =
  | 'create-credential'
  | 'rotate-credential'
  | 'rescope-credential'
  | 'remove-credential'
  | 'enable-secure-storage'
  | 'configure-automation-secret'
  | 'move-endpoint-to-https'

export interface CredentialRotationCredential {
  id: string
  label: string
  managerId: DependencyManagerId
  service: string
  account?: string
  kind: string
  url?: string
  encrypted: boolean
  storage: string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  ageDays: number
  daysSinceUse?: number
  endpointCount: number
  matchTypes: string[]
  stale: boolean
  unused: boolean
  needsRotation: boolean
}

export interface CredentialRotationEndpoint {
  id: string
  managerId?: DependencyManagerId
  name: string
  url: string
  sourceFile: string
  requiresCredential: boolean
  usageStatus: CredentialUsageEndpoint['status']
  secure: boolean
  privateHost: boolean
  matchCount: number
  recommendation: string
}

export interface CredentialRotationAction {
  id: string
  kind: CredentialRotationActionKind
  severity: CredentialRotationSeverity
  title: string
  summary: string
  recommendation: string
  evidence: string[]
  managerId?: DependencyManagerId
  credentialId?: string
  endpointId?: string
  automationSecret?: string
}

export interface CredentialRotationPlanSummary {
  status: CredentialRotationStatus
  credentialCount: number
  endpointCount: number
  privateEndpointCount: number
  missingCredentialEndpointCount: number
  weakMatchEndpointCount: number
  insecureStorageCredentialCount: number
  insecureEndpointCount: number
  staleCredentialCount: number
  unusedCredentialCount: number
  automationSecretCount: number
  actionCount: number
  blockedActionCount: number
  warningActionCount: number
  vaultEncrypted: boolean
}

export interface CredentialRotationPlanReport {
  generatedAt: string
  projectPath: string
  status: CredentialRotationStatus
  summary: CredentialRotationPlanSummary
  credentials: CredentialRotationCredential[]
  endpoints: CredentialRotationEndpoint[]
  automationSecrets: string[]
  actions: CredentialRotationAction[]
  sources: {
    credentialUsage: Pick<CredentialUsageReport, 'generatedAt' | 'summary' | 'vaultStatus'>
    dependencyAutomation?: Pick<DependencyAutomationPlanReport, 'generatedAt' | 'summary' | 'requiredSecrets'>
    errors: Partial<Record<'credential-usage' | 'dependency-automation', string>>
  }
}

export interface CredentialRotationPlanExportResult {
  path: string
  format: CredentialRotationPlanExportFormat
  generatedAt: string
  status: CredentialRotationStatus
  actionCount: number
  count: number
  summary: CredentialRotationPlanSummary
}

export interface CredentialRotationPlanDependencies {
  credentialUsageService?: CredentialUsageService
  dependencyAutomationPlanService?: DependencyAutomationPlanService
  staleDays?: number
  unusedDays?: number
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const DEFAULT_STALE_DAYS = 90
const DEFAULT_UNUSED_DAYS = 180

export class CredentialRotationPlanService {
  private readonly credentialUsageService: CredentialUsageService
  private readonly dependencyAutomationPlanService: DependencyAutomationPlanService
  private readonly staleDays: number
  private readonly unusedDays: number

  constructor(dependencies: CredentialRotationPlanDependencies = {}) {
    this.credentialUsageService = dependencies.credentialUsageService || new CredentialUsageService()
    this.dependencyAutomationPlanService = dependencies.dependencyAutomationPlanService || new DependencyAutomationPlanService()
    this.staleDays = dependencies.staleDays || DEFAULT_STALE_DAYS
    this.unusedDays = dependencies.unusedDays || DEFAULT_UNUSED_DAYS
  }

  async plan(projectPath: string): Promise<CredentialRotationPlanReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    const usage = await this.credentialUsageService.report(root)
    const automationResult = await capture(() => this.dependencyAutomationPlanService.plan(root))
    const credentials = credentialInventory(usage, this.staleDays, this.unusedDays)
    const endpoints = usage.endpoints.map(rotationEndpoint)
    const automationSecrets = automationResult.value?.requiredSecrets || []
    const actions = buildActions(usage, credentials, automationSecrets, automationResult.error)
    const summary = summarize(usage, credentials, endpoints, automationSecrets, actions)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      credentials,
      endpoints,
      automationSecrets,
      actions,
      sources: {
        credentialUsage: {
          generatedAt: usage.generatedAt,
          summary: usage.summary,
          vaultStatus: usage.vaultStatus
        },
        dependencyAutomation: automationResult.value
          ? {
              generatedAt: automationResult.value.generatedAt,
              summary: automationResult.value.summary,
              requiredSecrets: automationResult.value.requiredSecrets
            }
          : undefined,
        errors: automationResult.error ? { 'dependency-automation': automationResult.error } : {}
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<CredentialRotationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'credential-rotation-plan.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderCredentialRotationMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<CredentialRotationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'credential-rotation-plan.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function credentialInventory(
  usage: CredentialUsageReport,
  staleDays: number,
  unusedDays: number
): CredentialRotationCredential[] {
  const byId = new Map<string, {
    credential: CredentialUsageMatch | CredentialUsageUnusedCredential
    endpointCount: number
    matchTypes: string[]
    unused: boolean
  }>()

  for (const endpoint of usage.endpoints) {
    for (const match of endpoint.matches) {
      const existing = byId.get(match.id)
      if (existing) {
        existing.endpointCount += 1
        existing.matchTypes = unique([...existing.matchTypes, match.matchType])
      } else {
        byId.set(match.id, {
          credential: match,
          endpointCount: 1,
          matchTypes: [match.matchType],
          unused: false
        })
      }
    }
  }

  for (const unused of usage.unusedCredentials) {
    if (byId.has(unused.id)) continue
    byId.set(unused.id, {
      credential: unused,
      endpointCount: 0,
      matchTypes: [],
      unused: true
    })
  }

  return Array.from(byId.entries()).map(([id, item]) => {
    const updatedAge = ageDays(item.credential.updatedAt)
    const daysSinceUse = item.credential.lastUsedAt ? ageDays(item.credential.lastUsedAt) : undefined
    const unused = item.unused || (typeof daysSinceUse === 'number' && daysSinceUse > unusedDays)
    const stale = updatedAge > staleDays
    return {
      id,
      label: item.credential.label,
      managerId: item.credential.managerId,
      service: item.credential.service,
      account: item.credential.account,
      kind: item.credential.kind,
      url: item.credential.url,
      encrypted: item.credential.encrypted,
      storage: item.credential.storage,
      createdAt: item.credential.createdAt,
      updatedAt: item.credential.updatedAt,
      lastUsedAt: item.credential.lastUsedAt,
      ageDays: updatedAge,
      daysSinceUse,
      endpointCount: item.endpointCount,
      matchTypes: item.matchTypes,
      stale,
      unused,
      needsRotation: stale || unused || !item.credential.encrypted || item.matchTypes.includes('manager')
    }
  }).sort((a, b) => Number(b.needsRotation) - Number(a.needsRotation) || b.ageDays - a.ageDays || a.label.localeCompare(b.label))
}

function rotationEndpoint(endpoint: CredentialUsageEndpoint): CredentialRotationEndpoint {
  return {
    id: endpoint.endpoint.id,
    managerId: endpoint.endpoint.managerId,
    name: endpoint.endpoint.name,
    url: endpoint.endpoint.url,
    sourceFile: endpoint.endpoint.sourceFile,
    requiresCredential: endpoint.requiresCredential,
    usageStatus: endpoint.status,
    secure: endpoint.endpoint.secure,
    privateHost: endpoint.endpoint.privateHost,
    matchCount: endpoint.matches.length,
    recommendation: endpoint.recommendation
  }
}

function buildActions(
  usage: CredentialUsageReport,
  credentials: CredentialRotationCredential[],
  automationSecrets: string[],
  automationError?: string
): CredentialRotationAction[] {
  const actions: CredentialRotationAction[] = []

  if (!usage.vaultStatus.encrypted) {
    actions.push(action({
      id: 'vault:enable-secure-storage',
      kind: 'enable-secure-storage',
      severity: 'blocked',
      title: 'Credential vault is not using OS-backed encryption',
      summary: `Current storage is ${usage.vaultStatus.storage}; credential values should be rotated after secure storage is available.`,
      recommendation: 'Enable OS secure storage, then re-save and rotate all registry tokens stored with fallback encoding.',
      evidence: [usage.vaultStatus.warning || usage.vaultStatus.storage]
    }))
  }

  for (const endpoint of usage.endpoints) {
    if (endpoint.status === 'missing') {
      actions.push(action({
        id: `endpoint:${endpoint.endpoint.id}:create-credential`,
        kind: 'create-credential',
        severity: 'blocked',
        title: 'Registry endpoint has no scoped credential',
        summary: `${endpoint.endpoint.url} requires credential metadata but none was found.`,
        recommendation: endpoint.recommendation,
        evidence: [`Source: ${endpoint.endpoint.sourceFile}`, `Manager: ${endpoint.endpoint.managerId || '-'}`],
        managerId: endpoint.endpoint.managerId,
        endpointId: endpoint.endpoint.id
      }))
    }
    if (!endpoint.endpoint.secure) {
      actions.push(action({
        id: `endpoint:${endpoint.endpoint.id}:https`,
        kind: 'move-endpoint-to-https',
        severity: 'blocked',
        title: 'Registry endpoint is not HTTPS',
        summary: `${endpoint.endpoint.url} is configured without HTTPS.`,
        recommendation: 'Move the registry endpoint to HTTPS before sending install, publish, or automation credentials.',
        evidence: [`Source: ${endpoint.endpoint.sourceFile}`],
        managerId: endpoint.endpoint.managerId,
        endpointId: endpoint.endpoint.id
      }))
    }
  }

  for (const credential of credentials) {
    if (!credential.encrypted) {
      actions.push(action({
        id: `credential:${credential.id}:rotate-insecure-storage`,
        kind: 'rotate-credential',
        severity: 'blocked',
        title: 'Credential is stored without encryption',
        summary: `${credential.label} uses ${credential.storage}.`,
        recommendation: 'Rotate this credential and re-save it with OS-backed secure storage enabled.',
        evidence: [`Manager: ${credential.managerId}`, `Updated: ${credential.updatedAt}`],
        managerId: credential.managerId,
        credentialId: credential.id
      }))
    } else if (credential.stale) {
      actions.push(action({
        id: `credential:${credential.id}:rotate-stale`,
        kind: 'rotate-credential',
        severity: 'warning',
        title: 'Credential rotation window is stale',
        summary: `${credential.label} was last updated ${credential.ageDays} day(s) ago.`,
        recommendation: 'Rotate the token or confirm an approved rotation exception before the next release.',
        evidence: [`Updated: ${credential.updatedAt}`, `Last used: ${credential.lastUsedAt || '-'}`],
        managerId: credential.managerId,
        credentialId: credential.id
      }))
    }
    if (credential.matchTypes.includes('manager')) {
      actions.push(action({
        id: `credential:${credential.id}:rescope`,
        kind: 'rescope-credential',
        severity: 'warning',
        title: 'Credential only has broad manager-level matching',
        summary: `${credential.label} matches endpoints by manager metadata instead of URL or host scope.`,
        recommendation: 'Create URL- or host-scoped credential metadata to avoid sending broad tokens to the wrong registry.',
        evidence: [`Match types: ${credential.matchTypes.join(', ')}`],
        managerId: credential.managerId,
        credentialId: credential.id
      }))
    }
    if (credential.unused) {
      actions.push(action({
        id: `credential:${credential.id}:remove-unused`,
        kind: 'remove-credential',
        severity: 'warning',
        title: 'Credential appears unused',
        summary: `${credential.label} is not matched to discovered endpoints${credential.daysSinceUse ? ` and was last used ${credential.daysSinceUse} day(s) ago` : ''}.`,
        recommendation: 'Remove this credential or document why it is retained for an external registry workflow.',
        evidence: [`Service: ${credential.service}`, `Endpoint matches: ${credential.endpointCount}`],
        managerId: credential.managerId,
        credentialId: credential.id
      }))
    }
  }

  for (const secret of automationSecrets) {
    actions.push(action({
      id: `automation-secret:${secret}`,
      kind: 'configure-automation-secret',
      severity: 'info',
      title: 'Automation provider secret placeholder is required',
      summary: `${secret} is referenced by generated Dependabot/Renovate or CI automation configuration.`,
      recommendation: 'Create this secret in the automation provider with least-privilege, repository-scoped credentials.',
      evidence: [`Secret: ${secret}`],
      automationSecret: secret
    }))
  }

  if (automationError) {
    actions.push(action({
      id: 'automation-plan:unavailable',
      kind: 'configure-automation-secret',
      severity: 'warning',
      title: 'Dependency automation evidence is unavailable',
      summary: automationError,
      recommendation: 'Regenerate the rotation plan after dependency automation planning succeeds.',
      evidence: [automationError]
    }))
  }

  return uniqueBy(actions, (item) => item.id)
}

function summarize(
  usage: CredentialUsageReport,
  credentials: CredentialRotationCredential[],
  endpoints: CredentialRotationEndpoint[],
  automationSecrets: string[],
  actions: CredentialRotationAction[]
): CredentialRotationPlanSummary {
  const blockedActionCount = actions.filter((item) => item.severity === 'blocked').length
  const warningActionCount = actions.filter((item) => item.severity === 'warning').length
  const status: CredentialRotationStatus = blockedActionCount > 0 ? 'blocked' : warningActionCount > 0 ? 'warning' : 'ready'
  return {
    status,
    credentialCount: credentials.length,
    endpointCount: endpoints.length,
    privateEndpointCount: endpoints.filter((endpoint) => endpoint.privateHost).length,
    missingCredentialEndpointCount: usage.summary.missingCredentialEndpointCount,
    weakMatchEndpointCount: usage.summary.weakMatchEndpointCount,
    insecureStorageCredentialCount: credentials.filter((credential) => !credential.encrypted).length,
    insecureEndpointCount: usage.summary.insecureEndpointCount,
    staleCredentialCount: credentials.filter((credential) => credential.stale).length,
    unusedCredentialCount: credentials.filter((credential) => credential.unused).length,
    automationSecretCount: automationSecrets.length,
    actionCount: actions.length,
    blockedActionCount,
    warningActionCount,
    vaultEncrypted: usage.vaultStatus.encrypted
  }
}

function renderCredentialRotationMarkdown(report: CredentialRotationPlanReport): string {
  const lines = [
    '# Credential Rotation Plan',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Credentials: ${report.summary.credentialCount}`,
    `- Endpoints: ${report.summary.endpointCount}`,
    `- Private endpoints: ${report.summary.privateEndpointCount}`,
    `- Missing endpoint credentials: ${report.summary.missingCredentialEndpointCount}`,
    `- Weak matches: ${report.summary.weakMatchEndpointCount}`,
    `- Insecure stored credentials: ${report.summary.insecureStorageCredentialCount}`,
    `- Insecure endpoints: ${report.summary.insecureEndpointCount}`,
    `- Stale credentials: ${report.summary.staleCredentialCount}`,
    `- Unused credentials: ${report.summary.unusedCredentialCount}`,
    `- Automation secrets: ${report.summary.automationSecretCount}`,
    `- Actions: ${report.summary.actionCount}`,
    `- Blocked/warning actions: ${report.summary.blockedActionCount}/${report.summary.warningActionCount}`,
    `- Vault encrypted: ${report.summary.vaultEncrypted ? 'yes' : 'no'}`,
    '',
    '## Actions',
    '',
    '| Severity | Kind | Title | Recommendation | Evidence |',
    '| --- | --- | --- | --- | --- |'
  ]

  for (const item of report.actions) {
    lines.push([
      item.severity,
      item.kind,
      markdownCell(item.title),
      markdownCell(item.recommendation),
      markdownCell(item.evidence.join('; ') || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  if (report.actions.length === 0) {
    lines.push('| info | - | No credential rotation actions | - | - |')
  }

  lines.push('', '## Credentials', '', '| Label | Manager | Service | Encrypted | Age | Last used | Matches | Flags |', '| --- | --- | --- | --- | ---: | --- | ---: | --- |')
  for (const credential of report.credentials) {
    lines.push([
      markdownCell(credential.label),
      credential.managerId,
      markdownCell(credential.service),
      credential.encrypted ? 'yes' : 'no',
      String(credential.ageDays),
      credential.lastUsedAt || '-',
      String(credential.endpointCount),
      [
        credential.needsRotation ? 'needs-rotation' : 'ok',
        credential.stale ? 'stale' : '',
        credential.unused ? 'unused' : ''
      ].filter(Boolean).join(', ')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  if (report.credentials.length === 0) {
    lines.push('| - | - | - | - | 0 | - | 0 | - |')
  }

  lines.push('', '## Endpoint Coverage', '', '| Status | Manager | URL | Source | Required | Matches | Recommendation |', '| --- | --- | --- | --- | --- | ---: | --- |')
  for (const endpoint of report.endpoints) {
    lines.push([
      endpoint.usageStatus,
      endpoint.managerId || '-',
      markdownCell(endpoint.url),
      markdownCell(endpoint.sourceFile),
      endpoint.requiresCredential ? 'yes' : 'no',
      String(endpoint.matchCount),
      markdownCell(endpoint.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Automation Secrets', '')
  if (report.automationSecrets.length === 0) {
    lines.push('- No automation secret placeholders were inferred.')
  } else {
    lines.push(...report.automationSecrets.map((secret) => `- ${secret}`))
  }

  return `${lines.join('\n')}\n`
}

function action(input: CredentialRotationAction): CredentialRotationAction {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function exportResult(
  path: string,
  format: CredentialRotationPlanExportFormat,
  report: CredentialRotationPlanReport
): CredentialRotationPlanExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    actionCount: report.summary.actionCount,
    count: report.summary.actionCount,
    summary: report.summary
  }
}

function ageDays(value: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86400000))
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
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
