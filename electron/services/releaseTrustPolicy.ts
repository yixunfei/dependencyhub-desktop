import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { ReleaseApprovalService, type ReleaseApprovalReport } from './releaseApproval'
import { ReleaseEvidenceCompletenessService, type ReleaseEvidenceCompletenessReport } from './releaseEvidenceCompleteness'
import { ReleaseExceptionService, type ReleaseExceptionReport } from './releaseException'
import { ReleaseIntegrityVerificationService, type ReleaseIntegrityVerificationReport } from './releaseIntegrityVerification'
import { ReleaseProvenanceAttestationService, type ReleaseProvenanceAttestationReport } from './releaseProvenanceAttestation'
import { ReleaseSignatureService, type ReleaseSignatureReport } from './releaseSignature'

export type ReleaseTrustPolicyStatus = 'ready' | 'warning' | 'blocked'
export type ReleaseTrustPolicyCheckStatus = 'passed' | 'warning' | 'blocked' | 'info'
export type ReleaseTrustPolicySeverity = 'info' | 'warning' | 'blocked'
export type ReleaseTrustPolicySource =
  | 'release-signature'
  | 'release-integrity'
  | 'release-provenance'
  | 'release-evidence'
  | 'release-approval'
  | 'release-exception'

export interface ReleaseTrustPolicyCheck {
  id: string
  source: ReleaseTrustPolicySource
  status: ReleaseTrustPolicyCheckStatus
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface ReleaseTrustPolicySummary {
  status: ReleaseTrustPolicyStatus
  checkCount: number
  passedCheckCount: number
  warningCheckCount: number
  blockedCheckCount: number
  infoCheckCount: number
  sourceErrorCount: number
  signed: boolean
  signatureVerified: boolean
  integrityVerifiedArtifactCount: number
  integrityRequiredMismatchCount: number
  provenanceGitAvailable: boolean
  provenanceGitDirty: boolean
  evidenceMissingRequiredCount: number
  evidenceIntegrityMismatchCount: number
  approvalRecordCount: number
  activeExceptionCount: number
}

export interface ReleaseTrustPolicyReport {
  generatedAt: string
  projectPath: string
  status: ReleaseTrustPolicyStatus
  summary: ReleaseTrustPolicySummary
  checks: ReleaseTrustPolicyCheck[]
  sources: {
    signature?: Pick<ReleaseSignatureReport, 'generatedAt' | 'status' | 'summary' | 'signature' | 'verification'>
    integrity?: Pick<ReleaseIntegrityVerificationReport, 'generatedAt' | 'status' | 'summary'>
    provenance?: Pick<ReleaseProvenanceAttestationReport, 'generatedAt' | 'status' | 'summary' | 'git' | 'project'>
    evidence?: Pick<ReleaseEvidenceCompletenessReport, 'generatedAt' | 'status' | 'summary'>
    approvals?: Pick<ReleaseApprovalReport, 'generatedAt' | 'summary'>
    exceptions?: Pick<ReleaseExceptionReport, 'generatedAt' | 'summary'>
    errors: Partial<Record<ReleaseTrustPolicySource, string>>
  }
}

export interface ReleaseTrustPolicyExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: ReleaseTrustPolicyStatus
  checkCount: number
  summary: ReleaseTrustPolicySummary
}

export interface ReleaseTrustPolicyDependencies {
  releaseSignatureService?: ReleaseSignatureService
  releaseIntegrityVerificationService?: ReleaseIntegrityVerificationService
  releaseProvenanceAttestationService?: ReleaseProvenanceAttestationService
  releaseEvidenceCompletenessService?: ReleaseEvidenceCompletenessService
  releaseApprovalService?: ReleaseApprovalService
  releaseExceptionService?: ReleaseExceptionService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'release-trust-policy'

export class ReleaseTrustPolicyService {
  private readonly releaseSignatureService: ReleaseSignatureService
  private readonly releaseIntegrityVerificationService: ReleaseIntegrityVerificationService
  private readonly releaseProvenanceAttestationService: ReleaseProvenanceAttestationService
  private readonly releaseEvidenceCompletenessService: ReleaseEvidenceCompletenessService
  private readonly releaseApprovalService: ReleaseApprovalService
  private readonly releaseExceptionService: ReleaseExceptionService

