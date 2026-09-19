import { handleIpc } from './ipcHandler'
import { installProcessGuards } from './services/processGuard'
import {
  getStartupLanguageInfo,
  type AppLanguage,
  type StartupLanguageInfo
} from './services/startupLanguage'
import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { NpmService, setNpmServiceWindow } from './services/npm'
import { ProjectService } from './services/project'
import { PublishService } from './services/publish'
import { SystemService } from './services/system'
import { PipService } from './services/pip'
import { MavenService } from './services/maven'
import { CargoService } from './services/cargo'
import { GradleService } from './services/gradle'
import { GoService } from './services/go'
import { FlutterService } from './services/flutter'
import { NativeService } from './services/native'
import { ManagerWorkspaceService } from './services/managerWorkspace'
import { SupplyChainService } from './services/supplyChain'
import { ThirdPartyNoticesService } from './services/thirdPartyNotices'
import { ReadinessGateService } from './services/readinessGate'
import { CiEvidenceService } from './services/ciEvidence'
import { AuditEvidenceService } from './services/auditEvidence'
import { VulnerabilityRemediationPlanService } from './services/vulnerabilityRemediationPlan'
import { ReleaseApprovalService } from './services/releaseApproval'
import { ReleaseExceptionService } from './services/releaseException'
import { RegistryReachabilityService } from './services/registryReachability'
import { CredentialUsageService } from './services/credentialUsage'
import { LockfileDriftService } from './services/lockfileDrift'
import { RuntimePinningService } from './services/runtimePinning'
import { OfflineCacheReadinessService } from './services/offlineCacheReadiness'
import { ReleaseRiskProfileService } from './services/releaseRiskProfile'
import { CiIntegrationPlanService } from './services/ciIntegrationPlan'
import { DependencyAutomationPlanService } from './services/dependencyAutomationPlan'
import { DependencyUpgradePlaybookService } from './services/dependencyUpgradePlaybook'
import { CredentialRotationPlanService } from './services/credentialRotationPlan'
import { AutomationSafetyPlanService } from './services/automationSafetyPlan'
import { DependencyOwnershipPlanService } from './services/dependencyOwnershipPlan'
import { PolicyAsCodePackService } from './services/policyAsCodePack'
import { DependencyRollbackPlanService } from './services/dependencyRollbackPlan'
import { DependencyImpactAnalysisService } from './services/dependencyImpactAnalysis'
import { DependencyChangeApprovalPacketService } from './services/dependencyChangeApprovalPacket'
import { DependencyChangeCalendarService } from './services/dependencyChangeCalendar'
import { DependencyChangeExecutionRecordService } from './services/dependencyChangeExecutionRecord'
import { WorkspaceDiscoveryService } from './services/workspaceDiscovery'
import { WorkspaceGovernanceService } from './services/workspaceGovernance'
import { DependencyHealthDashboardService } from './services/dependencyHealthDashboard'
import { ReportArtifactIndexService } from './services/reportArtifactIndex'
import { ReleaseEvidenceCompletenessService } from './services/releaseEvidenceCompleteness'
import { ReleaseProvenanceAttestationService } from './services/releaseProvenanceAttestation'
import { ReleaseIntegrityVerificationService } from './services/releaseIntegrityVerification'
import { ReleaseSignatureService } from './services/releaseSignature'
import { ReleaseTrustPolicyService } from './services/releaseTrustPolicy'
import { FrameworkCoverageService } from './services/frameworkCoverage'
import { DependencyHealthService } from './services/dependencyHealth'
import { SmartUpdateService } from './services/smartUpdate'
import { PluginCatalogService } from './services/pluginCatalog'
import { exportOperationHistory, listOperationHistory } from './services/operationHistory'
import { credentialVaultService, type CredentialInput } from './services/credentialVault'
import { aiProviderStore } from './services/aiProviders'
import type { AiProviderInput } from './services/aiProviders'
import { TerminalService, setTerminalWindow } from './services/terminal'
import { checkTools, openToolDownload, setToolPath, clearToolPath, getProjectToolchainConfig, checkTool, TOOL_NAMES } from './services/toolchain'
import { fileWatcher } from './services/watcher'
import { withProjectMutation } from './services/projectMutation'
import {
  beginOperation,
  cancelProjectOperations,
  listActiveOperations,
  requestOperationCancel,
  runWithOperationContext,
  attachOperationFailure,
  type OperationContext
} from './services/operationContext'
import { isAllowedExternalUrl, isAllowedAppNavigation } from './services/externalUrl'
import { assertSafeShellTarget } from './services/shellGuard'
import { commandMutatesProjectFiles } from './services/commandMutates'
import { runProjectOperation } from './services/projectGuard'
import type { DependencyManagerId } from '../shared/managerRegistry'
import type {
  ManagerExecuteOptions,
  ManagerOperationRequest,
  ManagerSearchQuery
} from '../shared/managerWorkspace'

const mainDir = __dirname

if (process.platform === 'win32' && !process.env.ELECTRON_ENABLE_CHROMIUM_LOGGING) {
  app.commandLine.appendSwitch('log-level', '3')
}

const menuLabels: Record<AppLanguage, Record<string, string>> = {
  'en-US': {
    file: 'File',
    quit: 'Quit',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    view: 'View',
    reload: 'Reload',
    devTools: 'Developer Tools',
    resetZoom: 'Reset Zoom',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    fullscreen: 'Full Screen',
    help: 'Help',
    about: 'About',
    aboutTitle: 'About DependencyHub Desktop',
    aboutDetail: 'A cross-platform workspace for multi-ecosystem project dependencies, toolchains, security health, and release governance'
  },
  'zh-CN': {
    file: '文件',
    quit: '退出',
    edit: '编辑',
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    view: '视图',
    reload: '重新加载',
    devTools: '开发者工具',
    resetZoom: '重置缩放',
    zoomIn: '放大',
    zoomOut: '缩小',
    fullscreen: '全屏',
    help: '帮助',
    about: '关于',
    aboutTitle: '关于 DependencyHub Desktop',
    aboutDetail: '面向多生态项目的跨平台桌面依赖管理、工具链治理、安全健康与发布管理平台'
  }
}

