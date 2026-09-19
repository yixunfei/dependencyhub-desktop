import type { ManagerSearchQuery, ManagerSearchResult } from '../../../../shared/managerWorkspace'
import { asArray, asRecord, asString } from '../../structuredData'

/**
 * MCP package search.
 *
 * Two sources, merged:
 *  1. A curated offline catalog of the well-known reference servers, so search
 *     works with no network access and always returns stable results.
 *  2. A live query against the official MCP registry (registry.modelcontextprotocol.io),
 *     which is best-effort: any failure or timeout is swallowed and the curated
 *     results are still returned.
 */

interface McpCatalogEntry {
  name: string
  version: string
  description: string
  source: string
  homepage: string
  transport: 'stdio' | 'http' | 'sse'
}

const CURATED_CATALOG: readonly McpCatalogEntry[] = [
  {
    name: '@modelcontextprotocol/server-filesystem',
    version: '0.6.2',
    description: 'Reference MCP server exposing controlled filesystem access (read/write/move/search) inside allowed directories.',
    source: 'npx -y @modelcontextprotocol/server-filesystem@0.6.2',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: '@modelcontextprotocol/server-memory',
    version: '0.6.3',
    description: 'Reference MCP server providing a persistent knowledge-graph memory for conversations.',
    source: 'npx -y @modelcontextprotocol/server-memory@0.6.3',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: '@modelcontextprotocol/server-sequential-thinking',
    version: '0.6.2',
    description: 'Reference MCP server for structured, revisable step-by-step reasoning chains.',
    source: 'npx -y @modelcontextprotocol/server-sequential-thinking@0.6.2',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: '@modelcontextprotocol/server-everything',
    version: '0.6.2',
    description: 'Reference MCP server exercising every MCP capability: tools, resources, prompts, sampling, and more.',
    source: 'npx -y @modelcontextprotocol/server-everything@0.6.2',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: '@modelcontextprotocol/server-puppeteer',
    version: '0.6.2',
    description: 'Reference MCP server for browser automation and web scraping via Puppeteer.',
    source: 'npx -y @modelcontextprotocol/server-puppeteer@0.6.2',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: '@modelcontextprotocol/server-brave-search',
    version: '0.6.2',
    description: 'Reference MCP server for web and local search using the Brave Search API.',
    source: 'npx -y @modelcontextprotocol/server-brave-search@0.6.2',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: 'mcp-server-git',
    version: '0.6.2',
    description: 'Reference MCP server for reading and operating Git repositories (status, diff, log, commit).',
    source: 'uvx mcp-server-git',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: 'mcp-server-fetch',
    version: '0.6.2',
    description: 'Reference MCP server for fetching web content and converting it to markdown for model consumption.',
    source: 'uvx mcp-server-fetch',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: 'mcp-server-time',
    version: '0.6.2',
    description: 'Reference MCP server for time and timezone conversion queries.',
    source: 'uvx mcp-server-time',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: 'mcp-server-sqlite',
    version: '0.6.1',
    description: 'Reference MCP server for querying and analyzing local SQLite databases.',
    source: 'uvx mcp-server-sqlite --db-path data.db',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    transport: 'stdio'
  },
  {
    name: '@playwright/mcp',
    version: '0.0.28',
    description: 'Microsoft Playwright MCP server for structured browser automation with accessibility-tree snapshots.',
    source: 'npx -y @playwright/mcp@0.0.28',
    homepage: 'https://github.com/microsoft/playwright-mcp',
    transport: 'stdio'
  },
  {
    name: 'exa-mcp-server',
    version: '2.2.2',
    description: 'Exa web-search MCP server with semantic search, code search, and company research tools.',
    source: 'npx -y exa-mcp-server@2.2.2',
    homepage: 'https://github.com/exa-labs/exa-mcp-server',
    transport: 'stdio'
  }
]

const LIVE_REGISTRY_ENDPOINT = 'https://registry.modelcontextprotocol.io/v0/servers'
const LIVE_TIMEOUT_MS = 6000

export async function searchMcpServers(query: ManagerSearchQuery): Promise<ManagerSearchResult[]> {
  const text = query.text.trim().toLowerCase()
  const limit = Math.max(1, Math.min(50, query.limit ?? 20))

  const curated = CURATED_CATALOG
    .filter((entry) => matchesCatalogEntry(entry.name, entry.description, text))
    .map((entry): ManagerSearchResult => ({
      managerId: 'mcp',
      name: entry.name,
      version: entry.version,
      description: entry.description,
      source: entry.source,
      homepage: entry.homepage,
      license: 'MIT',
      metadata: { transport: entry.transport, registry: 'dependencyhub-curated' }
    }))

  if (!text) return curated.slice(0, limit)

  const live = await fetchLiveRegistry(text, limit)
  const seen = new Set(live.map((item) => item.name.toLowerCase()))
  const merged = [...live, ...curated.filter((item) => !seen.has(item.name.toLowerCase()))]
  return merged.slice(0, limit)
}

function matchesCatalogEntry(name: string, description: string, text: string): boolean {
  if (!text) return true
  return `${name} ${description}`.toLowerCase().includes(text)
}

/** Best-effort live query; never throws so offline usage still returns curated results. */
async function fetchLiveRegistry(text: string, limit: number): Promise<ManagerSearchResult[]> {
  try {
    const url = `${LIVE_REGISTRY_ENDPOINT}?search=${encodeURIComponent(text)}&limit=${limit}`
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(LIVE_TIMEOUT_MS)
    })
    if (!response.ok) return []
    const payload: unknown = await response.json()
    return toLiveResults(payload, limit)
  } catch {
    return []
  }
}

/** Tolerates both `servers: [...]` and bare-array registry response shapes. */
export function toLiveResults(payload: unknown, limit: number): ManagerSearchResult[] {
  const record = asRecord(payload)
  const items = asArray(record?.servers).slice(0, limit)
  const results: ManagerSearchResult[] = []
  for (const item of items) {
    const wrapper = asRecord(item)
    const server = asRecord(wrapper?.server) || wrapper
    if (!server) continue
    const name = asString(server.name)?.trim()
    if (!name) continue
    const version = asString(wrapper?.version)?.trim() || asString(server.version)?.trim()
    const repository = asRecord(server.repository)
    const homepage = asString(server.websiteUrl)?.trim() || asString(repository?.url)?.trim()
    results.push({
      managerId: 'mcp',
      name,
      version: version || undefined,
      description: asString(server.description)?.trim() || undefined,
      homepage: homepage || undefined,
      metadata: { registry: 'registry.modelcontextprotocol.io', live: true }
    })
  }
  return results
}
