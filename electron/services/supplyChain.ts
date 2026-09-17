import { createHash, randomUUID } from 'crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import {
  MANAGER_DEFINITIONS,
  getManagerDetectionFiles,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import { ExtendedManagerService } from './extendedManager'
import { existingPatternMatches, readdirSafe } from '../managers/patternFiles'

export interface SupplyChainComponent {
  managerId: DependencyManagerId
  ecosystem: string
  name: string
  version?: string
  scope: string
  sourceFile: string
  packageUrl?: string
  license?: string
}

export interface SupplyChainReport {
  generatedAt: string
  projectPath: string
  componentCount: number
  managers: Array<{
    id: DependencyManagerId
    name: string
    detected: boolean
    files: string[]
    componentCount: number
  }>
  components: SupplyChainComponent[]
}

export interface ExportResult {
  path: string
  format: 'cyclonedx' | 'spdx' | 'markdown'
  componentCount: number
}

export interface SnapshotFile {
  file: string
  hash: string
  size: number
  content: string
}

export interface SnapshotResult {
  id: string
  createdAt: string
  reason?: string
  source?: SnapshotSource
  path: string
  files: Array<Omit<SnapshotFile, 'content'>>
}

export interface SnapshotSummary {
  id: string
  createdAt: string
  reason?: string
  source?: SnapshotSource
  path: string
  projectPath: string
  fileCount: number
}

export interface SnapshotRestoreResult {
  snapshotId: string
  snapshotPath: string
  restoredCount: number
  restoredFiles: string[]
  preRestoreSnapshot: SnapshotResult
}

interface SavedSnapshot {
  id: string
  createdAt: string
  reason?: string
  source?: SnapshotSource
  projectPath: string
  files: SnapshotFile[]
  path?: string
}

export type SnapshotSource = 'manual' | 'mutation' | 'restore'

export interface SnapshotOptions {
  reason?: string
  source?: SnapshotSource
}

export interface SnapshotDiff {
  fromSnapshotId: string
  comparedAt: string
  added: string[]
  removed: string[]
  changed: Array<{
    file: string
    beforeHash: string
    afterHash: string
    beforeSize: number
    afterSize: number
  }>
  unchanged: string[]
}

export type DependencyChangeKind = 'added' | 'removed' | 'updated' | 'unchanged'
export type DependencyRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface DependencyComponentChange {
  id: string
  kind: DependencyChangeKind
  managerId: DependencyManagerId
  name: string
  before?: SupplyChainComponent
  after?: SupplyChainComponent
  risk: DependencyRiskLevel
  riskReasons: string[]
  recommendation: string
}

export interface DependencyComponentDiffSummary {
  added: number
  removed: number
  updated: number
  unchanged: number
  criticalRisk: number
  highRisk: number
  mediumRisk: number
  lowRisk: number
  infoRisk: number
  majorUpdates: number
  minorUpdates: number
  patchUpdates: number
  prereleaseChanges: number
  unpinnedChanges: number
  licenseChanges: number
}

export interface DependencyComponentDiff {
  fromSnapshotId: string
  fromSnapshotCreatedAt: string
  comparedAt: string
  projectPath: string
  beforeComponentCount: number
  afterComponentCount: number
  summary: DependencyComponentDiffSummary
  changes: DependencyComponentChange[]
}

export interface DependencyDiffExportResult {
  path: string
  format: 'markdown'
  changeCount: number
  summary: DependencyComponentDiffSummary
}

export interface DependencyPolicy {
  requirePinnedVersions: boolean
  disallowPrerelease: boolean
  requireKnownLicenses: boolean
  blockedManagers: DependencyManagerId[]
  blockedPackages: string[]
  blockedLicenses: string[]
  allowedLicenses: string[]
  allowedManagers: DependencyManagerId[]
  packageRules: DependencyPolicyPackageRule[]
  maxComponents?: number
}

export interface DependencyPolicyPackageRule {
  id: string
  description?: string
  packagePatterns: string[]
  managers?: DependencyManagerId[]
  severity?: DependencyPolicyViolation['severity']
  blocked?: boolean
  requirePinnedVersions?: boolean
  disallowPrerelease?: boolean
  requireKnownLicenses?: boolean
  allowedLicenses?: string[]
  blockedLicenses?: string[]
}

export interface DependencyPolicyViolation {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  managerId?: DependencyManagerId
  packageName?: string
  version?: string
  title: string
  description: string
  recommendation: string
}

export interface DependencyPolicyEvaluation {
  policyPath: string
  generatedAt: string
  componentCount: number
  violationCount: number
  violations: DependencyPolicyViolation[]
}

export type LicenseComplianceStatus = 'allowed' | 'blocked' | 'not-allowed' | 'unknown' | 'unrestricted'
export type LicenseComplianceExportFormat = 'markdown' | 'json'

export interface LicenseCompliancePolicySnapshot {
  path: string
  requireKnownLicenses: boolean
  allowedLicenses: string[]
  blockedLicenses: string[]
}

export interface LicenseComplianceComponent extends SupplyChainComponent {
  licenses: string[]
  normalizedLicenses: string[]
  status: LicenseComplianceStatus
  policyViolation: boolean
  reasons: string[]
  recommendation: string
}

export interface LicenseComplianceLicenseEntry {
  license: string
  normalizedLicense: string
  status: LicenseComplianceStatus
  componentCount: number
  managers: DependencyManagerId[]
  packages: string[]
  sources: string[]
}

export interface LicenseComplianceSummary {
  componentCount: number
  licenseCount: number
  knownLicenseComponentCount: number
  unknownLicenseComponentCount: number
  allowedComponentCount: number
  blockedLicenseComponentCount: number
  notAllowedLicenseComponentCount: number
  unrestrictedComponentCount: number
  policyViolationComponentCount: number
  managerCount: number
}

export interface LicenseComplianceReport {
  generatedAt: string
  projectPath: string
  policy: LicenseCompliancePolicySnapshot
  summary: LicenseComplianceSummary
  licenses: LicenseComplianceLicenseEntry[]
  components: LicenseComplianceComponent[]
}

export interface LicenseComplianceExportResult {
  path: string
  format: LicenseComplianceExportFormat
  generatedAt: string
  componentCount: number
  licenseCount: number
  summary: LicenseComplianceSummary
}

const REPORT_DIR = '.npmDesktopManager/reports'
const SNAPSHOT_DIR = '.npmDesktopManager/snapshots'
const POLICY_FILE = '.npmDesktopManager/dependency-policy.json'
const SNAPSHOT_MAX_SCAN_DEPTH = 5
const SNAPSHOT_IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.npmDesktopManager',
  'node_modules',
  'dist',
  'dist-electron',
  'build',
  'out',
  'coverage',
  'target',
  '.gradle',
  '.venv',
  'venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  '.tox'
])

const DEFAULT_POLICY: DependencyPolicy = {
  requirePinnedVersions: true,
  disallowPrerelease: true,
  requireKnownLicenses: false,
  blockedManagers: [],
  blockedPackages: [],
  blockedLicenses: [],
  allowedLicenses: [],
  allowedManagers: [],
  packageRules: [],
  maxComponents: undefined
}

const EXECUTION_DEPENDENCY_MANAGERS = new Set<DependencyManagerId>([
  'docker',
  'github-actions',
  'gitlab-ci',
  'pre-commit',
  'bazel',
  'pants',
  'buck'
])

const FLOATING_VERSION_LABELS = new Set([
  'latest',
  'main',
  'master',
  'develop',
  'development',
  'dev',
  'trunk',
  'head',
  'edge',
  'nightly',
  'snapshot',
  'stable'
])

const SPECIALIZED_INVENTORY_MANAGER_IDS = new Set<DependencyManagerId>([
  'pnpm',
  'yarn',
  'bun',
  'uv',
  'poetry',
  'pipenv',
  'conda',
  'nuget',
  'composer',
  'bundler',
  'mcp',
  'skills',
  'ai-agents'
])

export class SupplyChainService {
  private extendedManager = new ExtendedManagerService()

  async report(cwd: string): Promise<SupplyChainReport> {
    const detectedFiles = await Promise.all(MANAGER_DEFINITIONS.map((manager) => (
      existingPatternMatches(cwd, getManagerDetectionFiles(manager))
    )))
    const managerReports = await Promise.all(MANAGER_DEFINITIONS.map(async (manager, index) => {
      const files = detectedFiles[index]
      const manifestComponents = manager.implemented
        ? await this.parseImplementedManager(cwd, manager.id)
        : await this.extendedManager.list(cwd, manager.id)
            .then((items) => items.map((item) => ({
              managerId: item.managerId,
              ecosystem: manager.ecosystem,
              name: item.name,
              version: item.version,
              scope: item.type,
              sourceFile: item.file,
              packageUrl: packageUrl(item.managerId, item.name, item.version),
              license: undefined
            } satisfies SupplyChainComponent)))
            .catch(() => [])
      const lockComponents = SPECIALIZED_INVENTORY_MANAGER_IDS.has(manager.id)
        ? []
        : await parseLockfileComponents(cwd, manager.id, manager.ecosystem)
      const components = uniqueComponents([...manifestComponents, ...lockComponents])

      return {
        id: manager.id,
        name: manager.name,
        detected: files.length > 0 || components.length > 0,
        files,
        components
      }
    }))

    const components = uniqueComponents(managerReports.flatMap((manager) => manager.components))
    return {
      generatedAt: new Date().toISOString(),
      projectPath: cwd,
      componentCount: components.length,
      managers: managerReports.map((manager) => ({
        id: manager.id,
        name: manager.name,
        detected: manager.detected,
        files: manager.files,
        componentCount: manager.components.length
      })),
      components
    }
  }

