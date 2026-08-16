import { getManagerDefinition, type DependencyManagerId } from '../../../../shared/managerRegistry'
import { ExtendedManagerService } from '../../../services/extendedManager'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import { searchCondaRegistry } from '../../search/condaRegistry'
import { searchPypiRegistry } from '../../search/pypiRegistry'
import { analyzePythonManagerHealth } from './pythonHealth'
import { readPythonManagerInventory } from './pythonInventory'
import { PYTHON_WORKSPACE_MANAGER_IDS } from './pythonTypes'

const PYTHON_OPERATIONS = [
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

export function createPythonManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  return PYTHON_WORKSPACE_MANAGER_IDS.map((managerId) => {
    const definition = requiredDefinition(managerId)
    return new ProfiledManagerAdapter(definition, service, {
      status: 'preview',
      capabilities: {
        operations: [...PYTHON_OPERATIONS],
        search: true,
        health: true,
        nativeDryRun: managerId === 'poetry' || managerId === 'pipenv' || managerId === 'conda'
      },
      inventory: readPythonManagerInventory,
      search: managerId === 'conda' ? searchCondaRegistry : searchPypiRegistry,
      health: analyzePythonManagerHealth
    })
  })
}

function requiredDefinition(managerId: DependencyManagerId) {
  const definition = getManagerDefinition(managerId)
  if (!definition) throw new Error(`Missing manager definition: ${managerId}`)
  return definition
}
