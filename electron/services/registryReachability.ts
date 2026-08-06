import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'

export type RegistryEndpointKind = 'registry' | 'mirror' | 'proxy' | 'repository' | 'image-registry'
export type RegistryReachabilityStatus = 'reachable' | 'unreachable' | 'unknown' | 'skipped'
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
const DEFAULT_TIMEOUT_MS = 3000

export class RegistryReachabilityService {
  private readonly checker: RegistryEndpointChecker

  constructor(options: { checker?: RegistryEndpointChecker } = {}) {
    this.checker = options.checker || defaultEndpointChecker
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
    const generatedAt = new Date().toISOString()
    const endpoints = await this.discover(root)
    const checkOptions = {
      timeoutMs: normalizeTimeout(options.timeoutMs)
    }
    const results = await Promise.all(endpoints.map((endpoint) => this.checkOne(endpoint, checkOptions)))
    return {
      generatedAt,
      projectPath: root,
      endpoints,
      results,
      summary: summarize(results, endpoints)
    }
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
    const startedAt = Date.now()
    if (!/^https?:\/\//i.test(endpoint.url)) {
      return {
        ...endpoint,
        status: 'skipped',
        checkedAt: new Date().toISOString(),
        durationMs: 0,
        message: 'Only HTTP and HTTPS endpoints can be checked automatically.'
      }
    }

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
    const reachable = response.status < 500
    return {
      status: reachable ? 'reachable' : 'unreachable',
      statusCode: response.status,
      redirectedUrl: response.url !== endpoint.url ? response.url : undefined,
      message: reachable ? response.statusText || 'reachable' : response.statusText || 'server error'
    }
  } catch (error: any) {
    return {
      status: error?.name === 'AbortError' ? 'unknown' : 'unreachable',
      message: error?.name === 'AbortError'
        ? `Timed out after ${options.timeoutMs} ms`
        : error?.message || String(error)
    }
  } finally {
    clearTimeout(timer)
  }
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
    unreachable: results.filter((result) => result.status === 'unreachable').length,
    unknown: results.filter((result) => result.status === 'unknown').length,
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

function dockerRegistryHost(image: string): string {
  const first = image.split('/')[0]
  if (!first || first === image) return ''
  if (first === 'docker.io' || first === 'index.docker.io') return ''
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
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.corp') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    )
  )
}

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
