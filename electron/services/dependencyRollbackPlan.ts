import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  listOperationHistory,
  type OperationHistoryRecord,
  type OperationHistorySummary,
  summarizeOperationHistory
} from './operationHistory'
import {
  WorkspaceGovernanceService,
  type WorkspaceGovernanceReport,
  type WorkspaceUpdatePlan,
  type WorkspaceUpdatePlanItem
} from './workspaceGovernance'

export type DependencyRollbackPlanStatus = 'ready' | 'warning' | 'blocked'
export type DependencyRollbackPlanPriority = 'required' | 'recommended' | 'optional'
export type DependencyRollbackAnchorKind =
  | 'managed-snapshot'
  | 'source-control'
  | 'lockfile'
  | 'manifest'
  | 'operation-history'
export type DependencyRollbackStrategy =
  | 'snapshot-restore'
  | 'source-control-restore'
  | 'lockfile-restore'
  | 'manager-rehydrate'
  | 'verification'
export type DependencyRollbackPlanSource =
  | 'workspace-governance'
  | 'workspace-update-plan'
  | 'operation-history'

export interface DependencyRollbackAnchor {
  kind: DependencyRollbackAnchorKind
  status: DependencyRollbackPlanStatus
  label: string
  path?: string
  count?: number
}

export interface DependencyRollbackPlanItem {
  id: string
  priority: DependencyRollbackPlanPriority
  status: DependencyRollbackPlanStatus
  workspaceId: string
  workspaceName: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  managerName: string
  risk: WorkspaceUpdatePlanItem['risk']
  updateStatus: WorkspaceUpdatePlanItem['status']
  snapshotSource: WorkspaceUpdatePlanItem['snapshotSource']
  snapshotCount: number
  snapshotPath?: string
  manifestFiles: string[]
  lockFiles: string[]
  strategies: DependencyRollbackStrategy[]
  anchors: DependencyRollbackAnchor[]
  rollbackActions: string[]
  commands: string[]
  verificationCommands: string[]
  warnings: string[]
  evidence: string[]
  recentFailedOperationCount: number
  recommendation: string
}

export interface DependencyRollbackPlanSummary {
  status: DependencyRollbackPlanStatus
  itemCount: number
  readyItemCount: number
  warningItemCount: number
  blockedItemCount: number
  requiredItemCount: number
  recommendedItemCount: number
  optionalItemCount: number
  workspaceCount: number
  managerCount: number
  snapshotCoveredItemCount: number
  lockfileCoveredItemCount: number
  manifestCoveredItemCount: number
  sourceControlCommandCount: number
  rollbackActionCount: number
  verificationCommandCount: number
  recentFailedOperationCount: number
  sourceErrorCount: number
}

export interface DependencyRollbackPlanReport {
  generatedAt: string
  projectPath: string
  status: DependencyRollbackPlanStatus
  summary: DependencyRollbackPlanSummary
  items: DependencyRollbackPlanItem[]
  sources: {
    governance?: Pick<WorkspaceGovernanceReport, 'generatedAt' | 'summary'>
    updatePlan?: Pick<WorkspaceUpdatePlan, 'generatedAt' | 'summary'>
    operationHistory: OperationHistorySummary
    errors: Partial<Record<DependencyRollbackPlanSource, string>>
  }
}

export interface DependencyRollbackPlanExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: DependencyRollbackPlanStatus
  itemCount: number
  blockedItemCount: number
  summary: DependencyRollbackPlanSummary
}

export interface DependencyRollbackPlanDependencies {
  workspaceGovernanceService?: WorkspaceGovernanceService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'dependency-rollback-plan'

export class DependencyRollbackPlanService {
  private readonly workspaceGovernanceService: WorkspaceGovernanceService

  constructor(dependencies: DependencyRollbackPlanDependencies = {}) {
    this.workspaceGovernanceService = dependencies.workspaceGovernanceService || new WorkspaceGovernanceService()
  }