  async exportCycloneDx(cwd: string): Promise<ExportResult> {
    const report = await this.report(cwd)
    const bom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      serialNumber: `urn:uuid:${randomUUID()}`,
      version: 1,
      metadata: {
        timestamp: report.generatedAt,
        tools: [
          {
            vendor: 'DependencyHub Desktop',
            name: 'Dependency Manager Framework',
            version: '1.0.0'
          }
        ]
      },
      components: report.components.map((component) => ({
        type: component.managerId === 'docker' ? 'container' : 'library',
        name: component.name,
        version: component.version || 'NOASSERTION',
        purl: component.packageUrl,
        licenses: component.license ? [{ license: { id: component.license } }] : undefined,
        properties: [
          { name: 'dependency.manager', value: component.managerId },
          { name: 'dependency.ecosystem', value: component.ecosystem },
          { name: 'dependency.scope', value: component.scope },
          { name: 'dependency.sourceFile', value: component.sourceFile }
        ]
      }))
    }

    const path = await writeReport(cwd, 'cyclonedx-bom.json', bom)
    return { path, format: 'cyclonedx', componentCount: report.componentCount }
  }

  async exportSpdx(cwd: string): Promise<ExportResult> {
    const report = await this.report(cwd)
    const namespace = `https://npm-desktop-manager.local/spdx/${randomUUID()}`
    const spdx = {
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: `Dependency inventory for ${cwd}`,
      documentNamespace: namespace,
      creationInfo: {
        created: report.generatedAt,
        creators: ['Tool: DependencyHub Desktop-Dependency-Manager-Framework-1.0.0']
      },
      packages: report.components.map((component, index) => ({
        SPDXID: `SPDXRef-Package-${safeSpdxId(component.name)}-${index + 1}`,
        name: component.name,
        versionInfo: component.version || 'NOASSERTION',
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: component.license || 'NOASSERTION',
        licenseDeclared: component.license || 'NOASSERTION',
        supplier: 'NOASSERTION',
        externalRefs: component.packageUrl ? [
          {
            referenceCategory: 'PACKAGE-MANAGER',
            referenceType: 'purl',
            referenceLocator: component.packageUrl
          }
        ] : [],
        annotations: [
          {
            annotationType: 'OTHER',
            annotator: 'Tool: DependencyHub Desktop',
            annotationDate: report.generatedAt,
            comment: `manager=${component.managerId}; ecosystem=${component.ecosystem}; scope=${component.scope}; source=${component.sourceFile}`
          }
        ]
      }))
    }

    const path = await writeReport(cwd, 'spdx-sbom.json', spdx)
    return { path, format: 'spdx', componentCount: report.componentCount }
  }

  async exportMarkdown(cwd: string): Promise<ExportResult> {
    const report = await this.report(cwd)
    const lines = [
      '# Dependency Supply Chain Report',
      '',
      `Generated: ${report.generatedAt}`,
      `Project: ${cwd}`,
      `Components: ${report.componentCount}`,
      '',
      '## Managers',
      '',
      '| Manager | Detected | Files | Components |',
      '| --- | --- | --- | ---: |',
      ...report.managers.map((manager) => `| ${manager.name} | ${manager.detected ? 'yes' : 'no'} | ${manager.files.join(', ') || '-'} | ${manager.componentCount} |`),
      '',
      '## Components',
      '',
      '| Manager | Name | Version | License | Scope | Source | PURL |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...report.components.map((component) => `| ${component.managerId} | ${component.name} | ${component.version || '-'} | ${component.license || '-'} | ${component.scope} | ${component.sourceFile} | ${component.packageUrl || '-'} |`)
    ]

    const path = await writeTextReport(cwd, 'dependency-report.md', lines.join('\n'))
    return { path, format: 'markdown', componentCount: report.componentCount }
  }

  async createSnapshot(cwd: string, options: SnapshotOptions = {}): Promise<SnapshotResult> {
    const id = timestampId()
    const files = await readSupplyChainFiles(cwd)
    const snapshot = {
      id,
      createdAt: new Date().toISOString(),
      reason: options.reason,
      source: options.source || 'manual',
      projectPath: cwd,
      files
    }
    const path = join(cwd, SNAPSHOT_DIR, `${id}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(snapshot, null, 2), 'utf-8')
    return {
      id,
      createdAt: snapshot.createdAt,
      reason: snapshot.reason,
      source: snapshot.source,
      path,
      files: files.map(({ content: _content, ...file }) => file)
    }
  }

  async listSnapshots(cwd: string): Promise<SnapshotSummary[]> {
    const dir = join(cwd, SNAPSHOT_DIR)
    const files = (await readdirSafe(dir)).filter((file) => file.endsWith('.json')).sort().reverse()
    const summaries: SnapshotSummary[] = []

    for (const file of files) {
      const path = join(dir, file)
      const snapshot = parseJson<SavedSnapshot | null>(await readText(path), null)
      if (!snapshot?.id || snapshot.projectPath !== cwd || !Array.isArray(snapshot.files)) continue

      summaries.push({
        id: snapshot.id,
        createdAt: snapshot.createdAt || snapshot.id,
        reason: snapshot.reason,
        source: snapshot.source,
        path,
        projectPath: snapshot.projectPath,
        fileCount: snapshot.files.length
      })
    }

    return summaries
  }

  async restoreLatestSnapshot(cwd: string): Promise<SnapshotRestoreResult | null> {
    const latest = await readLatestSnapshot(cwd)
    if (!latest) return null
    return await this.restoreSnapshot(cwd, latest.path)
  }

  async restoreSnapshot(cwd: string, snapshotIdOrPath: string): Promise<SnapshotRestoreResult> {
    const snapshotPath = resolveSnapshotPath(cwd, snapshotIdOrPath)
    const snapshot = parseJson<SavedSnapshot | null>(await readText(snapshotPath), null)
    if (!snapshot?.id || !Array.isArray(snapshot.files)) {
      throw new Error('Invalid dependency snapshot file')
    }

    if (resolve(snapshot.projectPath) !== resolve(cwd)) {
      throw new Error('Snapshot belongs to a different project path')
    }

    const preRestoreSnapshot = await this.createSnapshot(cwd, {
      reason: `Before restoring ${snapshot.id}`,
      source: 'restore'
    })
    const restoredFiles: string[] = []
    for (const file of snapshot.files) {
      const targetPath = resolve(cwd, file.file)
      if (!isInside(cwd, targetPath)) {
        throw new Error(`Snapshot contains an unsafe file path: ${file.file}`)
      }

      await mkdir(dirname(targetPath), { recursive: true })
      await writeFile(targetPath, file.content, 'utf-8')
      restoredFiles.push(file.file)
    }

    return {
      snapshotId: snapshot.id,
      snapshotPath,
      restoredCount: restoredFiles.length,
      restoredFiles,
      preRestoreSnapshot
    }
  }

  async diffLatestSnapshot(cwd: string): Promise<SnapshotDiff | null> {
    const snapshot = await readLatestSnapshot(cwd)
    if (!snapshot) return null
    const current = await readSupplyChainFiles(cwd)
    const currentMap = new Map(current.map((file) => [file.file, file]))
    const previousMap = new Map(snapshot.files.map((file) => [file.file, file]))

    const added = current
      .filter((file) => !previousMap.has(file.file))
      .map((file) => file.file)
    const removed = snapshot.files
      .filter((file) => !currentMap.has(file.file))
      .map((file) => file.file)
    const changed = current
      .filter((file) => {
        const previous = previousMap.get(file.file)
        return previous && previous.hash !== file.hash
      })
      .map((file) => {
        const previous = previousMap.get(file.file)!
        return {
          file: file.file,
          beforeHash: previous.hash,
          afterHash: file.hash,
          beforeSize: previous.size,
          afterSize: file.size
        }
      })
    const unchanged = current
      .filter((file) => previousMap.get(file.file)?.hash === file.hash)
      .map((file) => file.file)

    return {
      fromSnapshotId: snapshot.id,
      comparedAt: new Date().toISOString(),
      added,
      removed,
      changed,
      unchanged
    }
  }

  async dependencyDiffLatestSnapshot(cwd: string): Promise<DependencyComponentDiff | null> {
    const snapshot = await readLatestSnapshot(cwd)
    if (!snapshot) return null

    if (resolve(snapshot.projectPath) !== resolve(cwd)) {
      throw new Error('Snapshot belongs to a different project path')
    }

    const previousReport = await this.reportSnapshot(snapshot)
    const currentReport = await this.report(cwd)
    const changes = diffComponents(previousReport.components, currentReport.components)

    return {
      fromSnapshotId: snapshot.id,
      fromSnapshotCreatedAt: snapshot.createdAt || snapshot.id,
      comparedAt: new Date().toISOString(),
      projectPath: cwd,
      beforeComponentCount: previousReport.componentCount,
      afterComponentCount: currentReport.componentCount,
      summary: summarizeComponentChanges(changes),
      changes
    }
  }

  async exportDependencyDiffMarkdown(cwd: string): Promise<DependencyDiffExportResult> {
    const diff = await this.dependencyDiffLatestSnapshot(cwd)
    if (!diff) {
      throw new Error('No dependency snapshot is available for component diff')
    }

    const path = await writeTextReport(cwd, 'dependency-diff-report.md', renderDependencyDiffMarkdown(diff))
    return {
      path,
      format: 'markdown',
      changeCount: diff.changes.length,
      summary: diff.summary
    }
  }

  async ensureDefaultPolicy(cwd: string): Promise<string> {
    const path = join(cwd, POLICY_FILE)
    try {
      await access(path)
      const existing = parseJson<Partial<DependencyPolicy>>(await readText(path), {})
      const merged = normalizePolicy(existing)
      if (JSON.stringify(existing) !== JSON.stringify(merged)) {
        await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8')
      }
      return path
    } catch {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(DEFAULT_POLICY, null, 2), 'utf-8')
      return path
    }
  }

  async getPolicy(cwd: string): Promise<{ path: string; policy: DependencyPolicy }> {
    const path = await this.ensureDefaultPolicy(cwd)
    return {
      path,
      policy: normalizePolicy(parseJson<Partial<DependencyPolicy>>(await readText(path), {}))
    }
  }

  async savePolicy(cwd: string, policy: DependencyPolicy): Promise<{ path: string; policy: DependencyPolicy }> {
    const path = join(cwd, POLICY_FILE)
    const normalized = normalizePolicy(policy)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(normalized, null, 2), 'utf-8')
    return {
      path,
      policy: normalized
    }
  }

  async evaluatePolicy(cwd: string): Promise<DependencyPolicyEvaluation> {
    const policyPath = await this.ensureDefaultPolicy(cwd)
    const policy = normalizePolicy(parseJson<Partial<DependencyPolicy>>(await readText(policyPath), {}))
    const report = await this.report(cwd)
    return evaluatePolicyReport(report, policy, policyPath)
  }

  async evaluatePolicyWithPolicy(
    cwd: string,
    policy: Partial<DependencyPolicy>,
    policyPath = 'inherited dependency policy'
  ): Promise<DependencyPolicyEvaluation> {
    const report = await this.report(cwd)
    return evaluatePolicyReport(report, normalizePolicy(policy), policyPath)
  }

  async licenseReport(cwd: string): Promise<LicenseComplianceReport> {
    const [{ path: policyPath, policy }, report] = await Promise.all([
      this.getPolicy(cwd),
      this.report(cwd)
    ])
    return buildLicenseComplianceReport(report, policy, policyPath)
  }

  async exportLicenseMarkdown(cwd: string): Promise<LicenseComplianceExportResult> {
    const report = await this.licenseReport(cwd)
    const path = await writeTextReport(cwd, 'license-compliance-report.md', renderLicenseComplianceMarkdown(report))
    return {
      path,
      format: 'markdown',
      generatedAt: report.generatedAt,
      componentCount: report.summary.componentCount,
      licenseCount: report.summary.licenseCount,
      summary: report.summary
    }
  }

  async exportLicenseJson(cwd: string): Promise<LicenseComplianceExportResult> {
    const report = await this.licenseReport(cwd)
    const path = await writeReport(cwd, 'license-compliance-report.json', report)
    return {
      path,
      format: 'json',
      generatedAt: report.generatedAt,
      componentCount: report.summary.componentCount,
      licenseCount: report.summary.licenseCount,
      summary: report.summary
    }
  }

  private async parseImplementedManager(cwd: string, managerId: DependencyManagerId): Promise<SupplyChainComponent[]> {
    switch (managerId) {
      case 'npm':
        return await parsePackageJson(cwd, managerId, 'Node.js')
      case 'pip':
        return await parseRequirements(cwd)
      case 'maven':
        return await parsePom(cwd)
      case 'cargo':
        return await parseCargoToml(cwd)
      case 'gradle':
        return await parseGradle(cwd)
      case 'go':
        return await parseGoMod(cwd)
      case 'flutter':
        return await parsePubspec(cwd)
      case 'native':
        return await parseNative(cwd)
      default:
        return []
    }
  }

  private async reportSnapshot(snapshot: SavedSnapshot): Promise<SupplyChainReport> {
    const tempRoot = await mkdtemp(join(tmpdir(), 'npm-manager-snapshot-report-'))
    try {
      for (const file of snapshot.files) {
        const targetPath = resolve(tempRoot, file.file)
        if (!isInside(tempRoot, targetPath)) {
          throw new Error(`Snapshot contains an unsafe file path: ${file.file}`)
        }

        await mkdir(dirname(targetPath), { recursive: true })
        await writeFile(targetPath, file.content, 'utf-8')
      }
      return await this.report(tempRoot)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  }
}

function evaluatePolicyReport(
  report: SupplyChainReport,
  policy: DependencyPolicy,
  policyPath: string
): DependencyPolicyEvaluation {
    const violations: DependencyPolicyViolation[] = []
    const allowedManagers = new Set(policy.allowedManagers)
    const blockedManagers = new Set(policy.blockedManagers)
    const blockedPackages = new Set(policy.blockedPackages.map((item) => item.toLowerCase()))
    const allowedLicenses = new Set(policy.allowedLicenses.map(normalizeLicensePolicyValue).filter(Boolean))
    const blockedLicenses = new Set(policy.blockedLicenses.map(normalizeLicensePolicyValue).filter(Boolean))
    const packageRules = policy.packageRules.filter((rule) => rule.packagePatterns.length > 0)

    if (policy.maxComponents && report.componentCount > policy.maxComponents) {
      violations.push({
        severity: 'medium',
        title: 'Component count exceeds policy',
        description: `Project has ${report.componentCount} components, policy maximum is ${policy.maxComponents}.`,
        recommendation: 'Review dependency sprawl, unused dependencies, and transitive dependency growth.'
      })
    }

    for (const component of report.components) {
      if (allowedManagers.size > 0 && !allowedManagers.has(component.managerId)) {
        violations.push({
          severity: 'high',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: 'Manager is not allowed',
          description: `${component.managerId} is not included in allowedManagers.`,
          recommendation: 'Move this dependency to an approved ecosystem or update dependency-policy.json.'
        })
      }

      if (blockedManagers.has(component.managerId)) {
        violations.push({
          severity: 'high',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: 'Manager is blocked',
          description: `${component.managerId} is listed in blockedManagers.`,
          recommendation: 'Remove this dependency or change project policy after review.'
        })
      }

      if (blockedPackages.has(component.name.toLowerCase())) {
        violations.push({
          severity: 'critical',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: 'Package is blocked',
          description: `${component.name} is listed in blockedPackages.`,
          recommendation: 'Remove or replace the package before release.'
        })
      }

      const licenses = splitLicenses(component.license)
      if (policy.requireKnownLicenses && licenses.length === 0) {
        violations.push({
          severity: 'low',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: 'License is unknown',
          description: `${component.name} has no license metadata in ${component.sourceFile}.`,
          recommendation: 'Review the package metadata manually or enrich the lockfile/report before release approval.'
        })
      }

      if (licenses.some((license) => blockedLicenses.has(normalizeLicensePolicyValue(license)))) {
        violations.push({
          severity: 'critical',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: 'License is blocked',
          description: `${component.name} declares ${component.license}.`,
          recommendation: 'Replace the dependency, request legal approval, or update dependency-policy.json after review.'
        })
      }

      if (allowedLicenses.size > 0 && licenses.length > 0 && !licenses.some((license) => allowedLicenses.has(normalizeLicensePolicyValue(license)))) {
        violations.push({
          severity: 'high',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: 'License is not allowed',
          description: `${component.name} declares ${component.license}, which is not included in allowedLicenses.`,
          recommendation: 'Use an approved license, replace the dependency, or update policy after legal review.'
        })
      }

      if (policy.requirePinnedVersions && isUnpinnedVersion(component.version)) {
        const floatingExecutionReference = isFloatingExecutionReference(component)
        violations.push({
          severity: floatingExecutionReference ? 'high' : 'medium',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: floatingExecutionReference ? 'Execution dependency uses floating reference' : 'Dependency version is not pinned',
          description: `${component.name} uses ${component.version || 'no explicit version'} in ${component.sourceFile}.`,
          recommendation: floatingExecutionReference
            ? 'Pin CI actions, hook repos, container images, and build-system artifacts to reviewed immutable versions, tags, or SHAs before release.'
            : 'Pin the dependency or rely on a committed lockfile with a reviewed update process.'
        })
      }

      if (policy.disallowPrerelease && component.version && isPrerelease(component.version)) {
        violations.push({
          severity: 'medium',
          managerId: component.managerId,
          packageName: component.name,
          version: component.version,
          title: 'Prerelease dependency',
          description: `${component.name}@${component.version} looks like a prerelease version.`,
          recommendation: 'Use a stable release unless this prerelease is explicitly approved.'
        })
      }

      for (const rule of packageRules) {
        if (!matchesPackageRule(component, rule)) continue
        violations.push(...evaluatePackageRule(component, rule, licenses))
      }
    }

    return {
      policyPath,
      generatedAt: new Date().toISOString(),
      componentCount: report.componentCount,
      violationCount: violations.length,
      violations
    }
}

function buildLicenseComplianceReport(
  report: SupplyChainReport,
  policy: DependencyPolicy,
  policyPath: string
): LicenseComplianceReport {
  const components = report.components.map((component) => licenseComplianceComponent(component, policy))
  const licenses = summarizeLicenses(components, policy)
  const summary = summarizeLicenseCompliance(components, licenses)

  return {
    generatedAt: new Date().toISOString(),
    projectPath: report.projectPath,
    policy: {
      path: policyPath,
      requireKnownLicenses: policy.requireKnownLicenses,
      allowedLicenses: policy.allowedLicenses,
      blockedLicenses: policy.blockedLicenses
    },
    summary,
    licenses,
    components
  }
}

function licenseComplianceComponent(
  component: SupplyChainComponent,
  policy: DependencyPolicy
): LicenseComplianceComponent {
  const licenses = splitLicenses(component.license)
  const evaluation = evaluateLicenseCompliance(licenses, policy)
  return {
    ...component,
    licenses,
    normalizedLicenses: licenses.map(normalizeLicensePolicyValue),
    status: evaluation.status,
    policyViolation: evaluation.policyViolation,
    reasons: evaluation.reasons,
    recommendation: licenseComplianceRecommendation(evaluation.status, policy)
  }
}

function evaluateLicenseCompliance(
  licenses: string[],
  policy: DependencyPolicy
): { status: LicenseComplianceStatus; policyViolation: boolean; reasons: string[] } {
  const normalizedLicenses = licenses.map(normalizeLicensePolicyValue).filter(Boolean)
  const blockedLicenses = new Set(policy.blockedLicenses.map(normalizeLicensePolicyValue).filter(Boolean))
  const allowedLicenses = new Set(policy.allowedLicenses.map(normalizeLicensePolicyValue).filter(Boolean))

  if (normalizedLicenses.length === 0) {
    return {
      status: 'unknown',
      policyViolation: policy.requireKnownLicenses,
      reasons: [
        'No license metadata was captured from manifests or lockfiles.',
        policy.requireKnownLicenses ? 'Project policy requires known license metadata.' : 'Project policy does not currently block unknown licenses.'
      ]
    }
  }

  const blocked = normalizedLicenses.filter((license) => blockedLicenses.has(license))
  if (blocked.length > 0) {
    return {
      status: 'blocked',
      policyViolation: true,
      reasons: [`Blocked by dependency-policy.json: ${blocked.join(', ')}.`]
    }
  }

  if (allowedLicenses.size > 0) {
    const allowed = normalizedLicenses.filter((license) => allowedLicenses.has(license))
    if (allowed.length > 0) {
      return {
        status: 'allowed',
        policyViolation: false,
        reasons: [`Matches allowed license policy: ${allowed.join(', ')}.`]
      }
    }

    return {
      status: 'not-allowed',
      policyViolation: true,
      reasons: [`License is outside the allowed license policy: ${normalizedLicenses.join(', ')}.`]
    }
  }

  return {
    status: 'unrestricted',
    policyViolation: false,
    reasons: ['No allowed-license list is configured and no blocked license matched.']
  }
}

function licenseComplianceRecommendation(status: LicenseComplianceStatus, policy: DependencyPolicy): string {
  if (status === 'blocked') {
    return 'Replace the dependency, remove it, or record a reviewed legal exception before release.'
  }
  if (status === 'not-allowed') {
    return 'Use a dependency with an approved license or update allowedLicenses after legal review.'
  }
  if (status === 'unknown') {
    return policy.requireKnownLicenses
      ? 'Enrich license metadata or obtain manual approval before release.'
      : 'Review license metadata before production release if this package is distributed.'
  }
  if (status === 'allowed') {
    return 'No license-policy action required.'
  }
  return 'Review under normal dependency approval; add allowedLicenses for stricter governance.'
}

function summarizeLicenses(
  components: LicenseComplianceComponent[],
  policy: DependencyPolicy
): LicenseComplianceLicenseEntry[] {
  const entries = new Map<string, LicenseComplianceLicenseEntry>()

  for (const component of components) {
    const licenses = component.licenses.length > 0
      ? component.licenses
      : ['UNKNOWN']

    for (const license of licenses) {
      const normalizedLicense = license === 'UNKNOWN' ? 'UNKNOWN' : normalizeLicensePolicyValue(license)
      const evaluation = license === 'UNKNOWN'
        ? evaluateLicenseCompliance([], policy)
        : evaluateLicenseCompliance([license], policy)
      const key = normalizedLicense
      const existing = entries.get(key)
      if (!existing) {
        entries.set(key, {
          license,
          normalizedLicense,
          status: evaluation.status,
          componentCount: 1,
          managers: [component.managerId],
          packages: [component.name],
          sources: [component.sourceFile]
        })
        continue
      }

      existing.componentCount += 1
      existing.status = maxLicenseComplianceStatus(existing.status, evaluation.status)
      existing.managers = uniqueValues([...existing.managers, component.managerId]) as DependencyManagerId[]
      existing.packages = uniqueValues([...existing.packages, component.name]).slice(0, 20)
      existing.sources = uniqueValues([...existing.sources, component.sourceFile]).slice(0, 20)
    }
  }

  return [...entries.values()].sort((a, b) => (
    licenseComplianceStatusRank(b.status) - licenseComplianceStatusRank(a.status)
    || b.componentCount - a.componentCount
    || a.license.localeCompare(b.license)
  ))
}

function summarizeLicenseCompliance(
  components: LicenseComplianceComponent[],
  licenses: LicenseComplianceLicenseEntry[]
): LicenseComplianceSummary {
  return {
    componentCount: components.length,
    licenseCount: licenses.length,
    knownLicenseComponentCount: components.filter((component) => component.licenses.length > 0).length,
    unknownLicenseComponentCount: components.filter((component) => component.status === 'unknown').length,
    allowedComponentCount: components.filter((component) => component.status === 'allowed').length,
    blockedLicenseComponentCount: components.filter((component) => component.status === 'blocked').length,
    notAllowedLicenseComponentCount: components.filter((component) => component.status === 'not-allowed').length,
    unrestrictedComponentCount: components.filter((component) => component.status === 'unrestricted').length,
    policyViolationComponentCount: components.filter((component) => component.policyViolation).length,
    managerCount: new Set(components.map((component) => component.managerId)).size
  }
}

function maxLicenseComplianceStatus(
  a: LicenseComplianceStatus,
  b: LicenseComplianceStatus
): LicenseComplianceStatus {
  return licenseComplianceStatusRank(b) > licenseComplianceStatusRank(a) ? b : a
}

function licenseComplianceStatusRank(status: LicenseComplianceStatus): number {
  return {
    unrestricted: 0,
    allowed: 1,
    unknown: 2,
    'not-allowed': 3,
    blocked: 4
  }[status]
}

function renderLicenseComplianceMarkdown(report: LicenseComplianceReport): string {
  const policy = report.policy
  const lines = [
    '# License Compliance Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectPath}`,
    `Policy: ${policy.path}`,
    '',
    '## Policy',
    '',
    `- Require known licenses: ${policy.requireKnownLicenses ? 'yes' : 'no'}`,
    `- Allowed licenses: ${policy.allowedLicenses.join(', ') || '-'}`,
    `- Blocked licenses: ${policy.blockedLicenses.join(', ') || '-'}`,
    '',
    '## Summary',
    '',
    `- Components: ${report.summary.componentCount}`,
    `- Unique license values: ${report.summary.licenseCount}`,
    `- Known-license components: ${report.summary.knownLicenseComponentCount}`,
    `- Unknown-license components: ${report.summary.unknownLicenseComponentCount}`,
    `- Allowed components: ${report.summary.allowedComponentCount}`,
    `- Blocked-license components: ${report.summary.blockedLicenseComponentCount}`,
    `- Not-allowed-license components: ${report.summary.notAllowedLicenseComponentCount}`,
    `- Unrestricted components: ${report.summary.unrestrictedComponentCount}`,
    `- Policy-violation components: ${report.summary.policyViolationComponentCount}`,
    '',
    '## License Matrix',
    '',
    '| Status | License | Components | Managers | Packages | Sources |',
    '| --- | --- | ---: | --- | --- | --- |'
  ]

  for (const entry of report.licenses) {
    lines.push([
      entry.status,
      escapeMarkdownTable(entry.license),
      entry.componentCount,
      escapeMarkdownTable(entry.managers.join(', ')),
      escapeMarkdownTable(entry.packages.join(', ')),
      escapeMarkdownTable(entry.sources.join(', '))
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (report.licenses.length === 0) {
    lines.push('| unrestricted | - | 0 | - | - | - |')
  }

  lines.push(
    '',
    '## Component Review',
    '',
    '| Status | Manager | Package | Version | License | Source | Reasons | Recommendation |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'
  )

  for (const component of report.components) {
    lines.push([
      component.status,
      component.managerId,
      escapeMarkdownTable(component.name),
      escapeMarkdownTable(component.version || '-'),
      escapeMarkdownTable(component.licenses.join(', ') || 'UNKNOWN'),
      escapeMarkdownTable(component.sourceFile),
      escapeMarkdownTable(component.reasons.join('; ')),
      escapeMarkdownTable(component.recommendation)
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  if (report.components.length === 0) {
    lines.push('| unrestricted | - | - | - | - | - | No dependency components were found. | No action required. |')
  }

  return `${lines.join('\n')}\n`
}

function diffComponents(previous: SupplyChainComponent[], current: SupplyChainComponent[]): DependencyComponentChange[] {
  const previousMap = componentMap(previous)
  const currentMap = componentMap(current)
  const keys = [...new Set([...previousMap.keys(), ...currentMap.keys()])].sort()

  return keys.map((key) => {
    const before = previousMap.get(key)
    const after = currentMap.get(key)
    const sample = after || before!
    const kind: DependencyChangeKind = before && after
      ? (normalizeComparableVersion(before.version) === normalizeComparableVersion(after.version)
          && normalizeLicenseForDiff(before.license) === normalizeLicenseForDiff(after.license)
        ? 'unchanged'
        : 'updated')
      : before ? 'removed' : 'added'
    const risk = assessComponentRisk(kind, before, after)
    return {
      id: key,
      kind,
      managerId: sample.managerId,
      name: sample.name,
      before,
      after,
      risk: risk.level,
      riskReasons: risk.reasons,
      recommendation: recommendationForChange(kind, risk.level)
    }
  })
}

function componentMap(components: SupplyChainComponent[]): Map<string, SupplyChainComponent> {
  const map = new Map<string, SupplyChainComponent>()
  const sorted = [...components].sort((a, b) => componentPriority(b) - componentPriority(a))
  for (const component of sorted) {
    const key = componentIdentity(component)
    if (!map.has(key)) map.set(key, component)
  }
  return map
}

function componentIdentity(component: SupplyChainComponent): string {
  return [
    component.managerId,
    component.sourceFile,
    component.scope,
    component.name
  ].join(':')
}

function componentPriority(component: SupplyChainComponent): number {
  let score = 0
  if (/lock/i.test(component.scope) || /lock|sum$/i.test(component.sourceFile)) score += 4
  if (component.version && !isUnpinnedVersion(component.version)) score += 2
  if (component.license) score += 1
  return score
}

function assessComponentRisk(
  kind: DependencyChangeKind,
  before?: SupplyChainComponent,
  after?: SupplyChainComponent
): { level: DependencyRiskLevel; reasons: string[] } {
  const reasons: string[] = []
  let level: DependencyRiskLevel = 'info'

  if (kind === 'added') {
    level = 'medium'
    reasons.push('new dependency introduced')
  } else if (kind === 'removed') {
    level = 'low'
    reasons.push('dependency removed')
  } else if (kind === 'updated') {
    level = 'low'
    reasons.push('dependency version or metadata changed')
  }

  const versionBefore = before?.version
  const versionAfter = after?.version
  const versionChange = compareVersions(versionBefore, versionAfter)
  if (versionChange === 'major') {
    level = maxRisk(level, 'high')
    reasons.push('major version change')
  } else if (versionChange === 'minor') {
    level = maxRisk(level, 'medium')
    reasons.push('minor version change')
  } else if (versionChange === 'patch') {
    level = maxRisk(level, 'low')
    reasons.push('patch version change')
  } else if (versionChange === 'downgrade') {
    level = maxRisk(level, 'medium')
    reasons.push('possible version downgrade')
  } else if (versionChange === 'unknown' && kind === 'updated') {
    level = maxRisk(level, 'medium')
    reasons.push('non-semver version change')
  }

  const activeVersion = versionAfter || versionBefore
  if (activeVersion && isPrerelease(activeVersion)) {
    level = maxRisk(level, 'high')
    reasons.push('prerelease version involved')
  }
  if (kind !== 'removed' && isUnpinnedVersion(versionAfter)) {
    const floatingExecutionReference = after ? isFloatingExecutionReference(after) : false
    level = maxRisk(level, floatingExecutionReference ? 'high' : 'medium')
    reasons.push(floatingExecutionReference ? 'floating execution dependency reference' : 'new version is not pinned')
  }
  if (normalizeLicenseForDiff(before?.license) !== normalizeLicenseForDiff(after?.license)) {
    level = maxRisk(level, 'medium')
    reasons.push('license metadata changed')
  }
  if (kind === 'added' && !after?.license) {
    level = maxRisk(level, 'low')
    reasons.push('new dependency has no known license metadata')
  }
  if (kind === 'unchanged') {
    reasons.push('no dependency component change')
  }

  return {
    level,
    reasons: [...new Set(reasons)]
  }
}

function recommendationForChange(kind: DependencyChangeKind, risk: DependencyRiskLevel): string {
  if (kind === 'unchanged') return 'No action required.'
  if (risk === 'critical' || risk === 'high') return 'Require maintainer review, changelog inspection, and policy approval before release.'
  if (risk === 'medium') return 'Review compatibility, lockfile diff, and license or version policy before merging.'
  if (kind === 'removed') return 'Confirm the dependency is unused and runtime/build paths still pass.'
  return 'Review as part of normal dependency change approval.'
}

function summarizeComponentChanges(changes: DependencyComponentChange[]): DependencyComponentDiffSummary {
  const summary: DependencyComponentDiffSummary = {
    added: 0,
    removed: 0,
    updated: 0,
    unchanged: 0,
    criticalRisk: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    infoRisk: 0,
    majorUpdates: 0,
    minorUpdates: 0,
    patchUpdates: 0,
    prereleaseChanges: 0,
    unpinnedChanges: 0,
    licenseChanges: 0
  }

  for (const change of changes) {
    summary[change.kind] += 1
    if (change.risk === 'critical') summary.criticalRisk += 1
    if (change.risk === 'high') summary.highRisk += 1
    if (change.risk === 'medium') summary.mediumRisk += 1
    if (change.risk === 'low') summary.lowRisk += 1
    if (change.risk === 'info') summary.infoRisk += 1

    const versionChange = compareVersions(change.before?.version, change.after?.version)
    if (versionChange === 'major') summary.majorUpdates += 1
    if (versionChange === 'minor') summary.minorUpdates += 1
    if (versionChange === 'patch') summary.patchUpdates += 1
    if (change.riskReasons.includes('prerelease version involved')) summary.prereleaseChanges += 1
    if (change.riskReasons.includes('new version is not pinned') || change.riskReasons.includes('floating execution dependency reference')) summary.unpinnedChanges += 1
    if (change.riskReasons.includes('license metadata changed')) summary.licenseChanges += 1
  }

  return summary
}

function compareVersions(before?: string, after?: string): 'same' | 'major' | 'minor' | 'patch' | 'downgrade' | 'unknown' {
  const normalizedBefore = normalizeComparableVersion(before)
  const normalizedAfter = normalizeComparableVersion(after)
  if (normalizedBefore === normalizedAfter) return 'same'
  const parsedBefore = parseSemverParts(normalizedBefore)
  const parsedAfter = parseSemverParts(normalizedAfter)
  if (!parsedBefore || !parsedAfter) return 'unknown'

  if (parsedAfter.major < parsedBefore.major) return 'downgrade'
  if (parsedAfter.major > parsedBefore.major) return 'major'
  if (parsedAfter.minor < parsedBefore.minor) return 'downgrade'
  if (parsedAfter.minor > parsedBefore.minor) return 'minor'
  if (parsedAfter.patch < parsedBefore.patch) return 'downgrade'
  if (parsedAfter.patch > parsedBefore.patch) return 'patch'
  return 'unknown'
}

function parseSemverParts(value?: string): { major: number; minor: number; patch: number } | null {
  const match = normalizeComparableVersion(value).match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2] || 0),
    patch: Number(match[3] || 0)
  }
}

function normalizeComparableVersion(value?: string): string {
  return (value || '')
    .trim()
    .replace(/^[~^=<>!\s]+/, '')
    .replace(/\s.*$/, '')
}

function normalizeLicenseForDiff(value?: string): string {
  return value ? normalizeLicensePolicyValue(value) : ''
}

function maxRisk(a: DependencyRiskLevel, b: DependencyRiskLevel): DependencyRiskLevel {
  return riskRank(b) > riskRank(a) ? b : a
}

function riskRank(level: DependencyRiskLevel): number {
  return {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  }[level]
}

function renderDependencyDiffMarkdown(diff: DependencyComponentDiff): string {
  const changed = diff.changes.filter((change) => change.kind !== 'unchanged')
  const lines = [
    '# Dependency Change Risk Report',
    '',
    `Generated: ${diff.comparedAt}`,
    `Project: ${diff.projectPath}`,
    `Baseline snapshot: ${diff.fromSnapshotId} (${diff.fromSnapshotCreatedAt})`,
    `Components before: ${diff.beforeComponentCount}`,
    `Components after: ${diff.afterComponentCount}`,
    '',
    '## Summary',
    '',
    `- Added: ${diff.summary.added}`,
    `- Removed: ${diff.summary.removed}`,
    `- Updated: ${diff.summary.updated}`,
    `- Unchanged: ${diff.summary.unchanged}`,
    `- Critical/high risk: ${diff.summary.criticalRisk + diff.summary.highRisk}`,
    `- Medium risk: ${diff.summary.mediumRisk}`,
    `- Major updates: ${diff.summary.majorUpdates}`,
    `- Prerelease changes: ${diff.summary.prereleaseChanges}`,
    `- Unpinned changes: ${diff.summary.unpinnedChanges}`,
    `- License changes: ${diff.summary.licenseChanges}`,
    '',
    '## Changes',
    '',
    '| Risk | Change | Manager | Package | Before | After | Reasons | Recommendation |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...changed.map((change) => [
      change.risk,
      change.kind,
      change.managerId,
      escapeMarkdownTable(change.name),
      escapeMarkdownTable(change.before?.version || '-'),
      escapeMarkdownTable(change.after?.version || '-'),
      escapeMarkdownTable(change.riskReasons.join('; ')),
      escapeMarkdownTable(change.recommendation)
    ].join(' | ')).map((row) => `| ${row} |`)
  ]

  if (changed.length === 0) {
    lines.push('| info | unchanged | - | - | - | - | no dependency component change | No action required. |')
  }

  return lines.join('\n')
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

async function parsePackageJson(cwd: string, managerId: DependencyManagerId, ecosystem: string): Promise<SupplyChainComponent[]> {
  const file = 'package.json'
  const json = await readJson(join(cwd, file))
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
  return sections.flatMap((section) => objectEntries(json?.[section]).map(([name, version]) => component(managerId, ecosystem, name, String(version), section, file)))
}

async function parseRequirements(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'requirements.txt'
  const content = await readText(join(cwd, file))
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('-'))
    .map((line) => {
      const match = line.match(/^([A-Za-z0-9_.-]+)\s*([<>=!~].*)?$/)
      return component('pip', 'Python', match?.[1] || line, normalizeRequirementVersion(match?.[2]), 'requirements', file)
    })
}

async function parsePom(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'pom.xml'
  const content = await readText(join(cwd, file))
  return matches(content, /<dependency>([\s\S]*?)<\/dependency>/g).map((match) => {
    const block = match[1]
    const groupId = xmlTag(block, 'groupId')
    const artifactId = xmlTag(block, 'artifactId')
    const version = xmlTag(block, 'version')
    const scope = xmlTag(block, 'scope') || 'compile'
    return component('maven', 'JVM', `${groupId}:${artifactId}`, version, scope, file)
  }).filter((item) => !item.name.includes('undefined'))
}

async function parseCargoToml(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'Cargo.toml'
  const content = await readText(join(cwd, file))
  const sections = ['dependencies', 'dev-dependencies', 'build-dependencies']
  return sections.flatMap((section) => parseTomlKeyValues(sectionContent(content, section)).map(([name, version]) => component('cargo', 'Rust', name, version, section, file)))
}

async function parseGradle(cwd: string): Promise<SupplyChainComponent[]> {
  const file = await firstExisting(cwd, ['build.gradle', 'build.gradle.kts'])
  if (!file) return []
  const content = await readText(join(cwd, file))
  const stringNotation = matches(content, /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly)\s*(?:\(|\s)\s*['"]([^:'"]+):([^:'"]+):([^'"]+)['"]/g)
    .map((match) => component('gradle', 'JVM', `${match[1]}:${match[2]}`, match[3], 'dependency', file))
  const mapNotation = matches(content, /group:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]\s*,\s*version:\s*['"]([^'"]+)['"]/g)
    .map((match) => component('gradle', 'JVM', `${match[1]}:${match[2]}`, match[3], 'dependency', file))
  return uniqueComponents([...stringNotation, ...mapNotation])
}

async function parseGoMod(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'go.mod'
  const content = await readText(join(cwd, file))
  const deps: SupplyChainComponent[] = []
  let inBlock = false
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('require (')) {
      inBlock = true
      continue
    }
    if (inBlock && trimmed === ')') {
      inBlock = false
      continue
    }
    const match = trimmed.match(/^require\s+(\S+)\s+(\S+)/) || (inBlock ? trimmed.match(/^(\S+)\s+(\S+)/) : null)
    if (match) {
      deps.push(component('go', 'Go', match[1], match[2], trimmed.includes('// indirect') ? 'indirect' : 'direct', file))
    }
  }
  return deps
}

