import { join } from 'path'
import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import {
  type AiMutationPlan,
  type AiOperationTemplate,
  A2A_LOCK_FILE,
  A2A_MANIFEST_FILE,
  createMutationAiPlan,
  createReadOnlyAiPlan,
  writeFileAtomically
} from './aiTypes'
import { readDeclaredManifest, writeDeclaredManifest } from './aiManifest'
import { buildA2aLockContent, readA2aRecordsForLock } from './a2aInventory'

const MANIFEST_SECTION = 'agents'

const READ_ONLY_OPERATIONS: Record<string, string[]> = {
  sync: ['sync'],
  list: ['list'],
  tree: ['tree'],
  audit: ['audit']
}

export function createA2aOperationTemplate(request: ManagerOperationRequest): AiOperationTemplate {
  if (request.operation === 'lock') return createMutationAiPlan('a2a', ['lock'])

  const readOnly = READ_ONLY_OPERATIONS[request.operation]
  if (readOnly) return createReadOnlyAiPlan('a2a', readOnly)

  const endpoint = request.packageName?.trim()
  if (request.operation === 'install') {
    if (!endpoint) {
      return createMutationAiPlan('a2a', ['add'], ['An agent endpoint URL or name is required to declare an A2A dependency.'])
    }
    return createMutationAiPlan('a2a', ['add', endpoint])
  }
  if (request.operation === 'remove') {
    const requirements = endpoint ? [] : ['The agent name is required to remove a declared A2A dependency.']
    return createMutationAiPlan('a2a', ['remove', endpoint || ''], requirements)
  }

  return {
    ...createReadOnlyAiPlan('a2a', ['list']),
    requirements: [`a2a does not support ${request.operation} on this workspace.`]
  }
}

export async function planA2aLock(cwd: string): Promise<AiMutationPlan> {
  const records = await readA2aRecordsForLock(cwd)
  const content = buildA2aLockContent(records)
  return {
    files: [A2A_LOCK_FILE],
    apply: async () => {
      await writeFileAtomically(join(cwd, A2A_LOCK_FILE), content)
      return `Wrote ${A2A_LOCK_FILE} with ${records.length} A2A endpoint(s).\n`
    }
  }
}

export async function planA2aMutation(cwd: string, request: ManagerOperationRequest): Promise<AiMutationPlan> {
  const endpoint = request.packageName?.trim()
  if (!endpoint) throw new Error('An agent endpoint URL or name is required for this operation.')
  if (request.operation === 'install') return planA2aDeclaration(cwd, endpoint, request.version)
  if (request.operation === 'remove') return planA2aRemoval(cwd, endpoint)
  throw new Error(`a2a does not support ${request.operation} as a manifest mutation.`)
}

async function planA2aDeclaration(cwd: string, input: string, version: string | undefined): Promise<AiMutationPlan> {
  const isUrl = /^https?:\/\//i.test(input)
  const name = isUrl ? agentNameFor(input) : input
  const source = input.trim()
  const manifest = await readDeclaredManifest(cwd, A2A_MANIFEST_FILE, MANIFEST_SECTION)
  const next = [...manifest.entries.filter((entry) => entry.name !== name), { name, source, version, type: 'remote-agent' }]

  return {
    files: [A2A_MANIFEST_FILE],
    apply: async () => {
      await writeDeclaredManifest(cwd, A2A_MANIFEST_FILE, MANIFEST_SECTION, manifest.raw, next)
      return `Declared A2A endpoint "${name}" from ${source} in ${A2A_MANIFEST_FILE}.\n`
    }
  }
}

async function planA2aRemoval(cwd: string, name: string): Promise<AiMutationPlan> {
  const manifest = await readDeclaredManifest(cwd, A2A_MANIFEST_FILE, MANIFEST_SECTION)
  if (!manifest.entries.some((entry) => entry.name === name)) {
    throw new Error(`${A2A_MANIFEST_FILE} does not declare an A2A endpoint named "${name}".`)
  }
  const next = manifest.entries.filter((entry) => entry.name !== name)
  return {
    files: [A2A_MANIFEST_FILE],
    apply: async () => {
      await writeDeclaredManifest(cwd, A2A_MANIFEST_FILE, MANIFEST_SECTION, manifest.raw, next)
      return `Removed A2A declaration "${name}" from ${A2A_MANIFEST_FILE}; local agent cards were left untouched.\n`
    }
  }
}

export function agentNameFor(input: string): string {
  const normalized = input.trim().replace(/\/+$/, '')
  try {
    const url = new URL(normalized)
    const host = url.hostname.replace(/^www\./, '')
    const segments = url.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last && !/^\.well-known$/i.test(last) && !/^agent-card\.json$/i.test(last)) {
      return `${host}-${last.replace(/\.[^.]+$/, '')}`
    }
    return host
  } catch {
    const segments = normalized.replace(/\\/g, '/').split('/').filter(Boolean)
    return (segments[segments.length - 1] || normalized).replace(/\.[^.]+$/, '') || 'agent'
  }
}