  async report(projectPath: string): Promise<DependencyRollbackPlanReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)

    const [governanceResult, updateResult, operationResult] = await Promise.all([
      capture(() => this.workspaceGovernanceService.report(root)),
      capture(() => this.workspaceGovernanceService.updatePlan(root)),
      capture(() => listOperationHistory(root, { limit: 500, mutating: true }))
    ])
    const operations = operationResult.value || []
    const errors = sourceErrors(governanceResult, updateResult, operationResult)
    const items = buildItems(root, updateResult.value, governanceResult.value, operations)
    const operationSummary = summarizeOperationHistory(operations)
    const summary = summarize(items, operationSummary, errors)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      items,
      sources: {
        governance: governanceResult.value
          ? {
              generatedAt: governanceResult.value.generatedAt,
              summary: governanceResult.value.summary
            }
          : undefined,
        updatePlan: updateResult.value
          ? {
              generatedAt: updateResult.value.generatedAt,
              summary: updateResult.value.summary
            }
          : undefined,
        operationHistory: operationSummary,
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<DependencyRollbackPlanExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyRollbackPlanExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function buildItems(
  root: string,
  updatePlan: WorkspaceUpdatePlan | undefined,
  governance: WorkspaceGovernanceReport | undefined,
  operations: OperationHistoryRecord[]
): DependencyRollbackPlanItem[] {
  const workspaceById = new Map((governance?.workspaces || []).map((node) => [node.workspace.id, node]))

  return (updatePlan?.items || [])
    .filter((item) => item.commands.some((command) => command.mutating) || item.risk !== 'low' || item.missingLockfile)
    .map((item) => {
      const workspaceNode = workspaceById.get(item.workspaceId)
      const failedOperations = failedOperationCount(root, item, operations)
      const anchors = rollbackAnchors(item, workspaceNode?.snapshotPath, failedOperations)
      const strategies = rollbackStrategies(item, anchors)
      const status = itemStatus(item, anchors, failedOperations)
      const priority = itemPriority(item, status)
      const rollbackActions = rollbackActionList(item, workspaceNode?.snapshotPath, anchors)
      const commands = rollbackCommands(item)
      const verificationCommands = verificationCommandsFor(item.managerId, item.workspaceRelativePath)
      const warnings = rollbackWarnings(item, anchors, failedOperations)

      return {
        id: `rollback:${item.id}`,
        priority,
        status,
        workspaceId: item.workspaceId,
        workspaceName: item.workspaceName,
        workspaceRelativePath: item.workspaceRelativePath,
        managerId: item.managerId,
        managerName: item.managerName,
        risk: item.risk,
        updateStatus: item.status,
        snapshotSource: item.snapshotSource,
        snapshotCount: item.snapshotCount,
        snapshotPath: workspaceNode?.snapshotPath,
        manifestFiles: item.manifestFiles,
        lockFiles: item.lockFiles,
        strategies,
        anchors,
        rollbackActions,
        commands,
        verificationCommands,
        warnings,
        evidence: [
          `Update risk: ${item.risk}`,
          `Update status: ${item.status}`,
          `Snapshot source: ${item.snapshotSource}; snapshots: ${item.snapshotCount}`,
          `Readiness: ${item.readinessStatus}; blocked checks: ${item.readinessBlockedCheckCount}`,
          `Recent failed operations: ${failedOperations}`,
          ...item.evidence.slice(0, 6)
        ],
        recentFailedOperationCount: failedOperations,
        recommendation: recommendationFor(status, anchors, item)
      }
    })
    .sort((a, b) => statusRank(b.status) - statusRank(a.status) ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      a.workspaceRelativePath.localeCompare(b.workspaceRelativePath) ||
      a.managerId.localeCompare(b.managerId))
    .slice(0, 250)
}

function rollbackAnchors(
  item: WorkspaceUpdatePlanItem,
  snapshotPath: string | undefined,
  failedOperations: number
): DependencyRollbackAnchor[] {
  const anchors: DependencyRollbackAnchor[] = []
  if (item.snapshotSource !== 'none' && item.snapshotCount > 0) {
    anchors.push({
      kind: 'managed-snapshot',
      status: 'ready',
      label: item.snapshotSource === 'inherited-root' ? 'Inherited managed snapshot' : 'Workspace managed snapshot',
      path: snapshotPath,
      count: item.snapshotCount
    })
  } else {
    anchors.push({
      kind: 'managed-snapshot',
      status: item.lockFiles.length > 0 || item.manifestFiles.length > 0 ? 'warning' : 'blocked',
      label: 'No managed dependency snapshot',
      count: 0
    })
  }

  anchors.push({
    kind: 'source-control',
    status: item.manifestFiles.length + item.lockFiles.length > 0 ? 'ready' : 'blocked',
    label: 'Source-control restore set',
    count: item.manifestFiles.length + item.lockFiles.length
  })

  anchors.push({
    kind: 'manifest',
    status: item.manifestFiles.length > 0 ? 'ready' : 'warning',
    label: 'Dependency manifests',
    count: item.manifestFiles.length
  })

  anchors.push({
    kind: 'lockfile',
    status: item.lockFiles.length > 0 ? 'ready' : 'warning',
    label: item.lockFiles.length > 0 ? 'Dependency lockfiles' : 'No lockfile rollback anchor',
    count: item.lockFiles.length
  })

  if (failedOperations > 0) {
    anchors.push({
      kind: 'operation-history',
      status: 'warning',
      label: 'Recent failed mutating operations',
      count: failedOperations
    })
  }

  return anchors
}

function rollbackStrategies(
  item: WorkspaceUpdatePlanItem,
  anchors: DependencyRollbackAnchor[]
): DependencyRollbackStrategy[] {
  const strategies: DependencyRollbackStrategy[] = []
  if (anchors.some((anchor) => anchor.kind === 'managed-snapshot' && anchor.status === 'ready')) {
    strategies.push('snapshot-restore')
  }
  if (anchors.some((anchor) => anchor.kind === 'source-control' && anchor.status === 'ready')) {
    strategies.push('source-control-restore')
  }
  if (item.lockFiles.length > 0) strategies.push('lockfile-restore')
  strategies.push('manager-rehydrate', 'verification')
  return unique(strategies)
}

function itemStatus(
  item: WorkspaceUpdatePlanItem,
  anchors: DependencyRollbackAnchor[],
  failedOperations: number
): DependencyRollbackPlanStatus {
  if (anchors.some((anchor) => anchor.status === 'blocked')) return 'blocked'
  if (
    item.snapshotSource === 'none' ||
    item.missingLockfile ||
    item.status === 'blocked' ||
    item.risk === 'blocked' ||
    item.readinessBlockedCheckCount > 0 ||
    failedOperations > 0 ||
    anchors.some((anchor) => anchor.status === 'warning')
  ) {
    return 'warning'
  }
  return 'ready'
}

function itemPriority(
  item: WorkspaceUpdatePlanItem,
  status: DependencyRollbackPlanStatus
): DependencyRollbackPlanPriority {
  if (status === 'blocked' || item.risk === 'blocked' || item.status === 'blocked' || item.readinessBlockedCheckCount > 0) return 'required'
  if (item.risk === 'high' || item.missingLockfile || item.snapshotSource === 'none') return 'recommended'
  return 'optional'
}

function rollbackActionList(
  item: WorkspaceUpdatePlanItem,
  snapshotPath: string | undefined,
  anchors: DependencyRollbackAnchor[]
): string[] {
  const actions = [
    `Pause or revert automation for ${item.managerId} updates in ${item.workspaceRelativePath || '.'}.`
  ]

  if (anchors.some((anchor) => anchor.kind === 'managed-snapshot' && anchor.status === 'ready')) {
    actions.push(`Restore the managed dependency snapshot${snapshotPath ? ` at ${snapshotPath}` : ' from the Health Center snapshot list'}.`)
  }

  if (item.manifestFiles.length + item.lockFiles.length > 0) {
    actions.push(`Restore source-controlled dependency files: ${item.manifestFiles.concat(item.lockFiles).slice(0, 12).join(', ')}.`)
  }

  if (item.lockFiles.length > 0) {
    actions.push('Rehydrate dependencies from restored lockfiles before running application tests.')
  } else {
    actions.push('Regenerate lockfiles from the restored manifest and review the diff before release.')
  }

  return unique(actions)
}

function rollbackCommands(item: WorkspaceUpdatePlanItem): string[] {
  const files = item.manifestFiles.concat(item.lockFiles)
  const commands = [
    files.length > 0 ? `git restore -- ${files.slice(0, 16).map(shellQuote).join(' ')}` : undefined,
    managerRestoreCommand(item.managerId, item.workspaceRelativePath),
    item.lockFiles.length === 0 ? managerLockCommand(item.managerId, item.workspaceRelativePath) : undefined
  ].filter(Boolean) as string[]
  return unique(commands)
}

function verificationCommandsFor(managerId: DependencyManagerId, workspaceRelativePath: string): string[] {
  const prefix = commandPrefix(workspaceRelativePath)
  switch (managerId) {
    case 'npm':
      return [`${prefix}npm install --package-lock-only --ignore-scripts`, `${prefix}npm test --if-present`, `${prefix}npm audit --audit-level=high`]
    case 'pnpm':
      return [`${prefix}pnpm install --frozen-lockfile`, `${prefix}pnpm test --if-present`, `${prefix}pnpm audit --audit-level high`]
    case 'yarn':
      return [`${prefix}yarn install --immutable`, `${prefix}yarn test`, `${prefix}yarn npm audit`]
    case 'bun':
      return [`${prefix}bun install --frozen-lockfile`, `${prefix}bun test`]
    case 'pip':
      return [`${prefix}python -m pip check`, `${prefix}python -m pip list --outdated`]
    case 'uv':
      return [`${prefix}uv pip check`, `${prefix}uv lock --check`]
    case 'poetry':
      return [`${prefix}poetry check`, `${prefix}poetry lock --check`]
    case 'pipenv':
      return [`${prefix}pipenv check`, `${prefix}pipenv verify`]
    case 'conda':
      return [`${prefix}conda env export`, `${prefix}conda list`]
    case 'maven':
      return [`${prefix}mvn -q test`, `${prefix}mvn -q dependency:tree`]
    case 'gradle':
      return [`${prefix}./gradlew test`, `${prefix}./gradlew dependencies`]
    case 'cargo':
      return [`${prefix}cargo test`, `${prefix}cargo tree`]
    case 'go':
      return [`${prefix}go mod verify`, `${prefix}go test ./...`]
    case 'flutter':
      return [`${prefix}flutter pub get`, `${prefix}flutter test`]
    case 'nuget':
      return [`${prefix}dotnet restore --locked-mode`, `${prefix}dotnet test`]
    case 'composer':
      return [`${prefix}composer validate --strict`, `${prefix}composer audit`]
    case 'bundler':
      return [`${prefix}bundle check`, `${prefix}bundle exec rake test`]
    case 'docker':
      return [`${prefix}docker compose config`, `${prefix}docker compose pull --ignore-buildable`]
    case 'helm':
      return [`${prefix}helm dependency build`, `${prefix}helm lint .`]
    case 'terraform':
    case 'opentofu':
      return [`${prefix}${managerId === 'opentofu' ? 'tofu' : 'terraform'} init -lockfile=readonly`, `${prefix}${managerId === 'opentofu' ? 'tofu' : 'terraform'} plan -lock=false`]
    default:
      return [`${prefix}Run ${managerId} dependency validation after rollback.`]
  }
}

function managerRestoreCommand(managerId: DependencyManagerId, workspaceRelativePath: string): string {
  const prefix = commandPrefix(workspaceRelativePath)
  switch (managerId) {
    case 'npm':
      return `${prefix}npm ci`
    case 'pnpm':
      return `${prefix}pnpm install --frozen-lockfile`
    case 'yarn':
      return `${prefix}yarn install --immutable`
    case 'bun':
      return `${prefix}bun install --frozen-lockfile`
    case 'pip':
      return `${prefix}python -m pip install -r requirements.txt`
    case 'uv':
      return `${prefix}uv sync --frozen`
    case 'poetry':
      return `${prefix}poetry install --sync`
    case 'pipenv':
      return `${prefix}pipenv sync`
    case 'conda':
      return `${prefix}conda env update --file environment.yml --prune`
    case 'maven':
      return `${prefix}mvn -q dependency:go-offline`
    case 'gradle':
      return `${prefix}./gradlew dependencies`
    case 'cargo':
      return `${prefix}cargo fetch --locked`
    case 'go':
      return `${prefix}go mod download`
    case 'flutter':
      return `${prefix}flutter pub get`
    case 'nuget':
      return `${prefix}dotnet restore --locked-mode`
    case 'composer':
      return `${prefix}composer install --no-interaction`
    case 'bundler':
      return `${prefix}bundle install`
    case 'deno':
      return `${prefix}deno cache --lock=deno.lock`
    case 'swiftpm':
      return `${prefix}swift package resolve`
    case 'cocoapods':
      return `${prefix}pod install`
    case 'sbt':
      return `${prefix}sbt update`
    case 'leiningen':
      return `${prefix}lein deps`
    case 'mix':
      return `${prefix}mix deps.get`
    case 'rebar3':
      return `${prefix}rebar3 get-deps`
    case 'cabal':
      return `${prefix}cabal update && cabal build --dry-run`
    case 'stack':
      return `${prefix}stack build --dry-run`
    case 'renv':
      return `${prefix}Rscript -e "renv::restore(prompt = FALSE)"`
    case 'julia':
      return `${prefix}julia --project=. -e "using Pkg; Pkg.instantiate()"`
    case 'docker':
      return `${prefix}docker compose pull --ignore-buildable`
    case 'helm':
      return `${prefix}helm dependency build`
    case 'kustomize':
      return `${prefix}kustomize build .`
    case 'terraform':
      return `${prefix}terraform init -lockfile=readonly`
    case 'opentofu':
      return `${prefix}tofu init -lockfile=readonly`
    case 'ansible':
      return `${prefix}ansible-galaxy install -r requirements.yml --force`
    default:
      return `${prefix}Run ${managerId} dependency restore from the reverted manifest and lockfile.`
  }
}

function managerLockCommand(managerId: DependencyManagerId, workspaceRelativePath: string): string | undefined {
  const prefix = commandPrefix(workspaceRelativePath)
  switch (managerId) {
    case 'npm':
      return `${prefix}npm install --package-lock-only`
    case 'pnpm':
      return `${prefix}pnpm install --lockfile-only`
    case 'yarn':
      return `${prefix}yarn install --mode=update-lockfile`
    case 'pip':
      return `${prefix}python -m pip freeze > requirements.txt`
    case 'poetry':
      return `${prefix}poetry lock`
    case 'cargo':
      return `${prefix}cargo generate-lockfile`
    case 'go':
      return `${prefix}go mod tidy`
    default:
      return undefined
  }
}

function rollbackWarnings(
  item: WorkspaceUpdatePlanItem,
  anchors: DependencyRollbackAnchor[],
  failedOperations: number
): string[] {
  const warnings: string[] = []
  if (item.snapshotSource === 'none') warnings.push('No managed snapshot is available before this dependency update.')
  if (item.lockFiles.length === 0) warnings.push('No lockfile was detected for this manager/workspace.')
  if (item.readinessBlockedCheckCount > 0) warnings.push('Release readiness is currently blocked for this workspace.')
  if (failedOperations > 0) warnings.push('Recent failed mutating operations should be reviewed before rollback.')
  if (anchors.some((anchor) => anchor.status === 'blocked')) warnings.push('Rollback coverage is incomplete for this workspace.')
  return unique(warnings.concat(item.warnings.slice(0, 5)))
}

function recommendationFor(
  status: DependencyRollbackPlanStatus,
  anchors: DependencyRollbackAnchor[],
  item: WorkspaceUpdatePlanItem
): string {
  if (status === 'blocked') {
    return 'Create a managed snapshot or source-control baseline before applying dependency changes; do not run the upgrade until rollback coverage exists.'
  }
  if (anchors.some((anchor) => anchor.kind === 'managed-snapshot' && anchor.status !== 'ready')) {
    return 'Create a managed dependency snapshot, export this rollback plan, then run the upgrade playbook.'
  }
  if (item.missingLockfile) {
    return 'Generate or restore a lockfile so rollback can rehydrate dependencies deterministically.'
  }
  return 'Keep the managed snapshot and source-control restore command with the upgrade ticket, then rerun verification after rollback or upgrade.'
}

function failedOperationCount(
  root: string,
  item: WorkspaceUpdatePlanItem,
  operations: OperationHistoryRecord[]
): number {
  const workspacePath = resolve(item.workspacePath || root)
  return operations.filter((record) => {
    const classification = record.classification
    if (classification?.managerId && classification.managerId !== item.managerId) return false
    if (record.status !== 'error') return false
    const cwd = resolve(record.cwd || root)
    return cwd === workspacePath || cwd === root || isInside(workspacePath, cwd) || isInside(cwd, workspacePath)
  }).length
}

function summarize(
  items: DependencyRollbackPlanItem[],
  operationHistory: OperationHistorySummary,
  errors: Partial<Record<DependencyRollbackPlanSource, string>>
): DependencyRollbackPlanSummary {
  const blockedItemCount = items.filter((item) => item.status === 'blocked').length
  const warningItemCount = items.filter((item) => item.status === 'warning').length
  const status: DependencyRollbackPlanStatus = blockedItemCount > 0 || Object.keys(errors).length > 0
    ? 'blocked'
    : warningItemCount > 0
      ? 'warning'
      : 'ready'

  return {
    status,
    itemCount: items.length,
    readyItemCount: items.filter((item) => item.status === 'ready').length,
    warningItemCount,
    blockedItemCount,
    requiredItemCount: items.filter((item) => item.priority === 'required').length,
    recommendedItemCount: items.filter((item) => item.priority === 'recommended').length,
    optionalItemCount: items.filter((item) => item.priority === 'optional').length,
    workspaceCount: unique(items.map((item) => item.workspaceRelativePath)).length,
    managerCount: unique(items.map((item) => item.managerId)).length,
    snapshotCoveredItemCount: items.filter((item) => item.anchors.some((anchor) => anchor.kind === 'managed-snapshot' && anchor.status === 'ready')).length,
    lockfileCoveredItemCount: items.filter((item) => item.lockFiles.length > 0).length,
    manifestCoveredItemCount: items.filter((item) => item.manifestFiles.length > 0).length,
    sourceControlCommandCount: items.filter((item) => item.commands.some((command) => command.startsWith('git restore'))).length,
    rollbackActionCount: sum(items.map((item) => item.rollbackActions.length)),
    verificationCommandCount: sum(items.map((item) => item.verificationCommands.length)),
    recentFailedOperationCount: operationHistory.error,
    sourceErrorCount: Object.keys(errors).length
  }
}

function renderMarkdown(report: DependencyRollbackPlanReport): string {
  const lines = [
    '# Dependency Rollback Plan',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Items: ${report.summary.itemCount}`,
    `- Required/recommended/optional: ${report.summary.requiredItemCount}/${report.summary.recommendedItemCount}/${report.summary.optionalItemCount}`,
    `- Blocked/warning/ready: ${report.summary.blockedItemCount}/${report.summary.warningItemCount}/${report.summary.readyItemCount}`,
    `- Snapshot-covered items: ${report.summary.snapshotCoveredItemCount}`,
    `- Lockfile-covered items: ${report.summary.lockfileCoveredItemCount}`,
    `- Source-control restore commands: ${report.summary.sourceControlCommandCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    `- Recent failed mutating operations: ${report.summary.recentFailedOperationCount}`,
    `- Source errors: ${report.summary.sourceErrorCount}`,
    '',
    '## Rollback Index',
    '',
    '| Priority | Status | Workspace | Manager | Anchors | Actions | Verify | Recommendation |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- |'
  ]

  for (const item of report.items) {
    lines.push([
      item.priority,
      item.status,
      markdownCell(item.workspaceRelativePath || '.'),
      item.managerId,
      item.anchors.filter((anchor) => anchor.status === 'ready').length,
      item.rollbackActions.length,
      item.verificationCommands.length,
      markdownCell(item.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('')
  for (const item of report.items.slice(0, 60)) {
    lines.push(
      `### ${item.workspaceRelativePath || '.'} - ${item.managerId}`,
      '',
      `- Priority: ${item.priority}`,
      `- Status: ${item.status}`,
      `- Snapshot: ${item.snapshotSource} (${item.snapshotCount})`,
      `- Snapshot path: ${item.snapshotPath || '-'}`,
      `- Manifests: ${item.manifestFiles.join(', ') || '-'}`,
      `- Lockfiles: ${item.lockFiles.join(', ') || '-'}`,
      `- Strategies: ${item.strategies.join(', ')}`,
      `- Recommendation: ${item.recommendation}`,
      '',
      'Rollback actions:',
      ...item.rollbackActions.map((action) => `- ${action}`),
      '',
      'Commands:',
      ...(item.commands.length > 0 ? item.commands.map((command) => `- ${command}`) : ['- No command generated.']),
      '',
      'Verification:',
      ...item.verificationCommands.map((command) => `- ${command}`),
      ''
    )
  }

  lines.push('## Source Errors', '')
  const errors = Object.entries(report.sources.errors)
  if (errors.length === 0) {
    lines.push('- No source collection errors.')
  } else {
    for (const [source, error] of errors) {
      lines.push(`- ${source}: ${error}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function exportResult(
  path: string,
  format: 'markdown' | 'json',
  report: DependencyRollbackPlanReport
): DependencyRollbackPlanExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    itemCount: report.summary.itemCount,
    blockedItemCount: report.summary.blockedItemCount,
    summary: report.summary
  }
}

function sourceErrors(
  governanceResult: CaptureResult<WorkspaceGovernanceReport>,
  updateResult: CaptureResult<WorkspaceUpdatePlan>,
  operationResult: CaptureResult<OperationHistoryRecord[]>
): Partial<Record<DependencyRollbackPlanSource, string>> {
  return {
    ...(governanceResult.error ? { 'workspace-governance': governanceResult.error } : {}),
    ...(updateResult.error ? { 'workspace-update-plan': updateResult.error } : {}),
    ...(operationResult.error ? { 'operation-history': operationResult.error } : {})
  }
}

async function capture<T>(factory: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await factory() }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function commandPrefix(workspaceRelativePath: string): string {
  if (!workspaceRelativePath || workspaceRelativePath === '.') return ''
  return `cd ${shellQuote(workspaceRelativePath)} && `
}

function shellQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!!rel && !rel.startsWith('..') && !rel.startsWith('/') && !rel.startsWith('\\'))
}

function statusRank(status: DependencyRollbackPlanStatus): number {
  if (status === 'blocked') return 3
  if (status === 'warning') return 2
  return 1
}

function priorityRank(priority: DependencyRollbackPlanPriority): number {
  if (priority === 'required') return 1
  if (priority === 'recommended') return 2
  return 3
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