  constructor(dependencies: ReleaseTrustPolicyDependencies = {}) {
    this.releaseSignatureService = dependencies.releaseSignatureService || new ReleaseSignatureService()
    this.releaseIntegrityVerificationService = dependencies.releaseIntegrityVerificationService || new ReleaseIntegrityVerificationService()
    this.releaseProvenanceAttestationService = dependencies.releaseProvenanceAttestationService || new ReleaseProvenanceAttestationService()
    this.releaseEvidenceCompletenessService = dependencies.releaseEvidenceCompletenessService || new ReleaseEvidenceCompletenessService()
    this.releaseApprovalService = dependencies.releaseApprovalService || new ReleaseApprovalService()
    this.releaseExceptionService = dependencies.releaseExceptionService || new ReleaseExceptionService()
  }

  async report(projectPath: string): Promise<ReleaseTrustPolicyReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [
      signatureResult,
      integrityResult,
      provenanceResult,
      evidenceResult,
      approvalResult,
      exceptionResult
    ] = await Promise.all([
      capture(() => this.releaseSignatureService.verify(root)),
      capture(() => this.releaseIntegrityVerificationService.report(root)),
      capture(() => this.releaseProvenanceAttestationService.report(root)),
      capture(() => this.releaseEvidenceCompletenessService.report(root)),
      capture(() => this.releaseApprovalService.report(root)),
      capture(() => this.releaseExceptionService.report(root))
    ])
    const errors = sourceErrors({
      signatureResult,
      integrityResult,
      provenanceResult,
      evidenceResult,
      approvalResult,
      exceptionResult
    })
    const checks = buildChecks({
      signature: signatureResult.value,
      integrity: integrityResult.value,
      provenance: provenanceResult.value,
      evidence: evidenceResult.value,
      approvals: approvalResult.value,
      exceptions: exceptionResult.value,
      errors
    })
    const summary = summarize({
      checks,
      errors,
      signature: signatureResult.value,
      integrity: integrityResult.value,
      provenance: provenanceResult.value,
      evidence: evidenceResult.value,
      approvals: approvalResult.value,
      exceptions: exceptionResult.value
    })

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      checks,
      sources: {
        signature: signatureResult.value
          ? {
              generatedAt: signatureResult.value.generatedAt,
              status: signatureResult.value.status,
              summary: signatureResult.value.summary,
              signature: signatureResult.value.signature,
              verification: signatureResult.value.verification
            }
          : undefined,
        integrity: integrityResult.value
          ? {
              generatedAt: integrityResult.value.generatedAt,
              status: integrityResult.value.status,
              summary: integrityResult.value.summary
            }
          : undefined,
        provenance: provenanceResult.value
          ? {
              generatedAt: provenanceResult.value.generatedAt,
              status: provenanceResult.value.status,
              summary: provenanceResult.value.summary,
              git: provenanceResult.value.git,
              project: provenanceResult.value.project
            }
          : undefined,
        evidence: evidenceResult.value
          ? {
              generatedAt: evidenceResult.value.generatedAt,
              status: evidenceResult.value.status,
              summary: evidenceResult.value.summary
            }
          : undefined,
        approvals: approvalResult.value
          ? {
              generatedAt: approvalResult.value.generatedAt,
              summary: approvalResult.value.summary
            }
          : undefined,
        exceptions: exceptionResult.value
          ? {
              generatedAt: exceptionResult.value.generatedAt,
              summary: exceptionResult.value.summary
            }
          : undefined,
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<ReleaseTrustPolicyExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<ReleaseTrustPolicyExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function buildChecks(input: {
  signature?: ReleaseSignatureReport
  integrity?: ReleaseIntegrityVerificationReport
  provenance?: ReleaseProvenanceAttestationReport
  evidence?: ReleaseEvidenceCompletenessReport
  approvals?: ReleaseApprovalReport
  exceptions?: ReleaseExceptionReport
  errors: Partial<Record<ReleaseTrustPolicySource, string>>
}): ReleaseTrustPolicyCheck[] {
  const checks: ReleaseTrustPolicyCheck[] = []
  for (const [source, error] of Object.entries(input.errors) as Array<[ReleaseTrustPolicySource, string]>) {
    checks.push(check({
      id: `source:${source}`,
      source,
      status: source === 'release-approval' || source === 'release-exception' ? 'warning' : 'blocked',
      title: `${source} source unavailable`,
      summary: error,
      recommendation: 'Generate the missing release evidence artifact and rerun the release trust policy gate.',
      evidence: [error]
    }))
  }

  if (input.signature) {
    const verification = input.signature.verification
    const signed = input.signature.signature.status === 'signed'
    checks.push(check({
      id: 'release-signature:verified',
      source: 'release-signature',
      status: verification.verified && signed
        ? 'passed'
        : verification.status === 'key-unavailable' || verification.status === 'unsigned'
          ? 'warning'
          : 'blocked',
      title: 'Release signature verification',
      summary: verification.verified && signed
        ? 'The exported release signature verifies against the current canonical evidence payload.'
        : verification.details.join(' ') || `Signature verification status is ${verification.status}.`,
      recommendation: verification.verified && signed
        ? 'Keep the release signature JSON with the reviewed release artifacts.'
        : 'Export a signed release signature from an environment with NPM_MANAGER_RELEASE_SIGNING_KEY, then verify it before release approval.',
      evidence: [
        `Signature status: ${input.signature.signature.status}`,
        `Algorithm: ${input.signature.signature.algorithm}`,
        `Verification: ${verification.status}`,
        `Payload SHA-256: ${input.signature.payload.sha256}`
      ]
    }))

    if (input.signature.summary.blockedFindingCount > 0) {
      checks.push(check({
        id: 'release-signature:findings',
        source: 'release-signature',
        status: 'blocked',
        title: 'Release signature findings',
        summary: `${input.signature.summary.blockedFindingCount} blocking release signature finding(s) are present.`,
        recommendation: 'Resolve release signature findings before treating the release evidence set as trusted.',
        evidence: input.signature.findings.slice(0, 8).map((finding) => `${finding.severity}: ${finding.title}`)
      }))
    }
  }

  if (input.integrity) {
    checks.push(check({
      id: 'release-integrity:required-artifacts',
      source: 'release-integrity',
      status: input.integrity.status === 'blocked' || input.integrity.summary.requiredMismatchArtifactCount > 0
        ? 'blocked'
        : input.integrity.status === 'warning'
          ? 'warning'
          : 'passed',
      title: 'Release bundle artifact integrity',
      summary: `${input.integrity.summary.verifiedArtifactCount}/${input.integrity.summary.artifactCount} artifact(s) verified; ${input.integrity.summary.requiredMismatchArtifactCount} required mismatch(es).`,
      recommendation: input.integrity.status === 'blocked'
        ? 'Regenerate the affected evidence artifacts and release bundle, then rerun integrity verification.'
        : 'Keep the integrity verification JSON with the release review package.',
      evidence: [
        `Status: ${input.integrity.status}`,
        `Required missing: ${input.integrity.summary.requiredMissingArtifactCount}`,
        `Required mismatch: ${input.integrity.summary.requiredMismatchArtifactCount}`,
        `Required failed: ${input.integrity.summary.requiredFailedRecordedArtifactCount}`,
        `Required unverifiable: ${input.integrity.summary.requiredUnverifiableArtifactCount}`
      ]
    }))
  }

  if (input.provenance) {
    checks.push(check({
      id: 'release-provenance:source-state',
      source: 'release-provenance',
      status: input.provenance.status === 'blocked'
        ? 'blocked'
        : input.provenance.summary.gitDirty
          ? 'warning'
          : 'passed',
      title: 'Release provenance source state',
      summary: input.provenance.summary.gitAvailable
        ? `Git ${input.provenance.git.shortCommit || input.provenance.git.commit || '-'} on ${input.provenance.git.branch || '-'} is ${input.provenance.summary.gitDirty ? 'dirty' : 'clean'}.`
        : 'Git metadata is unavailable for this release provenance attestation.',
      recommendation: input.provenance.status === 'blocked'
        ? 'Resolve blocked provenance evidence findings and regenerate the provenance attestation.'
        : input.provenance.summary.gitDirty
          ? 'Commit or intentionally document source changes before final release sign-off.'
          : 'Use the recorded commit and artifact digests for audit traceability.',
      evidence: [
        `Status: ${input.provenance.status}`,
        `Project: ${input.provenance.project.name}`,
        `Commit: ${input.provenance.git.commit || '-'}`,
        `Changed files: ${input.provenance.git.changedFileCount ?? '-'}`,
        `Artifact digests: ${input.provenance.summary.artifactCount}`
      ]
    }))
  }

  if (input.evidence) {
    checks.push(check({
      id: 'release-evidence:completeness',
      source: 'release-evidence',
      status: input.evidence.status === 'blocked'
        ? 'blocked'
        : input.evidence.status === 'warning'
          ? 'warning'
          : 'passed',
      title: 'Release evidence completeness',
      summary: `${input.evidence.summary.presentArtifactCount}/${input.evidence.summary.expectedArtifactCount} expected artifact(s) present; ${input.evidence.summary.requiredIntegrityMismatchCount} required integrity mismatch(es).`,
      recommendation: input.evidence.status === 'blocked'
        ? 'Generate missing required release evidence and regenerate the release bundle before sign-off.'
        : 'Retain the evidence completeness report as reviewer sign-off context.',
      evidence: [
        `Missing required: ${input.evidence.summary.missingRequiredArtifactCount}`,
        `Failed required: ${input.evidence.summary.failedRequiredArtifactCount}`,
        `Required integrity mismatch: ${input.evidence.summary.requiredIntegrityMismatchCount}`,
        `Policy required: ${input.evidence.summary.policyRequiredArtifactCount}`
      ]
    }))
  }

  if (input.approvals) {
    const latest = input.approvals.summary.latest
    const status: ReleaseTrustPolicyCheckStatus = latest?.decision === 'rejected'
      ? 'blocked'
      : input.approvals.summary.approved > 0
        ? 'passed'
        : 'warning'
    checks.push(check({
      id: 'release-approval:review',
      source: 'release-approval',
      status,
      title: 'Release approval evidence',
      summary: latest
        ? `Latest release approval decision is ${latest.decision} by ${latest.reviewer}.`
        : 'No release approval evidence has been recorded.',
      recommendation: status === 'blocked'
        ? 'Record a new approved release decision after resolving the rejection reason.'
        : status === 'warning'
          ? 'Record reviewer release approval before final publish or deploy.'
          : 'Keep release approval evidence with the signed release package.',
      evidence: [
        `Total approvals: ${input.approvals.summary.total}`,
        `Approved: ${input.approvals.summary.approved}`,
        `Rejected: ${input.approvals.summary.rejected}`,
        `Latest: ${latest ? `${latest.decision} by ${latest.reviewer}` : '-'}`
      ]
    }))
  }

  if (input.exceptions) {
    checks.push(check({
      id: 'release-exception:active',
      source: 'release-exception',
      status: input.exceptions.summary.active > 0 ? 'warning' : 'passed',
      title: 'Active release exceptions',
      summary: `${input.exceptions.summary.active} active release exception(s), ${input.exceptions.summary.expired} expired, ${input.exceptions.summary.revoked} revoked.`,
      recommendation: input.exceptions.summary.active > 0
        ? 'Review active exceptions and ensure their ticket, expiration, and covered checks are acceptable for this release.'
        : 'No active release exceptions are affecting the trust policy.',
      evidence: [
        `Total exceptions: ${input.exceptions.summary.total}`,
        `Active: ${input.exceptions.summary.active}`,
        `Latest active: ${input.exceptions.summary.latestActive ? input.exceptions.summary.latestActive.id : '-'}`
      ]
    }))
  }

  return checks.slice(0, 200)
}

function summarize(input: {
  checks: ReleaseTrustPolicyCheck[]
  errors: Partial<Record<ReleaseTrustPolicySource, string>>
  signature?: ReleaseSignatureReport
  integrity?: ReleaseIntegrityVerificationReport
  provenance?: ReleaseProvenanceAttestationReport
  evidence?: ReleaseEvidenceCompletenessReport
  approvals?: ReleaseApprovalReport
  exceptions?: ReleaseExceptionReport
}): ReleaseTrustPolicySummary {
  const blockedCheckCount = input.checks.filter((item) => item.status === 'blocked').length
  const warningCheckCount = input.checks.filter((item) => item.status === 'warning').length
  const status: ReleaseTrustPolicyStatus = blockedCheckCount > 0
    ? 'blocked'
    : warningCheckCount > 0
      ? 'warning'
      : 'ready'
  return {
    status,
    checkCount: input.checks.length,
    passedCheckCount: input.checks.filter((item) => item.status === 'passed').length,
    warningCheckCount,
    blockedCheckCount,
    infoCheckCount: input.checks.filter((item) => item.status === 'info').length,
    sourceErrorCount: Object.keys(input.errors).length,
    signed: input.signature?.signature.status === 'signed',
    signatureVerified: Boolean(input.signature?.verification.verified),
    integrityVerifiedArtifactCount: input.integrity?.summary.verifiedArtifactCount || 0,
    integrityRequiredMismatchCount: input.integrity?.summary.requiredMismatchArtifactCount || 0,
    provenanceGitAvailable: Boolean(input.provenance?.summary.gitAvailable),
    provenanceGitDirty: Boolean(input.provenance?.summary.gitDirty),
    evidenceMissingRequiredCount: input.evidence?.summary.missingRequiredArtifactCount || 0,
    evidenceIntegrityMismatchCount: input.evidence?.summary.requiredIntegrityMismatchCount || 0,
    approvalRecordCount: input.approvals?.summary.total || 0,
    activeExceptionCount: input.exceptions?.summary.active || 0
  }
}

function renderMarkdown(report: ReleaseTrustPolicyReport): string {
  const lines = [
    '# Release Trust Policy',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Checks: ${report.summary.checkCount}`,
    `- Passed/warning/blocked: ${report.summary.passedCheckCount}/${report.summary.warningCheckCount}/${report.summary.blockedCheckCount}`,
    `- Source errors: ${report.summary.sourceErrorCount}`,
    `- Signed: ${report.summary.signed ? 'yes' : 'no'}`,
    `- Signature verified: ${report.summary.signatureVerified ? 'yes' : 'no'}`,
    `- Integrity verified artifacts: ${report.summary.integrityVerifiedArtifactCount}`,
    `- Required integrity mismatches: ${report.summary.integrityRequiredMismatchCount}`,
    `- Git dirty: ${report.summary.provenanceGitDirty ? 'yes' : 'no'}`,
    `- Approval records: ${report.summary.approvalRecordCount}`,
    `- Active exceptions: ${report.summary.activeExceptionCount}`,
    '',
    '## Trust Checks',
    '',
    '| Status | Source | Check | Summary | Recommendation |',
    '| --- | --- | --- | --- | --- |'
  ]

  for (const item of report.checks) {
    lines.push([
      item.status,
      item.source,
      markdownCell(item.title),
      markdownCell(item.summary),
      markdownCell(item.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
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

function sourceErrors(input: {
  signatureResult: CaptureResult<ReleaseSignatureReport>
  integrityResult: CaptureResult<ReleaseIntegrityVerificationReport>
  provenanceResult: CaptureResult<ReleaseProvenanceAttestationReport>
  evidenceResult: CaptureResult<ReleaseEvidenceCompletenessReport>
  approvalResult: CaptureResult<ReleaseApprovalReport>
  exceptionResult: CaptureResult<ReleaseExceptionReport>
}): Partial<Record<ReleaseTrustPolicySource, string>> {
  return {
    ...(input.signatureResult.error ? { 'release-signature': input.signatureResult.error } : {}),
    ...(input.integrityResult.error ? { 'release-integrity': input.integrityResult.error } : {}),
    ...(input.provenanceResult.error ? { 'release-provenance': input.provenanceResult.error } : {}),
    ...(input.evidenceResult.error ? { 'release-evidence': input.evidenceResult.error } : {}),
    ...(input.approvalResult.error ? { 'release-approval': input.approvalResult.error } : {}),
    ...(input.exceptionResult.error ? { 'release-exception': input.exceptionResult.error } : {})
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function exportResult(
  path: string,
  format: 'markdown' | 'json',
  report: ReleaseTrustPolicyReport
): ReleaseTrustPolicyExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    checkCount: report.summary.checkCount,
    summary: report.summary
  }
}

function check(input: ReleaseTrustPolicyCheck): ReleaseTrustPolicyCheck {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
