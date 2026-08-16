import type { DependencyManagerId } from '../../../../shared/managerRegistry'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { mergeDirectAndLocked } from '../../inventoryMerge'
import { readPythonLocks } from './pythonLocks'
import { readPythonManifests } from './pythonManifests'
import { assertPythonWorkspaceManager } from './pythonTypes'

export async function readPythonManagerInventory(
  cwd: string,
  managerId: DependencyManagerId
): Promise<ManagerDependency[]> {
  assertPythonWorkspaceManager(managerId)
  const [direct, locked] = await Promise.all([
    readPythonManifests(cwd, managerId),
    readPythonLocks(cwd, managerId)
  ])
  return mergeDirectAndLocked(managerId, direct, locked)
}
