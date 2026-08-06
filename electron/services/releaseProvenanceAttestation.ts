import { execFile as execFileCallback } from 'child_process'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { promisify } from 'util'
import {
  ReportArtifactIndexService,
  type ReportArtifactCategory,
  type ReportArtifactFormat,
  type ReportArtifactIndexReport,
  type ReportArtifactRecord
} from './reportArtifactIndex'
import {
  ReleaseEvidenceCompletenessService,
  type ReleaseEvidenceCompletenessReport
} from './releaseEvidenceCompleteness'
import type { ReleaseBundleManifest } from './workspaceGovernance'

export type ReleaseProvenanceAttestationStatus = 'ready' | 'warning' | 'blocked'
export type ReleaseProvenanceAttestationExportFormat = 'markdown' | 'json'
export type ReleaseProvenanceSource =
  | 'project'
  | 'git'
  | 'report-library'
  | 'release-bundle'
  | 'release-evidence'

export interface ReleaseProvenanceProjectInfo {
  path: string
  name: string
  version?: string
  packageManager?: string
  manifestPath?: string
}

export interface ReleaseProvenanceGitInfo {
  available: boolean
  branch?: string
  commit?: string
  shortCommit?: string
  commitDate?: string
  dirty?: boolean
  changedFileCount?: number
  remoteUrl?: string
  error?: string
}

export interface ReleaseProvenanceEvidenceDigest {
  id: string
  label: string
  category: ReportArtifactCategory
  format: ReportArtifactFormat
  relativePath: string
  sizeBytes: number
  sha256: string
  modifiedAt: string
}

export interface ReleaseProvenanceAttestationSummary {
  status: ReleaseProvenanceAttestationStatus
  artifactCount: number
  totalSizeBytes: number
  releaseBundleArtifactCount: number
  requiredBundleArtifactCount: number
  failedBundleArtifactCount: number
  requiredFailedBundleArtifactCount: number
  policyRequiredArtifactCount: number
  missingRequiredEvidenceCount: number
  failedRequiredEvidenceCount: number
  integrityMismatchCount: number
  requiredIntegrityMismatchCount: number
  blockedEvidenceFindingCount: number
  warningEvidenceFindingCount: number
  sourceErrorCount: number
  gitDirty: boolean
  gitAvailable: boolean
  selfReferencedEvidenceCount: number
}

export interface ReleaseProvenanceAttestationReport {
  generatedAt: string
  projectPath: string
  project: ReleaseProvenanceProjectInfo
  status: ReleaseProvenanceAttestationStatus
  summary: ReleaseProvenanceAttestationSummary
  git: ReleaseProvenanceGitInfo
  releaseBundle?: Pick<ReleaseBundleManifest, 'generatedAt' | 'status' | 'score' | 'summary'>
  evidenceCompleteness?: Pick<ReleaseEvidenceCompletenessReport, 'generatedAt' | 'status' | 'summary'>
  artifacts: ReleaseProvenanceEvidenceDigest[]
  sources: {
    reportArtifacts: Pick<ReportArtifactIndexReport, 'generatedAt' | 'summary'>
    releaseBundleManifestPath: string
    errors: Partial<Record<ReleaseProvenanceSource, string>>
  }
}

export interface ReleaseProvenanceAttestationExportResult {
  path: string
  format: ReleaseProvenanceAttestationExportFormat
  generatedAt: string
  status: ReleaseProvenanceAttestationStatus
  artifactCount: number
  summary: ReleaseProvenanceAttestationSummary
}

export interface ReleaseProvenanceAttestationDependencies {
  reportArtifactIndexService?: ReportArtifactIndexService
  releaseEvidenceCompletenessService?: ReleaseEvidenceCompletenessService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const execFile = promisify(execFileCallback)
const REPORT_DIR = '.npmDesktopManager/reports'
const RELEASE_BUNDLE_MANIFEST = '.npmDesktopManager/reports/release-bundle/release-bundle-manifest.json'
const OWN_ARTIFACT_STEM = 'release-provenance-attestation'

export class ReleaseProvenanceAttestationService {
  private readonly reportArtifactIndexService: ReportArtifactIndexService
  private readonly releaseEvidenceCompletenessService: ReleaseEvidenceCompletenessService

  constructor(dependencies: ReleaseProvenanceAttestationDependencies = {}) {
    this.reportArtifactIndexService = dependencies.reportArtifactIndexService || new ReportArtifactIndexService()
    this.releaseEvidenceCompletenessService = dependencies.releaseEvidenceCompletenessService || new ReleaseEvidenceCompletenessService({
      reportArtifactIndexService: this.reportArtifactIndexService
    })
  }

