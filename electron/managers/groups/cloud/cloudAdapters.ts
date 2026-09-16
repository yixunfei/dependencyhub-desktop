import { getManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import { ExtendedManagerService } from '../../../services/extendedManager'
import { readCloudManagerInventory } from './cloudInventory'
import { analyzeCloudManagerHealth } from './cloudHealth'
import { readDeclarativeCloudInventory, analyzeDeclarativeCloudHealth, createDeclarativeCloudOperationTemplate, type DeclarativeCloudManagerId } from './declarativeAdapters'
import { CLOUD_WORKSPACE_MANAGER_IDS, type CloudWorkspaceManagerId } from './cloudTypes'

const DECLARATIVE_IDS = ['kustomize', 'skaffold', 'argocd', 'flux'] as const
const CLOUD_OPERATIONS = ['sync', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'] as const

export function createCloudManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  const helm = createHelmAdapter(service)
  const declarative = DECLARATIVE_IDS.map((managerId) => {
    const definition = getManagerDefinition(managerId); if (!definition) throw new Error(`Missing manager definition: ${managerId}`)
    return new ProfiledManagerAdapter(definition, service, { status: 'preview', capabilities: { operations: [...CLOUD_OPERATIONS], search: false, health: true, nativeDryRun: false }, inventory: (cwd) => readDeclarativeCloudInventory(cwd, managerId), health: analyzeDeclarativeCloudHealth, operationPlanner: (cwd, request) => createDeclarativeCloudOperationTemplate(cwd, managerId, request) })
  })
  return [helm, ...declarative]
}

function createHelmAdapter(service: ExtendedManagerService): ManagerAdapter {
  const managerId = 'helm' as const
  const definition = getManagerDefinition(managerId); if (!definition) throw new Error(`Missing manager definition: ${managerId}`)
  return new ProfiledManagerAdapter(definition, service, { status: 'preview', capabilities: { operations: [...CLOUD_OPERATIONS], search: false, health: true, nativeDryRun: false }, inventory: readCloudManagerInventory, health: analyzeCloudManagerHealth })
}

export function isCloudWorkspaceManager(value: string): value is CloudWorkspaceManagerId {
  return CLOUD_WORKSPACE_MANAGER_IDS.includes(value as CloudWorkspaceManagerId)
}
