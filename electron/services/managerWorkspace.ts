import { resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import type {
  ManagerCommandResult,
  ManagerDependency,
  ManagerDescriptor,
  ManagerDetection,
  ManagerExecuteOptions,
  ManagerHealthReport,
  ManagerOperationPlan,
  ManagerOperationRequest,
  ManagerRestoreResult,
  ManagerSearchQuery,
  ManagerSearchResult
} from '../../shared/managerWorkspace'
import { ManagerAdapterRegistry, type ManagerAdapter } from '../managers/adapter'
import { createBackendManagerAdapters } from '../managers/groups/backend/backendAdapters'
import { createCloudManagerAdapters } from '../managers/groups/cloud/cloudAdapters'
import { createHelmfileManagerAdapters } from '../managers/groups/cloud/helmfileAdapters'
import { createPlatformManagerAdapters } from '../managers/groups/platform/platformAdapters'
import { createInfraManagerAdapters } from '../managers/groups/infra/infraAdapters'
import { createNodeManagerAdapters } from '../managers/groups/node/nodeAdapters'
import { createPythonManagerAdapters } from '../managers/groups/python/pythonAdapters'
import { createAiManagerAdapters } from '../managers/groups/ai/aiAdapters'
import { createLegacyManagerAdapters } from '../managers/legacyAdapter'
import { MANAGER_DEFINITIONS } from '../../shared/managerRegistry'
import { ExtendedManagerService } from './extendedManager'

export interface ManagerAdapterDiagnostic {
  managerId: DependencyManagerId
  registered: boolean
  issues: string[]
}
export interface ManagerWorkspaceServiceOptions {
  adapters?: readonly ManagerAdapter[]
  legacyService?: ExtendedManagerService
}

export class ManagerWorkspaceService {
  private readonly legacyService: ExtendedManagerService
  private readonly registry: ManagerAdapterRegistry

  constructor(options: ManagerWorkspaceServiceOptions = {}) {
    this.legacyService = options.legacyService || new ExtendedManagerService()
    this.registry = new ManagerAdapterRegistry(createLegacyManagerAdapters(this.legacyService))
    for (const adapter of createNodeManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of createPythonManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of createBackendManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of createCloudManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of createHelmfileManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of createPlatformManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of createInfraManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of createAiManagerAdapters(this.legacyService)) this.registry.replace(adapter)
    for (const adapter of options.adapters || []) this.registry.replace(adapter)
  }

  descriptors(): ManagerDescriptor[] {
    return this.registry.descriptors()
  }
  diagnostics(): ManagerAdapterDiagnostic[] {
    // Built-in managers are served by their dedicated services rather than the adapter registry,
    // so they are intentionally outside the scope of this adapter contract check.
    return MANAGER_DEFINITIONS.filter((definition) => !definition.builtIn).map((definition) => {
      const adapter = this.registry.list().find((item) => item.descriptor.managerId === definition.id)
      const issues: string[] = []
      if (!adapter) issues.push('adapter is not registered')
      if (adapter && definition.status !== adapter.descriptor.status) {
        issues.push(`status ${definition.status} is declared but the adapter reports ${adapter.descriptor.status}`)
      }
      if (adapter && definition.searchable !== adapter.descriptor.capabilities.search) {
        issues.push('search capability differs between the registry declaration and the adapter')
      }
      if (adapter && definition.healthSupported !== adapter.descriptor.capabilities.health) {
        issues.push('health capability differs between the registry declaration and the adapter')
      }
      return { managerId: definition.id, registered: Boolean(adapter), issues }
    }).filter((item) => item.issues.length > 0)
  }


  async detected(cwd: string): Promise<ManagerDetection[]> {
    const projectPath = normalizeProjectPath(cwd)
    const detections = await this.legacyService.detected(projectPath)
    return detections.map((detection) => {
      const descriptor = this.registry.get(detection.id).descriptor
      return {
        id: detection.id,
        name: detection.name,
        language: detection.language,
        packageManager: detection.packageManager,
        status: descriptor.status,
        detected: detection.detected,
        files: [...detection.files],
        tools: [...detection.tools],
        route: detection.route,
        capabilities: descriptor.capabilities
      }
    })
  }

  async inventory(cwd: string, managerId: DependencyManagerId): Promise<ManagerDependency[]> {
    return await this.registry.get(managerId).inventory(normalizeProjectPath(cwd))
  }

  async plan(
    cwd: string,
    managerId: DependencyManagerId,
    request: ManagerOperationRequest
  ): Promise<ManagerOperationPlan> {
    const adapter = this.registry.get(managerId)
    assertOperationSupported(adapter, request)
    return await adapter.plan(normalizeProjectPath(cwd), request)
  }

  async execute(
    cwd: string,
    managerId: DependencyManagerId,
    request: ManagerOperationRequest,
    options?: ManagerExecuteOptions & { plan?: ManagerOperationPlan }
  ): Promise<ManagerCommandResult> {
    const adapter = this.registry.get(managerId)
    assertOperationSupported(adapter, request)
    if (options?.plan) {
      const plan = options.plan
      if (plan.managerId !== managerId || plan.operation !== request.operation || JSON.stringify(plan.request) !== JSON.stringify(request)) {
        throw new Error('Operation plan is stale or does not match the current request')
      }
    }
    return await adapter.execute(normalizeProjectPath(cwd), request, options)
  }

  async runCustom(
    cwd: string,
    managerId: DependencyManagerId,
    commandLine: string
  ): Promise<ManagerCommandResult> {
    const adapter = this.registry.get(managerId)
    if (!adapter.descriptor.capabilities.customCommands) {
      throw new Error(`${managerId} does not allow custom commands`)
    }
    const command = commandLine.trim()
    if (!command) throw new Error('A command is required')
    return await adapter.runCustom(normalizeProjectPath(cwd), command)
  }

  async search(
    cwd: string | undefined,
    managerId: DependencyManagerId,
    query: ManagerSearchQuery
  ): Promise<ManagerSearchResult[]> {
    const adapter = this.registry.get(managerId)
    if (!adapter.search || !adapter.descriptor.capabilities.search) {
      throw new Error(`${managerId} does not provide package search`)
    }
    const text = query.text.trim()
    if (!text) throw new Error('A search query is required')
    return await adapter.search(cwd ? normalizeProjectPath(cwd) : undefined, {
      ...query,
      text,
      limit: normalizeSearchLimit(query.limit)
    })
  }

  async health(cwd: string, managerId: DependencyManagerId): Promise<ManagerHealthReport> {
    const adapter = this.registry.get(managerId)
    if (!adapter.health || !adapter.descriptor.capabilities.health) {
      throw new Error(`${managerId} does not provide a manager-specific health scan`)
    }
    return await adapter.health(normalizeProjectPath(cwd))
  }

  async restoreBackup(cwd: string, backupPath: string): Promise<ManagerRestoreResult> {
    if (!backupPath?.trim()) throw new Error('A backup path is required')
    return await this.legacyService.restoreBackup(normalizeProjectPath(cwd), backupPath)
  }
}

function assertOperationSupported(adapter: ManagerAdapter, request: ManagerOperationRequest): void {
  if (!request || typeof request !== 'object') throw new Error('An operation request is required')
  if (!adapter.descriptor.capabilities.operations.includes(request.operation)) {
    throw new Error(`${adapter.descriptor.managerId} does not support ${request.operation}`)
  }
}

function normalizeProjectPath(cwd: string): string {
  if (typeof cwd !== 'string' || !cwd.trim()) throw new Error('Project path is required')
  return resolve(cwd.trim())
}

function normalizeSearchLimit(limit: number | undefined): number {
  if (limit === undefined) return 25
  if (!Number.isFinite(limit)) return 25
  return Math.min(100, Math.max(1, Math.trunc(limit)))
}
