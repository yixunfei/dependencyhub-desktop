import { getManagerDefinition } from '../../../../shared/managerRegistry'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthReport, ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import type { ManagerAdapter } from '../../adapter'
import { ProfiledManagerAdapter } from '../../profiledAdapter'
import type { ExtendedManagerService } from '../../../services/extendedManager'
import type { ManagerSearchQuery, ManagerSearchResult } from '../../../../shared/managerWorkspace'
import { type AiManagerId, type AiMutationPlan, type AiOperationTemplate } from './aiTypes'
import { executeAiOperation } from './aiExecutor'
import { readMcpInventory } from './mcpInventory'
import { analyzeMcpHealth } from './mcpHealth'
import { createMcpOperationTemplate, planMcpLock, planMcpMutation } from './mcpOperations'
import { searchMcpServers } from './mcpRegistrySearch'
import { readSkillsInventory } from './skillsInventory'
import { analyzeSkillsHealth } from './skillsHealth'
import { createSkillsOperationTemplate, planSkillsLock, planSkillsMutation } from './skillsOperations'
import { readAgentsInventory } from './agentsInventory'
import { analyzeAgentsHealth } from './agentsHealth'
import { createAgentsOperationTemplate, planAgentsLock, planAgentsMutation } from './agentsOperations'
import { readA2aInventory } from './a2aInventory'
import { analyzeA2aHealth } from './a2aHealth'
import { createA2aOperationTemplate, planA2aLock, planA2aMutation } from './a2aOperations'

/** Operations the AI dependency engine can actually deliver for all three AI managers. */
const AI_OPERATIONS = ['sync', 'install', 'remove', 'audit', 'tree', 'list', 'lock'] as const

interface AiManagerWiring {
  id: AiManagerId
  inventory: (cwd: string) => Promise<ManagerDependency[]>
  health: (cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]) => Promise<ManagerHealthReport>
  plan: (cwd: string, request: ManagerOperationRequest) => Promise<AiOperationTemplate>
  lock: (cwd: string) => Promise<AiMutationPlan>
  mutate: (cwd: string, request: ManagerOperationRequest) => Promise<AiMutationPlan>
  /** Only MCP exposes package search today; other AI ecosystems have no registry. */
  search?: (query: ManagerSearchQuery) => Promise<ManagerSearchResult[]>
}

const AI_MANAGER_WIRINGS: readonly AiManagerWiring[] = [
  {
    id: 'mcp',
    inventory: readMcpInventory,
    health: analyzeMcpHealth,
    plan: async (_cwd, request) => createMcpOperationTemplate(request),
    lock: planMcpLock,
    mutate: planMcpMutation,
    search: searchMcpServers
  },
  {
    id: 'skills',
    inventory: readSkillsInventory,
    health: analyzeSkillsHealth,
    plan: async (_cwd, request) => createSkillsOperationTemplate(request),
    lock: planSkillsLock,
    mutate: planSkillsMutation
  },
  {
    id: 'ai-agents',
    inventory: readAgentsInventory,
    health: analyzeAgentsHealth,
    plan: async (_cwd, request) => createAgentsOperationTemplate(request),
    lock: planAgentsLock,
    mutate: planAgentsMutation
  },
  {
    id: 'a2a',
    inventory: readA2aInventory,
    health: analyzeA2aHealth,
    plan: async (_cwd, request) => createA2aOperationTemplate(request),
    lock: planA2aLock,
    mutate: planA2aMutation
  }
]

export function createAiManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  return AI_MANAGER_WIRINGS.map((wiring) => createAiManagerAdapter(service, wiring))
}

function createAiManagerAdapter(service: ExtendedManagerService, wiring: AiManagerWiring): ManagerAdapter {
  const definition = getManagerDefinition(wiring.id)
  if (!definition) throw new Error(`Missing manager definition: ${wiring.id}`)

  return new ProfiledManagerAdapter(definition, service, {
    status: 'preview',
    capabilities: {
      operations: [...AI_OPERATIONS],
      search: Boolean(wiring.search),
      health: true,
      nativeDryRun: false,
      customCommands: false
    },
    search: wiring.search
      ? async (_cwd, managerId, query) => await wiring.search!(query).then((results) => results.map((result) => ({ ...result, managerId })))
      : undefined,
    inventory: async (cwd) => await wiring.inventory(cwd),
    operationPlanner: async (cwd, request) => {
      const template = await wiring.plan(cwd, request)
      return {
        args: template.args,
        requirements: template.requirements,
        warnings: template.warnings,
        tool: template.tool,
        mutating: template.mutating,
        dryRunSupported: template.dryRunSupported
      }
    },
    health: wiring.health,
    operationExecutor: async (cwd, request, options) => executeAiOperation({
      cwd,
      managerId: wiring.id,
      request,
      dryRun: options?.dryRun === true,
      service,
      inventory: wiring.inventory,
      health: async (target) => await wiring.health(target, definition, await wiring.inventory(target)),
      plan: wiring.plan,
      lock: wiring.lock,
      mutate: wiring.mutate
    })
  })
}