async function parsePubspec(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'pubspec.yaml'
  const content = await readText(join(cwd, file))
  return [
    ...parseYamlDependencySection(content, 'dependencies').map(([name, version]) => component('flutter', 'Dart', name, version, 'dependencies', file)),
    ...parseYamlDependencySection(content, 'dev_dependencies').map(([name, version]) => component('flutter', 'Dart', name, version, 'dev_dependencies', file))
  ]
}

async function parseNative(cwd: string): Promise<SupplyChainComponent[]> {
  return [
    ...await parseVcpkgJson(cwd),
    ...await parseConanfile(cwd)
  ]
}

async function parseLockfileComponents(
  cwd: string,
  managerId: DependencyManagerId,
  ecosystem: string
): Promise<SupplyChainComponent[]> {
  switch (managerId) {
    case 'npm':
      return await parsePackageLock(cwd, managerId, ecosystem, ['package-lock.json', 'npm-shrinkwrap.json'])
    case 'pnpm':
      return [
        ...await parsePackageLock(cwd, managerId, ecosystem, ['package-lock.json']),
        ...await parsePnpmLock(cwd)
      ]
    case 'yarn':
      return [
        ...await parsePackageLock(cwd, managerId, ecosystem, ['package-lock.json']),
        ...await parseYarnLock(cwd)
      ]
    case 'bun':
      return await parsePackageLock(cwd, managerId, ecosystem, ['package-lock.json', 'bun.lock'])
    case 'cargo':
      return await parseCargoLock(cwd)
    case 'go':
      return await parseGoSum(cwd)
    case 'flutter':
      return await parsePubspecLock(cwd)
    case 'gradle':
      return await parseGradleLock(cwd)
    case 'composer':
      return await parseComposerLock(cwd)
    case 'bundler':
      return await parseGemfileLock(cwd)
    case 'nuget':
      return await parseNugetLock(cwd)
    case 'poetry':
      return await parsePoetryLock(cwd)
    case 'pipenv':
      return await parsePipfileLock(cwd)
    case 'uv':
      return await parseUvLock(cwd)
    case 'helm':
      return await parseHelmLock(cwd)
    default:
      return []
  }
}

