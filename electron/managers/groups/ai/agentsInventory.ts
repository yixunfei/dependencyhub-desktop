import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { asArray, asRecord, asString, readTextIfExists } from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import { readDeclaredEntries, type DeclaredAiEntry } from './aiManifest'
import {
  AGENTS_LOCK_FILE,
  AGENTS_MANIFEST_FILE,
  AGENT_FILE_PATTERNS,
  frontmatterList,
  frontmatterString,
  parseFrontmatter,
  parseJsonWithComments,
  sha256
} from './aiTypes'

export interface AgentRecord {
  name: string
  declaredName?: string
  file: string
  type: string
  version?: string
  description?: string
  tools: string[]
  model?: string
  frontmatterPresent: boolean
  lineCount: number
  bytes: number
  hash: string
}

export interface AgentLockEntry {
  name: string
  path: string
  type: string
  version?: string
  hash: string
}

/** Scans instruction, rule, and subagent definition files across the project. */
export async function readAgentRecords(cwd: string): Promise<AgentRecord[]> {
  const matches = await findWorkspaceFiles(cwd, (_fileName, relativePath) => classifyAgentFile(relativePath) !== undefined, { maxDepth: 6 })
  const records: AgentRecord[] = []
  for (const file of matches) {
    const content = await readTextIfExists(join(cwd, file))
    if (content === undefined) continue
    records.push(toAgentRecord(file, content))
  }
  return records.sort((left, right) => left.name.localeCompare(right.name))
}

export async function readAgentDeclarations(cwd: string): Promise<DeclaredAiEntry[]> {
  return await readDeclaredEntries(cwd, AGENTS_MANIFEST_FILE, 'agents')
}

export async function readAgentsLock(cwd: string): Promise<AgentLockEntry[]> {
  const text = await readTextIfExists(join(cwd, AGENTS_LOCK_FILE))
  if (text === undefined || !text.trim()) return []
  let root: unknown
  try {
    root = parseJsonWithComments(text)
  } catch {
    return []
  }
  return asArray(asRecord(root)?.agents).flatMap((item) => {
    const record = asRecord(item)
    const name = asString(record?.name)?.trim()
    if (!name) return []
    return [{
      name,
      path: asString(record?.path) || '',
      type: asString(record?.type) || 'instructions',
      version: asString(record?.version)?.trim() || undefined,
      hash: asString(record?.hash) || ''
    }]
  })
}

export async function readAgentsInventory(cwd: string): Promise<ManagerDependency[]> {
  const [records, declarations, locked] = await Promise.all([
    readAgentRecords(cwd),
    readAgentDeclarations(cwd),
    readAgentsLock(cwd)
  ])
  const lockByName = new Map(locked.map((entry) => [entry.name, entry]))
  const localNames = new Set(records.map((record) => record.name))

  const local = records.map((record) => {
    const lock = lockByName.get(record.name)
    // Instruction files are rarely versioned; fall back to a content-addressed version so
    // every entry carries reproducible evidence instead of an empty version column.
    const contentVersion = record.version || record.hash.slice(0, 12)
    return {
      managerId: 'ai-agents' as const,
      name: record.name,
      version: contentVersion,
      requestedVersion: record.version,
      resolvedVersion: lock?.version || contentVersion,
      type: record.type,
      source: record.file,
      file: record.file,
      direct: true,
      status: record.frontmatterPresent || record.type === 'instructions' ? 'installed' as const : 'invalid' as const,
      integrity: lock?.hash || record.hash,
      metadata: {
        description: record.description || null,
        tools: record.tools.join(','),
        model: record.model || null,
        frontmatter: record.frontmatterPresent,
        lines: record.lineCount,
        bytes: record.bytes,
        versionSource: record.version ? 'frontmatter' : 'content-hash',
        declared: declarations.some((declaration) => declaration.name === record.name)
      }
    }
  })

  const declaredOnly = declarations
    .filter((declaration) => !localNames.has(declaration.name))
    .map((declaration) => ({
      managerId: 'ai-agents' as const,
      name: declaration.name,
      version: declaration.version,
      requestedVersion: declaration.version,
      type: declaration.type || 'declaration',
      source: declaration.source,
      file: AGENTS_MANIFEST_FILE,
      direct: true,
      status: 'missing' as const,
      metadata: { declared: true }
    }))

  const lockOnly = locked
    .filter((entry) => !localNames.has(entry.name))
    .map((entry) => ({
      managerId: 'ai-agents' as const,
      name: entry.name,
      version: entry.version,
      type: 'lock-entry',
      source: entry.path,
      file: AGENTS_LOCK_FILE,
      direct: false,
      status: 'extraneous' as const,
      integrity: entry.hash,
      metadata: { agentType: entry.type }
    }))

  return [...local, ...declaredOnly, ...lockOnly]
}

function agentLockEntry(record: AgentRecord): AgentLockEntry {
  return { name: record.name, path: record.file, type: record.type, version: record.version, hash: record.hash }
}

export function buildAgentsLockContent(records: readonly AgentRecord[], generatedAt = new Date().toISOString()): string {
  return `${JSON.stringify({
    version: 1,
    generatedAt,
    manager: 'ai-agents',
    agents: records.map((record) => {
      const entry = agentLockEntry(record)
      return {
        name: entry.name,
        path: entry.path,
        type: entry.type,
        version: entry.version ?? null,
        hash: entry.hash
      }
    })
  }, null, 2)}\n`
}

export function classifyAgentFile(relativePath: string): string | undefined {
  const normalized = relativePath.replace(/\\/g, '/')
  for (const { pattern, type } of AGENT_FILE_PATTERNS) {
    if (pattern.test(normalized)) return type
  }
  return undefined
}

function toAgentRecord(file: string, content: string): AgentRecord {
  const frontmatter = parseFrontmatter(content)
  const declaredName = frontmatterString(frontmatter.data, 'name')
  const baseName = file.split('/').filter(Boolean).pop()?.replace(/\.[^.]+$/, '') || file
  const type = classifyAgentFile(file) || 'instructions'
  return {
    name: declaredName || baseName,
    declaredName,
    file,
    type,
    version: frontmatterString(frontmatter.data, 'version'),
    description: frontmatterString(frontmatter.data, 'description'),
    tools: frontmatterList(frontmatter.data, 'tools', 'allowed-tools', 'allowed_tools'),
    model: frontmatterString(frontmatter.data, 'model'),
    frontmatterPresent: frontmatter.present,
    lineCount: content.split(/\r?\n/).length,
    bytes: Buffer.byteLength(content, 'utf-8'),
    hash: sha256(content)
  }
}
