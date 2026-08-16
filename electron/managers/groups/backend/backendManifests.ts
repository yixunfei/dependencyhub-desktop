import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import {
  asArray,
  asRecord,
  asString,
  parseJsonDocument,
  parseXmlDocument,
  readTextIfExists,
  recordEntries
} from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import type { BackendWorkspaceManagerId } from './backendTypes'

export async function readBackendManifests(
  cwd: string,
  managerId: BackendWorkspaceManagerId
): Promise<ManagerDependency[]> {
  if (managerId === 'nuget') return await readNugetManifests(cwd)
  if (managerId === 'composer') return await readComposerManifest(cwd)
  return await readBundlerManifests(cwd)
}

async function readNugetManifests(cwd: string): Promise<ManagerDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => (
    /\.(?:cs|fs|vb)proj$/i.test(name) || name === 'Directory.Packages.props' || name === 'packages.config'
  ))
  const parsed = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    return content ? { file, document: parseXmlDocument(content, file) } : undefined
  }))
  const documents = parsed.filter((item): item is { file: string; document: unknown } => Boolean(item))
  const centralVersions = new Map<string, string>()
  for (const item of documents.filter(({ file }) => file.endsWith('Directory.Packages.props'))) {
    for (const node of collectNamedNodes(item.document, 'PackageVersion')) {
      const name = xmlProperty(node, 'Include') || xmlProperty(node, 'Update')
      const version = xmlProperty(node, 'Version')
      if (name && version) centralVersions.set(name.toLowerCase(), version)
    }
  }
  return uniqueDependencies(documents.flatMap(({ file, document }) => (
    file.endsWith('packages.config')
      ? packagesConfigDependencies(document, file)
      : projectDependencies(document, file, centralVersions)
  )))
}

function projectDependencies(
  document: unknown,
  file: string,
  centralVersions: ReadonlyMap<string, string>
): ManagerDependency[] {
  const references = collectNamedNodes(document, 'PackageReference').flatMap((node) => {
    const name = xmlProperty(node, 'Include') || xmlProperty(node, 'Update')
    if (!name) return []
    const requestedVersion = xmlProperty(node, 'VersionOverride')
      || xmlProperty(node, 'Version')
      || centralVersions.get(name.toLowerCase())
    return [nugetDependency(name, requestedVersion, 'PackageReference', file, {
      privateAssets: xmlProperty(node, 'PrivateAssets'),
      includeAssets: xmlProperty(node, 'IncludeAssets'),
      condition: xmlProperty(node, 'Condition')
    })]
  })
  const central = collectNamedNodes(document, 'PackageVersion').flatMap((node) => {
    const name = xmlProperty(node, 'Include') || xmlProperty(node, 'Update')
    return name ? [nugetDependency(name, xmlProperty(node, 'Version'), 'CentralPackageVersion', file)] : []
  })
  return [...references, ...central]
}

function packagesConfigDependencies(document: unknown, file: string): ManagerDependency[] {
  return collectNamedNodes(document, 'package').flatMap((node) => {
    const name = xmlProperty(node, 'id')
    if (!name) return []
    return [nugetDependency(name, xmlProperty(node, 'version'), 'packages.config', file, {
      targetFramework: xmlProperty(node, 'targetFramework'),
      developmentDependency: xmlProperty(node, 'developmentDependency')
    })]
  })
}

function nugetDependency(
  name: string,
  requestedVersion: string | undefined,
  type: string,
  file: string,
  metadata: Record<string, string | undefined> = {}
): ManagerDependency {
  return {
    managerId: 'nuget',
    name,
    version: requestedVersion,
    requestedVersion,
    type,
    scope: metadata.developmentDependency === 'true' || metadata.privateAssets === 'all' ? 'development' : 'runtime',
    file,
    direct: true,
    metadata: definedMetadata(metadata)
  }
}