async function parsePackageLock(
  cwd: string,
  managerId: DependencyManagerId,
  ecosystem: string,
  candidates: string[]
): Promise<SupplyChainComponent[]> {
  const file = await firstExisting(cwd, candidates)
  if (!file) return []
  const json = await readJson(join(cwd, file))
  const deps: SupplyChainComponent[] = []

  for (const [path, info] of objectEntries(json?.packages)) {
    if (!path || path === '' || !info || typeof info !== 'object') continue
    const record = info as Record<string, unknown>
    const name = String(record.name || packageNameFromNodeModulesPath(path))
    const version = typeof record.version === 'string' ? record.version : undefined
    if (name && version) {
      deps.push(component(managerId, ecosystem, name, version, 'lockfile', file, licenseFromValue(record.license)))
    }
  }

  collectPackageLockDependencies(json?.dependencies, managerId, ecosystem, file, deps)
  return uniqueComponents(deps)
}

function collectPackageLockDependencies(
  dependencies: unknown,
  managerId: DependencyManagerId,
  ecosystem: string,
  file: string,
  result: SupplyChainComponent[]
): void {
  for (const [name, info] of objectEntries(dependencies)) {
    if (!info || typeof info !== 'object') continue
    const record = info as Record<string, unknown>
    const version = typeof record.version === 'string' ? record.version : undefined
    if (version) result.push(component(managerId, ecosystem, name, version, 'lockfile', file, licenseFromValue(record.license)))
    collectPackageLockDependencies(record.dependencies, managerId, ecosystem, file, result)
  }
}

