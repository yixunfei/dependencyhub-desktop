import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  CiIntegrationPlanService,
  type CiIntegrationJob,
  type CiIntegrationPlanReport
} from './ciIntegrationPlan'
import {
  DependencyOwnershipPlanService,
  type DependencyOwnershipPlanReport
} from './dependencyOwnershipPlan'
import {
  DependencyRollbackPlanService,
  type DependencyRollbackPlanReport
} from './dependencyRollbackPlan'
import {
  DependencyUpgradePlaybookService,
  type DependencyUpgradePlaybookReport
} from './dependencyUpgradePlaybook'
import {
  ReleaseRiskProfileService,
  type ReleaseRiskProfileFinding,
  type ReleaseRiskProfileReport,
  type ReleaseRiskSeverity
} from './releaseRiskProfile'
import {
  WorkspaceGovernanceService,
  type WorkspaceUpdatePlan,
  type WorkspaceUpdatePlanItem,
  type WorkspaceUpdatePlanRisk
} from './workspaceGovernance'

export type DependencyImpactAnalysisStatus = 'ready' | 'warning' | 'blocked'
export type DependencyImpactSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type DependencyImpactDimension =
  | 'workspace'
  | 'manager'
  | 'owner'
  | 'ci'
  | 'release-gate'
  | 'security'
  | 'rollback'
  | 'automation'
export type DependencyImpactAnalysisSource =
  | 'workspace-update-plan'
  | 'dependency-upgrade-playbook'
  | 'dependency-rollback-plan'
  | 'release-risk-profile'
  | 'ci-integration-plan'
  | 'dependency-ownership-plan'

export interface DependencyImpactCiJobRef {
  id: string
  name: string
  runner: string
  stepCount: number
  requiredSecrets: string[]
  artifacts: string[]
}

export interface DependencyImpactRiskRef {
  id: string
  severity: ReleaseRiskSeverity
  category: string
  source: string
  title: string
}

export interface DependencyImpactAnalysisItem {
  id: string
  severity: DependencyImpactSeverity
  status: DependencyImpactAnalysisStatus
  dimensions: DependencyImpactDimension[]
  workspaceId: string
  workspaceName: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  managerName: string
  risk: WorkspaceUpdatePlanRisk
  updateStatus: WorkspaceUpdatePlanItem['status']
  owners: string[]
  ownerStatus: 'assigned' | 'missing'
  manifestFiles: string[]
  lockFiles: string[]
  impactedFiles: string[]
  ciJobs: DependencyImpactCiJobRef[]
  riskFindings: DependencyImpactRiskRef[]
  upgradeItemCount: number
  upgradeLanes: string[]
  rollbackStatus?: DependencyImpactAnalysisStatus
  rollbackStrategyCount: number
  rollbackActionCount: number
  rollbackCommandCount: number
  verificationCommands: string[]
  releaseGateCount: number
  automationProviderCount: number
  evidence: string[]
  recommendation: string
}

export interface DependencyImpactAnalysisSummary {
  status: DependencyImpactAnalysisStatus
  itemCount: number
  blockedItemCount: number
  warningItemCount: number
  readyItemCount: number
  criticalItemCount: number
  highItemCount: number
  mediumItemCount: number
  workspaceCount: number
  managerCount: number
  ownerCount: number
  missingOwnerItemCount: number
  ciJobCount: number
  ciImpactedItemCount: number
  releaseGateImpactCount: number
  securityImpactCount: number
  rollbackBlockedItemCount: number
  rollbackWarningItemCount: number
  verificationCommandCount: number
  automationProviderCount: number
  sourceErrorCount: number
}

export interface DependencyImpactAnalysisReport {
  generatedAt: string
  projectPath: string
  status: DependencyImpactAnalysisStatus
  summary: DependencyImpactAnalysisSummary
  items: DependencyImpactAnalysisItem[]
  sources: {
    updatePlan?: Pick<WorkspaceUpdatePlan, 'generatedAt' | 'summary'>
    upgradePlaybook?: Pick<DependencyUpgradePlaybookReport, 'generatedAt' | 'status' | 'summary'>
    rollbackPlan?: Pick<DependencyRollbackPlanReport, 'generatedAt' | 'status' | 'summary'>
    releaseRisk?: Pick<ReleaseRiskProfileReport, 'generatedAt' | 'status' | 'score' | 'summary'>
    ciIntegration?: Pick<CiIntegrationPlanReport, 'generatedAt' | 'status' | 'summary'>
    ownership?: Pick<DependencyOwnershipPlanReport, 'generatedAt' | 'status' | 'summary'>
    errors: Partial<Record<DependencyImpactAnalysisSource, string>>
  }
}

export interface DependencyImpactAnalysisExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: DependencyImpactAnalysisStatus
  itemCount: number
  summary: DependencyImpactAnalysisSummary
}

export interface DependencyImpactAnalysisDependencies {
  workspaceGovernanceService?: WorkspaceGovernanceService
  dependencyUpgradePlaybookService?: DependencyUpgradePlaybookService
  dependencyRollbackPlanService?: DependencyRollbackPlanService
  releaseRiskProfileService?: ReleaseRiskProfileService
  ciIntegrationPlanService?: CiIntegrationPlanService
  dependencyOwnershipPlanService?: DependencyOwnershipPlanService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'dependency-impact-analysis'

export class DependencyImpactAnalysisService {
  private readonly workspaceGovernanceService: WorkspaceGovernanceService
  private readonly dependencyUpgradePlaybookService: DependencyUpgradePlaybookService
  private readonly dependencyRollbackPlanService: DependencyRollbackPlanService
  private readonly releaseRiskProfileService: ReleaseRiskProfileService
  private readonly ciIntegrationPlanService: CiIntegrationPlanService
  private readonly dependencyOwnershipPlanService: DependencyOwnershipPlanService

  constructor(dependencies: DependencyImpactAnalysisDependencies = {}) {
    this.workspaceGovernanceService = dependencies.workspaceGovernanceService || new WorkspaceGovernanceService()
    this.dependencyUpgradePlaybookService = dependencies.dependencyUpgradePlaybookService || new DependencyUpgradePlaybookService({
      workspaceGovernanceService: this.workspaceGovernanceService
    })
    this.dependencyRollbackPlanService = dependencies.dependencyRollbackPlanService || new DependencyRollbackPlanService({
      workspaceGovernanceService: this.workspaceGovernanceService
    })
    this.releaseRiskProfileService = dependencies.releaseRiskProfileService || new ReleaseRiskProfileService()
    this.ciIntegrationPlanService = dependencies.ciIntegrationPlanService || new CiIntegrationPlanService()
    this.dependencyOwnershipPlanService = dependencies.dependencyOwnershipPlanService || new DependencyOwnershipPlanService()
  }

