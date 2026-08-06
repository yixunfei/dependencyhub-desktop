import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import { PolicyAsCodePackService, type PolicyAsCodeReport } from './policyAsCodePack'
import {
  ReportArtifactIndexService,
  type ReportArtifactIndexReport,
  type ReportArtifactRecord
} from './reportArtifactIndex'
import type { ReleaseBundleArtifact, ReleaseBundleManifest } from './workspaceGovernance'

export type ReleaseEvidenceCompletenessStatus = 'ready' | 'warning' | 'blocked'
export type ReleaseEvidenceCompletenessSeverity = 'info' | 'warning' | 'blocked'
export type ReleaseEvidenceCompletenessSource =
  | 'policy-as-code'
  | 'release-bundle'
  | 'report-library'
  | 'release-evidence'

export interface ReleaseEvidenceExpectedArtifact {
  id: string
  source: ReleaseEvidenceCompletenessSource
  label: string
  required: boolean
  expectedPath?: string
  expectedSha256?: string
  expectedSizeBytes?: number
  status: 'present' | 'missing' | 'failed' | 'mismatch'
  integrityStatus: 'not-applicable' | 'verified' | 'mismatch'
  matchedArtifactCount: number
  matchedArtifacts: Array<Pick<ReportArtifactRecord, 'id' | 'name' | 'category' | 'format' | 'relativePath' | 'sizeBytes' | 'sha256' | 'modifiedAt'>>
  mismatchReasons: string[]
  error?: string
}

export interface ReleaseEvidenceCompletenessFinding {
  id: string
  severity: ReleaseEvidenceCompletenessSeverity
  source: ReleaseEvidenceCompletenessSource
  title: string
  summary: string
  recommendation: string
  evidence: string[]
}

export interface ReleaseEvidenceCompletenessSummary {
  status: ReleaseEvidenceCompletenessStatus
  expectedArtifactCount: number
  requiredArtifactCount: number
  presentArtifactCount: number
  missingArtifactCount: number
  missingRequiredArtifactCount: number
  failedArtifactCount: number
  failedRequiredArtifactCount: number
  integrityMismatchCount: number
  requiredIntegrityMismatchCount: number
  policyRequiredArtifactCount: number
  releaseBundleArtifactCount: number
  releaseBundleRequiredArtifactCount: number
  reportArtifactCount: number
  totalSizeBytes: number
  latestModifiedAt?: string
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
}

export interface ReleaseEvidenceCompletenessReport {
  generatedAt: string
  projectPath: string
  reportDir: string
  status: ReleaseEvidenceCompletenessStatus
  summary: ReleaseEvidenceCompletenessSummary
  expectedArtifacts: ReleaseEvidenceExpectedArtifact[]
  findings: ReleaseEvidenceCompletenessFinding[]
  sources: {
    reportArtifacts: Pick<ReportArtifactIndexReport, 'generatedAt' | 'summary'>
    policyAsCode?: Pick<PolicyAsCodeReport, 'generatedAt' | 'status' | 'summary'>
    releaseBundle?: Pick<ReleaseBundleManifest, 'generatedAt' | 'status' | 'score' | 'summary'>
    releaseBundleManifestPath?: string
    errors: Partial<Record<ReleaseEvidenceCompletenessSource, string>>
  }
}

export interface ReleaseEvidenceCompletenessExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: ReleaseEvidenceCompletenessStatus
  findingCount: number
  count: number
  summary: ReleaseEvidenceCompletenessSummary
}

export interface ReleaseEvidenceCompletenessDependencies {
  reportArtifactIndexService?: ReportArtifactIndexService
  policyAsCodePackService?: PolicyAsCodePackService
}

interface ExpectedCandidate {
  id: string
  source: ReleaseEvidenceCompletenessSource
  label: string
  required: boolean
  expectedPath?: string
  bundleArtifact?: ReleaseBundleArtifact
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const RELEASE_BUNDLE_MANIFEST = '.npmDesktopManager/reports/release-bundle/release-bundle-manifest.json'

export class ReleaseEvidenceCompletenessService {
  private readonly reportArtifactIndexService: ReportArtifactIndexService
  private readonly policyAsCodePackService: PolicyAsCodePackService