let mainWindow: BrowserWindow | null = null
let cleanupDone = false
const npmService = new NpmService()
const projectService = new ProjectService()
const publishService = new PublishService()
const systemService = new SystemService()
const pipService = new PipService()
const mavenService = new MavenService()
const cargoService = new CargoService()
const gradleService = new GradleService()
const goService = new GoService()
const flutterService = new FlutterService()
const nativeService = new NativeService()
const managerWorkspaceService = new ManagerWorkspaceService()
const supplyChainService = new SupplyChainService()
const thirdPartyNoticesService = new ThirdPartyNoticesService({
  supplyChainService
})
const ciEvidenceService = new CiEvidenceService()
const auditEvidenceService = new AuditEvidenceService()
const vulnerabilityRemediationPlanService = new VulnerabilityRemediationPlanService({
  auditEvidenceService
})
const releaseApprovalService = new ReleaseApprovalService()
const releaseExceptionService = new ReleaseExceptionService()
const registryReachabilityService = new RegistryReachabilityService()
const credentialUsageService = new CredentialUsageService({
  registryReachabilityService,
  credentialVault: credentialVaultService
})
const workspaceDiscoveryService = new WorkspaceDiscoveryService()
const lockfileDriftService = new LockfileDriftService({
  workspaceDiscoveryService
})
const runtimePinningService = new RuntimePinningService({
  workspaceDiscoveryService
})
const offlineCacheReadinessService = new OfflineCacheReadinessService({
  workspaceDiscoveryService
})
const readinessGateService = new ReadinessGateService({
  projectService,
  supplyChainService,
  ciEvidenceService,
  releaseApprovalService,
  releaseExceptionService,
  registryReachabilityService,
  auditEvidenceService,
  workspaceDiscoveryService,
  lockfileDriftService,
  runtimePinningService,
  credentialUsageService,
  credentialVault: credentialVaultService,
  checkTool: (tool, projectPath) => checkTool(tool as any, projectPath)
})
const releaseRiskProfileService = new ReleaseRiskProfileService({
  supplyChainService,
  readinessGateService,
  registryReachabilityService,
  credentialUsageService,
  workspaceDiscoveryService,
  lockfileDriftService,
  runtimePinningService,
  offlineCacheReadinessService,
  auditEvidenceService
})
const ciIntegrationPlanService = new CiIntegrationPlanService({
  workspaceDiscoveryService,
  readinessGateService,
  lockfileDriftService,
  runtimePinningService,
  offlineCacheReadinessService,
  releaseRiskProfileService
})
const dependencyAutomationPlanService = new DependencyAutomationPlanService({
  workspaceDiscoveryService,
  lockfileDriftService
})
const credentialRotationPlanService = new CredentialRotationPlanService({
  credentialUsageService,
  dependencyAutomationPlanService
})
const automationSafetyPlanService = new AutomationSafetyPlanService({
  dependencyAutomationPlanService,
  credentialRotationPlanService,
  readinessGateService,
  releaseRiskProfileService
})
const dependencyOwnershipPlanService = new DependencyOwnershipPlanService({
  workspaceDiscoveryService,
  dependencyAutomationPlanService,
  automationSafetyPlanService
})
const policyAsCodePackService = new PolicyAsCodePackService({
  supplyChainService,
  readinessGateService,
  dependencyAutomationPlanService,
  automationSafetyPlanService,
  dependencyOwnershipPlanService,
  workspaceDiscoveryService
})
const workspaceGovernanceService = new WorkspaceGovernanceService({
  workspaceDiscoveryService,
  supplyChainService,
  readinessGateService,
  releaseApprovalService,
  ciEvidenceService,
  auditEvidenceService,
  releaseExceptionService,
  registryReachabilityService,
  credentialUsageService,
  lockfileDriftService,
  runtimePinningService,
  offlineCacheReadinessService,
  releaseRiskProfileService,
  vulnerabilityRemediationPlanService,
  ciIntegrationPlanService,
  dependencyAutomationPlanService,
  credentialRotationPlanService,
  automationSafetyPlanService,
  dependencyOwnershipPlanService,
  policyAsCodePackService,
  thirdPartyNoticesService
})
const dependencyHealthDashboardService = new DependencyHealthDashboardService({
  workspaceDiscoveryService,
  workspaceGovernanceService,
  supplyChainService,
  readinessGateService,
  lockfileDriftService,
  runtimePinningService,
  offlineCacheReadinessService,
  releaseRiskProfileService,
  credentialUsageService,
  registryReachabilityService,
  auditEvidenceService
})
const reportArtifactIndexService = new ReportArtifactIndexService()
const releaseEvidenceCompletenessService = new ReleaseEvidenceCompletenessService({
  reportArtifactIndexService,
  policyAsCodePackService
})
const releaseProvenanceAttestationService = new ReleaseProvenanceAttestationService({
  reportArtifactIndexService,
  releaseEvidenceCompletenessService
})
const releaseIntegrityVerificationService = new ReleaseIntegrityVerificationService()
const releaseSignatureService = new ReleaseSignatureService()
const releaseTrustPolicyService = new ReleaseTrustPolicyService({
  releaseSignatureService,
  releaseIntegrityVerificationService,
  releaseProvenanceAttestationService,
  releaseEvidenceCompletenessService,
  releaseApprovalService,
  releaseExceptionService
})
const dependencyUpgradePlaybookService = new DependencyUpgradePlaybookService({
  workspaceGovernanceService,
  vulnerabilityRemediationPlanService,
  releaseRiskProfileService,
  dependencyAutomationPlanService,
  dependencyOwnershipPlanService
})
const dependencyRollbackPlanService = new DependencyRollbackPlanService({
  workspaceGovernanceService
})
const dependencyImpactAnalysisService = new DependencyImpactAnalysisService({
  workspaceGovernanceService,
  dependencyUpgradePlaybookService,
  dependencyRollbackPlanService,
  releaseRiskProfileService,
  ciIntegrationPlanService,
  dependencyOwnershipPlanService
})
const dependencyChangeApprovalPacketService = new DependencyChangeApprovalPacketService({
  dependencyImpactAnalysisService,
  dependencyUpgradePlaybookService,
  dependencyRollbackPlanService,
  releaseTrustPolicyService,
  releaseApprovalService,
  releaseExceptionService
})
const dependencyChangeCalendarService = new DependencyChangeCalendarService({
  dependencyChangeApprovalPacketService,
  dependencyImpactAnalysisService
})
const dependencyChangeExecutionRecordService = new DependencyChangeExecutionRecordService({
  dependencyChangeCalendarService,
  dependencyChangeApprovalPacketService,
  ciEvidenceService
})
const frameworkCoverageService = new FrameworkCoverageService()
const dependencyHealthService = new DependencyHealthService()
const smartUpdateService = new SmartUpdateService()
const pluginCatalogService = new PluginCatalogService()
const terminalService = new TerminalService()

function mavenCredentialEnvNames(serverId: string): { username: string; password: string } {
  const normalized = serverId
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'DEFAULT'
  return {
    username: `NPM_MANAGER_MAVEN_${normalized}_USERNAME`,
    password: `NPM_MANAGER_MAVEN_${normalized}_PASSWORD`
  }
}

async function npmCredentialEnv(args: any): Promise<NodeJS.ProcessEnv | undefined> {
  if (args?.credentialId) {
    const credential = await credentialVaultService.resolve(args.credentialId)
    return { NODE_AUTH_TOKEN: credential.secret }
  }
  if (args?.token) {
    return { NODE_AUTH_TOKEN: args.token }
  }
  return undefined
}

async function pipPublishArgs(args: any): Promise<any> {
  if (!args?.credentialId) return args
  const credential = await credentialVaultService.resolve(args.credentialId)
  return {
    ...args,
    username: args.username || credential.metadata.account || '__token__',
    password: credential.secret
  }
}

async function mavenCredentialEnv(repositoryId?: string): Promise<NodeJS.ProcessEnv | undefined> {
  if (!repositoryId) return undefined
  const credential = await credentialVaultService.resolveByService('maven', repositoryId)
  if (!credential) return undefined
  const names = mavenCredentialEnvNames(repositoryId)
  return {
    [names.username]: credential.metadata.account || '',
    [names.password]: credential.secret
  }
}

function cwdFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined
  const cwd = (args as { cwd?: unknown }).cwd
  return typeof cwd === 'string' && cwd.trim() ? cwd : undefined
}

async function snapshotBeforeMutation(cwd: string | undefined, label: string): Promise<void> {
  if (!cwd) return

  try {
    await supplyChainService.createSnapshot(cwd, { reason: label, source: 'mutation' })
  } catch (error) {
    console.warn(`[dependency snapshot] ${label} failed`, error)
  }
}

/**
 * Single write-path guard: every mutating IPC handler funnels through here so the
 * snapshot, the per-project serialization and the operation context are identical
 * for all ecosystems instead of each handler inventing its own ordering.
 */
async function withProjectSnapshot<T>(
  cwd: string | undefined,
  label: string,
  operation: (context: OperationContext) => Promise<T>,
  options: { timeoutMs?: number | null; operationId?: string; kind?: 'mutation' | 'read'; serializeKey?: string } = {}
): Promise<T> {
  return await runProjectOperation(projectGuardDependencies(), cwd, label, operation, options)
}

/**
 * Global npm mutations have no project path, but they still share mutable state
 * (the global prefix). A constant queue key keeps them serialized instead of
 * skipping the guard entirely.
 */
const GLOBAL_NPM_OPERATION_KEY = '__global_npm__'

/** Manager operations that only read installed state and must not snapshot. */
const READ_ONLY_MANAGER_OPERATIONS = new Set(['list', 'tree', 'audit', 'outdated', 'validate'])

async function withNpmMutation<T>(
  args: { global?: boolean } | undefined,
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  const global = Boolean(args?.global)
  return await withProjectSnapshot(
    global ? undefined : cwdFromArgs(args),
    global ? `${label} (global)` : label,
    () => operation(),
    global ? { serializeKey: GLOBAL_NPM_OPERATION_KEY } : {}
  )
}

function projectGuardDependencies() {
  return {
    beginOperation,
    runWithOperationContext,
    withProjectMutation,
    snapshot: snapshotBeforeMutation,
    attachFailure: attachOperationFailure
  }
}

async function enforcePublishReadinessGate(
  cwd: string | undefined,
  label: string,
  args: { overrideReadinessGate?: boolean; dryRun?: boolean | string } = {},
  options: { allowDryRun?: boolean } = {}
): Promise<void> {
  await readinessGateService.assertPublishAllowed(cwd, label, {
    overrideReadinessGate: args.overrideReadinessGate,
    dryRun: args.dryRun,
    allowDryRun: options.allowDryRun
  })
}

function createWindow() {
  // A window can be recreated after a macOS close (app stays alive); reset the
  // cleanup latch or the next close/quit would skip terminal and watcher teardown.
  cleanupDone = false
  let iconPath: string;
  
  if (process.env.NODE_ENV === 'development') {
    iconPath = join(mainDir, '../../icon.jpg');
  } else {
    iconPath = join(process.resourcesPath, 'icon.jpg');
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#1e1e1e',
    icon: iconPath,
    webPreferences: {
      preload: join(mainDir, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // The renderer must never be able to navigate the shell away from the app bundle
  // or spawn arbitrary windows; external links go through the checked handler below.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppNavigation(url, join(mainDir, '../dist/index.html'), process.env.NODE_ENV === 'development')) return
    event.preventDefault()
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
  })

  setNpmServiceWindow(mainWindow)
  setTerminalWindow(mainWindow)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(mainDir, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    runExitCleanup()
  })
}

