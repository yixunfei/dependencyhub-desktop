import { createHash } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { writeFileAtomic } from '../../../services/atomicWrite'
import type { ManagerBackup } from '../../../../shared/managerWorkspace'
import { asRecord, asString, parseYamlDocument, readTextIfExists } from '../../structuredData'

/** The three AI dependency surfaces DependencyHub manages as first-class ecosystems. */
export type AiManagerId = 'mcp' | 'skills' | 'ai-agents'

/** Reuses the extended-manager backup layout so restoreBackup keeps working unchanged. */
const AI_BACKUP_DIR = '.npmDesktopManager/backups/extended'

/** Every MCP configuration file DependencyHub reads, most specific first. */
export const MCP_CONFIG_FILES = [
  '.mcp.json',
  'mcp.json',
  '.cursor/mcp.json',
  '.vscode/mcp.json',
  '.workbuddy-ai/mcp.json',
  '.claude/mcp.json',
  'claude_desktop_config.json'
] as const

export const MCP_LOCK_FILE = 'mcp-lock.json'
export const SKILLS_MANIFEST_FILE = 'skills.json'
export const SKILLS_LOCK_FILE = 'skills.lock.json'
export const AGENTS_MANIFEST_FILE = 'agents.json'
export const AGENTS_LOCK_FILE = 'agents.lock.json'

/** Root directories scanned for SKILL.md packages. */
export const SKILL_ROOTS = ['.', 'skills', '.workbuddy-ai/skills', '.claude/skills', '.codebuddy/skills', '.agents/skills', '.cursor/skills'] as const

/** Instruction / rule / subagent files that act as AI context dependencies. */
export const AGENT_FILE_PATTERNS: ReadonlyArray<{ pattern: RegExp; type: string }> = [
  { pattern: /^AGENTS\.md$/i, type: 'instructions' },
  { pattern: /^CLAUDE\.md$/i, type: 'instructions' },
  { pattern: /^GEMINI\.md$/i, type: 'instructions' },
  { pattern: /^\.github\/copilot-instructions\.md$/i, type: 'instructions' },
  { pattern: /^\.github\/instructions\/.+\.md$/i, type: 'instructions' },
  { pattern: /^\.cursor\/rules\/.+\.mdc$/i, type: 'rule' },
  { pattern: /^\.(workbuddy-ai|claude|codebuddy|cursor)\/agents\/.+\.md$/i, type: 'agent' }
]

export interface AiBackupFileEntry {
  file: string
  hash: string
  size: number
  exists: boolean
  content: string
}

/** Same on-disk shape the extended manager writes, so restore stays a single code path. */
export interface AiBackupPayload {
  id: string
  managerId: AiManagerId
  projectPath: string
  createdAt: string
  mutating: boolean
  path: string
  commandLine: string
  files: AiBackupFileEntry[]
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function timestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export async function readJsonIfExists(path: string): Promise<unknown> {
  const text = await readTextIfExists(path)
  if (text === undefined) return undefined
  try {
    return JSON.parse(stripJsonComments(text)) as unknown
  } catch {
    return undefined
  }
}

/**
 * JSON with comments is the documented format for MCP configuration files, so a
 * broken document must never be silently treated as an empty configuration.
 */
export function parseJsonWithComments(content: string): unknown {
  return JSON.parse(stripJsonComments(content))
}

export function stripJsonComments(value: string): string {
  let result = ''
  let inString = false
  let quote = ''
  let inLine = false
  let inBlock = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const next = value[index + 1]
    if (inLine) { if (char === '\n') { inLine = false; result += char } continue }
    if (inBlock) { if (char === '*' && next === '/') { inBlock = false; index += 1 } continue }
    if (inString) {
      result += char
      if (char === '\\') { result += next || ''; index += 1 } else if (char === quote) { inString = false }
      continue
    }
    if (char === '"' || char === "'") { inString = true; quote = char; result += char; continue }
    if (char === '/' && next === '/') { inLine = true; index += 1; continue }
    if (char === '/' && next === '*') { inBlock = true; index += 1; continue }
    result += char
  }
  return result
}

/** A concrete local mutation the AI executor performs instead of shelling out to a CLI. */
export interface AiMutationPlan {
  /** Files the mutation may change; used for backup and rollback. */
  files: string[]
  /** Applies the mutation and returns the human-readable result summary. */
  apply: () => Promise<string>
}

/** Plan shape shared by the three AI managers, matching ProfiledManagerAdapter's planner contract. */
export interface AiOperationTemplate {
  tool: string
  args: string[]
  requirements: string[]
  warnings: string[]
  mutating: boolean
  dryRunSupported: boolean
}

export const AI_LOCAL_EXECUTION_WARNING = 'Executed locally by the DependencyHub AI dependency engine; no external CLI is invoked.'

export function createReadOnlyAiPlan(managerId: AiManagerId, args: string[]): AiOperationTemplate {
  return { tool: managerId, args, requirements: [], warnings: [AI_LOCAL_EXECUTION_WARNING], mutating: false, dryRunSupported: false }
}

export function createMutationAiPlan(managerId: AiManagerId, args: string[], requirements: string[] = []): AiOperationTemplate {
  return { tool: managerId, args, requirements, warnings: [AI_LOCAL_EXECUTION_WARNING], mutating: true, dryRunSupported: true }
}

