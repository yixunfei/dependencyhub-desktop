import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport,
  type WorkspaceNode
} from './workspaceDiscovery'
import {
  LockfileDriftService,
  type LockfileDriftReport
} from './lockfileDrift'

export type DependencyAutomationPlanExportFormat = 'markdown' | 'json' | 'dependabot' | 'renovate'
export type DependencyAutomationProvider = 'dependabot' | 'renovate'
export type DependencyAutomationPlanStatus = 'ready' | 'warning' | 'blocked'
export type DependencyAutomationWarningSeverity = 'info' | 'warning' | 'blocked'
export type DependencyAutomationWarningSource =
  | 'workspace-discovery'
  | 'lockfile-drift'
  | 'dependabot-support'
  | 'renovate-support'
  | 'registry-secrets'

export interface DependencyAutomationTarget {
  id: string
  provider: DependencyAutomationProvider
  managerId: DependencyManagerId
  workspaceId: string
  workspaceName: string
  workspaceRelativePath: string
  directory: string
  manifestFiles: string[]
  lockFiles: string[]
  packageEcosystem?: string
  renovateManager?: string
  schedule: string
  groupName: string
  securityUpdates: boolean
  openPullRequestsLimit: number
  requiredSecrets: string[]
  supported: boolean
}

export interface DependencyAutomationWarning {
  id: string
  severity: DependencyAutomationWarningSeverity
  source: DependencyAutomationWarningSource
  title: string
  summary: string
  recommendation: string
  evidence: string[]
  managerId?: DependencyManagerId
  workspaceId?: string
  workspaceName?: string
  workspaceRelativePath?: string
}

export interface DependencyAutomationPlanSummary {
  status: DependencyAutomationPlanStatus
  workspaceCount: number
  managerCount: number
  managers: DependencyManagerId[]
  targetCount: number
  dependabotTargetCount: number
  renovateTargetCount: number
  dependabotSupportedManagerCount: number
  renovateSupportedManagerCount: number
  unsupportedDependabotManagerCount: number
  unsupportedRenovateManagerCount: number
  requiredSecretCount: number
  warningCount: number
  blockedWarningCount: number
  lockfileWarningCount: number
  generatedConfigCount: number
}

export interface DependencyAutomationPlanSources {
  discovery: Pick<WorkspaceDiscoveryReport, 'generatedAt' | 'summary'>
  lockfileDrift?: Pick<LockfileDriftReport, 'generatedAt' | 'summary'>
  errors: Partial<Record<DependencyAutomationWarningSource, string>>
}

export interface DependencyAutomationPlanReport {
  generatedAt: string
  projectPath: string
  status: DependencyAutomationPlanStatus
  summary: DependencyAutomationPlanSummary
  targets: DependencyAutomationTarget[]
  dependabotTargets: DependencyAutomationTarget[]
  renovateTargets: DependencyAutomationTarget[]
  warnings: DependencyAutomationWarning[]
  requiredSecrets: string[]
  dependabotYaml: string
  renovateJson: string
  sources: DependencyAutomationPlanSources
}

export interface DependencyAutomationPlanExportResult {
  path: string
  format: DependencyAutomationPlanExportFormat
  generatedAt: string
  status: DependencyAutomationPlanStatus
  workspaceCount: number
  targetCount: number
  warningCount: number
  count: number
  summary: DependencyAutomationPlanSummary
}

export interface DependencyAutomationPlanDependencies {
  workspaceDiscoveryService?: WorkspaceDiscoveryService
  lockfileDriftService?: LockfileDriftService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))