async function parsePnpmLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'pnpm-lock.yaml'
  const content = await readText(join(cwd, file))
  if (!content) return []

  const deps = matches(content, /^\s{2}\/((?:@[^/\s]+\/)?[^@\s(]+)@([^:\s(]+).*:$/gm)
    .map((match) => component('pnpm', 'Node.js', match[1], match[2], 'lockfile', file))
  return uniqueComponents(deps)
}

async function parseYarnLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'yarn.lock'
  const content = await readText(join(cwd, file))
  if (!content) return []

  const deps: SupplyChainComponent[] = []
  for (const block of content.split(/\n(?=\S)/)) {
    const header = block.match(/^("?[^:\n]+"?):/)
    const version = block.match(/^\s+version\s+"?([^"\n]+)"?/m)?.[1]
    if (!header || !version) continue

    const selector = stripQuotes(header[1].split(/,\s*/)[0].trim())
    const name = packageNameFromYarnSelector(selector)
    if (name) deps.push(component('yarn', 'Node.js', name, version, 'lockfile', file))
  }
  return uniqueComponents(deps)
}

async function parseCargoLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'Cargo.lock'
  const content = await readText(join(cwd, file))
  if (!content) return []

  return matches(content, /\[\[package\]\]\s+name\s*=\s*"([^"]+)"\s+version\s*=\s*"([^"]+)"/g)
    .map((match) => component('cargo', 'Rust', match[1], match[2], 'lockfile', file))
}