  async report(projectPath: string): Promise<DependencyImpactAnalysisReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [updateResult, upgradeResult, rollbackResult, riskResult, ciResult, ownershipResult] = await Promise.all([
      capture(() => this.workspaceGovernanceService.updatePlan(root)),
      capture(() => this.dependencyUpgradePlaybookService.report(root)),
      capture(() => this.dependencyRollbackPlanService.report(root)),
      capture(() => this.releaseRiskProfileService.report(root)),
      capture(() => this.ciIntegrationPlanService.plan(root)),
      capture(() => this.dependencyOwnershipPlanService.plan(root))
    ])
    const errors = sourceErrors(updateResult, upgradeResult, rollbackResult, riskResult, ciResult, ownershipResult)
    const items = buildItems({
      updatePlan: updateResult.value,
      upgradePlaybook: upgradeResult.value,
      rollbackPlan: rollbackResult.value,
      releaseRisk: riskResult.value,
      ciIntegration: ciResult.value,
      ownership: ownershipResult.value
    })
    const summary = summarize(items, errors)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      items,
      sources: {
        updatePlan: updateResult.value
          ? {
              generatedAt: updateResult.value.generatedAt,
              summary: updateResult.value.summary
            }
          : undefined,
        upgradePlaybook: upgradeResult.value
          ? {
              generatedAt: upgradeResult.value.generatedAt,
              status: upgradeResult.value.status,
              summary: upgradeResult.value.summary
            }
          : undefined,
        rollbackPlan: rollbackResult.value
          ? {
              generatedAt: rollbackResult.value.generatedAt,
              status: rollbackResult.value.status,
              summary: rollbackResult.value.summary
            }
          : undefined,
        releaseRisk: riskResult.value
          ? {
              generatedAt: riskResult.value.generatedAt,
              status: riskResult.value.status,
              score: riskResult.value.score,
              summary: riskResult.value.summary
            }
          : undefined,
        ciIntegration: ciResult.value
          ? {
              generatedAt: ciResult.value.generatedAt,
              status: ciResult.value.status,
              summary: ciResult.value.summary
            }
          : undefined,
        ownership: ownershipResult.value
          ? {
              generatedAt: ownershipResult.value.generatedAt,
              status: ownershipResult.value.status,
              summary: ownershipResult.value.summary
            }
          : undefined,
        errors
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<DependencyImpactAnalysisExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyImpactAnalysisExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function buildItems(input: {
  updatePlan?: WorkspaceUpdatePlan
  upgradePlaybook?: DependencyUpgradePlaybookReport
  rollbackPlan?: DependencyRollbackPlanReport
  releaseRisk?: ReleaseRiskProfileReport
  ciIntegration?: CiIntegrationPlanReport
  ownership?: DependencyOwnershipPlanReport
}): DependencyImpactAnalysisItem[] {
  const owners = ownerMap(input.ownership)
  const risks = riskMap(input.releaseRisk)
  const ciJobs = ciJobMap(input.ciIntegration)
  const upgrades = upgradeMap(input.upgradePlaybook)
  const rollbacks = rollbackMap(input.rollbackPlan)

  return (input.updatePlan?.items || [])
    .map<DependencyImpactAnalysisItem>((item) => {
      const key = workspaceManagerKey(item.workspaceRelativePath, item.managerId)
      const ownerList = owners.get(key) || []
      const riskFindings = risks.get(key) || []
      const jobs = ciJobs.get(key) || []
      const upgradeItems = upgrades.get(key) || []
      const rollbackItem = rollbacks.get(key)
      const severity = impactSeverity(item, riskFindings, rollbackItem?.status)
      const status = impactStatus(severity, item, ownerList, rollbackItem?.status)
      const verificationCommands = unique([
        ...item.commands.filter((command) => !command.mutating).map((command) => command.command),
        ...upgradeItems.flatMap((upgrade) => upgrade.verificationCommands),
        ...(rollbackItem?.verificationCommands || []),
        ...jobs.flatMap((job) => job.artifacts.map((artifact) => `Review CI artifact: ${artifact}`))
      ]).slice(0, 20)
      const releaseGateCount = item.readinessBlockedCheckCount + riskFindings.filter((risk) => risk.severity === 'critical' || risk.severity === 'high').length
      const automationProviderCount = unique(upgradeItems.flatMap((upgrade) => upgrade.automationProviders)).length
      const dimensions = impactDimensions(item, ownerList, jobs, riskFindings, rollbackItem?.status, automationProviderCount)

      return {
        id: `impact:${item.id}`,
        severity,
        status,
        dimensions,
        workspaceId: item.workspaceId,
        workspaceName: item.workspaceName,
        workspaceRelativePath: item.workspaceRelativePath,
        managerId: item.managerId,
        managerName: item.managerName,
        risk: item.risk,
        updateStatus: item.status,
        owners: ownerList,
        ownerStatus: ownerList.length > 0 ? 'assigned' : 'missing',
        manifestFiles: item.manifestFiles,
        lockFiles: item.lockFiles,
        impactedFiles: unique(item.manifestFiles.concat(item.lockFiles)),
        ciJobs: jobs,
        riskFindings,
        upgradeItemCount: upgradeItems.length,
        upgradeLanes: unique(upgradeItems.map((upgrade) => upgrade.lane)),
        rollbackStatus: rollbackItem?.status,
        rollbackStrategyCount: rollbackItem?.strategies.length || 0,
        rollbackActionCount: rollbackItem?.rollbackActions.length || 0,
        rollbackCommandCount: rollbackItem?.commands.length || 0,
        verificationCommands,
        releaseGateCount,
        automationProviderCount,
        evidence: [
          `Update risk: ${item.risk}`,
          `Update status: ${item.status}`,
          `Readiness: ${item.readinessStatus}; blocked checks: ${item.readinessBlockedCheckCount}; warning checks: ${item.readinessWarningCheckCount}`,
          `Owners: ${ownerList.join(', ') || 'missing'}`,
          `CI jobs: ${jobs.map((job) => job.id).join(', ') || 'none'}`,
          `Rollback status: ${rollbackItem?.status || 'missing'}`,
          ...riskFindings.slice(0, 5).map((risk) => `${risk.severity}: ${risk.title}`)
        ],
        recommendation: recommendationFor(status, item, ownerList, jobs, riskFindings, rollbackItem?.status)
      }
    })
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) ||
      statusRank(b.status) - statusRank(a.status) ||
      b.releaseGateCount - a.releaseGateCount ||
      a.workspaceRelativePath.localeCompare(b.workspaceRelativePath) ||
      a.managerId.localeCompare(b.managerId))
    .slice(0, 300)
}

function ownerMap(ownership: DependencyOwnershipPlanReport | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const assignment of ownership?.assignments || []) {
    map.set(workspaceManagerKey(assignment.workspaceRelativePath, assignment.managerId), assignment.owners)
  }
  return map
}

