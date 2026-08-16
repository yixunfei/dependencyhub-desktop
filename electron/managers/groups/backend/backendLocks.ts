import { join } from 'path'
import type { LockedDependency } from '../../inventoryMerge'
import {
  asArray,
  asRecord,
  asString,
  parseJsonDocument,
  readTextIfExists,
  recordEntries,
  stringArray
} from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import type { BackendWorkspaceManagerId } from './backendTypes'

export async function readBackendLocks(
  cwd: string,
  managerId: BackendWorkspaceManagerId
): Promise<LockedDependency[]> {
  if (managerId === 'nuget') return await readNugetLocks(cwd)
  if (managerId === 'composer') return await readComposerLock(cwd)
  return await readBundlerLocks(cwd)
}

async function readNugetLocks(cwd: string): Promise<LockedDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'packages.lock.json')
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return []
    const document = asRecord(parseJsonDocument(content, file))
    return nugetLockDependencies(document?.dependencies, file)
  }))
  return inventories.flat()
}

function nugetLockDependencies(value: unknown, file: string): LockedDependency[] {
  const grouped = new Map<string, LockedDependency & { frameworks: Set<string> }>()
  for (const [framework, frameworkValue] of recordEntries(value)) {
    for (const [name, dependencyValue] of recordEntries(frameworkValue)) {
      const dependency = asRecord(dependencyValue)
      const version = asString(dependency?.resolved)
      const type = asString(dependency?.type) || 'Transitive'
      const key = `${name.toLowerCase()}\u0000${version || ''}\u0000${type}`
      const existing = grouped.get(key)
      if (existing) {
        existing.frameworks.add(framework)
        continue
      }
      grouped.set(key, {
        name,
        version,
        requestedVersion: asString(dependency?.requested),
        file,
        type: `packages.lock.json:${type.toLowerCase()}`,
        direct: type.toLowerCase() === 'direct' || type.toLowerCase() === 'project',
        integrity: asString(dependency?.contentHash),
        metadata: {
          dependencyCount: recordEntries(dependency?.dependencies).length,
          frameworks: framework
        },
        frameworks: new Set([framework])
      })
    }
  }
  return [...grouped.values()].map(({ frameworks, ...dependency }) => ({
    ...dependency,
    metadata: { ...(dependency.metadata || {}), frameworks: [...frameworks].join(',') }
  }))
}

async function readComposerLock(cwd: string): Promise<LockedDependency[]> {
  const file = 'composer.lock'
  const content = await readTextIfExists(join(cwd, file))
  if (!content) return []
  const document = asRecord(parseJsonDocument(content, file))
  return [
    ...composerLockSection(document?.packages, 'runtime', file),
    ...composerLockSection(document?.['packages-dev'], 'development', file)
  ]
}

function composerLockSection(value: unknown, scope: string, file: string): LockedDependency[] {
  return asArray(value).flatMap((item) => {
    const pkg = asRecord(item)
    const name = asString(pkg?.name)
    if (!name) return []
    const dist = asRecord(pkg?.dist)
    const source = asRecord(pkg?.source)
    const licenses = stringArray(pkg?.license)
    return [{
      name,
      version: asString(pkg?.version)?.replace(/^v(?=\d)/, ''),
      file,
      scope,
      source: asString(dist?.url) || asString(source?.url),
      integrity: asString(dist?.shasum) || asString(pkg?.['dist-shasum']),
      metadata: compactMetadata({
        license: licenses.join(','),
        packageType: asString(pkg?.type),
        dependencyCount: recordEntries(pkg?.require).length
      })
    }]
  })
}

async function readBundlerLocks(cwd: string): Promise<LockedDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'Gemfile.lock', { maxDepth: 5 })
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    return content ? parseBundlerLock(content, file) : []
  }))
  return inventories.flat()
}

interface BundlerLockPackage {
  name: string
  version: string
  source?: string
  sourceType: string
}

function parseBundlerLock(content: string, file: string): LockedDependency[] {
  const lines = content.split(/\r?\n/)
  const direct = parseBundlerDirectRequirements(lines)
  const checksums = parseBundlerChecksums(lines)
  const packages: BundlerLockPackage[] = []
  let section = ''
  let source: string | undefined
  for (const line of lines) {
    if (/^[A-Z][A-Z ]+$/.test(line)) {
      section = line.trim()
      source = undefined
      continue
    }
    if (!['GEM', 'GIT', 'PATH'].includes(section)) continue
    const remote = line.match(/^\s{2}remote:\s*(.+)$/)?.[1]
    const revision = line.match(/^\s{2}revision:\s*(.+)$/)?.[1]
    if (remote) source = remote.trim()
    if (revision && source) source = `${source}#${revision.trim()}`
    const spec = line.match(/^\s{4}([^\s(]+)\s+\(([^)]+)\)\s*$/)
    if (spec) packages.push({ name: spec[1], version: spec[2], source, sourceType: section.toLowerCase() })
  }
  return packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
    requestedVersion: direct.get(pkg.name),
    file,
    type: `Gemfile.lock:${pkg.sourceType}`,
    direct: direct.has(pkg.name),
    source: pkg.source,
    integrity: checksums.get(`${pkg.name}\u0000${pkg.version}`),
    metadata: { sourceType: pkg.sourceType }
  }))
}

function parseBundlerDirectRequirements(lines: string[]): Map<string, string | undefined> {
  const dependencies = new Map<string, string | undefined>()
  let inDependencies = false
  for (const line of lines) {
    if (line === 'DEPENDENCIES') {
      inDependencies = true
      continue
    }
    if (inDependencies && /^[A-Z][A-Z ]+$/.test(line)) break
    if (!inDependencies) continue
    const match = line.match(/^\s{2}([^\s(!]+)(?:\s+\(([^)]+)\))?[!]?\s*$/)
    if (match) dependencies.set(match[1], match[2])
  }
  return dependencies
}

function parseBundlerChecksums(lines: string[]): Map<string, string> {
  const checksums = new Map<string, string>()
  let inChecksums = false
  for (const line of lines) {
    if (line === 'CHECKSUMS') {
      inChecksums = true
      continue
    }
    if (inChecksums && /^[A-Z][A-Z ]+$/.test(line)) break
    if (!inChecksums) continue
    const match = line.match(/^\s{2}([^\s(]+)\s+\(([^)]+)\)\s+(.+)$/)
    if (match) checksums.set(`${match[1]}\u0000${match[2]}`, match[3].trim())
  }
  return checksums
}

function compactMetadata(
  values: Record<string, string | number | undefined>
): Record<string, string | number> | undefined {
  const entries = Object.entries(values).filter((entry): entry is [string, string | number] => (
    entry[1] !== undefined && entry[1] !== ''
  ))
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
