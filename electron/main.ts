import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
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
import { TerminalService, setTerminalWindow } from './services/terminal'
import { checkTools, openToolDownload, setToolPath, clearToolPath, getProjectToolchainConfig, checkTool, TOOL_NAMES } from './services/toolchain'
import { fileWatcher } from './services/watcher'
import type { DependencyManagerId } from '../shared/managerRegistry'
import type {
  ManagerExecuteOptions,
  ManagerOperationRequest,
  ManagerSearchQuery
} from '../shared/managerWorkspace'

const mainDir = __dirname
type AppLanguage = 'zh-CN' | 'en-US'

if (process.platform === 'win32' && !process.env.ELECTRON_ENABLE_CHROMIUM_LOGGING) {
  app.commandLine.appendSwitch('log-level', '3')
}

interface StartupLanguageInfo {
  language: AppLanguage
  source: 'installer' | 'default'
  shouldPrompt: boolean
  isPackaged: boolean
  isPortable: boolean
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

async function withProjectSnapshot<T>(cwd: string | undefined, label: string, operation: () => Promise<T>): Promise<T> {
  await snapshotBeforeMutation(cwd, label)
  return await operation()
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
    setNpmServiceWindow(null as any)
    setTerminalWindow(null)
    terminalService.killAll()
  })
}