async function readComposerManifest(cwd: string): Promise<ManagerDependency[]> {
  const file = 'composer.json'
  const content = await readTextIfExists(join(cwd, file))
  if (!content) return []
  const document = asRecord(parseJsonDocument(content, file))
  return [
    ...composerSection(document?.require, 'require', 'runtime', file),
    ...composerSection(document?.['require-dev'], 'require-dev', 'development', file)
  ]
}

function composerSection(value: unknown, type: string, scope: string, file: string): ManagerDependency[] {
  return recordEntries(value).map(([name, version]) => ({
    managerId: 'composer' as const,
    name,
    version: asString(version),
    requestedVersion: asString(version),
    type,
    scope: isComposerPlatformPackage(name) ? 'platform' : scope,
    file,
    direct: true
  }))
}

async function readBundlerManifests(cwd: string): Promise<ManagerDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'Gemfile' || name.endsWith('.gemspec'), { maxDepth: 5 })
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return []
    return file.endsWith('.gemspec') ? parseGemspec(content, file) : parseGemfile(content, file)
  }))
  return uniqueDependencies(inventories.flat())
}

function parseGemfile(content: string, file: string): ManagerDependency[] {
  const dependencies: ManagerDependency[] = []
  let group = 'runtime'
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim()
    const groupMatch = line.match(/^group\s+(.+?)\s+do$/)
    if (groupMatch) group = groupMatch[1].replace(/:/g, '').split(',')[0].trim() || 'runtime'
    if (line === 'end') group = 'runtime'
    const match = line.match(/^gem\s+['"]([^'"]+)['"](.*)$/)
    if (!match) continue
    const versions = [...match[2].matchAll(/,\s*['"]([^'"]+)['"]/g)].map((item) => item[1])
    const source = match[2].match(/\b(?:git|path|source):\s*['"]([^'"]+)['"]/)?.[1]
    dependencies.push(bundlerDependency(match[1], versions.join(', ') || undefined, 'Gemfile', group, file, source))
  }
  return dependencies
}

function parseGemspec(content: string, file: string): ManagerDependency[] {
  return content.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.replace(/\s+#.*$/, '').trim()
    const match = line.match(/(?:add_(development_|runtime_)?dependency)\s*\(?\s*['"]([^'"]+)['"](.*)$/)
    if (!match) return []
    const versions = [...match[3].matchAll(/,\s*['"]([^'"]+)['"]/g)].map((item) => item[1])
    const scope = match[1] === 'development_' ? 'development' : 'runtime'
    return [bundlerDependency(match[2], versions.join(', ') || undefined, 'gemspec', scope, file)]
  })
}

function bundlerDependency(
  name: string,
  requestedVersion: string | undefined,
  type: string,
  scope: string,
  file: string,
  source?: string
): ManagerDependency {
  return {
    managerId: 'bundler',
    name,
    version: requestedVersion,
    requestedVersion,
    type,
    scope,
    source,
    file,
    direct: true
  }
}

function collectNamedNodes(value: unknown, expectedName: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []
  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    const record = asRecord(current)
    if (!record) return
    for (const [name, child] of Object.entries(record)) {
      if (name.toLowerCase() === expectedName.toLowerCase()) {
        nodes.push(...asArray(child).map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)))
      }
      visit(child)
    }
  }
  visit(value)
  return nodes
}

function xmlProperty(node: Record<string, unknown>, property: string): string | undefined {
  const entry = Object.entries(node).find(([name]) => (
    name.toLowerCase() === property.toLowerCase() || name.toLowerCase() === `@_${property}`.toLowerCase()
  ))
  return asString(entry?.[1])
}

function isComposerPlatformPackage(name: string): boolean {
  return !name.includes('/') || /^(?:php|hhvm|ext-|lib-|composer-plugin-api$|composer-runtime-api$)/i.test(name)
}

function definedMetadata(values: Record<string, string | undefined>): Record<string, string> | undefined {
  const entries = Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]))
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function uniqueDependencies(dependencies: ManagerDependency[]): ManagerDependency[] {
  const seen = new Set<string>()
  return dependencies.filter((dependency) => {
    const key = [dependency.managerId, dependency.file, dependency.type, dependency.name, dependency.requestedVersion || ''].join('\u0000')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
