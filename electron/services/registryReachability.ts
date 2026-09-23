import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import { httpLimiter } from './concurrency'
import { cachedReport } from './reportCache'

export type RegistryEndpointKind = 'registry' | 'mirror' | 'proxy' | 'repository' | 'image-registry'
/**
 * `unauthorized` and `not-found` used to be reported as reachable: any HTTP
 * status below 500 counted as success, so a private feed that answered 401 —
 * the single most common "custom registry" failure — was rendered green.
 * `slow` distinguishes "answered, but only just" from "no answer at all".
 */
export type RegistryReachabilityStatus =
  | 'reachable'
  | 'unreachable'
  | 'unauthorized'
  | 'not-found'
  | 'slow'
  | 'unknown'
  | 'skipped'
export type RegistryReachabilityExportFormat = 'markdown' | 'json'

export interface RegistryEndpoint {
  id: string
  managerId?: DependencyManagerId
  name: string
  url: string
  normalizedUrl: string
  kind: RegistryEndpointKind
  sourceFile: string
  secure: boolean
  privateHost: boolean
}

export interface RegistryReachabilityResult extends RegistryEndpoint {
  status: RegistryReachabilityStatus
  checkedAt: string
  durationMs: number
  statusCode?: number
  message?: string
  redirectedUrl?: string
}

export interface RegistryReachabilitySummary {
  endpointCount: number
  reachable: number
  unreachable: number
  unknown: number
  skipped: number
  insecure: number
  privateHost: number
}

export interface RegistryReachabilityReport {
  generatedAt: string
  projectPath: string
  endpoints: RegistryEndpoint[]
  results: RegistryReachabilityResult[]
  summary: RegistryReachabilitySummary
}

export interface RegistryReachabilityExportResult {
  path: string
  format: RegistryReachabilityExportFormat
  generatedAt: string
  summary: RegistryReachabilitySummary
}

export interface RegistryReachabilityOptions {
  timeoutMs?: number
}

export type RegistryEndpointChecker = (
  endpoint: RegistryEndpoint,
  options: Required<RegistryReachabilityOptions>
) => Promise<Pick<RegistryReachabilityResult, 'status' | 'statusCode' | 'message' | 'redirectedUrl'>>

const REPORT_DIR = '.npmDesktopManager/reports'
/** Three seconds is below the round-trip time of most cross-region mirrors. */
const DEFAULT_TIMEOUT_MS = 6000
const RETRY_TIMEOUT_MS = 12000
const REPORT_CACHE_TTL_MS = 30_000

export class RegistryReachabilityService {
  private readonly checker: RegistryEndpointChecker
  /**
   * Cache scope for this instance. The report cache key omits the checker by
   * design (production shares one default checker across panels), but that
   * means an injected checker — a reachability probe mock in verification or
   * tests — would read and write the shared entry: a mock that reports every
   * endpoint as reachable leaked into a later instance that expected failures,
   * for the whole TTL window. Injected checkers therefore get a private scope.
   */
  private readonly cacheScope: string

  constructor(options: { checker?: RegistryEndpointChecker } = {}) {
    this.checker = options.checker || defaultEndpointChecker
    this.cacheScope = options.checker ? `injected-${randomUUID()}` : 'default'
  }

  async discover(cwd: string): Promise<RegistryEndpoint[]> {
    const root = resolve(cwd)
    const endpointGroups = await Promise.all([
      discoverNpm(root),
      discoverYarn(root),
      discoverPip(root),
      discoverMaven(root),
      discoverGradle(root),
      discoverNuget(root),
      discoverComposer(root),
      discoverCargo(root),
      discoverDocker(root),
      discoverHelm(root)
    ])
    return uniqueEndpoints(endpointGroups.flat())
  }

