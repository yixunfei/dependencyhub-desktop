import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import {
  asArray,
  asRecord,
  asString,
  getRecord,
  parseTomlDocument,
  parseYamlDocument,
  readTextIfExists,
  recordEntries,
  stringArray
} from '../../structuredData'
import { findWorkspaceFiles } from '../../workspaceFiles'
import type { PythonWorkspaceManagerId } from './pythonTypes'

export async function readPythonManifests(
  cwd: string,
  managerId: PythonWorkspaceManagerId
): Promise<ManagerDependency[]> {
  if (managerId === 'pipenv') return await readPipfiles(cwd)
  if (managerId === 'conda') return await readCondaEnvironments(cwd)
  return await readPyprojects(cwd, managerId)
}

async function readPyprojects(
  cwd: string,
  managerId: 'uv' | 'poetry'
): Promise<ManagerDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'pyproject.toml', { maxDepth: 6 })
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return []
    const document = parseTomlDocument(content, file)
    return managerId === 'uv'
      ? uvManifestDependencies(document, file)
      : poetryManifestDependencies(document, file)
  }))
  return uniqueDirectDependencies(inventories.flat())
}

function uvManifestDependencies(document: unknown, file: string): ManagerDependency[] {
  return [
    ...pepProjectDependencies(document, 'uv', file),
    ...requirementList(getRecord(document, 'tool', 'uv')?.['dev-dependencies'], 'uv', 'tool.uv.dev-dependencies', 'development', file),
    ...dependencyGroups(document, 'uv', file)
  ]
}

function poetryManifestDependencies(document: unknown, file: string): ManagerDependency[] {
  const poetry = getRecord(document, 'tool', 'poetry')
  const groups = getRecord(poetry, 'group')
  const groupDependencies = recordEntries(groups).flatMap(([groupName, groupValue]) => (
    poetryDependencyTable(
      getRecord(groupValue, 'dependencies'),
      `tool.poetry.group.${groupName}.dependencies`,
      groupName === 'dev' ? 'development' : groupName,
      file
    )
  ))
  return [
    ...pepProjectDependencies(document, 'poetry', file),
    ...poetryDependencyTable(getRecord(poetry, 'dependencies'), 'tool.poetry.dependencies', 'runtime', file),
    ...poetryDependencyTable(getRecord(poetry, 'dev-dependencies'), 'tool.poetry.dev-dependencies', 'development', file),
    ...groupDependencies,
    ...dependencyGroups(document, 'poetry', file)
  ]
}

function pepProjectDependencies(
  document: unknown,
  managerId: 'uv' | 'poetry',
  file: string
): ManagerDependency[] {
  const project = getRecord(document, 'project')
  const dependencies = requirementList(project?.dependencies, managerId, 'project.dependencies', 'runtime', file)
  const optional = recordEntries(project?.['optional-dependencies']).flatMap(([group, value]) => (
    requirementList(value, managerId, `project.optional-dependencies.${group}`, group, file)
  ))
  return [...dependencies, ...optional]
}

function dependencyGroups(
  document: unknown,
  managerId: 'uv' | 'poetry',
  file: string
): ManagerDependency[] {
  return recordEntries(getRecord(document, 'dependency-groups')).flatMap(([group, value]) => (
    asArray(value).flatMap((item) => {
      const requirement = asString(item)
      return requirement
        ? requirementList([requirement], managerId, `dependency-groups.${group}`, group, file)
        : []
    })
  ))
}

function poetryDependencyTable(
  table: Record<string, unknown> | undefined,
  type: string,
  scope: string,
  file: string
): ManagerDependency[] {
  return recordEntries(table).flatMap(([name, value]) => {
    if (name.toLowerCase() === 'python') return []
    const record = asRecord(value)
    const requestedVersion = asString(value) || asString(record?.version) || '*'
    const source = asString(record?.source) || asString(record?.git) || asString(record?.url) || asString(record?.path)
    return [directDependency('poetry', name, requestedVersion, type, scope, file, source, {
      markers: asString(record?.markers),
      optional: typeof record?.optional === 'boolean' ? record.optional : undefined
    })]
  })
}

async function readPipfiles(cwd: string): Promise<ManagerDependency[]> {
  const files = await findWorkspaceFiles(cwd, (name) => name === 'Pipfile', { maxDepth: 5 })
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return []
    const document = parseTomlDocument(content, file)
    return [
      ...pipfileTable(getRecord(document, 'packages'), 'packages', 'runtime', file),
      ...pipfileTable(getRecord(document, 'dev-packages'), 'dev-packages', 'development', file)
    ]
  }))
  return uniqueDirectDependencies(inventories.flat())
}

