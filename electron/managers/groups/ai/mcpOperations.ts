import { join } from 'path'
import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import { readTextIfExists } from '../../structuredData'
import {
  MCP_CONFIG_FILES,
  MCP_LOCK_FILE,
  type AiMutationPlan,
  type AiOperationTemplate,
  createMutationAiPlan,
  createReadOnlyAiPlan,
  isPinnedVersion,
  parseJsonWithComments,
  serverNameFromSpec,
  splitPackageSpec,
  writeFileAtomically
} from './aiTypes'
import { mcpLockEntry, mcpServerBinding, readMcpServers, withServerMap, type McpServerRecord } from './mcpInventory'

const configSources = new WeakMap<object, string>()

const MCP_OPERATION_ARGS: Record<string, string[]> = {
  sync: ['sync'],
  list: ['list'],
  tree: ['tree'],
  audit: ['audit']
}

export function createMcpOperationTemplate(request: ManagerOperationRequest): AiOperationTemplate {
  if (request.operation === 'lock') return createMutationAiPlan('mcp', ['lock'])

  const readOnly = MCP_OPERATION_ARGS[request.operation]
  if (readOnly) return createReadOnlyAiPlan('mcp', readOnly)

  const packageName = request.packageName?.trim()
  if (request.operation === 'install') {
    const requirements = packageName
      ? []
      : ['A package specifier (for example @modelcontextprotocol/server-filesystem) or an https endpoint is required to add an MCP server.']
    return createMutationAiPlan('mcp', ['add', packageName || ''], requirements)
  }
  if (request.operation === 'remove') {
    const requirements = packageName ? [] : ['The MCP server name is required to remove a server definition.']
    return createMutationAiPlan('mcp', ['remove', packageName || ''], requirements)
  }

  return {
    ...createReadOnlyAiPlan('mcp', ['list']),
    requirements: [`mcp does not support ${request.operation} on this workspace.`]
  }
}

/** Serializes the current server set into the DependencyHub-managed lock evidence file. */
export function buildMcpLockContent(servers: readonly McpServerRecord[], generatedAt = new Date().toISOString()): string {
  return `${JSON.stringify({
    version: 1,
    generatedAt,
    manager: 'mcp',
    servers: servers.map((server) => {
      const entry = mcpLockEntry(server)
      return {
        name: entry.name,
        file: entry.file,
        source: entry.source,
        transport: entry.transport,
        version: entry.version ?? null,
        pinned: entry.pinned,
        hash: entry.hash
      }
    })
  }, null, 2)}\n`
}

export async function planMcpLock(cwd: string): Promise<AiMutationPlan> {
  const { servers } = await readMcpServers(cwd)
  const content = buildMcpLockContent(servers)
  return {
    files: [MCP_LOCK_FILE],
    apply: async () => {
      await writeFileAtomically(join(cwd, MCP_LOCK_FILE), content)
      const pinned = servers.filter((server) => server.pinned).length
      return `Wrote ${MCP_LOCK_FILE} with ${servers.length} MCP server(s); ${pinned} pinned, ${servers.length - pinned} unpinned.\n`
    }
  }
}

export async function planMcpMutation(cwd: string, request: ManagerOperationRequest): Promise<AiMutationPlan> {
  const packageName = request.packageName?.trim()
  if (!packageName) throw new Error('The MCP server name is required for this operation.')
  if (request.operation === 'remove') return planMcpRemoval(cwd, packageName)
  if (request.operation === 'install') return planMcpAddition(cwd, packageName, request.version)
  throw new Error(`mcp does not support ${request.operation} as a configuration mutation.`)
}

