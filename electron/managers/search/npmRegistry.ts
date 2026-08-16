import { readFile } from 'fs/promises'
import { join } from 'path'
import type { DependencyManagerId } from '../../../shared/managerRegistry'
import type {
  ManagerSearchQuery,
  ManagerSearchResult
} from '../../../shared/managerWorkspace'
import { fetchJson } from './http'
import { normalizeRegistryUrl } from './registryUrl'

interface NpmSearchResponse {
  objects?: Array<{
    package?: {
      name?: string
      version?: string
      description?: string
      links?: { homepage?: string; npm?: string; repository?: string }
      publisher?: { username?: string }
      date?: string
    }
    score?: { final?: number }
  }>
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org'

export async function searchNpmRegistry(
  cwd: string | undefined,
  managerId: DependencyManagerId,
  query: ManagerSearchQuery
): Promise<ManagerSearchResult[]> {
  if (managerId !== 'pnpm' && managerId !== 'yarn' && managerId !== 'bun') {
    throw new Error(`npm registry search does not support ${managerId}`)
  }
  const registry = normalizeRegistry(
    query.registry || await projectRegistry(cwd, packageScope(query.text)) || DEFAULT_REGISTRY
  )
  const endpoint = new URL('/-/v1/search', `${registry}/`)
  endpoint.searchParams.set('text', query.text)
  endpoint.searchParams.set('size', String(query.limit || 25))
  const response = await fetchJson<NpmSearchResponse>(endpoint.toString())
  return (response.objects || []).flatMap((entry) => {
    const item = entry.package
    if (!item?.name) return []
    return [{
      managerId,
      name: item.name,
      version: item.version,
      description: item.description,
      source: item.links?.npm || `${registry}/${encodePackageName(item.name)}`,
      homepage: item.links?.homepage || item.links?.repository,
      metadata: {
        score: entry.score?.final || 0,
        publisher: item.publisher?.username || '',
        publishedAt: item.date || ''
      }
    } satisfies ManagerSearchResult]
  })
}

async function projectRegistry(cwd: string | undefined, scope: string | undefined): Promise<string | undefined> {
  if (!cwd) return undefined
  const npmrc = await readText(join(cwd, '.npmrc'))
  const scopedRegistry = scope
    ? npmrc.match(new RegExp(`^\\s*${escapeRegExp(scope)}:registry\\s*=\\s*(\\S+)\\s*$`, 'im'))?.[1]
    : undefined
  if (scopedRegistry) return scopedRegistry
  const npmRegistry = npmrc.match(/^\s*registry\s*=\s*(\S+)\s*$/im)?.[1]
  if (npmRegistry) return npmRegistry

  const yarnrc = await readText(join(cwd, '.yarnrc.yml'))
  const yarnRegistry = yarnrc.match(/^\s*npmRegistryServer\s*:\s*['"]?([^'"\s]+)['"]?\s*$/im)?.[1]
  if (yarnRegistry) return yarnRegistry

  const bunfig = await readText(join(cwd, 'bunfig.toml'))
  return bunfig.match(/^\s*registry\s*=\s*['"]([^'"]+)['"]\s*$/im)?.[1]
}

function normalizeRegistry(value: string): string {
  const url = new URL(normalizeRegistryUrl(value))
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

function packageScope(value: string): string | undefined {
  return value.trim().match(/^(@[^/\s]+)\//)?.[1]
}

function encodePackageName(name: string): string {
  return name.startsWith('@') ? name.replace('/', '%2f') : encodeURIComponent(name)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readText(path: string): Promise<string> {
  return await readFile(path, 'utf-8').catch(() => '')
}
