import { unwrapIpcResult } from '../shared/ipcFailure'
import { contextBridge, ipcRenderer } from 'electron'
import type { DependencyManagerId as RegistryDependencyManagerId } from '../shared/managerRegistry'
import type {
  ManagerExecuteOptions,
  ManagerOperationRequest,
  ManagerSearchQuery
} from '../shared/managerWorkspace'

async function invoke(...args: Parameters<typeof ipcRenderer.invoke>): ReturnType<typeof ipcRenderer.invoke> {
  return unwrapIpcResult(await ipcRenderer.invoke(...args))
}

contextBridge.exposeInMainWorld('electronAPI', {
  app: {
    getStartupLanguage: () => invoke('app:get-startup-language'),
    setMenuLanguage: (language: AppLanguage) => invoke('app:set-menu-language', language)
  },

  getDefaultPath: () => invoke('get-default-path'),
  selectDirectory: () => invoke('select-directory'),
  selectFile: (options?: FileSelectOptions) => invoke('select-file', options),
  
  onCommandLog: (callback: (data: any) => void) => {
    ipcRenderer.on('command-log', (_, data) => callback(data))
  },
  removeCommandLogListener: () => {
    ipcRenderer.removeAllListeners('command-log')
  },

  onTerminalData: (callback: (data: any) => void) => {
    ipcRenderer.on('terminal:data', (_, data) => callback(data))
  },
  onTerminalExit: (callback: (data: any) => void) => {
    ipcRenderer.on('terminal:exit', (_, data) => callback(data))
  },
  removeTerminalListeners: () => {
    ipcRenderer.removeAllListeners('terminal:data')
    ipcRenderer.removeAllListeners('terminal:exit')
  },
  
  npm: {
    search: (query: string, limit?: number) => invoke('npm:search', query, limit),
    view: (packageName: string) => invoke('npm:view', packageName),
    smartAnalyze: (input: SmartUpdateInput) => invoke('npm:smart-analyze', input),
    install: (args: InstallArgs) => invoke('npm:install', args),
    uninstall: (args: UninstallArgs) => invoke('npm:uninstall', args),
    update: (args: UpdateArgs) => invoke('npm:update', args),
    outdated: (cwd: string) => invoke('npm:outdated', cwd),
    list: (cwd: string, global: boolean) => invoke('npm:list', cwd, global),
    configList: () => invoke('npm:config-list'),
    configSet: (key: string, value: string) => invoke('npm:config-set', key, value),
    configGet: (key: string) => invoke('npm:config-get', key),
    configDelete: (key: string) => invoke('npm:config-delete', key),
    configEdit: () => invoke('npm:config-edit'),
    whoami: () => invoke('npm:whoami'),
    login: (registry?: string) => invoke('npm:login', registry),
    logout: (registry?: string) => invoke('npm:logout', registry),
    runScript: (cwd: string, script: string) => invoke('npm:run-script', cwd, script),
    getScripts: (cwd: string) => invoke('npm:get-scripts', cwd),
    moveDep: (args: MoveDepArgs) => invoke('npm:move-dep', args),
    getPublished: (username: string) => invoke('npm:get-published', username),
    checkAllOutdated: (cwd: string) => invoke('npm:check-all-outdated', cwd),
    getPackageInfo: (packageName: string) => invoke('npm:info', packageName),
    getVersions: (packageName: string) => invoke('npm:get-versions', packageName),
    getVersionMetadata: (packageName: string) => invoke('npm:get-version-metadata', packageName),
    installVersion: (args: InstallVersionArgs) => invoke('npm:install-version', args),
    globalOutdated: () => invoke('npm:global-outdated'),
    adduser: (registry?: string) => invoke('npm:adduser', registry),
    getRegistryInfo: (registry?: string) => invoke('npm:get-registry-info', registry),
    getPackageSize: (packageName: string, version?: string) => invoke('npm:get-package-size', packageName, version),
    getDependencyTree: (packageName: string, version?: string, depth?: number) => invoke('npm:get-dependency-tree', packageName, version, depth),
    audit: (cwd: string) => invoke('npm:audit', cwd),
    globalAudit: () => invoke('npm:global-audit'),
    auditFix: (cwd: string) => invoke('npm:audit-fix', cwd),
    getReadme: (packageName: string) => invoke('npm:get-readme', packageName),
    getDependents: (packageName: string) => invoke('npm:get-dependents', packageName),
    downloadStats: (packageName: string) => invoke('npm:download-stats', packageName),
    getProjectDependencyTree: (cwd: string, depth?: number) => invoke('npm:get-project-dependency-tree', cwd, depth),
    getGlobalDependencyTree: (depth?: number) => invoke('npm:get-global-dependency-tree', depth)
  },

  pip: {
    list: (options?: string | PipCommandOptions) => invoke('pip:list', options),
    outdated: (options?: string | PipCommandOptions) => invoke('pip:outdated', options),
    install: (args: PipInstallArgs) => invoke('pip:install', args),
    uninstall: (args: PipPackageArgs) => invoke('pip:uninstall', args),
    update: (args: PipPackageArgs) => invoke('pip:update', args),
    updateAll: (args?: PipCommandOptions) => invoke('pip:update-all', args),
    freeze: (cwd?: string) => invoke('pip:freeze', cwd),
    exportRequirements: (cwd: string) => invoke('pip:export-requirements', cwd),
    readRequirements: (cwd: string) => invoke('pip:read-requirements', cwd),
    search: (query: string, cwd?: string) => invoke('pip:search', query, cwd),
    versions: (packageName: string) => invoke('pip:versions', packageName),
    show: (packageName: string, cwd?: string) => invoke('pip:show', packageName, cwd),
    check: (cwd?: string) => invoke('pip:check', cwd),
    repairCheck: (cwd?: string) => invoke('pip:repair-check', cwd),
    configList: (scope?: PipConfigScope) => invoke('pip:config-list', scope),
    configFile: (scope?: PipConfigScope) => invoke('pip:config-file', scope),
    backupConfig: (scope?: PipConfigScope) => invoke('pip:backup-config', scope),
    configSet: (scope: PipConfigScope, key: string, value: string) => invoke('pip:config-set', scope, key, value),
    configUnset: (scope: PipConfigScope, key: string) => invoke('pip:config-unset', scope, key),
    cacheDir: () => invoke('pip:cache-dir'),
    cachePurge: () => invoke('pip:cache-purge'),
    audit: (cwd?: string) => invoke('pip:audit', cwd),
    installTool: (tool: 'pip-audit' | 'pipdeptree', cwd?: string) => invoke('pip:install-tool', tool, cwd),
    dependencyTree: (cwd?: string) => invoke('pip:dependency-tree', cwd),
    publish: (args: PipPublishArgs) => invoke('pip:publish', args)
  },

  maven: {
    detect: (cwd: string) => invoke('maven:detect', cwd),
    list: (cwd: string) => invoke('maven:list', cwd),
    tree: (cwd: string) => invoke('maven:tree', cwd),
    dependencyTree: (cwd: string) => invoke('maven:dependency-tree', cwd),
    runGoal: (cwd: string, goal: string) => invoke('maven:run-goal', cwd, goal),
    search: (query: string, cwd?: string, options?: MavenSearchOptions) => invoke('maven:search', query, cwd, options),
    versions: (groupId: string, artifactId: string) => invoke('maven:versions', groupId, artifactId),
    info: (cwd?: string) => invoke('maven:info', cwd),
    effectiveSettings: (cwd?: string) => invoke('maven:effective-settings', cwd),
    ensureSettings: () => invoke('maven:ensure-settings'),
    backupSettings: () => invoke('maven:backup-settings'),
    setLocalRepository: (repositoryPath: string) => invoke('maven:set-local-repository', repositoryPath),
    setMirror: (id: string, url: string, mirrorOf?: string) => invoke('maven:set-mirror', id, url, mirrorOf),
    setServer: (id: string, username: string, password: string) => invoke('maven:set-server', id, username, password),
    setSecureServer: (id: string, username: string, password: string) => invoke('maven:set-secure-server', id, username, password),
    deploy: (args: MavenDeployArgs) => invoke('maven:deploy', args),
    securityAudit: (cwd: string) => invoke('maven:security-audit', cwd),
    goOffline: (cwd: string) => invoke('maven:go-offline', cwd),
    purgeLocalRepository: (cwd: string) => invoke('maven:purge-local-repository', cwd),
    addDependency: (cwd: string, dep: MavenDependencyArgs) => invoke('maven:add-dependency', cwd, dep),
    removeDependency: (cwd: string, dep: Pick<MavenDependencyArgs, 'groupId' | 'artifactId'>) => invoke('maven:remove-dependency', cwd, dep)
  },

  plugins: {
    catalog: (projectPath?: string) => invoke('plugins:catalog', projectPath),
    setEnabled: (id: PackageManagerId, enabled: boolean, projectPath?: string) => invoke('plugins:set-enabled', id, enabled, projectPath),
    detected: (projectPath: string) => invoke('plugins:detected', projectPath)
  },

  cargo: {
    detect: (cwd: string) => invoke('cargo:detect', cwd),
    list: (cwd: string) => invoke('cargo:list', cwd),
    search: (query: string) => invoke('cargo:search', query),
    versions: (packageName: string) => invoke('cargo:versions', packageName),
    install: (args: CargoInstallArgs) => invoke('cargo:install', args),
    uninstall: (args: CargoPackageArgs) => invoke('cargo:uninstall', args),
    update: (args: { packageName?: string; cwd: string }) => invoke('cargo:update', args),
    tree: (cwd: string) => invoke('cargo:tree', cwd),
    audit: (cwd: string) => invoke('cargo:audit', cwd),
    run: (cwd: string, commandLine: string) => invoke('cargo:run', cwd, commandLine)
  },

  gradle: {
    detect: (cwd: string) => invoke('gradle:detect', cwd),
    list: (cwd: string) => invoke('gradle:list', cwd),
    search: (query: string, options?: MavenSearchOptions) => invoke('gradle:search', query, options),
    versions: (groupId: string, artifactId: string) => invoke('gradle:versions', groupId, artifactId),
    addDependency: (args: GradleDependencyArgs) => invoke('gradle:add-dependency', args),
    updateDependency: (args: GradleDependencyArgs) => invoke('gradle:update-dependency', args),
    removeDependency: (args: GradleRemoveDependencyArgs) => invoke('gradle:remove-dependency', args),
    runTask: (cwd: string, taskLine: string) => invoke('gradle:run-task', cwd, taskLine),
    tasks: (cwd: string) => invoke('gradle:tasks', cwd),
    dependencyTree: (cwd: string, configuration?: string) => invoke('gradle:dependency-tree', cwd, configuration),
    dependencyInsight: (cwd: string, dependency: string, configuration?: string) => invoke('gradle:dependency-insight', cwd, dependency, configuration)
  },

  go: {
    detect: (cwd: string) => invoke('go:detect', cwd),
    list: (cwd: string) => invoke('go:list', cwd),
    search: (query: string, cwd?: string) => invoke('go:search', query, cwd),
    versions: (modulePath: string, cwd?: string) => invoke('go:versions', modulePath, cwd),
    install: (args: GoInstallArgs) => invoke('go:install', args),
    uninstall: (args: GoPackageArgs) => invoke('go:uninstall', args),
    update: (args: { modulePath?: string; cwd: string }) => invoke('go:update', args),
    tidy: (cwd: string) => invoke('go:tidy', cwd),
    graph: (cwd: string) => invoke('go:graph', cwd),
    audit: (cwd: string) => invoke('go:audit', cwd),
    run: (cwd: string, commandLine: string) => invoke('go:run', cwd, commandLine)
  },

  flutter: {
    detect: (cwd: string) => invoke('flutter:detect', cwd),
    read: (cwd: string) => invoke('flutter:read', cwd),
    list: (cwd: string) => invoke('flutter:list', cwd),
    assets: (cwd: string) => invoke('flutter:assets', cwd),
    search: (query: string) => invoke('flutter:search', query),
    versions: (packageName: string) => invoke('flutter:versions', packageName),
    addDependency: (args: FlutterDependencyArgs) => invoke('flutter:add-dependency', args),
    updateDependency: (args: { cwd: string; packageName?: string; type?: FlutterDependencyType }) => invoke('flutter:update-dependency', args),
    removeDependency: (args: { cwd: string; packageName: string; type?: FlutterDependencyType }) => invoke('flutter:remove-dependency', args),
    outdated: (cwd: string) => invoke('flutter:outdated', cwd),
    deps: (cwd: string) => invoke('flutter:deps', cwd),
    dependencyTree: (cwd: string) => invoke('flutter:dependency-tree', cwd),
    get: (cwd: string) => invoke('flutter:get', cwd),
    run: (cwd: string, commandLine: string) => invoke('flutter:run', cwd, commandLine),
    addAsset: (args: { cwd: string; path: string }) => invoke('flutter:add-asset', args),
    removeAsset: (args: { cwd: string; path: string }) => invoke('flutter:remove-asset', args),
    checkPublish: (cwd: string) => invoke('flutter:check-publish', cwd),
    publish: (args: FlutterPublishArgs) => invoke('flutter:publish', args),
    securityAudit: (cwd: string) => invoke('flutter:security-audit', cwd)
  },

  native: {
    detect: (cwd: string) => invoke('native:detect', cwd),
    list: (cwd: string) => invoke('native:list', cwd),
    search: (query: string) => invoke('native:search', query),
    install: (args: NativeInstallArgs) => invoke('native:install', args),
    uninstall: (args: NativeRemoveArgs) => invoke('native:uninstall', args),
    run: (args: NativeRunArgs) => invoke('native:run', args),
    configure: (cwd: string, buildDir?: string) => invoke('native:configure', cwd, buildDir),
    build: (cwd: string, buildDir?: string) => invoke('native:build', cwd, buildDir)
  },

  managers: {
    descriptors: () => invoke('manager:descriptors'),
    diagnostics: () => invoke('manager:diagnostics'),
    detected: (cwd: string) => invoke('manager:detected', cwd),
    inventory: (cwd: string, managerId: RegistryDependencyManagerId) => invoke('manager:inventory', cwd, managerId),
    plan: (cwd: string, managerId: RegistryDependencyManagerId, request: ManagerOperationRequest) => invoke('manager:plan', cwd, managerId, request),
    execute: (cwd: string, managerId: RegistryDependencyManagerId, request: ManagerOperationRequest, options?: ManagerExecuteOptions) => ipcRenderer.invoke('manager:execute', cwd, managerId, request, options),
    runCustom: (cwd: string, managerId: RegistryDependencyManagerId, commandLine: string, options?: { operationId?: string }) => ipcRenderer.invoke('manager:run-custom', cwd, managerId, commandLine, options),
    search: (cwd: string | undefined, managerId: RegistryDependencyManagerId, query: ManagerSearchQuery) => invoke('manager:search', cwd, managerId, query),
    health: (cwd: string, managerId: RegistryDependencyManagerId) => invoke('manager:health', cwd, managerId),
    restoreBackup: (cwd: string, backupPath: string) => invoke('manager:restore-backup', cwd, backupPath)
  },

  operations: {
    cancel: (operationId: string) => invoke('operation:cancel', operationId),
    cancelProject: (projectPath: string) => invoke('operation:cancel-project', projectPath),
    listActive: () => invoke('operation:list-active')
  },

  supplyChain: {
    report: (cwd: string) => invoke('supply-chain:report', cwd),
    exportCycloneDx: (cwd: string) => invoke('supply-chain:export-cyclonedx', cwd),
    exportSpdx: (cwd: string) => invoke('supply-chain:export-spdx', cwd),
    exportMarkdown: (cwd: string) => invoke('supply-chain:export-markdown', cwd),
    licenseReport: (cwd: string) => invoke('supply-chain:license-report', cwd),
    exportLicenseMarkdown: (cwd: string) => invoke('supply-chain:export-license-markdown', cwd),
    exportLicenseJson: (cwd: string) => invoke('supply-chain:export-license-json', cwd),
    createSnapshot: (cwd: string) => invoke('supply-chain:create-snapshot', cwd),
    listSnapshots: (cwd: string) => invoke('supply-chain:list-snapshots', cwd),
    diffLatestSnapshot: (cwd: string) => invoke('supply-chain:diff-latest-snapshot', cwd),
    dependencyDiffLatestSnapshot: (cwd: string) => invoke('supply-chain:dependency-diff-latest-snapshot', cwd),
    exportDependencyDiffMarkdown: (cwd: string) => invoke('supply-chain:export-dependency-diff-markdown', cwd),
    restoreLatestSnapshot: (cwd: string) => invoke('supply-chain:restore-latest-snapshot', cwd),
    restoreSnapshot: (cwd: string, snapshotIdOrPath: string) => invoke('supply-chain:restore-snapshot', cwd, snapshotIdOrPath),
    ensurePolicy: (cwd: string) => invoke('supply-chain:ensure-policy', cwd),
    getPolicy: (cwd: string) => invoke('supply-chain:get-policy', cwd),
    savePolicy: (cwd: string, policy: DependencyPolicy) => invoke('supply-chain:save-policy', cwd, policy),
    evaluatePolicy: (cwd: string) => invoke('supply-chain:evaluate-policy', cwd)
  },

  thirdPartyNotices: {
    report: (cwd: string) => invoke('third-party-notices:report', cwd),
    exportText: (cwd: string) => invoke('third-party-notices:export-text', cwd),
    exportMarkdown: (cwd: string) => invoke('third-party-notices:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('third-party-notices:export-json', cwd)
  },

  operationHistory: {
    list: (cwd: string, limit?: number) => invoke('operation-history:list', cwd, limit),
    exportReport: (cwd: string, format?: 'json' | 'markdown') => invoke('operation-history:export', cwd, format)
  },

  ciEvidence: {
    list: (cwd: string, limit?: number) => invoke('ci-evidence:list', cwd, limit),
    record: (cwd: string, input: CiEvidenceInput) => invoke('ci-evidence:record', cwd, input),
    importFromFile: (cwd: string, filePath: string, overrides?: Partial<CiEvidenceInput>) => invoke('ci-evidence:import-file', cwd, filePath, overrides),
    exportMarkdown: (cwd: string) => invoke('ci-evidence:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('ci-evidence:export-json', cwd)
  },

  auditEvidence: {
    report: (cwd: string) => invoke('audit-evidence:report', cwd),
    importFromFile: (cwd: string, filePath: string, options?: AuditEvidenceImportOptions) => invoke('audit-evidence:import-file', cwd, filePath, options),
    exportMarkdown: (cwd: string) => invoke('audit-evidence:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('audit-evidence:export-json', cwd),
    exportHtml: (cwd: string) => invoke('audit-evidence:export-html', cwd)
  },

  vulnerabilityRemediationPlan: {
    plan: (cwd: string) => invoke('vulnerability-remediation-plan:plan', cwd),
    exportMarkdown: (cwd: string) => invoke('vulnerability-remediation-plan:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('vulnerability-remediation-plan:export-json', cwd)
  },

  releaseApproval: {
    list: (cwd: string, limit?: number) => invoke('release-approval:list', cwd, limit),
    record: (cwd: string, input: ReleaseApprovalInput) => invoke('release-approval:record', cwd, input),
    exportMarkdown: (cwd: string) => invoke('release-approval:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-approval:export-json', cwd)
  },

  releaseException: {
    list: (cwd: string, limit?: number) => invoke('release-exception:list', cwd, limit),
    record: (cwd: string, input: ReleaseExceptionInput) => invoke('release-exception:record', cwd, input),
    revoke: (cwd: string, id: string, input?: Partial<Pick<ReleaseExceptionInput, 'reviewer' | 'reason' | 'annotations'>>) => invoke('release-exception:revoke', cwd, id, input),
    exportMarkdown: (cwd: string) => invoke('release-exception:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-exception:export-json', cwd)
  },

  registryReachability: {
    discover: (cwd: string) => invoke('registry-reachability:discover', cwd),
    check: (cwd: string, options?: RegistryReachabilityOptions) => invoke('registry-reachability:check', cwd, options),
    exportMarkdown: (cwd: string, options?: RegistryReachabilityOptions) => invoke('registry-reachability:export-markdown', cwd, options),
    exportJson: (cwd: string, options?: RegistryReachabilityOptions) => invoke('registry-reachability:export-json', cwd, options)
  },

  credentialUsage: {
    report: (cwd: string) => invoke('credential-usage:report', cwd),
    exportMarkdown: (cwd: string) => invoke('credential-usage:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('credential-usage:export-json', cwd)
  },

  lockfileDrift: {
    report: (cwd: string) => invoke('lockfile-drift:report', cwd),
    exportMarkdown: (cwd: string) => invoke('lockfile-drift:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('lockfile-drift:export-json', cwd)
  },

  runtimePinning: {
    report: (cwd: string) => invoke('runtime-pinning:report', cwd),
    exportMarkdown: (cwd: string) => invoke('runtime-pinning:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('runtime-pinning:export-json', cwd)
  },

  offlineCacheReadiness: {
    report: (cwd: string) => invoke('offline-cache-readiness:report', cwd),
    exportMarkdown: (cwd: string) => invoke('offline-cache-readiness:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('offline-cache-readiness:export-json', cwd)
  },

  releaseRiskProfile: {
    report: (cwd: string) => invoke('release-risk-profile:report', cwd),
    exportMarkdown: (cwd: string) => invoke('release-risk-profile:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-risk-profile:export-json', cwd)
  },

  ciIntegrationPlan: {
    plan: (cwd: string) => invoke('ci-integration-plan:plan', cwd),
    exportMarkdown: (cwd: string) => invoke('ci-integration-plan:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('ci-integration-plan:export-json', cwd),
    exportGithubActions: (cwd: string) => invoke('ci-integration-plan:export-github-actions', cwd)
  },

  dependencyAutomationPlan: {
    plan: (cwd: string) => invoke('dependency-automation-plan:plan', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-automation-plan:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-automation-plan:export-json', cwd),
    exportDependabot: (cwd: string) => invoke('dependency-automation-plan:export-dependabot', cwd),
    exportRenovate: (cwd: string) => invoke('dependency-automation-plan:export-renovate', cwd)
  },

  credentialRotationPlan: {
    plan: (cwd: string) => invoke('credential-rotation-plan:plan', cwd),
    exportMarkdown: (cwd: string) => invoke('credential-rotation-plan:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('credential-rotation-plan:export-json', cwd)
  },

  automationSafetyPlan: {
    plan: (cwd: string) => invoke('automation-safety-plan:plan', cwd),
    exportMarkdown: (cwd: string) => invoke('automation-safety-plan:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('automation-safety-plan:export-json', cwd)
  },

  dependencyOwnershipPlan: {
    plan: (cwd: string) => invoke('dependency-ownership-plan:plan', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-ownership-plan:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-ownership-plan:export-json', cwd),
    exportCodeowners: (cwd: string) => invoke('dependency-ownership-plan:export-codeowners', cwd)
  },

  dependencyUpgradePlaybook: {
    report: (cwd: string) => invoke('dependency-upgrade-playbook:report', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-upgrade-playbook:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-upgrade-playbook:export-json', cwd)
  },

  dependencyRollbackPlan: {
    report: (cwd: string) => invoke('dependency-rollback-plan:report', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-rollback-plan:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-rollback-plan:export-json', cwd)
  },

  dependencyImpactAnalysis: {
    report: (cwd: string) => invoke('dependency-impact-analysis:report', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-impact-analysis:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-impact-analysis:export-json', cwd)
  },

  dependencyChangeApprovalPacket: {
    report: (cwd: string) => invoke('dependency-change-approval-packet:report', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-change-approval-packet:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-change-approval-packet:export-json', cwd)
  },

  dependencyChangeCalendar: {
    report: (cwd: string) => invoke('dependency-change-calendar:report', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-change-calendar:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-change-calendar:export-json', cwd),
    exportIcs: (cwd: string) => invoke('dependency-change-calendar:export-ics', cwd),
    exportFreezeGate: (cwd: string) => invoke('dependency-change-calendar:export-freeze-gate', cwd),
    exportTicketTemplate: (cwd: string) => invoke('dependency-change-calendar:export-ticket-template', cwd)
  },

  dependencyChangeExecutionRecord: {
    report: (cwd: string) => invoke('dependency-change-execution-record:report', cwd),
    exportMarkdown: (cwd: string) => invoke('dependency-change-execution-record:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('dependency-change-execution-record:export-json', cwd)
  },

  policyAsCodePack: {
    report: (cwd: string) => invoke('policy-as-code-pack:report', cwd),
    exportMarkdown: (cwd: string) => invoke('policy-as-code-pack:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('policy-as-code-pack:export-json', cwd),
    exportPolicyJson: (cwd: string) => invoke('policy-as-code-pack:export-policy-json', cwd),
    exportGithubActions: (cwd: string) => invoke('policy-as-code-pack:export-github-actions', cwd)
  },

  workspaceDiscovery: {
    report: (cwd: string) => invoke('workspace-discovery:report', cwd),
    exportMarkdown: (cwd: string) => invoke('workspace-discovery:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('workspace-discovery:export-json', cwd)
  },

  workspaceGovernance: {
    report: (cwd: string) => invoke('workspace-governance:report', cwd),
    exportMarkdown: (cwd: string) => invoke('workspace-governance:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('workspace-governance:export-json', cwd),
    exportEvidenceMarkdown: (cwd: string) => invoke('workspace-governance:export-evidence-markdown', cwd),
    exportEvidenceJson: (cwd: string) => invoke('workspace-governance:export-evidence-json', cwd),
    remediationPlan: (cwd: string) => invoke('workspace-governance:remediation-plan', cwd),
    exportRemediationMarkdown: (cwd: string) => invoke('workspace-governance:export-remediation-markdown', cwd),
    exportRemediationJson: (cwd: string) => invoke('workspace-governance:export-remediation-json', cwd),
    updatePlan: (cwd: string) => invoke('workspace-governance:update-plan', cwd),
    exportUpdatePlanMarkdown: (cwd: string) => invoke('workspace-governance:export-update-plan-markdown', cwd),
    exportUpdatePlanJson: (cwd: string) => invoke('workspace-governance:export-update-plan-json', cwd),
    exportWorkspaceSboms: (cwd: string, format: WorkspaceSbomExportFormat) => invoke('workspace-governance:export-workspace-sboms', cwd, format),
    exportReleaseBundle: (cwd: string) => invoke('workspace-governance:export-release-bundle', cwd),
    exportReleaseDashboard: (cwd: string) => invoke('workspace-governance:export-release-dashboard', cwd)
  },

  dependencyHealthDashboard: {
    exportHtml: (cwd: string) => invoke('dependency-health-dashboard:export-html', cwd)
  },

  reportArtifacts: {
    report: (cwd: string) => invoke('report-artifacts:report', cwd),
    exportMarkdown: (cwd: string) => invoke('report-artifacts:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('report-artifacts:export-json', cwd)
  },

  releaseEvidenceCompleteness: {
    report: (cwd: string) => invoke('release-evidence-completeness:report', cwd),
    exportMarkdown: (cwd: string) => invoke('release-evidence-completeness:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-evidence-completeness:export-json', cwd)
  },

  releaseProvenanceAttestation: {
    report: (cwd: string) => invoke('release-provenance-attestation:report', cwd),
    exportMarkdown: (cwd: string) => invoke('release-provenance-attestation:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-provenance-attestation:export-json', cwd)
  },

  releaseIntegrityVerification: {
    report: (cwd: string) => invoke('release-integrity-verification:report', cwd),
    exportMarkdown: (cwd: string) => invoke('release-integrity-verification:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-integrity-verification:export-json', cwd)
  },

  releaseSignature: {
    report: (cwd: string) => invoke('release-signature:report', cwd),
    verify: (cwd: string) => invoke('release-signature:verify', cwd),
    exportMarkdown: (cwd: string) => invoke('release-signature:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-signature:export-json', cwd)
  },

  releaseTrustPolicy: {
    report: (cwd: string) => invoke('release-trust-policy:report', cwd),
    exportMarkdown: (cwd: string) => invoke('release-trust-policy:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('release-trust-policy:export-json', cwd)
  },

  frameworkCoverage: {
    report: (cwd?: string) => invoke('framework-coverage:report', cwd),
    exportMarkdown: (cwd: string) => invoke('framework-coverage:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('framework-coverage:export-json', cwd)
  },

  readiness: {
    report: (cwd: string) => invoke('readiness:report', cwd),
    ensurePolicy: (cwd: string) => invoke('readiness:ensure-policy', cwd),
    getPolicy: (cwd: string) => invoke('readiness:get-policy', cwd),
    savePolicy: (cwd: string, policy: ReadinessPolicy) => invoke('readiness:save-policy', cwd, policy),
    exportMarkdown: (cwd: string) => invoke('readiness:export-markdown', cwd),
    exportJson: (cwd: string) => invoke('readiness:export-json', cwd)
  },

  credentials: {
    status: () => invoke('credentials:status'),
    list: (filter?: CredentialFilter) => invoke('credentials:list', filter),
    save: (input: CredentialInput) => invoke('credentials:save', input),
    delete: (id: string) => invoke('credentials:delete', id)
  },

  dependencyHealth: {
    scan: (manager: DependencyHealthManager, cwd: string) => invoke('dependency-health:scan', manager, cwd),
    fix: (cwd: string, action: DependencyHealthAction) => invoke('dependency-health:fix', cwd, action)
  },

  terminal: {
    create: (cwd?: string) => invoke('terminal:create', cwd),
    write: (id: string, data: string) => invoke('terminal:write', id, data),
    kill: (id: string) => invoke('terminal:kill', id)
  },
  
  watcher: {
    start: (projectPath: string) => invoke('watch:start', projectPath),
    stop: (projectPath?: string) => invoke('watch:stop', projectPath),
    onChange: (callback: (data: any) => void) => {
      ipcRenderer.on('file-change', (_, data) => callback(data))
    },
    removeChangeListener: () => {
      ipcRenderer.removeAllListeners('file-change')
    }
  },
  
  project: {
    detect: (projectPath: string) => invoke('project:detect', projectPath),
    readPackage: (projectPath: string) => invoke('project:read-package', projectPath),
    inventory: (projectPath: string) => invoke('project:inventory', projectPath),
    exportInventory: (projectPath: string) => invoke('project:export-inventory', projectPath),
    writePackage: (projectPath: string, content: any) => invoke('project:write-package', projectPath, content),
    getPackagePath: (projectPath: string) => invoke('project:get-package-path', projectPath),
    getNodeModulesPath: (projectPath: string, packageName: string) => invoke('project:get-node-modules-path', projectPath, packageName),
    toolchain: {
      get: (projectPath: string) => invoke('project:toolchain-get', projectPath),
      set: (projectPath: string, tool: ToolName, toolPath: string) => invoke('project:toolchain-set', projectPath, tool, toolPath),
      clear: (projectPath: string, tool: ToolName) => invoke('project:toolchain-clear', projectPath, tool),
      check: (projectPath: string) => invoke('project:toolchain-check', projectPath)
    }
  },
  
  publish: {
    check: (projectPath: string) => invoke('publish:check', projectPath),
    publish: (args: PublishArgs) => invoke('publish:publish', args)
  },
  
  system: {
    openPath: (path: string) => invoke('system:open-path', path),
    openFile: (filePath: string) => invoke('system:open-file', filePath),
    getNpmInfo: () => invoke('system:get-npm-info'),
    getCachePath: () => invoke('system:get-cache-path'),
    setCachePath: (newPath: string) => invoke('system:set-cache-path', newPath),
    clearCache: () => invoke('system:clear-cache'),
    updateNpm: () => invoke('system:update-npm'),
    npmHelp: (command?: string) => invoke('system:npm-help', command),
    checkTools: () => invoke('system:check-tools'),
    setToolPath: (tool: ToolName, toolPath: string) => invoke('system:set-tool-path', tool, toolPath),
    openToolDownload: (tool: ToolName) => invoke('system:open-tool-download', tool),
    openTerminal: (cwd: string) => invoke('npm:open-terminal', cwd)
  },
  
  openExternal: (url: string) => invoke('open-external', url)
})

export interface InstallArgs {
  packageName: string
  cwd?: string
  global?: boolean
  dev?: boolean
  version?: string
}

export interface UninstallArgs {
  packageName: string
  cwd?: string
  global?: boolean
}

export interface UpdateArgs {
  packageName?: string
  cwd?: string
  global?: boolean
  version?: string
}

export interface PublishArgs {
  cwd: string
  tag?: string
  access?: 'public' | 'restricted'
  registry?: string
  credentialId?: string
  token?: string
  overrideReadinessGate?: boolean
}

export interface MoveDepArgs {
  packageName: string
  cwd: string
  from: 'dependencies' | 'devDependencies'
  to: 'dependencies' | 'devDependencies'
}

export interface InstallVersionArgs {
  packageName: string
  version: string
  cwd?: string
  global?: boolean
  dev?: boolean
}

export interface PipInstallArgs {
  packageName?: string
  version?: string
  cwd?: string
  requirements?: boolean
  user?: boolean
  upgrade?: boolean
  indexUrl?: string
  extraIndexUrl?: string
  trustedHost?: string
  breakSystemPackages?: boolean
}

export interface PipPackageArgs {
  packageName: string
  cwd?: string
  user?: boolean
  breakSystemPackages?: boolean
}

export interface PipCommandOptions {
  cwd?: string
  user?: boolean
  breakSystemPackages?: boolean
}

export interface PipPublishArgs {
  cwd: string
  repositoryUrl?: string
  username?: string
  password?: string
  credentialId?: string
  buildBefore?: boolean
  overrideReadinessGate?: boolean
}

export type PipConfigScope = 'user' | 'global' | 'site'

export type ToolName =
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'deno'
  | 'pip'
  | 'uv'
  | 'poetry'
  | 'pipenv'
  | 'conda'
  | 'maven'
  | 'gradle'
  | 'cargo'
  | 'go'
  | 'flutter'
  | 'dotnet'
  | 'composer'
  | 'ruby'
  | 'bundle'
  | 'swift'
  | 'pod'
  | 'helm'
  | 'docker'
  | 'kustomize'
  | 'helmfile'
  | 'skaffold'
  | 'argocd'
  | 'flux'
  | 'brew'
  | 'choco'
  | 'scoop'
  | 'winget'
  | 'asdf'
  | 'mise'
  | 'sdk'
  | 'apt-get'
  | 'dnf'
  | 'apk'
  | 'pacman'
  | 'nix'
  | 'cmake'
  | 'vcpkg'
  | 'conan'
export type AppLanguage = 'zh-CN' | 'en-US'

export interface MavenDependencyArgs {
  groupId: string
  artifactId: string
  version: string
  scope?: string
  type?: string
}

export interface MavenDeployArgs {
  cwd: string
  repositoryId?: string
  repositoryUrl?: string
  skipTests?: boolean
  goals?: string
  overrideReadinessGate?: boolean
}

export type CredentialKind = 'token' | 'password' | 'username-password' | 'api-key' | 'other'
export type CredentialStorage = 'electron-safe-storage' | 'base64-fallback' | 'test-adapter'

export interface CredentialInput {
  id?: string
  managerId: DependencyManagerId
  service: string
  account?: string
  label?: string
  kind?: CredentialKind
  secret: string
  url?: string
  notes?: string
}

export interface CredentialFilter {
  managerId?: DependencyManagerId
  service?: string
}

export type MavenSearchMode = 'startsWith' | 'contains' | 'exact' | 'keyword'
export type MavenSearchScope = 'artifactId' | 'groupId' | 'coordinate' | 'all'
export type MavenSearchSource = 'mavenCentral' | 'nexus'

export interface MavenSearchOptions {
  mode?: MavenSearchMode
  scope?: MavenSearchScope
  source?: MavenSearchSource
  customUrl?: string
  includeLocal?: boolean
  limit?: number
}

export type PackageManagerId = 'npm' | 'pip' | 'maven' | 'cargo' | 'gradle' | 'go' | 'flutter' | 'native'
export type FuturePackageManagerId =
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'deno'
  | 'uv'
  | 'poetry'
  | 'pipenv'
  | 'conda'
  | 'renv'
  | 'julia'
  | 'nuget'
  | 'composer'
  | 'bundler'
  | 'sbt'
  | 'leiningen'
  | 'mix'
  | 'rebar3'
  | 'cabal'
  | 'stack'
  | 'swiftpm'
  | 'cocoapods'
  | 'helm'
  | 'docker'
  | 'kustomize'
  | 'helmfile'
  | 'skaffold'
  | 'argocd'
  | 'flux'
  | 'terraform'
  | 'opentofu'
  | 'ansible'
  | 'github-actions'
  | 'gitlab-ci'
  | 'pre-commit'
  | 'bazel'
  | 'pants'
  | 'buck'
  | 'opam'
  | 'cpan'
  | 'luarocks'
  | 'shards'
  | 'zig'
  | 'homebrew'
  | 'chocolatey'
  | 'scoop'
  | 'winget'
  | 'asdf'
  | 'mise'
  | 'sdkman'
  | 'apt'
  | 'dnf'
  | 'apk'
  | 'pacman'
  | 'nix'
  | 'mcp'
  | 'skills'
  | 'ai-agents'
export type DependencyManagerId = PackageManagerId | FuturePackageManagerId
export type DependencyHealthManager = PackageManagerId
export type DependencyHealthSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type DependencyHealthIssueType =
  | 'cycle'
  | 'version-conflict'
  | 'peer-conflict'
  | 'missing'
  | 'invalid'
  | 'extraneous'
  | 'outdated'
  | 'tooling'
  | 'native-linkage'
  | 'unmanaged'
  | 'configuration'

export interface DependencyHealthAction {
  id: string
  label: string
  kind: 'command' | 'api' | 'openFile' | 'copy' | 'manual'
  description?: string
  command?: {
    tool: ToolName
    args: string[]
    displayBin?: string
  }
  target?: string
  payload?: string
}

export interface DependencyHealthIssue {
  id: string
  manager: DependencyHealthManager
  type: DependencyHealthIssueType
  severity: DependencyHealthSeverity
  dependency?: string
  title: string
  description: string
  suggestion: string
  paths?: string[]
  actions: DependencyHealthAction[]
}

export interface DependencyHealthSummary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface DependencyHealthScanResult {
  manager: DependencyHealthManager
  cwd: string
  scannedAt: string
  summary: DependencyHealthSummary
  issues: DependencyHealthIssue[]
  raw?: string
}

export interface CargoInstallArgs {
  packageName: string
  version?: string
  cwd: string
  type?: 'dependencies' | 'dev-dependencies' | 'build-dependencies'
  features?: string
}

export interface CargoPackageArgs {
  packageName: string
  cwd: string
  type?: 'dependencies' | 'dev-dependencies' | 'build-dependencies'
}

export interface GradleDependencyArgs {
  groupId: string
  artifactId: string
  version: string
  configuration: string
  cwd: string
}

export interface GradleRemoveDependencyArgs {
  cwd: string
  groupId: string
  artifactId: string
  configuration?: string
}

export interface GoInstallArgs {
  modulePath: string
  version?: string
  cwd: string
}

export interface GoPackageArgs {
  modulePath: string
  cwd: string
}

export type FlutterDependencyType = 'dependencies' | 'dev_dependencies' | 'dependency_overrides'
export type FlutterDependencySource = 'hosted' | 'sdk' | 'path' | 'git'

export interface FlutterDependencyArgs {
  cwd: string
  packageName: string
  version?: string
  type?: FlutterDependencyType
  source?: FlutterDependencySource
  sdk?: string
  path?: string
  git?: string
}

export interface FlutterPublishArgs {
  cwd: string
  dryRun?: boolean
  force?: boolean
  server?: string
  overrideReadinessGate?: boolean
}

export interface NativeInstallArgs {
  cwd: string
  manager: 'vcpkg' | 'conan'
  name: string
  version?: string
  feature?: string
}

export interface NativeRemoveArgs {
  cwd: string
  manager: 'vcpkg' | 'conan'
  name: string
}

export interface NativeRunArgs {
  cwd: string
  tool: 'cmake' | 'vcpkg' | 'conan'
  commandLine: string
}
