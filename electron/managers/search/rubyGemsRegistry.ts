import type { DependencyManagerId } from '../../../shared/managerRegistry'
import type { ManagerSearchQuery, ManagerSearchResult } from '../../../shared/managerWorkspace'
import { asArray, asRecord, asString, stringArray } from '../structuredData'
import { fetchJson } from './http'
import { registryEndpoint } from './registryUrl'

const DEFAULT_RUBYGEMS = 'https://rubygems.org'

export async function searchRubyGemsRegistry(
  _cwd: string | undefined,
  managerId: DependencyManagerId,
  query: ManagerSearchQuery
): Promise<ManagerSearchResult[]> {
  if (managerId !== 'bundler') throw new Error(`RubyGems search does not support ${managerId}`)
  const registry = query.registry || DEFAULT_RUBYGEMS
  const endpoint = registryEndpoint(registry, 'api/v1/search.json')
  endpoint.searchParams.set('query', query.text)
  const response = await fetchJson<unknown>(endpoint.toString())
  return asArray(response).slice(0, query.limit || 25).flatMap((value) => {
    const item = asRecord(value)
    const name = asString(item?.name)
    if (!name) return []
    return [{
      managerId,
      name,
      version: asString(item?.version),
      description: asString(item?.info),
      source: asString(item?.gem_uri) || `https://rubygems.org/gems/${encodeURIComponent(name)}`,
      homepage: asString(item?.homepage_uri) || asString(item?.source_code_uri) || asString(item?.project_uri),
      license: stringArray(item?.licenses).join(', ') || undefined,
      metadata: {
        authors: asString(item?.authors) || '',
        downloads: Number(item?.downloads || 0),
        versionDownloads: Number(item?.version_downloads || 0)
      }
    } satisfies ManagerSearchResult]
  })
}
