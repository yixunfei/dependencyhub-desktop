import { createHash } from 'crypto'
import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import type { ReleaseProvenanceAttestationReport, ReleaseProvenanceEvidenceDigest } from './releaseProvenanceAttestation'
import type { ReleaseBundleArtifact, ReleaseBundleManifest } from './workspaceGovernance'

export type ReleaseIntegrityVerificationStatus = 'ready' | 'warning' | 'blocked'
export type ReleaseIntegrityVerificationSeverity = 'info' | 'warning' | 'blocked'
export type ReleaseIntegrityArtifactStatus =
  | 'verified'
  | 'missing'
  | 'mismatch'
  | 'failed-recorded'
  | 'unverifiable'
export type ReleaseIntegrityProvenanceStatus =
  | 'matched'
  | 'mismatch'
  | 'not-recorded'
  | 'not-available'

export interface ReleaseIntegrityVerifiedArtifact {
  id: string
  kind: ReleaseBundleArtifact['kind']
  label: string
  format: string
  required: boolean
  ok: boolean
  path?: string
  relativePath?: string
  expectedSha256?: string
  actualSha256?: string
  expectedSizeBytes?: number
  actualSizeBytes?: number
  status: ReleaseIntegrityArtifactStatus
  provenanceStatus: ReleaseIntegrityProvenanceStatus
  provenanceSha256?: string
  provenanceSizeBytes?: number
  issues: string[]
  error?: string
}

