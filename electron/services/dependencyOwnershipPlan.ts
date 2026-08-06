import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  type DependencyManagerDefinition,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import {
  WorkspaceDiscoveryService,
  type WorkspaceDiscoveryReport,
  type WorkspaceNode
} from './workspaceDiscovery'
import {
  DependencyAutomationPlanService,
  type DependencyAutomationPlanReport,
  type DependencyAutomationProvider
} from './dependencyAutomationPlan'
import {
  AutomationSafetyPlanService,
  type AutomationSafetyDecision,
  type AutomationSafetyPlanReport,
  type AutomationSafetyRule,
  type AutomationUpdateType
} from './automationSafetyPlan'

export type DependencyOwnershipPlanExportFormat = 'markdown' | 'json' | 'codeowners'
export type DependencyOwnershipStatus = 'ready' | 'warning' | 'blocked'
export type DependencyOwnershipSource = 'codeowners' | 'missing'
export type DependencyOwnershipFindingSeverity = 'info' | 'warning' | 'blocked'
export type DependencyOwnershipFindingSource =
  | 'codeowners'
  | 'workspace-discovery'
  | 'dependency-automation'
  | 'automation-safety'
  | 'ownership-plan'

export interface CodeownersEntry {
  id: string
  path: string
  line: number
  pattern: string
  owners: string[]
  raw: string
}

export interface CodeownersSourceFile {
  path: string
  relativePath: string
  entryCount: number
}

export interface DependencyOwnerAssignment {
  id: string
  workspaceId: string
  workspaceName: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  managerName: string
  owners: string[]
  source: DependencyOwnershipSource
  matchedPatterns: string[]
  matchedFiles: string[]
  manifestFiles: string[]
  lockFiles: string[]
  automationTargetCount: number
  safetyRuleCount: number
  blockedSafetyRuleCount: number
  reviewRequired: boolean
  recommendation: string
}

export interface DependencyReviewRoute {
  id: string
  provider: DependencyAutomationProvider
  workspaceId: string
  workspaceName: string
  workspaceRelativePath: string
  managerId: DependencyManagerId
  updateType: AutomationUpdateType
  decision: AutomationSafetyDecision
  status: DependencyOwnershipStatus
  owners: string[]
  requiredApprovals: number
  requiredEvidence: string[]
  escalation: string
  rationale: string
}

export interface SuggestedCodeownersEntry {
  pattern: string
  owners: string[]
  reason: string
  workspaceId?: string
  workspaceRelativePath?: string
  managerId?: DependencyManagerId
}

export interface DependencyOwnershipFinding {
  id: string
  severity: DependencyOwnershipFindingSeverity
  source: DependencyOwnershipFindingSource
  title: string
  summary: string
  recommendation: string
  evidence: string[]
  workspaceId?: string
  workspaceName?: string
  workspaceRelativePath?: string
  managerId?: DependencyManagerId
}

export interface DependencyOwnershipPlanSummary {
  status: DependencyOwnershipStatus
  workspaceCount: number
  managerCount: number
  managers: DependencyManagerId[]
  assignmentCount: number
  ownedAssignmentCount: number
  missingOwnerAssignmentCount: number
  ownedWorkspaceCount: number
  missingOwnerWorkspaceCount: number
  ownerCount: number
  codeownersFileCount: number
  codeownersEntryCount: number
  reviewRouteCount: number
  readyReviewRouteCount: number
  warningReviewRouteCount: number
  blockedReviewRouteCount: number
  autoMergeRouteCount: number
  reviewRequiredRouteCount: number
  suggestedEntryCount: number
  findingCount: number
  blockedFindingCount: number
  warningFindingCount: number
  dependencyAutomationStatus?: DependencyOwnershipStatus
  automationSafetyStatus?: DependencyOwnershipStatus
}

