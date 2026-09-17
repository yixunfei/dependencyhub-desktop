import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { AGENTS_LOCK_FILE, AGENTS_MANIFEST_FILE, groupFilesByName } from './aiTypes'
import type { DeclaredAiEntry } from './aiManifest'
import { readAgentDeclarations, readAgentRecords, readAgentsLock, type AgentLockEntry, type AgentRecord } from './agentsInventory'

export async function analyzeAgentsHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const [records, declarations, locked] = await Promise.all([
    readAgentRecords(cwd),
    readAgentDeclarations(cwd),
    readAgentsLock(cwd)
  ])

  const localNames = new Set(records.map((record) => record.name))
  const findings = [
    ...records.flatMap(agentRecordFindings),
    ...declarationFindings(declarations, localNames),
    ...lockFindings(records, locked),
    ...duplicateAgentFindings(records)
  ]
  return appendHealthFindings(base, findings)
}

function agentRecordFindings(record: AgentRecord): ManagerHealthFinding[] {
  if (record.bytes === 0) {
    return [createHealthFinding(
      `agents-empty:${record.file}`,
      'error',
      'Agent context file is empty',
      `${record.file} is empty, so agents load no instruction from it.`,
      { packageName: record.name, source: record.file }
    )]
  }

  const findings: ManagerHealthFinding[] = []
  if (record.type !== 'instructions' && !record.frontmatterPresent) {
    findings.push(createHealthFinding(
      `agents-frontmatter-missing:${record.file}`,
      'error',
      'Agent definition has no frontmatter',
      `${record.file} is a ${record.type} definition and needs frontmatter with at least a name and description.`,
      { packageName: record.name, source: record.file }
    ))
  } else if (!record.description) {
    findings.push(createHealthFinding(
      `agents-description-missing:${record.file}`,
      'warning',
      'Agent definition has no description',
      `${record.name} cannot be selected reliably without a description.`,
      { packageName: record.name, source: record.file }
    ))
  }

  if (record.type !== 'instructions' && record.tools.length === 0) {
    findings.push(createHealthFinding(
      `agents-tools-undeclared:${record.file}`,
      'warning',
      'Agent definition does not declare its tools',
      `${record.name} leaves the tool surface implicit, so its permissions cannot be reviewed.`,
      { packageName: record.name, source: record.file }
    ))
  }
  return findings
}

function declarationFindings(declarations: readonly DeclaredAiEntry[], localNames: ReadonlySet<string>): ManagerHealthFinding[] {
  return declarations
    .filter((declaration) => !localNames.has(declaration.name))
    .map((declaration) => createHealthFinding(
      `agents-declared-missing:${declaration.name}`,
      'warning',
      'Declared agent dependency is not present in the project',
      `${declaration.name} is declared in ${AGENTS_MANIFEST_FILE} but no instruction file provides it.`,
      { packageName: declaration.name, source: declaration.source || AGENTS_MANIFEST_FILE }
    ))
}

function lockFindings(records: readonly AgentRecord[], locked: readonly AgentLockEntry[]): ManagerHealthFinding[] {
  if (locked.length === 0) return []
  const findings: ManagerHealthFinding[] = []
  const lockByName = new Map(locked.map((entry) => [entry.name, entry]))

  for (const record of records) {
    const entry = lockByName.get(record.name)
    if (!entry) {
      findings.push(createHealthFinding(
        `agents-lock-missing-entry:${record.name}`,
        'warning',
        'Lock evidence is missing for an agent dependency',
        `${record.name} exists locally but is absent from ${AGENTS_LOCK_FILE}.`,
        { packageName: record.name, source: record.file }
      ))
      continue
    }
    if (entry.hash !== record.hash || entry.path !== record.file) {
      findings.push(createHealthFinding(
        `agents-lock-drift:${record.name}`,
        'warning',
        'Agent context drifted from its lock evidence',
        `${record.name} changed since ${AGENTS_LOCK_FILE} was written.`,
        { packageName: record.name, source: record.file }
      ))
    }
  }

  const localNames = new Set(records.map((record) => record.name))
  for (const entry of locked) {
    if (localNames.has(entry.name)) continue
    findings.push(createHealthFinding(
      `agents-lock-stale:${entry.name}`,
      'warning',
      'Lock evidence references a removed agent dependency',
      `${entry.name} is recorded in ${AGENTS_LOCK_FILE} but no longer exists.`,
      { packageName: entry.name, source: AGENTS_LOCK_FILE }
    ))
  }
  return findings
}

function duplicateAgentFindings(records: readonly AgentRecord[]): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  for (const [name, paths] of groupFilesByName(records)) {
    if (paths.size < 2) continue
    findings.push(createHealthFinding(
      `agents-duplicate:${name}`,
      'warning',
      'Duplicate agent dependency name',
      `${name} is provided by ${[...paths].sort().join(', ')}; only one definition can win at load time.`,
      { packageName: name }
    ))
  }
  return findings
}
