import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import {
  readA2aAgentCard,
  readA2aConfigEndpoints,
  readA2aDeclarations,
  readA2aInventory,
  readA2aLock,
  type A2aEndpointRecord
} from './a2aInventory'

export async function analyzeA2aHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const [card, endpoints, declarations, locked] = await Promise.all([
    readA2aAgentCard(cwd),
    readA2aConfigEndpoints(cwd),
    readA2aDeclarations(cwd),
    readA2aLock(cwd)
  ])
  const records = [...(card ? [card] : []), ...endpoints]
  const inventory = await readA2aInventory(cwd)
  const byName = new Map(inventory.map((item) => [item.name, item]))

  const findings: ManagerHealthFinding[] = [
    ...recordFindings(records),
    ...duplicateNameFindings(records),
    ...lockFindings(records, locked),
    ...secretFindings(declarations)
  ]
  // A declared endpoint that resolves to a discovered record must keep the
  // discovered record's evidence; the reverse means the declaration is stale.
  for (const declaration of declarations) {
    const resolved = byName.get(declaration.name)
    if (resolved && resolved.status === 'missing') {
      findings.push(createHealthFinding(
        `a2a-declaration-missing:${declaration.name}`,
        'warning',
        'Declared A2A endpoint was not discovered locally',
        `The manifest declares "${declaration.name}" from ${declaration.source || 'an unknown source'}, but no agent card or client config entry resolves it.`,
        { packageName: declaration.name, source: declaration.source }
      ))
    }
  }
  return appendHealthFindings(base, findings)
}

function recordFindings(records: readonly A2aEndpointRecord[]): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  for (const record of records) {
    if (record.invalidReason) {
      findings.push(createHealthFinding(
        `a2a-invalid:${record.name}`,
        'error',
        'Invalid A2A agent definition',
        `${record.file}: ${record.invalidReason}.`,
        { packageName: record.name, source: record.file }
      ))
      continue
    }
    if (record.url && /^http:\/\//i.test(record.url)) {
      const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(record.url)
      findings.push(createHealthFinding(
        `a2a-insecure:${record.name}`,
        isLocal ? 'warning' : 'error',
        isLocal ? 'A2A endpoint uses local development transport' : 'A2A endpoint uses an insecure transport',
        `${record.name} is served over plain HTTP${isLocal ? ' on a loopback address' : ''}. Agent-to-agent traffic should use HTTPS outside local development.`,
        { packageName: record.name, source: record.file }
      ))
    }
    if (record.origin === 'agent-card' && !record.protocolVersion) {
      findings.push(createHealthFinding(
        `a2a-protocol-missing:${record.name}`,
        'warning',
        'Agent card does not declare a protocol version',
        `${record.file} has no protocolVersion, so clients cannot negotiate A2A semantics.`,
        { packageName: record.name, source: record.file }
      ))
    }
    if (record.origin === 'agent-card' && record.authSchemes.length === 0) {
      findings.push(createHealthFinding(
        `a2a-auth-missing:${record.name}`,
        'warning',
        'Agent card declares no security schemes',
        `${record.name} publishes no securitySchemes, so every caller is treated as unauthenticated.`,
        { packageName: record.name, source: record.file }
      ))
    }
  }
  return findings
}

function duplicateNameFindings(records: readonly A2aEndpointRecord[]): ManagerHealthFinding[] {
  const byName = new Map<string, Set<string>>()
  for (const record of records) {
    const files = byName.get(record.name) || new Set<string>()
    files.add(record.file)
    byName.set(record.name, files)
  }
  const findings: ManagerHealthFinding[] = []
  for (const [name, files] of byName) {
    if (files.size < 2) continue
    findings.push(createHealthFinding(
      `a2a-duplicate:${name}`,
      'warning',
      'A2A agent name is defined in multiple files',
      `"${name}" is defined in ${[...files].sort().join(', ')}. Callers may resolve a different endpoint depending on which config is read first.`,
      { packageName: name }
    ))
  }
  return findings
}

function lockFindings(records: readonly A2aEndpointRecord[], locked: Awaited<ReturnType<typeof readA2aLock>>): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  const lockedByName = new Map(locked.map((entry) => [entry.name, entry]))
  for (const record of records) {
    const entry = lockedByName.get(record.name)
    if (!entry) {
      findings.push(createHealthFinding(
        `a2a-lock-missing-entry:${record.name}`,
        'warning',
        'A2A endpoint has no lock evidence',
        `${record.name} is not recorded in a2a-lock.json, so drift between configs and the lock cannot be detected.`,
        { packageName: record.name, source: record.file }
      ))
      continue
    }
    if (entry.hash && entry.hash !== record.hash) {
      findings.push(createHealthFinding(
        `a2a-lock-drift:${record.name}`,
        'warning',
        'A2A endpoint drifted from its lock entry',
        `${record.name} changed since a2a-lock.json was last written. Re-run lock to refresh the evidence.`,
        { packageName: record.name, source: record.file }
      ))
    }
  }
  for (const entry of locked) {
    if (!records.some((record) => record.name === entry.name)) {
      findings.push(createHealthFinding(
        `a2a-lock-extraneous:${entry.name}`,
        'info',
        'Lock entry without a matching A2A endpoint',
        `a2a-lock.json still records "${entry.name}", but no config or manifest resolves it.`,
        { packageName: entry.name, source: entry.file }
      ))
    }
  }
  return findings
}

/**
 * A declaration whose endpoint URL embeds credentials (`https://user:pass@host`)
 * leaks them to every reader of the manifest.
 */
function secretFindings(declarations: Awaited<ReturnType<typeof readA2aDeclarations>>): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  for (const declaration of declarations) {
    if (/^https?:\/\/[^/\s@]+:[^/\s@]+@/i.test(declaration.source || '')) {
      findings.push(createHealthFinding(
        `a2a-secret-literal:${declaration.name}`,
        'error',
        'A2A declaration embeds credentials in the endpoint URL',
        `The endpoint for "${declaration.name}" contains inline user information. Reference an environment-backed credential instead.`,
        { packageName: declaration.name, source: declaration.source }
      ))
    }
  }
  return findings
}
