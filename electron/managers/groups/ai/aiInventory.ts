import type { DependencyManagerId } from '../../../../shared/managerRegistry'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { readMcpInventory } from './mcpInventory'
import { readSkillsInventory } from './skillsInventory'
import { readAgentsInventory } from './agentsInventory'
import { readA2aInventory } from './a2aInventory'

/**
 * Resolves AI dependency inventory from a manager id alone, for consumers that
 * predate the AI manager group (the SBOM builder, governance reports, and the
 * extended manager service). Returns undefined for non-AI managers so callers
 * can fall back to their own handling.
 */
export async function readAiManagerInventory(
  cwd: string,
  managerId: DependencyManagerId
): Promise<ManagerDependency[] | undefined> {
  if (managerId === 'mcp') return await readMcpInventory(cwd)
  if (managerId === 'skills') return await readSkillsInventory(cwd)
  if (managerId === 'ai-agents') return await readAgentsInventory(cwd)
  if (managerId === 'a2a') return await readA2aInventory(cwd)
  return undefined
}
