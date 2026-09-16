import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { analyzeManagerHealth } from '../../staticHealth'
import { readTextIfExists } from '../../structuredData'
import { readSwiftPackageInventory, readSwiftPackageLock } from './swiftpmInventory'

export async function analyzeSwiftPackageHealth(cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const findings: ManagerHealthFinding[] = []
  const manifest = await readTextIfExists(join(cwd, 'Package.swift'))
  if (!manifest) findings.push(createHealthFinding('swiftpm-manifest-missing', 'error', 'Package.swift is missing', 'SwiftPM requires a Package.swift manifest.'))
  const lock = await readTextIfExists(join(cwd, 'Package.resolved'))
  if (!lock) {
    findings.push(createHealthFinding('swiftpm-lock-missing', 'warning', 'Package.resolved is missing', 'Run swift package resolve to create a reproducible dependency pin file.'))
  } else {
    try {
      const pins = await readSwiftPackageLock(cwd)
      if (pins.length === 0) findings.push(createHealthFinding('swiftpm-lock-empty', 'warning', 'Package.resolved has no pins', 'The lockfile does not contain any resolved package pins.'))
      for (const item of pins.filter((pin) => pin.metadata?.pinState !== 'version')) {
        findings.push(createHealthFinding(`swiftpm-unpinned:${item.name}`, 'warning', 'SwiftPM dependency is not version pinned', `${item.name} uses ${String(item.metadata?.pinState || 'unknown')} state in Package.resolved.`, { packageName: item.name, currentVersion: item.version }))
      }
    } catch (error: any) {
      findings.push(createHealthFinding('swiftpm-lock-invalid', 'error', 'Package.resolved is invalid', error?.message || 'Unable to parse Package.resolved.'))
    }
  }
  for (const dependency of dependencies.filter((item) => item.source?.toLowerCase().startsWith('http://'))) {
    findings.push(createHealthFinding(`swiftpm-insecure-source:${dependency.name}`, 'error', 'Swift package source uses insecure HTTP', `${dependency.name} resolves through ${dependency.source}.`, { packageName: dependency.name, source: dependency.source }))
  }
  return appendHealthFindings(base, findings)
}
