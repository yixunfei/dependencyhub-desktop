import { join } from 'path'
import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import {
  type AiMutationPlan,
  type AiOperationTemplate,
  SKILLS_LOCK_FILE,
  SKILLS_MANIFEST_FILE,
  createMutationAiPlan,
  createReadOnlyAiPlan,
  writeFileAtomically
} from './aiTypes'
import { readDeclaredManifest, writeDeclaredManifest } from './aiManifest'
import { buildSkillsLockContent, readSkillRecords } from './skillsInventory'

const MANIFEST_SECTION = 'skills'

const READ_ONLY_OPERATIONS: Record<string, string[]> = {
  sync: ['sync'],
  list: ['list'],
  tree: ['tree'],
  audit: ['audit']
}

export function createSkillsOperationTemplate(request: ManagerOperationRequest): AiOperationTemplate {
  if (request.operation === 'lock') return createMutationAiPlan('skills', ['lock'])

  const readOnly = READ_ONLY_OPERATIONS[request.operation]
  if (readOnly) return createReadOnlyAiPlan('skills', readOnly)

  const packageName = request.packageName?.trim()
  if (request.operation === 'install') {
    if (!packageName) {
      return createMutationAiPlan('skills', ['add'], ['A skill name or source path is required to declare a skill dependency.'])
    }
    const plan = createMutationAiPlan('skills', ['add', packageName])
    if (!looksLikeSource(packageName)) {
      plan.warnings.push(`Without an explicit source the declaration points at ${defaultSkillSource(skillNameFor(packageName))}.`)
    }
    return plan
  }
  if (request.operation === 'remove') {
    const requirements = packageName ? [] : ['The skill name is required to remove a declared skill dependency.']
    return createMutationAiPlan('skills', ['remove', packageName || ''], requirements)
  }

  return {
    ...createReadOnlyAiPlan('skills', ['list']),
    requirements: [`skills does not support ${request.operation} on this workspace.`]
  }
}

export async function planSkillsLock(cwd: string): Promise<AiMutationPlan> {
  const records = await readSkillRecords(cwd)
  const content = buildSkillsLockContent(records)
  return {
    files: [SKILLS_LOCK_FILE],
    apply: async () => {
      await writeFileAtomically(join(cwd, SKILLS_LOCK_FILE), content)
      return `Wrote ${SKILLS_LOCK_FILE} with ${records.length} skill(s).\n`
    }
  }
}

export async function planSkillsMutation(cwd: string, request: ManagerOperationRequest): Promise<AiMutationPlan> {
  const packageName = request.packageName?.trim()
  if (!packageName) throw new Error('A skill name is required for this operation.')
  if (request.operation === 'install') return planSkillsDeclaration(cwd, packageName, request.version)
  if (request.operation === 'remove') return planSkillsRemoval(cwd, packageName)
  throw new Error(`skills does not support ${request.operation} as a manifest mutation.`)
}

async function planSkillsDeclaration(cwd: string, input: string, version: string | undefined): Promise<AiMutationPlan> {
  const name = skillNameFor(input)
  const source = looksLikeSource(input) ? input.trim() : defaultSkillSource(name)
  const manifest = await readDeclaredManifest(cwd, SKILLS_MANIFEST_FILE, MANIFEST_SECTION)
  const next = [...manifest.entries.filter((entry) => entry.name !== name), { name, source, version }]

  return {
    files: [SKILLS_MANIFEST_FILE],
    apply: async () => {
      await writeDeclaredManifest(cwd, SKILLS_MANIFEST_FILE, MANIFEST_SECTION, manifest.raw, next)
      return `Declared skill "${name}" from ${source} in ${SKILLS_MANIFEST_FILE}.\n`
    }
  }
}

async function planSkillsRemoval(cwd: string, name: string): Promise<AiMutationPlan> {
  const manifest = await readDeclaredManifest(cwd, SKILLS_MANIFEST_FILE, MANIFEST_SECTION)
  if (!manifest.entries.some((entry) => entry.name === name)) {
    throw new Error(`${SKILLS_MANIFEST_FILE} does not declare a skill named "${name}".`)
  }
  const next = manifest.entries.filter((entry) => entry.name !== name)
  return {
    files: [SKILLS_MANIFEST_FILE],
    apply: async () => {
      await writeDeclaredManifest(cwd, SKILLS_MANIFEST_FILE, MANIFEST_SECTION, manifest.raw, next)
      return `Removed skill declaration "${name}" from ${SKILLS_MANIFEST_FILE}; local skill files were left untouched.\n`
    }
  }
}

export function skillNameFor(input: string): string {
  const normalized = input.trim().replace(/\\/g, '/').replace(/\.git$/i, '').replace(/\/+$/, '')
  if (!normalized) return 'skill'
  const segments = normalized.split('/').filter(Boolean)
  return segments[segments.length - 1] || normalized
}

export function defaultSkillSource(name: string): string {
  return `.workbuddy-ai/skills/${name}`
}

export function looksLikeSource(input: string): boolean {
  const trimmed = input.trim()
  return /^https?:\/\//i.test(trimmed) || /^git@/i.test(trimmed) || trimmed.includes('/') || trimmed.startsWith('.')
}
