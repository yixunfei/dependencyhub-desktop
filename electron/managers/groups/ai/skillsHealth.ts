import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { SKILLS_LOCK_FILE, SKILLS_MANIFEST_FILE, groupFilesByName } from './aiTypes'
import type { DeclaredAiEntry } from './aiManifest'
import { readSkillDeclarations, readSkillLock, readSkillRecords, skillDescriptionLimit, type SkillLockEntry, type SkillRecord } from './skillsInventory'

export async function analyzeSkillsHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const [records, declarations, locked] = await Promise.all([
    readSkillRecords(cwd),
    readSkillDeclarations(cwd),
    readSkillLock(cwd)
  ])

  const limit = skillDescriptionLimit()
  const localNames = new Set(records.map((record) => record.name))
  const findings = [
    ...records.flatMap((record) => skillRecordFindings(record, limit)),
    ...declarationFindings(declarations, localNames),
    ...lockFindings(records, locked),
    ...duplicateSkillFindings(records)
  ]
  return appendHealthFindings(base, findings)
}

function skillRecordFindings(record: SkillRecord, limit: number): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  if (!record.frontmatterPresent) {
    findings.push(createHealthFinding(
      `skills-frontmatter-missing:${record.file}`,
      'error',
      'SKILL.md has no YAML frontmatter',
      `${record.file} cannot be loaded as a skill without a frontmatter block declaring at least name and description.`,
      { packageName: record.name, source: record.file }
    ))
  } else if (!record.declaredName) {
    findings.push(createHealthFinding(
      `skills-name-missing:${record.file}`,
      'error',
      'Skill frontmatter does not declare a name',
      `${record.file} falls back to the directory name, so skill references are ambiguous.`,
      { packageName: record.name, source: record.file }
    ))
  }

  const directoryName = record.directory === '.' ? '' : record.directory.split('/').filter(Boolean).pop() || ''
  if (record.frontmatterPresent && directoryName && record.name !== directoryName) {
    findings.push(createHealthFinding(
      `skills-name-mismatch:${record.file}`,
      'warning',
      'Skill name differs from its directory',
      `${record.file} declares "${record.name}" inside "${directoryName}".`,
      { packageName: record.name, source: record.file }
    ))
  }

  if (!record.description) {
    findings.push(createHealthFinding(
      `skills-description-missing:${record.file}`,
      'warning',
      'Skill has no description',
      `${record.name} has no description, so agents cannot discover when to load it.`,
      { packageName: record.name, source: record.file }
    ))
  } else if (record.description.length > limit) {
    findings.push(createHealthFinding(
      `skills-description-too-long:${record.file}`,
      'warning',
      'Skill description exceeds the discovery limit',
      `${record.name} has a ${record.description.length} character description; keep it under ${limit}.`,
      { packageName: record.name, source: record.file }
    ))
  }

  if (record.hasScripts && record.allowedTools.length === 0) {
    findings.push(createHealthFinding(
      `skills-tools-undeclared:${record.file}`,
      'warning',
      'Skill ships scripts without declaring allowed tools',
      `${record.name} contains a scripts directory but no allowed-tools entry, so its executable surface is undocumented.`,
      { packageName: record.name, source: record.file }
    ))
  }
  return findings
}

function declarationFindings(declarations: readonly DeclaredAiEntry[], localNames: ReadonlySet<string>): ManagerHealthFinding[] {
  return declarations
    .filter((declaration) => !localNames.has(declaration.name))
    .map((declaration) => createHealthFinding(
      `skills-declared-missing:${declaration.name}`,
      'warning',
      'Declared skill is not present in the project',
      `${declaration.name} is declared in ${SKILLS_MANIFEST_FILE} but no SKILL.md provides it.`,
      { packageName: declaration.name, source: declaration.source || SKILLS_MANIFEST_FILE }
    ))
}

function lockFindings(records: readonly SkillRecord[], locked: readonly SkillLockEntry[]): ManagerHealthFinding[] {
  if (locked.length === 0) return []
  const findings: ManagerHealthFinding[] = []
  const lockByName = new Map(locked.map((entry) => [entry.name, entry]))

  for (const record of records) {
    const entry = lockByName.get(record.name)
    if (!entry) {
      findings.push(createHealthFinding(
        `skills-lock-missing-entry:${record.name}`,
        'warning',
        'Lock evidence is missing for a skill',
        `${record.name} exists locally but is absent from ${SKILLS_LOCK_FILE}.`,
        { packageName: record.name, source: record.file }
      ))
      continue
    }
    if (entry.hash !== record.hash || entry.path !== record.file) {
      findings.push(createHealthFinding(
        `skills-lock-drift:${record.name}`,
        'warning',
        'Skill content drifted from its lock evidence',
        `${record.name} changed since ${SKILLS_LOCK_FILE} was written.`,
        { packageName: record.name, source: record.file }
      ))
    }
  }

  const localNames = new Set(records.map((record) => record.name))
  for (const entry of locked) {
    if (localNames.has(entry.name)) continue
    findings.push(createHealthFinding(
      `skills-lock-stale:${entry.name}`,
      'warning',
      'Lock evidence references a removed skill',
      `${entry.name} is recorded in ${SKILLS_LOCK_FILE} but no longer exists.`,
      { packageName: entry.name, source: SKILLS_LOCK_FILE }
    ))
  }
  return findings
}

function duplicateSkillFindings(records: readonly SkillRecord[]): ManagerHealthFinding[] {
  const findings: ManagerHealthFinding[] = []
  for (const [name, paths] of groupFilesByName(records)) {
    if (paths.size < 2) continue
    findings.push(createHealthFinding(
      `skills-duplicate:${name}`,
      'warning',
      'Duplicate skill name across skill roots',
      `${name} is defined by ${[...paths].sort().join(', ')}; only one definition can win at load time.`,
      { packageName: name }
    ))
  }
  return findings
}
