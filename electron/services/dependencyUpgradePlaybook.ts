import { access, mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { DependencyManagerId } from '../../shared/managerRegistry'
import {
  DependencyAutomationPlanService,
  type DependencyAutomationPlanReport,
  type DependencyAutomationProvider
} from './dependencyAutomationPlan'
import {
  DependencyOwnershipPlanService,
  type DependencyOwnershipPlanReport
} from './dependencyOwnershipPlan'
import {
  ReleaseRiskProfileService,
  type ReleaseRiskProfileReport,
  type ReleaseRiskSeverity
} from './releaseRiskProfile'
import {
  VulnerabilityRemediationPlanService,
  type VulnerabilityRemediationPlanReport,
  type VulnerabilityRemediationPriority
} from './vulnerabilityRemediationPlan'
import {
  WorkspaceGovernanceService,
  type WorkspaceUpdatePlan,
  type WorkspaceUpdatePlanItem,
  type WorkspaceUpdatePlanRisk
} from './workspaceGovernance'

export type DependencyUpgradePlaybookStatus = 'ready' | 'warning' | 'blocked'
export type DependencyUpgradeLaneKind =
  | 'security-hotfix'
  | 'release-blocker'
  | 'risk-review'
  | 'routine-update'
  | 'automation-onboarding'
  | 'ownership-routing'
export type DependencyUpgradeLanePriority = 'immediate' | 'urgent' | 'scheduled' | 'backlog'
export type DependencyUpgradePlaybookSource =
  | 'workspace-update-plan'
  | 'vulnerability-remediation-plan'
  | 'release-risk-profile'
  | 'dependency-automation-plan'
  | 'dependency-ownership-plan'

export interface DependencyUpgradePlaybookItem {
  id: string
  lane: DependencyUpgradeLaneKind
  priority: DependencyUpgradeLanePriority
  status: DependencyUpgradePlaybookStatus
  title: string
  summary: string
  recommendation: string
  managerId?: DependencyManagerId
  workspaceRelativePath?: string
  packageName?: string
  owners: string[]
  automationProviders: DependencyAutomationProvider[]
  commands: string[]
  verificationCommands: string[]
  evidence: string[]
}

export interface DependencyUpgradePlaybookLane {
  id: DependencyUpgradeLaneKind
  title: string
  priority: DependencyUpgradeLanePriority
  status: DependencyUpgradePlaybookStatus
  itemCount: number
  blockedItemCount: number
  warningItemCount: number
  managerCount: number
  workspaceCount: number
  commandCount: number
  items: DependencyUpgradePlaybookItem[]
}

export interface DependencyUpgradePlaybookSummary {
  status: DependencyUpgradePlaybookStatus
  laneCount: number
  itemCount: number
  blockedItemCount: number
  warningItemCount: number
  readyItemCount: number
  immediateItemCount: number
  urgentItemCount: number
  scheduledItemCount: number
  backlogItemCount: number
  securityItemCount: number
  releaseBlockerItemCount: number
  automationItemCount: number
  ownershipItemCount: number
  workspaceCount: number
  managerCount: number
  commandCount: number
  verificationCommandCount: number
  ownerCount: number
  sourceErrorCount: number
}

export interface DependencyUpgradePlaybookReport {
  generatedAt: string
  projectPath: string
  status: DependencyUpgradePlaybookStatus
  summary: DependencyUpgradePlaybookSummary
  lanes: DependencyUpgradePlaybookLane[]
  items: DependencyUpgradePlaybookItem[]
  sources: {
    updatePlan?: Pick<WorkspaceUpdatePlan, 'generatedAt' | 'summary'>
    vulnerabilityRemediation?: Pick<VulnerabilityRemediationPlanReport, 'generatedAt' | 'status' | 'summary'>
    releaseRisk?: Pick<ReleaseRiskProfileReport, 'generatedAt' | 'status' | 'score' | 'summary'>
    automation?: Pick<DependencyAutomationPlanReport, 'generatedAt' | 'status' | 'summary'>
    ownership?: Pick<DependencyOwnershipPlanReport, 'generatedAt' | 'status' | 'summary'>
    errors: Partial<Record<DependencyUpgradePlaybookSource, string>>
  }
}

export interface DependencyUpgradePlaybookExportResult {
  path: string
  format: 'markdown' | 'json'
  generatedAt: string
  status: DependencyUpgradePlaybookStatus
  itemCount: number
  laneCount: number
  summary: DependencyUpgradePlaybookSummary
}

export interface DependencyUpgradePlaybookDependencies {
  workspaceGovernanceService?: WorkspaceGovernanceService
  vulnerabilityRemediationPlanService?: VulnerabilityRemediationPlanService
  releaseRiskProfileService?: ReleaseRiskProfileService
  dependencyAutomationPlanService?: DependencyAutomationPlanService
  dependencyOwnershipPlanService?: DependencyOwnershipPlanService
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const OUTPUT_STEM = 'dependency-upgrade-playbook'

export class DependencyUpgradePlaybookService {
  private readonly workspaceGovernanceService: WorkspaceGovernanceService
  private readonly vulnerabilityRemediationPlanService: VulnerabilityRemediationPlanService
  private readonly releaseRiskProfileService: ReleaseRiskProfileService
  private readonly dependencyAutomationPlanService: DependencyAutomationPlanService
  private readonly dependencyOwnershipPlanService: DependencyOwnershipPlanService

  constructor(dependencies: DependencyUpgradePlaybookDependencies = {}) {
    this.workspaceGovernanceService = dependencies.workspaceGovernanceService || new WorkspaceGovernanceService()
    this.vulnerabilityRemediationPlanService = dependencies.vulnerabilityRemediationPlanService || new VulnerabilityRemediationPlanService()
    this.releaseRiskProfileService = dependencies.releaseRiskProfileService || new ReleaseRiskProfileService()
    this.dependencyAutomationPlanService = dependencies.dependencyAutomationPlanService || new DependencyAutomationPlanService()
    this.dependencyOwnershipPlanService = dependencies.dependencyOwnershipPlanService || new DependencyOwnershipPlanService()
  }

  async report(projectPath: string): Promise<DependencyUpgradePlaybookReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const [updateResult, remediationResult, riskResult, automationResult, ownershipResult] = await Promise.all([
      capture(() => this.workspaceGovernanceService.updatePlan(root)),
      capture(() => this.vulnerabilityRemediationPlanService.plan(root)),
      capture(() => this.releaseRiskProfileService.report(root)),
      capture(() => this.dependencyAutomationPlanService.plan(root)),
      capture(() => this.dependencyOwnershipPlanService.plan(root))
    ])
    const errors = sourceErrors(updateResult, remediationResult, riskResult, automationResult, ownershipResult)
    const items = buildItems({
      updatePlan: updateResult.value,
      remediation: remediationResult.value,
      risk: riskResult.value,
      automation: automationResult.value,
      ownership: ownershipResult.value
    })
    const lanes = buildLanes(items)
    const summary = summarize(items, lanes, errors)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      lanes,
      items,
      sources: {
        updatePlan: updateResult.value
          ? {
              generatedAt: updateResult.value.generatedAt,
              summary: updateResult.value.summary
            }
          : undefined,
        vulnerabilityRemediation: remediationResult.value
          ? {
              generatedAt: remediationResult.value.generatedAt,
              status: remediationResult.value.status,
              summary: remediationResult.value.summary
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
        automation: automationResult.value
          ? {
              generatedAt: automationResult.value.generatedAt,
              status: automationResult.value.status,
              summary: automationResult.value.summary
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

  async exportMarkdown(projectPath: string): Promise<DependencyUpgradePlaybookExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyUpgradePlaybookExportResult> {
    const report = await this.report(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, `${OUTPUT_STEM}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }
}

function buildItems(input: {
  updatePlan?: WorkspaceUpdatePlan
  remediation?: VulnerabilityRemediationPlanReport
  risk?: ReleaseRiskProfileReport
  automation?: DependencyAutomationPlanReport
  ownership?: DependencyOwnershipPlanReport
}): DependencyUpgradePlaybookItem[] {
  const ownershipMap = ownerMap(input.ownership)
  const automationMap = providerMap(input.automation)
  const items = [
    ...securityItems(input.remediation, ownershipMap, automationMap),
    ...releaseBlockerItems(input.updatePlan, ownershipMap, automationMap),
    ...riskReviewItems(input.risk, ownershipMap, automationMap),
    ...routineUpdateItems(input.updatePlan, ownershipMap, automationMap),
    ...automationItems(input.automation, ownershipMap),
    ...ownershipItems(input.ownership)
  ]
  return uniqueBy(items, (item) => item.id)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) ||
      statusRank(b.status) - statusRank(a.status) ||
      laneRank(a.lane) - laneRank(b.lane) ||
      a.title.localeCompare(b.title))
    .slice(0, 400)
}

function securityItems(
  remediation: VulnerabilityRemediationPlanReport | undefined,
  owners: Map<string, string[]>,
  providers: Map<string, DependencyAutomationProvider[]>
): DependencyUpgradePlaybookItem[] {
  return (remediation?.items || [])
    .filter((item) => item.priority === 'immediate' || item.priority === 'urgent' || item.status === 'blocked')
    .map((item) => {
      const key = workspaceManagerKey(item.workspaceRelativePath, item.managerId)
      return normalizeItem({
        id: `security:${item.id}`,
        lane: 'security-hotfix',
        priority: remediationPriority(item.priority),
        status: item.status === 'blocked' ? 'blocked' : 'warning',
        title: item.title,
        summary: item.summary,
        recommendation: item.recommendation,
        managerId: item.managerId,
        workspaceRelativePath: item.workspaceRelativePath,
        packageName: item.packageName,
        owners: owners.get(key) || [],
        automationProviders: providers.get(key) || [],
        commands: [item.recommendedCommand].filter(Boolean),
        verificationCommands: [item.verificationCommand].filter(Boolean),
        evidence: [
          `Priority: ${item.priority}`,
          `Severity: ${item.severity}`,
          `Fix available: ${item.fixAvailable ? 'yes' : 'no'}`,
          `Vulnerabilities: ${item.vulnerabilityIds.join(', ') || '-'}`
        ]
      })
    })
}

function releaseBlockerItems(
  updatePlan: WorkspaceUpdatePlan | undefined,
  owners: Map<string, string[]>,
  providers: Map<string, DependencyAutomationProvider[]>
): DependencyUpgradePlaybookItem[] {
  return (updatePlan?.items || [])
    .filter((item) => item.status === 'blocked' || item.risk === 'blocked' || item.readinessBlockedCheckCount > 0)
    .map((item) => updatePlanPlaybookItem(item, 'release-blocker', 'immediate', owners, providers))
}

function routineUpdateItems(
  updatePlan: WorkspaceUpdatePlan | undefined,
  owners: Map<string, string[]>,
  providers: Map<string, DependencyAutomationProvider[]>
): DependencyUpgradePlaybookItem[] {
  return (updatePlan?.items || [])
    .filter((item) => item.status !== 'blocked' && item.risk !== 'blocked')
    .slice(0, 80)
    .map((item) => updatePlanPlaybookItem(
      item,
      'routine-update',
      item.risk === 'high' || item.status === 'needs-review' ? 'urgent' : 'scheduled',
      owners,
      providers
    ))
}

function riskReviewItems(
  risk: ReleaseRiskProfileReport | undefined,
  owners: Map<string, string[]>,
  providers: Map<string, DependencyAutomationProvider[]>
): DependencyUpgradePlaybookItem[] {
  return (risk?.topRisks || [])
    .filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
    .slice(0, 30)
    .map((finding) => {
      const key = workspaceManagerKey(finding.workspaceRelativePath, finding.managerId)
      return normalizeItem({
        id: `risk:${finding.id}`,
        lane: 'risk-review',
        priority: severityPriority(finding.severity),
        status: finding.severity === 'critical' ? 'blocked' : 'warning',
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        managerId: finding.managerId,
        workspaceRelativePath: finding.workspaceRelativePath,
        owners: owners.get(key) || [],
        automationProviders: providers.get(key) || [],
        commands: [],
        verificationCommands: ['Run release risk profile after mitigation.'],
        evidence: [
          `Category: ${finding.category}`,
          `Source: ${finding.source}`,
          `Severity: ${finding.severity}`,
          ...finding.evidence
        ]
      })
    })
}

function automationItems(
  automation: DependencyAutomationPlanReport | undefined,
  owners: Map<string, string[]>
): DependencyUpgradePlaybookItem[] {
  const targetItems = (automation?.targets || [])
    .filter((target) => target.supported)
    .slice(0, 40)
    .map((target) => {
      const key = workspaceManagerKey(target.workspaceRelativePath, target.managerId)
      return normalizeItem({
        id: `automation:${target.provider}:${target.id}`,
        lane: 'automation-onboarding',
        priority: target.requiredSecrets.length > 0 ? 'urgent' : 'scheduled',
        status: target.requiredSecrets.length > 0 ? 'warning' : 'ready',
        title: `Enable ${target.provider} for ${target.workspaceName} ${target.managerId}`,
        summary: `${target.provider} can manage ${target.managerId} updates in ${target.directory}.`,
        recommendation: target.requiredSecrets.length > 0
          ? `Configure required secrets before enabling this automation target: ${target.requiredSecrets.join(', ')}.`
          : 'Enable the generated automation configuration after owners review update safety rules.',
        managerId: target.managerId,
        workspaceRelativePath: target.workspaceRelativePath,
        owners: owners.get(key) || [],
        automationProviders: [target.provider],
        commands: [],
        verificationCommands: [`Review generated ${target.provider} configuration.`],
        evidence: [
          `Directory: ${target.directory}`,
          `Schedule: ${target.schedule}`,
          `Group: ${target.groupName}`,
          `Security updates: ${target.securityUpdates ? 'yes' : 'no'}`
        ]
      })
    })
  const warningItems = (automation?.warnings || [])
    .filter((warning) => warning.severity !== 'info')
    .slice(0, 30)
    .map((warning) => {
      const key = workspaceManagerKey(warning.workspaceRelativePath, warning.managerId)
      return normalizeItem({
        id: `automation-warning:${warning.id}`,
        lane: 'automation-onboarding',
        priority: warning.severity === 'blocked' ? 'urgent' : 'scheduled',
        status: warning.severity === 'blocked' ? 'blocked' : 'warning',
        title: warning.title,
        summary: warning.summary,
        recommendation: warning.recommendation,
        managerId: warning.managerId,
        workspaceRelativePath: warning.workspaceRelativePath,
        owners: owners.get(key) || [],
        automationProviders: [],
        commands: [],
        verificationCommands: ['Regenerate dependency automation plan after remediation.'],
        evidence: warning.evidence
      })
    })
  return [...warningItems, ...targetItems]
}

function ownershipItems(ownership: DependencyOwnershipPlanReport | undefined): DependencyUpgradePlaybookItem[] {
  return [
    ...(ownership?.assignments || [])
      .filter((assignment) => assignment.source === 'missing' || assignment.owners.length === 0)
      .slice(0, 40)
      .map((assignment) => normalizeItem({
        id: `ownership:${assignment.id}`,
        lane: 'ownership-routing',
        priority: 'urgent',
        status: 'warning',
        title: `Assign dependency owners for ${assignment.workspaceName} ${assignment.managerId}`,
        summary: `${assignment.workspaceRelativePath} has no matching dependency owners for ${assignment.managerName}.`,
        recommendation: assignment.recommendation,
        managerId: assignment.managerId,
        workspaceRelativePath: assignment.workspaceRelativePath,
        owners: assignment.owners,
        automationProviders: [],
        commands: [],
        verificationCommands: ['Regenerate dependency ownership plan after CODEOWNERS changes.'],
        evidence: [
          `Manifest files: ${assignment.manifestFiles.join(', ') || '-'}`,
          `Lock files: ${assignment.lockFiles.join(', ') || '-'}`,
          `Suggested source: ${assignment.source}`
        ]
      })),
    ...(ownership?.reviewRoutes || [])
      .filter((route) => route.status === 'blocked')
      .slice(0, 20)
      .map((route) => normalizeItem({
        id: `review-route:${route.id}`,
        lane: 'ownership-routing',
        priority: 'immediate',
        status: 'blocked',
        title: `Unblock ${route.provider} ${route.updateType} route`,
        summary: route.rationale,
        recommendation: route.escalation,
        managerId: route.managerId,
        workspaceRelativePath: route.workspaceRelativePath,
        owners: route.owners,
        automationProviders: [route.provider],
        commands: [],
        verificationCommands: ['Regenerate dependency ownership plan after assigning reviewers.'],
        evidence: [
          `Required approvals: ${route.requiredApprovals}`,
          `Required evidence: ${route.requiredEvidence.join(', ') || '-'}`,
          `Decision: ${route.decision}`
        ]
      }))
  ]
}

function updatePlanPlaybookItem(
  item: WorkspaceUpdatePlanItem,
  lane: DependencyUpgradeLaneKind,
  priority: DependencyUpgradeLanePriority,
  owners: Map<string, string[]>,
  providers: Map<string, DependencyAutomationProvider[]>
): DependencyUpgradePlaybookItem {
  const key = workspaceManagerKey(item.workspaceRelativePath, item.managerId)
  const commands = item.commands.filter((command) => command.mutating).map((command) => command.command)
  const verificationCommands = item.commands
    .filter((command) => !command.mutating || command.stage === 'verify' || command.stage === 'audit' || command.stage === 'lock')
    .map((command) => command.command)
  return normalizeItem({
    id: `${lane}:${item.id}`,
    lane,
    priority,
    status: item.status === 'blocked' || item.risk === 'blocked'
      ? 'blocked'
      : item.status === 'needs-review' || item.risk === 'high' || item.risk === 'medium'
        ? 'warning'
        : 'ready',
    title: `${item.managerName} updates for ${item.workspaceName}`,
    summary: `${item.componentCount} component(s), ${item.risk} risk, readiness ${item.readinessStatus}.`,
    recommendation: item.recommendation,
    managerId: item.managerId,
    workspaceRelativePath: item.workspaceRelativePath,
    owners: owners.get(key) || [],
    automationProviders: providers.get(key) || [],
    commands,
    verificationCommands,
    evidence: [
      `Manifests: ${item.manifestFiles.join(', ') || '-'}`,
      `Lockfiles: ${item.lockFiles.join(', ') || '-'}`,
      `Missing lockfile: ${item.missingLockfile ? 'yes' : 'no'}`,
      `Warnings: ${item.warnings.join('; ') || '-'}`,
      ...item.evidence
    ]
  })
}

function buildLanes(items: DependencyUpgradePlaybookItem[]): DependencyUpgradePlaybookLane[] {
  return LANE_ORDER.map((lane) => {
    const laneItems = items.filter((item) => item.lane === lane)
    return {
      id: lane,
      title: laneTitle(lane),
      priority: lanePriority(lane, laneItems),
      status: laneStatus(laneItems),
      itemCount: laneItems.length,
      blockedItemCount: laneItems.filter((item) => item.status === 'blocked').length,
      warningItemCount: laneItems.filter((item) => item.status === 'warning').length,
      managerCount: unique(laneItems.map((item) => item.managerId).filter(Boolean) as string[]).length,
      workspaceCount: unique(laneItems.map((item) => item.workspaceRelativePath).filter(Boolean) as string[]).length,
      commandCount: sum(laneItems.map((item) => item.commands.length)),
      items: laneItems
    }
  }).filter((lane) => lane.itemCount > 0)
}

function summarize(
  items: DependencyUpgradePlaybookItem[],
  lanes: DependencyUpgradePlaybookLane[],
  errors: Partial<Record<DependencyUpgradePlaybookSource, string>>
): DependencyUpgradePlaybookSummary {
  const blockedItemCount = items.filter((item) => item.status === 'blocked').length
  const warningItemCount = items.filter((item) => item.status === 'warning').length
  const status: DependencyUpgradePlaybookStatus = blockedItemCount > 0 || Object.keys(errors).length > 0
    ? 'blocked'
    : warningItemCount > 0
      ? 'warning'
      : 'ready'
  return {
    status,
    laneCount: lanes.length,
    itemCount: items.length,
    blockedItemCount,
    warningItemCount,
    readyItemCount: items.filter((item) => item.status === 'ready').length,
    immediateItemCount: items.filter((item) => item.priority === 'immediate').length,
    urgentItemCount: items.filter((item) => item.priority === 'urgent').length,
    scheduledItemCount: items.filter((item) => item.priority === 'scheduled').length,
    backlogItemCount: items.filter((item) => item.priority === 'backlog').length,
    securityItemCount: items.filter((item) => item.lane === 'security-hotfix').length,
    releaseBlockerItemCount: items.filter((item) => item.lane === 'release-blocker').length,
    automationItemCount: items.filter((item) => item.lane === 'automation-onboarding').length,
    ownershipItemCount: items.filter((item) => item.lane === 'ownership-routing').length,
    workspaceCount: unique(items.map((item) => item.workspaceRelativePath).filter(Boolean) as string[]).length,
    managerCount: unique(items.map((item) => item.managerId).filter(Boolean) as string[]).length,
    commandCount: sum(items.map((item) => item.commands.length)),
    verificationCommandCount: sum(items.map((item) => item.verificationCommands.length)),
    ownerCount: unique(items.flatMap((item) => item.owners)).length,
    sourceErrorCount: Object.keys(errors).length
  }
}

function renderMarkdown(report: DependencyUpgradePlaybookReport): string {
  const lines = [
    '# Dependency Upgrade Playbook',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Lanes: ${report.summary.laneCount}`,
    `- Items: ${report.summary.itemCount}`,
    `- Immediate/urgent/scheduled/backlog: ${report.summary.immediateItemCount}/${report.summary.urgentItemCount}/${report.summary.scheduledItemCount}/${report.summary.backlogItemCount}`,
    `- Blocked/warning/ready: ${report.summary.blockedItemCount}/${report.summary.warningItemCount}/${report.summary.readyItemCount}`,
    `- Security items: ${report.summary.securityItemCount}`,
    `- Release blockers: ${report.summary.releaseBlockerItemCount}`,
    `- Automation items: ${report.summary.automationItemCount}`,
    `- Ownership items: ${report.summary.ownershipItemCount}`,
    `- Commands: ${report.summary.commandCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    `- Source errors: ${report.summary.sourceErrorCount}`,
    ''
  ]

  for (const lane of report.lanes) {
    lines.push(
      `## ${lane.title}`,
      '',
      `- Priority: ${lane.priority}`,
      `- Status: ${lane.status}`,
      `- Items: ${lane.itemCount}`,
      `- Commands: ${lane.commandCount}`,
      '',
      '| Priority | Status | Workspace | Manager | Item | Owners | Commands |',
      '| --- | --- | --- | --- | --- | --- | ---: |'
    )
    for (const item of lane.items.slice(0, 30)) {
      lines.push([
        item.priority,
        item.status,
        markdownCell(item.workspaceRelativePath || '-'),
        item.managerId || '-',
        markdownCell(item.title),
        markdownCell(item.owners.join(', ') || '-'),
        item.commands.length
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
    lines.push('')
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

function sourceErrors(
  updateResult: CaptureResult<WorkspaceUpdatePlan>,
  remediationResult: CaptureResult<VulnerabilityRemediationPlanReport>,
  riskResult: CaptureResult<ReleaseRiskProfileReport>,
  automationResult: CaptureResult<DependencyAutomationPlanReport>,
  ownershipResult: CaptureResult<DependencyOwnershipPlanReport>
): Partial<Record<DependencyUpgradePlaybookSource, string>> {
  return {
    ...(updateResult.error ? { 'workspace-update-plan': updateResult.error } : {}),
    ...(remediationResult.error ? { 'vulnerability-remediation-plan': remediationResult.error } : {}),
    ...(riskResult.error ? { 'release-risk-profile': riskResult.error } : {}),
    ...(automationResult.error ? { 'dependency-automation-plan': automationResult.error } : {}),
    ...(ownershipResult.error ? { 'dependency-ownership-plan': ownershipResult.error } : {})
  }
}

function exportResult(
  path: string,
  format: 'markdown' | 'json',
  report: DependencyUpgradePlaybookReport
): DependencyUpgradePlaybookExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    itemCount: report.summary.itemCount,
    laneCount: report.summary.laneCount,
    summary: report.summary
  }
}

function normalizeItem(item: DependencyUpgradePlaybookItem): DependencyUpgradePlaybookItem {
  return {
    ...item,
    owners: unique(item.owners).sort(),
    automationProviders: unique(item.automationProviders).sort() as DependencyAutomationProvider[],
    commands: unique(item.commands).slice(0, 12),
    verificationCommands: unique(item.verificationCommands).slice(0, 12),
    evidence: unique(item.evidence).slice(0, 20)
  }
}

function ownerMap(ownership: DependencyOwnershipPlanReport | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const assignment of ownership?.assignments || []) {
    map.set(workspaceManagerKey(assignment.workspaceRelativePath, assignment.managerId), assignment.owners)
  }
  return map
}

function providerMap(automation: DependencyAutomationPlanReport | undefined): Map<string, DependencyAutomationProvider[]> {
  const map = new Map<string, DependencyAutomationProvider[]>()
  for (const target of automation?.targets || []) {
    const key = workspaceManagerKey(target.workspaceRelativePath, target.managerId)
    map.set(key, unique([...(map.get(key) || []), target.provider]) as DependencyAutomationProvider[])
  }
  return map
}

function workspaceManagerKey(workspaceRelativePath?: string, managerId?: DependencyManagerId): string {
  return `${workspaceRelativePath || '.'}:${managerId || 'unknown'}`
}

function remediationPriority(priority: VulnerabilityRemediationPriority): DependencyUpgradeLanePriority {
  if (priority === 'immediate') return 'immediate'
  if (priority === 'urgent') return 'urgent'
  if (priority === 'scheduled') return 'scheduled'
  return 'backlog'
}

function severityPriority(severity: ReleaseRiskSeverity): DependencyUpgradeLanePriority {
  if (severity === 'critical') return 'immediate'
  if (severity === 'high') return 'urgent'
  if (severity === 'medium') return 'scheduled'
  return 'backlog'
}

function lanePriority(lane: DependencyUpgradeLaneKind, items: DependencyUpgradePlaybookItem[]): DependencyUpgradeLanePriority {
  if (items.some((item) => item.priority === 'immediate')) return 'immediate'
  if (items.some((item) => item.priority === 'urgent')) return 'urgent'
  if (items.some((item) => item.priority === 'scheduled')) return 'scheduled'
  return lane === 'routine-update' ? 'scheduled' : 'backlog'
}

function laneStatus(items: DependencyUpgradePlaybookItem[]): DependencyUpgradePlaybookStatus {
  if (items.some((item) => item.status === 'blocked')) return 'blocked'
  if (items.some((item) => item.status === 'warning')) return 'warning'
  return 'ready'
}

const LANE_ORDER: DependencyUpgradeLaneKind[] = [
  'security-hotfix',
  'release-blocker',
  'risk-review',
  'routine-update',
  'automation-onboarding',
  'ownership-routing'
]

function laneTitle(lane: DependencyUpgradeLaneKind): string {
  if (lane === 'security-hotfix') return 'Security Hotfix Lane'
  if (lane === 'release-blocker') return 'Release Blocker Lane'
  if (lane === 'risk-review') return 'Risk Review Lane'
  if (lane === 'routine-update') return 'Routine Update Lane'
  if (lane === 'automation-onboarding') return 'Automation Onboarding Lane'
  return 'Ownership Routing Lane'
}

function laneRank(lane: DependencyUpgradeLaneKind): number {
  return LANE_ORDER.indexOf(lane)
}

function priorityRank(priority: DependencyUpgradeLanePriority): number {
  if (priority === 'immediate') return 0
  if (priority === 'urgent') return 1
  if (priority === 'scheduled') return 2
  return 3
}

function statusRank(status: DependencyUpgradePlaybookStatus): number {
  if (status === 'blocked') return 3
  if (status === 'warning') return 2
  return 1
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items.filter((item) => item !== undefined && item !== null))]
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