const DEPENDABOT_ECOSYSTEM_BY_MANAGER: Partial<Record<DependencyManagerId, string>> = {
  npm: 'npm',
  pnpm: 'npm',
  yarn: 'npm',
  pip: 'pip',
  uv: 'pip',
  poetry: 'pip',
  pipenv: 'pip',
  maven: 'maven',
  gradle: 'gradle',
  cargo: 'cargo',
  go: 'gomod',
  flutter: 'pub',
  nuget: 'nuget',
  composer: 'composer',
  bundler: 'bundler',
  swiftpm: 'swift',
  docker: 'docker'
}
const RENOVATE_MANAGER_BY_MANAGER: Partial<Record<DependencyManagerId, string>> = {
  npm: 'npm',
  pnpm: 'npm',
  yarn: 'npm',
  bun: 'bun',
  deno: 'deno',
  pip: 'pip_requirements',
  uv: 'pep621',
  poetry: 'poetry',
  pipenv: 'pipenv',
  conda: 'conda',
  maven: 'maven',
  gradle: 'gradle',
  cargo: 'cargo',
  go: 'gomod',
  flutter: 'pub',
  nuget: 'nuget',
  composer: 'composer',
  bundler: 'bundler',
  swiftpm: 'swift',
  cocoapods: 'cocoapods',
  helm: 'helmv3',
  docker: 'dockerfile',
  native: 'cmake'
}

export class DependencyAutomationPlanService {
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService
  private readonly lockfileDriftService: LockfileDriftService

  constructor(dependencies: DependencyAutomationPlanDependencies = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.lockfileDriftService = dependencies.lockfileDriftService || new LockfileDriftService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
  }

  async plan(projectPath: string): Promise<DependencyAutomationPlanReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const discovery = await this.workspaceDiscoveryService.report(root)
    const lockfileResult = await capture(() => this.lockfileDriftService.report(root))
    const dependabotTargets = buildDependabotTargets(discovery.workspaces)
    const renovateTargets = buildRenovateTargets(discovery.workspaces)
    const targets = [...dependabotTargets, ...renovateTargets]
    const warnings = normalizeWarnings(discovery, lockfileResult)
    const requiredSecrets = unique(targets.flatMap((target) => target.requiredSecrets)).sort()
    const summary = summarize(discovery, targets, warnings, requiredSecrets, lockfileResult.value)
    const dependabotYaml = renderDependabotYaml(dependabotTargets, requiredSecrets)
    const renovateJson = renderRenovateJson(renovateTargets)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      targets,
      dependabotTargets,
      renovateTargets,
      warnings,
      requiredSecrets,
      dependabotYaml,
      renovateJson,
      sources: {
        discovery: {
          generatedAt: discovery.generatedAt,
          summary: discovery.summary
        },
        lockfileDrift: lockfileResult.value
          ? {
              generatedAt: lockfileResult.value.generatedAt,
              summary: lockfileResult.value.summary
            }
          : undefined,
        errors: lockfileResult.error ? { 'lockfile-drift': lockfileResult.error } : {}
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<DependencyAutomationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-automation-plan.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderDependencyAutomationMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyAutomationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-automation-plan.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }

  async exportDependabot(projectPath: string): Promise<DependencyAutomationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-automation', 'dependabot.yml')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, report.dependabotYaml, 'utf-8')
    return exportResult(path, 'dependabot', report)
  }

  async exportRenovate(projectPath: string): Promise<DependencyAutomationPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-automation', 'renovate.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, report.renovateJson, 'utf-8')
    return exportResult(path, 'renovate', report)
  }
}

function buildDependabotTargets(workspaces: WorkspaceNode[]): DependencyAutomationTarget[] {
  const targets = workspaces.flatMap((workspace) => workspace.managerIds.map((managerId) => {
    const packageEcosystem = DEPENDABOT_ECOSYSTEM_BY_MANAGER[managerId]
    return targetFor('dependabot', workspace, managerId, {
      packageEcosystem,
      supported: Boolean(packageEcosystem)
    })
  }))
  return uniqueBy(targets, (target) => `${target.provider}:${target.packageEcosystem || target.managerId}:${target.directory}`)
}

