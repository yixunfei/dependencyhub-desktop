import type { DependencyManagerId } from '../../../shared/managerRegistry'
import type { ManagerSearchQuery, ManagerSearchResult } from '../../../shared/managerWorkspace'
import { asRecord, asString } from '../structuredData'
import { fetchJson } from './http'
import { registryEndpoint } from './registryUrl'

const DEFAULT_PACKAGIST = 'https://packagist.org'

interface PackagistSearchResponse {
  results?: Array<Record<string, unknown>>
}

export async function searchPackagistRegistry(
  _cwd: string | undefined,
  managerId: DependencyManagerId,
  query: ManagerSearchQuery
): Promise<ManagerSearchResult[]> {
  if (managerId !== 'composer') throw new Error(`Packagist search does not support ${managerId}`)
  const registry = query.registry || DEFAULT_PACKAGIST
  const endpoint = registryEndpoint(registry, 'search.json')
  endpoint.searchParams.set('q', query.text)
  endpoint.searchParams.set('per_page', String(query.limit || 25))
  const response = await fetchJson<PackagistSearchResponse>(endpoint.toString())
  return (response.results || []).flatMap((value) => {
    const item = asRecord(value)
    const name = asString(item?.name)
    if (!name) return []
    return [{
      managerId,
      name,
      description: asString(item?.description),
      source: asString(item?.url) || `https://packagist.org/packages/${name}`,
      homepage: asString(item?.repository),
      metadata: {
        downloads: Number(item?.downloads || 0),
        favorites: Number(item?.favers || 0)
      }
    } satisfies ManagerSearchResult]
  })
}
