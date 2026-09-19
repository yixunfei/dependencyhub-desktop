import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { asArray, asRecord, asString, readTextIfExists } from '../../structuredData'
import {
  MCP_CONFIG_FILES,
  MCP_LOCK_FILE,
  isPinnedVersion,
  parseJsonWithComments,
  sha256,
  splitPackageSpec
} from './aiTypes'

export interface McpServerRecord {
  name: string
  file: string
  transport: string
  command?: string
  args: string[]
  url?: string
  env: Record<string, string>
  headers: Record<string, string>
  spec: string
  version?: string
  pinned: boolean
  invalidReason?: string
}

export interface McpLockEntry {
  name: string
  file: string
  source: string
  transport: string
  version?: string
  pinned: boolean
  hash: string
}

/** Reads every MCP configuration file present in the project, most specific first. */
export async function readMcpServers(cwd: string): Promise<{ servers: McpServerRecord[]; files: string[]; invalid: string[] }> {
  const servers: McpServerRecord[] = []
  const files: string[] = []
  const invalid: string[] = []

  for (const file of MCP_CONFIG_FILES) {
    const text = await readTextIfExists(join(cwd, file))
    if (text === undefined) continue
    files.push(file)
    let root: unknown
    try {
      root = parseJsonWithComments(text)
    } catch {
      invalid.push(file)
      continue
    }
    for (const [name, value] of Object.entries(mcpServerMap(root))) {
      servers.push(toServerRecord(name, value, file))
    }
  }

  return { servers, files, invalid }
}

export async function readMcpInventory(cwd: string): Promise<ManagerDependency[]> {
  const { servers } = await readMcpServers(cwd)
  const locked = await readMcpLock(cwd)
  const lockedByName = new Map(locked.map((entry) => [entry.name, entry]))
  const names = new Set(servers.map((server) => server.name))

  const direct = servers.filter((server, index) => servers.findIndex((candidate) => candidate.name === server.name) === index).map((server) => {
    const lock = lockedByName.get(server.name)
    return {
      managerId: 'mcp' as const,
      name: server.name,
      version: server.version,
      requestedVersion: server.spec,
      resolvedVersion: lock?.version || server.version,
      type: server.transport,
      source: server.spec,
      file: server.file,
      direct: true,
      status: server.invalidReason ? 'invalid' as const : 'installed' as const,
      integrity: lock?.hash,
      metadata: {
        transport: server.transport,
        command: server.command || null,
        args: server.args.join(' '),
        url: server.url || null,
        envKeys: Object.keys(server.env).join(','),
        headerKeys: Object.keys(server.headers).join(','),
        pinned: server.pinned,
        issue: server.invalidReason || null
      }
    }
  })

  const lockOnly = locked
    .filter((entry) => !names.has(entry.name))
    .map((entry) => ({
      managerId: 'mcp' as const,
      name: entry.name,
      version: entry.version,
      requestedVersion: entry.source,
      resolvedVersion: entry.version,
      type: 'lock-entry',
      source: entry.source,
      file: MCP_LOCK_FILE,
      direct: false,
      status: 'extraneous' as const,
      integrity: entry.hash,
      metadata: { transport: entry.transport, pinned: entry.pinned }
    }))

  return [...direct, ...lockOnly]
}

export async function readMcpLock(cwd: string): Promise<McpLockEntry[]> {
  const text = await readTextIfExists(join(cwd, MCP_LOCK_FILE))
  if (text === undefined || !text.trim()) return []
  let root: unknown
  try {
    root = parseJsonWithComments(text)
  } catch {
    return []
  }
  const record = asRecord(root)
  return asArray(record?.servers).flatMap((item) => {
    const entry = asRecord(item)
    const name = asString(entry?.name)
    if (!name) return []
    return [{
      name,
      file: asString(entry?.file) || MCP_LOCK_FILE,
      source: asString(entry?.source) || '',
      transport: asString(entry?.transport) || 'stdio',
      version: asString(entry?.version) || undefined,
      pinned: entry?.pinned === true,
      hash: asString(entry?.hash) || ''
    }]
  })
}

export interface McpServerBinding {
  /** Path from the document root to the server map (e.g. ['servers'] or ['mcp', 'servers']). */
  keyPath: string[]
  servers: Record<string, unknown>
}

/**
 * Locate the server map in any of the shapes the ecosystem uses. The key path
 * is returned so writers can update the same location instead of always
 * creating an `mcpServers` entry next to the real one.
 */
