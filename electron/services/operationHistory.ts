import { appendFile, mkdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  type DependencyManagerId
} from '../../shared/managerRegistry'

const HISTORY_FILE = '.npmDesktopManager/operations/command-history.jsonl'
const REPORT_DIR = '.npmDesktopManager/reports'
const MAX_STORED_TEXT_LENGTH = 4000
const MAX_HISTORY_FILE_BYTES = 2 * 1024 * 1024

export type OperationHistoryStatus = 'success' | 'error'
export type OperationHistoryOperationKind =
  | 'install'
  | 'uninstall'
  | 'update'
  | 'sync'
  | 'audit'
  | 'tree'
  | 'list'
  | 'search'
  | 'outdated'
  | 'publish'
  | 'config'
  | 'cache'
  | 'build'
  | 'test'
  | 'run'
  | 'clean'
  | 'lock'
  | 'login'
  | 'toolchain'
  | 'restore'
  | 'info'
  | 'unknown'

export type OperationHistoryRisk =
  | 'read-only'
  | 'project-change'
  | 'environment-change'
  | 'publish'
  | 'credential'
  | 'build-artifact'
  | 'cache-change'
  | 'unknown'

export type OperationHistoryScope =
  | 'project'
  | 'global'
  | 'environment'
  | 'repository'
  | 'publish'
  | 'cache'
  | 'unknown'

export type OperationHistoryExportFormat = 'json' | 'markdown'

export interface OperationHistoryClassification {
  tool: string
  managerId?: DependencyManagerId
  managerName?: string
  ecosystem?: string
  operation: OperationHistoryOperationKind
  mutating: boolean
  scope: OperationHistoryScope
  risk: OperationHistoryRisk
  summary: string
}

export interface OperationHistoryRecord {
  id: string
  command: string
  cwd: string
  status: OperationHistoryStatus
  startedAt: string
  finishedAt: string
  durationMs: number
  stdout?: string
  stderr?: string
  error?: string
  classification?: OperationHistoryClassification
  summary?: string
}

export interface OperationHistoryListOptions {
  limit?: number
  status?: OperationHistoryStatus
  managerId?: DependencyManagerId | 'unknown'
  mutating?: boolean
  operation?: OperationHistoryOperationKind
}

export interface OperationHistorySummary {
  total: number
  success: number
  error: number
  mutating: number
  readOnly: number
  byManager: Record<string, number>
  byOperation: Record<string, number>
}

export interface OperationHistoryExportResult {
  path: string
  format: OperationHistoryExportFormat
  count: number
  generatedAt: string
  summary: OperationHistorySummary
}

export async function recordOperationHistory(record: OperationHistoryRecord): Promise<void> {
  if (!record.cwd) return

  try {
    const path = historyPath(record.cwd)
    await mkdir(dirname(path), { recursive: true })
    await rotateHistoryFileIfNeeded(path)
    await appendFile(path, `${JSON.stringify(trimRecord(record))}\n`, 'utf-8')
  } catch {
  }
}

// The history is append-only, so without rotation it grows unbounded. Keeping
// a single previous generation is enough to bound growth; listOperationHistory
// reads only the main file, so no reader changes are needed.
async function rotateHistoryFileIfNeeded(path: string): Promise<void> {
  const stats = await stat(path).catch(() => undefined)
  if (!stats || stats.size < MAX_HISTORY_FILE_BYTES) return
  // fs.rename replaces the existing .1 on all platforms; if it fails we keep
  // appending to the main file rather than losing the record.
  await rename(path, `${path}.1`).catch(() => undefined)
}

export async function listOperationHistory(cwd: string, limitOrOptions: number | OperationHistoryListOptions = 100): Promise<OperationHistoryRecord[]> {
  if (!cwd) return []
  const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions

  try {
    const content = await readFile(historyPath(cwd), 'utf-8')
    const records = content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => parseHistoryLine(line))
      .filter((record): record is OperationHistoryRecord => Boolean(record))
      .map((record) => enrichOperationHistoryRecord(record))
      .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
    return applyHistoryFilters(records, options)
  } catch {
    return []
  }
}

