import {
  getManagerDefinition,
  type DependencyManagerId
} from '../../../../shared/managerRegistry'
import { ExtendedManagerService } from '../../../services/extendedManager'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import { searchNpmRegistry } from '../../search/npmRegistry'
import { analyzeNodeManagerHealth } from './nodeHealth'
import { readNodeManagerInventory } from './nodeInventory'

export const NODE_WORKSPACE_MANAGER_IDS = ['pnpm', 'yarn', 'bun'] as const

export function createNodeManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  return NODE_WORKSPACE_MANAGER_IDS.map((managerId) => {
    const definition = requiredDefinition(managerId)
    return new ProfiledManagerAdapter(definition, service, {
      status: 'preview',
      capabilities: {
        operations: ['sync', 'install', 'remove', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'],
        search: true,
        health: true,
        nativeDryRun: managerId === 'pnpm'
      },
      inventory: readNodeManagerInventory,
      search: searchNpmRegistry,
      health: analyzeNodeManagerHealth
    })
  })
}

function requiredDefinition(managerId: DependencyManagerId) {
  const definition = getManagerDefinition(managerId)
  if (!definition) throw new Error(`Missing manager definition: ${managerId}`)
  return definition
}