function pipfileTable(
  table: Record<string, unknown> | undefined,
  type: string,
  scope: string,
  file: string
): ManagerDependency[] {
  return recordEntries(table).map(([name, value]) => {
    const record = asRecord(value)
    const requestedVersion = asString(value) || asString(record?.version) || '*'
    const source = asString(record?.index) || asString(record?.git) || asString(record?.path) || asString(record?.file)
    return directDependency('pipenv', name, requestedVersion, type, scope, file, source, {
      markers: asString(record?.markers),
      editable: typeof record?.editable === 'boolean' ? record.editable : undefined
    })
  })
}

async function readCondaEnvironments(cwd: string): Promise<ManagerDependency[]> {
  const files = await findWorkspaceFiles(
    cwd,
    (name) => name === 'environment.yml' || name === 'environment.yaml',
    { maxDepth: 5 }
  )
  const inventories = await Promise.all(files.map(async (file) => {
    const content = await readTextIfExists(join(cwd, ...file.split('/')))
    if (!content) return []
    const document = asRecord(parseYamlDocument(content, file))
    const channels = stringArray(document?.channels)
    return asArray(document?.dependencies).flatMap((value) => (
      condaEnvironmentEntry(value, file, channels)
    ))
  }))
  return uniqueDirectDependencies(inventories.flat())
}

function condaEnvironmentEntry(value: unknown, file: string, channels: string[]): ManagerDependency[] {
  const specification = asString(value)
  if (specification) {
    const parsed = parseCondaSpecification(specification)
    return [directDependency('conda', parsed.name, parsed.version, 'dependencies', 'runtime', file, parsed.channel, {
      build: parsed.build,
      channels: channels.join(',') || undefined
    })]
  }
  const pip = getRecord(value)?.pip
  return stringArray(pip).flatMap((item) => {
    const parsed = parsePythonRequirement(item)
    return parsed
      ? [directDependency('conda', parsed.name, parsed.version, 'pip-dependencies', 'pip', file, parsed.source)]
      : []
  })
}

function requirementList(
  value: unknown,
  managerId: 'uv' | 'poetry',
  type: string,
  scope: string,
  file: string
): ManagerDependency[] {
  return stringArray(value).flatMap((requirement) => {
    const parsed = parsePythonRequirement(requirement)
    if (!parsed) return []
    return [directDependency(managerId, parsed.name, parsed.version, type, scope, file, parsed.source, {
      extras: parsed.extras,
      markers: parsed.markers
    })]
  })
}

interface ParsedPythonRequirement {
  name: string
  version?: string
  extras?: string
  markers?: string
  source?: string
}

function parsePythonRequirement(value: string): ParsedPythonRequirement | undefined {
  const [requirementPart, ...markerParts] = value.split(';')
  const match = requirementPart.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[([^\]]+)\])?\s*(.*)$/)
  if (!match) return undefined
  const remainder = match[3].trim()
  const directUrl = remainder.match(/^@\s*(\S.*)$/)?.[1]
  return {
    name: match[1],
    version: directUrl ? `@ ${directUrl}` : remainder || '*',
    extras: match[2],
    markers: markerParts.join(';').trim() || undefined,
    source: directUrl
  }
}

function parseCondaSpecification(value: string): { name: string; version?: string; build?: string; channel?: string } {
  const [channel, packageSpec] = value.includes('::') ? value.split(/::(.+)/, 2) : [undefined, value]
  const match = packageSpec.trim().match(/^([^=<>!~\s]+)\s*(.*)$/)
  const rawVersion = match?.[2]?.trim()
  const exactMatch = rawVersion?.match(/^=(?!=)([^=]+?)(?:=(.+))?$/)
  return {
    name: match?.[1] || packageSpec.trim(),
    version: exactMatch?.[1]?.trim() || rawVersion || undefined,
    build: exactMatch?.[2]?.trim() || undefined,
    channel
  }
}

function directDependency(
  managerId: PythonWorkspaceManagerId,
  name: string,
  requestedVersion: string | undefined,
  type: string,
  scope: string,
  file: string,
  source?: string,
  metadataValues: Record<string, string | boolean | undefined> = {}
): ManagerDependency {
  return {
    managerId,
    name,
    version: requestedVersion,
    requestedVersion,
    type,
    scope,
    source,
    file,
    direct: true,
    metadata: definedMetadata(metadataValues)
  }
}

function definedMetadata(
  values: Record<string, string | boolean | undefined>
): Record<string, string | boolean> | undefined {
  const entries = Object.entries(values).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function uniqueDirectDependencies(dependencies: ManagerDependency[]): ManagerDependency[] {
  const seen = new Set<string>()
  return dependencies.filter((dependency) => {
    const key = [dependency.managerId, dependency.file, dependency.type, dependency.name, dependency.requestedVersion || ''].join('\u0000')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
