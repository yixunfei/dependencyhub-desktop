import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { readTextIfExists } from '../../structuredData'
import { readCocoaPodsInventory } from './cocoapodsInventory'

export async function analyzeCocoaPodsHealth(cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const findings = [] as ReturnType<typeof createHealthFinding>[]
  if (!await readTextIfExists(join(cwd, 'Podfile'))) findings.push(createHealthFinding('cocoapods-manifest-missing', 'error', 'Podfile is missing', 'CocoaPods requires a Podfile manifest.'))
  if (!await readTextIfExists(join(cwd, 'Podfile.lock'))) findings.push(createHealthFinding('cocoapods-lock-missing', 'warning', 'Podfile.lock is missing', 'Run pod install to create reproducible pod pins.'))
  for (const item of dependencies.filter((item) => item.source?.startsWith('http://'))) findings.push(createHealthFinding(`cocoapods-insecure:${item.name}`, 'error', 'Pod source uses insecure HTTP', `${item.name} resolves through ${item.source}.`, { packageName: item.name, source: item.source }))
  return appendHealthFindings(base, findings)
}