app.whenReady().then(() => {
  setupApplicationMenu(getStartupLanguageInfo().language)
  createWindow()
  setupIpcHandlers()
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
  ipcMain.handle('app:get-startup-language', async () => {
    return getStartupLanguageInfo()
  })

  ipcMain.handle('app:set-menu-language', async (_, language: AppLanguage) => {
    setupApplicationMenu(language)
  })

  ipcMain.handle('get-default-path', async () => {
    return app.getPath('home') || process.cwd()
  })

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    return result.filePaths[0] || null
  })

  ipcMain.handle('select-file', async (_, options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: options?.title,
      filters: options?.filters,
      properties: ['openFile']
    })
    return result.filePaths[0] || null
  })

  ipcMain.handle('npm:search', async (_, query: string, limit?: number) => {
    return await npmService.search(query, limit)
  })

  ipcMain.handle('npm:view', async (_, packageName: string) => {
    return await npmService.view(packageName)
  })

  ipcMain.handle('npm:smart-analyze', async (_, input) => {
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

  ipcMain.handle('npm:install', async (_, args) => {
    return await withProjectSnapshot(args?.global ? undefined : cwdFromArgs(args), 'npm install', () => npmService.install(args))
  })

  ipcMain.handle('npm:uninstall', async (_, args) => {
    return await withProjectSnapshot(args?.global ? undefined : cwdFromArgs(args), 'npm uninstall', () => npmService.uninstall(args))
  })

  ipcMain.handle('npm:update', async (_, args) => {
    return await withProjectSnapshot(args?.global ? undefined : cwdFromArgs(args), 'npm update', () => npmService.update(args))
  })

  ipcMain.handle('npm:outdated', async (_, cwd: string) => {
    return await npmService.outdated(cwd)
  })

  ipcMain.handle('npm:list', async (_, cwd: string, global: boolean) => {
    return await npmService.list(cwd, global)
  })

  ipcMain.handle('npm:config-list', async () => {
    return await npmService.configList()
  })

  ipcMain.handle('npm:config-set', async (_, key: string, value: string) => {
    return await npmService.configSet(key, value)
  })

  ipcMain.handle('npm:whoami', async () => {
    return await npmService.whoami()
  })

  ipcMain.handle('npm:login', async (_, registry?: string) => {
    return await npmService.login(registry)
  })

  ipcMain.handle('npm:logout', async (_, registry?: string) => {
    return await npmService.logout(registry)
  })

  ipcMain.handle('project:detect', async (_, projectPath: string) => {
    return await projectService.detectProject(projectPath)
  })

  ipcMain.handle('project:read-package', async (_, projectPath: string) => {
    return await projectService.readPackageJson(projectPath)
  })

  ipcMain.handle('project:inventory', async (_, projectPath: string) => {
    return await projectService.inventory(projectPath)
  })

  ipcMain.handle('project:export-inventory', async (_, projectPath: string) => {
    return await projectService.exportInventory(projectPath)
  })

  ipcMain.handle('project:toolchain-get', async (_, projectPath: string) => {
    return await getProjectToolchainConfig(projectPath)
  })

  ipcMain.handle('project:toolchain-set', async (_, projectPath: string, tool, toolPath: string) => {
    return await setToolPath(tool, toolPath, projectPath)
  })

  ipcMain.handle('project:toolchain-clear', async (_, projectPath: string, tool) => {
    return await clearToolPath(tool, projectPath)
  })

  ipcMain.handle('project:toolchain-check', async (_, projectPath: string) => {
    return await Promise.all(TOOL_NAMES.map((tool) => checkTool(tool, projectPath)))
  })

  ipcMain.handle('publish:check', async (_, projectPath: string) => {
    return await publishService.check(projectPath)
  })

  ipcMain.handle('publish:publish', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'npm publish', args)
    const env = await npmCredentialEnv(args)
    const publishArgs = { ...args, token: undefined }
    return await withProjectSnapshot(cwdFromArgs(args), 'npm publish', () => publishService.publish(publishArgs, { env }))
  })

  ipcMain.handle('credentials:status', async () => {
    return credentialVaultService.status()
  })

  ipcMain.handle('credentials:list', async (_, filter?: { managerId?: any; service?: string }) => {
    return await credentialVaultService.list(filter || {})
  })

  ipcMain.handle('credentials:save', async (_, input: CredentialInput) => {
    return await credentialVaultService.save(input)
  })

  ipcMain.handle('credentials:delete', async (_, id: string) => {
    return await credentialVaultService.delete(id)
  })

  ipcMain.handle('open-external', async (_, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('system:open-path', async (_, path: string) => {
    await shell.openPath(path)
  })

  ipcMain.handle('system:open-file', async (_, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle('system:get-npm-info', async () => {
    return await systemService.getNpmInfo()
  })

  ipcMain.handle('system:get-cache-path', async () => {
    return await systemService.getCachePath()
  })

  ipcMain.handle('system:set-cache-path', async (_, newPath: string) => {
    return await systemService.setCachePath(newPath)
  })

  ipcMain.handle('system:clear-cache', async () => {
    return await systemService.clearCache()
  })

  ipcMain.handle('system:update-npm', async () => {
    return await systemService.updateNpm()
  })

  ipcMain.handle('system:npm-help', async (_, command?: string) => {
    return await systemService.npmHelp(command)
  })

  ipcMain.handle('system:check-tools', async () => {
    return await checkTools()
  })

  ipcMain.handle('system:set-tool-path', async (_, tool, toolPath: string) => {
    await setToolPath(tool, toolPath)
    return await checkTools()
  })

  ipcMain.handle('system:open-tool-download', async (_, tool) => {
    return await openToolDownload(tool)
  })

  ipcMain.handle('npm:run-script', async (_, cwd: string, script: string) => {
    return await withProjectSnapshot(cwd, `npm run ${script}`, () => npmService.runScript(cwd, script))
  })

  ipcMain.handle('npm:get-scripts', async (_, cwd: string) => {
    return await npmService.getScripts(cwd)
  })

  ipcMain.handle('npm:config-get', async (_, key: string) => {
    return await npmService.configGet(key)
  })

  ipcMain.handle('npm:config-delete', async (_, key: string) => {
    return await npmService.configDelete(key)
  })

  ipcMain.handle('npm:config-edit', async () => {
    return await npmService.configEdit()
  })

  ipcMain.handle('npm:move-dep', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'npm move dependency', () => npmService.moveDependency(args))
  })

  ipcMain.handle('npm:get-published', async (_, username: string) => {
    return await npmService.getPublishedPackages(username)
  })

  ipcMain.handle('npm:check-all-outdated', async (_, cwd: string) => {
    return await npmService.checkAllOutdated(cwd)
  })

  ipcMain.handle('npm:open-terminal', async (_, cwd: string) => {
    return await systemService.openTerminal(cwd)
  })

  ipcMain.handle('project:write-package', async (_, projectPath: string, content: any) => {
    return await withProjectSnapshot(projectPath, 'write package.json', () => projectService.writePackageJson(projectPath, content))
  })

  ipcMain.handle('project:get-package-path', async (_, projectPath: string) => {
    return join(projectPath, 'package.json')
  })

  ipcMain.handle('project:get-node-modules-path', async (_, projectPath: string, packageName: string) => {
    return join(projectPath, 'node_modules', packageName)
  })

  ipcMain.handle('npm:info', async (_, packageName: string) => {
    return await npmService.getPackageInfo(packageName)
  })

  ipcMain.handle('npm:get-versions', async (_, packageName: string) => {
    return await npmService.getVersions(packageName)
  })

  ipcMain.handle('npm:get-version-metadata', async (_, packageName: string) => {
    return await npmService.getVersionMetadata(packageName)
  })

  ipcMain.handle('npm:install-version', async (_, args) => {
    return await withProjectSnapshot(args?.global ? undefined : cwdFromArgs(args), 'npm install version', () => npmService.installVersion(args))
  })

  ipcMain.handle('npm:global-outdated', async () => {
    return await npmService.globalOutdated()
  })

  ipcMain.handle('npm:adduser', async (_, registry?: string) => {
    return await npmService.adduser(registry)
  })

  ipcMain.handle('npm:get-registry-info', async (_, registry?: string) => {
    return await npmService.getRegistryInfo(registry)
  })

  ipcMain.handle('npm:get-package-size', async (_, packageName: string, version?: string) => {
    return await npmService.getPackageSize(packageName, version)
  })

  ipcMain.handle('npm:get-dependency-tree', async (_, packageName: string, version?: string, depth?: number) => {
    return await npmService.getDependencyTree(packageName, version, depth)
  })

  ipcMain.handle('npm:audit', async (_, cwd: string) => {
    return await npmService.audit(cwd)
  })

  ipcMain.handle('npm:global-audit', async () => {
    return await npmService.globalAudit()
  })

  ipcMain.handle('npm:audit-fix', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'npm audit fix', () => npmService.auditFix(cwd))
  })

  ipcMain.handle('npm:get-readme', async (_, packageName: string) => {
    return await npmService.getPackageReadme(packageName)
  })

  ipcMain.handle('npm:get-dependents', async (_, packageName: string) => {
    return await npmService.getDependents(packageName)
  })

  ipcMain.handle('npm:download-stats', async (_, packageName: string) => {
    return await npmService.downloadStats(packageName)
  })

  ipcMain.handle('watch:start', async (_, projectPath: string) => {
    fileWatcher.watchPackageJson(projectPath, () => {
      mainWindow?.webContents.send('file-change', { type: 'package.json', path: projectPath })
    })
  })

  ipcMain.handle('watch:stop', async (_, projectPath?: string) => {
    if (projectPath) {
      fileWatcher.unwatch(join(projectPath, 'package.json'))
    } else {
      fileWatcher.unwatchAll()
    }
  })

  ipcMain.handle('npm:get-project-dependency-tree', async (_, cwd: string, depth: number = 2) => {
    return await npmService.getProjectDependencyTree(cwd, depth)
  })

  ipcMain.handle('npm:get-global-dependency-tree', async (_, depth: number = 1) => {
    return await npmService.getGlobalDependencyTree(depth)
  })

  ipcMain.handle('pip:list', async (_, options?: any) => {
    return await pipService.list(options)
  })

  ipcMain.handle('pip:outdated', async (_, options?: any) => {
    return await pipService.outdated(options)
  })

  ipcMain.handle('pip:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip install', () => pipService.install(args))
  })

  ipcMain.handle('pip:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip uninstall', () => pipService.uninstall(args))
  })

  ipcMain.handle('pip:update', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip update', () => pipService.update(args))
  })

  ipcMain.handle('pip:update-all', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'pip update all', () => pipService.updateAll(args))
  })

  ipcMain.handle('pip:freeze', async (_, cwd?: string) => {
    return await pipService.freeze(cwd)
  })

  ipcMain.handle('pip:export-requirements', async (_, cwd: string) => {
    return await pipService.exportRequirements(cwd)
  })

  ipcMain.handle('pip:read-requirements', async (_, cwd: string) => {
    return await pipService.readRequirements(cwd)
  })

  ipcMain.handle('pip:search', async (_, query: string, cwd?: string) => {
    return await pipService.search(query, cwd)
  })

  ipcMain.handle('pip:versions', async (_, packageName: string) => {
    return await pipService.versions(packageName)
  })

  ipcMain.handle('pip:show', async (_, packageName: string, cwd?: string) => {
    return await pipService.show(packageName, cwd)
  })

  ipcMain.handle('pip:check', async (_, cwd?: string) => {
    return await pipService.check(cwd)
  })

  ipcMain.handle('pip:repair-check', async (_, cwd?: string) => {
    return await withProjectSnapshot(cwd, 'pip repair check', () => pipService.repairCheck(cwd))
  })

  ipcMain.handle('pip:config-list', async (_, scope?: any) => {
    return await pipService.configList(scope)
  })

  ipcMain.handle('pip:config-file', async (_, scope?: any) => {
    return await pipService.configFile(scope)
  })

  ipcMain.handle('pip:backup-config', async (_, scope?: any) => {
    return await pipService.backupConfig(scope)
  })

  ipcMain.handle('pip:config-set', async (_, scope: any, key: string, value: string) => {
    return await pipService.configSet(scope, key, value)
  })

  ipcMain.handle('pip:config-unset', async (_, scope: any, key: string) => {
    return await pipService.configUnset(scope, key)
  })

  ipcMain.handle('pip:cache-dir', async () => {
    return await pipService.cacheDir()
  })

  ipcMain.handle('pip:cache-purge', async () => {
    return await pipService.cachePurge()
  })

  ipcMain.handle('pip:audit', async (_, cwd?: string) => {
    return await pipService.audit(cwd)
  })

  ipcMain.handle('pip:install-tool', async (_, tool: any, cwd?: string) => {
    return await pipService.installTool(tool, cwd)
  })

  ipcMain.handle('pip:dependency-tree', async (_, cwd?: string) => {
    return await pipService.dependencyTree(cwd)
  })

  ipcMain.handle('pip:publish', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'pip publish', args)
    const resolvedArgs = await pipPublishArgs(args)
    return await withProjectSnapshot(cwdFromArgs(args), 'pip publish', () => pipService.publish(resolvedArgs))
  })

  ipcMain.handle('maven:detect', async (_, cwd: string) => {
    return await mavenService.detect(cwd)
  })

  ipcMain.handle('maven:list', async (_, cwd: string) => {
    return await mavenService.list(cwd)
  })

  ipcMain.handle('maven:tree', async (_, cwd: string) => {
    return await mavenService.tree(cwd)
  })

  ipcMain.handle('maven:dependency-tree', async (_, cwd: string) => {
    return await mavenService.dependencyTree(cwd)
  })

  ipcMain.handle('maven:run-goal', async (_, cwd: string, goal: string) => {
    return await withProjectSnapshot(cwd, `mvn ${goal}`, () => mavenService.runGoal(cwd, goal))
  })

  ipcMain.handle('maven:search', async (_, query: string, cwd?: string, options?: any) => {
    return await mavenService.search(query, cwd, options)
  })

  ipcMain.handle('maven:versions', async (_, groupId: string, artifactId: string) => {
    return await mavenService.versions(groupId, artifactId)
  })

  ipcMain.handle('maven:info', async (_, cwd?: string) => {
    return await mavenService.info(cwd)
  })

  ipcMain.handle('maven:effective-settings', async (_, cwd?: string) => {
    return await mavenService.effectiveSettings(cwd)
  })

  ipcMain.handle('maven:ensure-settings', async () => {
    return await mavenService.ensureSettings()
  })

  ipcMain.handle('maven:backup-settings', async () => {
    return await mavenService.backupSettings()
  })

  ipcMain.handle('maven:set-local-repository', async (_, repositoryPath: string) => {
    return await mavenService.setLocalRepository(repositoryPath)
  })

  ipcMain.handle('maven:set-mirror', async (_, id: string, url: string, mirrorOf?: string) => {
    return await mavenService.setMirror(id, url, mirrorOf)
  })

  ipcMain.handle('maven:set-server', async (_, id: string, username: string, password: string) => {
    return await mavenService.setServer(id, username, password)
  })

  ipcMain.handle('maven:set-secure-server', async (_, id: string, username: string, password: string) => {
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

  ipcMain.handle('maven:deploy', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'maven deploy', args)
    const env = await mavenCredentialEnv(args?.repositoryId)
    return await withProjectSnapshot(cwdFromArgs(args), 'maven deploy', () => mavenService.deploy(args, env))
  })

  ipcMain.handle('maven:security-audit', async (_, cwd: string) => {
    return await mavenService.securityAudit(cwd)
  })

  ipcMain.handle('maven:go-offline', async (_, cwd: string) => {
    return await mavenService.goOffline(cwd)
  })

  ipcMain.handle('maven:purge-local-repository', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'maven purge local repository', () => mavenService.purgeLocalRepository(cwd))
  })

  ipcMain.handle('maven:add-dependency', async (_, cwd: string, dep) => {
    return await withProjectSnapshot(cwd, 'maven add dependency', () => mavenService.addDependency(cwd, dep))
  })

  ipcMain.handle('maven:remove-dependency', async (_, cwd: string, dep) => {
    return await withProjectSnapshot(cwd, 'maven remove dependency', () => mavenService.removeDependency(cwd, dep))
  })

  ipcMain.handle('plugins:catalog', async (_, projectPath?: string) => {
    return await pluginCatalogService.catalog(projectPath)
  })

  ipcMain.handle('plugins:set-enabled', async (_, id, enabled: boolean, projectPath?: string) => {
    return await pluginCatalogService.setEnabled(id, enabled, projectPath)
  })

  ipcMain.handle('plugins:detected', async (_, projectPath: string) => {
    return await pluginCatalogService.detected(projectPath)
  })

  ipcMain.handle('cargo:detect', async (_, cwd: string) => {
    return await cargoService.detect(cwd)
  })

  ipcMain.handle('cargo:list', async (_, cwd: string) => {
    return await cargoService.list(cwd)
  })

  ipcMain.handle('cargo:search', async (_, query: string) => {
    return await cargoService.search(query)
  })

  ipcMain.handle('cargo:versions', async (_, packageName: string) => {
    return await cargoService.versions(packageName)
  })

  ipcMain.handle('cargo:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'cargo add', () => cargoService.install(args))
  })

  ipcMain.handle('cargo:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'cargo remove', () => cargoService.uninstall(args))
  })

  ipcMain.handle('cargo:update', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'cargo update', () => cargoService.update(args))
  })

  ipcMain.handle('cargo:tree', async (_, cwd: string) => {
    return await cargoService.tree(cwd)
  })

  ipcMain.handle('cargo:audit', async (_, cwd: string) => {
    return await cargoService.audit(cwd)
  })

  ipcMain.handle('cargo:run', async (_, cwd: string, commandLine: string) => {
    return await withProjectSnapshot(cwd, `cargo ${commandLine}`, () => cargoService.run(cwd, commandLine))
  })

  ipcMain.handle('gradle:detect', async (_, cwd: string) => {
    return await gradleService.detect(cwd)
  })

  ipcMain.handle('gradle:list', async (_, cwd: string) => {
    return await gradleService.list(cwd)
  })

  ipcMain.handle('gradle:search', async (_, query: string, options?: any) => {
    return await gradleService.search(query, options)
  })

  ipcMain.handle('gradle:versions', async (_, groupId: string, artifactId: string) => {
    return await gradleService.versions(groupId, artifactId)
  })

  ipcMain.handle('gradle:add-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'gradle add dependency', () => gradleService.addDependency(args))
  })

  ipcMain.handle('gradle:update-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'gradle update dependency', () => gradleService.updateDependency(args))
  })

  ipcMain.handle('gradle:remove-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'gradle remove dependency', () => gradleService.removeDependency(args))
  })

  ipcMain.handle('gradle:run-task', async (_, cwd: string, taskLine: string) => {
    return await withProjectSnapshot(cwd, `gradle ${taskLine}`, () => gradleService.runTask(cwd, taskLine))
  })

  ipcMain.handle('gradle:tasks', async (_, cwd: string) => {
    return await gradleService.tasks(cwd)
  })

  ipcMain.handle('gradle:dependency-tree', async (_, cwd: string, configuration?: string) => {
    return await gradleService.dependencyTree(cwd, configuration)
  })

  ipcMain.handle('gradle:dependency-insight', async (_, cwd: string, dependency: string, configuration?: string) => {
    return await gradleService.dependencyInsight(cwd, dependency, configuration)
  })

  ipcMain.handle('go:detect', async (_, cwd: string) => {
    return await goService.detect(cwd)
  })

  ipcMain.handle('go:list', async (_, cwd: string) => {
    return await goService.list(cwd)
  })

  ipcMain.handle('go:search', async (_, query: string, cwd?: string) => {
    return await goService.search(query, cwd)
  })

  ipcMain.handle('go:versions', async (_, modulePath: string, cwd?: string) => {
    return await goService.versions(modulePath, cwd)
  })

  ipcMain.handle('go:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'go get/install', () => goService.install(args))
  })

  ipcMain.handle('go:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'go remove', () => goService.uninstall(args))
  })

  ipcMain.handle('go:update', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'go update', () => goService.update(args))
  })

  ipcMain.handle('go:tidy', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'go mod tidy', () => goService.tidy(cwd))
  })

  ipcMain.handle('go:graph', async (_, cwd: string) => {
    return await goService.graph(cwd)
  })

  ipcMain.handle('go:audit', async (_, cwd: string) => {
    return await goService.audit(cwd)
  })

  ipcMain.handle('go:run', async (_, cwd: string, commandLine: string) => {
    return await withProjectSnapshot(cwd, `go ${commandLine}`, () => goService.run(cwd, commandLine))
  })

  ipcMain.handle('flutter:detect', async (_, cwd: string) => {
    return await flutterService.detect(cwd)
  })

  ipcMain.handle('flutter:read', async (_, cwd: string) => {
    return await flutterService.read(cwd)
  })

  ipcMain.handle('flutter:list', async (_, cwd: string) => {
    return await flutterService.list(cwd)
  })

  ipcMain.handle('flutter:assets', async (_, cwd: string) => {
    return await flutterService.assets(cwd)
  })

  ipcMain.handle('flutter:search', async (_, query: string) => {
    return await flutterService.search(query)
  })

  ipcMain.handle('flutter:versions', async (_, packageName: string) => {
    return await flutterService.versions(packageName)
  })

  ipcMain.handle('flutter:add-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub add', () => flutterService.addDependency(args))
  })

  ipcMain.handle('flutter:update-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub upgrade', () => flutterService.update(args))
  })

  ipcMain.handle('flutter:remove-dependency', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub remove', () => flutterService.removeDependency(args))
  })

  ipcMain.handle('flutter:outdated', async (_, cwd: string) => {
    return await flutterService.outdated(cwd)
  })

  ipcMain.handle('flutter:deps', async (_, cwd: string) => {
    return await flutterService.deps(cwd)
  })

  ipcMain.handle('flutter:dependency-tree', async (_, cwd: string) => {
    return await flutterService.dependencyTree(cwd)
  })

  ipcMain.handle('flutter:get', async (_, cwd: string) => {
    return await withProjectSnapshot(cwd, 'flutter pub get', () => flutterService.get(cwd))
  })

  ipcMain.handle('flutter:run', async (_, cwd: string, commandLine: string) => {
    return await withProjectSnapshot(cwd, `flutter ${commandLine}`, () => flutterService.run(cwd, commandLine))
  })

  ipcMain.handle('flutter:add-asset', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter add asset', () => flutterService.addAsset(args))
  })

  ipcMain.handle('flutter:remove-asset', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter remove asset', () => flutterService.removeAsset(args))
  })

  ipcMain.handle('flutter:check-publish', async (_, cwd: string) => {
    return await flutterService.checkPublish(cwd)
  })

  ipcMain.handle('flutter:publish', async (_, args) => {
    await enforcePublishReadinessGate(cwdFromArgs(args), 'flutter pub publish', args, { allowDryRun: true })
    return await withProjectSnapshot(cwdFromArgs(args), 'flutter pub publish', () => flutterService.publish(args))
  })

  ipcMain.handle('flutter:security-audit', async (_, cwd: string) => {
    return await flutterService.securityAudit(cwd)
  })

  ipcMain.handle('native:detect', async (_, cwd: string) => {
    return await nativeService.detect(cwd)
  })

  ipcMain.handle('native:list', async (_, cwd: string) => {
    return await nativeService.list(cwd)
  })

  ipcMain.handle('native:search', async (_, query: string) => {
    return await nativeService.search(query)
  })

  ipcMain.handle('native:install', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'native install', () => nativeService.install(args))
  })

  ipcMain.handle('native:uninstall', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'native uninstall', () => nativeService.uninstall(args))
  })

  ipcMain.handle('native:run', async (_, args) => {
    return await withProjectSnapshot(cwdFromArgs(args), 'native command', () => nativeService.run(args))
  })

  ipcMain.handle('native:configure', async (_, cwd: string, buildDir?: string) => {
    return await withProjectSnapshot(cwd, 'native configure', () => nativeService.configure(cwd, buildDir))
  })

  ipcMain.handle('native:build', async (_, cwd: string, buildDir?: string) => {
    return await withProjectSnapshot(cwd, 'native build', () => nativeService.build(cwd, buildDir))
  })

  ipcMain.handle('manager:descriptors', () => {
    return managerWorkspaceService.descriptors()
  })

  ipcMain.handle('manager:diagnostics', () => {
    return managerWorkspaceService.diagnostics()
  })

  ipcMain.handle('manager:detected', async (_, cwd: string) => {
    return await managerWorkspaceService.detected(cwd)
  })

  ipcMain.handle('manager:inventory', async (_, cwd: string, managerId: DependencyManagerId) => {
    return await managerWorkspaceService.inventory(cwd, managerId)
  })

  ipcMain.handle('manager:plan', async (
    _,
    cwd: string,
    managerId: DependencyManagerId,
    request: ManagerOperationRequest
  ) => {
    return await managerWorkspaceService.plan(cwd, managerId, request)
  })

  ipcMain.handle('manager:execute', async (
    _,
    cwd: string,
    managerId: DependencyManagerId,
    request: ManagerOperationRequest,
    options?: ManagerExecuteOptions
  ) => {
    const execute = () => managerWorkspaceService.execute(cwd, managerId, request, options)
    if (options?.dryRun) return await execute()
    return await withProjectSnapshot(cwd, `${managerId} ${request.operation}`, execute)
  })

  ipcMain.handle('manager:run-custom', async (
    _,
    cwd: string,
    managerId: DependencyManagerId,
    commandLine: string
  ) => {
    return await withProjectSnapshot(
      cwd,
      `${managerId} custom command`,
      () => managerWorkspaceService.runCustom(cwd, managerId, commandLine)
    )
  })

  ipcMain.handle('manager:search', async (
    _,
    cwd: string | undefined,
    managerId: DependencyManagerId,
    query: ManagerSearchQuery
  ) => {
    return await managerWorkspaceService.search(cwd, managerId, query)
  })

  ipcMain.handle('manager:health', async (_, cwd: string, managerId: DependencyManagerId) => {
    return await managerWorkspaceService.health(cwd, managerId)
  })

  ipcMain.handle('manager:restore-backup', async (_, cwd: string, backupPath: string) => {
    return await managerWorkspaceService.restoreBackup(cwd, backupPath)
  })

  ipcMain.handle('supply-chain:report', async (_, cwd: string) => {
    return await supplyChainService.report(cwd)
  })

  ipcMain.handle('supply-chain:export-cyclonedx', async (_, cwd: string) => {
    return await supplyChainService.exportCycloneDx(cwd)
  })

  ipcMain.handle('supply-chain:export-spdx', async (_, cwd: string) => {
    return await supplyChainService.exportSpdx(cwd)
  })

  ipcMain.handle('supply-chain:export-markdown', async (_, cwd: string) => {
    return await supplyChainService.exportMarkdown(cwd)
  })

  ipcMain.handle('supply-chain:license-report', async (_, cwd: string) => {
    return await supplyChainService.licenseReport(cwd)
  })

  ipcMain.handle('supply-chain:export-license-markdown', async (_, cwd: string) => {
    return await supplyChainService.exportLicenseMarkdown(cwd)
  })

  ipcMain.handle('supply-chain:export-license-json', async (_, cwd: string) => {
    return await supplyChainService.exportLicenseJson(cwd)
  })

  ipcMain.handle('third-party-notices:report', async (_, cwd: string) => {
    return await thirdPartyNoticesService.report(cwd)
  })

  ipcMain.handle('third-party-notices:export-text', async (_, cwd: string) => {
    return await thirdPartyNoticesService.exportText(cwd)
  })

  ipcMain.handle('third-party-notices:export-markdown', async (_, cwd: string) => {
    return await thirdPartyNoticesService.exportMarkdown(cwd)
  })

  ipcMain.handle('third-party-notices:export-json', async (_, cwd: string) => {
    return await thirdPartyNoticesService.exportJson(cwd)
  })

  ipcMain.handle('supply-chain:create-snapshot', async (_, cwd: string) => {
    return await supplyChainService.createSnapshot(cwd)
  })

  ipcMain.handle('supply-chain:list-snapshots', async (_, cwd: string) => {
    return await supplyChainService.listSnapshots(cwd)
  })

  ipcMain.handle('supply-chain:diff-latest-snapshot', async (_, cwd: string) => {
    return await supplyChainService.diffLatestSnapshot(cwd)
  })

  ipcMain.handle('supply-chain:dependency-diff-latest-snapshot', async (_, cwd: string) => {
    return await supplyChainService.dependencyDiffLatestSnapshot(cwd)
  })

  ipcMain.handle('supply-chain:export-dependency-diff-markdown', async (_, cwd: string) => {
    return await supplyChainService.exportDependencyDiffMarkdown(cwd)
  })

  ipcMain.handle('supply-chain:restore-latest-snapshot', async (_, cwd: string) => {
    return await supplyChainService.restoreLatestSnapshot(cwd)
  })

  ipcMain.handle('supply-chain:restore-snapshot', async (_, cwd: string, snapshotIdOrPath: string) => {
    return await supplyChainService.restoreSnapshot(cwd, snapshotIdOrPath)
  })

  ipcMain.handle('supply-chain:ensure-policy', async (_, cwd: string) => {
    return await supplyChainService.ensureDefaultPolicy(cwd)
  })

  ipcMain.handle('supply-chain:get-policy', async (_, cwd: string) => {
    return await supplyChainService.getPolicy(cwd)
  })

  ipcMain.handle('supply-chain:save-policy', async (_, cwd: string, policy: any) => {
    return await supplyChainService.savePolicy(cwd, policy)
  })

  ipcMain.handle('supply-chain:evaluate-policy', async (_, cwd: string) => {
    return await supplyChainService.evaluatePolicy(cwd)
  })

  ipcMain.handle('operation-history:list', async (_, cwd: string, limit?: number) => {
    return await listOperationHistory(cwd, limit)
  })

  ipcMain.handle('operation-history:export', async (_, cwd: string, format?: 'json' | 'markdown') => {
    return await exportOperationHistory(cwd, format || 'markdown')
  })

  ipcMain.handle('ci-evidence:list', async (_, cwd: string, limit?: number) => {
    return await ciEvidenceService.list(cwd, limit)
  })

  ipcMain.handle('ci-evidence:record', async (_, cwd: string, input) => {
    return await ciEvidenceService.record(cwd, input)
  })

  ipcMain.handle('ci-evidence:import-file', async (_, cwd: string, filePath: string, overrides) => {
    return await ciEvidenceService.importFromFile(cwd, filePath, overrides || {})
  })

  ipcMain.handle('ci-evidence:export-markdown', async (_, cwd: string) => {
    return await ciEvidenceService.exportMarkdown(cwd)
  })

  ipcMain.handle('ci-evidence:export-json', async (_, cwd: string) => {
    return await ciEvidenceService.exportJson(cwd)
  })

  ipcMain.handle('audit-evidence:report', async (_, cwd: string) => {
    return await auditEvidenceService.report(cwd)
  })

  ipcMain.handle('audit-evidence:import-file', async (_, cwd: string, filePath: string, options?: any) => {
    return await auditEvidenceService.importFromFile(cwd, filePath, options || {})
  })

  ipcMain.handle('audit-evidence:export-markdown', async (_, cwd: string) => {
    return await auditEvidenceService.exportMarkdown(cwd)
  })

  ipcMain.handle('audit-evidence:export-json', async (_, cwd: string) => {
    return await auditEvidenceService.exportJson(cwd)
  })

  ipcMain.handle('audit-evidence:export-html', async (_, cwd: string) => {
    return await auditEvidenceService.exportHtml(cwd)
  })

  ipcMain.handle('vulnerability-remediation-plan:plan', async (_, cwd: string) => {
    return await vulnerabilityRemediationPlanService.plan(cwd)
  })

  ipcMain.handle('vulnerability-remediation-plan:export-markdown', async (_, cwd: string) => {
    return await vulnerabilityRemediationPlanService.exportMarkdown(cwd)
  })

  ipcMain.handle('vulnerability-remediation-plan:export-json', async (_, cwd: string) => {
    return await vulnerabilityRemediationPlanService.exportJson(cwd)
  })

  ipcMain.handle('release-approval:list', async (_, cwd: string, limit?: number) => {
    return await releaseApprovalService.list(cwd, limit)
  })

  ipcMain.handle('release-approval:record', async (_, cwd: string, input) => {
    return await releaseApprovalService.record(cwd, input)
  })

  ipcMain.handle('release-approval:export-markdown', async (_, cwd: string) => {
    return await releaseApprovalService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-approval:export-json', async (_, cwd: string) => {
    return await releaseApprovalService.exportJson(cwd)
  })

  ipcMain.handle('release-exception:list', async (_, cwd: string, limit?: number) => {
    return await releaseExceptionService.list(cwd, limit)
  })

  ipcMain.handle('release-exception:record', async (_, cwd: string, input) => {
    return await releaseExceptionService.record(cwd, input)
  })

  ipcMain.handle('release-exception:revoke', async (_, cwd: string, id: string, input) => {
    return await releaseExceptionService.revoke(cwd, id, input || {})
  })

  ipcMain.handle('release-exception:export-markdown', async (_, cwd: string) => {
    return await releaseExceptionService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-exception:export-json', async (_, cwd: string) => {
    return await releaseExceptionService.exportJson(cwd)
  })

  ipcMain.handle('registry-reachability:discover', async (_, cwd: string) => {
    return await registryReachabilityService.discover(cwd)
  })

  ipcMain.handle('registry-reachability:check', async (_, cwd: string, options) => {
    return await registryReachabilityService.check(cwd, options || {})
  })

  ipcMain.handle('registry-reachability:export-markdown', async (_, cwd: string, options) => {
    return await registryReachabilityService.exportMarkdown(cwd, options || {})
  })

  ipcMain.handle('registry-reachability:export-json', async (_, cwd: string, options) => {
    return await registryReachabilityService.exportJson(cwd, options || {})
  })

  ipcMain.handle('credential-usage:report', async (_, cwd: string) => {
    return await credentialUsageService.report(cwd)
  })

  ipcMain.handle('credential-usage:export-markdown', async (_, cwd: string) => {
    return await credentialUsageService.exportMarkdown(cwd)
  })

  ipcMain.handle('credential-usage:export-json', async (_, cwd: string) => {
    return await credentialUsageService.exportJson(cwd)
  })

  ipcMain.handle('lockfile-drift:report', async (_, cwd: string) => {
    return await lockfileDriftService.report(cwd)
  })

  ipcMain.handle('lockfile-drift:export-markdown', async (_, cwd: string) => {
    return await lockfileDriftService.exportMarkdown(cwd)
  })

  ipcMain.handle('lockfile-drift:export-json', async (_, cwd: string) => {
    return await lockfileDriftService.exportJson(cwd)
  })

  ipcMain.handle('runtime-pinning:report', async (_, cwd: string) => {
    return await runtimePinningService.report(cwd)
  })

  ipcMain.handle('runtime-pinning:export-markdown', async (_, cwd: string) => {
    return await runtimePinningService.exportMarkdown(cwd)
  })

  ipcMain.handle('runtime-pinning:export-json', async (_, cwd: string) => {
    return await runtimePinningService.exportJson(cwd)
  })

  ipcMain.handle('offline-cache-readiness:report', async (_, cwd: string) => {
    return await offlineCacheReadinessService.report(cwd)
  })

  ipcMain.handle('offline-cache-readiness:export-markdown', async (_, cwd: string) => {
    return await offlineCacheReadinessService.exportMarkdown(cwd)
  })

  ipcMain.handle('offline-cache-readiness:export-json', async (_, cwd: string) => {
    return await offlineCacheReadinessService.exportJson(cwd)
  })

  ipcMain.handle('release-risk-profile:report', async (_, cwd: string) => {
    return await releaseRiskProfileService.report(cwd)
  })

  ipcMain.handle('release-risk-profile:export-markdown', async (_, cwd: string) => {
    return await releaseRiskProfileService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-risk-profile:export-json', async (_, cwd: string) => {
    return await releaseRiskProfileService.exportJson(cwd)
  })

  ipcMain.handle('ci-integration-plan:plan', async (_, cwd: string) => {
    return await ciIntegrationPlanService.plan(cwd)
  })

  ipcMain.handle('ci-integration-plan:export-markdown', async (_, cwd: string) => {
    return await ciIntegrationPlanService.exportMarkdown(cwd)
  })

  ipcMain.handle('ci-integration-plan:export-json', async (_, cwd: string) => {
    return await ciIntegrationPlanService.exportJson(cwd)
  })

  ipcMain.handle('ci-integration-plan:export-github-actions', async (_, cwd: string) => {
    return await ciIntegrationPlanService.exportGithubActions(cwd)
  })

  ipcMain.handle('dependency-automation-plan:plan', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.plan(cwd)
  })

  ipcMain.handle('dependency-automation-plan:export-markdown', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-automation-plan:export-json', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportJson(cwd)
  })

  ipcMain.handle('dependency-automation-plan:export-dependabot', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportDependabot(cwd)
  })

  ipcMain.handle('dependency-automation-plan:export-renovate', async (_, cwd: string) => {
    return await dependencyAutomationPlanService.exportRenovate(cwd)
  })

  ipcMain.handle('credential-rotation-plan:plan', async (_, cwd: string) => {
    return await credentialRotationPlanService.plan(cwd)
  })

  ipcMain.handle('credential-rotation-plan:export-markdown', async (_, cwd: string) => {
    return await credentialRotationPlanService.exportMarkdown(cwd)
  })

  ipcMain.handle('credential-rotation-plan:export-json', async (_, cwd: string) => {
    return await credentialRotationPlanService.exportJson(cwd)
  })

  ipcMain.handle('automation-safety-plan:plan', async (_, cwd: string) => {
    return await automationSafetyPlanService.plan(cwd)
  })

  ipcMain.handle('automation-safety-plan:export-markdown', async (_, cwd: string) => {
    return await automationSafetyPlanService.exportMarkdown(cwd)
  })

  ipcMain.handle('automation-safety-plan:export-json', async (_, cwd: string) => {
    return await automationSafetyPlanService.exportJson(cwd)
  })

  ipcMain.handle('dependency-ownership-plan:plan', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.plan(cwd)
  })

  ipcMain.handle('dependency-ownership-plan:export-markdown', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-ownership-plan:export-json', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.exportJson(cwd)
  })

  ipcMain.handle('dependency-ownership-plan:export-codeowners', async (_, cwd: string) => {
    return await dependencyOwnershipPlanService.exportCodeowners(cwd)
  })

  ipcMain.handle('dependency-upgrade-playbook:report', async (_, cwd: string) => {
    return await dependencyUpgradePlaybookService.report(cwd)
  })

  ipcMain.handle('dependency-upgrade-playbook:export-markdown', async (_, cwd: string) => {
    return await dependencyUpgradePlaybookService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-upgrade-playbook:export-json', async (_, cwd: string) => {
    return await dependencyUpgradePlaybookService.exportJson(cwd)
  })

  ipcMain.handle('dependency-rollback-plan:report', async (_, cwd: string) => {
    return await dependencyRollbackPlanService.report(cwd)
  })

  ipcMain.handle('dependency-rollback-plan:export-markdown', async (_, cwd: string) => {
    return await dependencyRollbackPlanService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-rollback-plan:export-json', async (_, cwd: string) => {
    return await dependencyRollbackPlanService.exportJson(cwd)
  })

  ipcMain.handle('dependency-impact-analysis:report', async (_, cwd: string) => {
    return await dependencyImpactAnalysisService.report(cwd)
  })

  ipcMain.handle('dependency-impact-analysis:export-markdown', async (_, cwd: string) => {
    return await dependencyImpactAnalysisService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-impact-analysis:export-json', async (_, cwd: string) => {
    return await dependencyImpactAnalysisService.exportJson(cwd)
  })

  ipcMain.handle('dependency-change-approval-packet:report', async (_, cwd: string) => {
    return await dependencyChangeApprovalPacketService.report(cwd)
  })

  ipcMain.handle('dependency-change-approval-packet:export-markdown', async (_, cwd: string) => {
    return await dependencyChangeApprovalPacketService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-change-approval-packet:export-json', async (_, cwd: string) => {
    return await dependencyChangeApprovalPacketService.exportJson(cwd)
  })

  ipcMain.handle('dependency-change-calendar:report', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.report(cwd)
  })

  ipcMain.handle('dependency-change-calendar:export-markdown', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-change-calendar:export-json', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportJson(cwd)
  })

  ipcMain.handle('dependency-change-calendar:export-ics', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportIcs(cwd)
  })

  ipcMain.handle('dependency-change-calendar:export-freeze-gate', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportFreezeGate(cwd)
  })

  ipcMain.handle('dependency-change-calendar:export-ticket-template', async (_, cwd: string) => {
    return await dependencyChangeCalendarService.exportTicketTemplate(cwd)
  })

  ipcMain.handle('dependency-change-execution-record:report', async (_, cwd: string) => {
    return await dependencyChangeExecutionRecordService.report(cwd)
  })

  ipcMain.handle('dependency-change-execution-record:export-markdown', async (_, cwd: string) => {
    return await dependencyChangeExecutionRecordService.exportMarkdown(cwd)
  })

  ipcMain.handle('dependency-change-execution-record:export-json', async (_, cwd: string) => {
    return await dependencyChangeExecutionRecordService.exportJson(cwd)
  })

  ipcMain.handle('policy-as-code-pack:report', async (_, cwd: string) => {
    return await policyAsCodePackService.report(cwd)
  })

  ipcMain.handle('policy-as-code-pack:export-markdown', async (_, cwd: string) => {
    return await policyAsCodePackService.exportMarkdown(cwd)
  })

  ipcMain.handle('policy-as-code-pack:export-json', async (_, cwd: string) => {
    return await policyAsCodePackService.exportJson(cwd)
  })

  ipcMain.handle('policy-as-code-pack:export-policy-json', async (_, cwd: string) => {
    return await policyAsCodePackService.exportPolicyJson(cwd)
  })

  ipcMain.handle('policy-as-code-pack:export-github-actions', async (_, cwd: string) => {
    return await policyAsCodePackService.exportGithubActions(cwd)
  })

  ipcMain.handle('workspace-discovery:report', async (_, cwd: string) => {
    return await workspaceDiscoveryService.report(cwd)
  })

  ipcMain.handle('workspace-discovery:export-markdown', async (_, cwd: string) => {
    return await workspaceDiscoveryService.exportMarkdown(cwd)
  })

  ipcMain.handle('workspace-discovery:export-json', async (_, cwd: string) => {
    return await workspaceDiscoveryService.exportJson(cwd)
  })

  ipcMain.handle('workspace-governance:report', async (_, cwd: string) => {
    return await workspaceGovernanceService.report(cwd)
  })

  ipcMain.handle('workspace-governance:export-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportMarkdown(cwd)
  })

  ipcMain.handle('workspace-governance:export-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportJson(cwd)
  })

  ipcMain.handle('workspace-governance:export-evidence-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportEvidenceMarkdown(cwd)
  })

  ipcMain.handle('workspace-governance:export-evidence-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportEvidenceJson(cwd)
  })

  ipcMain.handle('workspace-governance:remediation-plan', async (_, cwd: string) => {
    return await workspaceGovernanceService.remediationPlan(cwd)
  })

  ipcMain.handle('workspace-governance:export-remediation-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportRemediationMarkdown(cwd)
  })

  ipcMain.handle('workspace-governance:export-remediation-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportRemediationJson(cwd)
  })

  ipcMain.handle('workspace-governance:update-plan', async (_, cwd: string) => {
    return await workspaceGovernanceService.updatePlan(cwd)
  })

  ipcMain.handle('workspace-governance:export-update-plan-markdown', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportUpdatePlanMarkdown(cwd)
  })

  ipcMain.handle('workspace-governance:export-update-plan-json', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportUpdatePlanJson(cwd)
  })

  ipcMain.handle('workspace-governance:export-workspace-sboms', async (_, cwd: string, format) => {
    return await workspaceGovernanceService.exportWorkspaceSboms(cwd, format)
  })

  ipcMain.handle('workspace-governance:export-release-bundle', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportReleaseBundle(cwd)
  })

  ipcMain.handle('workspace-governance:export-release-dashboard', async (_, cwd: string) => {
    return await workspaceGovernanceService.exportReleaseDashboard(cwd)
  })

  ipcMain.handle('dependency-health-dashboard:export-html', async (_, cwd: string) => {
    return await dependencyHealthDashboardService.exportHtml(cwd)
  })

  ipcMain.handle('report-artifacts:report', async (_, cwd: string) => {
    return await reportArtifactIndexService.report(cwd)
  })

  ipcMain.handle('report-artifacts:export-markdown', async (_, cwd: string) => {
    return await reportArtifactIndexService.exportMarkdown(cwd)
  })

  ipcMain.handle('report-artifacts:export-json', async (_, cwd: string) => {
    return await reportArtifactIndexService.exportJson(cwd)
  })

  ipcMain.handle('release-evidence-completeness:report', async (_, cwd: string) => {
    return await releaseEvidenceCompletenessService.report(cwd)
  })

  ipcMain.handle('release-evidence-completeness:export-markdown', async (_, cwd: string) => {
    return await releaseEvidenceCompletenessService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-evidence-completeness:export-json', async (_, cwd: string) => {
    return await releaseEvidenceCompletenessService.exportJson(cwd)
  })

  ipcMain.handle('release-provenance-attestation:report', async (_, cwd: string) => {
    return await releaseProvenanceAttestationService.report(cwd)
  })

  ipcMain.handle('release-provenance-attestation:export-markdown', async (_, cwd: string) => {
    return await releaseProvenanceAttestationService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-provenance-attestation:export-json', async (_, cwd: string) => {
    return await releaseProvenanceAttestationService.exportJson(cwd)
  })

  ipcMain.handle('release-integrity-verification:report', async (_, cwd: string) => {
    return await releaseIntegrityVerificationService.report(cwd)
  })

  ipcMain.handle('release-integrity-verification:export-markdown', async (_, cwd: string) => {
    return await releaseIntegrityVerificationService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-integrity-verification:export-json', async (_, cwd: string) => {
    return await releaseIntegrityVerificationService.exportJson(cwd)
  })

  ipcMain.handle('release-signature:report', async (_, cwd: string) => {
    return await releaseSignatureService.report(cwd)
  })

  ipcMain.handle('release-signature:verify', async (_, cwd: string) => {
    return await releaseSignatureService.verify(cwd)
  })

  ipcMain.handle('release-signature:export-markdown', async (_, cwd: string) => {
    return await releaseSignatureService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-signature:export-json', async (_, cwd: string) => {
    return await releaseSignatureService.exportJson(cwd)
  })

  ipcMain.handle('release-trust-policy:report', async (_, cwd: string) => {
    return await releaseTrustPolicyService.report(cwd)
  })

  ipcMain.handle('release-trust-policy:export-markdown', async (_, cwd: string) => {
    return await releaseTrustPolicyService.exportMarkdown(cwd)
  })

  ipcMain.handle('release-trust-policy:export-json', async (_, cwd: string) => {
    return await releaseTrustPolicyService.exportJson(cwd)
  })

  ipcMain.handle('framework-coverage:report', async (_, cwd?: string) => {
    return frameworkCoverageService.report(cwd)
  })

  ipcMain.handle('framework-coverage:export-markdown', async (_, cwd: string) => {
    return await frameworkCoverageService.exportMarkdown(cwd)
  })

  ipcMain.handle('framework-coverage:export-json', async (_, cwd: string) => {
    return await frameworkCoverageService.exportJson(cwd)
  })

  ipcMain.handle('readiness:report', async (_, cwd: string) => {
    return await readinessGateService.report(cwd)
  })

  ipcMain.handle('readiness:ensure-policy', async (_, cwd: string) => {
    return await readinessGateService.ensurePolicy(cwd)
  })

  ipcMain.handle('readiness:get-policy', async (_, cwd: string) => {
    return await readinessGateService.getPolicy(cwd)
  })

  ipcMain.handle('readiness:save-policy', async (_, cwd: string, policy) => {
    return await readinessGateService.savePolicy(cwd, policy)
  })

  ipcMain.handle('readiness:export-markdown', async (_, cwd: string) => {
    return await readinessGateService.exportMarkdown(cwd)
  })

  ipcMain.handle('readiness:export-json', async (_, cwd: string) => {
    return await readinessGateService.exportJson(cwd)
  })

  ipcMain.handle('dependency-health:scan', async (_, manager, cwd: string) => {
    return await dependencyHealthService.scan(manager, cwd)
  })

  ipcMain.handle('dependency-health:fix', async (_, cwd: string, action) => {
    return await dependencyHealthService.applyFix(cwd, action)
  })

  ipcMain.handle('terminal:create', async (_, cwd?: string) => {
    return terminalService.create(cwd)
  })

  ipcMain.handle('terminal:write', async (_, id: string, data: string) => {
    return terminalService.write(id, data)
  })

  ipcMain.handle('terminal:kill', async (_, id: string) => {
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
              message: 'DependencyHub Desktop v1.0.2',
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

function getStartupLanguageInfo(): StartupLanguageInfo {
  const installerLanguage = readInstallerLanguage()
  const isPortable = Boolean(
    process.env.PORTABLE_EXECUTABLE_DIR ||
    process.env.PORTABLE_EXECUTABLE_FILE ||
    process.env.PORTABLE_EXECUTABLE_APP_FILENAME
  )

  if (installerLanguage) {
    return {
      language: installerLanguage,
      source: 'installer',
      shouldPrompt: false,
      isPackaged: app.isPackaged,
      isPortable
    }
  }

  return {
    language: 'en-US',
    source: 'default',
    shouldPrompt: true,
    isPackaged: app.isPackaged,
    isPortable
  }
}

function readInstallerLanguage(): AppLanguage | null {
  const candidates = [
    join(process.resourcesPath || '', 'default-language.json'),
    join(mainDir, '../default-language.json'),
    join(mainDir, '../../default-language.json')
  ]

  for (const filePath of candidates) {
    try {
      if (!existsSync(filePath)) continue

      const data = JSON.parse(readFileSync(filePath, 'utf8')) as { language?: string }
      if (data.language === 'zh-CN') return 'zh-CN'
      if (data.language === 'en-US') return 'en-US'
    } catch {
    }
  }

  return null
}