export async function exportOperationHistory(
  cwd: string,
  format: OperationHistoryExportFormat = 'markdown',
  options: OperationHistoryListOptions = {}
): Promise<OperationHistoryExportResult> {
  if (!cwd) throw new Error('Project path is required')

  const records = await listOperationHistory(cwd, {
    ...options,
    limit: options.limit ?? 1000
  })
  const generatedAt = new Date().toISOString()
  const summary = summarizeOperationHistory(records)
  const filePath = operationHistoryReportPath(cwd, format)
  await mkdir(dirname(filePath), { recursive: true })

  if (format === 'json') {
    await writeFile(filePath, JSON.stringify({
      generatedAt,
      cwd: resolve(cwd),
      count: records.length,
      summary,
      records
    }, null, 2), 'utf-8')
  } else {
    await writeFile(filePath, renderMarkdownReport(cwd, generatedAt, summary, records), 'utf-8')
  }

  return {
    path: filePath,
    format,
    count: records.length,
    generatedAt,
    summary
  }
}

export function classifyOperationHistoryRecord(record: Pick<OperationHistoryRecord, 'command' | 'status' | 'stdout' | 'stderr' | 'error'>): OperationHistoryClassification {
  const parsed = parseCommand(record.command)
  const classification = classifyCommand(parsed.tool, parsed.args)
  return classification
}

export function summarizeOperationHistory(records: OperationHistoryRecord[]): OperationHistorySummary {
  const summary: OperationHistorySummary = {
    total: records.length,
    success: 0,
    error: 0,
    mutating: 0,
    readOnly: 0,
    byManager: {},
    byOperation: {}
  }

  for (const record of records) {
    if (record.status === 'success') summary.success += 1
    if (record.status === 'error') summary.error += 1

    const classification = record.classification || classifyOperationHistoryRecord(record)
    if (classification.mutating) summary.mutating += 1
    else summary.readOnly += 1

    const managerKey = classification.managerId || classification.tool || 'unknown'
    summary.byManager[managerKey] = (summary.byManager[managerKey] || 0) + 1
    summary.byOperation[classification.operation] = (summary.byOperation[classification.operation] || 0) + 1
  }

  return summary
}

function historyPath(cwd: string): string {
  return join(resolve(cwd), HISTORY_FILE)
}

function operationHistoryReportPath(cwd: string, format: OperationHistoryExportFormat): string {
  return join(resolve(cwd), REPORT_DIR, format === 'json' ? 'operation-history.json' : 'operation-history.md')
}

function trimRecord(record: OperationHistoryRecord): OperationHistoryRecord {
  return {
    id: record.id,
    command: redactSensitiveCommand(record.command),
    cwd: record.cwd,
    status: record.status,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    durationMs: record.durationMs,
    stdout: truncate(redactSensitiveText(record.stdout)),
    stderr: truncate(redactSensitiveText(record.stderr)),
    error: truncate(redactSensitiveText(record.error))
  }
}

function truncate(value?: string): string | undefined {
  if (!value) return undefined
  return value.length > MAX_STORED_TEXT_LENGTH ? value.slice(value.length - MAX_STORED_TEXT_LENGTH) : value
}

const SENSITIVE_NEXT_FLAGS = new Set([
  '--password',
  '--pass',
  '--token',
  '--auth-token',
  '--access-token',
  '--secret',
  '--client-secret',
  '--api-key',
  '--apikey',
  '--key',
  '--pat',
  '--otp',
  '--repository-password',
  '--repository-token'
])

