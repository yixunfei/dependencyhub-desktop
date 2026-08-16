import type {
  DependencyManagerDefinition,
  DependencyManagerId,
  ManagerImplementationStatus
} from '../../shared/managerRegistry'
import type {
  ManagerCapabilityProfile,
  ManagerCommandResult,
  ManagerDependency,
  ManagerExecuteOptions,
  ManagerHealthReport,
  ManagerOperationPlan,
  ManagerOperationRequest,
  ManagerSearchQuery,
  ManagerSearchResult
} from '../../shared/managerWorkspace'
import {
  ExtendedManagerService,
  type ExtendedManagerOperationRequest
} from '../services/extendedManager'
import type { ManagerAdapter } from './adapter'
import { createManagerDescriptor } from './capabilities'

export type ManagerInventoryReader = (
  cwd: string,
  managerId: DependencyManagerId
) => Promise<ManagerDependency[]>

export type ManagerSearchProvider = (
  cwd: string | undefined,
  managerId: DependencyManagerId,
  query: ManagerSearchQuery
) => Promise<ManagerSearchResult[]>

export type ManagerHealthProvider = (
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
) => Promise<ManagerHealthReport>

export interface ProfiledManagerAdapterOptions {
  status?: ManagerImplementationStatus
  capabilities?: Partial<ManagerCapabilityProfile>
  inventory?: ManagerInventoryReader
  search?: ManagerSearchProvider
  health?: ManagerHealthProvider
}

export class ProfiledManagerAdapter implements ManagerAdapter {
  readonly descriptor

  constructor(
    private readonly definition: DependencyManagerDefinition,
    private readonly service: ExtendedManagerService,
    private readonly options: ProfiledManagerAdapterOptions = {}
  ) {
    const descriptor = createManagerDescriptor(definition)
    this.descriptor = {
      ...descriptor,
      status: options.status || descriptor.status,
      capabilities: {
        ...descriptor.capabilities,
        ...options.capabilities,
        operations: options.capabilities?.operations
          ? [...options.capabilities.operations]
          : descriptor.capabilities.operations
      }
    }
  }

  async inventory(cwd: string): Promise<ManagerDependency[]> {
    if (this.options.inventory) return await this.options.inventory(cwd, this.definition.id)
    return (await this.service.list(cwd, this.definition.id)).map((dependency) => ({
      ...dependency,
      requestedVersion: dependency.version,
      direct: true
    }))
  }

  async plan(cwd: string, request: ManagerOperationRequest): Promise<ManagerOperationPlan> {
    const plan = await this.service.plan(cwd, this.definition.id, toLegacyRequest(request))
    return {
      ...plan,
      tool: String(plan.tool),
      request: { ...request },
      requiresConfirmation: plan.mutating,
      riskLevel: plan.mutating
        ? (this.descriptor.capabilities.requiresElevation ? 'high' : 'medium')
        : 'low'
    }
  }

  async execute(
    cwd: string,
    request: ManagerOperationRequest,
    options?: ManagerExecuteOptions
  ): Promise<ManagerCommandResult> {
    const dryRun = options?.dryRun === true
    const result = await this.service.execute(
      cwd,
      this.definition.id,
      toLegacyRequest(request),
      dryRun
    )
    return commandResult(this.definition.id, result, dryRun)
  }

  async runCustom(cwd: string, commandLine: string): Promise<ManagerCommandResult> {
    const result = await this.service.run(cwd, this.definition.id, commandLine)
    return commandResult(this.definition.id, result, false)
  }

  async search(cwd: string | undefined, query: ManagerSearchQuery): Promise<ManagerSearchResult[]> {
    if (!this.options.search) throw new Error(`${this.definition.id} does not provide package search`)
    return await this.options.search(cwd, this.definition.id, query)
  }

  async health(cwd: string): Promise<ManagerHealthReport> {
    if (!this.options.health) {
      throw new Error(`${this.definition.id} does not provide a manager-specific health scan`)
    }
    return await this.options.health(cwd, this.definition, await this.inventory(cwd))
  }
}

function commandResult(
  managerId: DependencyManagerId,
  result: Awaited<ReturnType<ExtendedManagerService['run']>>,
  dryRun: boolean
): ManagerCommandResult {
  return {
    managerId,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    dryRun,
    backup: result.backup
  }
}

function toLegacyRequest(request: ManagerOperationRequest): ExtendedManagerOperationRequest {
  if (request.operation === 'validate') {
    throw new Error('This adapter does not provide a validate operation')
  }
  return {
    operation: request.operation,
    packageName: request.packageName,
    version: request.version,
    dev: request.dev,
    options: request.options
  }
}
