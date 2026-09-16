import { readFile } from 'fs/promises'
import { join } from 'path'
import YAML from 'yaml'
import type { DependencyManagerId } from '../../../../shared/managerRegistry'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'

export interface HelmfileRelease { name: string; chart?: string; version?: string; namespace?: string; environment?: string; file: string; repository?: string; direct: true }
export interface HelmfileLockEntry { name: string; chart?: string; version?: string; repository?: string; digest?: string; file: string; direct: false }

export async function readHelmfileInventory(cwd: string, managerId: DependencyManagerId): Promise<ManagerDependency[]> {
  if (managerId !== 'helmfile') throw new Error(`Cloud adapter does not support ${managerId}`)
  const [manifest, lock] = await Promise.all([readHelmfileManifest(cwd), readHelmfileLock(cwd)])
  const lockMap = new Map(lock.map((item) => [lockKey(item.name, item.chart), item]))
  const releases = manifest.map((release) => {
    const locked = lockMap.get(lockKey(release.name, release.chart)) || lockMap.get(lockKey('', release.chart))
    return { managerId, name: release.name, version: release.version, requestedVersion: release.version, resolvedVersion: locked?.version, type: 'release', scope: release.environment || release.namespace, source: release.repository || release.chart, file: release.file, direct: true, integrity: locked?.digest, metadata: { chart: release.chart || null, repository: release.repository || null, lockFile: locked?.file || null } } satisfies ManagerDependency
  })
  const transitive = lock.filter((entry) => !manifest.some((release) => lockKey(release.name, release.chart) === lockKey(entry.name, entry.chart))).map((entry) => ({ managerId, name: entry.name || entry.chart || 'unknown', version: entry.version, resolvedVersion: entry.version, type: 'chart-lock', source: entry.chart || entry.repository, file: entry.file, direct: false, integrity: entry.digest, metadata: { repository: entry.repository || null } } satisfies ManagerDependency))
  return [...releases, ...transitive]
}

export async function readHelmfileManifest(cwd: string): Promise<HelmfileRelease[]> {
  const file = await firstExisting(cwd, ['helmfile.yaml', 'helmfile.yml']); if (!file) return []
  const root = YAML.parse(await readFile(join(cwd, file), 'utf-8')) as Record<string, unknown> || {}
  const repositories = Array.isArray(root.repositories) ? root.repositories : []
  const repoMap = new Map(repositories.flatMap((item) => { const record = asRecord(item); const name = asString(record?.name); const url = asString(record?.url); return name && url ? [[name, url] as const] : [] }))
  const releases = Array.isArray(root.releases) ? root.releases : []
  return releases.flatMap((item): HelmfileRelease[] => { const record = asRecord(item); const name = asString(record?.name); const chart = asString(record?.chart); if (!name && !chart) return []; const repository = chart?.includes('/') ? repoMap.get(chart.split('/')[0]) : undefined; return [{ name: name || chart || '', chart, version: asString(record?.version), namespace: asString(record?.namespace), environment: asString(record?.environment), repository, file, direct: true }] })
}

export async function readHelmfileLock(cwd: string): Promise<HelmfileLockEntry[]> {
  const file = 'helmfile.lock'; let content: string
  try { content = await readFile(join(cwd, file), 'utf-8') } catch (error: any) { if (error?.code === 'ENOENT') return []; throw error }
  const root = YAML.parse(content) as Record<string, unknown> || {}
  const entries = (root.releases || root.charts || root.dependencies)
  if (!Array.isArray(entries)) return []
  return entries.flatMap((item): HelmfileLockEntry[] => { const record = asRecord(item); const name = asString(record?.name) || asString(record?.release); const chart = asString(record?.chart); if (!name && !chart) return []; return [{ name: name || '', chart, version: asString(record?.version), repository: asString(record?.repository), digest: asString(record?.digest) || asString(record?.checksum), file, direct: false }] })
}
function lockKey(name?: string, chart?: string): string { return `${name || ''}|${chart || ''}`.toLowerCase() }
function asRecord(value: unknown): Record<string, unknown> | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined }
function asString(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined }
async function firstExisting(cwd: string, names: string[]): Promise<string | undefined> { for (const name of names) { try { await readFile(join(cwd, name)); return name } catch {} } return undefined }