const SENSITIVE_VALUE_PATTERN = /(password|passwd|pwd|token|secret|api[_-]?key|auth[_-]?token|client[_-]?secret|_authtoken)(\s*[:=]\s*)(["']?)([^\s"',;<>]+)/gi
const URL_CREDENTIAL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/gi
const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi
const COMMON_TOKEN_PATTERN = /\b(?:npm_[A-Za-z0-9]{20,}|pypi-[A-Za-z0-9._-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g

function redactSensitiveText(value?: string): string | undefined {
  if (!value) return value
  return value
    .replace(URL_CREDENTIAL_PATTERN, '$1[REDACTED]@')
    .replace(BEARER_PATTERN, '$1 [REDACTED]')
    .replace(COMMON_TOKEN_PATTERN, '[REDACTED]')
    .replace(SENSITIVE_VALUE_PATTERN, '$1$2$3[REDACTED]')
}

function redactSensitiveCommand(command: string): string {
  const patternRedacted = redactSensitiveText(command) || command
  const tokens = tokenize(patternRedacted)
  let changed = patternRedacted !== command

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const normalized = normalizeArg(token)
    const [flagName] = normalized.split('=')
    if (SENSITIVE_NEXT_FLAGS.has(flagName)) {
      if (token.includes('=')) {
        const [flag] = token.split('=', 1)
        tokens[index] = `${flag}=[REDACTED]`
      } else if (tokens[index + 1] && !tokens[index + 1].startsWith('-')) {
        tokens[index + 1] = '[REDACTED]'
      }
      changed = true
      continue
    }

    if (normalized === '-p' && commandLooksLikeCredentialUpload(tokens) && tokens[index + 1] && !tokens[index + 1].startsWith('-')) {
      tokens[index + 1] = '[REDACTED]'
      changed = true
    }
  }

  return changed ? tokens.map(formatRedactedToken).join(' ') : patternRedacted
}

function commandLooksLikeCredentialUpload(tokens: string[]): boolean {
  const normalized = tokens.map(normalizeArg)
  return normalized.includes('twine') || normalized.includes('upload') || normalized.includes('publish')
}

function formatRedactedToken(token: string): string {
  if (!/\s/.test(token)) return token
  return `"${token.replace(/"/g, '\\"')}"`
}

function parseHistoryLine(line: string): OperationHistoryRecord | null {
  try {
    const record = JSON.parse(line) as OperationHistoryRecord
    if (!record.id || !record.command || !record.cwd || !record.startedAt || !record.finishedAt) return null
    if (record.status !== 'success' && record.status !== 'error') return null
    return redactHistoryRecord(record)
  } catch {
    return null
  }
}

function redactHistoryRecord(record: OperationHistoryRecord): OperationHistoryRecord {
  return {
    ...record,
    command: redactSensitiveCommand(record.command),
    stdout: redactSensitiveText(record.stdout),
    stderr: redactSensitiveText(record.stderr),
    error: redactSensitiveText(record.error),
    summary: redactSensitiveText(record.summary)
  }
}

function enrichOperationHistoryRecord(record: OperationHistoryRecord): OperationHistoryRecord {
  const classification = classifyOperationHistoryRecord(record)
  return {
    ...record,
    classification,
    summary: summarizeRecord(record, classification)
  }
}

function applyHistoryFilters(records: OperationHistoryRecord[], options: OperationHistoryListOptions): OperationHistoryRecord[] {
  const filtered = records.filter((record) => {
    const classification = record.classification || classifyOperationHistoryRecord(record)
    if (options.status && record.status !== options.status) return false
    if (options.managerId) {
      const managerId = classification.managerId || 'unknown'
      if (managerId !== options.managerId) return false
    }
    if (typeof options.mutating === 'boolean' && classification.mutating !== options.mutating) return false
    if (options.operation && classification.operation !== options.operation) return false
    return true
  })

  return filtered.slice(0, Math.max(1, options.limit ?? 100))
}

interface ParsedCommand {
  tool: string
  args: string[]
}

interface ClassificationOverride {
  mutating?: boolean
  scope?: OperationHistoryScope
  risk?: OperationHistoryRisk
}

const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))
const TOOL_TO_MANAGER = new Map<string, DependencyManagerId>()

for (const manager of MANAGER_DEFINITIONS) {
  for (const tool of manager.tools) {
    TOOL_TO_MANAGER.set(normalizeToolName(tool), manager.id)
  }
}

const TOOL_ALIASES: Record<string, DependencyManagerId> = {
  npm: 'npm',
  npx: 'npm',
  pnpm: 'pnpm',
  yarn: 'yarn',
  bun: 'bun',
  deno: 'deno',
  pip: 'pip',
  pip3: 'pip',
  twine: 'pip',
  'pip-audit': 'pip',
  pipdeptree: 'pip',
  uv: 'uv',
  poetry: 'poetry',
  pipenv: 'pipenv',
  conda: 'conda',
  mamba: 'conda',
  mvn: 'maven',
  mvnw: 'maven',
  maven: 'maven',
  gradle: 'gradle',
  gradlew: 'gradle',
  cargo: 'cargo',
  go: 'go',
  flutter: 'flutter',
  dart: 'flutter',
  dotnet: 'nuget',
  nuget: 'nuget',
  composer: 'composer',
  bundle: 'bundler',
  bundler: 'bundler',
  gem: 'bundler',
  swift: 'swiftpm',
  pod: 'cocoapods',
  helm: 'helm',
  docker: 'docker',
  kustomize: 'kustomize',
  helmfile: 'helmfile',
  skaffold: 'skaffold',
  argocd: 'argocd',
  flux: 'flux',
  opam: 'opam',
  cpanm: 'cpan',
  luarocks: 'luarocks',
  shards: 'shards',
  zig: 'zig',
  brew: 'homebrew',
  choco: 'chocolatey',
  chocolatey: 'chocolatey',
  scoop: 'scoop',
  winget: 'winget',
  asdf: 'asdf',
  mise: 'mise',
  sdk: 'sdkman',
  apt: 'apt',
  'apt-get': 'apt',
  dnf: 'dnf',
  yum: 'dnf',
  apk: 'apk',
  pacman: 'pacman',
  nix: 'nix',
  cmake: 'native',
  vcpkg: 'native',
  conan: 'native'
}

const INSTALL_WORDS = new Set(['install', 'i', 'add', 'require'])
const UNINSTALL_WORDS = new Set(['uninstall', 'remove', 'rm', 'del', 'delete'])
const UPDATE_WORDS = new Set(['update', 'upgrade', 'up'])
const LIST_WORDS = new Set(['list', 'ls', 'show', 'info', 'view', 'freeze'])
const SEARCH_WORDS = new Set(['search', 'find'])
const TREE_WORDS = new Set(['tree', 'deps', 'why', 'graph', 'dependency:tree', 'dependencies', 'dependencyinsight'])
const AUDIT_WORDS = new Set(['audit', 'check', 'scan', 'lint', 'doctor'])
const BUILD_WORDS = new Set(['build', 'compile', 'package', 'pack', 'assemble', 'verify'])
const TEST_WORDS = new Set(['test', 'check'])
const CLEAN_WORDS = new Set(['clean'])
const LOCK_WORDS = new Set(['lock'])
const SYNC_WORDS = new Set(['sync', 'restore', 'get', 'tidy'])
const PUBLISH_WORDS = new Set(['publish', 'deploy', 'push', 'upload'])
const OUTDATED_WORDS = new Set(['outdated'])

function parseCommand(command: string): ParsedCommand {
  const tokens = tokenize(command)
  if (tokens.length === 0) return { tool: 'unknown', args: [] }

  const first = normalizeToolName(tokens[0])
  if ((first === 'python' || first === 'python3' || first === 'py') && tokens[1] === '-m' && normalizeToolName(tokens[2]) === 'pip') {
    return { tool: 'pip', args: tokens.slice(3) }
  }

  return {
    tool: first || 'unknown',
    args: tokens.slice(1)
  }
}

function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (quote) {
      if (char === '\\' && quote === '"') {
        escaped = true
        continue
      }
      if (char === quote) {
        quote = null
        continue
      }
      current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) tokens.push(current)
  return tokens
}

