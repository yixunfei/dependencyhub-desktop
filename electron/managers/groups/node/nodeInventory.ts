import semver from 'semver'
import type { DependencyManagerId } from '../../../../shared/managerRegistry'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import {
  readNodeLock,
  type NodeLockDependency,
  type NodeWorkspaceManagerId
} from './nodeLockParsers'
import { readNodeWorkspaceManifests, type NodeWorkspaceManifest } from './nodeWorkspaceManifests'

const MANIFEST_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
] as const

export async function readNodeManagerInventory(
  cwd: string,
  managerId: DependencyManagerId
): Promise<ManagerDependency[]> {
  assertNodeManager(managerId)
  const [manifests, lock] = await Promise.all([
    readNodeWorkspaceManifests(cwd, managerId),
    readNodeLock(cwd, managerId)
  ])
  const lockedByName = groupLockedDependencies(lock.dependencies)
  const direct = manifests.flatMap((manifest) => manifestDependencies(manifest, managerId, lockedByName))
  const directResolutions = new Set(direct.map((item) => `${item.name}\u0000${item.resolvedVersion || ''}`))
  const locked = lock.dependencies
    .filter((item) => !directResolutions.has(`${item.name}\u0000${item.version || ''}`))
    .map((item): ManagerDependency => ({
      managerId,
      name: item.name,
      version: item.version,
      resolvedVersion: item.version,
      type: 'transitive-lock',
      scope: 'transitive',
      source: item.source,
      file: lock.file,
      direct: false
    }))

  return uniqueDependencies([...direct, ...locked])
}

function manifestDependencies(
  manifest: NodeWorkspaceManifest,
  managerId: NodeWorkspaceManagerId,
  lockedByName: Map<string, NodeLockDependency[]>
): ManagerDependency[] {
  return MANIFEST_SECTIONS.flatMap((section) => Object.entries(asRecord(manifest.data[section])).map(
    ([name, value]): ManagerDependency => {
      const requestedVersion = stringValue(value)
      const resolvedVersion = selectResolvedVersion(requestedVersion, lockedByName.get(name) || [])
      return {
        managerId,
        name,
        version: resolvedVersion || requestedVersion,
        requestedVersion,
        resolvedVersion,
        type: section,
        scope: dependencyScope(section),
        source: manifest.name ? `workspace:${manifest.name}` : undefined,
        file: manifest.file,
        direct: true,
        metadata: {
          workspace: manifest.name || manifest.file,
          manifestVersion: manifest.version || ''
        }
      }
    }
  ))
}

function selectResolvedVersion(
  requestedVersion: string | undefined,
  locked: NodeLockDependency[]
): string | undefined {
  const versions = [...new Set(locked.map((item) => item.version).filter((value): value is string => Boolean(value)))]
  if (versions.length === 0) return undefined
  if (versions.length === 1) return versions[0]

  const range = normalizeRange(requestedVersion)
  const matching = range
    ? versions.filter((version) => semver.valid(version) && semver.satisfies(version, range, { includePrerelease: true, loose: true }))
    : []
  const candidates = matching.length > 0 ? matching : versions
  return [...candidates].sort(compareVersions)[0]
}

function normalizeRange(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/^workspace:/, '').trim()
  if (!normalized || /^(file|link|portal|patch|git|https?):/i.test(normalized)) return undefined
  if (normalized.startsWith('npm:')) {
    const aliasSeparator = normalized.lastIndexOf('@')
    return aliasSeparator > 3 ? normalized.slice(aliasSeparator + 1) : undefined
  }
  return semver.validRange(normalized, { loose: true }) || undefined
}

function compareVersions(left: string, right: string): number {
  if (semver.valid(left) && semver.valid(right)) return semver.rcompare(left, right)
  return right.localeCompare(left)
}

function groupLockedDependencies(items: NodeLockDependency[]): Map<string, NodeLockDependency[]> {
  const grouped = new Map<string, NodeLockDependency[]>()
  for (const item of items) grouped.set(item.name, [...(grouped.get(item.name) || []), item])
  return grouped
}

function dependencyScope(section: typeof MANIFEST_SECTIONS[number]): string {
  if (section === 'devDependencies') return 'development'
  if (section === 'peerDependencies') return 'peer'
  if (section === 'optionalDependencies') return 'optional'
  return 'runtime'
}

function uniqueDependencies(items: ManagerDependency[]): ManagerDependency[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = [item.name, item.version || '', item.type, item.file, item.direct ? 'direct' : 'transitive'].join('\u0000')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function assertNodeManager(managerId: DependencyManagerId): asserts managerId is NodeWorkspaceManagerId {
  if (managerId !== 'pnpm' && managerId !== 'yarn' && managerId !== 'bun') {
    throw new Error(`Node inventory does not support ${managerId}`)
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
