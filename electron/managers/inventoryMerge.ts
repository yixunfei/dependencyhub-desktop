import type { DependencyManagerId } from '../../shared/managerRegistry'
import type { ManagerDependency } from '../../shared/managerWorkspace'
import { normalizePackageName } from './packageIdentity'

export interface LockedDependency {
  name: string
  version?: string
  file: string
  type?: string
  scope?: string
  source?: string
  integrity?: string
  direct?: boolean
  requestedVersion?: string
  metadata?: Record<string, string | number | boolean | null>
}

export function mergeDirectAndLocked(
  managerId: DependencyManagerId,
  directDependencies: ManagerDependency[],
  lockedDependencies: LockedDependency[]
): ManagerDependency[] {
  const lockedByName = groupLocked(managerId, lockedDependencies)
  const usedLocked = new Set<LockedDependency>()
  const direct = directDependencies.map((dependency) => {
    const key = normalizePackageName(managerId, dependency.name)
    const locked = selectLocked(dependency.requestedVersion || dependency.version, lockedByName.get(key) || [])
    if (locked) usedLocked.add(locked)
    return mergeDirectDependency(dependency, locked)
  })
  const remaining = lockedDependencies
    .filter((dependency) => !usedLocked.has(dependency))
    .map((dependency) => lockedManagerDependency(managerId, dependency))
  return uniqueDependencies([...direct, ...remaining])
}

function groupLocked(
  managerId: DependencyManagerId,
  dependencies: LockedDependency[]
): Map<string, LockedDependency[]> {
  const grouped = new Map<string, LockedDependency[]>()
  for (const dependency of dependencies) {
    const key = normalizePackageName(managerId, dependency.name)
    grouped.set(key, [...(grouped.get(key) || []), dependency])
  }
  return grouped
}

function selectLocked(requestedVersion: string | undefined, candidates: LockedDependency[]): LockedDependency | undefined {
  if (candidates.length < 2) return candidates[0]
  const exactVersion = requestedVersion?.trim().match(/^(?:===|==|=)?\s*([0-9][A-Za-z0-9.+_-]*)$/)?.[1]
  if (exactVersion) {
    const exact = candidates.find((candidate) => candidate.version === exactVersion)
    if (exact) return exact
  }
  return candidates.find((candidate) => candidate.direct) || candidates[0]
}

function mergeDirectDependency(
  dependency: ManagerDependency,
  locked: LockedDependency | undefined
): ManagerDependency {
  const requestedVersion = dependency.requestedVersion || dependency.version
  const resolvedVersion = locked?.version || dependency.resolvedVersion
  return {
    ...dependency,
    version: resolvedVersion || requestedVersion,
    requestedVersion,
    resolvedVersion,
    source: dependency.source || locked?.source,
    integrity: dependency.integrity || locked?.integrity,
    direct: true,
    metadata: {
      ...(dependency.metadata || {}),
      ...(locked?.metadata || {}),
      ...(locked ? { lockFile: locked.file } : {})
    }
  }
}

function lockedManagerDependency(
  managerId: DependencyManagerId,
  dependency: LockedDependency
): ManagerDependency {
  return {
    managerId,
    name: dependency.name,
    version: dependency.version,
    requestedVersion: dependency.requestedVersion,
    resolvedVersion: dependency.version,
    type: dependency.type || (dependency.direct ? 'direct-lock' : 'transitive-lock'),
    scope: dependency.scope || (dependency.direct ? 'runtime' : 'transitive'),
    source: dependency.source,
    file: dependency.file,
    direct: dependency.direct === true,
    integrity: dependency.integrity,
    metadata: dependency.metadata
  }
}

function uniqueDependencies(dependencies: ManagerDependency[]): ManagerDependency[] {
  const seen = new Set<string>()
  return dependencies.filter((dependency) => {
    const key = [
      dependency.name,
      dependency.version || '',
      dependency.type,
      dependency.file,
      dependency.direct ? 'direct' : 'transitive'
    ].join('\u0000')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
