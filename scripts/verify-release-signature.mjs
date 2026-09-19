#!/usr/bin/env node
import { createHash, createHmac } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { join, relative, resolve } from 'path'

const SIGNING_KEY_ENV = 'NPM_MANAGER_RELEASE_SIGNING_KEY'
const SIGNATURE_PATH = '.npmDesktopManager/reports/release-signature.json'

const SOURCE_DEFINITIONS = [
  {
    id: 'release-bundle',
    label: 'Release bundle manifest',
    relativePath: '.npmDesktopManager/reports/release-bundle/release-bundle-manifest.json'
  },
  {
    id: 'release-provenance-attestation',
    label: 'Release provenance attestation',
    relativePath: '.npmDesktopManager/reports/release-provenance-attestation.json'
  },
  {
    id: 'release-integrity-verification',
    label: 'Release integrity verification',
    relativePath: '.npmDesktopManager/reports/release-integrity-verification.json'
  }
]

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
  console.log([
    'Usage: node scripts/verify-release-signature.mjs [projectPath] [options]',
    '',
    'Options:',
    '  --optional          Exit successfully when no release signature has been exported yet.',
    '  --json-only         Print only JSON status output.',
    '  --quiet             Suppress explanatory output.',
    '  --allow-unsigned    Do not fail on digest-only or key-unavailable signatures.',
    '',
    'npm-run-safe aliases: optional, json, silent, allow-unsigned'
  ].join('\n'))
  process.exit(0)
}

const optionTokens = new Set(args.filter((arg) => arg.startsWith('--') || ['optional', 'json', 'silent', 'allow-unsigned'].includes(arg)))
const positional = args.filter((arg) => !optionTokens.has(arg))
const projectPath = resolve(positional[0] || process.cwd())
const optional = optionTokens.has('--optional') || optionTokens.has('optional')
const jsonOnly = optionTokens.has('--json-only') || optionTokens.has('json')
const quiet = optionTokens.has('--quiet') || optionTokens.has('silent')
const allowUnsigned = optionTokens.has('--allow-unsigned') || optionTokens.has('allow-unsigned')

const result = await verify(projectPath)
// Exit status deliberately tracks the envelope verification only: a valid
// signature over an envelope whose source reports are incomplete still
// returns 0 and keeps `status: blocked` for reviewers. Full release gating on
// blocked evidence belongs to verify-release-trust.mjs, which exits non-zero.
const strictFailure = ['mismatch', 'invalid'].includes(result.verificationStatus) ||
  (!allowUnsigned && !optional && ['not-signed', 'unsigned', 'key-unavailable'].includes(result.verificationStatus))
const optionalSkip = optional && result.verificationStatus === 'not-signed'

if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2))
} else if (!quiet) {
  console.log('release signature: ' + result.status)
  console.log('verification: ' + result.verificationStatus)
  console.log('sources: ' + result.includedSourceCount + '/' + result.sourceCount)
  console.log('signed: ' + (result.signed ? 'yes' : 'no'))
  for (const finding of result.findings) {
    console.log('- ' + finding.severity + ': ' + finding.summary)
  }
} else {
  console.log('release signature: ' + result.status + ' (' + result.verificationStatus + ')')
}

if (strictFailure && !optionalSkip) {
  process.exitCode = 1
}

