import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { analyzeManagerHealth } from '../../staticHealth'
import { readTextIfExists } from '../../structuredData'
import { readHelmfileInventory, readHelmfileLock } from './helmfileInventory'

export async function analyzeHelmfileHealth(cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies); const findings: ManagerHealthFinding[] = []
  const manifest = await readTextIfExists(join(cwd, 'helmfile.yaml')) || await readTextIfExists(join(cwd, 'helmfile.yml'))
  if (!manifest) findings.push(createHealthFinding('helmfile-manifest-missing', 'error', 'Helmfile manifest is missing', 'Create helmfile.yaml or helmfile.yml.'))
  const lock = await readTextIfExists(join(cwd, 'helmfile.lock'))
  if (!lock) findings.push(createHealthFinding('helmfile-lock-missing', 'warning', 'Helmfile lock is missing', 'Run helmfile deps to generate the project lock convention.'))
  else {
    try { await readHelmfileLock(cwd) } catch (error: any) { findings.push(createHealthFinding('helmfile-lock-invalid', 'error', 'Helmfile lock is invalid', error?.message || 'Unable to parse helmfile.lock.')) }
  }
  for (const item of dependencies.filter((dependency) => dependency.source?.toLowerCase().startsWith('http://'))) findings.push(createHealthFinding(`helmfile-insecure-source:${item.name}`, 'error', 'Helmfile source uses insecure HTTP', `${item.name} resolves through ${item.source}.`, { packageName: item.name, source: item.source }))
  for (const item of dependencies.filter((dependency) => dependency.direct && dependency.type === 'release' && !dependency.requestedVersion)) findings.push(createHealthFinding(`helmfile-unpinned:${item.name}`, 'warning', 'Helmfile release is not version pinned', `${item.name} has no explicit chart version.`, { packageName: item.name }))
  return appendHealthFindings(base, findings)
}