export interface DependencyOwnershipPlanReport {
  generatedAt: string
  projectPath: string
  status: DependencyOwnershipStatus
  summary: DependencyOwnershipPlanSummary
  codeownersFiles: CodeownersSourceFile[]
  assignments: DependencyOwnerAssignment[]
  reviewRoutes: DependencyReviewRoute[]
  suggestedCodeowners: SuggestedCodeownersEntry[]
  suggestedCodeownersText: string
  findings: DependencyOwnershipFinding[]
  sources: {
    discovery: Pick<WorkspaceDiscoveryReport, 'generatedAt' | 'summary'>
    dependencyAutomation?: Pick<DependencyAutomationPlanReport, 'generatedAt' | 'status' | 'summary'>
    automationSafety?: Pick<AutomationSafetyPlanReport, 'generatedAt' | 'status' | 'summary'>
    errors: Partial<Record<DependencyOwnershipFindingSource, string>>
  }
}

export interface DependencyOwnershipPlanExportResult {
  path: string
  format: DependencyOwnershipPlanExportFormat
  generatedAt: string
  status: DependencyOwnershipStatus
  assignmentCount: number
  reviewRouteCount: number
  missingOwnerAssignmentCount: number
  findingCount: number
  count: number
  summary: DependencyOwnershipPlanSummary
}

export interface DependencyOwnershipPlanDependencies {
  workspaceDiscoveryService?: WorkspaceDiscoveryService
  dependencyAutomationPlanService?: DependencyAutomationPlanService
  automationSafetyPlanService?: AutomationSafetyPlanService
}

interface CodeownersReadResult {
  files: CodeownersSourceFile[]
  entries: CodeownersEntry[]
}

interface CaptureResult<T> {
  value?: T
  error?: string
}

const REPORT_DIR = '.npmDesktopManager/reports'
const CODEOWNERS_CANDIDATES = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']
const PLACEHOLDER_OWNER = '@dependency-owners'
const MANAGER_BY_ID = new Map(MANAGER_DEFINITIONS.map((manager) => [manager.id, manager]))

export class DependencyOwnershipPlanService {
  private readonly workspaceDiscoveryService: WorkspaceDiscoveryService
  private readonly dependencyAutomationPlanService: DependencyAutomationPlanService
  private readonly automationSafetyPlanService: AutomationSafetyPlanService

  constructor(dependencies: DependencyOwnershipPlanDependencies = {}) {
    this.workspaceDiscoveryService = dependencies.workspaceDiscoveryService || new WorkspaceDiscoveryService()
    this.dependencyAutomationPlanService = dependencies.dependencyAutomationPlanService || new DependencyAutomationPlanService({
      workspaceDiscoveryService: this.workspaceDiscoveryService
    })
    this.automationSafetyPlanService = dependencies.automationSafetyPlanService || new AutomationSafetyPlanService({
      dependencyAutomationPlanService: this.dependencyAutomationPlanService
    })
  }

  async plan(projectPath: string): Promise<DependencyOwnershipPlanReport> {
    if (!projectPath?.trim()) {
      throw new Error('Project path is required')
    }

    const root = resolve(projectPath)
    await access(root)
    const discovery = await this.workspaceDiscoveryService.report(root)
    const automationResult = await capture(() => this.dependencyAutomationPlanService.plan(root))
    const safetyResult = await capture(() => this.automationSafetyPlanService.plan(root))
    const codeowners = await readCodeowners(root)
    const assignments = buildAssignments(discovery, codeowners.entries, automationResult.value, safetyResult.value)
    const reviewRoutes = buildReviewRoutes(assignments, safetyResult.value)
    const suggestedCodeowners = buildSuggestions(assignments)
    const findings = buildFindings(assignments, reviewRoutes, codeowners, automationResult, safetyResult)
    const summary = summarize(discovery, codeowners, assignments, reviewRoutes, suggestedCodeowners, findings, automationResult.value, safetyResult.value)
    const suggestedCodeownersText = renderSuggestedCodeowners(suggestedCodeowners)

    return {
      generatedAt: new Date().toISOString(),
      projectPath: root,
      status: summary.status,
      summary,
      codeownersFiles: codeowners.files,
      assignments,
      reviewRoutes,
      suggestedCodeowners,
      suggestedCodeownersText,
      findings,
      sources: {
        discovery: {
          generatedAt: discovery.generatedAt,
          summary: discovery.summary
        },
        dependencyAutomation: automationResult.value
          ? {
              generatedAt: automationResult.value.generatedAt,
              status: automationResult.value.status,
              summary: automationResult.value.summary
            }
          : undefined,
        automationSafety: safetyResult.value
          ? {
              generatedAt: safetyResult.value.generatedAt,
              status: safetyResult.value.status,
              summary: safetyResult.value.summary
            }
          : undefined,
        errors: sourceErrors(automationResult, safetyResult)
      }
    }
  }

