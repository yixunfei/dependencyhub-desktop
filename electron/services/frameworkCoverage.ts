import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  type DependencyManagerDefinition,
  type DependencyManagerId,
  type ManagerCapability,
  type ManagerImplementationStatus,
  type ManagerScope
} from '@shared/managerRegistry'

export type FrameworkCoverageGapSeverity = 'info' | 'warning'
export type FrameworkCoverageGapType =
  | 'dedicated-page'
  | 'health-scan'
  | 'search'
  | 'lockfile'
  | 'production-tooling'

export interface FrameworkCoverageManagerRecord {
  id: DependencyManagerId
  name: string
  shortName: string
  language: string
  ecosystem: string
  packageManager: string
  category: string
  route: string
  routeLabel: string
  implemented: boolean
  builtIn: boolean
  status: ManagerImplementationStatus
  searchable: boolean
  healthSupported: boolean
  tools: string[]
  manifestFiles: string[]
  lockFiles: string[]
  configFiles: string[]
  scopes: ManagerScope[]
  capabilities: ManagerCapability[]
  productionTools: string[]
  scenarios: string[]
}

export interface FrameworkCoverageRouteGroup {
  route: string
  label: string
  managerCount: number
  implementedCount: number
  stableCount: number
  previewCount: number
  plannedCount: number
  managerIds: DependencyManagerId[]
}

export interface FrameworkCoverageGap {
  id: string
  managerId: DependencyManagerId
  managerName: string
  type: FrameworkCoverageGapType
  severity: FrameworkCoverageGapSeverity
  message: string
}

export interface FrameworkCoverageSummary {
  managerCount: number
  implementedCount: number
  stableCount: number
  previewCount: number
  plannedCount: number
  languageCount: number
  ecosystemCount: number
  categoryCount: number
  routeGroupCount: number
  workspaceRoutedCount: number
  searchableCount: number
  healthSupportedCount: number
  publishWorkflowCount: number
  auditWorkflowCount: number
  lockfileWorkflowCount: number
  sbomWorkflowCount: number
  implementationCoveragePercent: number
  healthCoveragePercent: number
  gapCount: number
  warningGapCount: number
  categoryCounts: Record<string, number>
  scopeCounts: Record<ManagerScope, number>
  capabilityCounts: Record<ManagerCapability, number>
}

export interface FrameworkCoverageReport {
  generatedAt: string
  projectPath?: string
  managers: FrameworkCoverageManagerRecord[]
  routeGroups: FrameworkCoverageRouteGroup[]
  gaps: FrameworkCoverageGap[]
  summary: FrameworkCoverageSummary
}

export interface FrameworkCoverageExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  managerCount: number
  gapCount: number
  summary: FrameworkCoverageSummary
}

const REPORT_DIR = '.npmDesktopManager/reports'

const SCOPE_ORDER: ManagerScope[] = ['project', 'environment', 'global', 'repository', 'publish']
const CAPABILITY_ORDER: ManagerCapability[] = [
  'search',
  'install',
  'uninstall',
  'update',
  'batch-update',
  'version-switch',
  'dependency-tree',
  'health',
  'audit',
  'publish',
  'scripts',
  'tasks',
  'toolchain',
  'registry-config',
  'cache',
  'lockfile',
  'assets',
  'build',
  'sbom',
  'license-policy',
  'container-scan'
]

const ROUTE_LABELS: Record<string, string> = {
  '/npm': 'npm Workbench',
  '/node': 'Node+',
  '/python': 'Python+',
  '/backend': 'Backend+',
  '/cloud': 'Cloud+',
  '/platform': 'Platform+',
  '/polyglot': 'Polyglot+',
  '/data': 'Data+',
  '/infra': 'Infra+',
  '/automation': 'Automation+',
  '/build': 'Build+',
  '/systems': 'Systems+',
  '/runtime': 'Runtime+',
  '/pip': 'pip',
  '/maven': 'Maven',
  '/cargo': 'Cargo',
  '/gradle': 'Gradle',
  '/go': 'Go',
  '/flutter': 'Flutter',
  '/native': 'Native'
}

export class FrameworkCoverageService {
  report(projectPath?: string): FrameworkCoverageReport {
    const managers = MANAGER_DEFINITIONS.map(managerRecord)
    const gaps = managers.flatMap(managerGaps)
    return {
      generatedAt: new Date().toISOString(),
      projectPath: projectPath ? resolve(projectPath) : undefined,
      managers,
      routeGroups: routeGroups(managers),
      gaps,
      summary: summarizeCoverage(managers, gaps)
    }
  }

