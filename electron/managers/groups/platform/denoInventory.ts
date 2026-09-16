import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { asRecord, asString, parseJsonDocument, readTextIfExists } from '../../structuredData'

export async function readDenoInventory(cwd: string): Promise<ManagerDependency[]> {
  const manifestFile = await existing(cwd, ['deno.json', 'deno.jsonc'])
  const lockFile = await existing(cwd, ['deno.lock'])
  const direct: ManagerDependency[] = []
  if (manifestFile) {
    const raw = await readTextIfExists(join(cwd, manifestFile))
    const root = asRecord(parseJsonDocument(manifestFile.endsWith('.jsonc') ? stripJsonComments(raw || '{}') : (raw || '{}'), manifestFile)) || {}
    for (const [name, value] of Object.entries(asRecord(root.imports) || {})) {
      const source = asString(value)?.trim()
      if (!source) continue
      direct.push({ managerId: 'deno', name, version: inferVersion(source), requestedVersion: source, type: 'import', source, file: manifestFile, direct: true })
    }
    for (const [workspace, value] of Object.entries(asRecord(root.workspaces) || {})) {
      void value
      direct.push({ managerId: 'deno', name: workspace, type: 'workspace', source: workspace, file: manifestFile, direct: true })
    }
  }
  const locked = lockFile ? readDenoLock(await readTextIfExists(join(cwd, lockFile)) || '', lockFile) : []
  const directSources = new Set(direct.map((item) => item.source))
  const lockedBySource = new Map(locked.map((item) => [item.source, item]))
  const mergedDirect = direct.map((item) => {
    const lock = item.source ? lockedBySource.get(item.source) : undefined
    return lock ? { ...item, resolvedVersion: lock.resolvedVersion, integrity: lock.integrity } : item
  })
  return [...mergedDirect, ...locked.filter((item) => !directSources.has(item.source))]
}

function readDenoLock(content: string, file: string): ManagerDependency[] {
  if (!content.trim()) return []
  const root = asRecord(parseJsonDocument(content, file)) || {}
  const result: ManagerDependency[] = []
  for (const section of ['remote', 'npm', 'jsr']) {
    for (const [key, value] of Object.entries(asRecord(root[section]) || {})) {
      const record = asRecord(value)
      const integrity = asString(record?.integrity) || (typeof value === 'string' ? value : undefined)
      const version = asString(record?.version) || inferVersion(key)
      result.push({ managerId: 'deno', name: deriveName(key), version, resolvedVersion: version, type: `${section}-lock`, source: key, file, direct: false, integrity })
    }
  }
  return result
}

function deriveName(source: string): string {
  const registry = source.match(/^(?:npm|jsr):((?:@[^/]+\/)?[^@/]+)/)
  if (registry) return registry[1]
  const url = source.match(/^https?:\/\/[^/]+\/((?:@[^/]+\/)?[^@/]+)/)
  if (url) return url[1]
  return source
}

function inferVersion(source: string): string | undefined {
  const match = source.match(/@(\d[^/\s?]*)/) || source.match(/[?&]version=([^&#]+)/i)
  return match?.[1]
}

function stripJsonComments(value: string): string {
  let result = ''
  let inString = false
  let quote = ''
  let inLine = false
  let inBlock = false
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    const next = value[i + 1]
    if (inLine) { if (char === '\n') { inLine = false; result += char } continue }
    if (inBlock) { if (char === '*' && next === '/') { inBlock = false; i += 1 } continue }
    if (inString) { result += char; if (char === '\\') { result += next || ''; i += 1 } else if (char === quote) { inString = false } continue }
    if (char === '"' || char === "'") { inString = true; quote = char; result += char; continue }
    if (char === '/' && next === '/') { inLine = true; i += 1; continue }
    if (char === '/' && next === '*') { inBlock = true; i += 1; continue }
    result += char
  }
  return result
}

async function existing(cwd: string, names: string[]): Promise<string | undefined> {
  for (const name of names) if (await readTextIfExists(join(cwd, name)) !== undefined) return name
  return undefined
}
