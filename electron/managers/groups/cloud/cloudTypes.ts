import type { DependencyManagerId } from '../../../../shared/managerRegistry'

export const CLOUD_WORKSPACE_MANAGER_IDS = ['helm'] as const
export type CloudWorkspaceManagerId = typeof CLOUD_WORKSPACE_MANAGER_IDS[number]

export function assertCloudWorkspaceManager(managerId: DependencyManagerId): asserts managerId is CloudWorkspaceManagerId {
  if (!CLOUD_WORKSPACE_MANAGER_IDS.includes(managerId as CloudWorkspaceManagerId)) {
    throw new Error(`Cloud adapter does not support ${managerId}`)
  }
}

export interface HelmDependencyRecord {
  name: string
  version?: string
  repository?: string
  condition?: string
  alias?: string
  file: string
  direct: boolean
  resolvedVersion?: string
  digest?: string
  generated?: string
}