function normalizeToolName(tool: string | undefined): string {
  if (!tool) return 'unknown'
  const normalized = tool.replace(/\\/g, '/').split('/').pop() || tool
  return normalized.toLowerCase().replace(/\.(cmd|exe|bat|ps1)$/i, '')
}

function classifyCommand(tool: string, args: string[]): OperationHistoryClassification {
  const managerId = TOOL_ALIASES[tool] || TOOL_TO_MANAGER.get(tool)
  const effectiveArgs = normalizeManagerArgs(tool, managerId, args)

  if (managerId === 'npm' || managerId === 'pnpm' || managerId === 'yarn' || managerId === 'bun' || managerId === 'deno') {
    return classifyNodeCommand(tool, managerId, effectiveArgs)
  }
  if (managerId === 'pip' || managerId === 'uv' || managerId === 'poetry' || managerId === 'pipenv' || managerId === 'conda') {
    return classifyPythonCommand(tool, managerId, effectiveArgs)
  }
  if (managerId === 'maven') return classifyMavenCommand(tool, managerId, effectiveArgs)
  if (managerId === 'gradle') return classifyGradleCommand(tool, managerId, effectiveArgs)
  if (managerId === 'cargo') return classifyCargoCommand(tool, managerId, effectiveArgs)
  if (managerId === 'go') return classifyGoCommand(tool, managerId, effectiveArgs)
  if (managerId === 'flutter') return classifyFlutterCommand(tool, managerId, effectiveArgs)
  if (managerId === 'nuget') return classifyDotnetCommand(tool, managerId, effectiveArgs)
  if (managerId === 'composer' || managerId === 'bundler') return classifyGenericPackageManagerCommand(tool, managerId, effectiveArgs)
  if (managerId === 'swiftpm') return classifySwiftCommand(tool, managerId, effectiveArgs)
  if (managerId === 'cocoapods') return classifyGenericPackageManagerCommand(tool, managerId, effectiveArgs)
  if (managerId === 'helm') return classifyHelmCommand(tool, managerId, effectiveArgs)
  if (managerId === 'docker') return classifyDockerCommand(tool, managerId, effectiveArgs)
  if (managerId === 'native') return classifyNativeCommand(tool, managerId, effectiveArgs)

  return buildClassification(tool, managerId, effectiveArgs, classifyGenericOperation(effectiveArgs))
}

