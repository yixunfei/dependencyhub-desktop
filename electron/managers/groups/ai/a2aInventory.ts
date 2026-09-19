import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { asArray, asRecord, asString, readTextIfExists } from '../../structuredData'
import { readDeclaredEntries, type DeclaredAiEntry } from './aiManifest'
import {
  A2A_CONFIG_FILES,
  A2A_LOCK_FILE,
  A2A_MANIFEST_FILE,
  parseJsonWithComments,
  sha256
} from './aiTypes'

export interface A2aEndpointRecord {
  name: string
  file: string
  /** Where the endpoint was discovered: the served card, the client config, or the DependencyHub manifest. */
  origin: 'agent-card' | 'config' | 'declaration'
  url?: string
  protocolVersion?: string
  description?: string
  skills: string[]
  authSchemes: string[]
  hash: string
  invalidReason?: string
}

export interface A2aLockEntry {
  name: string
  file: string
  source: string
  url?: string
  version?: string
  hash: string
}

/** Reads the A2A agent card served from the well-known location, if present. */
export async function readA2aAgentCard(cwd: string): Promise<A2aEndpointRecord | undefined> {
  const file = A2A_CONFIG_FILES[0]
  const text = await readTextIfExists(join(cwd, file))
  if (text === undefined) return undefined
  let root: unknown
  try {
    root = parseJsonWithComments(text)
  } catch (error) {
    return {
      name: file,
      file,
      origin: 'agent-card',
      skills: [],
      authSchemes: [],
      hash: sha256(text),
      invalidReason: `${file} is not valid JSON: ${(error as Error).message}`
    }
  }
  return toEndpointRecord(root, file, 'agent-card')
}

/** Reads every remote agent endpoint declared in the client-side a2a.config.json. */
export async function readA2aConfigEndpoints(cwd: string): Promise<A2aEndpointRecord[]> {
  const file = A2A_CONFIG_FILES[1]
  const text = await readTextIfExists(join(cwd, file))
  if (text === undefined) return []
  let root: unknown
  try {
    root = parseJsonWithComments(text)
  } catch (error) {
    return [{
      name: file,
      file,
      origin: 'config',
      skills: [],
      authSchemes: [],
      hash: sha256(text),
      invalidReason: `${file} is not valid JSON: ${(error as Error).message}`
    }]
  }
  const record = asRecord(root) || {}
  // The ecosystem uses both `agents` and `remoteAgents` as the endpoint map key.
  const entries = asArray(record.agents).length > 0 ? asArray(record.agents) : asArray(record.remoteAgents)
  return entries.flatMap((item) => {
    const endpoint = toEndpointRecord(item, file, 'config')
    return endpoint ? [endpoint] : []
  })
}

export async function readA2aDeclarations(cwd: string): Promise<DeclaredAiEntry[]> {
  return await readDeclaredEntries(cwd, A2A_MANIFEST_FILE, 'agents')
}

export async function readA2aLock(cwd: string): Promise<A2aLockEntry[]> {
  const text = await readTextIfExists(join(cwd, A2A_LOCK_FILE))
  if (text === undefined || !text.trim()) return []
  let root: unknown
  try {
    root = parseJsonWithComments(text)
  } catch {
    return []
  }
  return asArray(asRecord(root)?.agents).flatMap((item) => {
    const entry = asRecord(item)
    const name = asString(entry?.name)?.trim()
    if (!name) return []
    return [{
      name,
      file: asString(entry?.file) || A2A_MANIFEST_FILE,
      source: asString(entry?.source) || '',
      url: asString(entry?.url)?.trim() || undefined,
      version: asString(entry?.version)?.trim() || undefined,
      hash: asString(entry?.hash) || ''
    }]
  })
}

/**
 * Composes the A2A dependency inventory: served agent cards, client-configured
 * remote endpoints, manifest-only declarations (missing), and lock-only
 * entries (extraneous).
 */