  async exportMarkdown(projectPath: string): Promise<DependencyOwnershipPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-ownership-plan.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderDependencyOwnershipMarkdown(report), 'utf-8')
    return exportResult(path, 'markdown', report)
  }

  async exportJson(projectPath: string): Promise<DependencyOwnershipPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-ownership-plan.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8')
    return exportResult(path, 'json', report)
  }

  async exportCodeowners(projectPath: string): Promise<DependencyOwnershipPlanExportResult> {
    const report = await this.plan(projectPath)
    const path = join(resolve(projectPath), REPORT_DIR, 'dependency-ownership', 'CODEOWNERS.suggested')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, report.suggestedCodeownersText, 'utf-8')
    return exportResult(path, 'codeowners', report)
  }
}

async function readCodeowners(root: string): Promise<CodeownersReadResult> {
  const files: CodeownersSourceFile[] = []
  const entries: CodeownersEntry[] = []

  for (const relativePath of CODEOWNERS_CANDIDATES) {
    const path = join(root, relativePath)
    const text = await readOptional(path)
    if (!text) continue
    const parsed = parseCodeownersFile(root, path, text)
    files.push({
      path,
      relativePath,
      entryCount: parsed.length
    })
    entries.push(...parsed)
  }

  return { files, entries }
}

function parseCodeownersFile(root: string, path: string, text: string): CodeownersEntry[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ raw: line, line: index + 1 }))
    .map(({ raw, line }) => {
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('#')) return null
      const parts = trimmed.split(/\s+/).filter(Boolean)
      if (parts.length < 2) return null
      const [pattern, ...owners] = parts
      return {
        id: `${toPosix(relative(root, path))}:${line}`,
        path,
        line,
        pattern,
        owners,
        raw
      }
    })
    .filter((entry): entry is CodeownersEntry => Boolean(entry))
}

function buildAssignments(
  discovery: WorkspaceDiscoveryReport,
  codeowners: CodeownersEntry[],
  automation?: DependencyAutomationPlanReport,
  safety?: AutomationSafetyPlanReport
): DependencyOwnerAssignment[] {
  const automationTargets = automation?.targets.filter((target) => target.supported) || []
  const safetyRules = safety?.rules || []
  return discovery.workspaces.flatMap((workspace) => workspace.managerIds.map((managerId) => {
    const manager = MANAGER_BY_ID.get(managerId)
    const paths = assignmentPaths(workspace, manager)
    const matches = findOwners(codeowners, paths)
    const owners = matches.owners
    const relatedTargets = automationTargets.filter((target) => target.workspaceId === workspace.id && target.managerId === managerId)
    const relatedRules = safetyRules.filter((rule) => rule.workspaceId === workspace.id && rule.managerId === managerId)
    const blockedSafetyRuleCount = relatedRules.filter((rule) => rule.decision === 'blocked').length
    const source: DependencyOwnershipSource = owners.length > 0 ? 'codeowners' : 'missing'
    return {
      id: `${workspace.id}:${managerId}`,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceRelativePath: workspace.relativePath,
      managerId,
      managerName: manager?.shortName || managerId,
      owners,
      source,
      matchedPatterns: matches.patterns,
      matchedFiles: matches.files,
      manifestFiles: filesForManager(workspace.manifestFiles, manager),
      lockFiles: filesForManager(workspace.lockFiles, manager),
      automationTargetCount: relatedTargets.length,
      safetyRuleCount: relatedRules.length,
      blockedSafetyRuleCount,
      reviewRequired: relatedRules.some((rule) => rule.decision !== 'auto-merge') || relatedTargets.length > 0,
      recommendation: recommendationForAssignment(workspace, managerId, owners, blockedSafetyRuleCount)
    }
  }))
}

