import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthReport, ManagerHealthFinding } from '../../../../shared/managerWorkspace'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { readTextIfExists } from '../../structuredData'

export async function analyzeInfraHealth(cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies); const findings: ManagerHealthFinding[] = []
  const lock = await readTextIfExists(join(cwd, '.terraform.lock.hcl'))
  if (!lock) findings.push(createHealthFinding(`${definition.id}-lock-missing`, 'warning', 'Terraform provider lockfile is missing', 'Run init or providers lock to create .terraform.lock.hcl.'))
  else {
    if (!/\bversion\s*=\s*"[^"]+"/.test(lock)) findings.push(createHealthFinding(`${definition.id}-lock-invalid`, 'error', 'Terraform provider lockfile is invalid', 'No provider version was found in .terraform.lock.hcl.'))
    if (!/\bhashes\s*=\s*\[/.test(lock)) findings.push(createHealthFinding(`${definition.id}-lock-hashes-missing`, 'warning', 'Provider lock hashes are missing', 'Lockfile does not contain provider checksum evidence.'))
  }
  for (const item of dependencies.filter((dependency) => dependency.source?.toLowerCase().startsWith('http://'))) findings.push(createHealthFinding(`${definition.id}-insecure-source:${item.name}`, 'error', 'Infrastructure source uses insecure HTTP', `${item.name} resolves through ${item.source}.`, { packageName: item.name, source: item.source }))
  return appendHealthFindings(base, findings)
}