  constructor(dependencies: ReleaseEvidenceCompletenessDependencies = {}) {
    this.reportArtifactIndexService = dependencies.reportArtifactIndexService || new ReportArtifactIndexService()
    this.policyAsCodePackService = dependencies.policyAsCodePackService || new PolicyAsCodePackService()
  }

  async report(projectPath: string): Promise<ReleaseEvidenceCompletenessReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [artifactResult, policyResult, bundleResult] = await Promise.all([
      capture(() => this.reportArtifactIndexService.report(root)),
      capture(() => this.policyAsCodePackService.report(root)),
      capture(() => readReleaseBundleManifest(root))
    ])

    if (!artifactResult.value) {
      throw new Error(artifactResult.error || 'Report artifact index is unavailable')
    }

    const expectedArtifacts = expectedArtifactsFromSources({
      root,
      artifacts: artifactResult.value.artifacts,
      policy: policyResult.value,
      bundle: bundleResult.value
    })
    const findings = buildFindings({
      expectedArtifacts,
      policyResult,
      bundleResult,
      artifactResult
    })
    const summary = summarize(artifactResult.value, expectedArtifacts, findings, policyResult.value, bundleResult.value)
    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      reportDir: join(root, REPORT_DIR),
      status: summary.status,
      summary,
      expectedArtifacts,
      findings,
      sources: {
        reportArtifacts: {
          generatedAt: artifactResult.value.generatedAt,
          summary: artifactResult.value.summary
        },
        policyAsCode: policyResult.value
          ? {
              generatedAt: policyResult.value.generatedAt,
              status: policyResult.value.status,
              summary: policyResult.value.summary
            }
          : undefined,
        releaseBundle: bundleResult.value
          ? {
              generatedAt: bundleResult.value.generatedAt,
              status: bundleResult.value.status,
              score: bundleResult.value.score,
              summary: bundleResult.value.summary
            }
          : undefined,
        releaseBundleManifestPath: join(root, RELEASE_BUNDLE_MANIFEST),
        errors: sourceErrors(artifactResult, policyResult, bundleResult)
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<ReleaseEvidenceCompletenessExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'release-evidence-completeness.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<ReleaseEvidenceCompletenessExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'release-evidence-completeness.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function expectedArtifactsFromSources(input: {
  root: string
  artifacts: ReportArtifactRecord[]
  policy?: PolicyAsCodeReport
  bundle?: ReleaseBundleManifest
}): ReleaseEvidenceExpectedArtifact[] {
  const candidates: ExpectedCandidate[] = []

  for (const artifact of input.policy?.pack.ci.requiredArtifacts || []) {
    candidates.push({
      id: `policy:${artifact}`,
      source: 'policy-as-code',
      label: artifact,
      required: true,
      expectedPath: join(REPORT_DIR, artifact).replace(/\\/g, '/')
    })
  }

  if (input.bundle) {
    candidates.push({
      id: 'release-bundle:manifest',
      source: 'release-bundle',
      label: 'Release bundle manifest',
      required: true,
      expectedPath: RELEASE_BUNDLE_MANIFEST
    })
    for (const artifact of input.bundle.artifacts) {
      candidates.push({
        id: `release-bundle:${artifact.id}`,
        source: 'release-bundle',
        label: `${artifact.label} (${artifact.format})`,
        required: artifact.required,
        expectedPath: artifact.path ? relativePath(input.root, artifact.path) : undefined,
        bundleArtifact: artifact
      })
    }
  }

  return uniqueBy(candidates, (item) => item.id).map((candidate) => expectedArtifact(candidate, input.root, input.artifacts))
}

function expectedArtifact(
  candidate: ExpectedCandidate,
  root: string,
  artifacts: ReportArtifactRecord[]
): ReleaseEvidenceExpectedArtifact {
  const matchedArtifacts = candidate.bundleArtifact?.ok === false
    ? []
    : matchArtifacts(candidate, root, artifacts)
  const mismatchReasons = integrityMismatchReasons(candidate.bundleArtifact, matchedArtifacts)
  const status: ReleaseEvidenceExpectedArtifact['status'] = candidate.bundleArtifact?.ok === false
    ? 'failed'
    : matchedArtifacts.length > 0
      ? mismatchReasons.length > 0
        ? 'mismatch'
        : 'present'
      : 'missing'
  const integrityStatus: ReleaseEvidenceExpectedArtifact['integrityStatus'] = hasBundleIntegrity(candidate.bundleArtifact)
    ? mismatchReasons.length > 0
      ? 'mismatch'
      : matchedArtifacts.length > 0
        ? 'verified'
        : 'not-applicable'
    : 'not-applicable'
  return {
    id: candidate.id,
    source: candidate.source,
    label: candidate.label,
    required: candidate.required,
    expectedPath: candidate.expectedPath,
    expectedSha256: candidate.bundleArtifact?.sha256,
    expectedSizeBytes: candidate.bundleArtifact?.sizeBytes,
    status,
    integrityStatus,
    matchedArtifactCount: matchedArtifacts.length,
    matchedArtifacts: matchedArtifacts.map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      category: artifact.category,
      format: artifact.format,
      relativePath: artifact.relativePath,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      modifiedAt: artifact.modifiedAt
    })),
    mismatchReasons,
    error: candidate.bundleArtifact?.error
  }
}