function buildReviewRoutes(
  assignments: DependencyOwnerAssignment[],
  safety?: AutomationSafetyPlanReport
): DependencyReviewRoute[] {
  if (!safety) return []
  const assignmentByKey = new Map(assignments.map((assignment) => [`${assignment.workspaceId}:${assignment.managerId}`, assignment]))
  return safety.rules.map((rule) => {
    const assignment = assignmentByKey.get(`${rule.workspaceId}:${rule.managerId}`)
    const owners = assignment?.owners || []
    const status = routeStatus(rule, owners)
    return {
      id: `${rule.provider}:${rule.workspaceId}:${rule.managerId}:${rule.updateType}`,
      provider: rule.provider,
      workspaceId: rule.workspaceId,
      workspaceName: rule.workspaceName,
      workspaceRelativePath: rule.workspaceRelativePath,
      managerId: rule.managerId,
      updateType: rule.updateType,
      decision: rule.decision,
      status,
      owners,
      requiredApprovals: Math.max(rule.requiredApprovals, rule.decision === 'auto-merge' ? 0 : 1),
      requiredEvidence: rule.requiredEvidence,
      escalation: escalationForRoute(rule, owners),
      rationale: rule.rationale
    }
  })
}

function buildSuggestions(assignments: DependencyOwnerAssignment[]): SuggestedCodeownersEntry[] {
  const byWorkspace = new Map<string, DependencyOwnerAssignment[]>()
  for (const assignment of assignments.filter((item) => item.owners.length === 0)) {
    const existing = byWorkspace.get(assignment.workspaceId) || []
    existing.push(assignment)
    byWorkspace.set(assignment.workspaceId, existing)
  }

  return [...byWorkspace.values()].map((items) => {
    const first = items[0]
    return {
      pattern: suggestedPattern(first.workspaceRelativePath),
      owners: [PLACEHOLDER_OWNER],
      reason: `Add owners for ${first.workspaceName} (${first.workspaceRelativePath}) managers: ${items.map((item) => item.managerId).join(', ')}.`,
      workspaceId: first.workspaceId,
      workspaceRelativePath: first.workspaceRelativePath
    }
  }).sort((a, b) => a.pattern.localeCompare(b.pattern))
}

