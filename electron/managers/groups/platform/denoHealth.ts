import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { readTextIfExists } from '../../structuredData'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'

export async function analyzeDenoHealth(cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const findings = [] as ReturnType<typeof createHealthFinding>[]
  const manifest = await readTextIfExists(join(cwd, 'deno.json')) || await readTextIfExists(join(cwd, 'deno.jsonc'))
  if (!manifest) findings.push(createHealthFinding('deno-manifest-missing', 'error', 'Deno manifest is missing', 'Create deno.json or deno.jsonc.'))
  if (!await readTextIfExists(join(cwd, 'deno.lock'))) findings.push(createHealthFinding('deno-lock-missing', 'warning', 'Deno lockfile is missing', 'Run deno cache --lock=deno.lock or deno install to create reproducible dependency evidence.'))
  for (const item of dependencies) {
    if (item.source?.startsWith('http://')) findings.push(createHealthFinding(`deno-insecure:${item.name}`, 'error', 'Import uses insecure HTTP', `${item.name} resolves through ${item.source}.`, { packageName: item.name, source: item.source }))
    if (item.direct && item.source && /^https?:\/\//.test(item.source) && !/[#?&](v|version|revision)=/i.test(item.source)) findings.push(createHealthFinding(`deno-unpinned:${item.name}`, 'warning', 'Remote import is not pinned', `${item.name} does not include a version or revision.`, { packageName: item.name, source: item.source }))
  }
  return appendHealthFindings(base, findings)
}