async function verify(root) {
  const sources = await Promise.all(SOURCE_DEFINITIONS.map((definition) => readSource(root, definition)))
  const payload = buildPayload(sources)
  const signatureResult = await readJson(join(root, SIGNATURE_PATH))
  const findings = []

  for (const source of sources) {
    if (source.status !== 'included') {
      findings.push({
        id: 'source:' + source.id + ':' + source.status,
        severity: source.status === 'missing' ? 'blocked' : 'warning',
        summary: source.label + ' is ' + source.status + '.',
        evidence: [source.relativePath, source.error || '-']
      })
    } else if (source.reportStatus === 'blocked') {
      findings.push({
        id: 'source:' + source.id + ':blocked-report',
        severity: 'blocked',
        summary: source.label + ' reports blocked status.',
        evidence: [source.relativePath, source.sha256]
      })
    } else if (source.reportStatus === 'warning') {
      findings.push({
        id: 'source:' + source.id + ':warning-report',
        severity: 'warning',
        summary: source.label + ' reports warning status.',
        evidence: [source.relativePath, source.sha256]
      })
    }
  }

  let verificationStatus = 'not-signed'
  let verified = false
  let signed = false
  let algorithm
  let keyId

  if (!signatureResult.value) {
    if (signatureResult.missing) {
      findings.push({
        id: 'signature:not-signed',
        severity: optional ? 'warning' : 'blocked',
        summary: 'No release-signature.json envelope has been exported.',
        evidence: [signatureResult.error || 'missing']
      })
    } else {
      // A present-but-unreadable envelope is corruption, not "not signed yet":
      // --optional only covers the genuinely absent file.
      verificationStatus = 'invalid'
      findings.push({
        id: 'signature:invalid',
        severity: 'blocked',
        summary: 'Existing release-signature.json cannot be parsed.',
        evidence: [signatureResult.error || 'unreadable']
      })
    }
  } else {
    const existing = signatureResult.value
    const signature = existing.signature
    algorithm = signature?.algorithm
    keyId = signature?.keyId
    signed = signature?.status === 'signed'
    if (!signature || !(signature.payloadSha256 || existing.payload?.sha256)) {
      verificationStatus = 'invalid'
      findings.push({
        id: 'signature:invalid',
        severity: 'blocked',
        summary: 'Existing release signature is missing payload or signature metadata.',
        evidence: [SIGNATURE_PATH]
      })
    } else if ((signature.payloadSha256 || existing.payload.sha256) !== payload.sha256) {
      verificationStatus = 'mismatch'
      findings.push({
        id: 'signature:mismatch',
        severity: 'blocked',
        summary: 'Existing release signature payload digest does not match current evidence sources.',
        evidence: ['expected ' + payload.sha256, 'found ' + (signature.payloadSha256 || existing.payload.sha256)]
      })
    } else if (signature.status !== 'signed' || signature.algorithm !== 'HMAC-SHA256') {
      verificationStatus = 'unsigned'
      findings.push({
        id: 'signature:unsigned',
        severity: allowUnsigned || optional ? 'warning' : 'blocked',
        summary: 'Existing release signature is digest-only and not HMAC signed.',
        evidence: ['payload ' + payload.sha256]
      })
    } else if (!process.env[SIGNING_KEY_ENV]) {
      verificationStatus = 'key-unavailable'
      findings.push({
        id: 'signature:key-unavailable',
        severity: allowUnsigned || optional ? 'warning' : 'blocked',
        summary: SIGNING_KEY_ENV + ' is unavailable, so the HMAC value cannot be verified.',
        evidence: ['payload ' + payload.sha256, 'keyId ' + (signature.keyId || '-')]
      })
    } else {
      const expected = createHmac('sha256', process.env[SIGNING_KEY_ENV]).update(payload.canonicalJson).digest('hex')
      if (expected === signature.value) {
        verificationStatus = 'verified'
        verified = true
      } else {
        verificationStatus = 'invalid'
        findings.push({
          id: 'signature:invalid',
          severity: 'blocked',
          summary: 'Existing HMAC signature does not match the current payload and signing key.',
          evidence: ['payload ' + payload.sha256]
        })
      }
    }
  }

  const blockedFindingCount = findings.filter((finding) => finding.severity === 'blocked').length
  const warningFindingCount = findings.filter((finding) => finding.severity === 'warning').length
  const status = blockedFindingCount > 0 ? 'blocked' : warningFindingCount > 0 ? 'warning' : 'ready'
  return {
    generatedAt: new Date().toISOString(),
    projectPath: root,
    status,
    verificationStatus,
    verified,
    signed,
    algorithm,
    keyId,
    payloadSha256: payload.sha256,
    sourceCount: sources.length,
    includedSourceCount: sources.filter((source) => source.status === 'included').length,
    findings
  }
}

async function readSource(root, definition) {
  const path = join(root, definition.relativePath)
  try {
    const [metadata, content] = await Promise.all([
      stat(path),
      readFile(path)
    ])
    const parsed = JSON.parse(content.toString('utf-8'))
    return {
      id: definition.id,
      label: definition.label,
      relativePath: normalizePath(relative(root, path)),
      status: 'included',
      sha256: createHash('sha256').update(content).digest('hex'),
      sizeBytes: metadata.size,
      generatedAt: parsed.generatedAt,
      reportStatus: parsed.status
    }
  } catch (error) {
    return {
      id: definition.id,
      label: definition.label,
      relativePath: normalizePath(relative(root, path)),
      status: error?.code === 'ENOENT' ? 'missing' : 'error',
      error: error?.code === 'ENOENT' ? 'Source report has not been generated yet.' : error?.message || String(error)
    }
  }
}

async function readJson(path) {
  try {
    return { value: JSON.parse(await readFile(path, 'utf-8')) }
  } catch (error) {
    // Distinguish "not exported yet" from "corrupted": only ENOENT may be
    // treated as unsigned by the --optional mode.
    return {
      error: error?.message || String(error),
      missing: error?.code === 'ENOENT'
    }
  }
}

function buildPayload(sources) {
  const payloadSources = sources
    .filter((source) => source.status === 'included' && source.sha256 && typeof source.sizeBytes === 'number')
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
    purpose: 'DependencyHub Desktop.release-evidence',
    sourceCount: sources.length,
    includedSourceCount: payloadSources.length,
    sources: payloadSources
  }
  const canonicalJson = stableStringify(canonicalValue)
  return {
    canonicalJson,
    sha256: createHash('sha256').update(canonicalJson).digest('hex')
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map((item) => stableStringify(item)).join(',') + ']'
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort()
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}'
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}