/** Idempotent teardown shared by window close and app quit. */
function runExitCleanup(): void {
  if (cleanupDone) return
  cleanupDone = true
  setNpmServiceWindow(null as any)
  setTerminalWindow(null)
  terminalService.killAll()
  // Drop manifest watchers so exiting cannot leak FSWatchers.
  fileWatcher.unwatchAll()
}

// A second app instance would duplicate IPC handlers, watchers and services;
// forward its launch to the existing window instead of starting a second copy.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    setupApplicationMenu(getStartupLanguageInfo().language)
    createWindow()
    setupIpcHandlers()
  })
}

// Installed before any window exists so a failure during startup is still
// captured instead of silently closing the app.
installProcessGuards({ getWindow: () => mainWindow })

app.on('will-quit', () => {
  // Quitting without closing the window first (e.g. Cmd+Q on macOS) would
  // otherwise leak terminal children and manifest watchers.
  runExitCleanup()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

function setupIpcHandlers() {
  handleIpc('app:get-startup-language', async () => {
    return getStartupLanguageInfo()
  })

  handleIpc('app:set-menu-language', async (_, language: AppLanguage) => {
    setupApplicationMenu(language)
  })

  handleIpc('get-default-path', async () => {
    return app.getPath('home') || process.cwd()
  })

  handleIpc('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    return result.filePaths[0] || null
  })

  handleIpc('select-file', async (_, options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: options?.title,
      filters: options?.filters,
      properties: ['openFile']
    })
    return result.filePaths[0] || null
  })

  handleIpc('npm:search', async (_, query: string, limit?: number) => {
    return await npmService.search(query, limit)
  })

  handleIpc('npm:view', async (_, packageName: string) => {
    return await npmService.view(packageName)
  })

  handleIpc('npm:smart-analyze', async (_, input) => {
    if (!input || typeof input !== 'object') throw new Error('Version analysis input is required')
    const packageName = typeof input.packageName === 'string' ? input.packageName.trim() : ''
    const currentVersion = typeof input.currentVersion === 'string' ? input.currentVersion.trim() : ''
    const allVersions = Array.isArray(input.allVersions) ? input.allVersions.filter((item: unknown): item is string => typeof item === 'string') : []
    const securityFixVersions = Array.isArray(input.securityFixVersions) ? input.securityFixVersions.filter((item: unknown): item is string => typeof item === 'string') : []
    if (!packageName || !currentVersion) throw new Error('Package name and current version are required')
    return smartUpdateService.analyze({
      packageName,
      currentVersion,
      allVersions,
      wantedVersion: typeof input.wantedVersion === 'string' ? input.wantedVersion : undefined,
      latestVersion: typeof input.latestVersion === 'string' ? input.latestVersion : undefined,
      securityFixVersions
    })
  })

  handleIpc('npm:install', async (_, args) => {
    return await withNpmMutation(args, 'npm install', () => npmService.install(args))
  })

  handleIpc('npm:uninstall', async (_, args) => {
    return await withNpmMutation(args, 'npm uninstall', () => npmService.uninstall(args))
  })

  handleIpc('npm:update', async (_, args) => {
    return await withNpmMutation(args, 'npm update', () => npmService.update(args))
  })

  handleIpc('npm:outdated', async (_, cwd: string) => {
    return await npmService.outdated(cwd)
  })

  handleIpc('npm:list', async (_, cwd: string, global: boolean) => {
    return await npmService.list(cwd, global)
  })

  handleIpc('npm:config-list', async () => {
    return await npmService.configList()
  })

  handleIpc('npm:config-set', async (_, key: string, value: string) => {
    return await npmService.configSet(key, value)
  })

  handleIpc('npm:whoami', async () => {
    return await npmService.whoami()
  })

  handleIpc('npm:login', async (_, registry?: string) => {
    return await npmService.login(registry)
  })

  handleIpc('npm:logout', async (_, registry?: string) => {
    return await npmService.logout(registry)
  })

  handleIpc('project:detect', async (_, projectPath: string) => {
    return await projectService.detectProject(projectPath)
  })

  handleIpc('project:read-package', async (_, projectPath: string) => {
    return await projectService.readPackageJson(projectPath)
  })

  handleIpc('project:inventory', async (_, projectPath: string) => {
    return await projectService.inventory(projectPath)
  })

  handleIpc('project:export-inventory', async (_, projectPath: string) => {
    return await projectService.exportInventory(projectPath)
  })

  handleIpc('project:toolchain-get', async (_, projectPath: string) => {
    return await getProjectToolchainConfig(projectPath)
  })

  handleIpc('project:toolchain-set', async (_, projectPath: string, tool, toolPath: string) => {
    return await setToolPath(tool, toolPath, projectPath)
  })

  handleIpc('project:toolchain-clear', async (_, projectPath: string, tool) => {
    return await clearToolPath(tool, projectPath)
  })

  handleIpc('project:toolchain-check', async (_, projectPath: string) => {
    return await Promise.all(TOOL_NAMES.map((tool) => checkTool(tool, projectPath)))
  })

  handleIpc('publish:check', async (_, projectPath: string) => {
    return await publishService.check(projectPath)
  })

  handleIpc('publish:publish', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'npm publish', args)
    const env = await npmCredentialEnv(args)
    const publishArgs = { ...args, token: undefined }
    return await withProjectSnapshot(cwdFromArgs(args), 'npm publish', () => publishService.publish(publishArgs, { env }))
  })

  handleIpc('credentials:status', async () => {
    return credentialVaultService.status()
  })

  handleIpc('credentials:list', async (_, filter?: { managerId?: any; service?: string }) => {
    return await credentialVaultService.list(filter || {})
  })

  handleIpc('credentials:save', async (_, input: CredentialInput) => {
    return await credentialVaultService.save(input)
  })

  handleIpc('credentials:delete', async (_, id: string) => {
    return await credentialVaultService.delete(id)
  })

  // --- AI provider management (MCP / LLM providers) ------------------------
  handleIpc('ai:providers:status', async () => {
    return await aiProviderStore.status()
  })

  handleIpc('ai:providers:list', async () => {
    return await aiProviderStore.list()
  })

  handleIpc('ai:providers:upsert', async (_, input: AiProviderInput) => {
    return await aiProviderStore.upsert(input)
  })

  handleIpc('ai:providers:remove', async (_, id: string) => {
    return await aiProviderStore.remove(id)
  })

  handleIpc('ai:providers:set-active', async (_, id: string | null) => {
    return await aiProviderStore.setActive(id)
  })

  handleIpc('ai:providers:get-active', async () => {
    return await aiProviderStore.activeId()
  })

  handleIpc('ai:providers:test', async (_, id: string) => {
    return await aiProviderStore.test(id)
  })

  handleIpc('open-external', async (_, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      throw new Error(`Refusing to open an unsupported or unsafe URL protocol: ${String(url).slice(0, 64)}`)
    }
    await shell.openExternal(url.trim())
  })

  handleIpc('operation:cancel', async (_, operationId: string) => {
    return requestOperationCancel(operationId)
  })

  handleIpc('operation:cancel-project', async (_, projectPath: string) => {
    return cancelProjectOperations(projectPath)
  })

  handleIpc('operation:list-active', async () => {
    return listActiveOperations()
  })

  handleIpc('system:open-path', async (_, path: string) => {
    await assertSafeShellTarget(path)
    await shell.openPath(path)
  })

  handleIpc('system:open-file', async (_, filePath: string) => {
    await assertSafeShellTarget(filePath)
    await shell.openPath(filePath)
  })

  handleIpc('system:get-npm-info', async () => {
    return await systemService.getNpmInfo()
  })

  handleIpc('system:get-cache-path', async () => {
    return await systemService.getCachePath()
  })

  handleIpc('system:set-cache-path', async (_, newPath: string) => {
    return await systemService.setCachePath(newPath)
  })

  handleIpc('system:clear-cache', async () => {
    return await systemService.clearCache()
  })

  handleIpc('system:update-npm', async () => {
    return await systemService.updateNpm()
  })

  handleIpc('system:npm-help', async (_, command?: string) => {
    return await systemService.npmHelp(command)
  })

  handleIpc('system:check-tools', async () => {
    return await checkTools()
  })

  handleIpc('system:set-tool-path', async (_, tool, toolPath: string) => {
    await setToolPath(tool, toolPath)
    return await checkTools()
  })

  handleIpc('system:open-tool-download', async (_, tool) => {
    return await openToolDownload(tool)
  })

  handleIpc('npm:run-script', async (_, cwd: string, script: string) => {
    return await withProjectSnapshot(cwd, `npm run ${script}`, () => npmService.runScript(cwd, script))
  })

  handleIpc('npm:get-scripts', async (_, cwd: string) => {
    return await npmService.getScripts(cwd)
  })

  handleIpc('npm:config-get', async (_, key: string) => {
    return await npmService.configGet(key)
  })

  handleIpc('npm:config-delete', async (_, key: string) => {
    return await npmService.configDelete(key)
  })

  handleIpc('npm:config-edit', async () => {
    return await npmService.configEdit()
  })

  handleIpc('npm:move-dep', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'npm move dependency', () => npmService.moveDependency(args))
  })

  handleIpc('npm:get-published', async (_, username: string) => {
    return await npmService.getPublishedPackages(username)
  })

  handleIpc('npm:check-all-outdated', async (_, cwd: string) => {
    return await npmService.checkAllOutdated(cwd)
  })

  handleIpc('npm:open-terminal', async (_, cwd: string) => {
    return await systemService.openTerminal(cwd)
  })

  handleIpc('project:write-package', async (_, projectPath: string, content: any) => {
    return await withProjectSnapshot(projectPath, 'write package.json', () => projectService.writePackageJson(projectPath, content))
  })

  handleIpc('project:get-package-path', async (_, projectPath: string) => {
    return join(projectPath, 'package.json')
  })

  handleIpc('project:get-node-modules-path', async (_, projectPath: string, packageName: string) => {
    return join(projectPath, 'node_modules', packageName)
  })

  handleIpc('npm:info', async (_, packageName: string) => {
    return await npmService.getPackageInfo(packageName)
  })

  handleIpc('npm:get-versions', async (_, packageName: string) => {
    return await npmService.getVersions(packageName)
  })

  handleIpc('npm:get-version-metadata', async (_, packageName: string) => {
    return await npmService.getVersionMetadata(packageName)
  })

  handleIpc('npm:install-version', async (_, args) => {
    return await withNpmMutation(args, 'npm install version', () => npmService.installVersion(args))
  })

  handleIpc('npm:global-outdated', async () => {
    return await npmService.globalOutdated()
  })

  handleIpc('npm:adduser', async (_, registry?: string) => {
    return await npmService.adduser(registry)
  })

  handleIpc('npm:get-registry-info', async (_, registry?: string) => {
    return await npmService.getRegistryInfo(registry)
  })

  handleIpc('npm:get-package-size', async (_, packageName: string, version?: string) => {
    return await npmService.getPackageSize(packageName, version)
  })

  handleIpc('npm:get-dependency-tree', async (_, packageName: string, version?: string, depth?: number) => {
    return await npmService.getDependencyTree(packageName, version, depth)
  })

  handleIpc('npm:audit', async (_, cwd: string) => {
    return await npmService.audit(cwd)
  })

  handleIpc('npm:global-audit', async () => {
    return await npmService.globalAudit()
  })

  handleIpc('npm:audit-fix', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'npm audit fix', () => npmService.auditFix(cwd))
  })

  handleIpc('npm:get-readme', async (_, packageName: string) => {
    return await npmService.getPackageReadme(packageName)
  })

  handleIpc('npm:get-dependents', async (_, packageName: string) => {
    return await npmService.getDependents(packageName)
  })

  handleIpc('npm:download-stats', async (_, packageName: string) => {
    return await npmService.downloadStats(packageName)
  })

  handleIpc('watch:start', async (_, projectPath: string) => {
    await fileWatcher.watchProject(projectPath, (change) => {
      mainWindow?.webContents.send('file-change', {
        type: 'manifest',
        file: change.file,
        event: change.type,
        path: change.path
      })
    })
  })

  handleIpc('watch:stop', async (_, projectPath?: string) => {
    if (projectPath) {
      fileWatcher.unwatchProject(projectPath)
    } else {
      fileWatcher.unwatchAll()
    }
  })

  handleIpc('watch:list', async () => {
    return fileWatcher.watchedProjects()
  })

  handleIpc('npm:get-project-dependency-tree', async (_, cwd: string, depth: number = 2) => {
    return await npmService.getProjectDependencyTree(cwd, depth)
  })

  handleIpc('npm:get-global-dependency-tree', async (_, depth: number = 1) => {
    return await npmService.getGlobalDependencyTree(depth)
  })

  handleIpc('pip:list', async (_, options?: any) => {
    return await pipService.list(options)
  })

  handleIpc('pip:outdated', async (_, options?: any) => {
    return await pipService.outdated(options)
  })

  handleIpc('pip:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip install', () => pipService.install(args))
  })

  handleIpc('pip:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip uninstall', () => pipService.uninstall(args))
  })

  handleIpc('pip:update', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip update', () => pipService.update(args))
  })

  handleIpc('pip:update-all', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip update all', () => pipService.updateAll(args))
  })

  handleIpc('pip:freeze', async (_, cwd?: string) => {
    return await pipService.freeze(cwd)
  })

  handleIpc('pip:export-requirements', async (_, cwd: string) => {
    return await pipService.exportRequirements(cwd)
  })

  handleIpc('pip:read-requirements', async (_, cwd: string) => {
    return await pipService.readRequirements(cwd)
  })

  handleIpc('pip:search', async (_, query: string, cwd?: string) => {
    return await pipService.search(query, cwd)
  })

  handleIpc('pip:versions', async (_, packageName: string) => {
    return await pipService.versions(packageName)
  })

  handleIpc('pip:show', async (_, packageName: string, cwd?: string) => {
    return await pipService.show(packageName, cwd)
  })

  handleIpc('pip:check', async (_, cwd?: string) => {
    return await pipService.check(cwd)
  })

  handleIpc('pip:repair-check', async (_, cwd?: string) => {
    return await withProjectSnapshot(cwd, 'pip repair check', () => pipService.repairCheck(cwd))
  })

  handleIpc('pip:config-list', async (_, scope?: any) => {
    return await pipService.configList(scope)
  })

  handleIpc('pip:config-file', async (_, scope?: any) => {
    return await pipService.configFile(scope)
  })

  handleIpc('pip:backup-config', async (_, scope?: any) => {
    return await pipService.backupConfig(scope)
  })

  handleIpc('pip:config-set', async (_, scope: any, key: string, value: string) => {
    return await pipService.configSet(scope, key, value)
  })

  handleIpc('pip:config-unset', async (_, scope: any, key: string) => {
    return await pipService.configUnset(scope, key)
  })

  handleIpc('pip:cache-dir', async () => {
    return await pipService.cacheDir()
  })

  handleIpc('pip:cache-purge', async () => {
    return await pipService.cachePurge()
  })

  handleIpc('pip:audit', async (_, cwd?: string) => {
    return await pipService.audit(cwd)
  })

  handleIpc('pip:install-tool', async (_, tool: any, cwd?: string) => {
    return await pipService.installTool(tool, cwd)
  })

  handleIpc('pip:dependency-tree', async (_, cwd?: string) => {
    return await pipService.dependencyTree(cwd)
  })

  handleIpc('pip:publish', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'pip publish', args)
    const resolvedArgs = await pipPublishArgs(args)
    return await withProjectSnapshot(cwdFromArgs(args), 'pip publish', () => pipService.publish(resolvedArgs))
  })

  handleIpc('maven:detect', async (_, cwd: string) => {
    return await mavenService.detect(cwd)
  })

  handleIpc('maven:list', async (_, cwd: string) => {
    return await mavenService.list(cwd)
  })

  handleIpc('maven:tree', async (_, cwd: string) => {
    return await mavenService.tree(cwd)
  })

  handleIpc('maven:dependency-tree', async (_, cwd: string) => {
    return await mavenService.dependencyTree(cwd)
  })

  handleIpc('maven:run-goal', async (_, cwd: string, goal: string) => {
    return await withProjectSnapshot(cwd, `mvn ${goal}`, () => mavenService.runGoal(cwd, goal))
  })

  handleIpc('maven:search', async (_, query: string, cwd?: string, options?: any) => {
    return await mavenService.search(query, cwd, options)
  })

  handleIpc('maven:versions', async (_, groupId: string, artifactId: string) => {
    return await mavenService.versions(groupId, artifactId)
  })

  handleIpc('maven:info', async (_, cwd?: string) => {
    return await mavenService.info(cwd)
  })

  handleIpc('maven:effective-settings', async (_, cwd?: string) => {
    return await mavenService.effectiveSettings(cwd)
  })

  handleIpc('maven:ensure-settings', async () => {
    return await mavenService.ensureSettings()
  })

  handleIpc('maven:backup-settings', async () => {
    return await mavenService.backupSettings()
  })

  handleIpc('maven:set-local-repository', async (_, repositoryPath: string) => {
    return await mavenService.setLocalRepository(repositoryPath)
  })

  handleIpc('maven:set-mirror', async (_, id: string, url: string, mirrorOf?: string) => {
    return await mavenService.setMirror(id, url, mirrorOf)
  })

  handleIpc('maven:set-server', async (_, id: string, username: string, password: string) => {
    return await mavenService.setServer(id, username, password)
  })

  handleIpc('maven:set-secure-server', async (_, id: string, username: string, password: string) => {
    const names = mavenCredentialEnvNames(id)
    const credential = await credentialVaultService.save({
      managerId: 'maven',
      service: id,
      account: username,
      label: `Maven ${id}`,
      kind: 'username-password',
      secret: password
    })
    await mavenService.setServer(id, `\${env.${names.username}}`, `\${env.${names.password}}`)
    return credential
  })

  handleIpc('maven:deploy', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'maven deploy', args)
    const env = await mavenCredentialEnv(args?.repositoryId)
    return await withProjectSnapshot(cwdFromArgs(args), 'maven deploy', () => mavenService.deploy(args, env))
  })

  handleIpc('maven:security-audit', async (_, cwd: string) => {
    return await mavenService.securityAudit(cwd)
  })

  handleIpc('maven:go-offline', async (_, cwd: string) => {
    return await mavenService.goOffline(cwd)
  })

  handleIpc('maven:purge-local-repository', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'maven purge local repository', () => mavenService.purgeLocalRepository(cwd))
  })

  handleIpc('maven:add-dependency', async (_, cwd: string, dep) => {
    return await withProjectSnapshot(cwd, 'maven add dependency', () => mavenService.addDependency(cwd, dep))
  })

  handleIpc('maven:remove-dependency', async (_, cwd: string, dep) => {
    return await withProjectSnapshot(cwd, 'maven remove dependency', () => mavenService.removeDependency(cwd, dep))
  })

  handleIpc('plugins:catalog', async (_, projectPath?: string) => {
    return await pluginCatalogService.catalog(projectPath)
  })

  handleIpc('plugins:set-enabled', async (_, id, enabled: boolean, projectPath?: string) => {
    return await pluginCatalogService.setEnabled(id, enabled, projectPath)
  })

  handleIpc('plugins:detected', async (_, projectPath: string) => {
    return await pluginCatalogService.detected(projectPath)
  })

  handleIpc('cargo:detect', async (_, cwd: string) => {
    return await cargoService.detect(cwd)
  })

  handleIpc('cargo:list', async (_, cwd: string) => {
    return await cargoService.list(cwd)
  })

  handleIpc('cargo:search', async (_, query: string) => {
    return await cargoService.search(query)
  })

  handleIpc('cargo:versions', async (_, packageName: string) => {
    return await cargoService.versions(packageName)
  })

  handleIpc('cargo:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'cargo add', () => cargoService.install(args))
  })

  handleIpc('cargo:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'cargo remove', () => cargoService.uninstall(args))
  })

  handleIpc('cargo:update', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'cargo update', () => cargoService.update(args))
  })

  handleIpc('cargo:tree', async (_, cwd: string) => {
    return await cargoService.tree(cwd)
  })

  handleIpc('cargo:audit', async (_, cwd: string) => {
    return await cargoService.audit(cwd)
  })

  handleIpc('cargo:run', async (_, cwd: string, commandLine: string) => {
    return await withProjectSnapshot(cwd, `cargo ${commandLine}`, () => cargoService.run(cwd, commandLine))
  })

  handleIpc('gradle:detect', async (_, cwd: string) => {
    return await gradleService.detect(cwd)
  })

  handleIpc('gradle:list', async (_, cwd: string) => {
    return await gradleService.list(cwd)
  })

  handleIpc('gradle:search', async (_, query: string, options?: any) => {
    return await gradleService.search(query, options)
  })

  handleIpc('gradle:versions', async (_, groupId: string, artifactId: string) => {
    return await gradleService.versions(groupId, artifactId)
  })

  handleIpc('gradle:add-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'gradle add dependency', () => gradleService.addDependency(args))
  })

  handleIpc('gradle:update-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'gradle update dependency', () => gradleService.updateDependency(args))
  })

  handleIpc('gradle:remove-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'gradle remove dependency', () => gradleService.removeDependency(args))
  })

  handleIpc('gradle:run-task', async (_, cwd: string, taskLine: string) => {
    return await withProjectSnapshot(cwd, `gradle ${taskLine}`, () => gradleService.runTask(cwd, taskLine))
  })

  handleIpc('gradle:tasks', async (_, cwd: string) => {
    return await gradleService.tasks(cwd)
  })

  handleIpc('gradle:dependency-tree', async (_, cwd: string, configuration?: string) => {
    return await gradleService.dependencyTree(cwd, configuration)
  })

  handleIpc('gradle:dependency-insight', async (_, cwd: string, dependency: string, configuration?: string) => {
    return await gradleService.dependencyInsight(cwd, dependency, configuration)
  })

  handleIpc('go:detect', async (_, cwd: string) => {
    return await goService.detect(cwd)
  })

  handleIpc('go:list', async (_, cwd: string) => {
    return await goService.list(cwd)
  })

  handleIpc('go:search', async (_, query: string, cwd?: string) => {
    return await goService.search(query, cwd)
  })

  handleIpc('go:versions', async (_, modulePath: string, cwd?: string) => {
    return await goService.versions(modulePath, cwd)
  })

  handleIpc('go:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'go get/install', () => goService.install(args))
  })

  handleIpc('go:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'go remove', () => goService.uninstall(args))
  })

  handleIpc('go:update', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'go update', () => goService.update(args))
  })

  handleIpc('go:tidy', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'go mod tidy', () => goService.tidy(cwd))
  })

  handleIpc('go:graph', async (_, cwd: string) => {
    return await goService.graph(cwd)
  })

  handleIpc('go:audit', async (_, cwd: string) => {
    return await goService.audit(cwd)
  })

  handleIpc('go:run', async (_, cwd: string, commandLine: string) => {
    return await withProjectSnapshot(cwd, `go ${commandLine}`, () => goService.run(cwd, commandLine))
  })

  handleIpc('flutter:detect', async (_, cwd: string) => {
    return await flutterService.detect(cwd)
  })

  handleIpc('flutter:read', async (_, cwd: string) => {
    return await flutterService.read(cwd)
  })

  handleIpc('flutter:list', async (_, cwd: string) => {
    return await flutterService.list(cwd)
  })

  handleIpc('flutter:assets', async (_, cwd: string) => {
    return await flutterService.assets(cwd)
  })

  handleIpc('flutter:search', async (_, query: string) => {
    return await flutterService.search(query)
  })

  handleIpc('flutter:versions', async (_, packageName: string) => {
    return await flutterService.versions(packageName)
  })

  handleIpc('flutter:add-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub add', () => flutterService.addDependency(args))
  })

  handleIpc('flutter:update-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub upgrade', () => flutterService.update(args))
  })

  handleIpc('flutter:remove-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub remove', () => flutterService.removeDependency(args))
  })

  handleIpc('flutter:outdated', async (_, cwd: string) => {
    return await flutterService.outdated(cwd)
  })

  handleIpc('flutter:deps', async (_, cwd: string) => {
    return await flutterService.deps(cwd)
  })

  handleIpc('flutter:dependency-tree', async (_, cwd: string) => {
    return await flutterService.dependencyTree(cwd)
  })

  handleIpc('flutter:get', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'flutter pub get', () => flutterService.get(cwd))
  })

  handleIpc('flutter:run', async (_, cwd: string, commandLine: string) => {
    return await withProjectSnapshot(cwd, `flutter ${commandLine}`, () => flutterService.run(cwd, commandLine))
  })

  handleIpc('flutter:add-asset', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter add asset', () => flutterService.addAsset(args))
  })

  handleIpc('flutter:remove-asset', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter remove asset', () => flutterService.removeAsset(args))
  })

  handleIpc('flutter:check-publish', async (_, cwd: string) => {
    return await flutterService.checkPublish(cwd)
  })

  handleIpc('flutter:publish', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'flutter pub publish', args, { allowDryRun: true })
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub publish', () => flutterService.publish(args))
  })

  handleIpc('flutter:security-audit', async (_, cwd: string) => {
    return await flutterService.securityAudit(cwd)
  })

  handleIpc('native:detect', async (_, cwd: string) => {
    return await nativeService.detect(cwd)
  })

  handleIpc('native:list', async (_, cwd: string) => {
    return await nativeService.list(cwd)
  })

  handleIpc('native:search', async (_, query: string) => {
    return await nativeService.search(query)
  })

  handleIpc('native:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'native install', () => nativeService.install(args))
  })

  handleIpc('native:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'native uninstall', () => nativeService.uninstall(args))
  })

  handleIpc('native:run', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'native command', () => nativeService.run(args))
  })

  handleIpc('native:configure', async (_, cwd: string, buildDir?: string) => {
    return await withProjectSnapshot(cwd, 'native configure', () => nativeService.configure(cwd, buildDir))
  })

  handleIpc('native:build', async (_, cwd: string, buildDir?: string) => {
    return await withProjectSnapshot(cwd, 'native build', () => nativeService.build(cwd, buildDir))
  })

  handleIpc('manager:descriptors', () => {
    return managerWorkspaceService.descriptors()
  })

  handleIpc('manager:diagnostics', () => {
    return managerWorkspaceService.diagnostics()
  })

  handleIpc('manager:detected', async (_, cwd: string) => {
    return await managerWorkspaceService.detected(cwd)
  })

  handleIpc('manager:inventory', async (_, cwd: string, managerId: DependencyManagerId) => {
    return await managerWorkspaceService.inventory(cwd, managerId)
  })

  handleIpc('manager:plan', async (
    _,
    cwd: string,
    managerId: DependencyManagerId,
    request: ManagerOperationRequest
  ) => {
    return await managerWorkspaceService.plan(cwd, managerId, request)
  })

  handleIpc('manager:execute', async (
    _,
    cwd: string,
    managerId: DependencyManagerId,
    request: ManagerOperationRequest,
    options?: ManagerExecuteOptions
  ) => {
    // `dryRun` alone is not enough: list/tree/audit/outdated are read-only even
    // though the UI runs them with dryRun=false, and snapshotting each click
    // would fill the project with meaningless snapshot files.
    const kind = options?.dryRun || READ_ONLY_MANAGER_OPERATIONS.has(request.operation) ? 'read' : 'mutation'
    return await withProjectSnapshot(
      cwd,
      `${managerId} ${request.operation}`,
      () => managerWorkspaceService.execute(cwd, managerId, request, options),
      { operationId: options?.operationId, kind }
    )
  })

  handleIpc('manager:run-custom', async (
    _,
    cwd: string,
    managerId: DependencyManagerId,
    commandLine: string,
    options?: { operationId?: string }
  ) => {
    return await withProjectSnapshot(
      cwd,
      `${managerId} custom command`,
      () => managerWorkspaceService.runCustom(cwd, managerId, commandLine),
      { operationId: options?.operationId }
    )
  })

  handleIpc('manager:search', async (
    _,
    cwd: string | undefined,
    managerId: DependencyManagerId,
    query: ManagerSearchQuery
  ) => {
    return await managerWorkspaceService.search(cwd, managerId, query)
  })

  handleIpc('manager:health', async (_, cwd: string, managerId: DependencyManagerId) => {
    return await managerWorkspaceService.health(cwd, managerId)
  })

  handleIpc('manager:restore-backup', async (_, cwd: string, backupPath: string) => {
    return await withProjectMutation(cwd, () => managerWorkspaceService.restoreBackup(cwd, backupPath))
  })

  handleIpc('supply-chain:report', async (_, cwd: string) => {
    return await supplyChainService.report(cwd)
  })

  handleIpc('supply-chain:export-cyclonedx', async (_, cwd: string) => {
    return await supplyChainService.exportCycloneDx(cwd)
  })

  handleIpc('supply-chain:export-spdx', async (_, cwd: string) => {
    return await supplyChainService.exportSpdx(cwd)
  })

  handleIpc('supply-chain:export-markdown', async (_, cwd: string) => {
    return await supplyChainService.exportMarkdown(cwd)
  })

  handleIpc('supply-chain:license-report', async (_, cwd: string) => {
    return await supplyChainService.licenseReport(cwd)
  })

  handleIpc('supply-chain:export-license-markdown', async (_, cwd: string) => {
    return await supplyChainService.exportLicenseMarkdown(cwd)
  })

  handleIpc('supply-chain:export-license-json', async (_, cwd: string) => {
    return await supplyChainService.exportLicenseJson(cwd)
  })

  handleIpc('third-party-notices:report', async (_, cwd: string) => {
    return await thirdPartyNoticesService.report(cwd)
  })

  handleIpc('third-party-notices:export-text', async (_, cwd: string) => {
    return await thirdPartyNoticesService.exportText(cwd)
  })

  handleIpc('third-party-notices:export-markdown', async (_, cwd: string) => {
    return await thirdPartyNoticesService.exportMarkdown(cwd)
  })

  handleIpc('third-party-notices:export-json', async (_, cwd: string) => {
    return await thirdPartyNoticesService.exportJson(cwd)
  })

  handleIpc('supply-chain:create-snapshot', async (_, cwd: string) => {
    return await withProjectMutation(cwd, () => supplyChainService.createSnapshot(cwd))
  })

  handleIpc('supply-chain:list-snapshots', async (_, cwd: string) => {
    return await supplyChainService.listSnapshots(cwd)
  })

  handleIpc('supply-chain:diff-latest-snapshot', async (_, cwd: string) => {
    return await supplyChainService.diffLatestSnapshot(cwd)
  })

  handleIpc('supply-chain:dependency-diff-latest-snapshot', async (_, cwd: string) => {
    return await supplyChainService.dependencyDiffLatestSnapshot(cwd)
  })

  handleIpc('supply-chain:export-dependency-diff-markdown', async (_, cwd: string) => {
    return await supplyChainService.exportDependencyDiffMarkdown(cwd)
  })

  handleIpc('supply-chain:restore-latest-snapshot', async (_, cwd: string) => {
    return await withProjectMutation(cwd, () => supplyChainService.restoreLatestSnapshot(cwd))
  })

  handleIpc('supply-chain:restore-snapshot', async (_, cwd: string, snapshotIdOrPath: string) => {
    return await withProjectMutation(cwd, () => supplyChainService.restoreSnapshot(cwd, snapshotIdOrPath))
  })

  handleIpc('supply-chain:ensure-policy', async (_, cwd: string) => {
    return await supplyChainService.ensureDefaultPolicy(cwd)
  })

  handleIpc('supply-chain:get-policy', async (_, cwd: string) => {
    return await supplyChainService.getPolicy(cwd)
  })

  handleIpc('supply-chain:save-policy', async (_, cwd: string, policy: any) => {
    return await supplyChainService.savePolicy(cwd, policy)
  })

  handleIpc('supply-chain:evaluate-policy', async (_, cwd: string) => {
    return await supplyChainService.evaluatePolicy(cwd)
  })

  handleIpc('operation-history:list', async (_, cwd: string, limit?: number) => {
    return await listOperationHistory(cwd, limit)
  })

  handleIpc('operation-history:export', async (_, cwd: string, format?: 'json' | 'markdown') => {
    return await exportOperationHistory(cwd, format || 'markdown')
  })

  handleIpc('ci-evidence:list', async (_, cwd: string, limit?: number) => {
    return await ciEvidenceService.list(cwd, limit)
  })

  handleIpc('ci-evidence:record', async (_, cwd: string, input) => {
    return await ciEvidenceService.record(cwd, input)
  })

  handleIpc('ci-evidence:import-file', async (_, cwd: string, filePath: string, overrides) => {
    return await ciEvidenceService.importFromFile(cwd, filePath, overrides || {})
  })

  handleIpc('ci-evidence:export-markdown', async (_, cwd: string) => {
    return await ciEvidenceService.exportMarkdown(cwd)
  })

  handleIpc('ci-evidence:export-json', async (_, cwd: string) => {
    return await ciEvidenceService.exportJson(cwd)
  })

  handleIpc('audit-evidence:report', async (_, cwd: string) => {
    return await auditEvidenceService.report(cwd)
  })

  handleIpc('audit-evidence:import-file', async (_, cwd: string, filePath: string, options?: any) => {
    return await auditEvidenceService.importFromFile(cwd, filePath, options || {})
  })

  handleIpc('audit-evidence:export-markdown', async (_, cwd: string) => {
    return await auditEvidenceService.exportMarkdown(cwd)
  })

  handleIpc('audit-evidence:export-json', async (_, cwd: string) => {
    return await auditEvidenceService.exportJson(cwd)
  })

  handleIpc('audit-evidence:export-html', async (_, cwd: string) => {
    return await auditEvidenceService.exportHtml(cwd)
  })

  handleIpc('vulnerability-remediation-plan:plan', async (_, cwd: string) => {
    return await vulnerabilityRemediationPlanService.plan(cwd)
  })

  handleIpc('vulnerability-remediation-plan:export-markdown', async (_, cwd: string) => {
    return await vulnerabilityRemediationPlanService.exportMarkdown(cwd)
  })

  handleIpc('vulnerability-remediation-plan:export-json', async (_, cwd: string) => {
    return await vulnerabilityRemediationPlanService.exportJson(cwd)
  })

  handleIpc('release-approval:list', async (_, cwd: string, limit?: number) => {
    return await releaseApprovalService.list(cwd, limit)
  })

  handleIpc('release-approval:record', async (_, cwd: string, input) => {
    return await releaseApprovalService.record(cwd, input)
  })

  handleIpc('release-approval:export-markdown', async (_, cwd: string) => {
    return await releaseApprovalService.exportMarkdown(cwd)
  })

  handleIpc('release-approval:export-json', async (_, cwd: string) => {
    return await releaseApprovalService.exportJson(cwd)
  })

  handleIpc('release-exception:list', async (_, cwd: string, limit?: number) => {
    return await releaseExceptionService.list(cwd, limit)
  })

  handleIpc('release-exception:record', async (_, cwd: string, input) => {
    return await releaseExceptionService.record(cwd, input)
  })

  handleIpc('release-exception:revoke', async (_, cwd: string, id: string, input) => {
    return await releaseExceptionService.revoke(cwd, id, input || {})
  })

  handleIpc('release-exception:export-markdown', async (_, cwd: string) => {
    return await releaseExceptionService.exportMarkdown(cwd)
  })

  handleIpc('release-exception:export-json', async (_, cwd: string) => {
    return await releaseExceptionService.exportJson(cwd)
  })

  handleIpc('registry-reachability:discover', async (_, cwd: string) => {
    return await registryReachabilityService.discover(cwd)
  })

  handleIpc('registry-reachability:check', async (_, cwd: string, options) => {
    return await registryReachabilityService.check(cwd, options || {})
  })

  handleIpc('registry-reachability:export-markdown', async (_, cwd: string, options) => {
    return await registryReachabilityService.exportMarkdown(cwd, options || {})
  })

  handleIpc('registry-reachability:export-json', async (_, cwd: string, options) => {
    return await registryReachabilityService.exportJson(cwd, options || {})
  })

  handleIpc('credential-usage:report', async (_, cwd: string) => {
    return await credentialUsageService.report(cwd)
  })

  handleIpc('credential-usage:export-markdown', async (_, cwd: string) => {
    return await credentialUsageService.exportMarkdown(cwd)
  })

  handleIpc('credential-usage:export-json', async (_, cwd: string) => {
    return await credentialUsageService.exportJson(cwd)
  })

  handleIpc('lockfile-drift:report', async (_, cwd: string) => {
    return await lockfileDriftService.report(cwd)
  })

  handleIpc('lockfile-drift:export-markdown', async (_, cwd: string) => {
    return await lockfileDriftService.exportMarkdown(cwd)
  })

  handleIpc('lockfile-drift:export-json', async (_, cwd: string) => {
    return await lockfileDriftService.exportJson(cwd)
  })

  handleIpc('runtime-pinning:report', async (_, cwd: string) => {
    return await runtimePinningService.report(cwd)
  })

  handleIpc('runtime-pinning:export-markdown', async (_, cwd: string) => {
    return await runtimePinningService.exportMarkdown(cwd)
  })

  handleIpc('runtime-pinning:export-json', async (_, cwd: string) => {
    return await runtimePinningService.exportJson(cwd)
  })

  handleIpc('offline-cache-readiness:report', async (_, cwd: string) => {
    return await offlineCacheReadinessService.report(cwd)
  })

  handleIpc('offline-cache-readiness:export-markdown', async (_, cwd: string) => {
    return await offlineCacheReadinessService.exportMarkdown(cwd)
  })

  handleIpc('offline-cache-readiness:export-json', async (_, cwd: string) => {
    return await offlineCacheReadinessService.exportJson(cwd)
  })

  handleIpc('release-risk-profile:report', async (_, cwd: string) => {
    return await releaseRiskProfileService.report(cwd)
  })

  handleIpc('release-risk-profile:export-markdown', async (_, cwd: string) => {
    return await releaseRiskProfileService.exportMarkdown(cwd)
  })

  handleIpc('release-risk-profile:export-json', async (_, cwd: string) => {
    return await releaseRiskProfileService.exportJson(cwd)
  })

  handleIpc('ci-integration-plan:plan', async (_, cwd: string) => {
    return await ciIntegrationPlanService.plan(cwd)
  })

  handleIpc('ci-integration-plan:export-markdown', async (_, cwd: string) => {
    return await ciIntegrationPlanService.exportMarkdown(cwd)
  })

  handleIpc('ci-integration-plan:export-json', async (_, cwd: string) => {
    return await ciIntegrationPlanService.exportJson(cwd)
  })

  handleIpc('ci-integration-plan:export-github-actions', async (_, cwd: string) => {
    return await ciIntegrationPlanService.exportGithubActions(cwd)
  })

  handleIpc('dependency-automation-plan:plan', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.plan(cwd)
  })

  handleIpc('dependency-automation-plan:export-markdown', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportMarkdown(cwd)
  })

  handleIpc('dependency-automation-plan:export-json', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportJson(cwd)
  })

  handleIpc('dependency-automation-plan:export-dependabot', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportDependabot(cwd)
  })

  handleIpc('dependency-automation-plan:export-renovate', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportRenovate(cwd)
  })

  handleIpc('credential-rotation-plan:plan', async (_, cwd: string) => {
    return await credentialRotationPlanService.plan(cwd)
  })

  handleIpc('credential-rotation-plan:export-markdown', async (_, cwd: string) => {
    return await credentialRotationPlanService.exportMarkdown(cwd)
  })

  handleIpc('credential-rotation-plan:export-json', async (_, cwd: string) => {
    return await credentialRotationPlanService.exportJson(cwd)
  })

  handleIpc('automation-safety-plan:plan', async (_, cwd: string) => {
    return await automationSafetyPlanService.plan(cwd)
  })

  handleIpc('automation-safety-plan:export-markdown', async (_, cwd: string) => {
    return await automationSafetyPlanService.exportMarkdown(cwd)
  })

  handleIpc('automation-safety-plan:export-json', async (_, cwd: string) => {
    return await automationSafetyPlanService.exportJson(cwd)
  })

  handleIpc('dependency-ownership-plan:plan', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.plan(cwd)
  })

  handleIpc('dependency-ownership-plan:export-markdown', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.exportMarkdown(cwd)
  })

  handleIpc('dependency-ownership-plan:export-json', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.exportJson(cwd)
  })

  handleIpc('dependency-ownership-plan:export-codeowners', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.exportCodeowners(cwd)
  })

  handleIpc('dependency-upgrade-playbook:report', async (_, cwd: string) => {
    return await dependencyUpgradePlaybookService.report(cwd)
  })

  handleIpc('dependency-upgrade-playbook:export-markdown', async (_, cwd: string) => {
    return await dependencyUpgradePlaybookService.exportMarkdown(cwd)
  })

  handleIpc('dependency-upgrade-playbook:export-json', async (_, cwd: string) => {
    return await dependencyUpgradePlaybookService.exportJson(cwd)
  })

  handleIpc('dependency-rollback-plan:report', async (_, cwd: string) => {
    return await dependencyRollbackPlanService.report(cwd)
  })

  handleIpc('dependency-rollback-plan:export-markdown', async (_, cwd: string) => {
    return await dependencyRollbackPlanService.exportMarkdown(cwd)
  })

  handleIpc('dependency-rollback-plan:export-json', async (_, cwd: string) => {
    return await dependencyRollbackPlanService.exportJson(cwd)
  })

  handleIpc('dependency-impact-analysis:report', async (_, cwd: string) => {
    return await dependencyImpactAnalysisService.report(cwd)
  })

  handleIpc('dependency-impact-analysis:export-markdown', async (_, cwd: string) => {
    return await dependencyImpactAnalysisService.exportMarkdown(cwd)
  })

  handleIpc('dependency-impact-analysis:export-json', async (_, cwd: string) => {
    return await dependencyImpactAnalysisService.exportJson(cwd)
  })

  handleIpc('dependency-change-approval-packet:report', async (_, cwd: string) => {
    return await dependencyChangeApprovalPacketService.report(cwd)
  })

  handleIpc('dependency-change-approval-packet:export-markdown', async (_, cwd: string) => {
    return await dependencyChangeApprovalPacketService.exportMarkdown(cwd)
  })

  handleIpc('dependency-change-approval-packet:export-json', async (_, cwd: string) => {
    return await dependencyChangeApprovalPacketService.exportJson(cwd)
  })

  handleIpc('dependency-change-calendar:report', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.report(cwd)
  })

  handleIpc('dependency-change-calendar:export-markdown', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportMarkdown(cwd)
  })

  handleIpc('dependency-change-calendar:export-json', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportJson(cwd)
  })

  handleIpc('dependency-change-calendar:export-ics', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportIcs(cwd)
  })

  handleIpc('dependency-change-calendar:export-freeze-gate', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportFreezeGate(cwd)
  })

  handleIpc('dependency-change-calendar:export-ticket-template', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportTicketTemplate(cwd)
  })

  handleIpc('dependency-change-execution-record:report', async (_, cwd: string) => {
    return await dependencyChangeExecutionRecordService.report(cwd)
  })

  handleIpc('dependency-change-execution-record:export-markdown', async (_, cwd: string) => {
    return await dependencyChangeExecutionRecordService.exportMarkdown(cwd)
  })

  handleIpc('dependency-change-execution-record:export-json', async (_, cwd: string) => {
    return await dependencyChangeExecutionRecordService.exportJson(cwd)
  })

  handleIpc('policy-as-code-pack:report', async (_, cwd: string) => {
    return await policyAsCodePackService.report(cwd)
  })

  handleIpc('policy-as-code-pack:export-markdown', async (_, cwd: string) => {
    return await policyAsCodePackService.exportMarkdown(cwd)
  })

  handleIpc('policy-as-code-pack:export-json', async (_, cwd: string) => {
    return await policyAsCodePackService.exportJson(cwd)
  })

  handleIpc('policy-as-code-pack:export-policy-json', async (_, cwd: string) => {
    return await policyAsCodePackService.exportPolicyJson(cwd)
  })

  handleIpc('policy-as-code-pack:export-github-actions', async (_, cwd: string) => {
    return await policyAsCodePackService.exportGithubActions(cwd)
  })

  handleIpc('workspace-discovery:report', async (_, cwd: string) => {
    return await workspaceDiscoveryService.report(cwd)
  })

  handleIpc('workspace-discovery:export-markdown', async (_, cwd: string) => {
    return await workspaceDiscoveryService.exportMarkdown(cwd)
  })

  handleIpc('workspace-discovery:export-json', async (_, cwd: string) => {
    return await workspaceDiscoveryService.exportJson(cwd)
  })

  handleIpc('workspace-governance:report', async (_, cwd: string) => {
    return await workspaceGovernanceService.report(cwd)
  })

  handleIpc('workspace-governance:export-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportMarkdown(cwd)
  })

  handleIpc('workspace-governance:export-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportJson(cwd)
  })

  handleIpc('workspace-governance:export-evidence-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportEvidenceMarkdown(cwd)
  })

  handleIpc('workspace-governance:export-evidence-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportEvidenceJson(cwd)
  })

  handleIpc('workspace-governance:remediation-plan', async (_, cwd: string) => {
    return await workspaceGovernanceService.remediationPlan(cwd)
  })

  handleIpc('workspace-governance:export-remediation-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportRemediationMarkdown(cwd)
  })

  handleIpc('workspace-governance:export-remediation-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportRemediationJson(cwd)
  })

  handleIpc('workspace-governance:update-plan', async (_, cwd: string) => {
    return await workspaceGovernanceService.updatePlan(cwd)
  })

  handleIpc('workspace-governance:export-update-plan-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportUpdatePlanMarkdown(cwd)
  })

  handleIpc('workspace-governance:export-update-plan-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportUpdatePlanJson(cwd)
  })

  handleIpc('workspace-governance:export-workspace-sboms', async (_, cwd: string, format) => {
    return await workspaceGovernanceService.exportWorkspaceSboms(cwd, format)
  })

  handleIpc('workspace-governance:export-release-bundle', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportReleaseBundle(cwd)
  })

  handleIpc('workspace-governance:export-release-dashboard', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportReleaseDashboard(cwd)
  })

  handleIpc('dependency-health-dashboard:export-html', async (_, cwd: string) => {
    return await dependencyHealthDashboardService.exportHtml(cwd)
  })

  handleIpc('report-artifacts:report', async (_, cwd: string) => {
    return await reportArtifactIndexService.report(cwd)
  })

  handleIpc('report-artifacts:export-markdown', async (_, cwd: string) => {
    return await reportArtifactIndexService.exportMarkdown(cwd)
  })

  handleIpc('report-artifacts:export-json', async (_, cwd: string) => {
    return await reportArtifactIndexService.exportJson(cwd)
  })

  handleIpc('release-evidence-completeness:report', async (_, cwd: string) => {
    return await releaseEvidenceCompletenessService.report(cwd)
  })

  handleIpc('release-evidence-completeness:export-markdown', async (_, cwd: string) => {
    return await releaseEvidenceCompletenessService.exportMarkdown(cwd)
  })

  handleIpc('release-evidence-completeness:export-json', async (_, cwd: string) => {
    return await releaseEvidenceCompletenessService.exportJson(cwd)
  })

  handleIpc('release-provenance-attestation:report', async (_, cwd: string) => {
    return await releaseProvenanceAttestationService.report(cwd)
  })

  handleIpc('release-provenance-attestation:export-markdown', async (_, cwd: string) => {
    return await releaseProvenanceAttestationService.exportMarkdown(cwd)
  })

  handleIpc('release-provenance-attestation:export-json', async (_, cwd: string) => {
    return await releaseProvenanceAttestationService.exportJson(cwd)
  })

  handleIpc('release-integrity-verification:report', async (_, cwd: string) => {
    return await releaseIntegrityVerificationService.report(cwd)
  })

  handleIpc('release-integrity-verification:export-markdown', async (_, cwd: string) => {
    return await releaseIntegrityVerificationService.exportMarkdown(cwd)
  })

  handleIpc('release-integrity-verification:export-json', async (_, cwd: string) => {
    return await releaseIntegrityVerificationService.exportJson(cwd)
  })

  handleIpc('release-signature:report', async (_, cwd: string) => {
    return await releaseSignatureService.report(cwd)
  })

  handleIpc('release-signature:verify', async (_, cwd: string) => {
    return await releaseSignatureService.verify(cwd)
  })

  handleIpc('release-signature:export-markdown', async (_, cwd: string) => {
    return await releaseSignatureService.exportMarkdown(cwd)
  })

  handleIpc('release-signature:export-json', async (_, cwd: string) => {
    return await releaseSignatureService.exportJson(cwd)
  })

  handleIpc('release-trust-policy:report', async (_, cwd: string) => {
    return await releaseTrustPolicyService.report(cwd)
  })

  handleIpc('release-trust-policy:export-markdown', async (_, cwd: string) => {
    return await releaseTrustPolicyService.exportMarkdown(cwd)
  })

  handleIpc('release-trust-policy:export-json', async (_, cwd: string) => {
    return await releaseTrustPolicyService.exportJson(cwd)
  })

  handleIpc('framework-coverage:report', async (_, cwd?: string) => {
    return frameworkCoverageService.report(cwd)
  })

  handleIpc('framework-coverage:export-markdown', async (_, cwd: string) => {
    return await frameworkCoverageService.exportMarkdown(cwd)
  })

  handleIpc('framework-coverage:export-json', async (_, cwd: string) => {
    return await frameworkCoverageService.exportJson(cwd)
  })

  handleIpc('readiness:report', async (_, cwd: string) => {
    return await readinessGateService.report(cwd)
  })

  handleIpc('readiness:ensure-policy', async (_, cwd: string) => {
    return await readinessGateService.ensurePolicy(cwd)
  })

  handleIpc('readiness:get-policy', async (_, cwd: string) => {
    return await readinessGateService.getPolicy(cwd)
  })

  handleIpc('readiness:save-policy', async (_, cwd: string, policy) => {
    return await readinessGateService.savePolicy(cwd, policy)
  })

  handleIpc('readiness:export-markdown', async (_, cwd: string) => {
    return await readinessGateService.exportMarkdown(cwd)
  })

  handleIpc('readiness:export-json', async (_, cwd: string) => {
    return await readinessGateService.exportJson(cwd)
  })

  handleIpc('dependency-health:scan', async (_, manager, cwd: string) => {
    return await dependencyHealthService.scan(manager, cwd)
  })

  handleIpc('dependency-health:fix', async (_, cwd: string, action) => {
    // Only execute commands the scanner itself produced for this project: the
    // renderer-supplied object must never become a free-form command channel.
    const resolved = dependencyHealthService.resolveFixAction(cwd, action)
    const mutating = resolved.kind === 'api' || commandMutatesProjectFiles(resolved.command?.args || [])
    return await withProjectSnapshot(cwd, `dependency health fix: ${resolved.id}`, () => (
      dependencyHealthService.applyFix(cwd, resolved)
    ), { kind: mutating ? 'mutation' : 'read' })
  })

  handleIpc('terminal:create', async (_, cwd?: string) => {
    return terminalService.create(cwd)
  })

  handleIpc('terminal:write', async (_, id: string, data: string) => {
    return terminalService.write(id, data)
  })

  handleIpc('terminal:kill', async (_, id: string) => {
    return terminalService.kill(id)
  })
}

