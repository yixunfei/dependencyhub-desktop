import type { DependencyManagerId } from '../../../../shared/managerRegistry'

export const BACKEND_WORKSPACE_MANAGER_IDS = ['nuget', 'composer', 'bundler'] as const
export type BackendWorkspaceManagerId = typeof BACKEND_WORKSPACE_MANAGER_IDS[number]

export function isBackendWorkspaceManager(value: string): value is BackendWorkspaceManagerId {
  return BACKEND_WORKSPACE_MANAGER_IDS.includes(value as BackendWorkspaceManagerId)
}

export function assertBackendWorkspaceManager(
  managerId: DependencyManagerId
): asserts managerId is BackendWorkspaceManagerId {
  if (!isBackendWorkspaceManager(managerId)) {
    throw new Error(`Backend inventory does not support ${managerId}`)
  }
}
