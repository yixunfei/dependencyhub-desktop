import { getManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import { ExtendedManagerService } from '../../../services/extendedManager'
import { readHelmfileInventory } from './helmfileInventory'
import { analyzeHelmfileHealth } from './helmfileHealth'
import { createHelmfileOperationTemplate } from './helmfileOperations'
export const HELMFILE_MANAGER_IDS = ['helmfile'] as const
export function createHelmfileManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  return HELMFILE_MANAGER_IDS.map((managerId) => {
    const definition = getManagerDefinition(managerId); if (!definition) throw new Error(`Missing manager definition: ${managerId}`)
    return new ProfiledManagerAdapter(definition, service, { status: 'preview', capabilities: { operations: ['sync', 'install', 'remove', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'], search: false, health: true, nativeDryRun: false }, inventory: readHelmfileInventory, health: analyzeHelmfileHealth, operationPlanner: async (cwd, request) => createHelmfileOperationTemplate(cwd, request) })
  })
}
