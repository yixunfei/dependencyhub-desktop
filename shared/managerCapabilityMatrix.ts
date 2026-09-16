import type {
  DependencyManagerDefinition,
  DependencyManagerId,
  ManagerCapability,
  ManagerImplementationStatus
} from './managerRegistryTypes'
import type { ManagerCapabilityProfile } from './managerWorkspace'

/**
 * Which declared capabilities the adapter contract can actually prove. A capability
 * outside this map (publish, scripts, tasks, toolchain, ...) is owned by the
 * manager's dedicated page rather than by the adapter, so it is carried over
 * unchanged instead of being reported as a mismatch.
 */
const ADAPTER_CAPABILITY_PROOFS: Partial<Record<ManagerCapability, (profile: ManagerCapabilityProfile) => boolean>> = {
  search: (profile) => profile.search,
  health: (profile) => profile.health,
  audit: (profile) => profile.operations.includes('audit'),
  install: (profile) => profile.operations.includes('install'),
  uninstall: (profile) => profile.operations.includes('remove'),
  update: (profile) => profile.operations.includes('update'),
  'batch-update': (profile) => profile.operations.includes('update'),
  'version-switch': (profile) => profile.operations.includes('update'),
  lockfile: (profile) => profile.operations.includes('lock'),
  'dependency-tree': (profile) => profile.operations.includes('tree')
}

const OPERATION_CAPABILITY_SOURCES: Array<{ operation: string; capability: ManagerCapability }> = [
  { operation: 'audit', capability: 'audit' },
  { operation: 'install', capability: 'install' },
  { operation: 'remove', capability: 'uninstall' },
  { operation: 'update', capability: 'update' },
  { operation: 'lock', capability: 'lockfile' },
  { operation: 'tree', capability: 'dependency-tree' }
]

export interface ManagerAdapterFacts {
  managerId: DependencyManagerId
  status: ManagerImplementationStatus
  capabilities: ManagerCapabilityProfile
}

export interface ManagerCapabilityMatrixRow {
  managerId: DependencyManagerId
  declaredStatus: ManagerImplementationStatus
  adapterStatus?: ManagerImplementationStatus
  /** Capabilities the registry declares for the manager, implemented or not. */
  target: ManagerCapability[]
  /** Capabilities a registered adapter can actually prove. */
  implemented: ManagerCapability[]
  adapterRegistered: boolean
  issues: string[]
}

export interface ManagerCapabilityMatrixInput {
  definitions: readonly DependencyManagerDefinition[]
  adapters: readonly ManagerAdapterFacts[]
}

/**
 * Builds the single capability matrix every surface reads: the registry owns the
 * declared (target) capabilities, the adapter registry owns the delivered facts,
 * and any divergence is reported here instead of being re-derived per page.
 */
export function buildManagerCapabilityMatrix(input: ManagerCapabilityMatrixInput): ManagerCapabilityMatrixRow[] {
  const adapters = new Map(input.adapters.map((adapter) => [adapter.managerId, adapter]))
  return input.definitions.map((definition) => {
    const adapter = adapters.get(definition.id)
    const target = [...definition.capabilities]
    if (!adapter) {
      return {
        managerId: definition.id,
        declaredStatus: definition.status,
        target,
        implemented: definition.status === 'planned' ? [] : target.filter((capability) => !ADAPTER_CAPABILITY_PROOFS[capability]),
        adapterRegistered: false,
        issues: definition.status === 'planned' && definition.implemented ? ['manager is marked planned but reported as implemented'] : []
      }
    }

    const issues: string[] = []
    if (adapter.status !== definition.status) {
      issues.push(`status ${definition.status} is declared but the adapter reports ${adapter.status}`)
    }

    const implemented: ManagerCapability[] = []
    for (const capability of target) {
      const proof = ADAPTER_CAPABILITY_PROOFS[capability]
      if (!proof) {
        implemented.push(capability)
        continue
      }
      if (proof(adapter.capabilities)) {
        implemented.push(capability)
      } else {
        issues.push(`capability ${capability} is declared but the adapter does not deliver it`)
      }
    }

    // Reverse direction: an adapter that delivers something the registry never
    // declared means the capability facts drifted apart.
    for (const { operation, capability } of OPERATION_CAPABILITY_SOURCES) {
      if (target.includes(capability)) continue
      if (!adapter.capabilities.operations.includes(operation as never)) continue
      issues.push(`adapter delivers ${operation} but the registry does not declare ${capability}`)
    }
    if (adapter.capabilities.search && !target.includes('search')) {
      issues.push('adapter delivers search but the registry does not declare it')
    }
    if (adapter.capabilities.health && !target.includes('health')) {
      issues.push('adapter delivers health but the registry does not declare it')
    }

    return {
      managerId: definition.id,
      declaredStatus: definition.status,
      adapterStatus: adapter.status,
      target,
      implemented,
      adapterRegistered: true,
      issues
    }
  })
}

export function matrixRowFor(
  rows: readonly ManagerCapabilityMatrixRow[],
  managerId: DependencyManagerId
): ManagerCapabilityMatrixRow | undefined {
  return rows.find((row) => row.managerId === managerId)
}

export function matrixIssueCount(rows: readonly ManagerCapabilityMatrixRow[]): number {
  return rows.reduce((total, row) => total + row.issues.length, 0)
}
