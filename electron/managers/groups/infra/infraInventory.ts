import { readFile } from 'fs/promises'
import { join } from 'path'
import type { DependencyManagerId } from '../../../../shared/managerRegistry'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { parseJsonDocument, asArray, asRecord, asString, readTextIfExists } from '../../structuredData'

export type InfraManagerId = 'terraform' | 'opentofu'
export interface InfraManifestItem { name: string; source: string; version?: string; type: 'provider' | 'module'; file: string; direct: true }

export async function readInfraInventory(cwd: string, managerId: DependencyManagerId): Promise<ManagerDependency[]> {
  if (managerId !== 'terraform' && managerId !== 'opentofu') throw new Error(`Infra adapter does not support ${managerId}`)
  const manifest = await readInfraManifest(cwd, managerId)
  const locks = await readInfraLock(cwd, managerId)
  const lockBySource = new Map(locks.map((item) => [String(item.metadata?.source || item.name), item]))
  const direct = manifest.map((item) => {
    const locked = item.type === 'provider' ? lockBySource.get(item.source) : undefined
    const hashes = typeof locked?.metadata?.hashes === 'string' ? locked.metadata.hashes : ''
    return { managerId, name: item.name, version: item.version, requestedVersion: item.version, resolvedVersion: locked?.resolvedVersion, type: item.type, source: item.source, file: item.file, direct: true, integrity: locked?.integrity, metadata: { lockFile: locked?.file || null, constraints: String(locked?.metadata?.constraints || ''), hashes } } satisfies ManagerDependency
  })
  return [...direct, ...locks.filter((lock) => !manifest.some((item) => item.type === 'provider' && item.source === String(lock.metadata?.source || lock.name)))]
}

async function readInfraManifest(cwd: string, managerId: DependencyManagerId): Promise<InfraManifestItem[]> {
  const files = await findFiles(cwd, ['.tf', '.tf.json'])
  const result: InfraManifestItem[] = []
  for (const file of files) {
    const content = await readFile(join(cwd, file), 'utf-8')
    if (file.endsWith('.json')) {
      const root = asRecord(parseJsonDocument(content, file)) || {}
      const requiredProviders = asRecord((root.terraform as any)?.required_providers) || {}
      for (const [name, value] of Object.entries(requiredProviders)) {
        const record = asRecord(value); result.push({ name, source: asString(record?.source) || name, version: asString(record?.version), type: 'provider', file, direct: true })
      }
      for (const [name, value] of Object.entries(asRecord(root?.module) || {})) { const record = asRecord(value); result.push({ name, source: asString(record?.source) || name, version: asString(record?.version), type: 'module', file, direct: true }) }
    } else {
      for (const match of content.matchAll(/([A-Za-z0-9_-]+)\s*=\s*\{([\s\S]*?)\}/g)) {
        const block = match[2]; const source = block.match(/\bsource\s*=\s*"([^"]+)"/)?.[1]
        if (source) result.push({ name: match[1], source, version: block.match(/\bversion\s*=\s*"([^"]+)"/)?.[1], type: 'provider', file, direct: true })
      }
      for (const match of content.matchAll(/module\s+"([^"]+)"\s*\{([\s\S]*?)\}/g)) { const source = match[2].match(/\bsource\s*=\s*"([^"]+)"/)?.[1]; if (source) result.push({ name: match[1], source, version: match[2].match(/\bversion\s*=\s*"([^"]+)"/)?.[1], type: 'module', file, direct: true }) }
    }
  }
  return result.filter((item) => item.source)
}

async function readInfraLock(cwd: string, managerId: DependencyManagerId): Promise<ManagerDependency[]> {
  const file = '.terraform.lock.hcl'; const content = await readTextIfExists(join(cwd, file)); if (!content) return []
  return [...content.matchAll(/provider\s+"([^"]+)"\s*\{([\s\S]*?)\}/g)].map((match) => {
    const block = match[2]; const version = block.match(/\bversion\s*=\s*"([^"]+)"/)?.[1]; const constraints = block.match(/\bconstraints\s*=\s*"([^"]+)"/)?.[1]; const hashes = [...block.matchAll(/"(h1:[^"]+|zh:[^"]+)"/g)].map((item) => item[1])
    return { managerId, name: normalizeSource(match[1]), version, resolvedVersion: version, type: 'provider-lock', source: match[1], file, direct: false, integrity: hashes[0], metadata: { source: match[1], constraints: constraints || null, hashes: hashes.join(',') } } satisfies ManagerDependency
  })
}

async function findFiles(cwd: string, extensions: string[]): Promise<string[]> { const { readdir } = await import('fs/promises'); const entries = await readdir(cwd, { withFileTypes: true }); return entries.filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))).map((entry) => entry.name) }
function normalizeSource(source: string): string { return source.split('/').filter(Boolean).slice(-1)[0] || source }