  async check(cwd: string, options: RegistryReachabilityOptions = {}): Promise<RegistryReachabilityReport> {
    const root = resolve(cwd)
    const checkOptions = {
      timeoutMs: normalizeTimeout(options.timeoutMs)
    }
    // HealthCenter, Readiness and several governance panels all probe the same
    // endpoints within a second of each other; probing once per burst keeps the
    // results consistent without hammering a private feed.
    return await cachedReport(
      `registryReachability:${this.cacheScope}:${root}:${checkOptions.timeoutMs}`,
      REPORT_CACHE_TTL_MS,
      async () => {
        const endpoints = await this.discover(root)
        const results = await httpLimiter.runAll(endpoints, (endpoint) => this.checkOne(endpoint, checkOptions))
        return {
          generatedAt: new Date().toISOString(),
          projectPath: root,
          endpoints,
          results,
          summary: summarize(results, endpoints)
        }
      }
    )
  }

  async exportMarkdown(cwd: string, options: RegistryReachabilityOptions = {}): Promise<RegistryReachabilityExportResult> {
    const report = await this.check(cwd, options)
    const path = join(resolve(cwd), REPORT_DIR, 'registry-reachability-report.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      summary: report.summary
    }
  }

  async exportJson(cwd: string, options: RegistryReachabilityOptions = {}): Promise<RegistryReachabilityExportResult> {
    const report = await this.check(cwd, options)
    const path = join(resolve(cwd), REPORT_DIR, 'registry-reachability-report.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      summary: report.summary
    }
  }

  private async checkOne(
    endpoint: RegistryEndpoint,
    options: Required<RegistryReachabilityOptions>
  ): Promise<RegistryReachabilityResult> {
    if (!/^https?:\/\//i.test(endpoint.url)) {
      return {
        ...endpoint,
        status: 'skipped',
        checkedAt: new Date().toISOString(),
        durationMs: 0,
        message: 'Only HTTP and HTTPS endpoints can be checked automatically.'
      }
    }

    const probe = await this.probeOnce(endpoint, options)
    // Running out of time on the first attempt proves nothing — the endpoint
    // may simply be far away. Confirm with a generous budget before reporting
    // it as broken, because "your registry is down" sends users down the wrong path.
    if (probe.status === 'slow' && options.timeoutMs < RETRY_TIMEOUT_MS) {
      const retried = await this.probeOnce(endpoint, { timeoutMs: RETRY_TIMEOUT_MS })
      if (CONCLUSIVE_STATUSES.has(retried.status)) return retried
    }
    return probe
  }

  private async probeOnce(
    endpoint: RegistryEndpoint,
    options: Required<RegistryReachabilityOptions>
  ): Promise<RegistryReachabilityResult> {
    const startedAt = Date.now()
    try {
      const result = await this.checker(endpoint, options)
      return {
        ...endpoint,
        ...result,
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt
      }
    } catch (error: any) {
      return {
        ...endpoint,
        status: 'unreachable',
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        message: error?.message || String(error)
      }
    }
  }
}

/** Statuses that say something real about the endpoint, unlike a timing accident. */
const CONCLUSIVE_STATUSES = new Set<RegistryReachabilityStatus>([
  'reachable',
  'unreachable',
  'unauthorized',
  'not-found'
])

/** Statuses that mean "this endpoint cannot currently serve a package". */
const FAILING_STATUSES = new Set<RegistryReachabilityStatus>([
  'unreachable',
  'unauthorized',
  'not-found'
])

async function discoverNpm(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  for (const file of ['.npmrc', '.pnpmrc']) {
    const text = await readOptional(join(cwd, file))
    if (!text) continue
    for (const { key, value } of parseKeyValueLines(text)) {
      if (key.endsWith('registry') || key.includes(':registry')) {
        endpoints.push(endpoint('npm', 'npm registry', value, 'registry', file))
      }
    }
  }

  const packageJson = parseJson(await readOptional(join(cwd, 'package.json')))
  const publishRegistry = packageJson?.publishConfig?.registry
  if (typeof publishRegistry === 'string') {
    endpoints.push(endpoint('npm', 'npm publish registry', publishRegistry, 'registry', 'package.json'))
  }
  return endpoints
}

