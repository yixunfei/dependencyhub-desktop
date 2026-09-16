import type { DependencyManagerId } from '../../../../shared/managerRegistry'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { readHelmLock } from './cloudLocks'
import { readHelmManifest } from './cloudManifests'
import { assertCloudWorkspaceManager } from './cloudTypes'

export async function readCloudManagerInventory(cwd: string, managerId: DependencyManagerId): Promise<ManagerDependency[]> {
  assertCloudWorkspaceManager(managerId)
  const [manifest, lock] = await Promise.all([readHelmManifest(cwd), readHelmLock(cwd)])
  const lockByName = new Map(lock.map((item) => [item.name, item]))
  const direct = manifest.map((item) => {
    const resolved = lockByName.get(item.name)
    return {
      managerId,
      name: item.name,
      version: item.version,
      requestedVersion: item.version,
      resolvedVersion: resolved?.version,
      type: 'chart',
      scope: item.condition || item.alias,
      source: item.repository,
      file: item.file,
      direct: true,
      metadata: {
        condition: item.condition || null,
        alias: item.alias || null,
        lockFile: resolved?.file || null,
        lockDigest: resolved?.digest || null
      }
    } satisfies ManagerDependency
  })
  const transitive = lock
    .filter((item) => !manifest.some((directItem) => directItem.name === item.name))
    .map((item) => ({
      managerId,
      name: item.name,
      version: item.version,
      resolvedVersion: item.version,
      type: 'chart',
      source: item.repository,
      file: item.file,
      direct: false,
      integrity: item.digest,
      metadata: { generated: item.generated || null }
    } satisfies ManagerDependency))
  return [...direct, ...transitive]
}
