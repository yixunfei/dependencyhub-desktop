import { getManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import { ExtendedManagerService } from '../../../services/extendedManager'
import { readInfraInventory, type InfraManagerId } from './infraInventory'
import { analyzeInfraHealth } from './infraHealth'
import { createInfraOperationTemplate } from './infraOperations'
import { readAnsibleInventory } from './ansibleInventory'
import { analyzeAnsibleHealth } from './ansibleHealth'
import { createAnsibleOperationTemplate } from './ansibleOperations'
export const INFRA_MANAGER_IDS = ['terraform', 'opentofu'] as const
const ANSIBLE_OPERATIONS = ['sync', 'install', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'] as const
export function createInfraManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  const adapters = INFRA_MANAGER_IDS.map((managerId) => {
    const definition = getManagerDefinition(managerId); if (!definition) throw new Error(`Missing manager definition: ${managerId}`)
    return new ProfiledManagerAdapter(definition, service, {
      status: 'preview', capabilities: { operations: ['sync', 'install', 'remove', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'], health: true, search: false, nativeDryRun: false },
      inventory: readInfraInventory, health: analyzeInfraHealth,
      operationPlanner: async (cwd, request) => createInfraOperationTemplate(cwd, managerId as InfraManagerId, request)
    })
  })
  const definition = getManagerDefinition('ansible'); if (!definition) throw new Error('Missing manager definition: ansible')
  adapters.push(new ProfiledManagerAdapter(definition, service, { status: 'preview', capabilities: { operations: [...ANSIBLE_OPERATIONS], health: true, search: false, nativeDryRun: false }, inventory: async (cwd) => readAnsibleInventory(cwd), health: analyzeAnsibleHealth, operationPlanner: async (_cwd, request) => createAnsibleOperationTemplate(request) }))
  return adapters
}