function buildRenovateTargets(workspaces: WorkspaceNode[]): DependencyAutomationTarget[] {
  const targets = workspaces.flatMap((workspace) => workspace.managerIds.map((managerId) => {
    const renovateManager = RENOVATE_MANAGER_BY_MANAGER[managerId]
    return targetFor('renovate', workspace, managerId, {
      renovateManager,
      supported: Boolean(renovateManager)
    })
  }))
  return uniqueBy(targets, (target) => `${target.provider}:${target.renovateManager || target.managerId}:${target.directory}`)
}

function targetFor(
  provider: DependencyAutomationProvider,
  workspace: WorkspaceNode,
  managerId: DependencyManagerId,
  options: {
    packageEcosystem?: string
    renovateManager?: string
    supported: boolean
  }
): DependencyAutomationTarget {
  const manager = MANAGER_BY_ID.get(managerId)
  const directory = workspace.relativePath === '.' ? '/' : `/${workspace.relativePath.replace(/\\/g, '/')}`
  return {
    id: `${provider}:${workspace.id}:${managerId}`,
    provider,
    managerId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceRelativePath: workspace.relativePath,
    directory,
    manifestFiles: workspace.manifestFiles,
    lockFiles: workspace.lockFiles,
    packageEcosystem: options.packageEcosystem,
    renovateManager: options.renovateManager,
    schedule: 'weekly',
    groupName: automationGroupName(manager?.shortName || managerId, workspace.relativePath),
    securityUpdates: true,
    openPullRequestsLimit: workspace.relativePath === '.' ? 8 : 4,
    requiredSecrets: requiredSecretsForManager(managerId),
    supported: options.supported
  }
}

function normalizeWarnings(
  discovery: WorkspaceDiscoveryReport,
  lockfileResult: CaptureResult<LockfileDriftReport>
): DependencyAutomationWarning[] {
  const warnings: DependencyAutomationWarning[] = []
  const managerIds = unique(discovery.workspaces.flatMap((workspace) => workspace.managerIds)).sort() as DependencyManagerId[]

  if (lockfileResult.error) {
    warnings.push(warning({
      id: 'lockfile-drift:source-error',
      severity: 'warning',
      source: 'lockfile-drift',
      title: 'Lockfile drift evidence is unavailable',
      summary: lockfileResult.error,
      recommendation: 'Regenerate the automation plan after lockfile drift evidence is available.',
      evidence: [lockfileResult.error]
    }))
  }

  for (const managerId of managerIds) {
    if (!DEPENDABOT_ECOSYSTEM_BY_MANAGER[managerId]) {
      warnings.push(warning({
        id: `dependabot:${managerId}:unsupported`,
        severity: 'info',
        source: 'dependabot-support',
        title: `${managerId} is not mapped to a Dependabot ecosystem`,
        summary: `${managerId} targets will be managed by Renovate only in the generated automation pack.`,
        recommendation: 'Use Renovate for this manager, or add a Dependabot mapping if the provider supports it in your environment.',
        evidence: [`Manager: ${managerId}`],
        managerId
      }))
    }
    if (!RENOVATE_MANAGER_BY_MANAGER[managerId]) {
      warnings.push(warning({
        id: `renovate:${managerId}:unsupported`,
        severity: 'warning',
        source: 'renovate-support',
        title: `${managerId} is not mapped to a Renovate manager`,
        summary: `${managerId} has no generated Renovate manager entry.`,
        recommendation: 'Add a custom Renovate manager or handle this ecosystem with a dedicated workflow.',
        evidence: [`Manager: ${managerId}`],
        managerId
      }))
    }
  }

  for (const workspace of lockfileResult.value?.workspaces || []) {
    for (const finding of workspace.findings) {
      if (finding.kind !== 'missing-lockfile' && finding.kind !== 'stale-lockfile' && finding.kind !== 'mixed-node-lockfiles') continue
      warnings.push(warning({
        id: `lockfile:${finding.id}`,
        severity: finding.severity === 'blocked' ? 'blocked' : finding.severity === 'warning' ? 'warning' : 'info',
        source: 'lockfile-drift',
        title: finding.title,
        summary: finding.summary,
        recommendation: `${finding.recommendation} Automation should use grouped pull requests only after lockfile coverage is reliable.`,
        evidence: finding.evidence,
        managerId: finding.managerId,
        workspaceId: workspace.workspace.id,
        workspaceName: workspace.workspace.name,
        workspaceRelativePath: workspace.workspace.relativePath
      }))
    }
  }

  const secretManagers = managerIds.filter((managerId) => requiredSecretsForManager(managerId).length > 0)
  if (secretManagers.length > 0) {
    warnings.push(warning({
      id: 'registry-secrets:placeholders',
      severity: 'info',
      source: 'registry-secrets',
      title: 'Private registry secret placeholders were inferred',
      summary: `Detected managers may need provider secrets: ${unique(secretManagers.flatMap(requiredSecretsForManager)).join(', ')}.`,
      recommendation: 'Create these secrets in the CI provider or remove private registry entries before enabling automation.',
      evidence: secretManagers.map((managerId) => `${managerId}: ${requiredSecretsForManager(managerId).join(', ')}`)
    }))
  }

  return uniqueBy(warnings, (item) => item.id).slice(0, 200)
}