export function mcpServerBinding(root: unknown): McpServerBinding {
  const record = asRecord(root)
  if (!record) return { keyPath: ['mcpServers'], servers: {} }
  const direct = asRecord(record.mcpServers)
  if (direct) return { keyPath: ['mcpServers'], servers: direct }
  const servers = asRecord(record.servers)
  if (servers) return { keyPath: ['servers'], servers }
  const nested = asRecord(asRecord(record.mcp)?.servers)
  if (nested) return { keyPath: ['mcp', 'servers'], servers: nested }
  return { keyPath: ['mcpServers'], servers: {} }
}

export function mcpServerMap(root: unknown): Record<string, unknown> {
  return mcpServerBinding(root).servers
}

/** Replace the server map at the same key path it was read from. */
export function withServerMap(
  root: unknown,
  keyPath: string[],
  servers: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...(asRecord(root) || {}) }
  if (keyPath.length === 1) {
    next[keyPath[0]] = servers
    return next
  }
  const nested = { ...(asRecord(next[keyPath[0]]) || {}) }
  nested[keyPath[1]] = servers
  next[keyPath[0]] = nested
  return next
}

function toServerRecord(name: string, value: unknown, file: string): McpServerRecord {
  const record = asRecord(value) || {}
  const command = asString(record.command)?.trim()
  const args = asArray(record.args).map((item) => asString(item)).filter((item): item is string => Boolean(item))
  const url = asString(record.url)?.trim()
  const env = stringMap(record.env)
  const headers = stringMap(record.headers)
  const transport = (asString(record.type) || (url ? inferRemoteTransport(url) : 'stdio')).toLowerCase()
  const spec = url ? url : [command, ...args].filter(Boolean).join(' ')
  const version = inferSpecVersion(command, args)
  const pinned = isPinnedVersion(version)

  let invalidReason: string | undefined
  if (!command && !url) invalidReason = 'Server defines neither a command nor a url'
  else if (url && !/^https?:\/\//i.test(url)) invalidReason = `Unsupported url transport: ${url}`

  return { name, file, transport, command, args, url, env, headers, spec, version, pinned, invalidReason }
}

function inferRemoteTransport(url: string): string {
  return /\/sse\/?$/i.test(url) || /[?&]transport=sse/i.test(url) ? 'sse' : 'http'
}

const LOCAL_RUNTIMES = new Set(['node', 'python', 'python3', 'deno', 'bun', 'ruby', 'bash', 'sh', 'pwsh', 'powershell', 'java', 'dotnet'])

/**
 * True when a stdio server runs a script from the repository instead of a registry
 * package, where "pin the version" does not apply.
 */
export function runsLocalScript(server: McpServerRecord): boolean {
  const executable = (server.command || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase().replace(/\.exe$/, '') || ''
  if (!LOCAL_RUNTIMES.has(executable)) return false
  return server.args.some((arg) => arg.startsWith('.') || arg.startsWith('/') || /^[A-Za-z]:[\\/]/.test(arg))
}

/**
 * Derives the pinned version from the package spec inside a server command. Docker
 * images and npx/uvx packages are the two forms MCP servers use in practice.
 */
export function inferSpecVersion(command: string | undefined, args: readonly string[]): string | undefined {
  const executable = (command || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() || ''
  const tokens = args.filter((arg) => arg && !arg.startsWith('-'))
  if (executable.startsWith('docker') || executable.startsWith('podman')) {
    const image = tokens.find((token) => token.includes('/') || token.includes(':')) || tokens[tokens.length - 1]
    if (!image) return undefined
    const tag = image.split(':').slice(1).join(':')
    return tag || undefined
  }
  const packageToken = tokens.find((token) => !token.includes('/') && !token.endsWith('.ts') && !token.endsWith('.js') && !token.endsWith('.py') && !token.startsWith('.') && !token.startsWith('/'))
    || tokens[tokens.length - 1]
  if (!packageToken) return undefined
  return splitPackageSpec(packageToken).version
}

function mcpServerFingerprint(server: McpServerRecord): string {
  return sha256(`${server.name}\u0000${server.transport}\u0000${server.spec}\u0000${server.url || ''}`)
}

export function mcpLockEntry(server: McpServerRecord): McpLockEntry {
  return {
    name: server.name,
    file: server.file,
    source: server.spec,
    transport: server.transport,
    version: server.version,
    pinned: server.pinned,
    hash: mcpServerFingerprint(server)
  }
}

function stringMap(value: unknown): Record<string, string> {
  const record = asRecord(value)
  if (!record) return {}
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    const text = asString(item)
    if (text !== undefined) result[key] = text
  }
  return result
}