function buildFindings(
  assignments: DependencyOwnerAssignment[],
  routes: DependencyReviewRoute[],
  codeowners: CodeownersReadResult,
  automationResult: CaptureResult<DependencyAutomationPlanReport>,
  safetyResult: CaptureResult<AutomationSafetyPlanReport>
): DependencyOwnershipFinding[] {
  const findings: DependencyOwnershipFinding[] = []
  for (const [source, error] of Object.entries(sourceErrors(automationResult, safetyResult))) {
    if (!error) continue
    findings.push(finding({
      id: `${source}:source-error`,
      severity: 'warning',
      source: source as DependencyOwnershipFindingSource,
      title: `${source} evidence is unavailable`,
      summary: error,
      recommendation: 'Regenerate the dependency ownership plan after this evidence source is available.',
      evidence: [error]
    }))
  }

  if (codeowners.entries.length === 0) {
    findings.push(finding({
      id: 'codeowners:missing',
      severity: 'blocked',
      source: 'codeowners',
      title: 'No CODEOWNERS entries were found',
      summary: 'Dependency review routing cannot assign workspace or manager responsibility without ownership metadata.',
      recommendation: 'Add a CODEOWNERS file or export the suggested CODEOWNERS entries from this plan.',
      evidence: CODEOWNERS_CANDIDATES.map((path) => `Checked ${path}`)
    }))
  }

  for (const assignment of assignments.filter((item) => item.owners.length === 0).slice(0, 120)) {
    findings.push(finding({
      id: `owner:${assignment.id}:missing`,
      severity: 'blocked',
      source: 'ownership-plan',
      title: 'Dependency manager has no owner',
      summary: `${assignment.managerId} in ${assignment.workspaceRelativePath} has no CODEOWNERS match.`,
      recommendation: `Add ${suggestedPattern(assignment.workspaceRelativePath)} ${PLACEHOLDER_OWNER} or a more specific manager file owner.`,
      evidence: [
        `Workspace: ${assignment.workspaceName} (${assignment.workspaceRelativePath})`,
        `Manager: ${assignment.managerId}`,
        `Files: ${assignment.manifestFiles.concat(assignment.lockFiles).join(', ') || assignment.workspaceRelativePath}`
      ],
      workspaceId: assignment.workspaceId,
      workspaceName: assignment.workspaceName,
      workspaceRelativePath: assignment.workspaceRelativePath,
      managerId: assignment.managerId
    }))
  }

  for (const route of routes.filter((item) => item.status === 'blocked' && item.owners.length === 0).slice(0, 80)) {
    findings.push(finding({
      id: `route:${route.id}:missing-owner`,
      severity: 'blocked',
      source: 'automation-safety',
      title: 'Automation review route has no owner',
      summary: `${route.provider} ${route.updateType} updates for ${route.managerId} in ${route.workspaceRelativePath} cannot be routed to reviewers.`,
      recommendation: 'Add CODEOWNERS coverage before enabling automated dependency update pull requests.',
      evidence: [
        `Decision: ${route.decision}`,
        `Required approvals: ${route.requiredApprovals}`,
        route.rationale
      ],
      workspaceId: route.workspaceId,
      workspaceName: route.workspaceName,
      workspaceRelativePath: route.workspaceRelativePath,
      managerId: route.managerId
    }))
  }

  if (routes.length === 0) {
    findings.push(finding({
      id: 'automation-safety:no-routes',
      severity: 'warning',
      source: 'automation-safety',
      title: 'Automation safety routes are unavailable',
      summary: 'Ownership is available for workspaces, but update-type review routing could not be derived.',
      recommendation: 'Generate dependency automation and automation safety evidence before release review.',
      evidence: ['No automation safety rules were available.']
    }))
  }

  return uniqueBy(findings, (item) => item.id).slice(0, 300)
}