function summarize(
  discovery: WorkspaceDiscoveryReport,
  targets: DependencyAutomationTarget[],
  warnings: DependencyAutomationWarning[],
  requiredSecrets: string[],
  lockfileDrift?: LockfileDriftReport
): DependencyAutomationPlanSummary {
  const managers = unique(discovery.workspaces.flatMap((workspace) => workspace.managerIds)).sort() as DependencyManagerId[]
  const dependabotManagerCount = new Set(targets.filter((target) => target.provider === 'dependabot' && target.supported).map((target) => target.managerId)).size
  const renovateManagerCount = new Set(targets.filter((target) => target.provider === 'renovate' && target.supported).map((target) => target.managerId)).size
  const blockedWarningCount = warnings.filter((item) => item.severity === 'blocked').length
  const status: DependencyAutomationPlanStatus = blockedWarningCount > 0
    ? 'blocked'
    : warnings.some((item) => item.severity === 'warning') || targets.some((target) => !target.supported)
      ? 'warning'
      : 'ready'

  return {
    status,
    workspaceCount: discovery.summary.workspaceCount,
    managerCount: managers.length,
    managers,
    targetCount: targets.length,
    dependabotTargetCount: targets.filter((target) => target.provider === 'dependabot' && target.supported).length,
    renovateTargetCount: targets.filter((target) => target.provider === 'renovate' && target.supported).length,
    dependabotSupportedManagerCount: dependabotManagerCount,
    renovateSupportedManagerCount: renovateManagerCount,
    unsupportedDependabotManagerCount: managers.filter((managerId) => !DEPENDABOT_ECOSYSTEM_BY_MANAGER[managerId]).length,
    unsupportedRenovateManagerCount: managers.filter((managerId) => !RENOVATE_MANAGER_BY_MANAGER[managerId]).length,
    requiredSecretCount: requiredSecrets.length,
    warningCount: warnings.length,
    blockedWarningCount,
    lockfileWarningCount: lockfileDrift?.summary.findingCount || 0,
    generatedConfigCount: 2
  }
}