async function parseGoSum(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'go.sum'
  const content = await readText(join(cwd, file))
  if (!content) return []

  const deps = content
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^(\S+)\s+(\S+)\s+\S+$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .filter((match) => !match[2].endsWith('/go.mod'))
    .map((match) => component('go', 'Go', match[1], match[2], 'lockfile', file))
  return uniqueComponents(deps)
}

async function parsePubspecLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'pubspec.lock'
  const content = await readText(join(cwd, file))
  if (!content) return []

  const deps: SupplyChainComponent[] = []
  const blocks = content.split(/\n(?=\s{2}[A-Za-z0-9_.-]+:\s*$)/m)
  for (const block of blocks) {
    const name = block.match(/^\s{2}([A-Za-z0-9_.-]+):\s*$/m)?.[1]
    const version = block.match(/^\s{4}version:\s*"?([^"\n]+)"?/m)?.[1]
    if (name && version) deps.push(component('flutter', 'Dart', name, version, 'lockfile', file))
  }
  return uniqueComponents(deps)
}

async function parseGradleLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'gradle.lockfile'
  const content = await readText(join(cwd, file))
  if (!content) return []

  const deps = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.match(/^([^:]+):([^:]+):([^=\s]+)/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => component('gradle', 'JVM', `${match[1]}:${match[2]}`, match[3], 'lockfile', file))
  return uniqueComponents(deps)
}

async function parseComposerLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'composer.lock'
  const json = await readJson(join(cwd, file))
  const packages = [
    ...arrayItems(json?.packages).map((item) => ({ item, scope: 'lockfile' })),
    ...arrayItems(json?.['packages-dev']).map((item) => ({ item, scope: 'lockfile-dev' }))
  ]

  return packages
    .map(({ item, scope }) => component('composer', 'PHP', String(item.name || ''), String(item.version || ''), scope, file, licenseFromValue(item.license)))
    .filter((item) => item.name && item.version)
}

async function parseGemfileLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'Gemfile.lock'
  const content = await readText(join(cwd, file))
  if (!content) return []

  const deps = matches(content, /^\s{4}([A-Za-z0-9_.-]+)\s+\(([^)]+)\)/gm)
    .map((match) => component('bundler', 'Ruby', match[1], match[2], 'lockfile', file))
  return uniqueComponents(deps)
}

async function parseNugetLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'packages.lock.json'
  const json = await readJson(join(cwd, file))
  const deps: SupplyChainComponent[] = []

  for (const target of Object.values(json?.dependencies || {}) as Array<Record<string, unknown>>) {
    for (const [name, info] of objectEntries(target)) {
      if (!info || typeof info !== 'object') continue
      const record = info as Record<string, unknown>
      const version = String(record.resolved || record.requested || '')
      if (version) deps.push(component('nuget', '.NET', name, version, 'lockfile', file))
    }
  }

  return uniqueComponents(deps)
}

async function parsePoetryLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'poetry.lock'
  const content = await readText(join(cwd, file))
  if (!content) return []

  return parseTomlPackageBlocks(content)
    .map((pkg) => component('poetry', 'Python', pkg.name, pkg.version, 'lockfile', file))
    .filter((item) => item.name && item.version)
}

async function parseUvLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'uv.lock'
  const content = await readText(join(cwd, file))
  if (!content) return []

  return parseTomlPackageBlocks(content)
    .map((pkg) => component('uv', 'Python', pkg.name, pkg.version, 'lockfile', file))
    .filter((item) => item.name && item.version)
}

async function parsePipfileLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'Pipfile.lock'
  const json = await readJson(join(cwd, file))
  const deps = [
    ...objectEntries(json?.default).map(([name, info]) => pipenvLockComponent(name, info, 'lockfile', file)),
    ...objectEntries(json?.develop).map(([name, info]) => pipenvLockComponent(name, info, 'lockfile-dev', file))
  ]
  return deps.filter((item): item is SupplyChainComponent => Boolean(item))
}

async function parseHelmLock(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'Chart.lock'
  const content = await readText(join(cwd, file))
  if (!content) return []

  return parseHelmDependencyBlocks(content)
    .map((item) => component('helm', 'Cloud Native', item.name, item.version, 'lockfile', file))
    .filter((item) => item.name && item.version)
}

async function parseVcpkgJson(cwd: string): Promise<SupplyChainComponent[]> {
  const file = 'vcpkg.json'
  const json = await readJson(join(cwd, file))
  const deps = Array.isArray(json?.dependencies) ? json.dependencies : []
  return deps.map((dep: any) => {
    if (typeof dep === 'string') return component('native', 'Native', dep, undefined, 'vcpkg', file)
    return component('native', 'Native', dep.name, dep['version>='] || dep.version, 'vcpkg', file)
  }).filter((item: SupplyChainComponent) => item.name)
}

