import { getManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import { ExtendedManagerService } from '../../../services/extendedManager'
import { readSwiftPackageInventory } from './swiftpmInventory'
import { analyzeSwiftPackageHealth } from './swiftpmHealth'
import { createSwiftPMOperationTemplate } from './swiftpmOperations'
import { planSwiftPMManifestMutation, atomicallyWriteSwiftManifest } from './swiftpmManifestEditor'
import { readDenoInventory } from './denoInventory'
import { analyzeDenoHealth } from './denoHealth'
import { createDenoOperationTemplate } from './denoOperations'
import { readCocoaPodsInventory } from './cocoapodsInventory'
import { analyzeCocoaPodsHealth } from './cocoapodsHealth'
import { createCocoaPodsOperationTemplate } from './cocoapodsOperations'

const SWIFTPM_OPERATIONS = ['sync', 'install', 'remove', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'] as const
const DENO_OPERATIONS = ['sync', 'install', 'remove', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'] as const
const COCOAPODS_OPERATIONS = ['sync', 'install', 'remove', 'update', 'outdated', 'audit', 'tree', 'list', 'lock'] as const

export function createPlatformManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  const swiftpm = createSwiftPMAdapter(service)
  const denoDefinition = getManagerDefinition('deno')
  if (!denoDefinition) throw new Error('Missing manager definition: deno')
  const deno = new ProfiledManagerAdapter(denoDefinition, service, {
    status: 'preview',
    capabilities: { operations: [...DENO_OPERATIONS], search: false, health: true, nativeDryRun: false },
    inventory: async (cwd) => readDenoInventory(cwd),
    operationPlanner: async (_cwd, request) => createDenoOperationTemplate(request),
    health: analyzeDenoHealth
  })
  const cocoapodsDefinition = getManagerDefinition('cocoapods')
  if (!cocoapodsDefinition) throw new Error('Missing manager definition: cocoapods')
  const cocoapods = new ProfiledManagerAdapter(cocoapodsDefinition, service, {
    status: 'preview',
    capabilities: { operations: [...COCOAPODS_OPERATIONS], search: false, health: true, nativeDryRun: false },
    inventory: async (cwd) => readCocoaPodsInventory(cwd),
    operationPlanner: async (_cwd, request) => createCocoaPodsOperationTemplate(request),
    health: analyzeCocoaPodsHealth
  })
  return [swiftpm, deno, cocoapods]
}

function createSwiftPMAdapter(service: ExtendedManagerService): ManagerAdapter {
  const definition = getManagerDefinition('swiftpm')
  if (!definition) throw new Error('Missing manager definition: swiftpm')
  return new ProfiledManagerAdapter(definition, service, {
    status: 'preview',
    capabilities: { operations: [...SWIFTPM_OPERATIONS], search: false, health: true, nativeDryRun: false },
    inventory: async (cwd) => readSwiftPackageInventory(cwd),
    operationPlanner: async (cwd, request) => {
      const template = await createSwiftPMOperationTemplate(cwd, request)
      return { args: template.args, requirements: template.requirements, warnings: template.warnings }
    },
    health: analyzeSwiftPackageHealth,
    operationExecutor: async (cwd, request, options) => {
      if (request.operation !== 'install' && request.operation !== 'remove') {
        const result = await service.execute(cwd, 'swiftpm', request as any, options?.dryRun === true)
        return { managerId: 'swiftpm', ...result, dryRun: options?.dryRun === true }
      }
      const mutation = await planSwiftPMManifestMutation(cwd, request)
      const result = await service.executeWithMutation(cwd, 'swiftpm', ['package', 'resolve'], async () => {
        await atomicallyWriteSwiftManifest(cwd, mutation.after)
      }, options?.dryRun === true)
      return { managerId: 'swiftpm', ...result, dryRun: options?.dryRun === true }
    }
  })
}