export interface ReleaseIntegrityVerificationFinding {
  id: string
  severity: ReleaseIntegrityVerificationSeverity
  artifactId?: string
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface ReleaseIntegrityVerificationSummary {
  status: ReleaseIntegrityVerificationStatus
  artifactCount: number
  requiredArtifactCount: number
  verifiedArtifactCount: number
  missingArtifactCount: number
  mismatchArtifactCount: number
  failedRecordedArtifactCount: number
  unverifiableArtifactCount: number
  requiredMissingArtifactCount: number
  requiredMismatchArtifactCount: number
  requiredFailedRecordedArtifactCount: number
  requiredUnverifiableArtifactCount: number
  provenanceMatchedArtifactCount: number
  provenanceMismatchArtifactCount: number
  provenanceNotRecordedArtifactCount: number
  provenanceAvailable: boolean
  sourceErrorCount: number
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
}

export interface ReleaseIntegrityVerificationReport {
  generatedAt: string
  projectPath: string
  status: ReleaseIntegrityVerificationStatus
  summary: ReleaseIntegrityVerificationSummary
  releaseBundle?: Pick<ReleaseBundleManifest, 'generatedAt' | 'status' | 'score' | 'summary'>
  provenance?: Pick<ReleaseProvenanceAttestationReport, 'generatedAt' | 'status' | 'summary' | 'git' | 'project'>
  artifacts: ReleaseIntegrityVerifiedArtifact[]
  findings: ReleaseIntegrityVerificationFinding[]
  sources: {
    releaseBundleManifestPath: string
    provenanceAttestationPath: string
    errors: Partial<Record<'release-bundle' | 'provenance-attestation', string>>
  }
}

export interface ReleaseIntegrityVerificationExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: ReleaseIntegrityVerificationStatus
  artifactCount: number
  findingCount: number
  summary: ReleaseIntegrityVerificationSummary
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

interface FileDigest {
  sha256: string
  sizeBytes: number
}

const REPORT_DIR = '.npmDesktopManager/reports'
const RELEASE_BUNDLE_MANIFEST = '.npmDesktopManager/reports/release-bundle/release-bundle-manifest.json'
const PROVENANCE_ATTESTATION_JSON = '.npmDesktopManager/reports/release-provenance-attestation.json'
const OUTPUT_STEM = 'release-integrity-verification'

export class ReleaseIntegrityVerificationService {
  async report(projectPath: string): Promise<ReleaseIntegrityVerificationReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [bundleResult, provenanceResult] = await Promise.all([
      capture(() => readReleaseBundleManifest(root)),
      capture(() => readProvenanceAttestation(root))
    ])
    const provenanceMap = provenanceDigestMap(provenanceResult.value)
    const artifacts = bundleResult.value
      ? await Promise.all(bundleResult.value.artifacts.map((artifact) => verifyArtifact(root, artifact, provenanceMap, Boolean(provenanceResult.value))))
      : []
    const errors = sourceErrors(bundleResult, provenanceResult)
    const findings = buildFindings(artifacts, errors)
    const summary = summarize(artifacts, findings, errors, Boolean(provenanceResult.value))

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      releaseBundle: bundleResult.value
        ? {
            generatedAt: bundleResult.value.generatedAt,
            status: bundleResult.value.status,
            score: bundleResult.value.score,
            summary: bundleResult.value.summary
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
      artifacts,
      findings,
      sources: {
        releaseBundleManifestPath: join(root, RELEASE_BUNDLE_MANIFEST),
        provenanceAttestationPath: join(root, PROVENANCE_ATTESTATION_JSON),
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<ReleaseIntegrityVerificationExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<ReleaseIntegrityVerificationExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

async function verifyArtifact(
  root: string,
  artifact: ReleaseBundleArtifact,
  provenanceMap: Map<string, ReleaseProvenanceEvidenceDigest>,
  provenanceAvailable: boolean
): Promise<ReleaseIntegrityVerifiedArtifact> {
  const relativePath = artifact.path ? normalizePath(relative(root, artifact.path)) : undefined
  const provenanceDigest = relativePath ? provenanceMap.get(normalizeKey(relativePath)) : undefined

  if (!artifact.ok) {
    return artifactResult({
      artifact,
      relativePath,
      status: 'failed-recorded',
      provenanceStatus: provenanceStatus(provenanceAvailable, provenanceDigest),
      provenanceDigest,
      issues: [artifact.error || 'Release bundle recorded this artifact as failed.'],
      error: artifact.error
    })
  }

  if (!artifact.path || !artifact.sha256 || typeof artifact.sizeBytes !== 'number') {
    return artifactResult({
      artifact,
      relativePath,
      status: 'unverifiable',
      provenanceStatus: provenanceStatus(provenanceAvailable, provenanceDigest),
      provenanceDigest,
      issues: ['Release bundle artifact is missing path, SHA-256, or byte-size metadata.']
    })
  }

  const digestResult = await capture(() => fileDigest(artifact.path as string))
  if (!digestResult.value) {
    const missing = digestResult.error?.includes('ENOENT') || digestResult.error?.includes('no such file')
    return artifactResult({
      artifact,
      relativePath,
      status: missing ? 'missing' : 'unverifiable',
      provenanceStatus: provenanceStatus(provenanceAvailable, provenanceDigest),
      provenanceDigest,
      issues: [digestResult.error || 'Artifact file could not be read.'],
      error: digestResult.error
    })
  }

  const issues: string[] = []
  if (digestResult.value.sha256 !== artifact.sha256) {
    issues.push(`SHA-256 mismatch: expected ${artifact.sha256}, found ${digestResult.value.sha256}`)
  }
  if (digestResult.value.sizeBytes !== artifact.sizeBytes) {
    issues.push(`Size mismatch: expected ${artifact.sizeBytes} bytes, found ${digestResult.value.sizeBytes} bytes`)
  }
  const provenance = provenanceStatus(provenanceAvailable, provenanceDigest, digestResult.value)
  if (provenance === 'mismatch') {
    issues.push(`Provenance digest mismatch: attestation recorded ${provenanceDigest?.sha256 || '-'} / ${provenanceDigest?.sizeBytes ?? '-'} bytes`)
  }

  return artifactResult({
    artifact,
    relativePath,
    actualDigest: digestResult.value,
    status: issues.some((issue) => issue.startsWith('SHA-256') || issue.startsWith('Size')) ? 'mismatch' : 'verified',
    provenanceStatus: provenance,
    provenanceDigest,
    issues
  })
}

function artifactResult(input: {
  artifact: ReleaseBundleArtifact
  relativePath?: string
  actualDigest?: FileDigest
  status: ReleaseIntegrityArtifactStatus
  provenanceStatus: ReleaseIntegrityProvenanceStatus
  provenanceDigest?: ReleaseProvenanceEvidenceDigest
  issues: string[]
  error?: string
}): ReleaseIntegrityVerifiedArtifact {
  return {
    id: input.artifact.id,
    kind: input.artifact.kind,
    label: input.artifact.label,
    format: input.artifact.format,
    required: input.artifact.required,
    ok: input.artifact.ok,
    path: input.artifact.path,
    relativePath: input.relativePath,
    expectedSha256: input.artifact.sha256,
    actualSha256: input.actualDigest?.sha256,
    expectedSizeBytes: input.artifact.sizeBytes,
    actualSizeBytes: input.actualDigest?.sizeBytes,
    status: input.status,
    provenanceStatus: input.provenanceStatus,
    provenanceSha256: input.provenanceDigest?.sha256,
    provenanceSizeBytes: input.provenanceDigest?.sizeBytes,
    issues: input.issues,
    error: input.error
  }
}

function buildFindings(
  artifacts: ReleaseIntegrityVerifiedArtifact[],
  errors: Partial<Record<'release-bundle' | 'provenance-attestation', string>>
): ReleaseIntegrityVerificationFinding[] {
  const findings: ReleaseIntegrityVerificationFinding[] = []
  if (errors['release-bundle']) {
    findings.push(finding({
      id: 'source:release-bundle',
      severity: 'blocked',
      title: 'Release bundle manifest is unavailable',
      summary: errors['release-bundle'] || 'Release bundle manifest could not be loaded.',
      recommendation: 'Export the aggregate release bundle before running integrity verification.',
      evidence: [errors['release-bundle'] || 'Missing release bundle manifest.']
    }))
  }
  if (errors['provenance-attestation']) {
    findings.push(finding({
      id: 'source:provenance-attestation',
      severity: 'warning',
      title: 'Release provenance attestation is unavailable',
      summary: errors['provenance-attestation'] || 'Release provenance attestation could not be loaded.',
      recommendation: 'Export release provenance so artifact digests can be cross-checked against source attestation.',
      evidence: [errors['provenance-attestation'] || 'Missing release provenance attestation.']
    }))
  }

  for (const artifact of artifacts) {
    if (artifact.status !== 'verified') {
      findings.push(finding({
        id: `artifact:${artifact.id}:${artifact.status}`,
        severity: artifact.required ? 'blocked' : 'warning',
        artifactId: artifact.id,
        title: artifact.status === 'mismatch'
          ? 'Artifact digest or size mismatch'
          : artifact.status === 'missing'
            ? 'Artifact file is missing'
            : artifact.status === 'failed-recorded'
              ? 'Release bundle recorded an export failure'
              : 'Artifact cannot be verified',
        summary: `${artifact.label} (${artifact.format}) is ${artifact.status}.`,
        recommendation: artifact.status === 'mismatch' || artifact.status === 'missing'
          ? 'Regenerate the affected evidence artifact and release bundle, then rerun integrity verification.'
          : 'Resolve the recorded export failure or regenerate the release bundle with complete digest metadata.',
        evidence: artifactEvidence(artifact)
      }))
    } else if (artifact.provenanceStatus === 'mismatch') {
      findings.push(finding({
        id: `artifact:${artifact.id}:provenance-mismatch`,
        severity: 'warning',
        artifactId: artifact.id,
        title: 'Artifact differs from provenance attestation',
        summary: `${artifact.label} verifies against the release bundle but differs from the provenance attestation digest.`,
        recommendation: 'Regenerate release provenance after the release bundle so source attestation and bundle evidence agree.',
        evidence: artifactEvidence(artifact)
      }))
    }
  }

  return findings.slice(0, 500)
}

function summarize(
  artifacts: ReleaseIntegrityVerifiedArtifact[],
  findings: ReleaseIntegrityVerificationFinding[],
  errors: Partial<Record<'release-bundle' | 'provenance-attestation', string>>,
  provenanceAvailable: boolean
): ReleaseIntegrityVerificationSummary {
  const required = artifacts.filter((artifact) => artifact.required)
  const blockedFindingCount = findings.filter((item) => item.severity === 'blocked').length
  const warningFindingCount = findings.filter((item) => item.severity === 'warning').length
  const sourceErrorCount = Object.keys(errors).length
  const status: ReleaseIntegrityVerificationStatus = blockedFindingCount > 0
    ? 'blocked'
    : warningFindingCount > 0 || sourceErrorCount > 0
      ? 'warning'
      : 'ready'

  return {
    status,
    artifactCount: artifacts.length,
    requiredArtifactCount: required.length,
    verifiedArtifactCount: artifacts.filter((artifact) => artifact.status === 'verified').length,
    missingArtifactCount: artifacts.filter((artifact) => artifact.status === 'missing').length,
    mismatchArtifactCount: artifacts.filter((artifact) => artifact.status === 'mismatch').length,
    failedRecordedArtifactCount: artifacts.filter((artifact) => artifact.status === 'failed-recorded').length,
    unverifiableArtifactCount: artifacts.filter((artifact) => artifact.status === 'unverifiable').length,
    requiredMissingArtifactCount: required.filter((artifact) => artifact.status === 'missing').length,
    requiredMismatchArtifactCount: required.filter((artifact) => artifact.status === 'mismatch').length,
    requiredFailedRecordedArtifactCount: required.filter((artifact) => artifact.status === 'failed-recorded').length,
    requiredUnverifiableArtifactCount: required.filter((artifact) => artifact.status === 'unverifiable').length,
    provenanceMatchedArtifactCount: artifacts.filter((artifact) => artifact.provenanceStatus === 'matched').length,
    provenanceMismatchArtifactCount: artifacts.filter((artifact) => artifact.provenanceStatus === 'mismatch').length,
    provenanceNotRecordedArtifactCount: artifacts.filter((artifact) => artifact.provenanceStatus === 'not-recorded').length,
    provenanceAvailable,
    sourceErrorCount,
    findingCount: findings.length,
    blockedFindingCount,
    warningFindingCount
  }
}

async function readReleaseBundleManifest(root: string): Promise<ReleaseBundleManifest | undefined> {
  const path = join(root, RELEASE_BUNDLE_MANIFEST)
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as ReleaseBundleManifest
  } catch (error: any) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

async function readProvenanceAttestation(root: string): Promise<ReleaseProvenanceAttestationReport | undefined> {
  const path = join(root, PROVENANCE_ATTESTATION_JSON)
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as ReleaseProvenanceAttestationReport
  } catch (error: any) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

async function fileDigest(path: string): Promise<FileDigest> {
  const [metadata, content] = await Promise.all([
    stat(path),
    readFile(path)
  ])
  return {
    sha256: createHash('sha256').update(content).digest('hex'),
    sizeBytes: metadata.size
  }
}

function provenanceDigestMap(provenance: ReleaseProvenanceAttestationReport | undefined): Map<string, ReleaseProvenanceEvidenceDigest> {
  return new Map((provenance?.artifacts || []).map((artifact) => [normalizeKey(artifact.relativePath), artifact]))
}

function provenanceStatus(
  provenanceAvailable: boolean,
  provenanceDigest: ReleaseProvenanceEvidenceDigest | undefined,
  actualDigest?: FileDigest
): ReleaseIntegrityProvenanceStatus {
  if (!provenanceAvailable) return 'not-available'
  if (!provenanceDigest) return 'not-recorded'
  if (!actualDigest) return 'not-recorded'
  return provenanceDigest.sha256 === actualDigest.sha256 && provenanceDigest.sizeBytes === actualDigest.sizeBytes
    ? 'matched'
    : 'mismatch'
}

function renderMarkdown(report: ReleaseIntegrityVerificationReport): string {
  const lines = [
    '# Release Integrity Verification',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Artifacts: ${report.summary.artifactCount}`,
    `- Required artifacts: ${report.summary.requiredArtifactCount}`,
    `- Verified artifacts: ${report.summary.verifiedArtifactCount}`,
    `- Missing artifacts: ${report.summary.missingArtifactCount}`,
    `- Mismatched artifacts: ${report.summary.mismatchArtifactCount}`,
    `- Recorded export failures: ${report.summary.failedRecordedArtifactCount}`,
    `- Unverifiable artifacts: ${report.summary.unverifiableArtifactCount}`,
    `- Required missing/mismatch/failed/unverifiable: ${report.summary.requiredMissingArtifactCount}/${report.summary.requiredMismatchArtifactCount}/${report.summary.requiredFailedRecordedArtifactCount}/${report.summary.requiredUnverifiableArtifactCount}`,
    `- Provenance matched/mismatched/not-recorded: ${report.summary.provenanceMatchedArtifactCount}/${report.summary.provenanceMismatchArtifactCount}/${report.summary.provenanceNotRecordedArtifactCount}`,
    `- Findings: ${report.summary.findingCount}`,
    '',
    '## Release Bundle',
    ''
  ]

  if (report.releaseBundle) {
    lines.push(
      `- Generated: ${report.releaseBundle.generatedAt}`,
      `- Status: ${report.releaseBundle.status}`,
      `- Score: ${report.releaseBundle.score}`,
      `- Artifacts: ${report.releaseBundle.summary.artifactCount}`,
      `- Required failed: ${report.releaseBundle.summary.requiredFailedArtifactCount}`
    )
  } else {
    lines.push('- No release bundle manifest found.')
  }

  lines.push('', '## Provenance Attestation', '')
  if (report.provenance) {
    lines.push(
      `- Generated: ${report.provenance.generatedAt}`,
      `- Status: ${report.provenance.status}`,
      `- Git branch: ${report.provenance.git.branch || '-'}`,
      `- Git commit: ${report.provenance.git.shortCommit || report.provenance.git.commit || '-'}`,
      `- Git dirty: ${report.provenance.git.dirty ? 'yes' : 'no'}`
    )
  } else {
    lines.push('- No release provenance attestation found.')
  }

  lines.push(
    '',
    '## Artifact Verification',
    '',
    '| Status | Provenance | Required | Artifact | Kind | Format | Expected SHA-256 | Actual SHA-256 | Size | Path |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |'
  )
  for (const artifact of report.artifacts) {
    lines.push([
      artifact.status,
      artifact.provenanceStatus,
      artifact.required ? 'yes' : 'no',
      markdownCell(artifact.label),
      artifact.kind,
      artifact.format,
      artifact.expectedSha256 ? artifact.expectedSha256.slice(0, 16) : '-',
      artifact.actualSha256 ? artifact.actualSha256.slice(0, 16) : '-',
      typeof artifact.actualSizeBytes === 'number'
        ? `${artifact.actualSizeBytes} B`
        : typeof artifact.expectedSizeBytes === 'number'
          ? `${artifact.expectedSizeBytes} B`
          : '-',
      markdownCell(artifact.relativePath || artifact.path || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.findings.length === 0) {
    lines.push('- No release integrity findings.')
  } else {
    for (const item of report.findings) {
      lines.push(`- ${item.severity}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
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

function sourceErrors(
  bundleResult: CaptureResult<ReleaseBundleManifest | undefined>,
  provenanceResult: CaptureResult<ReleaseProvenanceAttestationReport | undefined>
): Partial<Record<'release-bundle' | 'provenance-attestation', string>> {
  return {
    ...(bundleResult.error ? { 'release-bundle': bundleResult.error } : {}),
    ...(!bundleResult.error && !bundleResult.value ? { 'release-bundle': 'Release bundle manifest has not been generated yet.' } : {}),
    ...(provenanceResult.error ? { 'provenance-attestation': provenanceResult.error } : {}),
    ...(!provenanceResult.error && !provenanceResult.value ? { 'provenance-attestation': 'Release provenance attestation has not been generated yet.' } : {})
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
  report: ReleaseIntegrityVerificationReport
): ReleaseIntegrityVerificationExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    artifactCount: report.summary.artifactCount,
    findingCount: report.summary.findingCount,
    summary: report.summary
  }
}

function finding(input: ReleaseIntegrityVerificationFinding): ReleaseIntegrityVerificationFinding {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function artifactEvidence(artifact: ReleaseIntegrityVerifiedArtifact): string[] {
  return [
    `Artifact: ${artifact.label}`,
    `Path: ${artifact.relativePath || artifact.path || '-'}`,
    `Required: ${artifact.required ? 'yes' : 'no'}`,
    `Expected SHA-256: ${artifact.expectedSha256 || '-'}`,
    `Actual SHA-256: ${artifact.actualSha256 || '-'}`,
    `Expected size: ${typeof artifact.expectedSizeBytes === 'number' ? artifact.expectedSizeBytes : '-'} bytes`,
    `Actual size: ${typeof artifact.actualSizeBytes === 'number' ? artifact.actualSizeBytes : '-'} bytes`,
    `Provenance: ${artifact.provenanceStatus}`,
    ...artifact.issues
  ]
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function normalizeKey(path: string): string {
  return normalizePath(path).replace(/^\.?\//, '').toLowerCase()
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
