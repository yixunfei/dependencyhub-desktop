import { join } from 'path'
import type { DependencyManagerId } from '../../../shared/managerRegistry'
import type { ManagerSearchQuery, ManagerSearchResult } from '../../../shared/managerWorkspace'
import {
  asArray,
  asRecord,
  asString,
  getRecord,
  parseTomlDocument,
  readTextIfExists
} from '../structuredData'
import { fetchJson } from './http'
import { normalizeRegistryUrl, registryEndpoint } from './registryUrl'

const DEFAULT_PYPI = 'https://pypi.org'
const SUPPORTED_MANAGERS = new Set<DependencyManagerId>(['uv', 'poetry', 'pipenv'])

interface PypiPackageResponse {
  info?: Record<string, unknown>
  releases?: Record<string, unknown>
  urls?: Array<Record<string, unknown>>
}

export async function searchPypiRegistry(
  cwd: string | undefined,
  managerId: DependencyManagerId,
  query: ManagerSearchQuery
): Promise<ManagerSearchResult[]> {
  if (!SUPPORTED_MANAGERS.has(managerId)) throw new Error(`PyPI search does not support ${managerId}`)
  const packageName = query.text.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(packageName)) return []
  const configured = query.registry || await projectPythonRegistry(cwd, managerId) || DEFAULT_PYPI
  const registry = pythonRegistryApiBase(configured)
  const endpoint = registryEndpoint(registry, `pypi/${encodeURIComponent(packageName)}/json`)
  let response: PypiPackageResponse
  try {
    response = await fetchJson<PypiPackageResponse>(endpoint.toString())
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP 404')) return []
    throw error
  }
  const info = asRecord(response.info)
  const name = asString(info?.name) || packageName
  const version = asString(info?.version)
  const projectUrls = asRecord(info?.project_urls)
  return [{
    managerId,
    name,
    version,
    description: asString(info?.summary),
    source: asString(info?.package_url) || registryEndpoint(registry, `project/${encodeURIComponent(name)}`).toString(),
    homepage: asString(info?.home_page) || firstUrl(projectUrls),
    license: asString(info?.license_expression) || asString(info?.license),
    metadata: {
      author: asString(info?.author) || asString(info?.maintainer) || '',
      releaseCount: Object.keys(response.releases || {}).length,
      requiresPython: asString(info?.requires_python) || '',
      uploadedAt: latestUpload(response.urls) || ''
    }
  }]
}

async function projectPythonRegistry(
  cwd: string | undefined,
  managerId: DependencyManagerId
): Promise<string | undefined> {
  if (!cwd) return undefined
  const file = managerId === 'pipenv' ? 'Pipfile' : 'pyproject.toml'
  const content = await readTextIfExists(join(cwd, file))
  if (!content) return undefined
  const document = parseTomlDocument(content, file)
  if (managerId === 'pipenv') return sourceUrl(asRecord(document)?.source)
  if (managerId === 'poetry') return sourceUrl(getRecord(document, 'tool', 'poetry')?.source)
  const uv = getRecord(document, 'tool', 'uv')
  return sourceUrl(uv?.index) || asString(uv?.['index-url'])
}

function sourceUrl(value: unknown): string | undefined {
  const sources = asArray(value).map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
  const preferred = sources.find((source) => source.default === true || source.primary === true || source.priority === 'primary')
  return asString((preferred || sources[0])?.url)
}

function pythonRegistryApiBase(value: string): string {
  const normalized = normalizeRegistryUrl(value)
  return normalized.replace(/\/simple(?:\/.*)?$/i, '')
}

function firstUrl(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) return undefined
  return Object.values(value).map(asString).find((item): item is string => Boolean(item))
}

function latestUpload(urls: Array<Record<string, unknown>> | undefined): string | undefined {
  return (urls || [])
    .map((item) => asString(item.upload_time_iso_8601) || asString(item.upload_time))
    .filter((item): item is string => Boolean(item))
    .sort()
    .at(-1)
}
