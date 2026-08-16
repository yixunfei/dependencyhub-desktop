import { access, readFile } from 'fs/promises'
import { join } from 'path'

export type NodeWorkspaceManagerId = 'pnpm' | 'yarn' | 'bun'

export interface NodeLockDependency {
  name: string
  version?: string
  source?: string
}

export interface NodeLockInventory {
  file: string
  dependencies: NodeLockDependency[]
}

export async function readNodeLock(
  cwd: string,
  managerId: NodeWorkspaceManagerId
): Promise<NodeLockInventory> {
  if (managerId === 'pnpm') {
    const file = 'pnpm-lock.yaml'
    return { file, dependencies: parsePnpmLock(await readText(join(cwd, file))) }
  }
  if (managerId === 'yarn') {
    const file = 'yarn.lock'
    return { file, dependencies: parseYarnLock(await readText(join(cwd, file))) }
  }

  const textFile = 'bun.lock'
  const text = await readText(join(cwd, textFile))
  if (text) return { file: textFile, dependencies: parseBunLock(text) }
  const binaryFile = 'bun.lockb'
  const binaryExists = await access(join(cwd, binaryFile)).then(() => true).catch(() => false)
  return { file: binaryExists ? binaryFile : textFile, dependencies: [] }
}

export function parsePnpmLock(content: string): NodeLockDependency[] {
  if (!content.trim()) return []
  const dependencies: NodeLockDependency[] = []
  const lines = content.split(/\r?\n/)
  let sectionIndent = -1

  for (const line of lines) {
    const section = line.match(/^(\s*)(packages|snapshots)\s*:\s*$/)
    if (section) {
      sectionIndent = section[1].length
      continue
    }
    if (sectionIndent < 0 || !line.trim() || /^\s*#/.test(line)) continue
    const indent = line.match(/^\s*/)?.[0].length || 0
    if (indent <= sectionIndent) {
      sectionIndent = -1
      continue
    }
    if (indent !== sectionIndent + 2) continue
    const key = yamlKey(line)
    const parsed = key ? parsePnpmPackageKey(key) : null
    if (parsed) dependencies.push(parsed)
  }

  return uniqueDependencies(dependencies)
}

export function parseYarnLock(content: string): NodeLockDependency[] {
  if (!content.trim()) return []
  const dependencies: NodeLockDependency[] = []
  const blockPattern = /^(?!\s)([^#\r\n][^\r\n]*):\r?\n([\s\S]*?)(?=^(?!\s|#)[^\r\n]+:\r?$|(?![\s\S]))/gm

  for (const match of content.matchAll(blockPattern)) {
    const selector = unquote(match[1].split(',')[0].trim())
    if (selector === '__metadata') continue
    const name = packageNameFromSelector(selector)
    const version = match[2].match(/^\s+version(?:\s+|:\s*)['"]?([^\s'"]+)['"]?/m)?.[1]
    const resolution = match[2].match(/^\s+resolution:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]
    if (name) dependencies.push({ name, version, source: resolution || selector })
  }

  return uniqueDependencies(dependencies)
}

export function parseBunLock(content: string): NodeLockDependency[] {
  if (!content.trim()) return []
  const dependencies: NodeLockDependency[] = []
  const packageEntry = /['"]([^'"\r\n]+)['"]\s*:\s*\[\s*['"]([^'"\r\n]+)['"]/g

  for (const match of content.matchAll(packageEntry)) {
    const parsed = splitNameAndVersion(match[2])
    if (!parsed) continue
    dependencies.push({
      ...parsed,
      name: normalizeBunName(match[1], parsed.name),
      source: match[2]
    })
  }
  for (const match of content.matchAll(/['"](@?[^'"\s]+?@[^'"\s]+)['"]/g)) {
    const parsed = splitNameAndVersion(match[1])
    if (parsed) dependencies.push(parsed)
  }

  return uniqueDependencies(dependencies)
}

function parsePnpmPackageKey(value: string): NodeLockDependency | null {
  const clean = unquote(value).replace(/^\//, '').replace(/\([^)]*\).*$/, '')
  const legacy = parseLegacyPnpmKey(clean)
  if (legacy) return { ...legacy, source: value }
  const parsed = splitNameAndVersion(clean)
  return parsed ? { ...parsed, source: value } : null
}

function parseLegacyPnpmKey(value: string): NodeLockDependency | null {
  if (value.startsWith('@')) {
    const parts = value.split('/')
    if (parts.length < 3) return null
    return { name: `${parts[0]}/${parts[1]}`, version: normalizeVersion(parts.slice(2).join('/')) }
  }
  const separator = value.lastIndexOf('/')
  if (separator <= 0) return null
  return { name: value.slice(0, separator), version: normalizeVersion(value.slice(separator + 1)) }
}

function splitNameAndVersion(value: string): NodeLockDependency | null {
  const clean = unquote(value).replace(/^\//, '')
  const separator = clean.startsWith('@') ? clean.indexOf('@', 1) : clean.lastIndexOf('@')
  if (separator <= 0 || separator === clean.length - 1) return null
  return {
    name: clean.slice(0, separator),
    version: normalizeVersion(clean.slice(separator + 1)),
    source: value
  }
}

function packageNameFromSelector(selector: string): string {
  const normalized = selector.replace(/^(npm|workspace|patch|portal|link):/, '')
  const protocolIndex = normalized.indexOf('@npm:')
  if (protocolIndex > 0) return normalized.slice(0, protocolIndex)
  if (normalized.startsWith('@')) {
    const separator = normalized.indexOf('@', 1)
    return separator > 0 ? normalized.slice(0, separator) : normalized
  }
  const separator = normalized.lastIndexOf('@')
  return separator > 0 ? normalized.slice(0, separator) : normalized
}

function yamlKey(line: string): string | undefined {
  const value = line.trim()
  if (!value.endsWith(':')) return undefined
  return unquote(value.slice(0, -1).trim())
}

function normalizeVersion(value: string): string {
  return unquote(value).replace(/^npm:/, '').replace(/\([^)]*\).*$/, '')
}

function normalizeBunName(key: string, parsedName: string): string {
  return key.startsWith('@') || /^[A-Za-z0-9_.-]+$/.test(key) ? key : parsedName
}

function uniqueDependencies(items: NodeLockDependency[]): NodeLockDependency[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.name}\u0000${item.version || ''}`
    if (!item.name || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

async function readText(path: string): Promise<string> {
  return await readFile(path, 'utf-8').catch(() => '')
}