function riskMap(risk: ReleaseRiskProfileReport | undefined): Map<string, DependencyImpactRiskRef[]> {
  const map = new Map<string, DependencyImpactRiskRef[]>()
  for (const finding of risk?.findings || []) {
    const key = workspaceManagerKey(finding.workspaceRelativePath, finding.managerId)
    if (!key) continue
    const items = map.get(key) || []
    items.push(riskRef(finding))
    map.set(key, items)
  }
  return map
}

function ciJobMap(ci: CiIntegrationPlanReport | undefined): Map<string, DependencyImpactCiJobRef[]> {
  const map = new Map<string, DependencyImpactCiJobRef[]>()
  for (const job of ci?.jobs || []) {
    for (const entry of job.matrix) {
      for (const managerId of entry.managerIds) {
        const key = workspaceManagerKey(entry.workspaceRelativePath, managerId)
        const items = map.get(key) || []
        items.push(ciRef(job))
        map.set(key, uniqueBy(items, (item) => item.id))
      }
    }
  }
  return map
}

function upgradeMap(upgrade: DependencyUpgradePlaybookReport | undefined): Map<string, DependencyUpgradePlaybookReport['items']> {
  const map = new Map<string, DependencyUpgradePlaybookReport['items']>()
  for (const item of upgrade?.items || []) {
    const key = workspaceManagerKey(item.workspaceRelativePath, item.managerId)
    if (!key) continue
    const items = map.get(key) || []
    items.push(item)
    map.set(key, items)
  }
  return map
}

function rollbackMap(rollback: DependencyRollbackPlanReport | undefined): Map<string, DependencyRollbackPlanReport['items'][number]> {
  const map = new Map<string, DependencyRollbackPlanReport['items'][number]>()
  for (const item of rollback?.items || []) {
    map.set(workspaceManagerKey(item.workspaceRelativePath, item.managerId), item)
  }
  return map
}

function riskRef(finding: ReleaseRiskProfileFinding): DependencyImpactRiskRef {
  return {
    id: finding.id,
    severity: finding.severity,
    category: finding.category,
    source: finding.source,
    title: finding.title
  }
}

function ciRef(job: CiIntegrationJob): DependencyImpactCiJobRef {
  return {
    id: job.id,
    name: job.name,
    runner: job.runner,
    stepCount: job.steps.length,
    requiredSecrets: job.requiredSecrets,
    artifacts: job.artifacts
  }
}

function impactSeverity(
  item: WorkspaceUpdatePlanItem,
  riskFindings: DependencyImpactRiskRef[],
  rollbackStatus: DependencyImpactAnalysisStatus | undefined
): DependencyImpactSeverity {
  if (item.risk === 'blocked' || item.status === 'blocked' || item.readinessBlockedCheckCount > 0 || riskFindings.some((risk) => risk.severity === 'critical') || rollbackStatus === 'blocked') return 'critical'
  if (item.risk === 'high' || riskFindings.some((risk) => risk.severity === 'high') || item.missingLockfile || rollbackStatus === 'warning') return 'high'
  if (item.risk === 'medium' || riskFindings.some((risk) => risk.severity === 'medium') || item.readinessWarningCheckCount > 0) return 'medium'
  if (item.risk === 'low') return 'low'
  return 'info'
}

function impactStatus(
  severity: DependencyImpactSeverity,
  item: WorkspaceUpdatePlanItem,
  owners: string[],
  rollbackStatus: DependencyImpactAnalysisStatus | undefined
): DependencyImpactAnalysisStatus {
  if (severity === 'critical' || item.status === 'blocked' || rollbackStatus === 'blocked') return 'blocked'
  if (severity === 'high' || item.status === 'needs-review' || owners.length === 0 || rollbackStatus === 'warning') return 'warning'
  return 'ready'
}