function matchArtifacts(candidate: ExpectedCandidate, root: string, artifacts: ReportArtifactRecord[]): ReportArtifactRecord[] {
  if (!candidate.expectedPath) return []
  const normalizedExpected = normalizePath(candidate.expectedPath)
  const absoluteExpected = normalizePath(resolve(root, candidate.expectedPath))
  return artifacts.filter((artifact) => {
    const relative = normalizePath(artifact.relativePath)
    const absolute = normalizePath(artifact.path)
    return relative === normalizedExpected ||
      relative.endsWith(`/${normalizedExpected}`) ||
      absolute === absoluteExpected ||
      relative.endsWith(`/${basenamePath(normalizedExpected)}`)
  })
}

function integrityMismatchReasons(
  bundleArtifact: ReleaseBundleArtifact | undefined,
  matchedArtifacts: ReportArtifactRecord[]
): string[] {
  if (!hasBundleIntegrity(bundleArtifact) || matchedArtifacts.length === 0) return []
  const expectedSha = bundleArtifact?.sha256
  const expectedSize = bundleArtifact?.sizeBytes
  if (matchedArtifacts.some((artifact) => (
    (!expectedSha || artifact.sha256 === expectedSha) &&
    (typeof expectedSize !== 'number' || artifact.sizeBytes === expectedSize)
  ))) {
    return []
  }

  const first = matchedArtifacts[0]
  const reasons: string[] = []
  if (expectedSha && first.sha256 !== expectedSha) {
    reasons.push(`SHA-256 mismatch: expected ${expectedSha}, found ${first.sha256}`)
  }
  if (typeof expectedSize === 'number' && first.sizeBytes !== expectedSize) {
    reasons.push(`Size mismatch: expected ${expectedSize} bytes, found ${first.sizeBytes} bytes`)
  }
  return reasons
}

function hasBundleIntegrity(bundleArtifact: ReleaseBundleArtifact | undefined): boolean {
  return Boolean(bundleArtifact?.ok && (bundleArtifact.sha256 || typeof bundleArtifact.sizeBytes === 'number'))
}

