import type { DependencyManagerId } from '../../../shared/managerRegistry'
import type { ManagerSearchQuery, ManagerSearchResult } from '../../../shared/managerWorkspace'
import { asArray, asRecord, asString, stringArray } from '../structuredData'
import { fetchJson } from './http'
import { registryEndpoint } from './registryUrl'

const DEFAULT_ANACONDA_API = 'https://api.anaconda.org'

export async function searchCondaRegistry(
  _cwd: string | undefined,
  managerId: DependencyManagerId,
  query: ManagerSearchQuery
): Promise<ManagerSearchResult[]> {
  if (managerId !== 'conda') throw new Error(`Conda registry search does not support ${managerId}`)
  const registry = query.registry || DEFAULT_ANACONDA_API
  const endpoint = registryEndpoint(registry, 'search')
  endpoint.searchParams.set('q', query.text)
  endpoint.searchParams.set('package_type', 'conda')
  const response = await fetchJson<unknown>(endpoint.toString())
  return asArray(response).slice(0, query.limit || 25).flatMap((value) => {
    const item = asRecord(value)
    const name = asString(item?.name) || asString(item?.full_name)?.split('/').at(-1)
    if (!name) return []
    const fullName = asString(item?.full_name) || name
    return [{
      managerId,
      name,
      version: asString(item?.latest_version) || asString(item?.version),
      description: asString(item?.summary) || asString(item?.description),
      source: asString(item?.url) || `https://anaconda.org/${fullName}`,
      homepage: asString(item?.home) || asString(item?.dev_url) || asString(item?.doc_url),
      license: asString(item?.license),
      metadata: {
        owner: asString(item?.owner) || fullName.split('/')[0] || '',
        downloads: Number(item?.ndownloads || item?.downloads || 0),
        packageTypes: stringArray(item?.package_types).join(',')
      }
    } satisfies ManagerSearchResult]
  })
}