async function discoverYarn(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  const text = await readOptional(join(cwd, '.yarnrc.yml')) || await readOptional(join(cwd, '.yarnrc'))
  if (!text) return endpoints

  for (const match of text.matchAll(/(?:npmRegistryServer|npmPublishRegistry|registry)\s*[:=]\s*["']?([^"'\s]+)["']?/gi)) {
    endpoints.push(endpoint('yarn', 'Yarn registry', match[1], 'registry', '.yarnrc.yml'))
  }
  return endpoints
}

async function discoverPip(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  for (const file of ['pip.conf', 'pip.ini', 'setup.cfg', 'tox.ini', 'pyproject.toml']) {
    const text = await readOptional(join(cwd, file))
    if (!text) continue
    for (const match of text.matchAll(/(?:index-url|extra-index-url|repository|url)\s*[=:]\s*["']?([^"'\s]+)["']?/gi)) {
      const url = match[1]
      if (/^https?:\/\//i.test(url)) {
        endpoints.push(endpoint('pip', 'Python package index', url, 'registry', file))
      }
    }
  }
  return endpoints
}

async function discoverMaven(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  const text = await readOptional(join(cwd, 'pom.xml'))
  if (!text) return endpoints
  for (const match of text.matchAll(/<url>\s*([^<\s]+)\s*<\/url>/gi)) {
    const url = match[1]
    if (/^https?:\/\//i.test(url)) {
      endpoints.push(endpoint('maven', 'Maven repository', url, 'repository', 'pom.xml'))
    }
  }
  return endpoints
}

