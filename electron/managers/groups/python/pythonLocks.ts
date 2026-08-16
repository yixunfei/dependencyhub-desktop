import { join } from 'path'
import type { LockedDependency } from '../../inventoryMerge'
import {
  asArray,
  asRecord,
  asString,
  parseJsonDocument,
  parseTomlDocument,
  parseYamlDocument,
  readTextIfExists,
  recordEntries,
  stringArray
} from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import type { PythonWorkspaceManagerId } from './pythonTypes'

export async function readPythonLocks(
  cwd: string,
  managerId: PythonWorkspaceManagerId
): Promise<LockedDependency[]> {
  if (managerId === 'uv') return await readTomlLocks(cwd, 'uv.lock', parseUvPackages)
  if (managerId === 'poetry') return await readTomlLocks(cwd, 'poetry.lock', parsePoetryPackages)
  if (managerId === 'pipenv') return await readPipenvLocks(cwd)
  return await readCondaLocks(cwd)
}

async function readTomlLocks(
  cwd: string,
  lockName: string,
  parser: (document: unknown, file: string) => LockedDependency[]
): Promise<LockedDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === lockName, { maxDepth: 6 })
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    return content ? parser(parseTomlDocument(content, file), file) : []
  }))
  return inventories.flat()
}

function parseUvPackages(document: unknown, file: string): LockedDependency[] {
  return asArray(asRecord(document)?.package).flatMap((value) => {
    const pkg = asRecord(value)
    const name = asString(pkg?.name)
    const version = asString(pkg?.version)
    if (!name || !version) return []
    const source = packageSource(pkg?.source)
    const hashes = artifactHashes(pkg)
    return [{
      name,
      version,
      file,
      source,
      integrity: hashes[0],
      metadata: compactMetadata({
        hashes: hashes.join(','),
        dependencyCount: asArray(pkg?.dependencies).length
      })
    }]
  })
}

function parsePoetryPackages(document: unknown, file: string): LockedDependency[] {
  return asArray(asRecord(document)?.package).flatMap((value) => {
    const pkg = asRecord(value)
    const name = asString(pkg?.name)
    const version = asString(pkg?.version)
    if (!name || !version) return []
    const category = asString(pkg?.category)
    const hashes = asArray(pkg?.files).flatMap((artifact) => stringArray(asRecord(artifact)?.hash))
    return [{
      name,
      version,
      file,
      scope: category === 'dev' ? 'development' : category || 'runtime',
      source: packageSource(pkg?.source),
      integrity: hashes[0],
      metadata: compactMetadata({
        hashes: hashes.join(','),
        optional: typeof pkg?.optional === 'boolean' ? pkg.optional : undefined,
        pythonVersions: asString(pkg?.['python-versions']),
        dependencyCount: recordEntries(pkg?.dependencies).length
      })
    }]
  })
}

async function readPipenvLocks(cwd: string): Promise<LockedDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'Pipfile.lock', { maxDepth: 5 })
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return []
    const document = asRecord(parseJsonDocument(content, file))
    return [
      ...pipenvLockSection(document?.default, 'runtime', file),
      ...pipenvLockSection(document?.develop, 'development', file)
    ]
  }))
  return inventories.flat()
}

function pipenvLockSection(value: unknown, scope: string, file: string): LockedDependency[] {
  return recordEntries(value).map(([name, dependency]) => {
    const record = asRecord(dependency)
    const hashes = stringArray(record?.hashes)
    return {
      name,
      version: asString(record?.version)?.replace(/^===?/, ''),
      file,
      scope,
      source: asString(record?.index) || asString(record?.git) || asString(record?.path) || asString(record?.file),
      integrity: hashes[0],
      metadata: compactMetadata({
        hashes: hashes.join(','),
        markers: asString(record?.markers)
      })
    }
  })
}

async function readCondaLocks(cwd: string): Promise<LockedDependency[]> {
  const files = await findWorkspaceFiles(
    cwd,
    (name) => name === 'conda-lock.yml' || name === 'conda-lock.yaml',
    { maxDepth: 5 }
  )
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return []
    const document = asRecord(parseYamlDocument(content, file))
    return asArray(document?.package).flatMap((value) => condaLockPackage(value, file))
  }))
  return inventories.flat()
}

function condaLockPackage(value: unknown, file: string): LockedDependency[] {
  const pkg = asRecord(value)
  const name = asString(pkg?.name)
  if (!name) return []
  const hash = asRecord(pkg?.hash)
  const manager = asString(pkg?.manager) || 'conda'
  return [{
    name,
    version: asString(pkg?.version),
    file,
    scope: asString(pkg?.category) || (manager === 'pip' ? 'pip' : 'runtime'),
    source: asString(pkg?.url) || asString(pkg?.channel),
    integrity: asString(hash?.sha256) || asString(hash?.md5) || asString(pkg?.hash),
    metadata: compactMetadata({
      manager,
      platform: asString(pkg?.platform),
      build: asString(pkg?.build),
      dependencyCount: recordEntries(pkg?.dependencies).length
    })
  }]
}

function artifactHashes(pkg: Record<string, unknown> | undefined): string[] {
  const artifacts = [...asArray(pkg?.wheels), ...asArray(pkg?.sdist)]
  return artifacts.flatMap((artifact) => stringArray(asRecord(artifact)?.hash))
}

function packageSource(value: unknown): string | undefined {
  const record = asRecord(value)
  if (!record) return asString(value)
  const entry = recordEntries(record).find(([, source]) => asString(source))
  return entry ? `${entry[0]}:${asString(entry[1])}` : undefined
}

function compactMetadata(
  values: Record<string, string | number | boolean | undefined>
): Record<string, string | number | boolean> | undefined {
  const entries = Object.entries(values).filter((entry): entry is [string, string | number | boolean] => (
    entry[1] !== undefined && entry[1] !== ''
  ))
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
