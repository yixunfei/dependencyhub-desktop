import type { DependencyManagerId } from '../../../../shared/managerRegistry'

export const PYTHON_WORKSPACE_MANAGER_IDS = ['uv', 'poetry', 'pipenv', 'conda'] as const
export type PythonWorkspaceManagerId = typeof PYTHON_WORKSPACE_MANAGER_IDS[number]

export function isPythonWorkspaceManager(value: string): value is PythonWorkspaceManagerId {
  return PYTHON_WORKSPACE_MANAGER_IDS.includes(value as PythonWorkspaceManagerId)
}

export function assertPythonWorkspaceManager(
  managerId: DependencyManagerId
): asserts managerId is PythonWorkspaceManagerId {
  if (!isPythonWorkspaceManager(managerId)) {
    throw new Error(`Python inventory does not support ${managerId}`)
  }
}