function buildFindings(input: {
  expectedArtifacts: ReleaseEvidenceExpectedArtifact[]
  artifactResult: CaptureResult<ReportArtifactIndexReport>
  policyResult: CaptureResult<PolicyAsCodeReport>
  bundleResult: CaptureResult<ReleaseBundleManifest | undefined>
}): ReleaseEvidenceCompletenessFinding[] {
  const findings: ReleaseEvidenceCompletenessFinding[] = []
  for (const [source, error] of Object.entries(sourceErrors(input.artifactResult, input.policyResult, input.bundleResult))) {
    if (!error) continue
    findings.push(finding({
      id: `${source}:source-error`,
      severity: source === 'release-bundle' ? 'warning' : 'blocked',
      source: source as ReleaseEvidenceCompletenessSource,
      title: `${source} evidence is unavailable`,
      summary: error,
      recommendation: source === 'release-bundle'
        ? 'Export the aggregate release bundle when release reviewer completeness must include bundle artifacts.'
        : 'Repair this evidence source and rerun the release evidence completeness check.',
      evidence: [error]
    }))
  }

  for (const artifact of input.expectedArtifacts) {
    if (artifact.status === 'present') continue
    findings.push(finding({
      id: `artifact:${artifact.id}`,
      severity: artifact.required ? 'blocked' : 'warning',
      source: artifact.source,
      title: artifact.status === 'failed'
        ? 'Evidence artifact failed to export'
        : artifact.status === 'mismatch'
          ? 'Evidence artifact integrity mismatch'
          : 'Evidence artifact is missing',
      summary: `${artifact.label} is ${artifact.status}.`,
      recommendation: artifact.status === 'mismatch'
        ? 'Regenerate the affected evidence artifact and release bundle so reviewer artifacts match the recorded digest and size.'
        : artifact.source === 'release-bundle'
          ? 'Regenerate the release bundle and resolve failed required exporters before release review.'
          : 'Generate the required evidence artifact or update the policy-as-code pack if this artifact is no longer required.',
      evidence: [
        `Expected: ${artifact.expectedPath || artifact.label}`,
        `Required: ${artifact.required ? 'yes' : 'no'}`,
        ...(artifact.expectedSha256 ? [`Expected SHA-256: ${artifact.expectedSha256}`] : []),
        ...(typeof artifact.expectedSizeBytes === 'number' ? [`Expected size: ${artifact.expectedSizeBytes} bytes`] : []),
        ...artifact.mismatchReasons,
        ...(artifact.error ? [`Error: ${artifact.error}`] : [])
      ]
    }))
  }

  if ((input.artifactResult.value?.summary.artifactCount || 0) === 0) {
    findings.push(finding({
      id: 'report-library:no-artifacts',
      severity: 'warning',
      source: 'report-library',
      title: 'Report artifact library is empty',
      summary: 'No generated dependency governance reports were found under .npmDesktopManager/reports.',
      recommendation: 'Export readiness, SBOM, policy, CI, and release evidence reports before release review.',
      evidence: ['No report artifacts found.']
    }))
  }

  return uniqueBy(findings, (item) => item.id).slice(0, 300)
}

