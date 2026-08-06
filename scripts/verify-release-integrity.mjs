#!/usr/bin/env node
import { createHash } from 'crypto'
import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import process from 'process'

const REPORT_DIR = '.npmDesktopManager/reports'
const RELEASE_BUNDLE_MANIFEST = '.npmDesktopManager/reports/release-bundle/release-bundle-manifest.json'
const PROVENANCE_ATTESTATION_JSON = '.npmDesktopManager/reports/release-provenance-attestation.json'
const OUTPUT_STEM = 'release-integrity-verification'

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const root = resolve(options.projectPath || process.cwd())
  const report = await verifyReleaseIntegrity(root, options)

  if (options.write !== 'none') {
    await writeOutputs(root, report, options.write)
  }

  printSummary(report, options)
  const blocked = report.status === 'blocked' ||
    report.summary.requiredMissingArtifactCount > 0 ||
    report.summary.requiredMismatchArtifactCount > 0 ||
    report.summary.requiredFailedRecordedArtifactCount > 0 ||
    report.summary.requiredUnverifiableArtifactCount > 0
  const warning = report.status === 'warning'
  if (blocked || (options.failOnWarning && warning)) {
    process.exitCode = 1
  }
}

function parseArgs(args) {
  const options = {
    projectPath: undefined,
    optional: false,
    failOnWarning: false,
    write: 'both',
    quiet: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--optional' || arg === 'optional' || arg === 'allow-missing-bundle') {
      options.optional = true
    } else if (arg === '--fail-on-warning' || arg === 'fail-on-warning') {
      options.failOnWarning = true
    } else if (arg === '--quiet' || arg === 'quiet' || arg === 'silent') {
      options.quiet = true
    } else if (arg === '--no-write' || arg === 'no-write' || arg === 'none') {
      options.write = 'none'
    } else if (arg === '--json-only' || arg === 'json') {
      options.write = 'json'
    } else if (arg === '--markdown-only' || arg === 'markdown') {
      options.write = 'markdown'
    } else if (arg === '--write') {
      const value = args[index + 1]
      if (!['both', 'json', 'markdown', 'none'].includes(value)) {
        usage(`Invalid --write value: ${value || ''}`)
      }
      options.write = value
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      usage()
    } else if (arg.startsWith('--')) {
      usage(`Unknown option: ${arg}`)
    } else if (!options.projectPath) {
      options.projectPath = arg
    } else {
      usage(`Unexpected argument: ${arg}`)
    }
  }

  return options
}

function usage(error) {
  if (error) console.error(error)
  console.log([
    'Usage: node scripts/verify-release-integrity.mjs [projectPath] [options]',
    '',
    'Options:',
    '  --optional          Exit successfully when no release bundle manifest exists.',
    '  optional            npm-run-safe alias for --optional.',
    '  --fail-on-warning   Exit non-zero on warnings as well as blocked findings.',
    '  --write <mode>      Write both, json, markdown, or none. Default: both.',
    '  --json-only         Write only release-integrity-verification.json.',
    '  json                npm-run-safe alias for --json-only.',
    '  --markdown-only     Write only release-integrity-verification.md.',
    '  --no-write          Do not write verification reports.',
    '  none                npm-run-safe alias for --no-write.',
    '  --quiet             Print only the one-line summary.',
    '  silent              npm-run-safe alias for --quiet.',
    '  -h, --help          Show this help.'
  ].join('\n'))
  process.exit(error ? 1 : 0)
}