async function discoverGradle(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  for (const file of ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']) {
    const text = await readOptional(join(cwd, file))
    if (!text) continue
    for (const match of text.matchAll(/(?:url\s*[=(]\s*|uri\()\s*["']([^"']+)["']/gi)) {
      const url = match[1]
      if (/^https?:\/\//i.test(url)) {
        endpoints.push(endpoint('gradle', 'Gradle repository', url, 'repository', file))
      }
    }
  }
  return endpoints
}

async function discoverNuget(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  for (const file of ['NuGet.config', 'nuget.config']) {
    const text = await readOptional(join(cwd, file))
    if (!text) continue
    for (const match of text.matchAll(/<add\b[^>]*\bvalue=["']([^"']+)["'][^>]*>/gi)) {
      const url = match[1]
      if (/^https?:\/\//i.test(url)) {
        endpoints.push(endpoint('nuget', 'NuGet feed', url, 'registry', file))
      }
    }
  }
  return endpoints
}

async function discoverComposer(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  const text = await readOptional(join(cwd, 'composer.json'))
  if (!text) return endpoints
  for (const match of text.matchAll(/"url"\s*:\s*"([^"]+)"/gi)) {
    const url = match[1]
    if (/^https?:\/\//i.test(url)) {
      endpoints.push(endpoint('composer', 'Composer repository', url, 'repository', 'composer.json'))
    }
  }
  return endpoints
}

async function discoverCargo(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  for (const file of ['.cargo/config.toml', '.cargo/config', 'Cargo.toml']) {
    const text = await readOptional(join(cwd, file))
    if (!text) continue
    for (const match of text.matchAll(/(?:index|registry)\s*=\s*["']([^"']+)["']/gi)) {
      const url = match[1]
      if (/^https?:\/\//i.test(url)) {
        endpoints.push(endpoint('cargo', 'Cargo registry', url, 'registry', file))
      }
    }
  }
  return endpoints
}

async function discoverDocker(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  for (const file of ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    const text = await readOptional(join(cwd, file))
    if (!text) continue
    const images = [
      ...Array.from(text.matchAll(/^\s*FROM\s+([^\s@]+)/gim)).map((match) => match[1]),
      ...Array.from(text.matchAll(/^\s*image:\s*["']?([^"'\s]+)["']?/gim)).map((match) => match[1])
    ]
    for (const image of images) {
      const host = dockerRegistryHost(image)
      if (host) {
        endpoints.push(endpoint('docker', 'Docker registry', `https://${host}/v2/`, 'image-registry', file))
      }
    }
  }
  return endpoints
}

async function discoverHelm(cwd: string): Promise<RegistryEndpoint[]> {
  const endpoints: RegistryEndpoint[] = []
  for (const file of ['Chart.yaml', 'Chart.lock']) {
    const text = await readOptional(join(cwd, file))
    if (!text) continue
    for (const match of text.matchAll(/repository:\s*["']?([^"'\s]+)["']?/gi)) {
      const url = match[1]
      if (/^https?:\/\//i.test(url)) {
        endpoints.push(endpoint('helm', 'Helm repository', url, 'repository', file))
      }
    }
  }
  return endpoints
}

async function defaultEndpointChecker(
  endpoint: RegistryEndpoint,
  options: Required<RegistryReachabilityOptions>
): Promise<Pick<RegistryReachabilityResult, 'status' | 'statusCode' | 'message' | 'redirectedUrl'>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)
  try {
    let response = await fetch(endpoint.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    })
    if (response.status === 405 || response.status >= 500) {
      response = await fetch(endpoint.url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { Range: 'bytes=0-0' }
      })
    }
    return {
      status: classifyStatus(response.status),
      statusCode: response.status,
      redirectedUrl: response.url !== endpoint.url ? response.url : undefined,
      message: describeStatus(response.status, response.statusText)
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return {
        status: 'slow',
        message: `No response within ${options.timeoutMs} ms`
      }
    }
    return {
      status: 'unreachable',
      message: error?.message || String(error)
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Anything below 500 used to count as success, which painted expired
 * credentials and mistyped private feeds green. These are the statuses users
 * most need to know about, so they get their own outcome.
 */
function classifyStatus(status: number): RegistryReachabilityStatus {
  if (status >= 500) return 'unreachable'
  if (status === 401 || status === 403 || status === 407) return 'unauthorized'
  if (status === 404 || status === 410) return 'not-found'
  return 'reachable'
}

function describeStatus(status: number, statusText: string): string {
  if (status === 401 || status === 403) return `${status} ${statusText || ''} — credentials are required or no longer valid`.trim()
  if (status === 407) return `${status} — a proxy must authenticate this request`
  if (status === 404 || status === 410) return `${status} — this address does not serve packages; check the registry URL`
  if (status >= 500) return `${status} ${statusText || ''} — the registry itself is failing`.trim()
  return statusText || 'reachable'
}

function endpoint(
  managerId: DependencyManagerId,
  name: string,
  value: string,
  kind: RegistryEndpointKind,
  sourceFile: string
): RegistryEndpoint {
  const url = normalizeUrl(value)
  const normalizedUrl = normalizeComparableUrl(url)
  const host = hostName(url)
  return {
    id: `${managerId}:${kind}:${normalizedUrl}`,
    managerId,
    name,
    url,
    normalizedUrl,
    kind,
    sourceFile,
    secure: /^https:\/\//i.test(url),
    privateHost: isPrivateHost(host)
  }
}

function summarize(results: RegistryReachabilityResult[], endpoints: RegistryEndpoint[]): RegistryReachabilitySummary {
  return {
    endpointCount: endpoints.length,
    reachable: results.filter((result) => result.status === 'reachable').length,
    // Unauthorised and missing feeds are failures for every consumer that gates
    // on `unreachable`, even though the row itself reports the precise reason.
    unreachable: results.filter((result) => FAILING_STATUSES.has(result.status)).length,
    unknown: results.filter((result) => result.status === 'unknown' || result.status === 'slow').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    insecure: endpoints.filter((endpoint) => !endpoint.secure).length,
    privateHost: endpoints.filter((endpoint) => endpoint.privateHost).length
  }
}

function renderMarkdown(report: RegistryReachabilityReport): string {
  const lines = [
    '# Registry Reachability Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    '',
    '## Summary',
    '',
    `- Endpoints: ${report.summary.endpointCount}`,
    `- Reachable: ${report.summary.reachable}`,
    `- Unreachable: ${report.summary.unreachable}`,
    `- Unknown: ${report.summary.unknown}`,
    `- Insecure: ${report.summary.insecure}`,
    `- Private/internal hosts: ${report.summary.privateHost}`,
    '',
    '## Endpoints',
    '',
    '| Status | Manager | Kind | URL | Source | Message |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.results.map((result) => [
      result.status,
      result.managerId || '-',
      result.kind,
      escapeMarkdownTable(result.url),
      escapeMarkdownTable(result.sourceFile),
      escapeMarkdownTable(formatResultMessage(result))
    ].join(' | ')).map((row) => `| ${row} |`)
  ]
  return lines.join('\n')
}