function renderDependencyAutomationMarkdown(report: DependencyAutomationPlanReport): string {
  const lines = [
    '# Dependency Automation Plan',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    `- Dependabot targets: ${report.summary.dependabotTargetCount}`,
    `- Renovate targets: ${report.summary.renovateTargetCount}`,
    `- Required secrets: ${report.requiredSecrets.join(', ') || '-'}`,
    `- Warnings: ${report.summary.warningCount}`,
    `- Blocked warnings: ${report.summary.blockedWarningCount}`,
    `- Lockfile warnings: ${report.summary.lockfileWarningCount}`,
    '',
    '## Automation Targets',
    '',
    '| Provider | Workspace | Manager | Ecosystem / Manager | Directory | Group | Secrets |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ]

  for (const target of report.targets.filter((item) => item.supported)) {
    lines.push([
      target.provider,
      markdownCell(`${target.workspaceName} (${target.workspaceRelativePath})`),
      target.managerId,
      target.packageEcosystem || target.renovateManager || '-',
      target.directory,
      markdownCell(target.groupName),
      markdownCell(target.requiredSecrets.join(', ') || '-')
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Warnings', '')
  if (report.warnings.length === 0) {
    lines.push('- No dependency automation warnings.')
  } else {
    for (const item of report.warnings.slice(0, 80)) {
      lines.push(`- ${item.severity} / ${item.source}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
  }

  lines.push('', '## Dependabot', '', '```yaml', report.dependabotYaml.trimEnd(), '```')
  lines.push('', '## Renovate', '', '```json', report.renovateJson.trimEnd(), '```')
  return `${lines.join('\n')}\n`
}

function renderDependabotYaml(targets: DependencyAutomationTarget[], requiredSecrets: string[]): string {
  const supportedTargets = targets.filter((target) => target.supported && target.packageEcosystem)
  const lines = [
    'version: 2',
    'updates:'
  ]

  for (const target of supportedTargets) {
    lines.push(
      `  - package-ecosystem: "${target.packageEcosystem}"`,
      `    directory: "${target.directory}"`,
      '    schedule:',
      `      interval: "${target.schedule}"`,
      '      day: "monday"',
      '      time: "08:00"',
      '    open-pull-requests-limit: ' + target.openPullRequestsLimit,
      '    labels:',
      '      - "dependencies"',
      `      - "${target.managerId}"`,
      '    groups:',
      `      ${safeYamlKey(target.groupName)}:`,
      '        patterns:',
      '          - "*"',
      '        update-types:',
      '          - "minor"',
      '          - "patch"'
    )
    const registries = dependabotRegistriesForManager(target.managerId)
    if (registries.length > 0) {
      lines.push('    registries:', ...registries.map((registry) => `      - ${registry}`))
    }
  }

  const registryConfigs = dependabotRegistryConfigs(requiredSecrets)
  if (registryConfigs.length > 0) {
    lines.push('', 'registries:', ...registryConfigs)
  }

  return `${lines.join('\n')}\n`
}

function renderRenovateJson(targets: DependencyAutomationTarget[]): string {
  const managers = unique(targets
    .filter((target) => target.supported && target.renovateManager)
    .map((target) => target.renovateManager as string))
    .sort()
  const packageRules = unique(targets
    .filter((target) => target.supported && target.renovateManager)
    .map((target) => target.renovateManager as string))
    .sort()
    .map((manager) => ({
      matchManagers: [manager],
      groupName: `${manager} minor and patch dependencies`,
      matchUpdateTypes: ['minor', 'patch'],
      automerge: false
    }))

  return `${JSON.stringify({
    $schema: 'https://docs.renovatebot.com/renovate-schema.json',
    extends: [
      'config:recommended',
      ':dependencyDashboard',
      ':semanticCommits'
    ],
    labels: ['dependencies'],
    timezone: 'UTC',
    schedule: ['before 8am on monday'],
    prConcurrentLimit: 8,
    enabledManagers: managers,
    packageRules
  }, null, 2)}\n`
}

function dependabotRegistryConfigs(requiredSecrets: string[]): string[] {
  const configs: string[] = []
  if (requiredSecrets.includes('NPM_TOKEN')) {
    configs.push(
      '  npm-private:',
      '    type: npm-registry',
      '    url: https://registry.npmjs.org',
      '    token: "${{ secrets.NPM_TOKEN }}"'
    )
  }
  if (requiredSecrets.includes('PYPI_TOKEN')) {
    configs.push(
      '  python-private:',
      '    type: python-index',
      '    url: https://pypi.org/simple',
      '    token: "${{ secrets.PYPI_TOKEN }}"'
    )
  }
  if (requiredSecrets.includes('MAVEN_USERNAME') || requiredSecrets.includes('MAVEN_PASSWORD')) {
    configs.push(
      '  maven-private:',
      '    type: maven-repository',
      '    url: https://repo.example.invalid/maven',
      '    username: "${{ secrets.MAVEN_USERNAME }}"',
      '    password: "${{ secrets.MAVEN_PASSWORD }}"'
    )
  }
  if (requiredSecrets.includes('NUGET_API_KEY')) {
    configs.push(
      '  nuget-private:',
      '    type: nuget-feed',
      '    url: https://api.nuget.org/v3/index.json',
      '    token: "${{ secrets.NUGET_API_KEY }}"'
    )
  }
  if (requiredSecrets.includes('DOCKERHUB_TOKEN')) {
    configs.push(
      '  docker-private:',
      '    type: docker-registry',
      '    url: https://registry.hub.docker.com',
      '    username: "${{ secrets.DOCKERHUB_USERNAME }}"',
      '    password: "${{ secrets.DOCKERHUB_TOKEN }}"'
    )
  }
  return configs
}

function dependabotRegistriesForManager(managerId: DependencyManagerId): string[] {
  switch (managerId) {
    case 'npm':
    case 'pnpm':
    case 'yarn':
      return ['npm-private']
    case 'pip':
    case 'uv':
    case 'poetry':
    case 'pipenv':
      return ['python-private']
    case 'maven':
    case 'gradle':
      return ['maven-private']
    case 'nuget':
      return ['nuget-private']
    case 'docker':
      return ['docker-private']
    default:
      return []
  }
}

function requiredSecretsForManager(managerId: DependencyManagerId): string[] {
  switch (managerId) {
    case 'npm':
    case 'pnpm':
    case 'yarn':
    case 'bun':
      return ['NPM_TOKEN']
    case 'pip':
    case 'uv':
    case 'poetry':
    case 'pipenv':
      return ['PYPI_TOKEN']
    case 'conda':
      return ['CONDA_TOKEN']
    case 'maven':
    case 'gradle':
      return ['MAVEN_USERNAME', 'MAVEN_PASSWORD']
    case 'cargo':
      return ['CARGO_REGISTRY_TOKEN']
    case 'flutter':
      return ['PUB_CREDENTIALS_JSON']
    case 'nuget':
      return ['NUGET_API_KEY']
    case 'composer':
      return ['COMPOSER_AUTH']
    case 'bundler':
      return ['RUBYGEMS_API_KEY']
    case 'cocoapods':
      return ['COCOAPODS_TRUNK_TOKEN']
    case 'helm':
      return ['HELM_REGISTRY_USERNAME', 'HELM_REGISTRY_PASSWORD']
    case 'docker':
      return ['DOCKERHUB_USERNAME', 'DOCKERHUB_TOKEN']
    default:
      return []
  }
}

function automationGroupName(managerLabel: string, workspaceRelativePath: string): string {
  const suffix = workspaceRelativePath === '.' ? 'root' : workspaceRelativePath
  return `${managerLabel} ${suffix} minor patch`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

function safeYamlKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-')
}

function warning(input: DependencyAutomationWarning): DependencyAutomationWarning {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function exportResult(
  path: string,
  format: DependencyAutomationPlanExportFormat,
  report: DependencyAutomationPlanReport
): DependencyAutomationPlanExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    workspaceCount: report.summary.workspaceCount,
    targetCount: report.summary.targetCount,
    warningCount: report.summary.warningCount,
    count: report.summary.warningCount,
    summary: report.summary
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const key = keyFor(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