  async report(projectPath: string): Promise<ReleaseProvenanceAttestationReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [projectResult, gitResult, artifactResult, evidenceResult, bundleResult] = await Promise.all([
      capture(() => readProjectInfo(root)),
      capture(() => collectGitInfo(root)),
      capture(() => this.reportArtifactIndexService.report(root)),
      capture(() => this.releaseEvidenceCompletenessService.report(root)),
      capture(() => readReleaseBundleManifest(root))
    ])

    if (!artifactResult.value) {
      throw new Error(artifactResult.error || 'Report artifact index is unavailable')
    }

    const project = projectResult.value || {
      path: root,
      name: basename(root)
    }
    const git = gitResult.value || {
      available: false,
      error: gitResult.error || 'Git metadata is unavailable.'
    }
    const errors = sourceErrors(projectResult, gitResult, artifactResult, evidenceResult, bundleResult, git)
    const summary = summarize({
      artifacts: artifactResult.value,
      git,
      evidenceCompleteness: evidenceResult.value,
      releaseBundle: bundleResult.value,
      errors
    })

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      project,
      status: summary.status,
      summary,
      git,
      releaseBundle: bundleResult.value
        ? {
            generatedAt: bundleResult.value.generatedAt,
            status: bundleResult.value.status,
            score: bundleResult.value.score,
            summary: bundleResult.value.summary
          }
        : undefined,
      evidenceCompleteness: evidenceResult.value
        ? {
            generatedAt: evidenceResult.value.generatedAt,
            status: evidenceResult.value.status,
            summary: evidenceResult.value.summary
          }
        : undefined,
      artifacts: artifactResult.value.artifacts.map(evidenceDigest),
      sources: {
        reportArtifacts: {
          generatedAt: artifactResult.value.generatedAt,
          summary: artifactResult.value.summary
        },
        releaseBundleManifestPath: join(root, RELEASE_BUNDLE_MANIFEST),
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<ReleaseProvenanceAttestationExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OWN_ARTIFACT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<ReleaseProvenanceAttestationExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OWN_ARTIFACT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function summarize(input: {
  artifacts: ReportArtifactIndexReport
  git: ReleaseProvenanceGitInfo
  evidenceCompleteness?: ReleaseEvidenceCompletenessReport
  releaseBundle?: ReleaseBundleManifest
  errors: Partial<Record<ReleaseProvenanceSource, string>>
}): ReleaseProvenanceAttestationSummary {
  const relevantExpected = input.evidenceCompleteness?.expectedArtifacts.filter((artifact) => !isOwnEvidenceArtifact(artifact)) || []
  const relevantFindings = input.evidenceCompleteness?.findings.filter((finding) => !isOwnProvenanceText([
    finding.id,
    finding.title,
    finding.summary,
    finding.recommendation,
    ...finding.evidence
  ].join('\n'))) || []
  const requiredRelevant = relevantExpected.filter((artifact) => artifact.required)
  const missingRequiredEvidenceCount = requiredRelevant.filter((artifact) => artifact.status === 'missing').length
  const failedRequiredEvidenceCount = requiredRelevant.filter((artifact) => artifact.status === 'failed').length
  const requiredIntegrityMismatchCount = requiredRelevant.filter((artifact) => artifact.status === 'mismatch').length
  const integrityMismatchCount = relevantExpected.filter((artifact) => artifact.status === 'mismatch').length
  const blockedEvidenceFindingCount = relevantFindings.filter((finding) => finding.severity === 'blocked').length
  const warningEvidenceFindingCount = relevantFindings.filter((finding) => finding.severity === 'warning').length
  const failedBundleArtifactCount = input.releaseBundle?.summary.failedArtifactCount || 0
  const requiredFailedBundleArtifactCount = input.releaseBundle?.summary.requiredFailedArtifactCount || 0
  const sourceErrorCount = Object.keys(input.errors).length
  const blocked = missingRequiredEvidenceCount > 0 ||
    failedRequiredEvidenceCount > 0 ||
    requiredIntegrityMismatchCount > 0 ||
    blockedEvidenceFindingCount > 0 ||
    requiredFailedBundleArtifactCount > 0
  const warning = sourceErrorCount > 0 ||
    warningEvidenceFindingCount > 0 ||
    failedBundleArtifactCount > 0 ||
    input.artifacts.summary.artifactCount === 0 ||
    !input.git.available ||
    Boolean(input.git.dirty)
  const status: ReleaseProvenanceAttestationStatus = blocked ? 'blocked' : warning ? 'warning' : 'ready'

  return {
    status,
    artifactCount: input.artifacts.summary.artifactCount,
    totalSizeBytes: input.artifacts.summary.totalSizeBytes,
    releaseBundleArtifactCount: input.releaseBundle?.summary.artifactCount || 0,
    requiredBundleArtifactCount: input.releaseBundle?.summary.requiredArtifactCount || 0,
    failedBundleArtifactCount,
    requiredFailedBundleArtifactCount,
    policyRequiredArtifactCount: input.evidenceCompleteness?.summary.policyRequiredArtifactCount || 0,
    missingRequiredEvidenceCount,
    failedRequiredEvidenceCount,
    integrityMismatchCount,
    requiredIntegrityMismatchCount,
    blockedEvidenceFindingCount,
    warningEvidenceFindingCount,
    sourceErrorCount,
    gitDirty: Boolean(input.git.dirty),
    gitAvailable: input.git.available,
    selfReferencedEvidenceCount: (input.evidenceCompleteness?.expectedArtifacts.length || 0) - relevantExpected.length
  }
}

async function readProjectInfo(root: string): Promise<ReleaseProvenanceProjectInfo> {
  const manifestPath = join(root, 'package.json')
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as {
      name?: string
      version?: string
      packageManager?: string
    }
    return {
      path: root,
      name: manifest.name || basename(root),
      version: manifest.version,
      packageManager: manifest.packageManager,
      manifestPath
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {
        path: root,
        name: basename(root)
      }
    }
    throw error
  }
}

async function collectGitInfo(root: string): Promise<ReleaseProvenanceGitInfo> {
  const inside = await gitOptional(root, ['rev-parse', '--is-inside-work-tree'])
  if (inside.error || inside.value !== 'true') {
    return {
      available: false,
      error: inside.error || 'Path is not inside a Git work tree.'
    }
  }

  const [branch, commit, commitDate, status, remote] = await Promise.all([
    gitOptional(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    gitOptional(root, ['rev-parse', 'HEAD']),
    gitOptional(root, ['show', '-s', '--format=%cI', 'HEAD']),
    gitOptional(root, ['status', '--short']),
    gitOptional(root, ['config', '--get', 'remote.origin.url'])
  ])
  const changedFileCount = status.value ? status.value.split(/\r?\n/).filter(Boolean).length : 0
  const error = commit.error || branch.error
  return {
    available: true,
    branch: branch.value,
    commit: commit.value,
    shortCommit: commit.value?.slice(0, 12),
    commitDate: commitDate.value,
    dirty: changedFileCount > 0,
    changedFileCount,
    remoteUrl: remote.value ? sanitizeRemoteUrl(remote.value) : undefined,
    error
  }
}

async function gitOptional(root: string, args: string[]): Promise<{ value?: string; error?: string }> {
  try {
    const result = await execFile('git', args, {
      cwd: root,
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024
    })
    return { value: result.stdout.trim() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
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

function evidenceDigest(artifact: ReportArtifactRecord): ReleaseProvenanceEvidenceDigest {
  return {
    id: artifact.id,
    label: artifact.name,
    category: artifact.category,
    format: artifact.format,
    relativePath: artifact.relativePath,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    modifiedAt: artifact.modifiedAt
  }
}

function renderMarkdown(report: ReleaseProvenanceAttestationReport): string {
  const lines = [
    '# Release Provenance Attestation',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Artifacts: ${report.summary.artifactCount}`,
    `- Total size: ${formatBytes(report.summary.totalSizeBytes)}`,
    `- Release bundle artifacts: ${report.summary.releaseBundleArtifactCount}`,
    `- Required bundle artifacts: ${report.summary.requiredBundleArtifactCount}`,
    `- Required bundle failures: ${report.summary.requiredFailedBundleArtifactCount}`,
    `- Missing required evidence: ${report.summary.missingRequiredEvidenceCount}`,
    `- Failed required evidence: ${report.summary.failedRequiredEvidenceCount}`,
    `- Integrity mismatches: ${report.summary.integrityMismatchCount}`,
    `- Blocked/warning evidence findings: ${report.summary.blockedEvidenceFindingCount}/${report.summary.warningEvidenceFindingCount}`,
    `- Source errors: ${report.summary.sourceErrorCount}`,
    `- Git available: ${report.summary.gitAvailable ? 'yes' : 'no'}`,
    `- Git dirty: ${report.summary.gitDirty ? 'yes' : 'no'}`,
    '',
    '## Project',
    '',
    `- Name: ${report.project.name}`,
    `- Version: ${report.project.version || '-'}`,
    `- Package manager: ${report.project.packageManager || '-'}`,
    `- Manifest: ${report.project.manifestPath || '-'}`,
    '',
    '## Source / Git',
    '',
    `- Available: ${report.git.available ? 'yes' : 'no'}`,
    `- Branch: ${report.git.branch || '-'}`,
    `- Commit: ${report.git.commit || '-'}`,
    `- Commit date: ${report.git.commitDate || '-'}`,
    `- Dirty: ${report.git.dirty ? 'yes' : 'no'}`,
    `- Changed files: ${typeof report.git.changedFileCount === 'number' ? report.git.changedFileCount : '-'}`,
    `- Remote: ${report.git.remoteUrl || '-'}`,
    `- Error: ${report.git.error || '-'}`,
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
      `- Required: ${report.releaseBundle.summary.requiredArtifactCount}`,
      `- Required failed: ${report.releaseBundle.summary.requiredFailedArtifactCount}`
    )
  } else {
    lines.push('- No release bundle manifest found.')
  }

  lines.push('', '## Evidence Completeness', '')
  if (report.evidenceCompleteness) {
    lines.push(
      `- Generated: ${report.evidenceCompleteness.generatedAt}`,
      `- Status: ${report.evidenceCompleteness.status}`,
      `- Expected artifacts: ${report.evidenceCompleteness.summary.expectedArtifactCount}`,
      `- Policy required artifacts: ${report.evidenceCompleteness.summary.policyRequiredArtifactCount}`,
      `- Missing required artifacts: ${report.evidenceCompleteness.summary.missingRequiredArtifactCount}`,
      `- Required integrity mismatches: ${report.evidenceCompleteness.summary.requiredIntegrityMismatchCount}`,
      `- Self-referenced provenance artifacts excluded from attestation readiness: ${report.summary.selfReferencedEvidenceCount}`
    )
  } else {
    lines.push('- Release evidence completeness report is unavailable.')
  }

  lines.push(
    '',
    '## Evidence Digests',
    '',
    '| Artifact | Category | Format | Size | SHA-256 | Modified | Path |',
    '| --- | --- | --- | ---: | --- | --- | --- |'
  )

  for (const artifact of report.artifacts) {
    lines.push([
      markdownCell(artifact.label),
      artifact.category,
      artifact.format,
      formatBytes(artifact.sizeBytes),
      artifact.sha256,
      artifact.modifiedAt,
      markdownCell(artifact.relativePath)
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

function sourceErrors(
  projectResult: CaptureResult<ReleaseProvenanceProjectInfo>,
  gitResult: CaptureResult<ReleaseProvenanceGitInfo>,
  artifactResult: CaptureResult<ReportArtifactIndexReport>,
  evidenceResult: CaptureResult<ReleaseEvidenceCompletenessReport>,
  bundleResult: CaptureResult<ReleaseBundleManifest | undefined>,
  git: ReleaseProvenanceGitInfo
): Partial<Record<ReleaseProvenanceSource, string>> {
  return {
    ...(projectResult.error ? { project: projectResult.error } : {}),
    ...(gitResult.error ? { git: gitResult.error } : {}),
    ...(!gitResult.error && git.error ? { git: git.error } : {}),
    ...(artifactResult.error ? { 'report-library': artifactResult.error } : {}),
    ...(evidenceResult.error ? { 'release-evidence': evidenceResult.error } : {}),
    ...(bundleResult.error ? { 'release-bundle': bundleResult.error } : {})
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
  format: ReleaseProvenanceAttestationExportFormat,
  report: ReleaseProvenanceAttestationReport
): ReleaseProvenanceAttestationExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    artifactCount: report.summary.artifactCount,
    summary: report.summary
  }
}

function isOwnEvidenceArtifact(artifact: ReleaseEvidenceCompletenessReport['expectedArtifacts'][number]): boolean {
  return isOwnProvenanceText([
    artifact.id,
    artifact.label,
    artifact.expectedPath || '',
    ...artifact.matchedArtifacts.map((item) => item.relativePath)
  ].join('\n'))
}

function isOwnProvenanceText(value: string): boolean {
  return value.toLowerCase().includes(OWN_ARTIFACT_STEM)
}

function sanitizeRemoteUrl(value: string): string {
  return value.replace(/:\/\/([^/@]+)@/, '://***@')
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
