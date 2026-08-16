import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthFinding, ManagerHealthReport } from '../../../../shared/managerWorkspace'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'
import { analyzeManagerHealth } from '../../staticHealth'
import {
  asArray,
  asRecord,
  asString,
  parseJsonDocument,
  parseXmlDocument,
  readTextIfExists
} from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import { assertBackendWorkspaceManager } from './backendTypes'

export async function analyzeBackendManagerHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  assertBackendWorkspaceManager(definition.id)
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const common = await commonBackendFindings(cwd, definition, dependencies)
  let specific: ManagerHealthFinding[] = []
  if (definition.id === 'nuget') specific = await nugetFindings(cwd, dependencies)
  if (definition.id === 'composer') specific = await composerFindings(cwd)
  if (definition.id === 'bundler') specific = await bundlerFindings(cwd, dependencies)
  return appendHealthFindings(base, [...common, ...specific])
}

async function commonBackendFindings(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthFinding[]> {
  const findings: ManagerHealthFinding[] = []
  const lockFiles = await findWorkspaceFiles(cwd, (name) => definition.lockFiles.includes(name), { maxDepth: 8 })
  if (lockFiles.length > 0) {
    for (const dependency of dependencies.filter((item) => item.direct && !item.resolvedVersion && item.scope !== 'platform')) {
      findings.push(createHealthFinding(
        `backend-unresolved-direct:${dependency.file}:${dependency.name}`,
        'warning',
        'Direct dependency has no lock resolution',
        `${dependency.name} is declared in ${dependency.file}, but no matching lock entry was found.`,
        { packageName: dependency.name, currentVersion: dependency.requestedVersion }
      ))
    }
  }
  for (const dependency of dependencies.filter((item) => item.source?.toLowerCase().includes('http://'))) {
    findings.push(createHealthFinding(
      `backend-insecure-source:${dependency.file}:${dependency.name}`,
      'error',
      'Dependency source uses insecure HTTP',
      `${dependency.name} resolves through ${dependency.source}.`,
      { packageName: dependency.name, source: dependency.source }
    ))
  }
  return findings
}

async function nugetFindings(
  cwd: string,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthFinding[]> {
  const findings = dependencies
    .filter((dependency) => dependency.file.endsWith('packages.lock.json') && !dependency.integrity)
    .map((dependency) => createHealthFinding(
      `nuget-content-hash-missing:${dependency.file}:${dependency.name}:${dependency.version || ''}`,
      'warning',
      'NuGet lock entry has no content hash',
      `${dependency.name} ${dependency.version || ''} in ${dependency.file} lacks contentHash evidence.`,
      { packageName: dependency.name, currentVersion: dependency.version }
    ))
  const configs = await findWorkspaceFiles(
    cwd,
    (name) => name.toLowerCase() === 'nuget.config',
    { maxDepth: 5 }
  )
  for (const file of configs) findings.push(...await nugetSourceFindings(cwd, file))
  return findings
}

async function nugetSourceFindings(cwd: string, file: string): Promise<ManagerHealthFinding[]> {
  const content = await readTextIfExists(join(cwd, ...file.split('/')))
  const document = content ? parseXmlDocument(content, file) : undefined
  return collectXmlAdds(document).flatMap((source) => source.toLowerCase().startsWith('http://')
    ? [createHealthFinding(
        `nuget-insecure-source:${file}:${source}`,
        'error',
        'NuGet package source uses insecure HTTP',
        `${file} declares ${source}.`,
        { source }
      )]
    : [])
}

function collectXmlAdds(value: unknown): string[] {
  const sources: string[] = []
  const visit = (current: unknown, insideSources: boolean) => {
    if (Array.isArray(current)) {
      current.forEach((child) => visit(child, insideSources))
      return
    }
    const record = asRecord(current)
    if (!record) return
    if (insideSources) {
      for (const add of asArray(record.add)) {
        const source = asString(asRecord(add)?.['@_value'])
        if (source) sources.push(source)
      }
    }
    for (const [key, child] of Object.entries(record)) {
      visit(child, insideSources || key.toLowerCase() === 'packagesources')
    }
  }
  visit(value, false)
  return [...new Set(sources)]
}

async function composerFindings(cwd: string): Promise<ManagerHealthFinding[]> {
  const findings: ManagerHealthFinding[] = []
  const lockContent = await readTextIfExists(join(cwd, 'composer.lock'))
  if (lockContent) {
    const lock = asRecord(parseJsonDocument(lockContent, 'composer.lock'))
    if (!asString(lock?.['content-hash'])) {
      findings.push(createHealthFinding(
        'composer-content-hash-missing',
        'warning',
        'Composer lock content hash is missing',
        'composer.lock cannot prove that it matches composer.json.'
      ))
    }
  }
  const manifestContent = await readTextIfExists(join(cwd, 'composer.json'))
  if (manifestContent) {
    const manifest = asRecord(parseJsonDocument(manifestContent, 'composer.json'))
    findings.push(...composerRepositoryFindings(manifest?.repositories))
  }
  return findings
}

function composerRepositoryFindings(value: unknown): ManagerHealthFinding[] {
  const repositories = Array.isArray(value)
    ? value
    : Object.values(asRecord(value) || {})
  return repositories.flatMap((repository, index) => {
    const url = asString(asRecord(repository)?.url)
    if (!url?.toLowerCase().startsWith('http://')) return []
    return [createHealthFinding(
      `composer-insecure-repository:${index}:${url}`,
      'error',
      'Composer repository uses insecure HTTP',
      `composer.json declares ${url}.`,
      { source: url }
    )]
  })
}

async function bundlerFindings(
  cwd: string,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthFinding[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'Gemfile.lock', { maxDepth: 5 })
  const findings: ManagerHealthFinding[] = []
  for (const file of files) {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) continue
    if (!/^BUNDLED WITH\s*$/m.test(content)) {
      findings.push(createHealthFinding(
        `bundler-version-missing:${file}`,
        'warning',
        'Bundler version is not pinned in the lockfile',
        `${file} has no BUNDLED WITH section.`
      ))
    }
    if (/^CHECKSUMS\s*$/m.test(content)) findings.push(...missingBundlerChecksums(file, dependencies))
  }
  return findings
}

function missingBundlerChecksums(
  file: string,
  dependencies: ManagerDependency[]
): ManagerHealthFinding[] {
  return dependencies
    .filter((dependency) => dependency.file === file && !dependency.integrity && dependency.source?.startsWith('https://'))
    .map((dependency) => createHealthFinding(
      `bundler-checksum-missing:${file}:${dependency.name}:${dependency.version || ''}`,
      'warning',
      'Bundler lock entry has no checksum',
      `${dependency.name} ${dependency.version || ''} is absent from the CHECKSUMS section.`,
      { packageName: dependency.name, currentVersion: dependency.version }
    ))
}