function normalizeManagerArgs(tool: string, managerId: DependencyManagerId | undefined, args: string[]): string[] {
  if (managerId === 'uv' && normalizeArg(args[0]) === 'pip') return args.slice(1)
  if (managerId === 'flutter' && normalizeArg(args[0]) === 'pub') return args.slice(1)
  if (managerId === 'docker' && normalizeArg(args[0]) === 'compose') return args.slice(1)
  if (managerId === 'nuget' && tool === 'dotnet' && normalizeArg(args[0]) === 'nuget') return args.slice(1)
  if (managerId === 'helm' && normalizeArg(args[0]) === 'dependency') {
    const action = normalizeArg(args[1])
    if (action === 'update') return ['sync', ...args.slice(2)]
    if (action === 'build') return ['lock', ...args.slice(2)]
  }
  return args
}

function classifyNodeCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'audit') {
    return buildClassification(tool, managerId, args, 'audit', {
      mutating: args.map(normalizeArg).includes('fix'),
      risk: args.map(normalizeArg).includes('fix') ? 'project-change' : 'read-only'
    })
  }
  if (action === 'config') return classifyConfigCommand(tool, managerId, args)
  if (action === 'cache') return classifyCacheCommand(tool, managerId, args)
  if (action === 'login' || action === 'logout' || action === 'adduser' || action === 'whoami') {
    return buildClassification(tool, managerId, args, 'login', {
      mutating: action !== 'whoami',
      scope: 'repository',
      risk: action === 'whoami' ? 'read-only' : 'credential'
    })
  }
  if (action === 'run' || action === 'run-script' || action === 'exec' || action === 'dlx' || action === 'x') {
    return buildClassification(tool, managerId, args, 'run', { mutating: true, risk: 'project-change' })
  }
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyPythonCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'config') return classifyConfigCommand(tool, managerId, args)
  if (action === 'cache') return classifyCacheCommand(tool, managerId, args)
  if (action === 'lock') return buildClassification(tool, managerId, args, 'lock')
  if (action === 'sync') return buildClassification(tool, managerId, args, 'sync')
  if (action === 'publish' || action === 'upload') return buildClassification(tool, managerId, args, 'publish')
  if (action === 'run') return buildClassification(tool, managerId, args, 'run', { mutating: true, risk: 'project-change' })
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyMavenCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const goal = firstCommandWord(args)
  if (goal === 'dependency:tree') return buildClassification(tool, managerId, args, 'tree')
  if (goal === 'dependency:analyze' || goal === 'dependency-check:check') return buildClassification(tool, managerId, args, 'audit')
  if (goal === 'dependency:go-offline') return buildClassification(tool, managerId, args, 'sync')
  if (goal === 'dependency:purge-local-repository') return buildClassification(tool, managerId, args, 'cache')
  if (goal.startsWith('versions:')) return buildClassification(tool, managerId, args, 'update')
  if (goal === 'deploy') return buildClassification(tool, managerId, args, 'publish')
  if (CLEAN_WORDS.has(goal)) return buildClassification(tool, managerId, args, 'clean')
  if (TEST_WORDS.has(goal)) return buildClassification(tool, managerId, args, 'test')
  if (BUILD_WORDS.has(goal) || goal === 'install') return buildClassification(tool, managerId, args, 'build')
  return buildClassification(tool, managerId, args, goal ? 'run' : 'unknown', goal ? { mutating: true, risk: 'project-change' } : undefined)
}

function classifyGradleCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const task = firstCommandWord(args)
  const normalizedTask = task.toLowerCase()
  if (normalizedTask === 'dependencies' || normalizedTask === 'dependencyinsight') return buildClassification(tool, managerId, args, 'tree')
  if (normalizedTask.includes('publish')) return buildClassification(tool, managerId, args, 'publish')
  if (normalizedTask === 'clean') return buildClassification(tool, managerId, args, 'clean')
  if (normalizedTask === 'test' || normalizedTask === 'check') return buildClassification(tool, managerId, args, 'test')
  if (normalizedTask === 'build' || normalizedTask === 'assemble' || normalizedTask.includes('build')) return buildClassification(tool, managerId, args, 'build')
  if (normalizedTask === 'wrapper') return buildClassification(tool, managerId, args, 'toolchain')
  return buildClassification(tool, managerId, args, normalizedTask ? 'run' : 'unknown', normalizedTask ? { mutating: true, risk: 'project-change' } : undefined)
}

function classifyCargoCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'add') return buildClassification(tool, managerId, args, 'install')
  if (action === 'remove' || action === 'rm') return buildClassification(tool, managerId, args, 'uninstall')
  if (action === 'tree' || action === 'metadata') return buildClassification(tool, managerId, args, 'tree')
  if (action === 'audit') return buildClassification(tool, managerId, args, 'audit')
  if (action === 'search') return buildClassification(tool, managerId, args, 'search')
  if (action === 'install') return buildClassification(tool, managerId, args, 'install', { scope: 'global', risk: 'environment-change' })
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyGoCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'get') return buildClassification(tool, managerId, args, 'install')
  if (action === 'install') return buildClassification(tool, managerId, args, 'install', { scope: 'global', risk: 'environment-change' })
  if (action === 'mod') {
    const modAction = firstCommandWord(args.slice(args.findIndex((arg) => normalizeArg(arg) === 'mod') + 1))
    if (modAction === 'tidy') return buildClassification(tool, managerId, args, 'sync')
    if (modAction === 'graph' || modAction === 'why') return buildClassification(tool, managerId, args, 'tree')
    if (modAction === 'download') return buildClassification(tool, managerId, args, 'sync')
  }
  if (action === 'list') return buildClassification(tool, managerId, args, 'list')
  if (action === 'test') return buildClassification(tool, managerId, args, 'test')
  if (action === 'build') return buildClassification(tool, managerId, args, 'build')
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyFlutterCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'add') return buildClassification(tool, managerId, args, 'install')
  if (action === 'remove') return buildClassification(tool, managerId, args, 'uninstall')
  if (action === 'get') return buildClassification(tool, managerId, args, 'sync')
  if (action === 'upgrade') return buildClassification(tool, managerId, args, 'update')
  if (action === 'deps') return buildClassification(tool, managerId, args, 'tree')
  if (action === 'outdated') return buildClassification(tool, managerId, args, 'outdated')
  if (action === 'publish') return buildClassification(tool, managerId, args, 'publish')
  if (action === 'doctor') return buildClassification(tool, managerId, args, 'audit')
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyDotnetCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  const actionIndex = args.findIndex((arg) => normalizeArg(arg) === action)
  const next = normalizeArg(args[actionIndex + 1])
  if (action === 'add' && next === 'package') return buildClassification(tool, managerId, args, 'install')
  if (action === 'remove' && next === 'package') return buildClassification(tool, managerId, args, 'uninstall')
  if (action === 'list') return buildClassification(tool, managerId, args, 'list')
  if (action === 'restore') return buildClassification(tool, managerId, args, 'sync')
  if (action === 'pack' || action === 'build') return buildClassification(tool, managerId, args, 'build')
  if (action === 'test') return buildClassification(tool, managerId, args, 'test')
  if (action === 'publish') return buildClassification(tool, managerId, args, 'publish')
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyGenericPackageManagerCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'require' || action === 'add') return buildClassification(tool, managerId, args, 'install')
  if (action === 'remove') return buildClassification(tool, managerId, args, 'uninstall')
  if (action === 'install') return buildClassification(tool, managerId, args, 'sync')
  if (action === 'dump-autoload') return buildClassification(tool, managerId, args, 'build')
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifySwiftCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  const next = normalizeArg(args[args.findIndex((arg) => normalizeArg(arg) === action) + 1])
  if (action === 'package' && next === 'resolve') return buildClassification(tool, managerId, args, 'sync')
  if (action === 'package' && next === 'update') return buildClassification(tool, managerId, args, 'update')
  if (action === 'package' && next === 'show-dependencies') return buildClassification(tool, managerId, args, 'tree')
  if (action === 'build') return buildClassification(tool, managerId, args, 'build')
  if (action === 'test') return buildClassification(tool, managerId, args, 'test')
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyHelmCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'install' || action === 'upgrade' || action === 'uninstall' || action === 'rollback') {
    return buildClassification(tool, managerId, args, action === 'uninstall' ? 'uninstall' : 'install', {
      scope: 'environment',
      risk: 'environment-change'
    })
  }
  if (action === 'lint') return buildClassification(tool, managerId, args, 'audit')
  if (action === 'template' || action === 'list' || action === 'status') return buildClassification(tool, managerId, args, 'list')
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyDockerCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (action === 'build') return buildClassification(tool, managerId, args, 'build')
  if (action === 'pull') return buildClassification(tool, managerId, args, 'sync', { scope: 'environment', risk: 'environment-change' })
  if (action === 'push') return buildClassification(tool, managerId, args, 'publish')
  if (action === 'scan' || action === 'sbom') return buildClassification(tool, managerId, args, 'audit')
  if (action === 'run' || action === 'up' || action === 'down' || action === 'start' || action === 'stop') {
    return buildClassification(tool, managerId, args, 'run', { scope: 'environment', risk: 'environment-change' })
  }
  if (action === 'images' || action === 'ps' || action === 'inspect') return buildClassification(tool, managerId, args, 'list')
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyNativeCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const action = firstCommandWord(args)
  if (tool === 'cmake' && args.map(normalizeArg).includes('--build')) return buildClassification(tool, managerId, args, 'build')
  if (tool === 'cmake') return buildClassification(tool, managerId, args, 'config')
  if (action === 'install' || action === 'add') return buildClassification(tool, managerId, args, 'install')
  if (action === 'remove' || action === 'uninstall') return buildClassification(tool, managerId, args, 'uninstall')
  if (action === 'build' || action === 'create') return buildClassification(tool, managerId, args, 'build')
  if (action === 'search' || action === 'list' || action === 'info') return buildClassification(tool, managerId, args, action as OperationHistoryOperationKind)
  return buildClassification(tool, managerId, args, classifyGenericOperation(args))
}

function classifyConfigCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const actionIndex = args.findIndex((arg) => normalizeArg(arg) === 'config')
  const configAction = firstCommandWord(args.slice(actionIndex + 1))
  const mutating = ['set', 'delete', 'del', 'rm', 'unset', 'edit'].includes(configAction)
  return buildClassification(tool, managerId, args, 'config', {
    mutating,
    scope: 'repository',
    risk: mutating ? 'project-change' : 'read-only'
  })
}

function classifyCacheCommand(tool: string, managerId: DependencyManagerId | undefined, args: string[]): OperationHistoryClassification {
  const actionIndex = args.findIndex((arg) => normalizeArg(arg) === 'cache')
  const cacheAction = firstCommandWord(args.slice(actionIndex + 1))
  const mutating = ['clean', 'clear', 'purge', 'remove', 'rm', 'verify'].includes(cacheAction)
  return buildClassification(tool, managerId, args, 'cache', {
    mutating,
    scope: 'cache',
    risk: mutating ? 'cache-change' : 'read-only'
  })
}

function classifyGenericOperation(args: string[]): OperationHistoryOperationKind {
  const action = firstCommandWord(args)
  if (!action) return 'unknown'
  if (INSTALL_WORDS.has(action)) return 'install'
  if (UNINSTALL_WORDS.has(action)) return 'uninstall'
  if (UPDATE_WORDS.has(action)) return 'update'
  if (SYNC_WORDS.has(action)) return 'sync'
  if (AUDIT_WORDS.has(action)) return 'audit'
  if (TREE_WORDS.has(action)) return 'tree'
  if (LIST_WORDS.has(action)) return action === 'show' || action === 'info' || action === 'view' ? 'info' : 'list'
  if (SEARCH_WORDS.has(action)) return 'search'
  if (OUTDATED_WORDS.has(action)) return 'outdated'
  if (PUBLISH_WORDS.has(action)) return 'publish'
  if (BUILD_WORDS.has(action)) return 'build'
  if (TEST_WORDS.has(action)) return 'test'
  if (CLEAN_WORDS.has(action)) return 'clean'
  if (LOCK_WORDS.has(action)) return 'lock'
  if (action === 'login' || action === 'logout' || action === 'whoami') return 'login'
  if (action === 'run' || action === 'exec') return 'run'
  return 'unknown'
}

function buildClassification(
  tool: string,
  managerId: DependencyManagerId | undefined,
  args: string[],
  operation: OperationHistoryOperationKind,
  override: ClassificationOverride = {}
): OperationHistoryClassification {
  const manager = managerId ? MANAGER_BY_ID.get(managerId) : undefined
  const mutating = override.mutating ?? defaultMutating(operation)
  const scope = override.scope ?? inferScope(managerId, args, operation)
  const risk = override.risk ?? inferRisk(operation, mutating, scope)
  const managerLabel = manager?.shortName || manager?.name || managerId || tool

  return {
    tool,
    managerId,
    managerName: manager?.name,
    ecosystem: manager?.ecosystem,
    operation,
    mutating,
    scope,
    risk,
    summary: `${managerLabel} ${operationLabel(operation)}`
  }
}

