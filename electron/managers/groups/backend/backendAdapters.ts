import { getManagerDefinition, type DependencyManagerId } from '../../../../shared/managerRegistry'
import { ExtendedManagerService } from '../../../services/extendedManager'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import { searchNugetRegistry } from '../../search/nugetRegistry'
import { searchPackagistRegistry } from '../../search/packagistRegistry'
import { searchRubyGemsRegistry } from '../../search/rubyGemsRegistry'
import { analyzeBackendManagerHealth } from './backendHealth'
import { readBackendManagerInventory } from './backendInventory'
import { BACKEND_WORKSPACE_MANAGER_IDS, type BackendWorkspaceManagerId } from './backendTypes'

const BACKEND_OPERATIONS = [
  'sync',
  'install',
  'remove',
  'update',
  'outdated',
  'audit',
  'tree',
  'list',
  'lock'
] as const

const SEARCH_PROVIDERS = {
  nuget: searchNugetRegistry,
  composer: searchPackagistRegistry,
  bundler: searchRubyGemsRegistry
} satisfies Record<BackendWorkspaceManagerId, typeof searchNugetRegistry>

export function createBackendManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  return BACKEND_WORKSPACE_MANAGER_IDS.map((managerId) => {
    const definition = requiredDefinition(managerId)
    return new ProfiledManagerAdapter(definition, service, {
      status: 'preview',
      capabilities: {
        operations: [...BACKEND_OPERATIONS],
        search: true,
        health: true,
        nativeDryRun: managerId === 'composer'
      },
      inventory: readBackendManagerInventory,
      search: SEARCH_PROVIDERS[managerId],
      health: analyzeBackendManagerHealth
    })
  })
}

function requiredDefinition(managerId: DependencyManagerId) {
  const definition = getManagerDefinition(managerId)
  if (!definition) throw new Error(`Missing manager definition: ${managerId}`)
  return definition
}