export async function readA2aInventory(cwd: string): Promise<ManagerDependency[]> {
  const [card, endpoints, declarations, locked] = await Promise.all([
    readA2aAgentCard(cwd),
    readA2aConfigEndpoints(cwd),
    readA2aDeclarations(cwd),
    readA2aLock(cwd)
  ])
  const records = [...(card ? [card] : []), ...endpoints]
  const lockByName = new Map(locked.map((entry) => [entry.name, entry]))
  const recordNames = new Set(records.map((record) => record.name))

  const local = records.map((record) => {
    const lock = lockByName.get(record.name)
    return {
      managerId: 'a2a' as const,
      name: record.name,
      version: record.protocolVersion,
      requestedVersion: record.protocolVersion,
      resolvedVersion: lock?.version || record.protocolVersion,
      type: record.origin,
      source: record.url || record.file,
      file: record.file,
      direct: true,
      status: record.invalidReason ? 'invalid' as const : 'installed' as const,
      integrity: lock?.hash || record.hash,
      metadata: {
        url: record.url || null,
        protocolVersion: record.protocolVersion || null,
        description: record.description || null,
        skills: record.skills.join(','),
        authSchemes: record.authSchemes.join(','),
        issue: record.invalidReason || null
      }
    }
  })

  const declaredOnly = declarations
    .filter((declaration) => !recordNames.has(declaration.name))
    .map((declaration) => ({
      managerId: 'a2a' as const,
      name: declaration.name,
      version: declaration.version,
      requestedVersion: declaration.version,
      type: 'declaration',
      source: declaration.source,
      file: A2A_MANIFEST_FILE,
      direct: true,
      status: 'missing' as const,
      metadata: { url: declaration.source || null, declared: true }
    }))

  const lockOnly = locked
    .filter((entry) => !recordNames.has(entry.name))
    .map((entry) => ({
      managerId: 'a2a' as const,
      name: entry.name,
      version: entry.version,
      type: 'lock-entry',
      source: entry.source,
      file: A2A_LOCK_FILE,
      direct: false,
      status: 'extraneous' as const,
      integrity: entry.hash,
      metadata: { url: entry.url || null }
    }))

  return [...local, ...declaredOnly, ...lockOnly]
}

export function a2aEndpointHash(record: Pick<A2aEndpointRecord, 'name' | 'url' | 'protocolVersion' | 'file'>): string {
  return sha256(`${record.name}\u0000${record.url || ''}\u0000${record.protocolVersion || ''}\u0000${record.file}`)
}

export function buildA2aLockContent(records: readonly A2aEndpointRecord[], generatedAt = new Date().toISOString()): string {
  return `${JSON.stringify({
    version: 1,
    generatedAt,
    manager: 'a2a',
    agents: records.map((record) => ({
      name: record.name,
      file: record.file,
      source: record.url || record.file,
      url: record.url ?? null,
      version: record.protocolVersion ?? null,
      hash: record.hash
    }))
  }, null, 2)}\n`
}

/**
 * Collects every local A2A endpoint record used by the lock planner. Besides the
 * card and the client config, a declaration whose source is a well-formed URL is
 * included so declarations pin the same evidence as discovered endpoints.
 */
export async function readA2aRecordsForLock(cwd: string): Promise<A2aEndpointRecord[]> {
  const [card, endpoints, declarations] = await Promise.all([
    readA2aAgentCard(cwd),
    readA2aConfigEndpoints(cwd),
    readA2aDeclarations(cwd)
  ])
  const records = [...(card ? [card] : []), ...endpoints]
  const names = new Set(records.map((record) => record.name))
  for (const declaration of declarations) {
    if (names.has(declaration.name)) continue
    const isUrl = /^https?:\/\//i.test(declaration.source)
    records.push({
      name: declaration.name,
      file: A2A_MANIFEST_FILE,
      origin: 'declaration',
      url: isUrl ? declaration.source : undefined,
      protocolVersion: declaration.version,
      skills: [],
      authSchemes: [],
      hash: a2aEndpointHash({
        name: declaration.name,
        url: isUrl ? declaration.source : undefined,
        protocolVersion: declaration.version,
        file: A2A_MANIFEST_FILE
      }),
      invalidReason: undefined
    })
  }
  return records
}

function toEndpointRecord(value: unknown, file: string, origin: A2aEndpointRecord['origin']): A2aEndpointRecord | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const name = asString(record.name)?.trim() || asString(record.preferredName)?.trim()
  const url = asString(record.url)?.trim() || asString(record.endpoint)?.trim()
  const skills = asArray(record.skills)
    .map((item) => asString(asRecord(item)?.id) || asString(item))
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim())
  const authSchemes = asArray(record.securitySchemes)
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item?.trim()))
  const protocolVersion = asString(record.protocolVersion)?.trim() || asString(record.protocol_version)?.trim()

  let invalidReason: string | undefined
  if (!name) invalidReason = 'Agent card does not declare a name'
  else if (!url) invalidReason = `Agent "${name}" does not declare a service url`

  const hashSource = JSON.stringify({ name, url, protocolVersion, file })
  return {
    name: name || file,
    file,
    origin,
    url,
    protocolVersion,
    description: asString(record.description)?.trim() || undefined,
    skills,
    authSchemes,
    hash: sha256(hashSource),
    invalidReason
  }
}