function firstCommandWord(args: string[]): string {
  const command = args.find((arg) => {
    const normalized = normalizeArg(arg)
    return normalized.length > 0 && !normalized.startsWith('-')
  })
  return normalizeArg(command)
}

function normalizeArg(arg: string | undefined): string {
  return (arg || '').trim().toLowerCase()
}

function defaultMutating(operation: OperationHistoryOperationKind): boolean {
  return ![
    'audit',
    'tree',
    'list',
    'search',
    'outdated',
    'test',
    'info',
    'unknown'
  ].includes(operation)
}

function inferScope(
  managerId: DependencyManagerId | undefined,
  args: string[],
  operation: OperationHistoryOperationKind
): OperationHistoryScope {
  const normalizedArgs = args.map(normalizeArg)
  if (normalizedArgs.includes('-g') || normalizedArgs.includes('--global')) return 'global'
  if (operation === 'publish') return 'publish'
  if (operation === 'cache') return 'cache'
  if (operation === 'login') return 'repository'
  if (managerId === 'docker' || managerId === 'helm') return 'environment'
  if (managerId === 'conda') return 'environment'
  return 'project'
}

function inferRisk(
  operation: OperationHistoryOperationKind,
  mutating: boolean,
  scope: OperationHistoryScope
): OperationHistoryRisk {
  if (!mutating) return 'read-only'
  if (operation === 'publish') return 'publish'
  if (operation === 'login') return 'credential'
  if (operation === 'cache') return 'cache-change'
  if (operation === 'build' || operation === 'clean') return 'build-artifact'
  if (scope === 'global' || scope === 'environment') return 'environment-change'
  if (operation === 'unknown') return 'unknown'
  return 'project-change'
}

function operationLabel(operation: OperationHistoryOperationKind): string {
  const labels: Record<OperationHistoryOperationKind, string> = {
    install: 'install',
    uninstall: 'remove',
    update: 'update',
    sync: 'sync',
    audit: 'audit',
    tree: 'dependency tree',
    list: 'list',
    search: 'search',
    outdated: 'outdated check',
    publish: 'publish',
    config: 'configuration',
    cache: 'cache',
    build: 'build',
    test: 'test',
    run: 'run',
    clean: 'clean',
    lock: 'lockfile',
    login: 'credential',
    toolchain: 'toolchain',
    restore: 'restore',
    info: 'info',
    unknown: 'command'
  }
  return labels[operation]
}

function summarizeRecord(record: OperationHistoryRecord, classification: OperationHistoryClassification): string {
  const output = firstUsefulLine(record.error) || firstUsefulLine(record.stderr) || firstUsefulLine(record.stdout)
  if (output) return truncateOneLine(output, 180)
  return record.status === 'success' ? `${classification.summary} completed` : `${classification.summary} failed`
}

function firstUsefulLine(value?: string): string | undefined {
  if (!value) return undefined
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
}

function truncateOneLine(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength - 1)}...` : oneLine
}

function renderMarkdownReport(
  cwd: string,
  generatedAt: string,
  summary: OperationHistorySummary,
  records: OperationHistoryRecord[]
): string {
  const lines = [
    '# Operation History Report',
    '',
    `Generated: ${generatedAt}`,
    `Project: ${resolve(cwd)}`,
    '',
    '## Summary',
    '',
    `- Total records: ${summary.total}`,
    `- Success: ${summary.success}`,
    `- Errors: ${summary.error}`,
    `- Mutating: ${summary.mutating}`,
    `- Read-only: ${summary.readOnly}`,
    '',
    '## Records',
    '',
    '| Finished | Status | Manager | Operation | Scope | Risk | Duration | Command | Summary |',
    '| --- | --- | --- | --- | --- | --- | ---: | --- | --- |'
  ]

  for (const record of records) {
    const classification = record.classification || classifyOperationHistoryRecord(record)
    lines.push([
      new Date(record.finishedAt).toISOString(),
      record.status,
      classification.managerId || classification.tool,
      classification.operation,
      classification.scope,
      classification.risk,
      `${record.durationMs} ms`,
      `\`${escapeMarkdownCell(record.command)}\``,
      escapeMarkdownCell(record.summary || summarizeRecord(record, classification))
    ].join(' | '))
  }

  lines.push('')
  return lines.join('\n')
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
}
