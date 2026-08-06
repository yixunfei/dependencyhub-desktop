import { createHash, createHmac } from 'crypto'
import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import type { ReleaseIntegrityVerificationReport } from './releaseIntegrityVerification'
import type { ReleaseProvenanceAttestationReport } from './releaseProvenanceAttestation'
import type { ReleaseBundleManifest } from './workspaceGovernance'

export type ReleaseSignatureStatus = 'ready' | 'warning' | 'blocked'
export type ReleaseSignatureSeverity = 'info' | 'warning' | 'blocked'
export type ReleaseSignatureSourceId =
  | 'release-bundle'
  | 'release-provenance-attestation'
  | 'release-integrity-verification'
export type ReleaseSignatureSourceStatus = 'included' | 'missing' | 'error'
export type ReleaseSignatureEnvelopeStatus = 'signed' | 'unsigned'
export type ReleaseSignatureAlgorithm = 'HMAC-SHA256' | 'SHA-256-DIGEST'
export type ReleaseSignatureVerificationStatus =
  | 'created'
  | 'verified'
  | 'not-signed'
  | 'unsigned'
  | 'key-unavailable'
  | 'mismatch'
  | 'invalid'

export interface ReleaseSignatureSource {
  id: ReleaseSignatureSourceId
  label: string
  required: boolean
  path: string
  relativePath: string
  status: ReleaseSignatureSourceStatus
  sha256?: string
  sizeBytes?: number
  generatedAt?: string
  reportStatus?: string
  error?: string
}

export interface ReleaseSignaturePayloadSource {
  id: ReleaseSignatureSourceId
  relativePath: string
  sha256: string
  sizeBytes: number
  generatedAt?: string
  reportStatus?: string
}

export interface ReleaseSignaturePayload {
  schemaVersion: 'release-signature-v1'
  purpose: 'npmDesktopManager.release-evidence'
  sourceCount: number
  includedSourceCount: number
  sources: ReleaseSignaturePayloadSource[]
  canonicalJson: string
  sha256: string
}

export interface ReleaseSignatureEnvelope {
  status: ReleaseSignatureEnvelopeStatus
  algorithm: ReleaseSignatureAlgorithm
  signer: string
  signedAt: string
  payloadSha256: string
  keyId?: string
  value?: string
}

export interface ReleaseSignatureVerification {
  status: ReleaseSignatureVerificationStatus
  verified: boolean
  checkedAt: string
  signaturePath: string
  details: string[]
  existingSignedAt?: string
  existingSigner?: string
  existingKeyId?: string
}

export interface ReleaseSignatureFinding {
  id: string
  severity: ReleaseSignatureSeverity
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface ReleaseSignatureSummary {
  status: ReleaseSignatureStatus
  sourceCount: number
  requiredSourceCount: number
  includedSourceCount: number
  missingSourceCount: number
  sourceErrorCount: number
  blockedSourceReportCount: number
  warningSourceReportCount: number
  signed: boolean
  hasSigningKey: boolean
  verificationStatus: ReleaseSignatureVerificationStatus
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
}

export interface ReleaseSignatureReport {
  generatedAt: string
  projectPath: string
  status: ReleaseSignatureStatus
  summary: ReleaseSignatureSummary
  payload: ReleaseSignaturePayload
  signature: ReleaseSignatureEnvelope
  verification: ReleaseSignatureVerification
  sources: ReleaseSignatureSource[]
  findings: ReleaseSignatureFinding[]
}

export interface ReleaseSignatureExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: ReleaseSignatureStatus
  signed: boolean
  verificationStatus: ReleaseSignatureVerificationStatus
  sourceCount: number
  findingCount: number
  summary: ReleaseSignatureSummary
}