export interface FrontmatterDocument {
  data: Record<string, unknown>
  body: string
  present: boolean
}

/** Parses the `---` YAML frontmatter used by SKILL.md and agent definition files. */
export function parseFrontmatter(content: string): FrontmatterDocument {
  const normalized = content.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: normalized, present: false }
  let data: Record<string, unknown> = {}
  try {
    data = asRecord(parseYamlDocument(match[1], 'frontmatter')) || {}
  } catch {
    data = {}
  }
  return { data, body: match[2] || '', present: true }
}

export function frontmatterString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(data[key])
    if (value?.trim()) return value.trim()
  }
  return undefined
}

export function frontmatterList(data: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = data[key]
    if (Array.isArray(value)) return value.map((item) => asString(item)).filter((item): item is string => Boolean(item?.trim())).map((item) => item.trim())
    const single = asString(value)
    if (single?.trim()) return single.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const FLOATING = new Set(['latest', 'next', 'beta', 'alpha', 'canary', 'nightly', 'head', 'main', 'master', 'stable', 'edge'])

/** True only for an exact, reproducible version or digest pin. */
export function isPinnedVersion(version: string | undefined): boolean {
  if (!version) return false
  const normalized = version.trim()
  if (!normalized) return false
  if (FLOATING.has(normalized.toLowerCase())) return false
  if (/^(sha256:|sha512:)/i.test(normalized)) return true
  if (/^[0-9a-f]{40}$/i.test(normalized)) return true
  return EXACT_VERSION.test(normalized)
}

/**
 * Splits a runnable package specifier into name and pinned version, covering the
 * `npx`/`uvx`/`docker` forms MCP servers actually use.
 */
export function splitPackageSpec(spec: string): { name: string; version?: string } {
  const trimmed = spec.trim()
  if (!trimmed) return { name: '' }
  const at = trimmed.lastIndexOf('@')
  if (at > 0) {
    const name = trimmed.slice(0, at)
    const version = trimmed.slice(at + 1)
    if (version && !version.includes('/')) return { name, version }
  }
  const npmAlias = trimmed.match(/^npm:(.+)$/)
  if (npmAlias) return splitPackageSpec(npmAlias[1])
  return { name: trimmed }
}

export function serverNameFromSpec(spec: string): string {
  const { name } = splitPackageSpec(spec)
  const segments = name.replace(/\\/g, '/').split('/').filter(Boolean)
  let last = segments[segments.length - 1] || name
  const tagIndex = last.indexOf(':')
  if (tagIndex > 0) last = last.slice(0, tagIndex)
  return last.replace(/\.(js|mjs|cjs|py|ts)$/i, '') || 'server'
}

const SECRET_KEY = /(token|secret|password|passwd|api[-_]?key|apikey|credential|auth|pat|bearer)/i
const SECRET_PLACEHOLDER = /^(\$\{.*\}|\$[A-Za-z_][A-Za-z0-9_]*|<.*>|.*\*{3,}.*|)$/

/** Detects a literal secret committed into a configuration file. */
export function looksLikeLiteralSecret(key: string, value: string): boolean {
  if (!SECRET_KEY.test(key)) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return !SECRET_PLACEHOLDER.test(trimmed)
}

/** Groups declared files by name so duplicate definitions across roots can be reported. */
export function groupFilesByName(items: ReadonlyArray<{ name: string; file: string }>): Map<string, Set<string>> {
  const byName = new Map<string, Set<string>>()
  for (const item of items) {
    const files = byName.get(item.name) || new Set<string>()
    files.add(item.file)
    byName.set(item.name, files)
  }
  return byName
}

export async function writeFileAtomically(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  // Delegate to the shared atomic write: the previous local implementation used
  // a fixed `${path}.dependencyhub-tmp` staging name and never cleaned up on a
  // failed rename, leaving debris that the next write would silently clobber.
  await writeFileAtomic(path, content)
}

/**
 * Writes a backup entry compatible with ExtendedManagerService.restoreBackup so the
 * existing restore UI and path validation apply to AI dependency mutations too.
 */
export async function createAiBackup(
  cwd: string,
  managerId: AiManagerId,
  commandLine: string,
  files: readonly string[]
): Promise<ManagerBackup> {
  const entries: AiBackupFileEntry[] = []
  for (const file of [...new Set(files)]) {
    const content = await readTextIfExists(join(cwd, file))
    entries.push(content === undefined
      ? { file, hash: sha256(''), size: 0, exists: false, content: '' }
      : { file, hash: sha256(content), size: Buffer.byteLength(content, 'utf-8'), exists: true, content })
  }

  const id = `${managerId}-${timestampId()}`
  const path = join(cwd, AI_BACKUP_DIR, `${id}.json`)
  const createdAt = new Date().toISOString()
  const payload: AiBackupPayload = {
    id,
    managerId,
    projectPath: cwd,
    createdAt,
    mutating: true,
    path,
    commandLine,
    files: entries
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf-8')

  return {
    id,
    managerId,
    projectPath: cwd,
    createdAt,
    mutating: true,
    path,
    files: entries.map(({ content: _content, ...rest }) => rest)
  }
}
