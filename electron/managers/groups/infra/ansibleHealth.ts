import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { readTextIfExists } from '../../structuredData'

export async function analyzeAnsibleHealth(cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies); const findings = [] as ReturnType<typeof createHealthFinding>[]
  if (!(await readTextIfExists(join(cwd, 'requirements.yml')) || await readTextIfExists(join(cwd, 'requirements.yaml')) || await readTextIfExists(join(cwd, 'collections/requirements.yml')) || await readTextIfExists(join(cwd, 'roles/requirements.yml')))) findings.push(createHealthFinding('ansible-manifest-missing', 'warning', 'Ansible requirements file is missing', 'Create requirements.yml or a collection/role requirements file.'))
  findings.push(createHealthFinding('ansible-no-lockfile', 'info', 'Ansible Galaxy has no standard lockfile', 'Keep reviewed requirements files and CI installation evidence for reproducibility.'))
  for (const item of dependencies) if (item.source?.startsWith('http://')) findings.push(createHealthFinding(`ansible-insecure:${item.name}`, 'error', 'Ansible source uses insecure HTTP', `${item.name} resolves through ${item.source}.`, { packageName: item.name, source: item.source }))
  return appendHealthFindings(base, findings)
}
