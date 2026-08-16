import type { DependencyManagerId } from '../../../../shared/managerRegistry'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { mergeDirectAndLocked } from '../../inventoryMerge'
import { readBackendLocks } from './backendLocks'
import { readBackendManifests } from './backendManifests'
import { assertBackendWorkspaceManager } from './backendTypes'

export async function readBackendManagerInventory(
  cwd: string,
  managerId: DependencyManagerId
): Promise<ManagerDependency[]> {
  assertBackendWorkspaceManager(managerId)
  const [direct, locked] = await Promise.all([
    readBackendManifests(cwd, managerId),
    readBackendLocks(cwd, managerId)
  ])
  return mergeDirectAndLocked(managerId, direct, locked)
}
