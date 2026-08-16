import type { DependencyManagerId } from '../../shared/managerRegistry'

const PYTHON_MANAGERS = new Set<DependencyManagerId>(['uv', 'poetry', 'pipenv'])

export function normalizePackageName(managerId: DependencyManagerId, name: string): string {
  const normalized = name.trim().toLowerCase()
  if (PYTHON_MANAGERS.has(managerId)) return normalized.replace(/[-_.]+/g, '-')
  return normalized
}

export function uniqueStrings(values: Iterable<string | undefined>): string[] {
  return [...new Set([...values].map((item) => item?.trim()).filter((item): item is string => Boolean(item)))]
}