async function parseConanfile(cwd: string): Promise<SupplyChainComponent[]> {
  const file = await firstExisting(cwd, ['conanfile.txt', 'conanfile.py'])
  if (!file) return []
  const content = await readText(join(cwd, file))
  return matches(content, /([A-Za-z0-9_.+-]+)\/([^\s"'?,\]]+)/g)
    .map((match) => component('native', 'Native', match[1], match[2], 'conan', file))
}

function pipenvLockComponent(name: string, info: unknown, scope: string, file: string): SupplyChainComponent | null {
  if (!info || typeof info !== 'object') return null
  const record = info as Record<string, unknown>
  const rawVersion = typeof record.version === 'string' ? record.version : undefined
  return component('pipenv', 'Python', name, rawVersion?.replace(/^==/, ''), scope, file)
}

function packageNameFromNodeModulesPath(path: string): string {
  const parts = path.split('node_modules/').filter(Boolean)
  return parts.at(-1) || ''
}

function packageNameFromYarnSelector(selector: string): string {
  const clean = selector.replace(/^npm:/, '')
  if (clean.startsWith('@')) {
    const versionMarker = clean.indexOf('@', 1)
    return versionMarker > 0 ? clean.slice(0, versionMarker) : clean
  }
  const versionMarker = clean.lastIndexOf('@')
  return versionMarker > 0 ? clean.slice(0, versionMarker) : clean
}

function licenseFromValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(' OR ') || undefined
  if (typeof value === 'string') return value
  return undefined
}

function arrayItems(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

function parseTomlPackageBlocks(content: string): Array<{ name: string; version: string }> {
  return content
    .split(/\r?\n(?=\[\[package\]\])/)
    .map((block) => ({
      name: block.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] || '',
      version: block.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1] || ''
    }))
    .filter((item) => item.name && item.version)
}

function parseHelmDependencyBlocks(content: string): Array<{ name: string; version?: string; repository?: string }> {
  const block = sectionAfterKey(content, 'dependencies')
  const deps: Array<{ name: string; version?: string; repository?: string }> = []
  let current: { name: string; version?: string; repository?: string } | null = null

  for (const line of block.split(/\r?\n/)) {
    const nameMatch = line.match(/^\s*-\s*name:\s*([^\n#]+)/)
    if (nameMatch) {
      if (current?.name) deps.push(current)
      current = { name: cleanYamlScalar(nameMatch[1]) }
      continue
    }

    if (!current) continue
    const versionMatch = line.match(/^\s*version:\s*([^\n#]+)/)
    if (versionMatch) {
      current.version = cleanYamlScalar(versionMatch[1])
      continue
    }

    const repositoryMatch = line.match(/^\s*repository:\s*([^\n#]+)/)
    if (repositoryMatch) {
      current.repository = cleanYamlScalar(repositoryMatch[1])
    }
  }

  if (current?.name) deps.push(current)
  return deps
}

function component(
  managerId: DependencyManagerId,
  ecosystem: string,
  name: string,
  version: string | undefined,
  scope: string,
  sourceFile: string,
  license?: string
): SupplyChainComponent {
  const normalizedVersion = cleanVersion(version)
  return {
    managerId,
    ecosystem,
    name,
    version: normalizedVersion,
    scope,
    sourceFile,
    packageUrl: packageUrl(managerId, name, normalizedVersion),
    license
  }
}

function packageUrl(managerId: DependencyManagerId, name: string, version?: string): string | undefined {
  const suffix = version ? `@${encodeURIComponent(version)}` : ''
  if (managerId === 'npm' || managerId === 'pnpm' || managerId === 'yarn' || managerId === 'bun') return `pkg:npm/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'pip' || managerId === 'uv' || managerId === 'poetry' || managerId === 'pipenv') return `pkg:pypi/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'renv') return `pkg:cran/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'julia') return `pkg:julia/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'maven' || managerId === 'gradle' || managerId === 'sbt' || managerId === 'leiningen') {
    const [groupId, artifactId] = name.split(':')
    if (groupId && artifactId) return `pkg:maven/${encodeURIComponent(groupId)}/${encodeURIComponent(artifactId)}${suffix}`
  }
  if (managerId === 'cargo') return `pkg:cargo/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'go') return `pkg:golang/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'composer') return `pkg:composer/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'bundler') return `pkg:gem/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'nuget') return `pkg:nuget/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'mix' || managerId === 'rebar3') return `pkg:hex/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'cabal' || managerId === 'stack') return `pkg:hackage/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'docker') return `pkg:docker/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'helm') return `pkg:helm/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'kustomize') return `pkg:generic/kustomize/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'helmfile') return `pkg:generic/helmfile/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'skaffold') return `pkg:generic/skaffold/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'argocd') return `pkg:generic/argocd/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'flux') return `pkg:generic/flux/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'terraform') return `pkg:terraform/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'opentofu') return `pkg:opentofu/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'ansible') return `pkg:ansible/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'github-actions') return `pkg:githubactions/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'gitlab-ci') return `pkg:gitlabci/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'pre-commit') return `pkg:pre-commit/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'bazel') return `pkg:bazel/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'pants') return `pkg:pants/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'buck') return `pkg:buck/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'opam') return `pkg:opam/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'cpan') return `pkg:cpan/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'luarocks') return `pkg:luarocks/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'shards') return `pkg:shards/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'zig') return `pkg:zig/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'homebrew') return `pkg:brew/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'chocolatey') return `pkg:chocolatey/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'scoop') return `pkg:generic/scoop/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'winget') return `pkg:generic/winget/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'asdf') return `pkg:generic/asdf/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'mise') return `pkg:generic/mise/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'sdkman') return `pkg:generic/sdkman/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'apt') return `pkg:deb/debian/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'dnf') return `pkg:rpm/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'apk') return `pkg:apk/alpine/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'pacman') return `pkg:alpm/arch/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'nix') return `pkg:generic/nix/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'mcp') return `pkg:generic/mcp-server/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'skills') return `pkg:generic/agent-skill/${encodeURIComponent(name)}${suffix}`
  if (managerId === 'ai-agents') return `pkg:generic/agent-instruction/${encodeURIComponent(name)}${suffix}`
  return undefined
}

function matchesPackageRule(component: SupplyChainComponent, rule: DependencyPolicyPackageRule): boolean {
  if (rule.managers?.length && !rule.managers.includes(component.managerId)) return false
  return rule.packagePatterns.some((pattern) => matchesPackagePattern(component.name, pattern))
}

function evaluatePackageRule(
  component: SupplyChainComponent,
  rule: DependencyPolicyPackageRule,
  licenses: string[]
): DependencyPolicyViolation[] {
  const violations: DependencyPolicyViolation[] = []
  const severity = normalizeRuleSeverity(rule.severity)
  const target = `${component.managerId}:${component.name}`
  const ruleLabel = rule.description || rule.id

  if (rule.blocked) {
    violations.push({
      severity: severity || 'critical',
      managerId: component.managerId,
      packageName: component.name,
      version: component.version,
      title: 'Package family rule blocks dependency',
      description: `${target} matches package rule ${rule.id}.`,
      recommendation: `Remove or replace the dependency, or update package family rule ${ruleLabel} after review.`
    })
  }

  if (rule.requirePinnedVersions && isUnpinnedVersion(component.version)) {
    const floatingExecutionReference = isFloatingExecutionReference(component)
    violations.push({
      severity: severity || (floatingExecutionReference ? 'high' : 'medium'),
      managerId: component.managerId,
      packageName: component.name,
      version: component.version,
      title: floatingExecutionReference ? 'Package family execution dependency uses floating reference' : 'Package family requires pinned version',
      description: `${target} matches ${rule.id} and uses ${component.version || 'no explicit version'}.`,
      recommendation: floatingExecutionReference
        ? `Pin this execution dependency to an immutable version, tag, or SHA, or add a reviewed exception to package family rule ${ruleLabel}.`
        : `Pin this dependency or add a reviewed exception to package family rule ${ruleLabel}.`
    })
  }

  if (rule.disallowPrerelease && component.version && isPrerelease(component.version)) {
    violations.push({
      severity: severity || 'medium',
      managerId: component.managerId,
      packageName: component.name,
      version: component.version,
      title: 'Package family disallows prerelease dependency',
      description: `${target}@${component.version} matches ${rule.id} and looks like a prerelease version.`,
      recommendation: `Use a stable release or record approval for package family rule ${ruleLabel}.`
    })
  }

  if (rule.requireKnownLicenses && licenses.length === 0) {
    violations.push({
      severity: severity || 'low',
      managerId: component.managerId,
      packageName: component.name,
      version: component.version,
      title: 'Package family requires known license',
      description: `${target} matches ${rule.id} and has no license metadata.`,
      recommendation: `Review license metadata or update package family rule ${ruleLabel}.`
    })
  }

  const blockedLicenses = new Set((rule.blockedLicenses || []).map(normalizeLicensePolicyValue).filter(Boolean))
  if (licenses.some((license) => blockedLicenses.has(normalizeLicensePolicyValue(license)))) {
    violations.push({
      severity: severity || 'critical',
      managerId: component.managerId,
      packageName: component.name,
      version: component.version,
      title: 'Package family blocks license',
      description: `${target} matches ${rule.id} and declares ${component.license}.`,
      recommendation: `Replace the dependency or update package family rule ${ruleLabel} after legal review.`
    })
  }

  const allowedLicenses = new Set((rule.allowedLicenses || []).map(normalizeLicensePolicyValue).filter(Boolean))
  if (allowedLicenses.size > 0 && licenses.length > 0 && !licenses.some((license) => allowedLicenses.has(normalizeLicensePolicyValue(license)))) {
    violations.push({
      severity: severity || 'high',
      managerId: component.managerId,
      packageName: component.name,
      version: component.version,
      title: 'Package family license is not allowed',
      description: `${target} matches ${rule.id} and declares ${component.license}, which is outside the rule license allowlist.`,
      recommendation: `Use an approved license or update package family rule ${ruleLabel} after review.`
    })
  }

  return violations
}

function matchesPackagePattern(name: string, pattern: string): boolean {
  const normalizedName = name.toLowerCase()
  const normalizedPattern = pattern.trim().toLowerCase()
  if (!normalizedPattern) return false
  if (normalizedPattern === normalizedName) return true
  if (!/[?*]/.test(normalizedPattern)) return false
  const escaped = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`).test(normalizedName)
}