function summarize(
  reportArtifacts: ReportArtifactIndexReport,
  expectedArtifacts: ReleaseEvidenceExpectedArtifact[],
  findings: ReleaseEvidenceCompletenessFinding[],
  policy?: PolicyAsCodeReport,
  bundle?: ReleaseBundleManifest
): ReleaseEvidenceCompletenessSummary {
  const blockedFindingCount = findings.filter((item) => item.severity === 'blocked').length
  const warningFindingCount = findings.filter((item) => item.severity === 'warning').length
  const requiredArtifacts = expectedArtifacts.filter((item) => item.required)
  const missingArtifacts = expectedArtifacts.filter((item) => item.status === 'missing')
  const failedArtifacts = expectedArtifacts.filter((item) => item.status === 'failed')
  const mismatchArtifacts = expectedArtifacts.filter((item) => item.status === 'mismatch')
  const status: ReleaseEvidenceCompletenessStatus = blockedFindingCount > 0
    ? 'blocked'
    : warningFindingCount > 0
      ? 'warning'
      : 'ready'
  return {
    status,
    expectedArtifactCount: expectedArtifacts.length,
    requiredArtifactCount: requiredArtifacts.length,
    presentArtifactCount: expectedArtifacts.filter((item) => item.status === 'present').length,
    missingArtifactCount: missingArtifacts.length,
    missingRequiredArtifactCount: missingArtifacts.filter((item) => item.required).length,
    failedArtifactCount: failedArtifacts.length,
    failedRequiredArtifactCount: failedArtifacts.filter((item) => item.required).length,
    integrityMismatchCount: mismatchArtifacts.length,
    requiredIntegrityMismatchCount: mismatchArtifacts.filter((item) => item.required).length,
    policyRequiredArtifactCount: policy?.pack.ci.requiredArtifacts.length || 0,
    releaseBundleArtifactCount: bundle?.summary.artifactCount || 0,
    releaseBundleRequiredArtifactCount: bundle?.summary.requiredArtifactCount || 0,
    reportArtifactCount: reportArtifacts.summary.artifactCount,
    totalSizeBytes: reportArtifacts.summary.totalSizeBytes,
    latestModifiedAt: reportArtifacts.summary.latestModifiedAt,
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

function renderMarkdown(report: ReleaseEvidenceCompletenessReport): string {
  const lines = [
    '# Release Evidence Completeness',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Expected artifacts: ${report.summary.expectedArtifactCount}`,
    `- Required artifacts: ${report.summary.requiredArtifactCount}`,
    `- Present artifacts: ${report.summary.presentArtifactCount}`,
    `- Missing required artifacts: ${report.summary.missingRequiredArtifactCount}`,
    `- Failed required artifacts: ${report.summary.failedRequiredArtifactCount}`,
    `- Integrity mismatches: ${report.summary.integrityMismatchCount}`,
    `- Required integrity mismatches: ${report.summary.requiredIntegrityMismatchCount}`,
    `- Policy required artifacts: ${report.summary.policyRequiredArtifactCount}`,
    `- Release bundle artifacts: ${report.summary.releaseBundleArtifactCount}`,
    `- Report library artifacts: ${report.summary.reportArtifactCount}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Blocked/warning findings: ${report.summary.blockedFindingCount}/${report.summary.warningFindingCount}`,
    '',
    '## Expected Artifacts',
    '',
    '| Status | Integrity | Required | Source | Artifact | Matches | Path |',
    '| --- | --- | --- | --- | --- | ---: | --- |'
  ]

  for (const artifact of report.expectedArtifacts) {
    lines.push([
      artifact.status,
      artifact.integrityStatus,
      artifact.required ? 'yes' : 'no',
      artifact.source,
      markdownCell(artifact.label),
      String(artifact.matchedArtifactCount),
      markdownCell(artifact.expectedPath || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.findings.length === 0) {
    lines.push('- No release evidence completeness findings.')
  } else {
    for (const item of report.findings) {
      lines.push(`- ${item.severity} / ${item.source}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function sourceErrors(
  artifactResult: CaptureResult<ReportArtifactIndexReport>,
  policyResult: CaptureResult<PolicyAsCodeReport>,
  bundleResult: CaptureResult<ReleaseBundleManifest | undefined>
): Partial<Record<ReleaseEvidenceCompletenessSource, string>> {
  return {
    ...(artifactResult.error ? { 'report-library': artifactResult.error } : {}),
    ...(policyResult.error ? { 'policy-as-code': policyResult.error } : {}),
    ...(bundleResult.error ? { 'release-bundle': bundleResult.error } : {}),
    ...(!bundleResult.error && !bundleResult.value ? { 'release-bundle': 'Release bundle manifest has not been generated yet.' } : {})
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
  report: ReleaseEvidenceCompletenessReport
): ReleaseEvidenceCompletenessExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    findingCount: report.summary.findingCount,
    count: report.summary.findingCount,
    summary: report.summary
  }
}

function finding(input: ReleaseEvidenceCompletenessFinding): ReleaseEvidenceCompletenessFinding {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function relativePath(root: string, path: string): string {
  return normalizePath(relative(root, path))
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase()
}

function basenamePath(path: string): string {
  const parts = normalizePath(path).split('/')
  return parts[parts.length - 1] || path
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
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