function summarize(
  discovery: WorkspaceDiscoveryReport,
  codeowners: CodeownersReadResult,
  assignments: DependencyOwnerAssignment[],
  routes: DependencyReviewRoute[],
  suggestions: SuggestedCodeownersEntry[],
  findings: DependencyOwnershipFinding[],
  automation?: DependencyAutomationPlanReport,
  safety?: AutomationSafetyPlanReport
): DependencyOwnershipPlanSummary {
  const managers = unique(assignments.map((assignment) => assignment.managerId)).sort() as DependencyManagerId[]
  const ownedAssignments = assignments.filter((assignment) => assignment.owners.length > 0)
  const missingOwnerWorkspaceIds = new Set(assignments.filter((assignment) => assignment.owners.length === 0).map((assignment) => assignment.workspaceId))
  const ownedWorkspaceIds = new Set(discovery.workspaces
    .filter((workspace) => workspace.managerIds.length > 0 && workspace.managerIds.every((managerId) => {
      const assignment = assignments.find((item) => item.workspaceId === workspace.id && item.managerId === managerId)
      return Boolean(assignment?.owners.length)
    }))
    .map((workspace) => workspace.id))
  const owners = unique(assignments.flatMap((assignment) => assignment.owners)).sort()
  const blockedFindingCount = findings.filter((finding) => finding.severity === 'blocked').length
  const warningFindingCount = findings.filter((finding) => finding.severity === 'warning').length
  const blockedReviewRouteCount = routes.filter((route) => route.status === 'blocked').length
  const warningReviewRouteCount = routes.filter((route) => route.status === 'warning').length
  const status: DependencyOwnershipStatus = blockedFindingCount > 0 || blockedReviewRouteCount > 0
    ? 'blocked'
    : warningFindingCount > 0 || warningReviewRouteCount > 0
      ? 'warning'
      : 'ready'

  return {
    status,
    workspaceCount: discovery.summary.workspaceCount,
    managerCount: managers.length,
    managers,
    assignmentCount: assignments.length,
    ownedAssignmentCount: ownedAssignments.length,
    missingOwnerAssignmentCount: assignments.length - ownedAssignments.length,
    ownedWorkspaceCount: ownedWorkspaceIds.size,
    missingOwnerWorkspaceCount: missingOwnerWorkspaceIds.size,
    ownerCount: owners.length,
    codeownersFileCount: codeowners.files.length,
    codeownersEntryCount: codeowners.entries.length,
    reviewRouteCount: routes.length,
    readyReviewRouteCount: routes.filter((route) => route.status === 'ready').length,
    warningReviewRouteCount,
    blockedReviewRouteCount,
    autoMergeRouteCount: routes.filter((route) => route.decision === 'auto-merge').length,
    reviewRequiredRouteCount: routes.filter((route) => route.requiredApprovals > 0).length,
    suggestedEntryCount: suggestions.length,
    findingCount: findings.length,
    blockedFindingCount,
    warningFindingCount,
    dependencyAutomationStatus: automation?.status,
    automationSafetyStatus: safety?.status
  }
}

function findOwners(entries: CodeownersEntry[], paths: string[]): { owners: string[]; patterns: string[]; files: string[] } {
  let owners: string[] = []
  const patterns: string[] = []
  const files = new Set<string>()

  for (const entry of entries) {
    const matched = paths.filter((path) => codeownersPatternMatches(entry.pattern, path))
    if (matched.length === 0) continue
    owners = entry.owners
    patterns.push(`${toPosix(relative(resolve(entry.path, '..'), entry.path)) || basename(entry.path)}:${entry.line}:${entry.pattern}`)
    matched.forEach((path) => files.add(path || '.'))
  }

  return {
    owners: unique(owners).sort(),
    patterns,
    files: [...files].sort()
  }
}

function assignmentPaths(workspace: WorkspaceNode, manager?: DependencyManagerDefinition): string[] {
  const files = [
    ...filesForManager(workspace.manifestFiles, manager),
    ...filesForManager(workspace.lockFiles, manager),
    ...filesForManager(workspace.configFiles, manager)
  ]
  const relativePath = workspace.relativePath === '.' ? '' : workspace.relativePath
  return unique([
    relativePath,
    relativePath ? `${relativePath}/` : '.',
    ...files
  ].filter(Boolean)).map(toPosix)
}

function filesForManager(files: string[], manager?: DependencyManagerDefinition): string[] {
  if (!manager) return files
  const patterns = [...manager.manifestFiles, ...manager.lockFiles, ...(manager.configFiles || [])]
  return files.filter((file) => patterns.some((pattern) => fileMatchesPattern(file, pattern)))
}

function fileMatchesPattern(file: string, pattern: string): boolean {
  const normalizedFile = toPosix(file)
  const fileName = basename(normalizedFile)
  if (pattern.includes('/') || pattern.includes('\\')) {
    return globToRegExp(toPosix(pattern), true).test(normalizedFile)
  }
  if (hasGlob(pattern)) {
    return globToRegExp(pattern, false).test(fileName)
  }
  return fileName === pattern
}

