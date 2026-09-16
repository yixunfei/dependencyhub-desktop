import { contextBridge, ipcRenderer } from 'electron'
import type { DependencyManagerId as RegistryDependencyManagerId } from '../shared/managerRegistry'
import type {
  ManagerExecuteOptions,
  ManagerOperationRequest,
  ManagerSearchQuery
} from '../shared/managerWorkspace'

contextBridge.exposeInMainWorld('electronAPI', {
  app: {
    getStartupLanguage: () => ipcRenderer.invoke('app:get-startup-language'),
    setMenuLanguage: (language: AppLanguage) => ipcRenderer.invoke('app:set-menu-language', language)
  },

  getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: (options?: FileSelectOptions) => ipcRenderer.invoke('select-file', options),
  
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
    search: (query: string, limit?: number) => ipcRenderer.invoke('npm:search', query, limit),
    view: (packageName: string) => ipcRenderer.invoke('npm:view', packageName),
    smartAnalyze: (input: SmartUpdateInput) => ipcRenderer.invoke('npm:smart-analyze', input),
    install: (args: InstallArgs) => ipcRenderer.invoke('npm:install', args),
    uninstall: (args: UninstallArgs) => ipcRenderer.invoke('npm:uninstall', args),
    update: (args: UpdateArgs) => ipcRenderer.invoke('npm:update', args),
    outdated: (cwd: string) => ipcRenderer.invoke('npm:outdated', cwd),
    list: (cwd: string, global: boolean) => ipcRenderer.invoke('npm:list', cwd, global),
    configList: () => ipcRenderer.invoke('npm:config-list'),
    configSet: (key: string, value: string) => ipcRenderer.invoke('npm:config-set', key, value),
    configGet: (key: string) => ipcRenderer.invoke('npm:config-get', key),
    configDelete: (key: string) => ipcRenderer.invoke('npm:config-delete', key),
    configEdit: () => ipcRenderer.invoke('npm:config-edit'),
    whoami: () => ipcRenderer.invoke('npm:whoami'),
    login: (registry?: string) => ipcRenderer.invoke('npm:login', registry),
    logout: (registry?: string) => ipcRenderer.invoke('npm:logout', registry),
    runScript: (cwd: string, script: string) => ipcRenderer.invoke('npm:run-script', cwd, script),
    getScripts: (cwd: string) => ipcRenderer.invoke('npm:get-scripts', cwd),
    moveDep: (args: MoveDepArgs) => ipcRenderer.invoke('npm:move-dep', args),
    getPublished: (username: string) => ipcRenderer.invoke('npm:get-published', username),
    checkAllOutdated: (cwd: string) => ipcRenderer.invoke('npm:check-all-outdated', cwd),
    getPackageInfo: (packageName: string) => ipcRenderer.invoke('npm:info', packageName),
    getVersions: (packageName: string) => ipcRenderer.invoke('npm:get-versions', packageName),
    getVersionMetadata: (packageName: string) => ipcRenderer.invoke('npm:get-version-metadata', packageName),
    installVersion: (args: InstallVersionArgs) => ipcRenderer.invoke('npm:install-version', args),
    globalOutdated: () => ipcRenderer.invoke('npm:global-outdated'),
    adduser: (registry?: string) => ipcRenderer.invoke('npm:adduser', registry),
    getRegistryInfo: (registry?: string) => ipcRenderer.invoke('npm:get-registry-info', registry),
    getPackageSize: (packageName: string, version?: string) => ipcRenderer.invoke('npm:get-package-size', packageName, version),
    getDependencyTree: (packageName: string, version?: string, depth?: number) => ipcRenderer.invoke('npm:get-dependency-tree', packageName, version, depth),
    audit: (cwd: string) => ipcRenderer.invoke('npm:audit', cwd),
    globalAudit: () => ipcRenderer.invoke('npm:global-audit'),
    auditFix: (cwd: string) => ipcRenderer.invoke('npm:audit-fix', cwd),
    getReadme: (packageName: string) => ipcRenderer.invoke('npm:get-readme', packageName),
    getDependents: (packageName: string) => ipcRenderer.invoke('npm:get-dependents', packageName),
    downloadStats: (packageName: string) => ipcRenderer.invoke('npm:download-stats', packageName),
    getProjectDependencyTree: (cwd: string, depth?: number) => ipcRenderer.invoke('npm:get-project-dependency-tree', cwd, depth),
    getGlobalDependencyTree: (depth?: number) => ipcRenderer.invoke('npm:get-global-dependency-tree', depth)
  },

  pip: {
    list: (options?: string | PipCommandOptions) => ipcRenderer.invoke('pip:list', options),
    outdated: (options?: string | PipCommandOptions) => ipcRenderer.invoke('pip:outdated', options),
    install: (args: PipInstallArgs) => ipcRenderer.invoke('pip:install', args),
    uninstall: (args: PipPackageArgs) => ipcRenderer.invoke('pip:uninstall', args),
    update: (args: PipPackageArgs) => ipcRenderer.invoke('pip:update', args),
    updateAll: (args?: PipCommandOptions) => ipcRenderer.invoke('pip:update-all', args),
    freeze: (cwd?: string) => ipcRenderer.invoke('pip:freeze', cwd),
    exportRequirements: (cwd: string) => ipcRenderer.invoke('pip:export-requirements', cwd),
    readRequirements: (cwd: string) => ipcRenderer.invoke('pip:read-requirements', cwd),
    search: (query: string, cwd?: string) => ipcRenderer.invoke('pip:search', query, cwd),
    versions: (packageName: string) => ipcRenderer.invoke('pip:versions', packageName),
    show: (packageName: string, cwd?: string) => ipcRenderer.invoke('pip:show', packageName, cwd),
    check: (cwd?: string) => ipcRenderer.invoke('pip:check', cwd),
    repairCheck: (cwd?: string) => ipcRenderer.invoke('pip:repair-check', cwd),
    configList: (scope?: PipConfigScope) => ipcRenderer.invoke('pip:config-list', scope),
    configFile: (scope?: PipConfigScope) => ipcRenderer.invoke('pip:config-file', scope),
    backupConfig: (scope?: PipConfigScope) => ipcRenderer.invoke('pip:backup-config', scope),
    configSet: (scope: PipConfigScope, key: string, value: string) => ipcRenderer.invoke('pip:config-set', scope, key, value),
    configUnset: (scope: PipConfigScope, key: string) => ipcRenderer.invoke('pip:config-unset', scope, key),
    cacheDir: () => ipcRenderer.invoke('pip:cache-dir'),
    cachePurge: () => ipcRenderer.invoke('pip:cache-purge'),
    audit: (cwd?: string) => ipcRenderer.invoke('pip:audit', cwd),
    installTool: (tool: 'pip-audit' | 'pipdeptree', cwd?: string) => ipcRenderer.invoke('pip:install-tool', tool, cwd),
    dependencyTree: (cwd?: string) => ipcRenderer.invoke('pip:dependency-tree', cwd),
    publish: (args: PipPublishArgs) => ipcRenderer.invoke('pip:publish', args)
  },

  maven: {
    detect: (cwd: string) => ipcRenderer.invoke('maven:detect', cwd),
    list: (cwd: string) => ipcRenderer.invoke('maven:list', cwd),
    tree: (cwd: string) => ipcRenderer.invoke('maven:tree', cwd),
    dependencyTree: (cwd: string) => ipcRenderer.invoke('maven:dependency-tree', cwd),
    runGoal: (cwd: string, goal: string) => ipcRenderer.invoke('maven:run-goal', cwd, goal),
    search: (query: string, cwd?: string, options?: MavenSearchOptions) => ipcRenderer.invoke('maven:search', query, cwd, options),
    versions: (groupId: string, artifactId: string) => ipcRenderer.invoke('maven:versions', groupId, artifactId),
    info: (cwd?: string) => ipcRenderer.invoke('maven:info', cwd),
    effectiveSettings: (cwd?: string) => ipcRenderer.invoke('maven:effective-settings', cwd),
    ensureSettings: () => ipcRenderer.invoke('maven:ensure-settings'),
    backupSettings: () => ipcRenderer.invoke('maven:backup-settings'),
    setLocalRepository: (repositoryPath: string) => ipcRenderer.invoke('maven:set-local-repository', repositoryPath),
    setMirror: (id: string, url: string, mirrorOf?: string) => ipcRenderer.invoke('maven:set-mirror', id, url, mirrorOf),
    setServer: (id: string, username: string, password: string) => ipcRenderer.invoke('maven:set-server', id, username, password),
    setSecureServer: (id: string, username: string, password: string) => ipcRenderer.invoke('maven:set-secure-server', id, username, password),
    deploy: (args: MavenDeployArgs) => ipcRenderer.invoke('maven:deploy', args),
    securityAudit: (cwd: string) => ipcRenderer.invoke('maven:security-audit', cwd),
    goOffline: (cwd: string) => ipcRenderer.invoke('maven:go-offline', cwd),
    purgeLocalRepository: (cwd: string) => ipcRenderer.invoke('maven:purge-local-repository', cwd),
    addDependency: (cwd: string, dep: MavenDependencyArgs) => ipcRenderer.invoke('maven:add-dependency', cwd, dep),
    removeDependency: (cwd: string, dep: Pick<MavenDependencyArgs, 'groupId' | 'artifactId'>) => ipcRenderer.invoke('maven:remove-dependency', cwd, dep)
  },

  plugins: {
    catalog: (projectPath?: string) => ipcRenderer.invoke('plugins:catalog', projectPath),
    setEnabled: (id: PackageManagerId, enabled: boolean, projectPath?: string) => ipcRenderer.invoke('plugins:set-enabled', id, enabled, projectPath),
    detected: (projectPath: string) => ipcRenderer.invoke('plugins:detected', projectPath)
  },

  cargo: {
    detect: (cwd: string) => ipcRenderer.invoke('cargo:detect', cwd),
    list: (cwd: string) => ipcRenderer.invoke('cargo:list', cwd),
    search: (query: string) => ipcRenderer.invoke('cargo:search', query),
    versions: (packageName: string) => ipcRenderer.invoke('cargo:versions', packageName),
    install: (args: CargoInstallArgs) => ipcRenderer.invoke('cargo:install', args),
    uninstall: (args: CargoPackageArgs) => ipcRenderer.invoke('cargo:uninstall', args),
    update: (args: { packageName?: string; cwd: string }) => ipcRenderer.invoke('cargo:update', args),
    tree: (cwd: string) => ipcRenderer.invoke('cargo:tree', cwd),
    audit: (cwd: string) => ipcRenderer.invoke('cargo:audit', cwd),
    run: (cwd: string, commandLine: string) => ipcRenderer.invoke('cargo:run', cwd, commandLine)
  },

  gradle: {
    detect: (cwd: string) => ipcRenderer.invoke('gradle:detect', cwd),
    list: (cwd: string) => ipcRenderer.invoke('gradle:list', cwd),
    search: (query: string, options?: MavenSearchOptions) => ipcRenderer.invoke('gradle:search', query, options),
    versions: (groupId: string, artifactId: string) => ipcRenderer.invoke('gradle:versions', groupId, artifactId),
    addDependency: (args: GradleDependencyArgs) => ipcRenderer.invoke('gradle:add-dependency', args),
    updateDependency: (args: GradleDependencyArgs) => ipcRenderer.invoke('gradle:update-dependency', args),
    removeDependency: (args: GradleRemoveDependencyArgs) => ipcRenderer.invoke('gradle:remove-dependency', args),
    runTask: (cwd: string, taskLine: string) => ipcRenderer.invoke('gradle:run-task', cwd, taskLine),
    tasks: (cwd: string) => ipcRenderer.invoke('gradle:tasks', cwd),
    dependencyTree: (cwd: string, configuration?: string) => ipcRenderer.invoke('gradle:dependency-tree', cwd, configuration),
    dependencyInsight: (cwd: string, dependency: string, configuration?: string) => ipcRenderer.invoke('gradle:dependency-insight', cwd, dependency, configuration)
  },

  go: {
    detect: (cwd: string) => ipcRenderer.invoke('go:detect', cwd),
    list: (cwd: string) => ipcRenderer.invoke('go:list', cwd),
    search: (query: string, cwd?: string) => ipcRenderer.invoke('go:search', query, cwd),
    versions: (modulePath: string, cwd?: string) => ipcRenderer.invoke('go:versions', modulePath, cwd),
    install: (args: GoInstallArgs) => ipcRenderer.invoke('go:install', args),
    uninstall: (args: GoPackageArgs) => ipcRenderer.invoke('go:uninstall', args),
    update: (args: { modulePath?: string; cwd: string }) => ipcRenderer.invoke('go:update', args),
    tidy: (cwd: string) => ipcRenderer.invoke('go:tidy', cwd),
    graph: (cwd: string) => ipcRenderer.invoke('go:graph', cwd),
    audit: (cwd: string) => ipcRenderer.invoke('go:audit', cwd),
    run: (cwd: string, commandLine: string) => ipcRenderer.invoke('go:run', cwd, commandLine)
  },

  flutter: {
    detect: (cwd: string) => ipcRenderer.invoke('flutter:detect', cwd),
    read: (cwd: string) => ipcRenderer.invoke('flutter:read', cwd),
    list: (cwd: string) => ipcRenderer.invoke('flutter:list', cwd),
    assets: (cwd: string) => ipcRenderer.invoke('flutter:assets', cwd),
    search: (query: string) => ipcRenderer.invoke('flutter:search', query),
    versions: (packageName: string) => ipcRenderer.invoke('flutter:versions', packageName),
    addDependency: (args: FlutterDependencyArgs) => ipcRenderer.invoke('flutter:add-dependency', args),
    updateDependency: (args: { cwd: string; packageName?: string; type?: FlutterDependencyType }) => ipcRenderer.invoke('flutter:update-dependency', args),
    removeDependency: (args: { cwd: string; packageName: string; type?: FlutterDependencyType }) => ipcRenderer.invoke('flutter:remove-dependency', args),
    outdated: (cwd: string) => ipcRenderer.invoke('flutter:outdated', cwd),
    deps: (cwd: string) => ipcRenderer.invoke('flutter:deps', cwd),
    dependencyTree: (cwd: string) => ipcRenderer.invoke('flutter:dependency-tree', cwd),
    get: (cwd: string) => ipcRenderer.invoke('flutter:get', cwd),
    run: (cwd: string, commandLine: string) => ipcRenderer.invoke('flutter:run', cwd, commandLine),
    addAsset: (args: { cwd: string; path: string }) => ipcRenderer.invoke('flutter:add-asset', args),
    removeAsset: (args: { cwd: string; path: string }) => ipcRenderer.invoke('flutter:remove-asset', args),
    checkPublish: (cwd: string) => ipcRenderer.invoke('flutter:check-publish', cwd),
    publish: (args: FlutterPublishArgs) => ipcRenderer.invoke('flutter:publish', args),
    securityAudit: (cwd: string) => ipcRenderer.invoke('flutter:security-audit', cwd)
  },

  native: {
    detect: (cwd: string) => ipcRenderer.invoke('native:detect', cwd),
    list: (cwd: string) => ipcRenderer.invoke('native:list', cwd),
    search: (query: string) => ipcRenderer.invoke('native:search', query),
    install: (args: NativeInstallArgs) => ipcRenderer.invoke('native:install', args),
    uninstall: (args: NativeRemoveArgs) => ipcRenderer.invoke('native:uninstall', args),
    run: (args: NativeRunArgs) => ipcRenderer.invoke('native:run', args),
    configure: (cwd: string, buildDir?: string) => ipcRenderer.invoke('native:configure', cwd, buildDir),
    build: (cwd: string, buildDir?: string) => ipcRenderer.invoke('native:build', cwd, buildDir)
  },

  managers: {
    descriptors: () => ipcRenderer.invoke('manager:descriptors'),
    diagnostics: () => ipcRenderer.invoke('manager:diagnostics'),
    detected: (cwd: string) => ipcRenderer.invoke('manager:detected', cwd),
    inventory: (cwd: string, managerId: RegistryDependencyManagerId) => ipcRenderer.invoke('manager:inventory', cwd, managerId),
    plan: (cwd: string, managerId: RegistryDependencyManagerId, request: ManagerOperationRequest) => ipcRenderer.invoke('manager:plan', cwd, managerId, request),
    execute: (cwd: string, managerId: RegistryDependencyManagerId, request: ManagerOperationRequest, options?: ManagerExecuteOptions) => ipcRenderer.invoke('manager:execute', cwd, managerId, request, options),
    runCustom: (cwd: string, managerId: RegistryDependencyManagerId, commandLine: string) => ipcRenderer.invoke('manager:run-custom', cwd, managerId, commandLine),
    search: (cwd: string | undefined, managerId: RegistryDependencyManagerId, query: ManagerSearchQuery) => ipcRenderer.invoke('manager:search', cwd, managerId, query),
    health: (cwd: string, managerId: RegistryDependencyManagerId) => ipcRenderer.invoke('manager:health', cwd, managerId),
    restoreBackup: (cwd: string, backupPath: string) => ipcRenderer.invoke('manager:restore-backup', cwd, backupPath)
  },

  supplyChain: {
    report: (cwd: string) => ipcRenderer.invoke('supply-chain:report', cwd),
    exportCycloneDx: (cwd: string) => ipcRenderer.invoke('supply-chain:export-cyclonedx', cwd),
    exportSpdx: (cwd: string) => ipcRenderer.invoke('supply-chain:export-spdx', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('supply-chain:export-markdown', cwd),
    licenseReport: (cwd: string) => ipcRenderer.invoke('supply-chain:license-report', cwd),
    exportLicenseMarkdown: (cwd: string) => ipcRenderer.invoke('supply-chain:export-license-markdown', cwd),
    exportLicenseJson: (cwd: string) => ipcRenderer.invoke('supply-chain:export-license-json', cwd),
    createSnapshot: (cwd: string) => ipcRenderer.invoke('supply-chain:create-snapshot', cwd),
    listSnapshots: (cwd: string) => ipcRenderer.invoke('supply-chain:list-snapshots', cwd),
    diffLatestSnapshot: (cwd: string) => ipcRenderer.invoke('supply-chain:diff-latest-snapshot', cwd),
    dependencyDiffLatestSnapshot: (cwd: string) => ipcRenderer.invoke('supply-chain:dependency-diff-latest-snapshot', cwd),
    exportDependencyDiffMarkdown: (cwd: string) => ipcRenderer.invoke('supply-chain:export-dependency-diff-markdown', cwd),
    restoreLatestSnapshot: (cwd: string) => ipcRenderer.invoke('supply-chain:restore-latest-snapshot', cwd),
    restoreSnapshot: (cwd: string, snapshotIdOrPath: string) => ipcRenderer.invoke('supply-chain:restore-snapshot', cwd, snapshotIdOrPath),
    ensurePolicy: (cwd: string) => ipcRenderer.invoke('supply-chain:ensure-policy', cwd),
    getPolicy: (cwd: string) => ipcRenderer.invoke('supply-chain:get-policy', cwd),
    savePolicy: (cwd: string, policy: DependencyPolicy) => ipcRenderer.invoke('supply-chain:save-policy', cwd, policy),
    evaluatePolicy: (cwd: string) => ipcRenderer.invoke('supply-chain:evaluate-policy', cwd)
  },

  thirdPartyNotices: {
    report: (cwd: string) => ipcRenderer.invoke('third-party-notices:report', cwd),
    exportText: (cwd: string) => ipcRenderer.invoke('third-party-notices:export-text', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('third-party-notices:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('third-party-notices:export-json', cwd)
  },

  operationHistory: {
    list: (cwd: string, limit?: number) => ipcRenderer.invoke('operation-history:list', cwd, limit),
    exportReport: (cwd: string, format?: 'json' | 'markdown') => ipcRenderer.invoke('operation-history:export', cwd, format)
  },

  ciEvidence: {
    list: (cwd: string, limit?: number) => ipcRenderer.invoke('ci-evidence:list', cwd, limit),
    record: (cwd: string, input: CiEvidenceInput) => ipcRenderer.invoke('ci-evidence:record', cwd, input),
    importFromFile: (cwd: string, filePath: string, overrides?: Partial<CiEvidenceInput>) => ipcRenderer.invoke('ci-evidence:import-file', cwd, filePath, overrides),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('ci-evidence:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('ci-evidence:export-json', cwd)
  },

  auditEvidence: {
    report: (cwd: string) => ipcRenderer.invoke('audit-evidence:report', cwd),
    importFromFile: (cwd: string, filePath: string, options?: AuditEvidenceImportOptions) => ipcRenderer.invoke('audit-evidence:import-file', cwd, filePath, options),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('audit-evidence:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('audit-evidence:export-json', cwd),
    exportHtml: (cwd: string) => ipcRenderer.invoke('audit-evidence:export-html', cwd)
  },

  vulnerabilityRemediationPlan: {
    plan: (cwd: string) => ipcRenderer.invoke('vulnerability-remediation-plan:plan', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('vulnerability-remediation-plan:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('vulnerability-remediation-plan:export-json', cwd)
  },

  releaseApproval: {
    list: (cwd: string, limit?: number) => ipcRenderer.invoke('release-approval:list', cwd, limit),
    record: (cwd: string, input: ReleaseApprovalInput) => ipcRenderer.invoke('release-approval:record', cwd, input),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-approval:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-approval:export-json', cwd)
  },

  releaseException: {
    list: (cwd: string, limit?: number) => ipcRenderer.invoke('release-exception:list', cwd, limit),
    record: (cwd: string, input: ReleaseExceptionInput) => ipcRenderer.invoke('release-exception:record', cwd, input),
    revoke: (cwd: string, id: string, input?: Partial<Pick<ReleaseExceptionInput, 'reviewer' | 'reason' | 'annotations'>>) => ipcRenderer.invoke('release-exception:revoke', cwd, id, input),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-exception:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-exception:export-json', cwd)
  },

  registryReachability: {
    discover: (cwd: string) => ipcRenderer.invoke('registry-reachability:discover', cwd),
    check: (cwd: string, options?: RegistryReachabilityOptions) => ipcRenderer.invoke('registry-reachability:check', cwd, options),
    exportMarkdown: (cwd: string, options?: RegistryReachabilityOptions) => ipcRenderer.invoke('registry-reachability:export-markdown', cwd, options),
    exportJson: (cwd: string, options?: RegistryReachabilityOptions) => ipcRenderer.invoke('registry-reachability:export-json', cwd, options)
  },

  credentialUsage: {
    report: (cwd: string) => ipcRenderer.invoke('credential-usage:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('credential-usage:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('credential-usage:export-json', cwd)
  },

  lockfileDrift: {
    report: (cwd: string) => ipcRenderer.invoke('lockfile-drift:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('lockfile-drift:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('lockfile-drift:export-json', cwd)
  },

  runtimePinning: {
    report: (cwd: string) => ipcRenderer.invoke('runtime-pinning:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('runtime-pinning:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('runtime-pinning:export-json', cwd)
  },

  offlineCacheReadiness: {
    report: (cwd: string) => ipcRenderer.invoke('offline-cache-readiness:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('offline-cache-readiness:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('offline-cache-readiness:export-json', cwd)
  },

  releaseRiskProfile: {
    report: (cwd: string) => ipcRenderer.invoke('release-risk-profile:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-risk-profile:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-risk-profile:export-json', cwd)
  },

  ciIntegrationPlan: {
    plan: (cwd: string) => ipcRenderer.invoke('ci-integration-plan:plan', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('ci-integration-plan:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('ci-integration-plan:export-json', cwd),
    exportGithubActions: (cwd: string) => ipcRenderer.invoke('ci-integration-plan:export-github-actions', cwd)
  },

  dependencyAutomationPlan: {
    plan: (cwd: string) => ipcRenderer.invoke('dependency-automation-plan:plan', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-automation-plan:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-automation-plan:export-json', cwd),
    exportDependabot: (cwd: string) => ipcRenderer.invoke('dependency-automation-plan:export-dependabot', cwd),
    exportRenovate: (cwd: string) => ipcRenderer.invoke('dependency-automation-plan:export-renovate', cwd)
  },

  credentialRotationPlan: {
    plan: (cwd: string) => ipcRenderer.invoke('credential-rotation-plan:plan', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('credential-rotation-plan:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('credential-rotation-plan:export-json', cwd)
  },

  automationSafetyPlan: {
    plan: (cwd: string) => ipcRenderer.invoke('automation-safety-plan:plan', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('automation-safety-plan:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('automation-safety-plan:export-json', cwd)
  },

  dependencyOwnershipPlan: {
    plan: (cwd: string) => ipcRenderer.invoke('dependency-ownership-plan:plan', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-ownership-plan:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-ownership-plan:export-json', cwd),
    exportCodeowners: (cwd: string) => ipcRenderer.invoke('dependency-ownership-plan:export-codeowners', cwd)
  },

  dependencyUpgradePlaybook: {
    report: (cwd: string) => ipcRenderer.invoke('dependency-upgrade-playbook:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-upgrade-playbook:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-upgrade-playbook:export-json', cwd)
  },

  dependencyRollbackPlan: {
    report: (cwd: string) => ipcRenderer.invoke('dependency-rollback-plan:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-rollback-plan:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-rollback-plan:export-json', cwd)
  },

  dependencyImpactAnalysis: {
    report: (cwd: string) => ipcRenderer.invoke('dependency-impact-analysis:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-impact-analysis:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-impact-analysis:export-json', cwd)
  },

  dependencyChangeApprovalPacket: {
    report: (cwd: string) => ipcRenderer.invoke('dependency-change-approval-packet:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-change-approval-packet:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-change-approval-packet:export-json', cwd)
  },

  dependencyChangeCalendar: {
    report: (cwd: string) => ipcRenderer.invoke('dependency-change-calendar:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-change-calendar:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-change-calendar:export-json', cwd),
    exportIcs: (cwd: string) => ipcRenderer.invoke('dependency-change-calendar:export-ics', cwd),
    exportFreezeGate: (cwd: string) => ipcRenderer.invoke('dependency-change-calendar:export-freeze-gate', cwd),
    exportTicketTemplate: (cwd: string) => ipcRenderer.invoke('dependency-change-calendar:export-ticket-template', cwd)
  },

  dependencyChangeExecutionRecord: {
    report: (cwd: string) => ipcRenderer.invoke('dependency-change-execution-record:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('dependency-change-execution-record:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('dependency-change-execution-record:export-json', cwd)
  },

  policyAsCodePack: {
    report: (cwd: string) => ipcRenderer.invoke('policy-as-code-pack:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('policy-as-code-pack:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('policy-as-code-pack:export-json', cwd),
    exportPolicyJson: (cwd: string) => ipcRenderer.invoke('policy-as-code-pack:export-policy-json', cwd),
    exportGithubActions: (cwd: string) => ipcRenderer.invoke('policy-as-code-pack:export-github-actions', cwd)
  },

  workspaceDiscovery: {
    report: (cwd: string) => ipcRenderer.invoke('workspace-discovery:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('workspace-discovery:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('workspace-discovery:export-json', cwd)
  },

  workspaceGovernance: {
    report: (cwd: string) => ipcRenderer.invoke('workspace-governance:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-json', cwd),
    exportEvidenceMarkdown: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-evidence-markdown', cwd),
    exportEvidenceJson: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-evidence-json', cwd),
    remediationPlan: (cwd: string) => ipcRenderer.invoke('workspace-governance:remediation-plan', cwd),
    exportRemediationMarkdown: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-remediation-markdown', cwd),
    exportRemediationJson: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-remediation-json', cwd),
    updatePlan: (cwd: string) => ipcRenderer.invoke('workspace-governance:update-plan', cwd),
    exportUpdatePlanMarkdown: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-update-plan-markdown', cwd),
    exportUpdatePlanJson: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-update-plan-json', cwd),
    exportWorkspaceSboms: (cwd: string, format: WorkspaceSbomExportFormat) => ipcRenderer.invoke('workspace-governance:export-workspace-sboms', cwd, format),
    exportReleaseBundle: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-release-bundle', cwd),
    exportReleaseDashboard: (cwd: string) => ipcRenderer.invoke('workspace-governance:export-release-dashboard', cwd)
  },

  dependencyHealthDashboard: {
    exportHtml: (cwd: string) => ipcRenderer.invoke('dependency-health-dashboard:export-html', cwd)
  },

  reportArtifacts: {
    report: (cwd: string) => ipcRenderer.invoke('report-artifacts:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('report-artifacts:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('report-artifacts:export-json', cwd)
  },

  releaseEvidenceCompleteness: {
    report: (cwd: string) => ipcRenderer.invoke('release-evidence-completeness:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-evidence-completeness:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-evidence-completeness:export-json', cwd)
  },

  releaseProvenanceAttestation: {
    report: (cwd: string) => ipcRenderer.invoke('release-provenance-attestation:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-provenance-attestation:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-provenance-attestation:export-json', cwd)
  },

  releaseIntegrityVerification: {
    report: (cwd: string) => ipcRenderer.invoke('release-integrity-verification:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-integrity-verification:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-integrity-verification:export-json', cwd)
  },

  releaseSignature: {
    report: (cwd: string) => ipcRenderer.invoke('release-signature:report', cwd),
    verify: (cwd: string) => ipcRenderer.invoke('release-signature:verify', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-signature:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-signature:export-json', cwd)
  },

  releaseTrustPolicy: {
    report: (cwd: string) => ipcRenderer.invoke('release-trust-policy:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('release-trust-policy:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('release-trust-policy:export-json', cwd)
  },

  frameworkCoverage: {
    report: (cwd?: string) => ipcRenderer.invoke('framework-coverage:report', cwd),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('framework-coverage:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('framework-coverage:export-json', cwd)
  },

  readiness: {
    report: (cwd: string) => ipcRenderer.invoke('readiness:report', cwd),
    ensurePolicy: (cwd: string) => ipcRenderer.invoke('readiness:ensure-policy', cwd),
    getPolicy: (cwd: string) => ipcRenderer.invoke('readiness:get-policy', cwd),
    savePolicy: (cwd: string, policy: ReadinessPolicy) => ipcRenderer.invoke('readiness:save-policy', cwd, policy),
    exportMarkdown: (cwd: string) => ipcRenderer.invoke('readiness:export-markdown', cwd),
    exportJson: (cwd: string) => ipcRenderer.invoke('readiness:export-json', cwd)
  },

  credentials: {
    status: () => ipcRenderer.invoke('credentials:status'),
    list: (filter?: CredentialFilter) => ipcRenderer.invoke('credentials:list', filter),
    save: (input: CredentialInput) => ipcRenderer.invoke('credentials:save', input),
    delete: (id: string) => ipcRenderer.invoke('credentials:delete', id)
  },

  dependencyHealth: {
    scan: (manager: DependencyHealthManager, cwd: string) => ipcRenderer.invoke('dependency-health:scan', manager, cwd),
    fix: (cwd: string, action: DependencyHealthAction) => ipcRenderer.invoke('dependency-health:fix', cwd, action)
  },

  terminal: {
    create: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id)
  },
  
  watcher: {
    start: (projectPath: string) => ipcRenderer.invoke('watch:start', projectPath),
    stop: (projectPath?: string) => ipcRenderer.invoke('watch:stop', projectPath),
    onChange: (callback: (data: any) => void) => {
      ipcRenderer.on('file-change', (_, data) => callback(data))
    },
    removeChangeListener: () => {
      ipcRenderer.removeAllListeners('file-change')
    }
  },
  
  project: {
    detect: (projectPath: string) => ipcRenderer.invoke('project:detect', projectPath),
    readPackage: (projectPath: string) => ipcRenderer.invoke('project:read-package', projectPath),
    inventory: (projectPath: string) => ipcRenderer.invoke('project:inventory', projectPath),
    exportInventory: (projectPath: string) => ipcRenderer.invoke('project:export-inventory', projectPath),
    writePackage: (projectPath: string, content: any) => ipcRenderer.invoke('project:write-package', projectPath, content),
    getPackagePath: (projectPath: string) => ipcRenderer.invoke('project:get-package-path', projectPath),
    getNodeModulesPath: (projectPath: string, packageName: string) => ipcRenderer.invoke('project:get-node-modules-path', projectPath, packageName),
    toolchain: {
      get: (projectPath: string) => ipcRenderer.invoke('project:toolchain-get', projectPath),
      set: (projectPath: string, tool: ToolName, toolPath: string) => ipcRenderer.invoke('project:toolchain-set', projectPath, tool, toolPath),
      clear: (projectPath: string, tool: ToolName) => ipcRenderer.invoke('project:toolchain-clear', projectPath, tool),
      check: (projectPath: string) => ipcRenderer.invoke('project:toolchain-check', projectPath)
    }
  },
  
  publish: {
    check: (projectPath: string) => ipcRenderer.invoke('publish:check', projectPath),
    publish: (args: PublishArgs) => ipcRenderer.invoke('publish:publish', args)
  },
  
  system: {
    openPath: (path: string) => ipcRenderer.invoke('system:open-path', path),
    openFile: (filePath: string) => ipcRenderer.invoke('system:open-file', filePath),
    getNpmInfo: () => ipcRenderer.invoke('system:get-npm-info'),
    getCachePath: () => ipcRenderer.invoke('system:get-cache-path'),
    setCachePath: (newPath: string) => ipcRenderer.invoke('system:set-cache-path', newPath),
    clearCache: () => ipcRenderer.invoke('system:clear-cache'),
    updateNpm: () => ipcRenderer.invoke('system:update-npm'),
    npmHelp: (command?: string) => ipcRenderer.invoke('system:npm-help', command),
    checkTools: () => ipcRenderer.invoke('system:check-tools'),
    setToolPath: (tool: ToolName, toolPath: string) => ipcRenderer.invoke('system:set-tool-path', tool, toolPath),
    openToolDownload: (tool: ToolName) => ipcRenderer.invoke('system:open-tool-download', tool),
    openTerminal: (cwd: string) => ipcRenderer.invoke('npm:open-terminal', cwd)
  },
  
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url)
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
