#!/usr/bin/env node
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'

const TRUST_POLICY_PATH = '.npmDesktopManager/reports/release-trust-policy.json'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
  console.log([
    'Usage: node scripts/verify-release-trust.mjs [projectPath] [options]',
    '',
    'Options:',
    '  --optional       Exit successfully when no release trust policy has been exported yet.',
    '  --json-only      Print only JSON status output.',
    '  --quiet          Suppress explanatory output.',
    '  --allow-blocked  Do not fail on a blocked trust policy.',
    '',
    'npm-run-safe aliases: optional, json, silent, allow-blocked'
  ].join('\n'))
  process.exit(0)
}

const optionTokens = new Set(args.filter((arg) => arg.startsWith('--') || ['optional', 'json', 'silent', 'allow-blocked'].includes(arg)))
const positional = args.filter((arg) => !optionTokens.has(arg))
const projectPath = resolve(positional[0] || process.cwd())
const optional = optionTokens.has('--optional') || optionTokens.has('optional')
const jsonOnly = optionTokens.has('--json-only') || optionTokens.has('json')
const quiet = optionTokens.has('--quiet') || optionTokens.has('silent')
const allowBlocked = optionTokens.has('--allow-blocked') || optionTokens.has('allow-blocked')

const result = await readTrustPolicy(projectPath)
if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2))
} else if (!quiet) {
  console.log('release trust: ' + result.status)
  console.log('checks: ' + result.passedCheckCount + '/' + result.checkCount + ' passed')
  console.log('blocked: ' + result.blockedCheckCount)
  console.log('warnings: ' + result.warningCheckCount)
  for (const check of result.blockedChecks.concat(result.warningChecks).slice(0, 12)) {
    console.log('- ' + check.status + ': ' + check.title + ' - ' + check.summary)
  }
} else {
  console.log('release trust: ' + result.status)
}

if (result.missing && optional) {
  process.exitCode = 0
} else if ((result.missing || result.status === 'blocked') && !allowBlocked) {
  process.exitCode = 1
}

async function readTrustPolicy(root) {
  const path = join(root, TRUST_POLICY_PATH)
  try {
    const report = JSON.parse(await readFile(path, 'utf-8'))
    const checks = Array.isArray(report.checks) ? report.checks : []
    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      path,
      status: report.status || report.summary?.status || 'blocked',
      missing: false,
      checkCount: report.summary?.checkCount ?? checks.length,
      passedCheckCount: report.summary?.passedCheckCount ?? checks.filter((check) => check.status === 'passed').length,
      warningCheckCount: report.summary?.warningCheckCount ?? checks.filter((check) => check.status === 'warning').length,
      blockedCheckCount: report.summary?.blockedCheckCount ?? checks.filter((check) => check.status === 'blocked').length,
      signatureVerified: Boolean(report.summary?.signatureVerified),
      signed: Boolean(report.summary?.signed),
      blockedChecks: checks.filter((check) => check.status === 'blocked'),
      warningChecks: checks.filter((check) => check.status === 'warning')
    }
  } catch (error) {
    // Only a genuinely absent file may be waived by --optional; a corrupted
    // policy is a blocked finding like any other unreadable evidence.
    const missing = error?.code === 'ENOENT'
    const softSkip = missing && optional
    const title = missing ? 'Release trust policy is missing' : 'Release trust policy cannot be parsed'
    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      path,
      status: softSkip ? 'warning' : 'blocked',
      missing,
      checkCount: 0,
      passedCheckCount: 0,
      warningCheckCount: softSkip ? 1 : 0,
      blockedCheckCount: softSkip ? 0 : 1,
      signatureVerified: false,
      signed: false,
      blockedChecks: softSkip ? [] : [{
        id: 'release-trust-policy:missing',
        status: 'blocked',
        title,
        summary: error?.message || String(error)
      }],
      warningChecks: softSkip ? [{
        id: 'release-trust-policy:missing',
        status: 'warning',
        title,
        summary: error?.message || String(error)
      }] : []
    }
  }
}
