import { readdir } from 'fs/promises'
import { dirname, join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { asArray, asRecord, asString, readTextIfExists } from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import { readDeclaredEntries, type DeclaredAiEntry } from './aiManifest'
import {
  SKILLS_LOCK_FILE,
  SKILLS_MANIFEST_FILE,
  frontmatterList,
  frontmatterString,
  parseFrontmatter,
  parseJsonWithComments,
  sha256
} from './aiTypes'

export interface SkillRecord {
  name: string
  declaredName?: string
  directory: string
  file: string
  version?: string
  description?: string
  allowedTools: string[]
  license?: string
  agentCreated: boolean
  fileCount: number
  hasScripts: boolean
  hasReferences: boolean
  frontmatterPresent: boolean
  hash: string
  issues: string[]
}

export interface SkillLockEntry {
  name: string
  path: string
  version?: string
  hash: string
  fileCount: number
}

const DESCRIPTION_LIMIT = 1024

/** Scans every SKILL.md in the project, including the vendor skill roots. */
export async function readSkillRecords(cwd: string): Promise<SkillRecord[]> {
  const matches = await findWorkspaceFiles(cwd, (fileName) => /^SKILL\.md$/i.test(fileName), { maxDepth: 6 })
  const records: SkillRecord[] = []
  for (const file of matches) {
    const content = await readTextIfExists(join(cwd, file))
    if (content === undefined) continue
    records.push(await toSkillRecord(cwd, file, content))
  }
  return records.sort((left, right) => left.name.localeCompare(right.name))
}

export async function readSkillDeclarations(cwd: string): Promise<DeclaredAiEntry[]> {
  return await readDeclaredEntries(cwd, SKILLS_MANIFEST_FILE, 'skills')
}

export async function readSkillLock(cwd: string): Promise<SkillLockEntry[]> {
  const text = await readTextIfExists(join(cwd, SKILLS_LOCK_FILE))
  if (text === undefined || !text.trim()) return []
  let root: unknown
  try {
    root = parseJsonWithComments(text)
  } catch {
    return []
  }
  return asArray(asRecord(root)?.skills).flatMap((item) => {
    const record = asRecord(item)
    const name = asString(record?.name)?.trim()
    if (!name) return []
    return [{
      name,
      path: asString(record?.path) || '',
      version: asString(record?.version)?.trim() || undefined,
      hash: asString(record?.hash) || '',
      fileCount: Number(asString(record?.fileCount) || 0)
    }]
  })
}

export async function readSkillsInventory(cwd: string): Promise<ManagerDependency[]> {
  const [records, declarations, locked] = await Promise.all([
    readSkillRecords(cwd),
    readSkillDeclarations(cwd),
    readSkillLock(cwd)
  ])
  const lockByName = new Map(locked.map((entry) => [entry.name, entry]))
  const localNames = new Set(records.map((record) => record.name))

  const local = records.map((record) => {
    const lock = lockByName.get(record.name)
    return {
      managerId: 'skills' as const,
      name: record.name,
      version: record.version,
      requestedVersion: record.version,
      resolvedVersion: lock?.version || record.version,
      type: 'skill',
      source: record.directory,
      file: record.file,
      direct: true,
      status: record.issues.length > 0 ? 'invalid' as const : 'installed' as const,
      integrity: lock?.hash || record.hash,
      metadata: {
        description: record.description || null,
        allowedTools: record.allowedTools.join(','),
        agentCreated: record.agentCreated,
        license: record.license || null,
        fileCount: record.fileCount,
        hasScripts: record.hasScripts,
        hasReferences: record.hasReferences,
        frontmatter: record.frontmatterPresent,
        declared: declarations.some((declaration) => declaration.name === record.name),
        issues: record.issues.join('; ')
      }
    }
  })

  const declaredOnly = declarations
    .filter((declaration) => !localNames.has(declaration.name))
    .map((declaration) => ({
      managerId: 'skills' as const,
      name: declaration.name,
      version: declaration.version,
      requestedVersion: declaration.version,
      type: 'declaration',
      source: declaration.source,
      file: SKILLS_MANIFEST_FILE,
      direct: true,
      status: 'missing' as const,
      metadata: { declared: true }
    }))

  const lockOnly = locked
    .filter((entry) => !localNames.has(entry.name))
    .map((entry) => ({
      managerId: 'skills' as const,
      name: entry.name,
      version: entry.version,
      type: 'lock-entry',
      source: entry.path,
      file: SKILLS_LOCK_FILE,
      direct: false,
      status: 'extraneous' as const,
      integrity: entry.hash,
      metadata: { fileCount: entry.fileCount }
    }))

  return [...local, ...declaredOnly, ...lockOnly]
}

function skillLockEntry(record: SkillRecord): SkillLockEntry {
  return {
    name: record.name,
    path: record.file,
    version: record.version,
    hash: record.hash,
    fileCount: record.fileCount
  }
}

export function buildSkillsLockContent(records: readonly SkillRecord[], generatedAt = new Date().toISOString()): string {
  return `${JSON.stringify({
    version: 1,
    generatedAt,
    manager: 'skills',
    skills: records.map((record) => {
      const entry = skillLockEntry(record)
      return {
        name: entry.name,
        path: entry.path,
        version: entry.version ?? null,
        hash: entry.hash,
        fileCount: entry.fileCount
      }
    })
  }, null, 2)}\n`
}

export function skillDescriptionLimit(): number {
  return DESCRIPTION_LIMIT
}

async function toSkillRecord(cwd: string, file: string, content: string): Promise<SkillRecord> {
  const frontmatter = parseFrontmatter(content)
  const directory = dirname(file).replace(/\\/g, '/')
  const directoryName = directory === '.' ? '' : directory.split('/').filter(Boolean).pop() || ''
  const declaredName = frontmatterString(frontmatter.data, 'name')
  const name = declaredName || directoryName || 'unnamed-skill'
  const description = frontmatterString(frontmatter.data, 'description')
  const allowedTools = frontmatterList(frontmatter.data, 'allowed-tools', 'allowed_tools', 'allowedTools')
  const version = frontmatterString(frontmatter.data, 'version')
  const license = frontmatterString(frontmatter.data, 'license')
  const agentCreated = frontmatter.data.agent_created === true || frontmatter.data.agentCreated === true
  const inventory = await readSkillDirectory(cwd, directory)

  const issues: string[] = []
  if (!frontmatter.present) issues.push('missing frontmatter')
  if (!declaredName) issues.push('missing frontmatter name')

  return {
    name,
    declaredName,
    directory: directory || '.',
    file,
    version,
    description,
    allowedTools,
    license,
    agentCreated,
    fileCount: inventory.fileCount,
    hasScripts: inventory.hasScripts,
    hasReferences: inventory.hasReferences,
    frontmatterPresent: frontmatter.present,
    hash: sha256(content),
    issues
  }
}

async function readSkillDirectory(cwd: string, directory: string): Promise<{ fileCount: number; hasScripts: boolean; hasReferences: boolean }> {
  const root = directory ? join(cwd, ...directory.split('/')) : cwd
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const directories = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name.toLowerCase()))
  return {
    fileCount: entries.filter((entry) => entry.isFile()).length,
    hasScripts: directories.has('scripts'),
    hasReferences: directories.has('references') || directories.has('reference')
  }
}
