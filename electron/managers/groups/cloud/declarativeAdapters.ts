import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type { ManagerDependency, ManagerHealthReport, ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import { parseYamlDocument, asRecord, asArray, asString, readTextIfExists } from '../../structuredData'
import { analyzeManagerHealth } from '../../staticHealth'
import { appendHealthFindings, createHealthFinding } from '../../healthReport'

export type DeclarativeCloudManagerId = 'kustomize' | 'skaffold' | 'argocd' | 'flux'
const FILES: Record<DeclarativeCloudManagerId, string[]> = {
  kustomize: ['kustomization.yaml', 'kustomization.yml', 'Kustomization'],
  skaffold: ['skaffold.yaml', 'skaffold.yml'],
  argocd: ['argocd-application.yaml', 'argocd-application.yml'],
  flux: ['flux-kustomization.yaml', 'flux-kustomization.yml', 'flux-helmrelease.yaml', 'flux-helmrelease.yml']
}

export async function readDeclarativeCloudInventory(cwd: string, managerId: DeclarativeCloudManagerId): Promise<ManagerDependency[]> {
  const result: ManagerDependency[] = []
  for (const file of FILES[managerId]) {
    const text = await readTextIfExists(join(cwd, file)); if (!text) continue
    const root = parseYamlDocument(text, file)
    walk(root, managerId, file, [], result)
  }
  return unique(result)
}

export async function analyzeDeclarativeCloudHealth(cwd: string, definition: DependencyManagerDefinition, dependencies: ManagerDependency[]): Promise<ManagerHealthReport> {
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const findings = [] as ReturnType<typeof createHealthFinding>[]
  const files = FILES[definition.id as DeclarativeCloudManagerId]
  if (!(await Promise.all(files.map((file) => readTextIfExists(join(cwd, file))))).some(Boolean)) findings.push(createHealthFinding(`${definition.id}-manifest-missing`, 'warning', 'Manifest is missing', `Expected one of: ${files.join(', ')}.`))
  for (const item of dependencies) {
    if (item.source?.toLowerCase().startsWith('http://')) findings.push(createHealthFinding(`${definition.id}-insecure:${item.name}`, 'error', 'Source uses insecure HTTP', `${item.name} resolves through ${item.source}.`, { packageName: item.name, source: item.source }))
    if ((definition.id === 'argocd' || definition.id === 'flux') && item.source && !/[#@][A-Za-z0-9._/-]+$/.test(item.source)) findings.push(createHealthFinding(`${definition.id}-unpinned:${item.name}`, 'warning', 'GitOps source is not pinned', `${item.name} has no explicit revision or digest.`, { packageName: item.name, source: item.source }))
  }
  return appendHealthFindings(base, findings)
}

export async function createDeclarativeCloudOperationTemplate(_cwd: string, managerId: DeclarativeCloudManagerId, request: ManagerOperationRequest) {
  const requirements: string[] = []; const warnings: string[] = []
  const table: Record<string, string[]> = managerId === 'kustomize'
    ? { sync: ['build', '.'], audit: ['build', '.'], tree: ['cfg', 'tree', '.'], list: ['build', '.'] }
    : managerId === 'skaffold'
      ? { sync: ['render'], audit: ['diagnose'], tree: ['render'], list: ['render'] }
      : managerId === 'argocd'
        ? { sync: ['app', 'diff'], audit: ['app', 'diff'], tree: ['app', 'get'], list: ['app', 'list'], outdated: ['app', 'list'] }
        : { sync: ['check'], audit: ['check'], tree: ['get', 'all'], list: ['get', 'all'], outdated: ['get', 'all'] }
  const command = table[request.operation]
  if (!command) { requirements.push(`${managerId} ${request.operation} requires editing declarative manifests and reviewing the diff.`); return { tool: managerId, args: ['version'], requirements, warnings, mutating: false, dryRunSupported: false } }
  const args = [...command]
  if ((managerId === 'argocd' && ['sync', 'audit', 'tree'].includes(request.operation)) || (managerId === 'flux' && request.operation === 'update')) { if (!request.packageName) requirements.push('A target name is required for this operation.'); else args.push(request.packageName) }
  return { tool: managerId, args, requirements, warnings, mutating: false, dryRunSupported: false }
}

function walk(value: unknown, managerId: string, file: string, path: string[], out: ManagerDependency[]) {
  if (Array.isArray(value)) return value.forEach((item, index) => walk(item, managerId, file, [...path, String(index)], out))
  const record = asRecord(value); if (!record) return
  const name = asString(record.name) || asString(asRecord(record.metadata)?.name) || asString(record.chart) || asString(record.image)
  const source = asString(record.repoURL) || asString(record.url) || asString(record.source) || asString(record.chart) || asString(record.image)
  const version = asString(record.targetRevision) || asString(record.version) || asString(record.tag)
  if (name || source) out.push({ managerId: managerId as any, name: name || source || path.join('.'), version, requestedVersion: version, resolvedVersion: version, type: managerId === 'skaffold' ? 'artifact' : 'declarative', source, file, direct: true, metadata: { path: path.join('.') } })
  for (const [key, item] of Object.entries(record)) walk(item, managerId, file, [...path, key], out)
}
function unique(items: ManagerDependency[]) { return [...new Map(items.map((item) => [`${item.name}|${item.source}|${item.file}`, item])).values()] }
