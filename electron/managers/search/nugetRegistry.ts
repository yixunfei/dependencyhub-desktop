import { join } from 'path'
import type { DependencyManagerId } from '../../../shared/managerRegistry'
import type { ManagerSearchQuery, ManagerSearchResult } from '../../../shared/managerWorkspace'
import { asArray, asRecord, asString, parseXmlDocument, readTextIfExists, stringArray } from '../structuredData'
import { fetchJson } from './http'
import { normalizeRegistryUrl } from './registryUrl'

const DEFAULT_NUGET_SEARCH = 'https://azuresearch-usnc.nuget.org/query'

interface NugetSearchResponse {
  data?: Array<Record<string, unknown>>
}

export async function searchNugetRegistry(
  cwd: string | undefined,
  managerId: DependencyManagerId,
  query: ManagerSearchQuery
): Promise<ManagerSearchResult[]> {
  if (managerId !== 'nuget') throw new Error(`NuGet search does not support ${managerId}`)
  const configured = query.registry || await projectNugetRegistry(cwd)
  const searchService = configured ? await resolveSearchService(configured) : DEFAULT_NUGET_SEARCH
  const endpoint = new URL(normalizeRegistryUrl(searchService))
  endpoint.searchParams.set('q', query.text)
  endpoint.searchParams.set('take', String(query.limit || 25))
  endpoint.searchParams.set('prerelease', 'false')
  const response = await fetchJson<NugetSearchResponse>(endpoint.toString())
  return (response.data || []).flatMap((item) => {
    const name = asString(item.id)
    if (!name) return []
    return [{
      managerId,
      name,
      version: asString(item.version),
      description: asString(item.description) || asString(item.summary),
      source: asString(item.registration) || `https://www.nuget.org/packages/${encodeURIComponent(name)}`,
      homepage: asString(item.projectUrl),
      license: asString(item.licenseExpression) || asString(item.licenseUrl),
      metadata: {
        authors: stringArray(item.authors).join(','),
        downloads: Number(item.totalDownloads || 0),
        verified: item.verified === true,
        tags: stringArray(item.tags).join(',')
      }
    } satisfies ManagerSearchResult]
  })
}

async function resolveSearchService(registry: string): Promise<string> {
  const normalized = normalizeRegistryUrl(registry)
  if (!/\/index\.json$/i.test(new URL(normalized).pathname)) return normalized
  const index = asRecord(await fetchJson<unknown>(normalized))
  const resource = asArray(index?.resources).map(asRecord).find((item) => {
    return stringArray(item?.['@type']).some((value) => (
      value.split(';').some((part) => part.trim().startsWith('SearchQueryService'))
    ))
  })
  const endpoint = asString(resource?.['@id'])
  if (!endpoint) throw new Error('NuGet service index does not expose SearchQueryService')
  return normalizeRegistryUrl(endpoint)
}

async function projectNugetRegistry(cwd: string | undefined): Promise<string | undefined> {
  if (!cwd) return undefined
  for (const file of ['NuGet.config', 'nuget.config']) {
    const content = await readTextIfExists(join(cwd, file))
    if (!content) continue
    const document = parseXmlDocument(content, file)
    const source = findPackageSource(document)
    if (source) return source
  }
  return undefined
}

function findPackageSource(value: unknown): string | undefined {
  const visit = (current: unknown, insideSources: boolean): string | undefined => {
    if (Array.isArray(current)) {
      for (const child of current) {
        const found = visit(child, insideSources)
        if (found) return found
      }
      return undefined
    }
    const record = asRecord(current)
    if (!record) return undefined
    if (insideSources) {
      for (const add of asArray(record.add)) {
        const url = asString(asRecord(add)?.['@_value'])
        if (url) return url
      }
    }
    for (const [key, child] of Object.entries(record)) {
      const found = visit(child, insideSources || key.toLowerCase() === 'packagesources')
      if (found) return found
    }
    return undefined
  }
  return visit(value, false)
}
