import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { analyzeManagerHealth } from '../../staticHealth'
import { readTextIfExists } from '../../structuredData'
import { readHelmLock } from './cloudLocks'
import type { HelmDependencyRecord } from './cloudTypes'

export async function analyzeCloudManagerHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const findings: ManagerHealthFinding[] = []
  const lockContent = await readTextIfExists(join(cwd, 'Chart.lock'))
  if (!lockContent) {
    findings.push(createHealthFinding('helm-lock-missing', 'warning', 'Chart.lock is missing', 'Run helm dependency update or helm dependency build to create a reproducible chart dependency lock.'))
  } else {
    try {
      const lock = await readHelmLock(cwd)
      const digest = lock[0]?.digest
      if (!digest) findings.push(createHealthFinding('helm-lock-digest-missing', 'warning', 'Chart.lock digest is missing', 'Chart.lock does not contain a digest proving it matches Chart.yaml.'))
    } catch (error: any) {
      findings.push(createHealthFinding('helm-lock-invalid', 'error', 'Chart.lock is invalid', error?.message || 'Unable to parse Chart.lock.'))
    }
  }
  for (const dependency of dependencies.filter((item) => item.source?.toLowerCase().startsWith('http://'))) {
    findings.push(createHealthFinding(
      `helm-insecure-repository:${dependency.name}`,
      'error',
      'Chart repository uses insecure HTTP',
      `${dependency.name} resolves through ${dependency.source}.`,
      { packageName: dependency.name, source: dependency.source }
    ))
  }
  return appendHealthFindings(base, findings)
}