async function readOptional(path: string): Promise<string> {
  try {
    await access(path)
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

function parseKeyValueLines(text: string): Array<{ key: string; value: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith(';'))
    .map((line) => {
      const separator = line.indexOf('=')
      if (separator < 0) return null
      return {
        key: line.slice(0, separator).trim().toLowerCase(),
        value: stripQuotes(line.slice(separator + 1).trim())
      }
    })
    .filter((item): item is { key: string; value: string } => Boolean(item?.key && item.value))
}

function parseJson(text: string): any {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function uniqueEndpoints(endpoints: RegistryEndpoint[]): RegistryEndpoint[] {
  const seen = new Map<string, RegistryEndpoint>()
  for (const endpoint of endpoints) {
    const key = `${endpoint.managerId || 'unknown'}:${endpoint.kind}:${endpoint.normalizedUrl}`
    if (!seen.has(key)) {
      seen.set(key, endpoint)
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    const managerSort = (a.managerId || '').localeCompare(b.managerId || '')
    return managerSort || a.url.localeCompare(b.url)
  })
}

const DOCKER_HUB_REGISTRY = 'registry-1.docker.io'

/**
 * `FROM node:20` names no registry at all, and returning nothing here meant the
 * overwhelming majority of Dockerfiles produced no endpoint — so a broken or
 * rate-limited Docker Hub looked like "nothing to check". Official short names
 * and explicit docker.io both resolve to the Hub API host.
 */
function dockerRegistryHost(image: string): string {
  const first = image.split('/')[0]
  if (!first) return ''
  if (first === 'docker.io' || first === 'index.docker.io') return DOCKER_HUB_REGISTRY
  if (first === image) return DOCKER_HUB_REGISTRY
  return /[.:]/.test(first) ? first : ''
}

function normalizeTimeout(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_TIMEOUT_MS
  return Math.max(500, Math.min(15000, Math.floor(numeric)))
}

function normalizeUrl(value: string): string {
  const text = stripQuotes(value).trim()
  if (!text) return text
  if (/^[a-z]+:\/\//i.test(text)) return text
  return `https://${text}`
}

function normalizeComparableUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase()
}

function hostName(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isPrivateHost(host: string): boolean {
  return Boolean(
    host &&
    (
      host === 'localhost' ||
      PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    )
  )
}

/** Includes the suffixes teams actually use for internal mirrors and clusters. */
const PRIVATE_HOST_SUFFIXES = [
  '.local',
  '.internal',
  '.corp',
  '.lan',
  '.home.arpa',
  '.svc',
  '.svc.cluster.local',
  '.cluster.local',
  '.test',
  '.example',
  '.intranet',
  '.private',
  '.tencentcs.com',
  '.aliyuncs.com',
  '.amazonaws.com.cn'
]

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

function formatResultMessage(result: RegistryReachabilityResult): string {
  const message = `${result.statusCode || ''} ${result.message || ''}`.trim()
  return message || '-'
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