function codeownersPatternMatches(pattern: string, path: string): boolean {
  const normalizedPath = toPosix(path).replace(/^\/+/, '').replace(/\/+$/g, '')
  const normalizedPattern = toPosix(pattern).trim()
  if (!normalizedPattern) return false
  if (normalizedPattern === '*') return Boolean(normalizedPath)

  const anchored = normalizedPattern.startsWith('/')
  const body = normalizedPattern.replace(/^\/+/, '')
  const directoryPattern = body.endsWith('/')
  const cleaned = body.replace(/\/+$/g, '')

  if (!cleaned) return normalizedPath === '' || normalizedPath === '.'
  if (directoryPattern && !hasGlob(cleaned)) {
    return normalizedPath === cleaned || normalizedPath.startsWith(`${cleaned}/`)
  }

  if (!anchored && !cleaned.includes('/')) {
    const segments = normalizedPath.split('/').filter(Boolean)
    if (hasGlob(cleaned)) {
      const regex = globToRegExp(cleaned, true)
      return regex.test(normalizedPath) || segments.some((segment) => regex.test(segment))
    }
    return segments.includes(cleaned) || basename(normalizedPath) === cleaned
  }

  return globToRegExp(cleaned, anchored).test(normalizedPath)
}

function globToRegExp(pattern: string, anchored: boolean): RegExp {
  const normalized = toPosix(pattern).replace(/\/+$/g, '')
  let output = anchored ? '^' : '(^|.*/)'
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]
    if (char === '*' && next === '*') {
      output += '.*'
      index += 1
    } else if (char === '*') {
      output += '[^/]*'
    } else {
      output += escapeRegExp(char)
    }
  }
  output += '(/.*)?$'
  return new RegExp(output, 'i')
}

function routeStatus(rule: AutomationSafetyRule, owners: string[]): DependencyOwnershipStatus {
  if (owners.length === 0) return 'blocked'
  if (rule.decision === 'blocked') return 'blocked'
  if (rule.decision === 'review') return 'warning'
  return 'ready'
}

function escalationForRoute(rule: AutomationSafetyRule, owners: string[]): string {
  if (owners.length === 0) return `Assign CODEOWNERS before enabling ${rule.provider} updates.`
  if (rule.decision === 'blocked') return `Escalate to ${owners.join(', ')} after blockers are resolved or a release exception is approved.`
  if (rule.decision === 'review') return `Route pull requests to ${owners.join(', ')} for review and approval.`
  return `Auto-merge may proceed only after CI stays green; ${owners.join(', ')} remains accountable for rollback.`
}

function recommendationForAssignment(
  workspace: WorkspaceNode,
  managerId: DependencyManagerId,
  owners: string[],
  blockedSafetyRuleCount: number
): string {
  if (owners.length === 0) {
    return `Add CODEOWNERS coverage for ${workspace.relativePath} before routing ${managerId} dependency updates.`
  }
  if (blockedSafetyRuleCount > 0) {
    return `Route blocked ${managerId} automation to ${owners.join(', ')} after production evidence blockers are addressed.`
  }
  return `Route ${managerId} dependency review for ${workspace.relativePath} to ${owners.join(', ')}.`
}

function suggestedPattern(workspaceRelativePath: string): string {
  if (!workspaceRelativePath || workspaceRelativePath === '.') return '*'
  return `/${workspaceRelativePath.replace(/\\/g, '/')}/`
}