function normalizeRuleSeverity(value: unknown): DependencyPolicyViolation['severity'] | undefined {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low' || value === 'info'
    ? value
    : undefined
}

async function writeReport(cwd: string, fileName: string, payload: unknown): Promise<string> {
  return await writeTextReport(cwd, fileName, JSON.stringify(payload, null, 2))
}

async function writeTextReport(cwd: string, fileName: string, content: string): Promise<string> {
  const path = join(cwd, REPORT_DIR, fileName)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf-8')
  return path
}

async function readSupplyChainFiles(cwd: string): Promise<SnapshotFile[]> {
  const patterns = MANAGER_DEFINITIONS.flatMap((manager) => [
    ...manager.manifestFiles,
    ...manager.lockFiles,
    ...(manager.configFiles || [])
  ])
  const directories = await snapshotDirectories(cwd, SNAPSHOT_MAX_SCAN_DEPTH)
  const files = new Set<string>()

  for (const directory of directories) {
    for (const file of await existingPatternMatches(directory, patterns)) {
      files.add(toPosix(relative(cwd, join(directory, file))))
    }
  }

  return await Promise.all([...files].sort().map(async (file) => {
    const content = await readText(join(cwd, file))
    return {
      file,
      hash: sha256(content),
      size: Buffer.byteLength(content, 'utf-8'),
      content
    }
  }))
}

async function snapshotDirectories(root: string, maxDepth: number): Promise<string[]> {
  const directories: string[] = []

  async function visit(directory: string, depth: number) {
    directories.push(directory)
    if (depth >= maxDepth) return

    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SNAPSHOT_IGNORED_DIRECTORIES.has(entry.name)) continue
      await visit(join(directory, entry.name), depth + 1)
    }
  }

  await visit(root, 0)
  return directories
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/')
}

async function readLatestSnapshot(cwd: string): Promise<(SavedSnapshot & { path: string }) | null> {
  const dir = join(cwd, SNAPSHOT_DIR)
  const files = (await readdirSafe(dir)).filter((file) => file.endsWith('.json')).sort()
  const latest = files.at(-1)
  if (!latest) return null
  const path = join(dir, latest)
  const snapshot = parseJson<SavedSnapshot | null>(await readText(path), null)
  return snapshot ? { ...snapshot, path } : null
}

function resolveSnapshotPath(cwd: string, snapshotIdOrPath: string): string {
  const snapshotRoot = resolve(cwd, SNAPSHOT_DIR)
  const candidate = snapshotIdOrPath.endsWith('.json') || snapshotIdOrPath.includes('/') || snapshotIdOrPath.includes('\\')
    ? (isAbsolute(snapshotIdOrPath) ? resolve(snapshotIdOrPath) : resolve(cwd, snapshotIdOrPath))
    : resolve(snapshotRoot, `${snapshotIdOrPath}.json`)

  if (!isInside(snapshotRoot, candidate)) {
    throw new Error('Snapshot path is outside the managed snapshot directory')
  }

  return candidate
}

function isInside(base: string, target: string): boolean {
  const relation = relative(resolve(base), resolve(target))
  return relation === '' || (!!relation && !relation.startsWith('..') && !isAbsolute(relation))
}

function parseYamlDependencySection(content: string, section: string): Array<[string, string | undefined]> {
  const block = sectionAfterKey(content, section)
  return block
    .split(/\r?\n/)
    .map((line) => line.match(/^\s{2,}([A-Za-z0-9_.-]+):\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [match[1], cleanYamlScalar(match[2]) || undefined])
}

function parseTomlKeyValues(content: string): Array<[string, string]> {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const [rawName, ...rawValue] = line.split('=')
      return [stripQuotes(rawName.trim()), cleanVersion(rawValue.join('=').trim()) || ''] as [string, string]
    })
}

function sectionContent(content: string, section: string): string {
  const match = new RegExp(`^\\s*\\[${escapeRegExp(section)}\\]\\s*$`, 'm').exec(content)
  if (!match) return ''
  const rest = content.slice(match.index + match[0].length)
  const nextSection = rest.search(/^\s*\[[^\]]+\]\s*$/m)
  return nextSection >= 0 ? rest.slice(0, nextSection) : rest
}

function sectionAfterKey(content: string, key: string): string {
  const lines = content.split(/\r?\n/)
  const start = lines.findIndex((line) => new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`).test(line))
  if (start < 0) return ''
  const result: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break
    result.push(line)
  }
  return result.join('\n')
}

function xmlTag(block: string, tag: string): string | undefined {
  return block.match(new RegExp(`<${tag}>\\s*([^<]+)\\s*</${tag}>`))?.[1]?.trim()
}

function cleanYamlScalar(value?: string): string {
  return stripQuotes((value || '').trim())
}

function cleanVersion(value?: string): string | undefined {
  if (!value) return undefined
  const clean = stripQuotes(value.trim())
  if (!clean || clean === '*' || clean === '{}') return undefined
  return clean
}

function normalizeRequirementVersion(value?: string): string | undefined {
  const clean = value?.trim()
  if (!clean) return undefined
  const exact = clean.match(/^={2,3}\s*(.+)$/)
  return exact ? exact[1].trim() : clean
}

function isFloatingExecutionReference(component: SupplyChainComponent): boolean {
  return EXECUTION_DEPENDENCY_MANAGERS.has(component.managerId) && isUnpinnedVersion(component.version)
}

function isUnpinnedVersion(value?: string): boolean {
  if (!value) return true
  const clean = value.trim()
  const normalized = clean.toLowerCase().replace(/^refs\/heads\//, '')
  if (!clean || clean === '*' || FLOATING_VERSION_LABELS.has(normalized)) return true
  if (/^(branch|ref)\s*[:=]\s*/i.test(clean)) return true
  if (/^refs\/heads\//i.test(clean)) return true
  if (/^(any|\{\})$/i.test(clean)) return true
  if (/^[~^<>=!*]/.test(clean)) return true
  if (/[xX*]/.test(clean)) return true
  if (/\|\||,/.test(clean)) return true
  return false
}

function isPrerelease(value: string): boolean {
  return /(?:^|[.-])(alpha|beta|rc|next|canary|snapshot|preview|dev)(?:[.-]|\d|$)/i.test(value)
}

function normalizePolicy(policy: Partial<DependencyPolicy>): DependencyPolicy {
  return {
    requirePinnedVersions: Boolean(policy.requirePinnedVersions ?? DEFAULT_POLICY.requirePinnedVersions),
    disallowPrerelease: Boolean(policy.disallowPrerelease ?? DEFAULT_POLICY.disallowPrerelease),
    requireKnownLicenses: Boolean(policy.requireKnownLicenses ?? DEFAULT_POLICY.requireKnownLicenses),
    blockedManagers: uniqueStringArray(policy.blockedManagers) as DependencyManagerId[],
    blockedPackages: uniqueStringArray(policy.blockedPackages),
    blockedLicenses: uniqueStringArray(policy.blockedLicenses),
    allowedLicenses: uniqueStringArray(policy.allowedLicenses),
    allowedManagers: uniqueStringArray(policy.allowedManagers) as DependencyManagerId[],
    packageRules: normalizePackageRules(policy.packageRules),
    maxComponents: typeof policy.maxComponents === 'number' && Number.isFinite(policy.maxComponents) && policy.maxComponents > 0
      ? Math.floor(policy.maxComponents)
      : undefined
  }
}

function normalizePackageRules(value: unknown): DependencyPolicyPackageRule[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => normalizePackageRule(item, index))
    .filter((item): item is DependencyPolicyPackageRule => Boolean(item && item.packagePatterns.length > 0))
}

function normalizePackageRule(value: unknown, index: number): DependencyPolicyPackageRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rule = value as Partial<DependencyPolicyPackageRule>
  const id = String(rule.id || `package-rule-${index + 1}`).trim()
  const severity = normalizeRuleSeverity(rule.severity)
  return {
    id,
    description: typeof rule.description === 'string' && rule.description.trim() ? rule.description.trim() : undefined,
    packagePatterns: uniqueStringArray(rule.packagePatterns),
    managers: uniqueStringArray(rule.managers) as DependencyManagerId[],
    severity,
    blocked: rule.blocked === true,
    requirePinnedVersions: rule.requirePinnedVersions === true,
    disallowPrerelease: rule.disallowPrerelease === true,
    requireKnownLicenses: rule.requireKnownLicenses === true,
    allowedLicenses: uniqueStringArray(rule.allowedLicenses),
    blockedLicenses: uniqueStringArray(rule.blockedLicenses)
  }
}

function uniqueStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
}

function uniqueValues<T extends string>(value: T[]): T[] {
  return [...new Set(value.map((item) => item.trim()).filter(Boolean) as T[])]
}

function splitLicenses(value?: string): string[] {
  if (!value) return []
  const normalized = value
    .replace(/[()]/g, '')
    .replace(/\s+(AND|OR)\s+/gi, ',')
    .replace(/\s*\/\s*/g, ',')

  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toUpperCase() !== 'NOASSERTION')
}

function normalizeLicensePolicyValue(value: string): string {
  return value.trim().toUpperCase()
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

function objectEntries(value: unknown): Array<[string, unknown]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>)
}

async function readJson(path: string): Promise<any> {
  return parseJson(await readText(path), null)
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

async function firstExisting(cwd: string, files: string[]): Promise<string | null> {
  for (const file of files) {
    try {
      await access(join(cwd, file))
      return file
    } catch {
    }
  }
  return null
}

function matches(content: string, regex: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    results.push(match)
  }
  return results
}

function uniqueComponents(items: SupplyChainComponent[]): SupplyChainComponent[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.name) return false
    const key = `${item.managerId}:${item.sourceFile}:${item.scope}:${item.name}:${item.version || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function safeSpdxId(value: string): string {
  return value.replace(/[^A-Za-z0-9.-]/g, '-')
}

function timestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
