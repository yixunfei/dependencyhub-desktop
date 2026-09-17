import { join } from 'path'
import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import {
  type AiMutationPlan,
  type AiOperationTemplate,
  AGENTS_LOCK_FILE,
  AGENTS_MANIFEST_FILE,
  createMutationAiPlan,
  createReadOnlyAiPlan,
  writeFileAtomically
} from './aiTypes'
import { readDeclaredManifest, writeDeclaredManifest } from './aiManifest'
import { buildAgentsLockContent, readAgentRecords } from './agentsInventory'

const MANIFEST_SECTION = 'agents'

const READ_ONLY_OPERATIONS: Record<string, string[]> = {
  sync: ['sync'],
  list: ['list'],
  tree: ['tree'],
  audit: ['audit']
}

export function createAgentsOperationTemplate(request: ManagerOperationRequest): AiOperationTemplate {
  if (request.operation === 'lock') return createMutationAiPlan('ai-agents', ['lock'])

  const readOnly = READ_ONLY_OPERATIONS[request.operation]
  if (readOnly) return createReadOnlyAiPlan('ai-agents', readOnly)

  const packageName = request.packageName?.trim()
  if (request.operation === 'install') {
    if (!packageName) {
      return createMutationAiPlan('ai-agents', ['add'], ['An agent name or source path is required to declare an agent dependency.'])
    }
    return createMutationAiPlan('ai-agents', ['add', packageName])
  }
  if (request.operation === 'remove') {
    const requirements = packageName ? [] : ['The agent name is required to remove a declared agent dependency.']
    return createMutationAiPlan('ai-agents', ['remove', packageName || ''], requirements)
  }

  return {
    ...createReadOnlyAiPlan('ai-agents', ['list']),
    requirements: [`ai-agents does not support ${request.operation} on this workspace.`]
  }
}

export async function planAgentsLock(cwd: string): Promise<AiMutationPlan> {
  const records = await readAgentRecords(cwd)
  const content = buildAgentsLockContent(records)
  return {
    files: [AGENTS_LOCK_FILE],
    apply: async () => {
      await writeFileAtomically(join(cwd, AGENTS_LOCK_FILE), content)
      return `Wrote ${AGENTS_LOCK_FILE} with ${records.length} agent dependency file(s).\n`
    }
  }
}

export async function planAgentsMutation(cwd: string, request: ManagerOperationRequest): Promise<AiMutationPlan> {
  const packageName = request.packageName?.trim()
  if (!packageName) throw new Error('An agent name is required for this operation.')
  if (request.operation === 'install') return planAgentDeclaration(cwd, packageName, request.version)
  if (request.operation === 'remove') return planAgentRemoval(cwd, packageName)
  throw new Error(`ai-agents does not support ${request.operation} as a manifest mutation.`)
}

async function planAgentDeclaration(cwd: string, input: string, version: string | undefined): Promise<AiMutationPlan> {
  const name = agentNameFor(input)
  const source = /^https?:\/\//i.test(input) || input.includes('/') ? input.trim() : defaultAgentSource(name)
  const manifest = await readDeclaredManifest(cwd, AGENTS_MANIFEST_FILE, MANIFEST_SECTION)
  const next = [...manifest.entries.filter((entry) => entry.name !== name), { name, source, version }]

  return {
    files: [AGENTS_MANIFEST_FILE],
    apply: async () => {
      await writeDeclaredManifest(cwd, AGENTS_MANIFEST_FILE, MANIFEST_SECTION, manifest.raw, next)
      return `Declared agent dependency "${name}" from ${source} in ${AGENTS_MANIFEST_FILE}.\n`
    }
  }
}

async function planAgentRemoval(cwd: string, name: string): Promise<AiMutationPlan> {
  const manifest = await readDeclaredManifest(cwd, AGENTS_MANIFEST_FILE, MANIFEST_SECTION)
  if (!manifest.entries.some((entry) => entry.name === name)) {
    throw new Error(`${AGENTS_MANIFEST_FILE} does not declare an agent dependency named "${name}".`)
  }
  const next = manifest.entries.filter((entry) => entry.name !== name)
  return {
    files: [AGENTS_MANIFEST_FILE],
    apply: async () => {
      await writeDeclaredManifest(cwd, AGENTS_MANIFEST_FILE, MANIFEST_SECTION, manifest.raw, next)
      return `Removed agent declaration "${name}" from ${AGENTS_MANIFEST_FILE}; local instruction files were left untouched.\n`
    }
  }
}

export function agentNameFor(input: string): string {
  const normalized = input.trim().replace(/\\/g, '/').replace(/\.git$/i, '').replace(/\/+$/, '')
  if (!normalized) return 'agent'
  const segments = normalized.split('/').filter(Boolean)
  return (segments[segments.length - 1] || normalized).replace(/\.[^.]+$/, '')
}

export function defaultAgentSource(name: string): string {
  return `.workbuddy-ai/agents/${name}.md`
}
