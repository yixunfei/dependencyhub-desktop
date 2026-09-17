import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { readTextIfExists } from '../../structuredData'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { MCP_LOCK_FILE, looksLikeLiteralSecret } from './aiTypes'
import { readMcpLock, readMcpServers, runsLocalScript, type McpLockEntry, type McpServerRecord } from './mcpInventory'

export async function analyzeMcpHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const { servers, invalid } = await readMcpServers(cwd)
  const locked = await readMcpLock(cwd)
  const hasLock = (await readTextIfExists(join(cwd, MCP_LOCK_FILE))) !== undefined

  const findings = [
    ...invalidConfigFindings(invalid),
    ...servers.flatMap(serverFindings),
    ...duplicateServerFindings(servers),
    ...lockFindings(servers, locked, hasLock)
  ]
  return appendHealthFindings(base, findings)
}

function invalidConfigFindings(invalid: readonly string[]): ManagerHealthFinding[] {
  return invalid.map((file) => createHealthFinding(
    `mcp-config-invalid:${file}`,
    'error',
    'MCP configuration could not be parsed',
    `${file} is not valid JSON, so its servers are invisible to the agent runtime.`,
    { source: file }
  ))
}

function serverFindings(server: McpServerRecord): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  if (server.invalidReason) {
    findings.push(createHealthFinding(
      `mcp-invalid:${server.name}`,
      'error',
      'MCP server definition is incomplete',
      `${server.name}: ${server.invalidReason}.`,
      { packageName: server.name, source: server.file }
    ))
  }
  if (server.url?.toLowerCase().startsWith('http://')) {
    findings.push(createHealthFinding(
      `mcp-insecure:${server.name}`,
      'error',
      'Remote MCP endpoint uses insecure HTTP',
      `${server.name} connects to ${server.url}. Use HTTPS for remote tool servers.`,
      { packageName: server.name, source: server.url }
    ))
  }
  if (server.transport === 'stdio' && !server.pinned && !runsLocalScript(server)) {
    findings.push(createHealthFinding(
      `mcp-unpinned:${server.name}`,
      'warning',
      'MCP server package is not pinned',
      `${server.name} runs ${server.spec || 'an unpinned package'}; pin an exact version so the agent runtime is reproducible.`,
      { packageName: server.name, source: server.spec }
    ))
  }
  findings.push(...secretFindings(server))
  return findings
}

function secretFindings(server: McpServerRecord): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  for (const [key, value] of [...Object.entries(server.env), ...Object.entries(server.headers)]) {
    if (!looksLikeLiteralSecret(key, value)) continue
    findings.push(createHealthFinding(
      `mcp-secret:${server.name}:${key}`,
      'error',
      'Literal credential found in MCP configuration',
      `${server.name} stores a literal value for ${key} in ${server.file}. Use environment variable expansion instead.`,
      { packageName: server.name, source: server.file }
    ))
  }
  return findings
}

function duplicateServerFindings(servers: readonly McpServerRecord[]): ManagerHealthFinding[] {
  const byName = new Map<string, Set<string>>()
  for (const server of servers) {
    const specs = byName.get(server.name) || new Set<string>()
    specs.add(`${server.spec}|${server.transport}`)
    byName.set(server.name, specs)
  }
  const findings: ManagerHealthFinding[] = []
  for (const [name, specs] of byName) {
    if (specs.size < 2) continue
    findings.push(createHealthFinding(
      `mcp-duplicate:${name}`,
      'warning',
      'MCP server is declared with conflicting definitions',
      `${name} is declared ${specs.size} times with different commands or transports across MCP configuration files.`,
      { packageName: name }
    ))
  }
  return findings
}

function lockFindings(
  servers: readonly McpServerRecord[],
  locked: readonly McpLockEntry[],
  hasLock: boolean
): ManagerHealthFinding[] {
  if (!hasLock) return []
  const findings: ManagerHealthFinding[] = []
  const lockByName = new Map(locked.map((entry) => [entry.name, entry]))

  for (const server of servers) {
    const entry = lockByName.get(server.name)
    if (!entry) {
      findings.push(createHealthFinding(
        `mcp-lock-missing-entry:${server.name}`,
        'warning',
        'Lock evidence is missing for an MCP server',
        `${server.name} is declared but absent from ${MCP_LOCK_FILE}.`,
        { packageName: server.name, source: server.file }
      ))
      continue
    }
    if (entry.source !== server.spec) {
      findings.push(createHealthFinding(
        `mcp-lock-drift:${server.name}`,
        'warning',
        'MCP server definition drifted from its lock evidence',
        `${server.name} is locked as "${entry.source}" but is declared as "${server.spec}".`,
        { packageName: server.name, source: server.file }
      ))
    }
  }

  const declared = new Set(servers.map((server) => server.name))
  for (const entry of locked) {
    if (declared.has(entry.name)) continue
    findings.push(createHealthFinding(
      `mcp-lock-stale:${entry.name}`,
      'warning',
      'Lock evidence references a removed MCP server',
      `${entry.name} is recorded in ${MCP_LOCK_FILE} but no longer declared.`,
      { packageName: entry.name, source: MCP_LOCK_FILE }
    ))
  }
  return findings
}
