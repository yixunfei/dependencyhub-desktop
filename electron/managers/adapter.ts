import type { DependencyManagerId } from '../../shared/managerRegistry'
import type {
  ManagerCommandResult,
  ManagerDependency,
  ManagerDescriptor,
  ManagerExecuteOptions,
  ManagerHealthReport,
  ManagerOperationPlan,
  ManagerOperationRequest,
  ManagerSearchQuery,
  ManagerSearchResult
} from '../../shared/managerWorkspace'

export interface ManagerAdapter {
  readonly descriptor: ManagerDescriptor

  inventory(cwd: string): Promise<ManagerDependency[]>
  plan(cwd: string, request: ManagerOperationRequest): Promise<ManagerOperationPlan>
  execute(
    cwd: string,
    request: ManagerOperationRequest,
    options?: ManagerExecuteOptions
  ): Promise<ManagerCommandResult>
  runCustom(cwd: string, commandLine: string): Promise<ManagerCommandResult>
  search?(cwd: string | undefined, query: ManagerSearchQuery): Promise<ManagerSearchResult[]>
  health?(cwd: string): Promise<ManagerHealthReport>
}

export class ManagerAdapterRegistry {
  private readonly adapters = new Map<DependencyManagerId, ManagerAdapter>()

  constructor(adapters: readonly ManagerAdapter[]) {
    for (const adapter of adapters) this.register(adapter)
  }

  register(adapter: ManagerAdapter): void {
    const managerId = adapter.descriptor.managerId
    if (this.adapters.has(managerId)) {
      throw new Error(`A manager adapter is already registered for ${managerId}`)
    }
    this.adapters.set(managerId, adapter)
  }

  replace(adapter: ManagerAdapter): void {
    this.adapters.set(adapter.descriptor.managerId, adapter)
  }

  get(managerId: DependencyManagerId): ManagerAdapter {
    const adapter = this.adapters.get(managerId)
    if (!adapter) throw new Error(`No manager adapter is registered for ${managerId}`)
    return adapter
  }

  list(): ManagerAdapter[] {
    return [...this.adapters.values()]
  }

  descriptors(): ManagerDescriptor[] {
    return this.list().map((adapter) => adapter.descriptor)
  }
}