  async exportMarkdown(projectPath: string): Promise<FrameworkCoverageExportResult> {
    const report = this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'framework-coverage.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<FrameworkCoverageExportResult> {
    const report = this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'framework-coverage.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function managerRecord(manager: DependencyManagerDefinition): FrameworkCoverageManagerRecord {
  const route = manager.route || '/plugins'
  return {
    id: manager.id,
    name: manager.name,
    shortName: manager.shortName,
    language: manager.language,
    ecosystem: manager.ecosystem,
    packageManager: manager.packageManager,
    category: manager.category,
    route,
    routeLabel: ROUTE_LABELS[route] || route,
    implemented: manager.implemented,
    builtIn: manager.builtIn,
    status: manager.status,
    searchable: manager.searchable,
    healthSupported: manager.healthSupported,
    tools: [...manager.tools],
    manifestFiles: [...manager.manifestFiles],
    lockFiles: [...manager.lockFiles],
    configFiles: [...(manager.configFiles || [])],
    scopes: [...manager.scopes],
    capabilities: [...manager.capabilities],
    productionTools: [...manager.productionTools],
    scenarios: [...manager.scenarios]
  }
}

function routeGroups(managers: FrameworkCoverageManagerRecord[]): FrameworkCoverageRouteGroup[] {
  const grouped = new Map<string, FrameworkCoverageManagerRecord[]>()
  for (const manager of managers) {
    grouped.set(manager.route, [...(grouped.get(manager.route) || []), manager])
  }

  return Array.from(grouped.entries())
    .map(([route, records]) => ({
      route,
      label: ROUTE_LABELS[route] || route,
      managerCount: records.length,
      implementedCount: records.filter((manager) => manager.implemented).length,
      stableCount: records.filter((manager) => manager.status === 'stable').length,
      previewCount: records.filter((manager) => manager.status === 'preview').length,
      plannedCount: records.filter((manager) => manager.status === 'planned').length,
      managerIds: records.map((manager) => manager.id)
    }))
    .sort((a, b) => routeSortKey(a.route).localeCompare(routeSortKey(b.route)))
}

function routeSortKey(route: string): string {
  const explicitOrder = [
    '/npm',
    '/node',
    '/python',
    '/backend',
    '/cloud',
    '/platform',
    '/polyglot',
    '/data',
    '/infra',
    '/automation',
    '/build',
    '/systems',
    '/runtime'
  ]
  const index = explicitOrder.indexOf(route)
  return `${index === -1 ? 99 : index}`.padStart(2, '0') + route
}

function summarizeCoverage(managers: FrameworkCoverageManagerRecord[], gaps: FrameworkCoverageGap[]): FrameworkCoverageSummary {
  const categoryCounts: Record<string, number> = {}
  const scopeCounts = Object.fromEntries(SCOPE_ORDER.map((scope) => [scope, 0])) as Record<ManagerScope, number>
  const capabilityCounts = Object.fromEntries(CAPABILITY_ORDER.map((capability) => [capability, 0])) as Record<ManagerCapability, number>

  for (const manager of managers) {
    categoryCounts[manager.category] = (categoryCounts[manager.category] || 0) + 1
    for (const scope of manager.scopes) {
      scopeCounts[scope] += 1
    }
    for (const capability of manager.capabilities) {
      capabilityCounts[capability] += 1
    }
  }

  const managerCount = managers.length
  const implementedCount = managers.filter((manager) => manager.implemented).length
  const healthSupportedCount = managers.filter((manager) => manager.healthSupported).length

  return {
    managerCount,
    implementedCount,
    stableCount: managers.filter((manager) => manager.status === 'stable').length,
    previewCount: managers.filter((manager) => manager.status === 'preview').length,
    plannedCount: managers.filter((manager) => manager.status === 'planned').length,
    languageCount: new Set(managers.map((manager) => manager.language)).size,
    ecosystemCount: new Set(managers.map((manager) => manager.ecosystem)).size,
    categoryCount: Object.keys(categoryCounts).length,
    routeGroupCount: new Set(managers.map((manager) => manager.route)).size,
    workspaceRoutedCount: managers.filter((manager) => manager.route !== '/plugins').length,
    searchableCount: managers.filter((manager) => manager.searchable).length,
    healthSupportedCount,
    publishWorkflowCount: managers.filter((manager) => manager.capabilities.includes('publish')).length,
    auditWorkflowCount: managers.filter((manager) => manager.capabilities.includes('audit')).length,
    lockfileWorkflowCount: managers.filter((manager) => manager.capabilities.includes('lockfile')).length,
    sbomWorkflowCount: managers.filter((manager) => manager.capabilities.includes('sbom')).length,
    implementationCoveragePercent: percent(implementedCount, managerCount),
    healthCoveragePercent: percent(healthSupportedCount, managerCount),
    gapCount: gaps.length,
    warningGapCount: gaps.filter((gap) => gap.severity === 'warning').length,
    categoryCounts,
    scopeCounts,
    capabilityCounts
  }
}

function managerGaps(manager: FrameworkCoverageManagerRecord): FrameworkCoverageGap[] {
  const gaps: FrameworkCoverageGap[] = []
  if (!manager.implemented) {
    gaps.push({
      id: `${manager.id}:dedicated-page`,
      managerId: manager.id,
      managerName: manager.name,
      type: 'dedicated-page',
      severity: 'info',
      message: 'Runs through a grouped extended workspace; a dedicated page can be promoted later if the workflow becomes deep enough.'
    })
  }
  if (!manager.healthSupported) {
    gaps.push({
      id: `${manager.id}:health-scan`,
      managerId: manager.id,
      managerName: manager.name,
      type: 'health-scan',
      severity: 'warning',
      message: 'No manager-specific dependency health scan is available yet.'
    })
  }
  if (!manager.searchable) {
    gaps.push({
      id: `${manager.id}:search`,
      managerId: manager.id,
      managerName: manager.name,
      type: 'search',
      severity: 'info',
      message: 'No package registry search integration is exposed for this manager.'
    })
  }
  if (manager.capabilities.includes('lockfile') && manager.lockFiles.length === 0) {
    gaps.push({
      id: `${manager.id}:lockfile`,
      managerId: manager.id,
      managerName: manager.name,
      type: 'lockfile',
      severity: 'warning',
      message: 'Lockfile workflow is advertised but no lockfile pattern is registered.'
    })
  }
  if (manager.productionTools.length === 0) {
    gaps.push({
      id: `${manager.id}:production-tooling`,
      managerId: manager.id,
      managerName: manager.name,
      type: 'production-tooling',
      severity: 'warning',
      message: 'Production tooling notes are missing from the manager registry.'
    })
  }
  return gaps
}

function renderMarkdown(report: FrameworkCoverageReport): string {
  const lines = [
    '# Dependency Framework Coverage',
    '',
    `Generated: ${report.generatedAt}`,
    report.projectPath ? `Project: ${report.projectPath}` : undefined,
    '',
    '## Summary',
    '',
    `- Managers: ${report.summary.managerCount}`,
    `- Implemented: ${report.summary.implementedCount} (${report.summary.implementationCoveragePercent}%)`,
    `- Stable / preview / planned: ${report.summary.stableCount} / ${report.summary.previewCount} / ${report.summary.plannedCount}`,
    `- Languages: ${report.summary.languageCount}`,
    `- Ecosystems: ${report.summary.ecosystemCount}`,
    `- Workspace route groups: ${report.summary.routeGroupCount}`,
    `- Health coverage: ${report.summary.healthSupportedCount} (${report.summary.healthCoveragePercent}%)`,
    `- Coverage gaps: ${report.summary.gapCount} (${report.summary.warningGapCount} warning)`,
    '',
    '## Workspace Routes',
    '',
    '| Route | Managers | Implemented | Stable | Preview | Planned | Manager IDs |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...report.routeGroups.map((group) => `| ${group.label} (${group.route}) | ${group.managerCount} | ${group.implementedCount} | ${group.stableCount} | ${group.previewCount} | ${group.plannedCount} | ${group.managerIds.join(', ')} |`),
    '',
    '## Manager Matrix',
    '',
    '| Manager | Language | Route | Status | Scopes | Capabilities | Manifests | Locks |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.managers.map((manager) => [
      `| ${manager.name}`,
      manager.language,
      manager.routeLabel,
      manager.status,
      manager.scopes.join(', '),
      manager.capabilities.join(', '),
      manager.manifestFiles.join(', ') || '-',
      `${manager.lockFiles.join(', ') || '-'} |`
    ].join(' | ')),
    '',
    '## Capability Counts',
    '',
    '| Capability | Managers |',
    '| --- | ---: |',
    ...CAPABILITY_ORDER
      .filter((capability) => report.summary.capabilityCounts[capability] > 0)
      .map((capability) => `| ${capability} | ${report.summary.capabilityCounts[capability]} |`),
    '',
    '## Follow-up Gaps',
    '',
    '| Severity | Type | Manager | Note |',
    '| --- | --- | --- | --- |',
    ...(report.gaps.length
      ? report.gaps.map((gap) => `| ${gap.severity} | ${gap.type} | ${gap.managerName} | ${gap.message} |`)
      : ['| - | - | - | No coverage gaps recorded |']),
    ''
  ].filter((line): line is string => typeof line === 'string')

  return lines.join('\n')
}

function exportResult(path: string, format: 'markdown' | 'json', report: FrameworkCoverageReport): FrameworkCoverageExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    managerCount: report.summary.managerCount,
    gapCount: report.summary.gapCount,
    summary: report.summary
  }
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}