function setupApplicationMenu(language: AppLanguage) {
  const labels = menuLabels[language] || menuLabels['en-US']
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: labels.file,
      submenu: [
        { role: 'quit', label: labels.quit }
      ]
    },
    {
      label: labels.edit,
      submenu: [
        { role: 'undo', label: labels.undo },
        { role: 'redo', label: labels.redo },
        { type: 'separator' },
        { role: 'cut', label: labels.cut },
        { role: 'copy', label: labels.copy },
        { role: 'paste', label: labels.paste }
      ]
    },
    {
      label: labels.view,
      submenu: [
        { role: 'reload', label: labels.reload },
        { role: 'toggleDevTools', label: labels.devTools },
        { type: 'separator' },
        { role: 'resetZoom', label: labels.resetZoom },
        { role: 'zoomIn', label: labels.zoomIn },
        { role: 'zoomOut', label: labels.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: labels.fullscreen }
      ]
    },
    {
      label: labels.help,
      submenu: [
        {
          label: labels.about,
          click: async () => {
            const options = {
              type: 'info' as const,
              title: labels.aboutTitle,
              message: `DependencyHub Desktop v${app.getVersion()}`,
              detail: labels.aboutDetail
            }
            const target = mainWindow && !mainWindow.isDestroyed()
              ? mainWindow
              : BrowserWindow.getFocusedWindow()

            if (target) {
              await dialog.showMessageBox(target, options)
            } else {
              await dialog.showMessageBox(options)
            }
          }
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}