async function verifyReleaseIntegrity(root, options) {
  await access(root)
  const [bundleResult, provenanceResult] = await Promise.all([
    capture(() => readJson(join(root, RELEASE_BUNDLE_MANIFEST))),
    capture(() => readJson(join(root, PROVENANCE_ATTESTATION_JSON)))
  ])

  const missingBundle = !bundleResult.value
  const missingProvenance = !provenanceResult.value
  const errors = {
    ...(bundleResult.error ? { 'release-bundle': bundleResult.error } : {}),
    ...(!bundleResult.error && missingBundle ? { 'release-bundle': 'Release bundle manifest has not been generated yet.' } : {}),
    ...(provenanceResult.error ? { 'provenance-attestation': provenanceResult.error } : {}),
    ...(!provenanceResult.error && missingProvenance ? { 'provenance-attestation': 'Release provenance attestation has not been generated yet.' } : {})
  }

  if (missingBundle && options.optional) {
    delete errors['release-bundle']
  }

  const provenanceMap = provenanceDigestMap(provenanceResult.value)
  const artifacts = bundleResult.value
    ? await Promise.all((bundleResult.value.artifacts || []).map((artifact) => verifyArtifact(root, artifact, provenanceMap, Boolean(provenanceResult.value))))
    : []
  const findings = buildFindings(artifacts, errors, options)
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

async function verifyArtifact(root, artifact, provenanceMap, provenanceAvailable) {
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

  const digestResult = await capture(() => fileDigest(artifact.path))
  if (!digestResult.value) {
    const missing = (digestResult.error || '').includes('ENOENT') || (digestResult.error || '').toLowerCase().includes('no such file')
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

  const issues = []
  if (digestResult.value.sha256 !== artifact.sha256) {
    issues.push('SHA-256 mismatch: expected ' + artifact.sha256 + ', found ' + digestResult.value.sha256)
  }
  if (digestResult.value.sizeBytes !== artifact.sizeBytes) {
    issues.push('Size mismatch: expected ' + artifact.sizeBytes + ' bytes, found ' + digestResult.value.sizeBytes + ' bytes')
  }
  const provenance = provenanceStatus(provenanceAvailable, provenanceDigest, digestResult.value)
  if (provenance === 'mismatch') {
    issues.push('Provenance digest mismatch: attestation recorded ' + (provenanceDigest?.sha256 || '-') + ' / ' + (provenanceDigest?.sizeBytes ?? '-') + ' bytes')
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

function artifactResult(input) {
  return {
    id: input.artifact.id,
    kind: input.artifact.kind,
    label: input.artifact.label,
    format: input.artifact.format,
    required: Boolean(input.artifact.required),
    ok: Boolean(input.artifact.ok),
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

function buildFindings(artifacts, errors, options) {
  const findings = []
  if (errors['release-bundle']) {
    findings.push(finding({
      id: 'source:release-bundle',
      severity: options.optional ? 'warning' : 'blocked',
      title: 'Release bundle manifest is unavailable',
      summary: errors['release-bundle'],
      recommendation: options.optional
        ? 'Export the aggregate release bundle before formal release sign-off.'
        : 'Export the aggregate release bundle before running integrity verification.',
      evidence: [errors['release-bundle']]
    }))
  }
  if (errors['provenance-attestation']) {
    findings.push(finding({
      id: 'source:provenance-attestation',
      severity: 'warning',
      title: 'Release provenance attestation is unavailable',
      summary: errors['provenance-attestation'],
      recommendation: 'Export release provenance so artifact digests can be cross-checked against source attestation.',
      evidence: [errors['provenance-attestation']]
    }))
  }

  for (const artifact of artifacts) {
    if (artifact.status !== 'verified') {
      findings.push(finding({
        id: 'artifact:' + artifact.id + ':' + artifact.status,
        severity: artifact.required ? 'blocked' : 'warning',
        artifactId: artifact.id,
        title: artifact.status === 'mismatch'
          ? 'Artifact digest or size mismatch'
          : artifact.status === 'missing'
            ? 'Artifact file is missing'
            : artifact.status === 'failed-recorded'
              ? 'Release bundle recorded an export failure'
              : 'Artifact cannot be verified',
        summary: artifact.label + ' (' + artifact.format + ') is ' + artifact.status + '.',
        recommendation: artifact.status === 'mismatch' || artifact.status === 'missing'
          ? 'Regenerate the affected evidence artifact and release bundle, then rerun integrity verification.'
          : 'Resolve the recorded export failure or regenerate the release bundle with complete digest metadata.',
        evidence: artifactEvidence(artifact)
      }))
    } else if (artifact.provenanceStatus === 'mismatch') {
      findings.push(finding({
        id: 'artifact:' + artifact.id + ':provenance-mismatch',
        severity: 'warning',
        artifactId: artifact.id,
        title: 'Artifact differs from provenance attestation',
        summary: artifact.label + ' verifies against the release bundle but differs from the provenance attestation digest.',
        recommendation: 'Regenerate release provenance after the release bundle so source attestation and bundle evidence agree.',
        evidence: artifactEvidence(artifact)
      }))
    }
  }

  return findings.slice(0, 500)
}

function summarize(artifacts, findings, errors, provenanceAvailable) {
  const required = artifacts.filter((artifact) => artifact.required)
  const blockedFindingCount = findings.filter((item) => item.severity === 'blocked').length
  const warningFindingCount = findings.filter((item) => item.severity === 'warning').length
  const sourceErrorCount = Object.keys(errors).length
  const status = blockedFindingCount > 0
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

async function writeOutputs(root, report, mode) {
  const reportDir = join(root, REPORT_DIR)
  await mkdir(reportDir, { recursive: true })
  if (mode === 'both' || mode === 'json') {
    await writeFile(join(reportDir, OUTPUT_STEM + '.json'), JSON.stringify(report, null, 2), 'utf-8')
  }
  if (mode === 'both' || mode === 'markdown') {
    await writeFile(join(reportDir, OUTPUT_STEM + '.md'), renderMarkdown(report), 'utf-8')
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Release Integrity Verification',
    '',
    'Generated: ' + report.generatedAt,
    'Project: ' + report.projectPath,
    'Status: ' + report.status,
    '',
    '## Summary',
    '',
    '- Artifacts: ' + report.summary.artifactCount,
    '- Required artifacts: ' + report.summary.requiredArtifactCount,
    '- Verified artifacts: ' + report.summary.verifiedArtifactCount,
    '- Missing artifacts: ' + report.summary.missingArtifactCount,
    '- Mismatched artifacts: ' + report.summary.mismatchArtifactCount,
    '- Recorded export failures: ' + report.summary.failedRecordedArtifactCount,
    '- Unverifiable artifacts: ' + report.summary.unverifiableArtifactCount,
    '- Required missing/mismatch/failed/unverifiable: ' + [
      report.summary.requiredMissingArtifactCount,
      report.summary.requiredMismatchArtifactCount,
      report.summary.requiredFailedRecordedArtifactCount,
      report.summary.requiredUnverifiableArtifactCount
    ].join('/'),
    '- Provenance matched/mismatched/not-recorded: ' + [
      report.summary.provenanceMatchedArtifactCount,
      report.summary.provenanceMismatchArtifactCount,
      report.summary.provenanceNotRecordedArtifactCount
    ].join('/'),
    '- Findings: ' + report.summary.findingCount,
    '',
    '## Artifact Verification',
    '',
    '| Status | Provenance | Required | Artifact | Kind | Format | Expected SHA-256 | Actual SHA-256 | Size | Path |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |'
  ]

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
        ? artifact.actualSizeBytes + ' B'
        : typeof artifact.expectedSizeBytes === 'number'
          ? artifact.expectedSizeBytes + ' B'
          : '-',
      markdownCell(artifact.relativePath || artifact.path || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.findings.length === 0) {
    lines.push('- No release integrity findings.')
  } else {
    for (const item of report.findings) {
      lines.push('- ' + item.severity + ': ' + item.title)
      lines.push('  - ' + item.summary)
      lines.push('  - Recommendation: ' + item.recommendation)
    }
  }

  return lines.join('\n') + '\n'
}

function printSummary(report, options) {
  if (options.quiet) {
    console.log('release integrity: ' + report.status + ' (' + report.summary.verifiedArtifactCount + '/' + report.summary.artifactCount + ' verified)')
    return
  }
  console.log('Release integrity status: ' + report.status)
  console.log('Verified artifacts: ' + report.summary.verifiedArtifactCount + '/' + report.summary.artifactCount)
  console.log('Required missing/mismatch/failed/unverifiable: ' + [
    report.summary.requiredMissingArtifactCount,
    report.summary.requiredMismatchArtifactCount,
    report.summary.requiredFailedRecordedArtifactCount,
    report.summary.requiredUnverifiableArtifactCount
  ].join('/'))
  console.log('Provenance matched/mismatched/not-recorded: ' + [
    report.summary.provenanceMatchedArtifactCount,
    report.summary.provenanceMismatchArtifactCount,
    report.summary.provenanceNotRecordedArtifactCount
  ].join('/'))
  if (report.findings.length > 0) {
    console.log('Findings:')
    for (const finding of report.findings.slice(0, 20)) {
      console.log('- ' + finding.severity + ': ' + finding.title + ' - ' + finding.summary)
    }
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'))
}

async function fileDigest(path) {
  const [metadata, content] = await Promise.all([
    stat(path),
    readFile(path)
  ])
  return {
    sha256: createHash('sha256').update(content).digest('hex'),
    sizeBytes: metadata.size
  }
}

function provenanceDigestMap(provenance) {
  return new Map((provenance?.artifacts || []).map((artifact) => [normalizeKey(artifact.relativePath), artifact]))
}

function provenanceStatus(provenanceAvailable, provenanceDigest, actualDigest) {
  if (!provenanceAvailable) return 'not-available'
  if (!provenanceDigest) return 'not-recorded'
  if (!actualDigest) return 'not-recorded'
  return provenanceDigest.sha256 === actualDigest.sha256 && provenanceDigest.sizeBytes === actualDigest.sizeBytes
    ? 'matched'
    : 'mismatch'
}

async function capture(operation) {
  try {
    return { value: await operation() }
  } catch (error) {
    return { error: error?.message || String(error) }
  }
}

function finding(input) {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

function artifactEvidence(artifact) {
  return [
    'Artifact: ' + artifact.label,
    'Path: ' + (artifact.relativePath || artifact.path || '-'),
    'Required: ' + (artifact.required ? 'yes' : 'no'),
    'Expected SHA-256: ' + (artifact.expectedSha256 || '-'),
    'Actual SHA-256: ' + (artifact.actualSha256 || '-'),
    'Expected size: ' + (typeof artifact.expectedSizeBytes === 'number' ? artifact.expectedSizeBytes : '-') + ' bytes',
    'Actual size: ' + (typeof artifact.actualSizeBytes === 'number' ? artifact.actualSizeBytes : '-') + ' bytes',
    'Provenance: ' + artifact.provenanceStatus,
    ...artifact.issues
  ]
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}

function normalizeKey(path) {
  return normalizePath(path).replace(/^\.?\//, '').toLowerCase()
}

function markdownCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exit(1)
})