async function planMcpAddition(cwd: string, spec: string, version: string | undefined): Promise<AiMutationPlan> {
  const target = await primaryConfigFile(cwd)
  const existing = await readConfigDocument(cwd, target)
  const binding = mcpServerBinding(existing)
  const servers = { ...binding.servers }
  const entry = buildServerEntry(spec, version)
  const name = entry.name

  return {
    files: [target],
    apply: async () => {
      servers[name] = entry.definition
      // Update the same key the file already uses: writing a second
      // `mcpServers` map next to `servers` would make the edit invisible to
      // VS Code and duplicate the configuration.
      const next = withServerMap(existing, binding.keyPath, servers)
      await writeFileAtomically(join(cwd, target), formatConfigWithComments(configSources.get(existing as object) || '', next))
      return `Added MCP server "${name}" to ${target} as ${entry.spec}.\n`
    }
  }
}

async function planMcpRemoval(cwd: string, name: string): Promise<AiMutationPlan> {
  for (const file of MCP_CONFIG_FILES) {
    const text = await readTextIfExists(join(cwd, file))
    if (text === undefined) continue
    // A corrupt config elsewhere must not block removal from a healthy file:
    // the inventory reader tolerates invalid files the same way.
    let document: ReturnType<typeof parseConfigDocument>
    try {
      document = parseConfigDocument(text, file)
    } catch {
      continue
    }
    const binding = mcpServerBinding(document)
    const servers = { ...binding.servers }
    if (!(name in servers)) continue
    return {
      files: [file],
      apply: async () => {
        delete servers[name]
        const next = withServerMap(document, binding.keyPath, servers)
        await writeFileAtomically(join(cwd, file), formatConfigWithComments(configSources.get(document as object) || text, next))
        return `Removed MCP server "${name}" from ${file}.\n`
      }
    }
  }
  throw new Error(`No MCP configuration declares a server named "${name}".`)
}

function formatConfigWithComments(original: string, value: unknown): string {
  const comments = original.match(/^\s*(?:\/\/|\/\*|\*|\*\/).*$/gm) || []
  const prefix = comments.length > 0 ? `${comments.join('\n')}\n` : ''
  return `${prefix}${JSON.stringify(value, null, 2)}\n`
}

function buildServerEntry(spec: string, version: string | undefined): { name: string; spec: string; definition: Record<string, unknown> } {
  const trimmed = spec.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const name = serverNameFromSpec(trimmed.replace(/^https?:\/\//i, '')) || 'remote-server'
    return {
      name,
      spec: trimmed,
      definition: { type: /\/sse\/?$/i.test(trimmed) ? 'sse' : 'http', url: trimmed }
    }
  }

  const runner = trimmed.match(/^(npx|uvx|docker|pnpm|bunx):(.*)$/i)
  const command = runner ? runner[1].toLowerCase() : 'npx'
  const packageSpec = (runner ? runner[2] : trimmed).trim()

  if (command === 'docker') {
    const image = version && !/:[^/]+$/.test(packageSpec) ? `${packageSpec}:${version}` : packageSpec
    return { name: serverNameFromSpec(image), spec: image, definition: { command, args: ['run', '-i', '--rm', image] } }
  }

  const pinnedSpec = version && !isPinnedVersion(splitPackageSpec(packageSpec).version)
    ? `${packageSpec}@${version}`
    : packageSpec
  const name = serverNameFromSpec(packageSpec)
  const args = command === 'uvx' ? [pinnedSpec] : ['-y', pinnedSpec]
  return { name, spec: pinnedSpec, definition: { command, args } }
}

async function primaryConfigFile(cwd: string): Promise<string> {
  for (const file of MCP_CONFIG_FILES) {
    if (await readTextIfExists(join(cwd, file)) !== undefined) return file
  }
  return MCP_CONFIG_FILES[0]
}

async function readConfigDocument(cwd: string, file: string): Promise<unknown> {
  const text = await readTextIfExists(join(cwd, file))
  if (text === undefined || !text.trim()) return {}
  const document = parseConfigDocument(text, file)
  if (document && typeof document === 'object') configSources.set(document as object, text)
  return document
}

function parseConfigDocument(text: string, file: string): unknown {
  try {
    const document = parseJsonWithComments(text)
    if (document && typeof document === 'object') configSources.set(document as object, text)
    return document
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`)
  }
}