function renderDependencyOwnershipMarkdown(report: DependencyOwnershipPlanReport): string {
  const lines = [
    '# Dependency Ownership Plan',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Workspaces: ${report.summary.workspaceCount}`,
    `- Managers: ${report.summary.managers.join(', ') || '-'}`,
    `- Owner assignments: ${report.summary.ownedAssignmentCount}/${report.summary.assignmentCount}`,
    `- Missing owner assignments: ${report.summary.missingOwnerAssignmentCount}`,
    `- CODEOWNERS files: ${report.summary.codeownersFileCount}`,
    `- CODEOWNERS entries: ${report.summary.codeownersEntryCount}`,
    `- Review routes: ${report.summary.reviewRouteCount}`,
    `- Blocked review routes: ${report.summary.blockedReviewRouteCount}`,
    `- Suggested entries: ${report.summary.suggestedEntryCount}`,
    `- Findings: ${report.summary.findingCount}`,
    '',
    '## CODEOWNERS Sources',
    ''
  ]

  if (report.codeownersFiles.length === 0) {
    lines.push('- No CODEOWNERS files were found.')
  } else {
    for (const file of report.codeownersFiles) {
      lines.push(`- ${file.relativePath}: ${file.entryCount} entries`)
    }
  }

  lines.push(
    '',
    '## Owner Assignments',
    '',
    '| Workspace | Manager | Owners | Source | Automation | Safety | Recommendation |',
    '| --- | --- | --- | --- | ---: | ---: | --- |'
  )

  for (const assignment of report.assignments.slice(0, 160)) {
    lines.push([
      markdownCell(`${assignment.workspaceName} (${assignment.workspaceRelativePath})`),
      assignment.managerId,
      markdownCell(assignment.owners.join(', ') || '-'),
      assignment.source,
      String(assignment.automationTargetCount),
      String(assignment.safetyRuleCount),
      markdownCell(assignment.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push(
    '',
    '## Review Routes',
    '',
    '| Status | Provider | Workspace | Manager | Update | Decision | Owners | Approvals | Escalation |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: | --- |'
  )

  for (const route of report.reviewRoutes.slice(0, 160)) {
    lines.push([
      route.status,
      route.provider,
      markdownCell(`${route.workspaceName} (${route.workspaceRelativePath})`),
      route.managerId,
      route.updateType,
      route.decision,
      markdownCell(route.owners.join(', ') || '-'),
      String(route.requiredApprovals),
      markdownCell(route.escalation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', '## Findings', '')
  if (report.findings.length === 0) {
    lines.push('- No dependency ownership findings.')
  } else {
    for (const item of report.findings.slice(0, 100)) {
      lines.push(`- ${item.severity} / ${item.source}: ${item.title}`)
      lines.push(`  - ${item.summary}`)
      lines.push(`  - Recommendation: ${item.recommendation}`)
    }
  }

  lines.push('', '## Suggested CODEOWNERS', '', '```text', report.suggestedCodeownersText.trimEnd(), '```')
  return `${lines.join('\n')}\n`
}

function renderSuggestedCodeowners(entries: SuggestedCodeownersEntry[]): string {
  const lines = [
    '# Suggested dependency ownership entries generated by npmDesktopManager.',
    '# Replace @dependency-owners with your real GitHub users or teams before committing.',
    ''
  ]
  if (entries.length === 0) {
    lines.push('# Existing CODEOWNERS coverage already maps every detected workspace manager.')
  } else {
    for (const entry of entries) {
      lines.push(`# ${entry.reason}`)
      lines.push(`${entry.pattern} ${entry.owners.join(' ')}`)
      lines.push('')
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}

function exportResult(
  path: string,
  format: DependencyOwnershipPlanExportFormat,
  report: DependencyOwnershipPlanReport
): DependencyOwnershipPlanExportResult {
  return {
    path,
    format,
    generatedAt: report.generatedAt,
    status: report.status,
    assignmentCount: report.summary.assignmentCount,
    reviewRouteCount: report.summary.reviewRouteCount,
    missingOwnerAssignmentCount: report.summary.missingOwnerAssignmentCount,
    findingCount: report.summary.findingCount,
    count: report.summary.findingCount,
    summary: report.summary
  }
}

function sourceErrors(
  automationResult: CaptureResult<DependencyAutomationPlanReport>,
  safetyResult: CaptureResult<AutomationSafetyPlanReport>
): Partial<Record<DependencyOwnershipFindingSource, string>> {
  return {
    ...(automationResult.error ? { 'dependency-automation': automationResult.error } : {}),
    ...(safetyResult.error ? { 'automation-safety': safetyResult.error } : {})
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

async function capture<T>(operation: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { value: await operation() }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function finding(input: DependencyOwnershipFinding): DependencyOwnershipFinding {
  return {
    ...input,
    evidence: input.evidence.slice(0, 20)
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

function hasGlob(pattern: string): boolean {
  return pattern.includes('*')
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}