interface SourceDefinition<T> {
  id: ReleaseSignatureSourceId
  label: string
  relativePath: string
  required: boolean
  metadata: (value: T) => {
    generatedAt?: string
    reportStatus?: string
  }
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

interface SigningContext {
  key?: string
  keyId?: string
  signer: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'release-signature'
const SIGNING_KEY_ENV = 'NPM_MANAGER_RELEASE_SIGNING_KEY'
const SIGNER_ENV = 'NPM_MANAGER_RELEASE_SIGNER'

const SOURCE_DEFINITIONS: [
  SourceDefinition<ReleaseBundleManifest>,
  SourceDefinition<ReleaseProvenanceAttestationReport>,
  SourceDefinition<ReleaseIntegrityVerificationReport>
] = [
  {
    id: 'release-bundle',
    label: 'Release bundle manifest',
    relativePath: '.npmDesktopManager/reports/release-bundle/release-bundle-manifest.json',
    required: true,
    metadata: (value) => ({
      generatedAt: value.generatedAt,
      reportStatus: value.status
    })
  },
  {
    id: 'release-provenance-attestation',
    label: 'Release provenance attestation',
    relativePath: '.npmDesktopManager/reports/release-provenance-attestation.json',
    required: true,
    metadata: (value) => ({
      generatedAt: value.generatedAt,
      reportStatus: value.status
    })
  },
  {
    id: 'release-integrity-verification',
    label: 'Release integrity verification',
    relativePath: '.npmDesktopManager/reports/release-integrity-verification.json',
    required: true,
    metadata: (value) => ({
      generatedAt: value.generatedAt,
      reportStatus: value.status
    })
  }
]

export class ReleaseSignatureService {
  async report(projectPath: string): Promise<ReleaseSignatureReport> {
    return this.buildReport(projectPath, 'report')
  }

  async verify(projectPath: string): Promise<ReleaseSignatureReport> {
    return this.buildReport(projectPath, 'verify')
  }

