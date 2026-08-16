import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { normalizePackageName } from '../../packageIdentity'
import { analyzeManagerHealth } from '../../staticHealth'
import {
  asArray,
  asRecord,
  asString,
  getRecord,
  parseJsonDocument,
  parseTomlDocument,
  parseYamlDocument,
  readTextIfExists,
  stringArray
} from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import { assertPythonWorkspaceManager } from './pythonTypes'

export async function analyzePythonManagerHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  assertPythonWorkspaceManager(definition.id)
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const common = await commonPythonFindings(cwd, definition, dependencies)
  let specific: ManagerHealthFinding[] = []
  if (definition.id === 'uv') specific = uvFindings(dependencies)
  if (definition.id === 'poetry') specific = await poetryFindings(cwd)
  if (definition.id === 'pipenv') specific = await pipenvFindings(cwd, dependencies)
  if (definition.id === 'conda') specific = await condaFindings(cwd, dependencies)
  return appendHealthFindings(base, [...common, ...specific])
}

async function commonPythonFindings(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthFinding[]> {
  const findings: ManagerHealthFinding[] = []
  const lockFiles = await findWorkspaceFiles(cwd, (name) => definition.lockFiles.includes(name), { maxDepth: 6 })
  if (lockFiles.length > 0) {
    for (const dependency of dependencies.filter((item) => item.direct && !item.resolvedVersion)) {
      findings.push(createHealthFinding(
        `unresolved-direct:${dependency.file}:${dependency.name}`,
        'warning',
        'Direct dependency has no lock resolution',
        `${dependency.name} is declared in ${dependency.file}, but no matching resolved package was found.`,
        { packageName: dependency.name, currentVersion: dependency.requestedVersion }
      ))
    }
  }
  for (const dependency of dependencies) {
    if (dependency.source?.toLowerCase().includes('http://')) {
      findings.push(createHealthFinding(
        `insecure-python-source:${dependency.file}:${dependency.name}`,
        'error',
        'Python dependency uses an insecure source',
        `${dependency.name} resolves through ${dependency.source}.`,
        { packageName: dependency.name, source: dependency.source }
      ))
    }
  }
  return [...findings, ...normalizedNameConflicts(definition.id, dependencies)]
}

function normalizedNameConflicts(
  managerId: DependencyManagerDefinition['id'],
  dependencies: ManagerDependency[]
): ManagerHealthFinding[] {
  const grouped = new Map<string, { names: Set<string>; versions: Set<string> }>()
  for (const dependency of dependencies) {
    const key = normalizePackageName(managerId, dependency.name)
    const group = grouped.get(key) || { names: new Set<string>(), versions: new Set<string>() }
    group.names.add(dependency.name)
    if (dependency.resolvedVersion || dependency.version) group.versions.add(dependency.resolvedVersion || dependency.version || '')
    grouped.set(key, group)
  }
  return [...grouped.entries()].flatMap(([name, group]) => group.versions.size > 1
    ? [createHealthFinding(
        `normalized-version-conflict:${name}`,
        'warning',
        `Multiple locked versions recorded for ${name}`,
        `${[...group.names].join(', ')} resolve to ${[...group.versions].join(', ')}.`,
        { packageName: name }
      )]
    : [])
}

function uvFindings(dependencies: ManagerDependency[]): ManagerHealthFinding[] {
  return dependencies.flatMap((dependency) => {
    const registryPackage = dependency.source?.startsWith('registry:')
    if (!registryPackage || dependency.integrity || dependency.direct) return []
    return [createHealthFinding(
      `uv-hash-missing:${dependency.file}:${dependency.name}:${dependency.version || ''}`,
      'warning',
      'uv lock artifact has no hash evidence',
      `${dependency.name} ${dependency.version || ''} has a registry source but no wheel or source hash.`,
      { packageName: dependency.name, currentVersion: dependency.version }
    )]
  })
}

async function poetryFindings(cwd: string): Promise<ManagerHealthFinding[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'poetry.lock', { maxDepth: 6 })
  const findings = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return undefined
    const metadata = getRecord(parseTomlDocument(content, file), 'metadata')
    if (asString(metadata?.['content-hash'])) return undefined
    return createHealthFinding(
      `poetry-content-hash-missing:${file}`,
      'warning',
      'Poetry lock content hash is missing',
      `${file} cannot be correlated with its pyproject.toml content.`
    )
  }))
  return findings.filter((finding): finding is ManagerHealthFinding => Boolean(finding))
}

async function pipenvFindings(
  cwd: string,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthFinding[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'Pipfile.lock', { maxDepth: 5 })
  const findings: ManagerHealthFinding[] = []
  for (const file of files) {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    const document = content ? parseJsonDocument(content, file) : undefined
    if (!asString(getRecord(document, '_meta', 'hash')?.sha256)) {
      findings.push(createHealthFinding(
        `pipenv-lock-hash-missing:${file}`,
        'warning',
        'Pipenv lock manifest hash is missing',
        `${file} cannot prove that it matches the Pipfile.`
      ))
    }
  }
  for (const dependency of dependencies.filter((item) => !item.direct && !item.integrity && !item.source?.startsWith('git'))) {
    findings.push(createHealthFinding(
      `pipenv-package-hash-missing:${dependency.file}:${dependency.name}`,
      'warning',
      'Pipenv package has no artifact hash',
      `${dependency.name} in ${dependency.file} has no hashes.`,
      { packageName: dependency.name, currentVersion: dependency.version }
    ))
  }
  return findings
}

async function condaFindings(
  cwd: string,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthFinding[]> {
  const findings = dependencies
    .filter((dependency) => dependency.type === 'pip-dependencies' && !dependency.resolvedVersion)
    .map((dependency) => createHealthFinding(
      `conda-pip-unlocked:${dependency.file}:${dependency.name}`,
      'warning',
      'Nested pip dependency is not locked',
      `${dependency.name} is declared under pip in ${dependency.file} without a conda-lock resolution.`,
      { packageName: dependency.name, currentVersion: dependency.requestedVersion }
    ))
  const files = await findWorkspaceFiles(
    cwd,
    (name) => name === 'environment.yml' || name === 'environment.yaml',
    { maxDepth: 5 }
  )
  for (const file of files) findings.push(...await condaChannelFindings(cwd, file))
  return findings
}

async function condaChannelFindings(cwd: string, file: string): Promise<ManagerHealthFinding[]> {
  const content = await readTextIfExists(join(cwd, ...file.split('/')))
  const document = content ? asRecord(parseYamlDocument(content, file)) : undefined
  return stringArray(document?.channels).flatMap((channel) => channel.toLowerCase().startsWith('http://')
    ? [createHealthFinding(
        `conda-insecure-channel:${file}:${channel}`,
        'error',
        'Conda channel uses insecure HTTP',
        `${file} declares ${channel}.`,
        { source: channel }
      )]
    : [])
}