function impactDimensions(
  item: WorkspaceUpdatePlanItem,
  owners: string[],
  ciJobs: DependencyImpactCiJobRef[],
  riskFindings: DependencyImpactRiskRef[],
  rollbackStatus: DependencyImpactAnalysisStatus | undefined,
  automationProviderCount: number
): DependencyImpactDimension[] {
  return unique([
    'workspace',
    'manager',
    owners.length === 0 ? 'owner' : undefined,
    ciJobs.length > 0 ? 'ci' : undefined,
    item.readinessBlockedCheckCount > 0 || riskFindings.length > 0 ? 'release-gate' : undefined,
    riskFindings.some((risk) => risk.category === 'security') ? 'security' : undefined,
    rollbackStatus && rollbackStatus !== 'ready' ? 'rollback' : undefined,
    automationProviderCount > 0 ? 'automation' : undefined
  ].filter(Boolean) as DependencyImpactDimension[])
}

function recommendationFor(
  status: DependencyImpactAnalysisStatus,
  item: WorkspaceUpdatePlanItem,
  owners: string[],
  ciJobs: DependencyImpactCiJobRef[],
  riskFindings: DependencyImpactRiskRef[],
  rollbackStatus: DependencyImpactAnalysisStatus | undefined
): string {
  if (status === 'blocked') {
    return 'Do not apply this upgrade until blocked release gates, rollback coverage, and critical risk findings are resolved.'
  }
  if (owners.length === 0) {
    return 'Assign dependency owners before scheduling this upgrade and require manual review for the affected workspace.'
  }
  if (rollbackStatus && rollbackStatus !== 'ready') {
    return 'Create or refresh rollback evidence, then attach the rollback plan to the upgrade ticket.'
  }
  if (riskFindings.some((risk) => risk.severity === 'high')) {
    return 'Route this upgrade through release-risk review and run all impacted CI jobs before merging.'
  }
  if (ciJobs.length === 0) {
    return 'Add CI coverage for this workspace/manager before relying on automation for the upgrade.'
  }
  if (item.missingLockfile) {
    return 'Generate a lockfile or document why this ecosystem cannot lock dependencies before release.'
  }
  return 'Schedule the upgrade with listed owners, CI jobs, rollback actions, and verification commands.'
}

function summarize(
  items: DependencyImpactAnalysisItem[],
  errors: Partial<Record<DependencyImpactAnalysisSource, string>>
): DependencyImpactAnalysisSummary {
  const blockedItemCount = items.filter((item) => item.status === 'blocked').length
  const warningItemCount = items.filter((item) => item.status === 'warning').length
  const status: DependencyImpactAnalysisStatus = blockedItemCount > 0 || Object.keys(errors).length > 0
    ? 'blocked'
    : warningItemCount > 0
      ? 'warning'
      : 'ready'

  return {
    status,
    itemCount: items.length,
    blockedItemCount,
    warningItemCount,
    readyItemCount: items.filter((item) => item.status === 'ready').length,
    criticalItemCount: items.filter((item) => item.severity === 'critical').length,
    highItemCount: items.filter((item) => item.severity === 'high').length,
    mediumItemCount: items.filter((item) => item.severity === 'medium').length,
    workspaceCount: unique(items.map((item) => item.workspaceRelativePath)).length,
    managerCount: unique(items.map((item) => item.managerId)).length,
    ownerCount: unique(items.flatMap((item) => item.owners)).length,
    missingOwnerItemCount: items.filter((item) => item.ownerStatus === 'missing').length,
    ciJobCount: unique(items.flatMap((item) => item.ciJobs.map((job) => job.id))).length,
    ciImpactedItemCount: items.filter((item) => item.ciJobs.length > 0).length,
    releaseGateImpactCount: sum(items.map((item) => item.releaseGateCount)),
    securityImpactCount: items.filter((item) => item.dimensions.includes('security')).length,
    rollbackBlockedItemCount: items.filter((item) => item.rollbackStatus === 'blocked').length,
    rollbackWarningItemCount: items.filter((item) => item.rollbackStatus === 'warning').length,
    verificationCommandCount: sum(items.map((item) => item.verificationCommands.length)),
    automationProviderCount: sum(items.map((item) => item.automationProviderCount)),
    sourceErrorCount: Object.keys(errors).length
  }
}