  async exportMarkdown(projectPath: string): Promise<ReleaseSignatureExportResult> {
    const report = await this.buildReport(projectPath, 'export')
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<ReleaseSignatureExportResult> {
    const report = await this.buildReport(projectPath, 'export')
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }

  private async buildReport(projectPath: string, mode: 'report' | 'verify' | 'export'): Promise<ReleaseSignatureReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const generatedAt = new Date().toISOString()
    const sources = await Promise.all(SOURCE_DEFINITIONS.map((definition) => readSource(root, definition)))
    const payload = buildPayload(sources)
    const signing = signingContext()
    const signature = buildSignature(payload, signing, generatedAt)
    const verification = mode === 'export'
      ? createdVerification(root, signature, generatedAt)
      : await verifyExistingSignature(root, payload, signing, generatedAt)
    const findings = buildFindings(sources, signature, verification, mode)
    const summary = summarize(sources, signature, verification, findings)

    return {
      generatedAt,
      projectPath: root,
      status: summary.status,
      summary,
      payload,
      signature,
      verification,
      sources,
      findings
    }
  }
}

async function readSource<T>(root: string, definition: SourceDefinition<T>): Promise<ReleaseSignatureSource> {
  const path = join(root, definition.relativePath)
  try {
    const [metadata, content] = await Promise.all([
      stat(path),
      readFile(path)
    ])
    const parsed = JSON.parse(content.toString('utf-8')) as T
    const extracted = definition.metadata(parsed)
    return {
      id: definition.id,
      label: definition.label,
      required: definition.required,
      path,
      relativePath: normalizePath(relative(root, path)),
      status: 'included',
      sha256: createHash('sha256').update(content).digest('hex'),
      sizeBytes: metadata.size,
      generatedAt: extracted.generatedAt,
      reportStatus: extracted.reportStatus
    }
  } catch (error: any) {
    const missing = error?.code === 'ENOENT'
    return {
      id: definition.id,
      label: definition.label,
      required: definition.required,
      path,
      relativePath: normalizePath(relative(root, path)),
      status: missing ? 'missing' : 'error',
      error: missing ? 'Source report has not been generated yet.' : error?.message || String(error)
    }
  }
}

function buildPayload(sources: ReleaseSignatureSource[]): ReleaseSignaturePayload {
  const payloadSources = sources
    .filter((source): source is ReleaseSignatureSource & { sha256: string; sizeBytes: number } => (
      source.status === 'included' &&
      typeof source.sha256 === 'string' &&
      typeof source.sizeBytes === 'number'
    ))
    .map((source) => ({
      id: source.id,
      relativePath: source.relativePath,
      sha256: source.sha256,
      sizeBytes: source.sizeBytes,
      generatedAt: source.generatedAt,
      reportStatus: source.reportStatus
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const canonicalValue = {
    schemaVersion: 'release-signature-v1',
    purpose: 'npmDesktopManager.release-evidence',
    sourceCount: sources.length,
    includedSourceCount: payloadSources.length,
    sources: payloadSources
  }
  const canonicalJson = stableStringify(canonicalValue)
  return {
    ...canonicalValue,
    schemaVersion: 'release-signature-v1',
    purpose: 'npmDesktopManager.release-evidence',
    canonicalJson,
    sha256: createHash('sha256').update(canonicalJson).digest('hex')
  }
}

function signingContext(): SigningContext {
  const key = process.env[SIGNING_KEY_ENV]
  return {
    key,
    keyId: key ? createHash('sha256').update(key).digest('hex').slice(0, 16) : undefined,
    signer: process.env[SIGNER_ENV] || process.env.GITHUB_ACTOR || process.env.USERNAME || process.env.USER || 'local-user'
  }
}

function buildSignature(payload: ReleaseSignaturePayload, signing: SigningContext, signedAt: string): ReleaseSignatureEnvelope {
  if (!signing.key) {
    return {
      status: 'unsigned',
      algorithm: 'SHA-256-DIGEST',
      signer: signing.signer,
      signedAt,
      payloadSha256: payload.sha256
    }
  }

  return {
    status: 'signed',
    algorithm: 'HMAC-SHA256',
    signer: signing.signer,
    signedAt,
    payloadSha256: payload.sha256,
    keyId: signing.keyId,
    value: signPayload(payload.canonicalJson, signing.key)
  }
}

function createdVerification(
  root: string,
  signature: ReleaseSignatureEnvelope,
  checkedAt: string
): ReleaseSignatureVerification {
  return {
    status: signature.status === 'signed' ? 'created' : 'unsigned',
    verified: signature.status === 'signed',
    checkedAt,
    signaturePath: join(root, REPORT_DIR, `${OUTPUT_STEM}.json`),
    details: signature.status === 'signed'
      ? ['Signature envelope created for the current canonical release evidence payload.']
      : [`No ${SIGNING_KEY_ENV} value was provided, so the envelope records only the payload digest.`],
    existingSigner: signature.signer,
    existingSignedAt: signature.signedAt,
    existingKeyId: signature.keyId
  }
}

async function verifyExistingSignature(
  root: string,
  payload: ReleaseSignaturePayload,
  signing: SigningContext,
  checkedAt: string
): Promise<ReleaseSignatureVerification> {
  const signaturePath = join(root, REPORT_DIR, `${OUTPUT_STEM}.json`)
  const result = await capture(async () => JSON.parse(await readFile(signaturePath, 'utf-8')) as Partial<ReleaseSignatureReport>)
  if (!result.value) {
    return {
      status: result.error?.includes('ENOENT') || result.error?.includes('no such file') ? 'not-signed' : 'invalid',
      verified: false,
      checkedAt,
      signaturePath,
      details: [result.error?.includes('ENOENT') || result.error?.includes('no such file')
        ? 'No release signature envelope has been exported yet.'
        : result.error || 'Existing release signature envelope could not be read.']
    }
  }

  const existing = result.value
  const existingPayloadSha = existing.signature?.payloadSha256 || existing.payload?.sha256
  if (!existingPayloadSha || !existing.signature) {
    return {
      status: 'invalid',
      verified: false,
      checkedAt,
      signaturePath,
      details: ['Existing release signature envelope is missing payload or signature metadata.']
    }
  }

  const base = {
    checkedAt,
    signaturePath,
    existingSignedAt: existing.signature.signedAt,
    existingSigner: existing.signature.signer,
    existingKeyId: existing.signature.keyId
  }

  if (existingPayloadSha !== payload.sha256) {
    return {
      ...base,
      status: 'mismatch',
      verified: false,
      details: [
        `Existing payload SHA-256 ${existingPayloadSha} does not match current payload ${payload.sha256}.`
      ]
    }
  }

  if (existing.signature.status !== 'signed' || existing.signature.algorithm !== 'HMAC-SHA256') {
    return {
      ...base,
      status: 'unsigned',
      verified: false,
      details: ['Existing envelope matches the current payload digest but does not contain an HMAC signature.']
    }
  }

  if (!signing.key) {
    return {
      ...base,
      status: 'key-unavailable',
      verified: false,
      details: [`Existing signed envelope matches the current payload digest, but ${SIGNING_KEY_ENV} is unavailable for HMAC verification.`]
    }
  }

  const expected = signPayload(payload.canonicalJson, signing.key)
  if (existing.signature.value !== expected) {
    return {
      ...base,
      status: 'invalid',
      verified: false,
      details: ['Existing HMAC signature does not match the current canonical payload and signing key.']
    }
  }

  return {
    ...base,
    status: 'verified',
    verified: true,
    details: ['Existing HMAC signature verifies against the current canonical release evidence payload.']
  }
}

function buildFindings(
  sources: ReleaseSignatureSource[],
  signature: ReleaseSignatureEnvelope,
  verification: ReleaseSignatureVerification,
  mode: 'report' | 'verify' | 'export'
): ReleaseSignatureFinding[] {
  const findings: ReleaseSignatureFinding[] = []
  for (const source of sources) {
    if (source.status !== 'included') {
      findings.push(finding({
        id: `source:${source.id}:${source.status}`,
        severity: source.required ? 'blocked' : 'warning',
        title: `${source.label} is ${source.status}`,
        summary: source.error || `${source.label} could not be included in the signed release evidence payload.`,
        recommendation: 'Generate release bundle, provenance, and integrity verification evidence before signing the release.',
        evidence: [`Path: ${source.relativePath}`, `Status: ${source.status}`, `Error: ${source.error || '-'}`]
      }))
    } else if (source.reportStatus === 'blocked') {
      findings.push(finding({
        id: `source:${source.id}:blocked-report`,
        severity: 'blocked',
        title: `${source.label} is blocked`,
        summary: `${source.label} reports blocked status and should not be signed off as release-ready.`,
        recommendation: 'Resolve the blocked source report, regenerate evidence, and sign the release again.',
        evidence: sourceEvidence(source)
      }))
    } else if (source.reportStatus === 'warning') {
      findings.push(finding({
        id: `source:${source.id}:warning-report`,
        severity: 'warning',
        title: `${source.label} has warnings`,
        summary: `${source.label} reports warning status; reviewers should accept or resolve the warning before release.`,
        recommendation: 'Review the warning source report before treating the signature as final release approval.',
        evidence: sourceEvidence(source)
      }))
    }
  }

  if (signature.status !== 'signed') {
    findings.push(finding({
      id: 'signature:unsigned',
      severity: 'warning',
      title: 'Release evidence payload is not HMAC signed',
      summary: `Set ${SIGNING_KEY_ENV} to create a keyed HMAC signature instead of a digest-only envelope.`,
      recommendation: 'Configure a release signing secret in the local shell or CI environment before exporting release signatures.',
      evidence: [`Algorithm: ${signature.algorithm}`, `Payload SHA-256: ${signature.payloadSha256}`]
    }))
  }

  if (mode !== 'export') {
    if (verification.status === 'not-signed') {
      findings.push(finding({
        id: 'signature:not-signed',
        severity: 'warning',
        title: 'Release signature envelope has not been exported',
        summary: 'No release-signature.json file exists for the current release evidence payload.',
        recommendation: 'Export the release signature after bundle, provenance, and integrity evidence are generated.',
        evidence: verification.details
      }))
    } else if (verification.status === 'unsigned' || verification.status === 'key-unavailable') {
      findings.push(finding({
        id: `signature:${verification.status}`,
        severity: 'warning',
        title: verification.status === 'unsigned' ? 'Existing envelope is digest-only' : 'Signing key unavailable for verification',
        summary: verification.details.join(' '),
        recommendation: verification.status === 'unsigned'
          ? `Re-export with ${SIGNING_KEY_ENV} to create a keyed signature.`
          : `Provide ${SIGNING_KEY_ENV} to verify the existing HMAC signature value.`,
        evidence: verification.details
      }))
    } else if (verification.status === 'mismatch' || verification.status === 'invalid') {
      findings.push(finding({
        id: `signature:${verification.status}`,
        severity: 'blocked',
        title: verification.status === 'mismatch' ? 'Release signature payload mismatch' : 'Release signature is invalid',
        summary: verification.details.join(' '),
        recommendation: 'Regenerate release evidence and export a new release signature from a trusted signing environment.',
        evidence: verification.details
      }))
    }
  }

  return findings.slice(0, 200)
}

function summarize(
  sources: ReleaseSignatureSource[],
  signature: ReleaseSignatureEnvelope,
  verification: ReleaseSignatureVerification,
  findings: ReleaseSignatureFinding[]
): ReleaseSignatureSummary {
  const required = sources.filter((source) => source.required)
  const blockedFindingCount = findings.filter((item) => item.severity === 'blocked').length
  const warningFindingCount = findings.filter((item) => item.severity === 'warning').length
  const status: ReleaseSignatureStatus = blockedFindingCount > 0
    ? 'blocked'
    : warningFindingCount > 0
      ? 'warning'
      : 'ready'

  return {
    status,
    sourceCount: sources.length,
    requiredSourceCount: required.length,
    includedSourceCount: sources.filter((source) => source.status === 'included').length,
    missingSourceCount: sources.filter((source) => source.status === 'missing').length,
    sourceErrorCount: sources.filter((source) => source.status === 'error').length,
    blockedSourceReportCount: sources.filter((source) => source.reportStatus === 'blocked').length,
    warningSourceReportCount: sources.filter((source) => source.reportStatus === 'warning').length,
    signed: signature.status === 'signed',
    hasSigningKey: Boolean(signature.keyId),
    verificationStatus: verification.status,
    findingCount: findings.length,
    blockedFindingCount,
    warningFindingCount
  }
}

function renderMarkdown(report: ReleaseSignatureReport): string {
  const lines = [
    '# Release Signature',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Sources included: ${report.summary.includedSourceCount}/${report.summary.sourceCount}`,
    `- Missing sources: ${report.summary.missingSourceCount}`,
    `- Source errors: ${report.summary.sourceErrorCount}`,
    `- Source report blocked/warning: ${report.summary.blockedSourceReportCount}/${report.summary.warningSourceReportCount}`,
    `- Signed: ${report.summary.signed ? 'yes' : 'no'}`,
    `- Signing key available: ${report.summary.hasSigningKey ? 'yes' : 'no'}`,
    `- Verification: ${report.summary.verificationStatus}`,
    `- Findings: ${report.summary.findingCount}`,
    '',
    '## Signature Envelope',
    '',
    `- Algorithm: ${report.signature.algorithm}`,
    `- Signer: ${report.signature.signer}`,
    `- Signed at: ${report.signature.signedAt}`,
    `- Key ID: ${report.signature.keyId || '-'}`,
    `- Payload SHA-256: ${report.signature.payloadSha256}`,
    `- Signature: ${report.signature.value || '-'}`,
    '',
    '## Verification',
    '',
    `- Status: ${report.verification.status}`,
    `- Verified: ${report.verification.verified ? 'yes' : 'no'}`,
    `- Signature path: ${report.verification.signaturePath}`,
    `- Existing signer: ${report.verification.existingSigner || '-'}`,
    `- Existing signed at: ${report.verification.existingSignedAt || '-'}`,
    `- Existing key ID: ${report.verification.existingKeyId || '-'}`,
    ''
  ]

  for (const detail of report.verification.details) {
    lines.push(`- ${detail}`)
  }

  lines.push(
    '',
    '## Signed Sources',
    '',
    '| Status | Source | Report status | Size | SHA-256 | Generated | Path |',
    '| --- | --- | --- | ---: | --- | --- | --- |'
  )
  for (const source of report.sources) {
    lines.push([
      source.status,
      markdownCell(source.label),
      source.reportStatus || '-',
      typeof source.sizeBytes === 'number' ? `${source.sizeBytes} B` : '-',
      source.sha256 ? source.sha256.slice(0, 16) : '-',
      source.generatedAt || '-',
      markdownCell(source.relativePath)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.findings.length === 0) {
    lines.push('- No release signature findings.')
  } else {
    for (const item of report.findings) {
      lines.push(`- ${item.severity}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function exportResult(
  path: string,
  format: 'markdown' | 'json',
  report: ReleaseSignatureReport
): ReleaseSignatureExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    signed: report.signature.status === 'signed',
    verificationStatus: report.verification.status,
    sourceCount: report.summary.sourceCount,
    findingCount: report.summary.findingCount,
    summary: report.summary
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function finding(input: ReleaseSignatureFinding): ReleaseSignatureFinding {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function sourceEvidence(source: ReleaseSignatureSource): string[] {
  return [
    `Source: ${source.label}`,
    `Path: ${source.relativePath}`,
    `Status: ${source.status}`,
    `Report status: ${source.reportStatus || '-'}`,
    `Generated: ${source.generatedAt || '-'}`,
    `SHA-256: ${source.sha256 || '-'}`,
    `Size: ${typeof source.sizeBytes === 'number' ? source.sizeBytes : '-'} bytes`
  ]
}

function signPayload(canonicalJson: string, key: string): string {
  return createHmac('sha256', key).update(canonicalJson).digest('hex')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
