import type { DependencyManagerDefinition } from '../../shared/managerRegistry'
import type {
  ManagerDependency,
  ManagerHealthFinding,
  ManagerHealthReport,
  ManagerRuntimePlatform
} from '../../shared/managerWorkspace'
import { createManagerDescriptor } from './capabilities'
import { findWorkspaceFiles } from './workspaceFiles'

const ROLLING_VERSIONS = new Set([
  '*',
  'latest',
  'main',
  'master',
  'develop',
  'development',
  'head',
  'nightly',
  'stable',
  'edge'
])

export async function analyzeManagerHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  const descriptor = createManagerDescriptor(definition)
  const findings: ManagerHealthFinding[] = []
  const platform = process.platform as ManagerRuntimePlatform

  if (!descriptor.capabilities.platforms.includes(platform)) {
    findings.push(finding(
      'platform-unavailable',
      'warning',
      'Manager is not available on this platform',
      `${definition.name} supports ${descriptor.capabilities.platforms.join(', ')}, not ${platform}.`
    ))
  }

  if (definition.lockFiles.length > 0 && !await anyPatternExists(cwd, definition.lockFiles)) {
    findings.push(finding(
      'lockfile-missing',
      'warning',
      'No lockfile was detected',
      `Expected one of: ${definition.lockFiles.join(', ')}.`
    ))
  }

  const versionsByName = new Map<string, Set<string>>()
  for (const dependency of dependencies) {
    const version = dependency.resolvedVersion || dependency.version || dependency.requestedVersion
    if (!version) {
      findings.push(dependencyFinding(dependency, 'version-missing', 'warning', 'Dependency has no version evidence'))
    } else if (isFloating(version, descriptor.capabilities.kind)) {
      findings.push(dependencyFinding(dependency, 'floating-version', 'warning', `Floating dependency reference: ${version}`))
    }
    if (dependency.source?.trim().toLowerCase().startsWith('http://')) {
      findings.push(dependencyFinding(dependency, 'insecure-source', 'error', 'Dependency source uses insecure HTTP'))
    }
    const versions = versionsByName.get(dependency.name) || new Set<string>()
    if (version) versions.add(version)
    versionsByName.set(dependency.name, versions)
  }

  for (const [name, versions] of versionsByName) {
    if (versions.size < 2) continue
    findings.push(finding(
      `version-conflict:${name}`,
      'warning',
      `Multiple versions recorded for ${name}`,
      [...versions].sort().join(', '),
      name
    ))
  }

  const uniqueFindings = uniqueById(findings)
  const status = uniqueFindings.some((item) => item.severity === 'error')
    ? 'error'
    : uniqueFindings.length > 0
      ? 'warning'
      : 'healthy'
  return {
    managerId: definition.id,
    status,
    generatedAt: new Date().toISOString(),
    summary: uniqueFindings.length > 0
      ? `${uniqueFindings.length} manager health finding(s)`
      : `${dependencies.length} dependencies inspected without static findings`,
    findings: uniqueFindings
  }
}

function isFloating(version: string, kind: string): boolean {
  const normalized = version.trim().replace(/^refs\/heads\//i, '').toLowerCase()
  if (ROLLING_VERSIONS.has(normalized)) return true
  if (/^(workspace:)?\*$/.test(normalized)) return true
  if (/\b(latest|main|master|head|nightly)\b/.test(normalized)) return true
  return kind !== 'package' && /^(\^|~|>|<|>=|<=)|[xX*]$/.test(normalized)
}

async function anyPatternExists(cwd: string, patterns: readonly string[]): Promise<boolean> {
  const expressions = patterns.map((pattern) => {
    const normalized = pattern.replace(/\\/g, '/')
    return {
      nested: normalized.includes('/'),
      expression: new RegExp(`^${escapeRegExp(normalized).replace(/\\\*/g, '.*')}$`, 'i')
    }
  })
  const matches = await findWorkspaceFiles(cwd, (fileName, relativePath) => (
    expressions.some(({ nested, expression }) => expression.test(nested ? relativePath : fileName))
  ), { maxDepth: 8, ignoredDirectories: ['.npmDesktopManager'] })
  return matches.length > 0
}

function dependencyFinding(
  dependency: ManagerDependency,
  suffix: string,
  severity: ManagerHealthFinding['severity'],
  message: string
): ManagerHealthFinding {
  return finding(
    `${suffix}:${dependency.name}:${dependency.file}`,
    severity,
    dependency.name,
    `${message} (${dependency.file}).`,
    dependency.name,
    dependency.version
  )
}

function finding(
  id: string,
  severity: ManagerHealthFinding['severity'],
  title: string,
  message: string,
  packageName?: string,
  currentVersion?: string
): ManagerHealthFinding {
  return { id, severity, title, message, packageName, currentVersion }
}

function uniqueById(findings: ManagerHealthFinding[]): ManagerHealthFinding[] {
  return [...new Map(findings.map((item) => [item.id, item])).values()]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