function renderMarkdown(report: DependencyImpactAnalysisReport): string {
  const lines = [
    '# Dependency Impact Analysis',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Items: ${report.summary.itemCount}`,
    `- Critical/high/medium: ${report.summary.criticalItemCount}/${report.summary.highItemCount}/${report.summary.mediumItemCount}`,
    `- Blocked/warning/ready: ${report.summary.blockedItemCount}/${report.summary.warningItemCount}/${report.summary.readyItemCount}`,
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Managers: ${report.summary.managerCount}`,
    `- Owners: ${report.summary.ownerCount}`,
    `- Missing owner items: ${report.summary.missingOwnerItemCount}`,
    `- CI jobs: ${report.summary.ciJobCount}`,
    `- Release gate impacts: ${report.summary.releaseGateImpactCount}`,
    `- Security impacts: ${report.summary.securityImpactCount}`,
    `- Rollback blocked/warning: ${report.summary.rollbackBlockedItemCount}/${report.summary.rollbackWarningItemCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    `- Source errors: ${report.summary.sourceErrorCount}`,
    '',
    '## Impact Matrix',
    '',
    '| Severity | Status | Workspace | Manager | Owners | CI Jobs | Gates | Rollback | Verify | Recommendation |',
    '| --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | --- |'
  ]

  for (const item of report.items) {
    lines.push([
      item.severity,
      item.status,
      markdownCell(item.workspaceRelativePath || '.'),
      item.managerId,
      markdownCell(item.owners.join(', ') || 'missing'),
      item.ciJobs.length,
      item.releaseGateCount,
      item.rollbackStatus || '-',
      item.verificationCommands.length,
      markdownCell(item.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('')
  for (const item of report.items.slice(0, 60)) {
    lines.push(
      `### ${item.workspaceRelativePath || '.'} - ${item.managerId}`,
      '',
      `- Severity: ${item.severity}`,
      `- Status: ${item.status}`,
      `- Dimensions: ${item.dimensions.join(', ')}`,
      `- Owners: ${item.owners.join(', ') || 'missing'}`,
      `- Impacted files: ${item.impactedFiles.join(', ') || '-'}`,
      `- Upgrade lanes: ${item.upgradeLanes.join(', ') || '-'}`,
      `- Rollback status: ${item.rollbackStatus || '-'}`,
      `- CI jobs: ${item.ciJobs.map((job) => job.name).join(', ') || '-'}`,
      `- Risk findings: ${item.riskFindings.map((risk) => `${risk.severity}:${risk.title}`).join('; ') || '-'}`,
      `- Recommendation: ${item.recommendation}`,
      '',
      'Verification commands:',
      ...(item.verificationCommands.length > 0 ? item.verificationCommands.map((command) => `- ${command}`) : ['- No verification command generated.']),
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
  report: DependencyImpactAnalysisReport
): DependencyImpactAnalysisExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    itemCount: report.summary.itemCount,
    summary: report.summary
  }
}

function sourceErrors(
  updateResult: CaptureResult<WorkspaceUpdatePlan>,
  upgradeResult: CaptureResult<DependencyUpgradePlaybookReport>,
  rollbackResult: CaptureResult<DependencyRollbackPlanReport>,
  riskResult: CaptureResult<ReleaseRiskProfileReport>,
  ciResult: CaptureResult<CiIntegrationPlanReport>,
  ownershipResult: CaptureResult<DependencyOwnershipPlanReport>
): Partial<Record<DependencyImpactAnalysisSource, string>> {
  return {
    ...(updateResult.error ? { 'workspace-update-plan': updateResult.error } : {}),
    ...(upgradeResult.error ? { 'dependency-upgrade-playbook': upgradeResult.error } : {}),
    ...(rollbackResult.error ? { 'dependency-rollback-plan': rollbackResult.error } : {}),
    ...(riskResult.error ? { 'release-risk-profile': riskResult.error } : {}),
    ...(ciResult.error ? { 'ci-integration-plan': ciResult.error } : {}),
    ...(ownershipResult.error ? { 'dependency-ownership-plan': ownershipResult.error } : {})
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

function workspaceManagerKey(workspaceRelativePath?: string, managerId?: DependencyManagerId | string): string {
  if (!workspaceRelativePath || !managerId) return ''
  return `${workspaceRelativePath || '.'}:${managerId}`
}

function severityRank(severity: DependencyImpactSeverity): number {
  if (severity === 'critical') return 1
  if (severity === 'high') return 2
  if (severity === 'medium') return 3
  if (severity === 'low') return 4
  return 5
}

function statusRank(status: DependencyImpactAnalysisStatus): number {
  if (status === 'blocked') return 3
  if (status === 'warning') return 2
  return 1
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const id = key(value)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
