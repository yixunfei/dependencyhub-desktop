declare global {
  interface Window {
    electronAPI: {
      app: {
        getStartupLanguage: () => Promise<StartupLanguageInfo>
        setMenuLanguage: (language: AppLanguage) => Promise<void>
      }

      getDefaultPath: () => Promise<string>
      selectDirectory: () => Promise<string | null>
      selectFile: (options?: FileSelectOptions) => Promise<string | null>
      
      npm: {
        search: (query: string, limit?: number) => Promise<any[]>
        view: (packageName: string) => Promise<any>
        install: (args: InstallArgs) => Promise<string>
        uninstall: (args: UninstallArgs) => Promise<string>
        update: (args: UpdateArgs) => Promise<string>
        outdated: (cwd: string) => Promise<any>
        list: (cwd: string, global: boolean) => Promise<any>
        configList: () => Promise<any>
        configSet: (key: string, value: string) => Promise<void>
        configGet: (key: string) => Promise<string>
        configDelete: (key: string) => Promise<void>
        configEdit: () => Promise<void>
        whoami: () => Promise<string>
        login: (registry?: string) => Promise<void>
        logout: (registry?: string) => Promise<void>
        runScript: (cwd: string, script: string) => Promise<string>
        getScripts: (cwd: string) => Promise<string[]>
        moveDep: (args: MoveDepArgs) => Promise<string>
        getPublished: (username: string) => Promise<any[]>
        checkAllOutdated: (cwd: string) => Promise<any>
        getPackageInfo: (packageName: string) => Promise<any>
        getVersions: (packageName: string) => Promise<string[]>
        getVersionMetadata: (packageName: string) => Promise<NpmVersionMetadata>
        installVersion: (args: InstallVersionArgs) => Promise<string>
        globalOutdated: () => Promise<any>
        adduser: (registry?: string) => Promise<void>
        getRegistryInfo: (registry?: string) => Promise<any>
        getPackageSize: (packageName: string, version?: string) => Promise<PackageSizeInfo>
        getDependencyTree: (packageName: string, version?: string, depth?: number) => Promise<DependencyTreeNode>
        audit: (cwd: string) => Promise<AuditResult>
        globalAudit: () => Promise<AuditResult>
        auditFix: (cwd: string) => Promise<string>
        getReadme: (packageName: string) => Promise<string>
        getDependents: (packageName: string) => Promise<number>
        downloadStats: (packageName: string) => Promise<DownloadStats>
        getProjectDependencyTree: (cwd: string, depth?: number) => Promise<any>
        getGlobalDependencyTree: (depth?: number) => Promise<any>
      }

      pip: {
        list: (options?: string | PipCommandOptions) => Promise<PipPackageInfo[]>
        outdated: (options?: string | PipCommandOptions) => Promise<PipPackageInfo[]>
        install: (args: PipInstallArgs) => Promise<string>
        uninstall: (args: PipPackageArgs) => Promise<string>
        update: (args: PipPackageArgs) => Promise<string>
        updateAll: (args?: PipCommandOptions) => Promise<{ success: number; failed: number; output: string }>
        freeze: (cwd?: string) => Promise<string>
        exportRequirements: (cwd: string) => Promise<void>
        readRequirements: (cwd: string) => Promise<string[]>
        search: (query: string, cwd?: string) => Promise<PipSearchResult[]>
        versions: (packageName: string) => Promise<string[]>
        show: (packageName: string, cwd?: string) => Promise<PipPackageDetail | null>
        check: (cwd?: string) => Promise<string>
        repairCheck: (cwd?: string) => Promise<PipRepairResult>
        configList: (scope?: PipConfigScope) => Promise<PipConfigItem[]>
        configFile: (scope?: PipConfigScope) => Promise<string>
        backupConfig: (scope?: PipConfigScope) => Promise<string>
        configSet: (scope: PipConfigScope, key: string, value: string) => Promise<void>
        configUnset: (scope: PipConfigScope, key: string) => Promise<void>
        cacheDir: () => Promise<string>
        cachePurge: () => Promise<string>
        audit: (cwd?: string) => Promise<{ issues: PipAuditIssue[]; raw: string; error?: string }>
        installTool: (tool: 'pip-audit' | 'pipdeptree', cwd?: string) => Promise<string>
        dependencyTree: (cwd?: string) => Promise<PipDependencyTreeNode[]>
        publish: (args: PipPublishArgs) => Promise<string>
      }

      maven: {
        detect: (cwd: string) => Promise<{ hasPom: boolean; path: string }>
        list: (cwd: string) => Promise<MavenDependencyInfo[]>
        tree: (cwd: string) => Promise<string>
        dependencyTree: (cwd: string) => Promise<MavenDependencyTreeNode | null>
        runGoal: (cwd: string, goal: string) => Promise<string>
        search: (query: string, cwd?: string, options?: MavenSearchOptions) => Promise<MavenSearchResult[]>
        versions: (groupId: string, artifactId: string) => Promise<string[]>
        info: (cwd?: string) => Promise<MavenGlobalInfo>
        effectiveSettings: (cwd?: string) => Promise<string>
        ensureSettings: () => Promise<string>
        backupSettings: () => Promise<string>
        setLocalRepository: (repositoryPath: string) => Promise<void>
        setMirror: (id: string, url: string, mirrorOf?: string) => Promise<void>
        setServer: (id: string, username: string, password: string) => Promise<void>
        setSecureServer: (id: string, username: string, password: string) => Promise<CredentialMetadata>
        deploy: (args: MavenDeployArgs) => Promise<string>
        securityAudit: (cwd: string) => Promise<{ issues: MavenAuditIssue[]; reportPath: string; raw?: string; error?: string }>
        goOffline: (cwd: string) => Promise<string>
        purgeLocalRepository: (cwd: string) => Promise<string>
        addDependency: (cwd: string, dep: MavenDependencyInfo) => Promise<void>
        removeDependency: (cwd: string, dep: Pick<MavenDependencyInfo, 'groupId' | 'artifactId'>) => Promise<void>
      }

      plugins: {
        catalog: (projectPath?: string) => Promise<PackageManagerPlugin[]>
        setEnabled: (id: PackageManagerId, enabled: boolean, projectPath?: string) => Promise<PackageManagerPlugin[]>
        detected: (projectPath: string) => Promise<PackageManagerId[]>
      }

      cargo: {
        detect: (cwd: string) => Promise<{ hasCargoToml: boolean; path: string }>
        list: (cwd: string) => Promise<CargoDependencyInfo[]>
        search: (query: string) => Promise<CargoSearchResult[]>
        versions: (packageName: string) => Promise<string[]>
        install: (args: CargoInstallArgs) => Promise<string>
        uninstall: (args: CargoPackageArgs) => Promise<string>
        update: (args: { packageName?: string; cwd: string }) => Promise<string>
        tree: (cwd: string) => Promise<string>
        audit: (cwd: string) => Promise<{ raw: string; error?: string }>
        run: (cwd: string, commandLine: string) => Promise<string>
      }

      gradle: {
        detect: (cwd: string) => Promise<{ hasGradleBuild: boolean; path: string }>
        list: (cwd: string) => Promise<GradleDependencyInfo[]>
        search: (query: string, options?: MavenSearchOptions) => Promise<GradleSearchResult[]>
        versions: (groupId: string, artifactId: string) => Promise<string[]>
        addDependency: (args: GradleDependencyArgs) => Promise<void>
        updateDependency: (args: GradleDependencyArgs) => Promise<void>
        removeDependency: (args: GradleRemoveDependencyArgs) => Promise<void>
        runTask: (cwd: string, taskLine: string) => Promise<string>
        tasks: (cwd: string) => Promise<string>
        dependencyTree: (cwd: string, configuration?: string) => Promise<string>
        dependencyInsight: (cwd: string, dependency: string, configuration?: string) => Promise<string>
      }

      go: {
        detect: (cwd: string) => Promise<{ hasGoMod: boolean; path: string }>
        list: (cwd: string) => Promise<GoModuleInfo[]>
        search: (query: string, cwd?: string) => Promise<GoModuleInfo[]>
        versions: (modulePath: string, cwd?: string) => Promise<string[]>
        install: (args: GoInstallArgs) => Promise<string>
        uninstall: (args: GoPackageArgs) => Promise<string>
        update: (args: { modulePath?: string; cwd: string }) => Promise<string>
        tidy: (cwd: string) => Promise<string>
        graph: (cwd: string) => Promise<string>
        audit: (cwd: string) => Promise<{ raw: string; error?: string }>
        run: (cwd: string, commandLine: string) => Promise<string>
      }

      flutter: {
        detect: (cwd: string) => Promise<{ hasPubspec: boolean; path: string }>
        read: (cwd: string) => Promise<FlutterPubspecInfo>
        list: (cwd: string) => Promise<FlutterDependencyInfo[]>
        assets: (cwd: string) => Promise<FlutterAssetInfo[]>
        search: (query: string) => Promise<FlutterSearchResult[]>
        versions: (packageName: string) => Promise<string[]>
        addDependency: (args: FlutterDependencyArgs) => Promise<string>
        updateDependency: (args: { cwd: string; packageName?: string; type?: FlutterDependencyType }) => Promise<string>
        removeDependency: (args: { cwd: string; packageName: string; type?: FlutterDependencyType }) => Promise<string>
        outdated: (cwd: string) => Promise<FlutterOutdatedResult>
        deps: (cwd: string) => Promise<string>
        dependencyTree: (cwd: string) => Promise<FlutterDependencyTreeNode>
        get: (cwd: string) => Promise<string>
        run: (cwd: string, commandLine: string) => Promise<string>
        addAsset: (args: { cwd: string; path: string }) => Promise<void>
        removeAsset: (args: { cwd: string; path: string }) => Promise<void>
        checkPublish: (cwd: string) => Promise<FlutterPublishCheckResult>
        publish: (args: FlutterPublishArgs) => Promise<string>
        securityAudit: (cwd: string) => Promise<FlutterSecurityAuditResult>
      }

      native: {
        detect: (cwd: string) => Promise<NativeDetectResult>
        list: (cwd: string) => Promise<NativeDependencyInfo[]>
        search: (query: string) => Promise<NativeDependencyInfo[]>
        install: (args: NativeInstallArgs) => Promise<string>
        uninstall: (args: NativeRemoveArgs) => Promise<string>
        run: (args: NativeRunArgs) => Promise<string>
        configure: (cwd: string, buildDir?: string) => Promise<string>
        build: (cwd: string, buildDir?: string) => Promise<string>
      }

      extended: {
        detected: (cwd: string) => Promise<ExtendedManagerDetection[]>
        list: (cwd: string, managerId: DependencyManagerId) => Promise<ExtendedDependencyInfo[]>
        plan: (cwd: string, managerId: DependencyManagerId, request: ExtendedManagerOperationRequest) => Promise<ExtendedManagerOperationPlan>
        run: (cwd: string, managerId: DependencyManagerId, commandLine: string) => Promise<ExtendedManagerCommandResult>
        restoreBackup: (cwd: string, backupPath: string) => Promise<ExtendedManagerRestoreResult>
      }

      supplyChain: {
        report: (cwd: string) => Promise<SupplyChainReport>
        exportCycloneDx: (cwd: string) => Promise<SupplyChainExportResult>
        exportSpdx: (cwd: string) => Promise<SupplyChainExportResult>
        exportMarkdown: (cwd: string) => Promise<SupplyChainExportResult>
        licenseReport: (cwd: string) => Promise<LicenseComplianceReport>
        exportLicenseMarkdown: (cwd: string) => Promise<LicenseComplianceExportResult>
        exportLicenseJson: (cwd: string) => Promise<LicenseComplianceExportResult>
        createSnapshot: (cwd: string) => Promise<SupplyChainSnapshotResult>
        listSnapshots: (cwd: string) => Promise<SupplyChainSnapshotSummary[]>
        diffLatestSnapshot: (cwd: string) => Promise<SupplyChainSnapshotDiff | null>
        dependencyDiffLatestSnapshot: (cwd: string) => Promise<DependencyComponentDiff | null>
        exportDependencyDiffMarkdown: (cwd: string) => Promise<DependencyDiffExportResult>
        restoreLatestSnapshot: (cwd: string) => Promise<SupplyChainSnapshotRestoreResult | null>
        restoreSnapshot: (cwd: string, snapshotIdOrPath: string) => Promise<SupplyChainSnapshotRestoreResult>
        ensurePolicy: (cwd: string) => Promise<string>
        getPolicy: (cwd: string) => Promise<DependencyPolicyFile>
        savePolicy: (cwd: string, policy: DependencyPolicy) => Promise<DependencyPolicyFile>
        evaluatePolicy: (cwd: string) => Promise<DependencyPolicyEvaluation>
      }

      thirdPartyNotices: {
        report: (cwd: string) => Promise<ThirdPartyNoticesReport>
        exportText: (cwd: string) => Promise<ThirdPartyNoticesExportResult>
        exportMarkdown: (cwd: string) => Promise<ThirdPartyNoticesExportResult>
        exportJson: (cwd: string) => Promise<ThirdPartyNoticesExportResult>
      }

      operationHistory: {
        list: (cwd: string, limit?: number) => Promise<OperationHistoryRecord[]>
        exportReport: (cwd: string, format?: OperationHistoryExportFormat) => Promise<OperationHistoryExportResult>
      }

      ciEvidence: {
        list: (cwd: string, limit?: number) => Promise<CiEvidenceRecord[]>
        record: (cwd: string, input: CiEvidenceInput) => Promise<CiEvidenceRecord>
        importFromFile: (cwd: string, filePath: string, overrides?: Partial<CiEvidenceInput>) => Promise<CiEvidenceImportResult>
        exportMarkdown: (cwd: string) => Promise<CiEvidenceExportResult>
        exportJson: (cwd: string) => Promise<CiEvidenceExportResult>
      }

      auditEvidence: {
        report: (cwd: string) => Promise<AuditEvidenceReport>
        importFromFile: (cwd: string, filePath: string, options?: AuditEvidenceImportOptions) => Promise<AuditEvidenceImportResult>
        exportMarkdown: (cwd: string) => Promise<AuditEvidenceExportResult>
        exportJson: (cwd: string) => Promise<AuditEvidenceExportResult>
        exportHtml: (cwd: string) => Promise<AuditEvidenceExportResult>
      }

      vulnerabilityRemediationPlan: {
        plan: (cwd: string) => Promise<VulnerabilityRemediationPlanReport>
        exportMarkdown: (cwd: string) => Promise<VulnerabilityRemediationPlanExportResult>
        exportJson: (cwd: string) => Promise<VulnerabilityRemediationPlanExportResult>
      }

      releaseApproval: {
        list: (cwd: string, limit?: number) => Promise<ReleaseApprovalRecord[]>
        record: (cwd: string, input: ReleaseApprovalInput) => Promise<ReleaseApprovalRecord>
        exportMarkdown: (cwd: string) => Promise<ReleaseApprovalExportResult>
        exportJson: (cwd: string) => Promise<ReleaseApprovalExportResult>
      }

      releaseException: {
        list: (cwd: string, limit?: number) => Promise<ReleaseExceptionRecord[]>
        record: (cwd: string, input: ReleaseExceptionInput) => Promise<ReleaseExceptionRecord>
        revoke: (cwd: string, id: string, input?: Partial<Pick<ReleaseExceptionInput, 'reviewer' | 'reason' | 'annotations'>>) => Promise<ReleaseExceptionRecord>
        exportMarkdown: (cwd: string) => Promise<ReleaseExceptionExportResult>
        exportJson: (cwd: string) => Promise<ReleaseExceptionExportResult>
      }

      registryReachability: {
        discover: (cwd: string) => Promise<RegistryEndpoint[]>
        check: (cwd: string, options?: RegistryReachabilityOptions) => Promise<RegistryReachabilityReport>
        exportMarkdown: (cwd: string, options?: RegistryReachabilityOptions) => Promise<RegistryReachabilityExportResult>
        exportJson: (cwd: string, options?: RegistryReachabilityOptions) => Promise<RegistryReachabilityExportResult>
      }

      credentialUsage: {
        report: (cwd: string) => Promise<CredentialUsageReport>
        exportMarkdown: (cwd: string) => Promise<CredentialUsageExportResult>
        exportJson: (cwd: string) => Promise<CredentialUsageExportResult>
      }

      lockfileDrift: {
        report: (cwd: string) => Promise<LockfileDriftReport>
        exportMarkdown: (cwd: string) => Promise<LockfileDriftExportResult>
        exportJson: (cwd: string) => Promise<LockfileDriftExportResult>
      }

      runtimePinning: {
        report: (cwd: string) => Promise<RuntimePinningReport>
        exportMarkdown: (cwd: string) => Promise<RuntimePinningExportResult>
        exportJson: (cwd: string) => Promise<RuntimePinningExportResult>
      }

      offlineCacheReadiness: {
        report: (cwd: string) => Promise<OfflineCacheReadinessReport>
        exportMarkdown: (cwd: string) => Promise<OfflineCacheReadinessExportResult>
        exportJson: (cwd: string) => Promise<OfflineCacheReadinessExportResult>
      }

      releaseRiskProfile: {
        report: (cwd: string) => Promise<ReleaseRiskProfileReport>
        exportMarkdown: (cwd: string) => Promise<ReleaseRiskProfileExportResult>
        exportJson: (cwd: string) => Promise<ReleaseRiskProfileExportResult>
      }

      ciIntegrationPlan: {
        plan: (cwd: string) => Promise<CiIntegrationPlanReport>
        exportMarkdown: (cwd: string) => Promise<CiIntegrationPlanExportResult>
        exportJson: (cwd: string) => Promise<CiIntegrationPlanExportResult>
        exportGithubActions: (cwd: string) => Promise<CiIntegrationPlanExportResult>
      }

      dependencyAutomationPlan: {
        plan: (cwd: string) => Promise<DependencyAutomationPlanReport>
        exportMarkdown: (cwd: string) => Promise<DependencyAutomationPlanExportResult>
        exportJson: (cwd: string) => Promise<DependencyAutomationPlanExportResult>
        exportDependabot: (cwd: string) => Promise<DependencyAutomationPlanExportResult>
        exportRenovate: (cwd: string) => Promise<DependencyAutomationPlanExportResult>
      }

      credentialRotationPlan: {
        plan: (cwd: string) => Promise<CredentialRotationPlanReport>
        exportMarkdown: (cwd: string) => Promise<CredentialRotationPlanExportResult>
        exportJson: (cwd: string) => Promise<CredentialRotationPlanExportResult>
      }

      automationSafetyPlan: {
        plan: (cwd: string) => Promise<AutomationSafetyPlanReport>
        exportMarkdown: (cwd: string) => Promise<AutomationSafetyPlanExportResult>
        exportJson: (cwd: string) => Promise<AutomationSafetyPlanExportResult>
      }

      dependencyOwnershipPlan: {
        plan: (cwd: string) => Promise<DependencyOwnershipPlanReport>
        exportMarkdown: (cwd: string) => Promise<DependencyOwnershipPlanExportResult>
        exportJson: (cwd: string) => Promise<DependencyOwnershipPlanExportResult>
        exportCodeowners: (cwd: string) => Promise<DependencyOwnershipPlanExportResult>
      }

      dependencyUpgradePlaybook: {
        report: (cwd: string) => Promise<DependencyUpgradePlaybookReport>
        exportMarkdown: (cwd: string) => Promise<DependencyUpgradePlaybookExportResult>
        exportJson: (cwd: string) => Promise<DependencyUpgradePlaybookExportResult>
      }

      dependencyRollbackPlan: {
        report: (cwd: string) => Promise<DependencyRollbackPlanReport>
        exportMarkdown: (cwd: string) => Promise<DependencyRollbackPlanExportResult>
        exportJson: (cwd: string) => Promise<DependencyRollbackPlanExportResult>
      }

      dependencyImpactAnalysis: {
        report: (cwd: string) => Promise<DependencyImpactAnalysisReport>
        exportMarkdown: (cwd: string) => Promise<DependencyImpactAnalysisExportResult>
        exportJson: (cwd: string) => Promise<DependencyImpactAnalysisExportResult>
      }

      dependencyChangeApprovalPacket: {
        report: (cwd: string) => Promise<DependencyChangeApprovalPacketReport>
        exportMarkdown: (cwd: string) => Promise<DependencyChangeApprovalPacketExportResult>
        exportJson: (cwd: string) => Promise<DependencyChangeApprovalPacketExportResult>
      }

      dependencyChangeCalendar: {
        report: (cwd: string) => Promise<DependencyChangeCalendarReport>
        exportMarkdown: (cwd: string) => Promise<DependencyChangeCalendarExportResult>
        exportJson: (cwd: string) => Promise<DependencyChangeCalendarExportResult>
        exportIcs: (cwd: string) => Promise<DependencyChangeCalendarExportResult>
        exportFreezeGate: (cwd: string) => Promise<DependencyChangeCalendarExportResult>
        exportTicketTemplate: (cwd: string) => Promise<DependencyChangeCalendarExportResult>
      }

      dependencyChangeExecutionRecord: {
        report: (cwd: string) => Promise<DependencyChangeExecutionReport>
        exportMarkdown: (cwd: string) => Promise<DependencyChangeExecutionExportResult>
        exportJson: (cwd: string) => Promise<DependencyChangeExecutionExportResult>
      }

      policyAsCodePack: {
        report: (cwd: string) => Promise<PolicyAsCodeReport>
        exportMarkdown: (cwd: string) => Promise<PolicyAsCodeExportResult>
        exportJson: (cwd: string) => Promise<PolicyAsCodeExportResult>
        exportPolicyJson: (cwd: string) => Promise<PolicyAsCodeExportResult>
        exportGithubActions: (cwd: string) => Promise<PolicyAsCodeExportResult>
      }

      workspaceDiscovery: {
        report: (cwd: string) => Promise<WorkspaceDiscoveryReport>
        exportMarkdown: (cwd: string) => Promise<WorkspaceDiscoveryExportResult>
        exportJson: (cwd: string) => Promise<WorkspaceDiscoveryExportResult>
      }

      workspaceGovernance: {
        report: (cwd: string) => Promise<WorkspaceGovernanceReport>
        exportMarkdown: (cwd: string) => Promise<WorkspaceGovernanceExportResult>
        exportJson: (cwd: string) => Promise<WorkspaceGovernanceExportResult>
        exportEvidenceMarkdown: (cwd: string) => Promise<WorkspaceReleaseEvidenceExportResult>
        exportEvidenceJson: (cwd: string) => Promise<WorkspaceReleaseEvidenceExportResult>
        remediationPlan: (cwd: string) => Promise<WorkspaceRemediationPlan>
        exportRemediationMarkdown: (cwd: string) => Promise<WorkspaceRemediationPlanExportResult>
        exportRemediationJson: (cwd: string) => Promise<WorkspaceRemediationPlanExportResult>
        updatePlan: (cwd: string) => Promise<WorkspaceUpdatePlan>
        exportUpdatePlanMarkdown: (cwd: string) => Promise<WorkspaceUpdatePlanExportResult>
        exportUpdatePlanJson: (cwd: string) => Promise<WorkspaceUpdatePlanExportResult>
        exportWorkspaceSboms: (cwd: string, format: WorkspaceSbomExportFormat) => Promise<WorkspaceSbomExportResult>
        exportReleaseBundle: (cwd: string) => Promise<ReleaseBundleExportResult>
        exportReleaseDashboard: (cwd: string) => Promise<ReleaseDashboardExportResult>
      }

      dependencyHealthDashboard: {
        exportHtml: (cwd: string) => Promise<DependencyHealthDashboardExportResult>
      }

      reportArtifacts: {
        report: (cwd: string) => Promise<ReportArtifactIndexReport>
        exportMarkdown: (cwd: string) => Promise<ReportArtifactIndexExportResult>
        exportJson: (cwd: string) => Promise<ReportArtifactIndexExportResult>
      }

      releaseEvidenceCompleteness: {
        report: (cwd: string) => Promise<ReleaseEvidenceCompletenessReport>
        exportMarkdown: (cwd: string) => Promise<ReleaseEvidenceCompletenessExportResult>
        exportJson: (cwd: string) => Promise<ReleaseEvidenceCompletenessExportResult>
      }

      releaseProvenanceAttestation: {
        report: (cwd: string) => Promise<ReleaseProvenanceAttestationReport>
        exportMarkdown: (cwd: string) => Promise<ReleaseProvenanceAttestationExportResult>
        exportJson: (cwd: string) => Promise<ReleaseProvenanceAttestationExportResult>
      }

      releaseIntegrityVerification: {
        report: (cwd: string) => Promise<ReleaseIntegrityVerificationReport>
        exportMarkdown: (cwd: string) => Promise<ReleaseIntegrityVerificationExportResult>
        exportJson: (cwd: string) => Promise<ReleaseIntegrityVerificationExportResult>
      }

      releaseSignature: {
        report: (cwd: string) => Promise<ReleaseSignatureReport>
        verify: (cwd: string) => Promise<ReleaseSignatureReport>
        exportMarkdown: (cwd: string) => Promise<ReleaseSignatureExportResult>
        exportJson: (cwd: string) => Promise<ReleaseSignatureExportResult>
      }

      releaseTrustPolicy: {
        report: (cwd: string) => Promise<ReleaseTrustPolicyReport>
        exportMarkdown: (cwd: string) => Promise<ReleaseTrustPolicyExportResult>
        exportJson: (cwd: string) => Promise<ReleaseTrustPolicyExportResult>
      }

      frameworkCoverage: {
        report: (cwd?: string) => Promise<FrameworkCoverageReport>
        exportMarkdown: (cwd: string) => Promise<FrameworkCoverageExportResult>
        exportJson: (cwd: string) => Promise<FrameworkCoverageExportResult>
      }

      readiness: {
        report: (cwd: string) => Promise<ReadinessGateReport>
        ensurePolicy: (cwd: string) => Promise<string>
        getPolicy: (cwd: string) => Promise<ReadinessPolicyFile>
        savePolicy: (cwd: string, policy: Partial<ReadinessPolicy>) => Promise<ReadinessPolicyFile>
        exportMarkdown: (cwd: string) => Promise<ReadinessGateExportResult>
        exportJson: (cwd: string) => Promise<ReadinessGateExportResult>
      }

      credentials: {
        status: () => Promise<CredentialVaultStatus>
        list: (filter?: CredentialFilter) => Promise<CredentialMetadata[]>
        save: (input: CredentialInput) => Promise<CredentialMetadata>
        delete: (id: string) => Promise<boolean>
      }

      dependencyHealth: {
        scan: (manager: DependencyHealthManager, cwd: string) => Promise<DependencyHealthScanResult>
        fix: (cwd: string, action: DependencyHealthAction) => Promise<string>
      }

      terminal: {
        create: (cwd?: string) => Promise<TerminalSessionInfo>
        write: (id: string, data: string) => Promise<void>
        kill: (id: string) => Promise<void>
      }
      
      watcher: {
        start: (projectPath: string) => Promise<void>
        stop: (projectPath?: string) => Promise<void>
        onChange: (callback: (data: FileChangeData) => void) => void
        removeChangeListener: () => void
      }
      
      project: {
        detect: (projectPath: string) => Promise<ProjectInfo>
        readPackage: (projectPath: string) => Promise<any>
        inventory: (projectPath: string) => Promise<ProjectInventory>
        exportInventory: (projectPath: string) => Promise<string>
        writePackage: (projectPath: string, content: any) => Promise<void>
        getPackagePath: (projectPath: string) => Promise<string>
        getNodeModulesPath: (projectPath: string, packageName: string) => Promise<string>
        toolchain: {
          get: (projectPath: string) => Promise<ToolchainConfig>
          set: (projectPath: string, tool: ToolName, toolPath: string) => Promise<ToolchainConfig>
          clear: (projectPath: string, tool: ToolName) => Promise<ToolchainConfig>
          check: (projectPath: string) => Promise<ToolStatus[]>
        }
      }
      
      publish: {
        check: (projectPath: string) => Promise<any>
        publish: (args: PublishArgs) => Promise<string>
      }
      
      system: {
        openPath: (path: string) => Promise<void>
        openFile: (filePath: string) => Promise<void>
        getNpmInfo: () => Promise<any>
        getCachePath: () => Promise<string>
        setCachePath: (newPath: string) => Promise<void>
        clearCache: () => Promise<string>
        updateNpm: () => Promise<string>
        npmHelp: (command?: string) => Promise<string>
        checkTools: () => Promise<ToolStatus[]>
        setToolPath: (tool: ToolName, toolPath: string) => Promise<ToolStatus[]>
        openToolDownload: (tool: ToolName) => Promise<void>
        openTerminal: (cwd: string) => Promise<void>
      }
      
      openExternal: (url: string) => Promise<void>
      
      onCommandLog: (callback: (data: CommandLogEntry) => void) => void
      removeCommandLogListener: () => void
      onTerminalData: (callback: (data: TerminalData) => void) => void
      onTerminalExit: (callback: (data: TerminalExitData) => void) => void
      removeTerminalListeners: () => void
    }
  }
  
  interface CommandLogEntry {
    id: string
    timestamp: number
    command: string
    output?: string
    error?: string
    status: 'running' | 'success' | 'error'
  }
  
  interface PackageSizeInfo {
    unpackedSize: number
    fileCount: number
    packedSize: string | number
    prettySize: string
  }
  
  interface DependencyTreeNode {
    name: string
    version: string
    dependencies: DependencyTreeNode[]
  }
  
  interface AuditResult {
    vulnerabilities?: Record<string, any>
    error?: string
    metadata?: {
      vulnerabilities: {
        info: number
        low: number
        moderate: number
        high: number
        critical: number
      }
      dependencies: number
      devDependencies: number
    }
  }
  
  interface DownloadStats {
    downloads: number
    start?: string
    end?: string
    package?: string
  }

  interface NpmVersionInfo {
    version: string
    date?: string
    tags: string[]
    prerelease: boolean
    channel: string
  }

  interface NpmVersionMetadata {
    name: string
    description: string
    distTags: Record<string, string>
    versions: NpmVersionInfo[]
    stable: NpmVersionInfo[]
    prerelease: NpmVersionInfo[]
    latest: string
  }

  interface PipPackageInfo {
    name: string
    version: string
    latest?: string
    type?: string
  }

  interface PipPackageDetail {
    name: string
    version: string
    summary?: string
    homePage?: string
    author?: string
    license?: string
    location?: string
    requires?: string
    requiredBy?: string
  }

  interface PipDependencyTreeNode {
    name: string
    version: string
    dependencies: PipDependencyTreeNode[]
  }

  interface PipRepairResult {
    checkedOutput: string
    actions: string[]
    success: number
    failed: number
    output: string
  }

  interface PipPublishArgs {
    cwd: string
    repositoryUrl?: string
    username?: string
    password?: string
    credentialId?: string
    buildBefore?: boolean
    overrideReadinessGate?: boolean
  }

  interface PipInstallArgs {
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

  interface PipPackageArgs {
    packageName: string
    cwd?: string
    user?: boolean
    version?: string
    breakSystemPackages?: boolean
  }

  interface PipCommandOptions {
    cwd?: string
    user?: boolean
    breakSystemPackages?: boolean
  }

  type PipConfigScope = 'user' | 'global' | 'site'

  interface PipConfigItem {
    key: string
    value: string
  }

  interface PipSearchResult {
    name: string
    version?: string
    description?: string
  }

  interface PipAuditIssue {
    name: string
    version: string
    id: string
    fixVersions: string[]
    description: string
    aliases?: string[]
  }

  interface MavenDependencyInfo {
    groupId: string
    artifactId: string
    version: string
    scope?: string
    type?: string
  }

  interface MavenSearchResult extends MavenDependencyInfo {
    latestVersion?: string
    description?: string
    repository?: string
  }

  type MavenSearchMode = 'startsWith' | 'contains' | 'exact' | 'keyword'
  type MavenSearchScope = 'artifactId' | 'groupId' | 'coordinate' | 'all'
  type MavenSearchSource = 'mavenCentral' | 'nexus'

  interface MavenSearchOptions {
    mode?: MavenSearchMode
    scope?: MavenSearchScope
    source?: MavenSearchSource
    customUrl?: string
    includeLocal?: boolean
    limit?: number
  }

  interface MavenDependencyTreeNode extends MavenDependencyInfo {
    name: string
    dependencies: MavenDependencyTreeNode[]
  }

  interface MavenGlobalInfo {
    version: string
    localRepository: string
    settingsPath: string
    hasSettings: boolean
  }

  interface MavenAuditIssue {
    dependency: string
    fileName?: string
    severity: string
    name: string
    description: string
    url?: string
  }

  interface MavenDeployArgs {
    cwd: string
    repositoryId?: string
    repositoryUrl?: string
    skipTests?: boolean
    goals?: string
    overrideReadinessGate?: boolean
  }

  type CredentialKind = 'token' | 'password' | 'username-password' | 'api-key' | 'other'
  type CredentialStorage = 'electron-safe-storage' | 'base64-fallback' | 'test-adapter'

  interface CredentialInput {
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

  interface CredentialFilter {
    managerId?: DependencyManagerId
    service?: string
  }

  interface CredentialMetadata {
    id: string
    managerId: DependencyManagerId
    service: string
    account?: string
    label: string
    kind: CredentialKind
    url?: string
    notes?: string
    secretPreview: string
    storage: CredentialStorage
    encrypted: boolean
    createdAt: string
    updatedAt: string
    lastUsedAt?: string
  }

  interface CredentialVaultStatus {
    available: boolean
    encrypted: boolean
    storage: CredentialStorage
    warning?: string
  }

  interface TerminalSessionInfo {
    id: string
    cwd: string
    shell: string
  }

  interface TerminalData {
    id: string
    data: string
    stream: 'stdout' | 'stderr'
  }

  interface TerminalExitData {
    id: string
    code: number | null
  }

  type ToolName =
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
    | 'rscript'
    | 'julia'
    | 'maven'
    | 'gradle'
    | 'sbt'
    | 'lein'
    | 'cargo'
    | 'go'
    | 'flutter'
    | 'dotnet'
    | 'composer'
    | 'ruby'
    | 'bundle'
    | 'mix'
    | 'rebar3'
    | 'cabal'
    | 'stack'
    | 'swift'
    | 'pod'
    | 'helm'
    | 'docker'
    | 'kustomize'
    | 'helmfile'
    | 'skaffold'
    | 'argocd'
    | 'flux'
    | 'terraform'
    | 'tofu'
    | 'ansible-galaxy'
    | 'gh'
    | 'glab'
    | 'pre-commit'
    | 'bazel'
    | 'pants'
    | 'buck2'
    | 'opam'
    | 'cpanm'
    | 'luarocks'
    | 'shards'
    | 'zig'
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
  type PackageManagerId = 'npm' | 'pip' | 'maven' | 'cargo' | 'gradle' | 'go' | 'flutter' | 'native'
  type DependencyHealthManager = PackageManagerId
  type DependencyHealthSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
  type DependencyHealthIssueType =
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
  type AppLanguage = 'zh-CN' | 'en-US'

  interface StartupLanguageInfo {
    language: AppLanguage
    source: 'installer' | 'default'
    shouldPrompt: boolean
    isPackaged: boolean
    isPortable: boolean
  }

  interface ToolStatus {
    tool: ToolName
    available: boolean
    version: string
    configuredPath?: string
    downloadUrl: string
    message?: string
  }

  interface ToolchainConfig {
    npm?: string
    pnpm?: string
    yarn?: string
    bun?: string
    deno?: string
    pip?: string
    uv?: string
    poetry?: string
    pipenv?: string
    conda?: string
    rscript?: string
    julia?: string
    maven?: string
    gradle?: string
    sbt?: string
    lein?: string
    cargo?: string
    cabal?: string
    stack?: string
    go?: string
    flutter?: string
    dotnet?: string
    composer?: string
    ruby?: string
    bundle?: string
    mix?: string
    rebar3?: string
    swift?: string
    pod?: string
    helm?: string
    docker?: string
    kustomize?: string
    helmfile?: string
    skaffold?: string
    argocd?: string
    flux?: string
    terraform?: string
    tofu?: string
    'ansible-galaxy'?: string
    gh?: string
    glab?: string
    'pre-commit'?: string
    bazel?: string
    pants?: string
    buck2?: string
    opam?: string
    cpanm?: string
    luarocks?: string
    shards?: string
    zig?: string
    brew?: string
    choco?: string
    scoop?: string
    winget?: string
    asdf?: string
    mise?: string
    sdk?: string
    'apt-get'?: string
    dnf?: string
    apk?: string
    pacman?: string
    nix?: string
    cmake?: string
    vcpkg?: string
    conan?: string
  }

  interface PackageManagerPlugin {
    id: PackageManagerId
    name: string
    language: string
    packageManager: string
    tools: ToolName[]
    manifestFiles: string[]
    lockFiles: string[]
    capabilities: string[]
    scenarios: string[]
    builtIn: boolean
    enabled: boolean
    detected: boolean
    available: boolean
    version?: string
    configuredPath?: string
    message?: string
  }

  type FuturePackageManagerId =
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
  type DependencyManagerId = PackageManagerId | FuturePackageManagerId
  type ManagerImplementationStatus = 'stable' | 'preview' | 'planned'
  type ManagerScope = 'project' | 'environment' | 'global' | 'repository' | 'publish'
  type ManagerCapability =
    | 'search'
    | 'install'
    | 'uninstall'
    | 'update'
    | 'batch-update'
    | 'version-switch'
    | 'dependency-tree'
    | 'health'
    | 'audit'
    | 'publish'
    | 'scripts'
    | 'tasks'
    | 'toolchain'
    | 'registry-config'
    | 'cache'
    | 'lockfile'
    | 'assets'
    | 'build'
    | 'sbom'
    | 'license-policy'
    | 'container-scan'

  interface ProjectManagerDetection {
    id: DependencyManagerId
    name: string
    language: string
    packageManager: string
    implemented: boolean
    status: ManagerImplementationStatus
    route?: string
    detected: boolean
    files: string[]
    capabilities: ManagerCapability[]
  }

  interface ProjectInfo {
    path: string
    name: string
    version: string
    hasPackageJson: boolean
    hasRequirementsTxt: boolean
    hasPomXml: boolean
    hasCargoToml: boolean
    hasGradleBuild: boolean
    hasGoMod: boolean
    hasPubspecYaml: boolean
    hasNativeProject: boolean
    ecosystems: string[]
    detectedManagers: ProjectManagerDetection[]
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown'
  }

  interface ProjectInventoryFile {
    managerId: DependencyManagerId
    role: 'manifest' | 'lock' | 'config'
    file: string
    path: string
    size: number
    modifiedAt: string
  }

  interface ProjectInventory {
    generatedAt: string
    project: ProjectInfo
    managers: ProjectManagerDetection[]
    files: ProjectInventoryFile[]
    productionTools: Array<{
      managerId: DependencyManagerId
      name: string
      implemented: boolean
      tools: readonly string[]
      productionTools: readonly string[]
    }>
  }

  interface CargoDependencyInfo {
    name: string
    version: string
    type: 'dependencies' | 'dev-dependencies' | 'build-dependencies'
    source?: string
    optional?: boolean
  }

  interface CargoSearchResult {
    name: string
    version?: string
    description?: string
  }

  interface CargoInstallArgs {
    packageName: string
    version?: string
    cwd: string
    type?: CargoDependencyInfo['type']
    features?: string
  }

  interface CargoPackageArgs {
    packageName: string
    cwd: string
    type?: CargoDependencyInfo['type']
  }

  interface GradleDependencyInfo {
    groupId: string
    artifactId: string
    version: string
    configuration: string
  }

  interface GradleSearchResult extends GradleDependencyInfo {
    latestVersion?: string
    description?: string
    repository?: string
  }

  interface GradleDependencyArgs extends GradleDependencyInfo {
    cwd: string
  }

  interface GradleRemoveDependencyArgs {
    cwd: string
    groupId: string
    artifactId: string
    configuration?: string
  }

  interface GoModuleInfo {
    path: string
    version: string
    latest?: string
    indirect?: boolean
    replace?: string
    description?: string
    repositoryUrl?: string
    stars?: number
  }

  interface GoInstallArgs {
    modulePath: string
    version?: string
    cwd: string
  }

  interface GoPackageArgs {
    modulePath: string
    cwd: string
  }

  type FlutterDependencyType = 'dependencies' | 'dev_dependencies' | 'dependency_overrides'
  type FlutterDependencySource = 'hosted' | 'sdk' | 'path' | 'git'

  interface FlutterDependencyInfo {
    name: string
    version: string
    type: FlutterDependencyType
    source?: FlutterDependencySource
    sdk?: string
    path?: string
    git?: string
  }

  interface FlutterAssetInfo {
    path: string
    kind: 'file' | 'directory' | 'unknown'
  }

  interface FlutterDependencyTreeNode {
    name: string
    version?: string
    type?: string
    source?: string
    dependencies: FlutterDependencyTreeNode[]
  }

  interface FlutterPubspecInfo {
    hasPubspec: boolean
    path: string
    name: string
    version: string
    description: string
    publishTo?: string
    environmentSdk?: string
    dependencies: FlutterDependencyInfo[]
    assets: FlutterAssetInfo[]
  }

  interface FlutterSearchResult {
    name: string
    version?: string
    description?: string
    popularity?: number
    likes?: number
    pubPoints?: number
  }

  interface FlutterDependencyArgs {
    cwd: string
    packageName: string
    version?: string
    type?: FlutterDependencyType
    source?: FlutterDependencySource
    sdk?: string
    path?: string
    git?: string
  }

  interface FlutterPublishArgs {
    cwd: string
    dryRun?: boolean
    force?: boolean
    server?: string
    overrideReadinessGate?: boolean
  }

  interface FlutterPublishCheckResult {
    canPublish: boolean
    errors: string[]
    warnings: string[]
    packageInfo: FlutterPubspecInfo | null
  }

  interface FlutterOutdatedVersion {
    version?: string
  }

  interface FlutterOutdatedPackage {
    package?: string
    name?: string
    current?: FlutterOutdatedVersion
    upgradable?: FlutterOutdatedVersion
    resolvable?: FlutterOutdatedVersion
    latest?: FlutterOutdatedVersion
  }

  interface FlutterOutdatedResult {
    packages?: FlutterOutdatedPackage[] | Record<string, FlutterOutdatedPackage>
    error?: string
  }

  interface FlutterSecurityIssue {
    packageName: string
    version: string
    dependencyType?: string
    source?: string
    id: string
    summary: string
    details?: string
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown'
    aliases: string[]
    published?: string
    modified?: string
    affectedRange?: string
    fixedVersion?: string
    references: Array<{ type?: string; url: string }>
    url: string
  }

  interface FlutterSecurityAuditResult {
    scannedAt: string
    source: 'pubspec.lock' | 'pubspec.yaml'
    dependencyCount: number
    vulnerableCount: number
    skipped: string[]
    issues: FlutterSecurityIssue[]
    error?: string
  }

  interface NativeDetectResult {
    hasNativeProject: boolean
    hasCMakeLists: boolean
    hasVcpkgManifest: boolean
    hasConanfile: boolean
    cmakePath: string
    vcpkgPath: string
    conanfilePath: string
  }

  type NativeDependencyManager = 'vcpkg' | 'conan' | 'cmake' | 'library'
  type NativeLibraryKind = 'shared' | 'static' | 'import' | 'framework'

  interface NativeDependencyInfo {
    name: string
    version?: string
    manager: NativeDependencyManager
    source?: string
    kind?: NativeLibraryKind
    path?: string
    linkage?: 'dynamic' | 'static' | 'unknown'
    requiredBy?: string
  }

  interface NativeInstallArgs {
    cwd: string
    manager: 'vcpkg' | 'conan'
    name: string
    version?: string
    feature?: string
  }

  interface NativeRemoveArgs {
    cwd: string
    manager: 'vcpkg' | 'conan'
    name: string
  }

  interface NativeRunArgs {
    cwd: string
    tool: 'cmake' | 'vcpkg' | 'conan'
    commandLine: string
  }

  interface ExtendedManagerDetection {
    id: DependencyManagerId
    name: string
    language: string
    packageManager: string
    implemented: boolean
    detected: boolean
    files: string[]
    tools: readonly string[]
    route?: string
  }

  interface ExtendedDependencyInfo {
    managerId: DependencyManagerId
    name: string
    version?: string
    type: string
    source?: string
    file: string
  }

  type ExtendedManagerOperation =
    | 'sync'
    | 'install'
    | 'remove'
    | 'update'
    | 'outdated'
    | 'audit'
    | 'tree'
    | 'list'
    | 'lock'

  interface ExtendedManagerOperationRequest {
    operation: ExtendedManagerOperation
    packageName?: string
    version?: string
    dev?: boolean
  }

  interface ExtendedManagerOperationPlan {
    managerId: DependencyManagerId
    managerName: string
    operation: ExtendedManagerOperation
    tool: ToolName
    command: string
    args: string[]
    mutating: boolean
    dryRunSupported: boolean
    dryRunCommand?: string
    backupFiles: ExtendedManagerBackupFile[]
    warnings: string[]
    requirements: string[]
    generatedAt: string
  }

  interface ExtendedManagerCommandResult {
    command: string
    stdout: string
    stderr: string
    backup?: ExtendedManagerBackup
  }

  interface ExtendedManagerBackupFile {
    file: string
    hash: string
    size: number
  }

  interface ExtendedManagerBackup {
    id: string
    managerId: DependencyManagerId
    projectPath: string
    createdAt: string
    mutating: boolean
    path: string
    files: ExtendedManagerBackupFile[]
  }

  interface ExtendedManagerRestoreResult {
    backupPath: string
    restoredCount: number
    restoredFiles: string[]
  }

  interface SupplyChainComponent {
    managerId: DependencyManagerId
    ecosystem: string
    name: string
    version?: string
    scope: string
    sourceFile: string
    packageUrl?: string
    license?: string
  }

  interface SupplyChainReport {
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

  interface SupplyChainExportResult {
    path: string
    format: 'cyclonedx' | 'spdx' | 'markdown'
    componentCount: number
  }

  interface SupplyChainSnapshotResult {
    id: string
    createdAt: string
    reason?: string
    source?: SupplyChainSnapshotSource
    path: string
    files: Array<{
      file: string
      hash: string
      size: number
    }>
  }

  interface SupplyChainSnapshotSummary {
    id: string
    createdAt: string
    reason?: string
    source?: SupplyChainSnapshotSource
    path: string
    projectPath: string
    fileCount: number
  }

  type SupplyChainSnapshotSource = 'manual' | 'mutation' | 'restore'

  interface SupplyChainSnapshotRestoreResult {
    snapshotId: string
    snapshotPath: string
    restoredCount: number
    restoredFiles: string[]
    preRestoreSnapshot: SupplyChainSnapshotResult
  }

  interface SupplyChainSnapshotDiff {
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

  type DependencyChangeKind = 'added' | 'removed' | 'updated' | 'unchanged'
  type DependencyRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

  interface DependencyComponentChange {
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

  interface DependencyComponentDiffSummary {
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

  interface DependencyComponentDiff {
    fromSnapshotId: string
    fromSnapshotCreatedAt: string
    comparedAt: string
    projectPath: string
    beforeComponentCount: number
    afterComponentCount: number
    summary: DependencyComponentDiffSummary
    changes: DependencyComponentChange[]
  }

  interface DependencyDiffExportResult {
    path: string
    format: 'markdown'
    changeCount: number
    summary: DependencyComponentDiffSummary
  }

  interface DependencyPolicy {
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

  interface DependencyPolicyPackageRule {
    id: string
    description?: string
    packagePatterns: string[]
    managers?: DependencyManagerId[]
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
    blocked?: boolean
    requirePinnedVersions?: boolean
    disallowPrerelease?: boolean
    requireKnownLicenses?: boolean
    allowedLicenses?: string[]
    blockedLicenses?: string[]
  }

  interface DependencyPolicyFile {
    path: string
    policy: DependencyPolicy
  }

  interface DependencyPolicyViolation {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    managerId?: DependencyManagerId
    packageName?: string
    version?: string
    title: string
    description: string
    recommendation: string
  }

  interface DependencyPolicyEvaluation {
    policyPath: string
    generatedAt: string
    componentCount: number
    violationCount: number
    violations: DependencyPolicyViolation[]
  }

  type LicenseComplianceStatus = 'allowed' | 'blocked' | 'not-allowed' | 'unknown' | 'unrestricted'
  type LicenseComplianceExportFormat = 'markdown' | 'json'

  interface LicenseCompliancePolicySnapshot {
    path: string
    requireKnownLicenses: boolean
    allowedLicenses: string[]
    blockedLicenses: string[]
  }

  interface LicenseComplianceComponent extends SupplyChainComponent {
    licenses: string[]
    normalizedLicenses: string[]
    status: LicenseComplianceStatus
    policyViolation: boolean
    reasons: string[]
    recommendation: string
  }

  interface LicenseComplianceLicenseEntry {
    license: string
    normalizedLicense: string
    status: LicenseComplianceStatus
    componentCount: number
    managers: DependencyManagerId[]
    packages: string[]
    sources: string[]
  }

  interface LicenseComplianceSummary {
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

  interface LicenseComplianceReport {
    generatedAt: string
    projectPath: string
    policy: LicenseCompliancePolicySnapshot
    summary: LicenseComplianceSummary
    licenses: LicenseComplianceLicenseEntry[]
    components: LicenseComplianceComponent[]
  }

  interface LicenseComplianceExportResult {
    path: string
    format: LicenseComplianceExportFormat
    generatedAt: string
    componentCount: number
    licenseCount: number
    summary: LicenseComplianceSummary
  }

  type ThirdPartyNoticeFormat = 'text' | 'markdown' | 'json'

  interface ThirdPartyNoticeEntry {
    id: string
    managerId: DependencyManagerId
    ecosystem: string
    name: string
    version?: string
    scope: string
    sourceFile: string
    packageUrl?: string
    licenses: string[]
    normalizedLicenses: string[]
    licenseExpression: string
    status: LicenseComplianceStatus
    policyViolation: boolean
    reasons: string[]
    recommendation: string
    licenseTextIncluded: boolean
    licenseTextNote: string
    notice: string
  }

  interface ThirdPartyNoticesSummary {
    componentCount: number
    noticeCount: number
    knownLicenseComponentCount: number
    unknownLicenseComponentCount: number
    distinctLicenseCount: number
    policyViolationCount: number
    managerCount: number
    blockedLicenseComponentCount: number
    notAllowedLicenseComponentCount: number
  }

  interface ThirdPartyNoticesReport {
    generatedAt: string
    projectPath: string
    policy: LicenseCompliancePolicySnapshot
    summary: ThirdPartyNoticesSummary
    licenses: LicenseComplianceLicenseEntry[]
    entries: ThirdPartyNoticeEntry[]
    sources: {
      licenseCompliance: {
        generatedAt: string
        summary: LicenseComplianceSummary
      }
    }
  }

  interface ThirdPartyNoticesExportResult {
    path: string
    format: ThirdPartyNoticeFormat
    generatedAt: string
    noticeCount: number
    componentCount: number
    count: number
    summary: ThirdPartyNoticesSummary
  }

  type OperationHistoryStatus = 'success' | 'error'
  type OperationHistoryOperationKind =
    | 'install'
    | 'uninstall'
    | 'update'
    | 'sync'
    | 'audit'
    | 'tree'
    | 'list'
    | 'search'
    | 'outdated'
    | 'publish'
    | 'config'
    | 'cache'
    | 'build'
    | 'test'
    | 'run'
    | 'clean'
    | 'lock'
    | 'login'
    | 'toolchain'
    | 'restore'
    | 'info'
    | 'unknown'
  type OperationHistoryRisk =
    | 'read-only'
    | 'project-change'
    | 'environment-change'
    | 'publish'
    | 'credential'
    | 'build-artifact'
    | 'cache-change'
    | 'unknown'
  type OperationHistoryScope =
    | 'project'
    | 'global'
    | 'environment'
    | 'repository'
    | 'publish'
    | 'cache'
    | 'unknown'
  type OperationHistoryExportFormat = 'json' | 'markdown'

  interface OperationHistoryClassification {
    tool: string
    managerId?: DependencyManagerId
    managerName?: string
    ecosystem?: string
    operation: OperationHistoryOperationKind
    mutating: boolean
    scope: OperationHistoryScope
    risk: OperationHistoryRisk
    summary: string
  }

  interface OperationHistorySummary {
    total: number
    success: number
    error: number
    mutating: number
    readOnly: number
    byManager: Record<string, number>
    byOperation: Record<string, number>
  }

  interface OperationHistoryExportResult {
    path: string
    format: OperationHistoryExportFormat
    count: number
    generatedAt: string
    summary: OperationHistorySummary
  }

  interface OperationHistoryRecord {
    id: string
    command: string
    cwd: string
    status: OperationHistoryStatus
    startedAt: string
    finishedAt: string
    durationMs: number
    stdout?: string
    stderr?: string
    error?: string
    classification?: OperationHistoryClassification
    summary?: string
  }

  interface FileSelectOptions {
    title?: string
    filters?: Array<{
      name: string
      extensions: string[]
    }>
  }

  type CiEvidenceStatus = 'success' | 'failed' | 'cancelled' | 'unknown'
  type CiEvidenceSource = 'manual' | 'json' | 'junit' | 'github-actions' | 'generic'
  type CiEvidenceExportFormat = 'markdown' | 'json'

  interface CiEvidenceInput {
    source?: CiEvidenceSource
    provider?: string
    workflow?: string
    job?: string
    status: CiEvidenceStatus
    branch?: string
    commit?: string
    url?: string
    runId?: string
    startedAt?: string
    finishedAt?: string
    durationMs?: number
    totalTests?: number
    passedTests?: number
    failedTests?: number
    skippedTests?: number
    summary?: string
    annotations?: string[]
    rawFile?: string
  }

  interface CiEvidenceRecord {
    id: string
    source: CiEvidenceSource
    provider?: string
    workflow?: string
    job?: string
    status: CiEvidenceStatus
    branch?: string
    commit?: string
    url?: string
    runId?: string
    startedAt?: string
    finishedAt: string
    importedAt: string
    durationMs?: number
    totalTests?: number
    passedTests?: number
    failedTests?: number
    skippedTests?: number
    summary?: string
    annotations: string[]
    rawFile?: string
  }

  interface CiEvidenceSummary {
    total: number
    success: number
    failed: number
    cancelled: number
    unknown: number
    latest?: CiEvidenceRecord
    latestSuccessful?: CiEvidenceRecord
    latestFailed?: CiEvidenceRecord
  }

  interface CiEvidenceImportResult {
    path: string
    importedAt: string
    records: CiEvidenceRecord[]
    summary: CiEvidenceSummary
  }

  interface CiEvidenceExportResult {
    path: string
    format: CiEvidenceExportFormat
    generatedAt: string
    count: number
    summary: CiEvidenceSummary
  }

  type AuditEvidenceTool =
    | 'npm-audit'
    | 'pip-audit'
    | 'osv'
    | 'sarif'
    | 'cargo-audit'
    | 'trivy'
    | 'govulncheck'
    | 'generic'
  type AuditEvidenceSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown'
  type AuditEvidenceExportFormat = 'markdown' | 'json' | 'html'

  interface AuditEvidenceImportOptions {
    tool?: AuditEvidenceTool
    managerId?: DependencyManagerId
    workspaceRelativePath?: string
    sourceName?: string
  }

  interface AuditEvidenceSourceRecord {
    id: string
    tool: AuditEvidenceTool
    sourceName: string
    path: string
    importedAt: string
    contentHash: string
    findingCount: number
    managerIds: DependencyManagerId[]
    workspaceRelativePath?: string
  }

  interface AuditEvidenceFinding {
    id: string
    tool: AuditEvidenceTool
    severity: AuditEvidenceSeverity
    vulnerabilityId?: string
    aliases: string[]
    packageName?: string
    installedVersion?: string
    fixedVersion?: string
    managerId?: DependencyManagerId
    workspaceRelativePath?: string
    title: string
    summary: string
    recommendation: string
    url?: string
    sourceFile?: string
    rawFile: string
    importedAt: string
    evidence: string[]
  }

  interface AuditEvidenceSummary {
    sourceCount: number
    findingCount: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
    unknown: number
    affectedPackageCount: number
    fixAvailableCount: number
    managerCount: number
    managers: DependencyManagerId[]
    toolCount: number
    tools: AuditEvidenceTool[]
  }

  interface AuditEvidenceReport {
    generatedAt: string
    projectPath: string
    sources: AuditEvidenceSourceRecord[]
    findings: AuditEvidenceFinding[]
    summary: AuditEvidenceSummary
  }

  interface AuditEvidenceImportResult {
    path: string
    importedAt: string
    source: AuditEvidenceSourceRecord
    findings: AuditEvidenceFinding[]
    summary: AuditEvidenceSummary
  }

  interface AuditEvidenceExportResult {
    path: string
    format: AuditEvidenceExportFormat
    generatedAt: string
    count: number
    summary: AuditEvidenceSummary
  }

  type VulnerabilityRemediationPlanExportFormat = 'markdown' | 'json'
  type VulnerabilityRemediationStatus = 'ready' | 'warning' | 'blocked'
  type VulnerabilityRemediationPriority = 'immediate' | 'urgent' | 'scheduled' | 'monitor'

  interface VulnerabilityRemediationItem {
    id: string
    priority: VulnerabilityRemediationPriority
    status: VulnerabilityRemediationStatus
    severity: AuditEvidenceSeverity
    managerId?: DependencyManagerId
    workspaceRelativePath?: string
    packageName?: string
    installedVersion?: string
    fixedVersion?: string
    fixAvailable: boolean
    findingCount: number
    findingIds: string[]
    vulnerabilityIds: string[]
    tools: AuditEvidenceTool[]
    title: string
    summary: string
    recommendation: string
    recommendedCommand: string
    verificationCommand: string
    evidence: string[]
  }

  interface VulnerabilityRemediationPlanSummary {
    status: VulnerabilityRemediationStatus
    itemCount: number
    findingCount: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
    unknown: number
    immediateItemCount: number
    urgentItemCount: number
    scheduledItemCount: number
    monitorItemCount: number
    fixAvailableFindingCount: number
    fixUnavailableFindingCount: number
    fixAvailableItemCount: number
    fixUnavailableItemCount: number
    affectedPackageCount: number
    managerCount: number
    managers: DependencyManagerId[]
    workspaceCount: number
    commandCount: number
  }

  interface VulnerabilityRemediationPlanReport {
    generatedAt: string
    projectPath: string
    status: VulnerabilityRemediationStatus
    summary: VulnerabilityRemediationPlanSummary
    items: VulnerabilityRemediationItem[]
    sources: {
      auditEvidence: {
        generatedAt: string
        summary: AuditEvidenceSummary
      }
      errors: Partial<Record<'audit-evidence', string>>
    }
  }

  interface VulnerabilityRemediationPlanExportResult {
    path: string
    format: VulnerabilityRemediationPlanExportFormat
    generatedAt: string
    status: VulnerabilityRemediationStatus
    itemCount: number
    findingCount: number
    count: number
    summary: VulnerabilityRemediationPlanSummary
  }

  type ReleaseApprovalDecision = 'approved' | 'rejected' | 'revoked'
  type ReleaseApprovalScope = 'release' | 'dependency-change' | 'policy-exception' | 'publish'
  type ReleaseApprovalExportFormat = 'markdown' | 'json'

  interface ReleaseApprovalInput {
    reviewer: string
    decision: ReleaseApprovalDecision
    scope?: ReleaseApprovalScope
    summary?: string
    ticket?: string
    url?: string
    decidedAt?: string
    expiresAt?: string
    annotations?: string[]
  }

  interface ReleaseApprovalRecord {
    id: string
    reviewer: string
    decision: ReleaseApprovalDecision
    scope: ReleaseApprovalScope
    summary?: string
    ticket?: string
    url?: string
    decidedAt: string
    expiresAt?: string
    importedAt: string
    annotations: string[]
  }

  interface ReleaseApprovalSummary {
    total: number
    approved: number
    rejected: number
    revoked: number
    latest?: ReleaseApprovalRecord
    latestApproved?: ReleaseApprovalRecord
    latestRejected?: ReleaseApprovalRecord
  }

  interface ReleaseApprovalExportResult {
    path: string
    format: ReleaseApprovalExportFormat
    generatedAt: string
    count: number
    summary: ReleaseApprovalSummary
  }

  type ReleaseExceptionDecision = 'approved' | 'revoked'
  type ReleaseExceptionScope = 'release' | 'dependency-change' | 'policy-exception' | 'publish'
  type ReleaseExceptionExportFormat = 'markdown' | 'json'

  interface ReleaseExceptionInput {
    reviewer: string
    reason: string
    scope?: ReleaseExceptionScope
    checkIds?: string[]
    ticket?: string
    url?: string
    decidedAt?: string
    expiresAt?: string
    annotations?: string[]
  }

  interface ReleaseExceptionRecord {
    id: string
    reviewer: string
    decision: ReleaseExceptionDecision
    reason: string
    scope: ReleaseExceptionScope
    checkIds: string[]
    ticket?: string
    url?: string
    decidedAt: string
    expiresAt?: string
    importedAt: string
    annotations: string[]
  }

  interface ReleaseExceptionSummary {
    total: number
    approved: number
    revoked: number
    active: number
    expired: number
    latest?: ReleaseExceptionRecord
    latestActive?: ReleaseExceptionRecord
  }

  interface ReleaseExceptionReport {
    generatedAt: string
    projectPath: string
    records: ReleaseExceptionRecord[]
    summary: ReleaseExceptionSummary
  }

  interface ReleaseExceptionExportResult {
    path: string
    format: ReleaseExceptionExportFormat
    generatedAt: string
    count: number
    summary: ReleaseExceptionSummary
  }

  type RegistryEndpointKind = 'registry' | 'mirror' | 'proxy' | 'repository' | 'image-registry'
  type RegistryReachabilityStatus = 'reachable' | 'unreachable' | 'unknown' | 'skipped'
  type RegistryReachabilityExportFormat = 'markdown' | 'json'

  interface RegistryEndpoint {
    id: string
    managerId?: DependencyManagerId
    name: string
    url: string
    normalizedUrl: string
    kind: RegistryEndpointKind
    sourceFile: string
    secure: boolean
    privateHost: boolean
  }

  interface RegistryReachabilityResult extends RegistryEndpoint {
    status: RegistryReachabilityStatus
    checkedAt: string
    durationMs: number
    statusCode?: number
    message?: string
    redirectedUrl?: string
  }

  interface RegistryReachabilitySummary {
    endpointCount: number
    reachable: number
    unreachable: number
    unknown: number
    skipped: number
    insecure: number
    privateHost: number
  }

  interface RegistryReachabilityReport {
    generatedAt: string
    projectPath: string
    endpoints: RegistryEndpoint[]
    results: RegistryReachabilityResult[]
    summary: RegistryReachabilitySummary
  }

  interface RegistryReachabilityExportResult {
    path: string
    format: RegistryReachabilityExportFormat
    generatedAt: string
    summary: RegistryReachabilitySummary
  }

  interface RegistryReachabilityOptions {
    timeoutMs?: number
  }

  type CredentialUsageExportFormat = 'markdown' | 'json'
  type CredentialUsageStatus =
    | 'covered'
    | 'missing'
    | 'weak-match'
    | 'insecure-storage'
    | 'insecure-endpoint'
    | 'public'
  type CredentialUsageMatchType = 'exact-service' | 'exact-url' | 'host' | 'manager'

  interface CredentialUsageMatch {
    id: string
    label: string
    managerId: DependencyManagerId
    service: string
    account?: string
    kind: CredentialKind
    url?: string
    encrypted: boolean
    storage: CredentialStorage
    createdAt: string
    updatedAt: string
    lastUsedAt?: string
    matchType: CredentialUsageMatchType
  }

  interface CredentialUsageEndpoint {
    endpoint: RegistryEndpoint
    requiresCredential: boolean
    status: CredentialUsageStatus
    matches: CredentialUsageMatch[]
    warnings: string[]
    recommendation: string
  }

  interface CredentialUsageUnusedCredential {
    id: string
    label: string
    managerId: DependencyManagerId
    service: string
    account?: string
    kind: CredentialKind
    url?: string
    encrypted: boolean
    storage: CredentialStorage
    createdAt: string
    updatedAt: string
    lastUsedAt?: string
  }

  interface CredentialUsageSummary {
    endpointCount: number
    privateEndpointCount: number
    credentialCount: number
    coveredEndpointCount: number
    missingCredentialEndpointCount: number
    weakMatchEndpointCount: number
    insecureStorageEndpointCount: number
    insecureEndpointCount: number
    publicEndpointCount: number
    unusedCredentialCount: number
    encryptedCredentialCount: number
    unencryptedCredentialCount: number
  }

  interface CredentialUsageReport {
    generatedAt: string
    projectPath: string
    vaultStatus: CredentialVaultStatus
    endpoints: CredentialUsageEndpoint[]
    unusedCredentials: CredentialUsageUnusedCredential[]
    summary: CredentialUsageSummary
  }

  interface CredentialUsageExportResult {
    path: string
    format: CredentialUsageExportFormat
    generatedAt: string
    summary: CredentialUsageSummary
  }

  type LockfileDriftExportFormat = 'markdown' | 'json'
  type LockfileDriftStatus = 'ready' | 'warning' | 'blocked'
  type LockfileDriftSeverity = 'info' | 'warning' | 'blocked'
  type LockfileDriftFindingKind =
    | 'missing-lockfile'
    | 'stale-lockfile'
    | 'mixed-node-lockfiles'
    | 'package-manager-mismatch'
    | 'missing-package-manager-pin'
    | 'orphan-lockfile'
    | 'shared-root-lockfile'

  interface LockfileDriftFile {
    file: string
    path: string
    relativePath: string
    modifiedAt: string
    size: number
  }

  interface LockfileDriftFinding {
    id: string
    kind: LockfileDriftFindingKind
    severity: LockfileDriftSeverity
    managerId?: DependencyManagerId
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface LockfileDriftWorkspace {
    workspace: WorkspaceNode
    status: LockfileDriftStatus
    score: number
    managers: DependencyManagerId[]
    packageManager?: string
    declaredManagerId?: DependencyManagerId
    manifestFiles: LockfileDriftFile[]
    localLockFiles: LockfileDriftFile[]
    inheritedLockFiles: LockfileDriftFile[]
    newestManifestAt?: string
    newestLockfileAt?: string
    findings: LockfileDriftFinding[]
  }

  interface LockfileDriftSummary {
    workspaceCount: number
    ready: number
    warning: number
    blocked: number
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
    missingLockfileCount: number
    staleLockfileCount: number
    mixedNodeLockfileCount: number
    packageManagerMismatchCount: number
    missingPackageManagerPinCount: number
    inheritedLockfileWorkspaceCount: number
    orphanLockfileWorkspaceCount: number
    managerCount: number
    managers: DependencyManagerId[]
    byManager: Record<string, number>
  }

  interface LockfileDriftReport {
    generatedAt: string
    projectPath: string
    discovery: WorkspaceDiscoveryReport
    workspaces: LockfileDriftWorkspace[]
    summary: LockfileDriftSummary
  }

  interface LockfileDriftExportResult {
    path: string
    format: LockfileDriftExportFormat
    generatedAt: string
    workspaceCount: number
    summary: LockfileDriftSummary
  }

  type RuntimePinningExportFormat = 'markdown' | 'json'
  type RuntimePinningStatus = 'ready' | 'warning' | 'blocked'
  type RuntimePinningSeverity = 'info' | 'warning' | 'blocked'
  type RuntimePinningSource = 'workspace' | 'ancestor' | 'manifest' | 'config'
  type RuntimePinningKind =
    | 'node-package-manager'
    | 'node-runtime'
    | 'python-runtime'
    | 'jvm-runtime'
    | 'maven-wrapper'
    | 'gradle-wrapper'
    | 'go-version'
    | 'go-toolchain'
    | 'rust-toolchain'
    | 'rust-version'
    | 'flutter-sdk'
    | 'dotnet-sdk'
    | 'dotnet-target'
    | 'php-runtime'
    | 'ruby-runtime'
    | 'swift-tools'
    | 'docker-base-image'
  type RuntimePinningFindingKind =
    | 'missing-runtime-pin'
    | 'missing-tool-wrapper'
    | 'missing-package-manager-pin'
    | 'unpinned-package-manager'
    | 'floating-container-tag'

  interface RuntimePinningEvidence {
    kind: RuntimePinningKind
    managerId?: DependencyManagerId
    source: RuntimePinningSource
    file: string
    path: string
    relativePath: string
    value: string
    modifiedAt?: string
  }

  interface RuntimePinningFinding {
    id: string
    kind: RuntimePinningFindingKind
    severity: RuntimePinningSeverity
    managerId?: DependencyManagerId
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface RuntimePinningWorkspace {
    workspace: WorkspaceNode
    status: RuntimePinningStatus
    score: number
    managers: DependencyManagerId[]
    evidence: RuntimePinningEvidence[]
    findings: RuntimePinningFinding[]
  }

  interface RuntimePinningSummary {
    workspaceCount: number
    ready: number
    warning: number
    blocked: number
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
    missingRuntimePinCount: number
    missingToolWrapperCount: number
    missingPackageManagerPinCount: number
    unpinnedPackageManagerCount: number
    floatingContainerTagCount: number
    evidenceCount: number
    inheritedEvidenceWorkspaceCount: number
    managerCount: number
    managers: DependencyManagerId[]
    byManager: Record<string, number>
  }

  interface RuntimePinningReport {
    generatedAt: string
    projectPath: string
    discovery: WorkspaceDiscoveryReport
    workspaces: RuntimePinningWorkspace[]
    summary: RuntimePinningSummary
  }

  interface RuntimePinningExportResult {
    path: string
    format: RuntimePinningExportFormat
    generatedAt: string
    workspaceCount: number
    summary: RuntimePinningSummary
  }

  type OfflineCacheReadinessExportFormat = 'markdown' | 'json'
  type OfflineCacheReadinessStatus = 'ready' | 'warning' | 'blocked'
  type OfflineCacheReadinessSeverity = 'info' | 'warning' | 'blocked'
  type OfflineCacheEvidenceKind =
    | 'lockfile'
    | 'inherited-lockfile'
    | 'package-manager-pin'
    | 'cache-config'
    | 'registry-config'
    | 'offline-command'
    | 'vendor-cache'
    | 'manager-support'
  type OfflineCacheFindingKind =
    | 'missing-lockfile'
    | 'missing-package-manager-pin'
    | 'missing-cache-config'
    | 'missing-offline-command'
    | 'missing-vendor-cache'
    | 'inherited-lockfile'

  interface OfflineCacheEvidence {
    kind: OfflineCacheEvidenceKind
    managerId: DependencyManagerId
    title: string
    value: string
    path?: string
    relativePath?: string
    source: 'workspace' | 'ancestor' | 'generated' | 'config'
  }

  interface OfflineCacheFinding {
    id: string
    kind: OfflineCacheFindingKind
    severity: OfflineCacheReadinessSeverity
    managerId: DependencyManagerId
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface OfflineCacheManagerReadiness {
    managerId: DependencyManagerId
    managerName: string
    status: OfflineCacheReadinessStatus
    score: number
    lockfileReady: boolean
    cacheConfigReady: boolean
    offlineCommandReady: boolean
    vendorCacheReady: boolean
    evidence: OfflineCacheEvidence[]
    findings: OfflineCacheFinding[]
  }

  interface OfflineCacheWorkspaceReadiness {
    workspace: WorkspaceNode
    status: OfflineCacheReadinessStatus
    score: number
    managers: OfflineCacheManagerReadiness[]
    evidence: OfflineCacheEvidence[]
    findings: OfflineCacheFinding[]
  }

  interface OfflineCacheReadinessSummary {
    workspaceCount: number
    ready: number
    warning: number
    blocked: number
    managerCount: number
    managers: DependencyManagerId[]
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
    lockfileReadyManagerCount: number
    inheritedLockfileManagerCount: number
    missingLockfileManagerCount: number
    packageManagerPinCount: number
    cacheConfigManagerCount: number
    offlineCommandManagerCount: number
    vendorCacheManagerCount: number
    missingOfflineCommandManagerCount: number
    missingCacheConfigManagerCount: number
    byManager: Record<string, number>
  }

  interface OfflineCacheReadinessReport {
    generatedAt: string
    projectPath: string
    discovery: WorkspaceDiscoveryReport
    workspaces: OfflineCacheWorkspaceReadiness[]
    summary: OfflineCacheReadinessSummary
  }

  interface OfflineCacheReadinessExportResult {
    path: string
    format: OfflineCacheReadinessExportFormat
    generatedAt: string
    workspaceCount: number
    summary: OfflineCacheReadinessSummary
  }

  type ReleaseRiskProfileExportFormat = 'markdown' | 'json'
  type ReleaseRiskProfileStatus = 'ready' | 'warning' | 'blocked'
  type ReleaseRiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
  type ReleaseRiskCategory =
    | 'readiness'
    | 'security'
    | 'supply-chain'
    | 'license'
    | 'registries'
    | 'credentials'
    | 'reproducibility'
    | 'deployment'
    | 'workspaces'
    | 'operations'
  type ReleaseRiskSource =
    | 'readiness-gate'
    | 'supply-chain'
    | 'license-compliance'
    | 'dependency-diff'
    | 'registry-reachability'
    | 'credential-usage'
    | 'lockfile-drift'
    | 'runtime-pinning'
    | 'offline-cache-readiness'
    | 'audit-evidence'
    | 'workspace-discovery'
    | 'operation-history'

  interface ReleaseRiskProfileFinding {
    id: string
    category: ReleaseRiskCategory
    source: ReleaseRiskSource
    severity: ReleaseRiskSeverity
    title: string
    summary: string
    recommendation: string
    evidence: string[]
    managerId?: DependencyManagerId
    workspaceId?: string
    workspaceName?: string
    workspaceRelativePath?: string
  }

  interface ReleaseRiskCategorySummary {
    category: ReleaseRiskCategory
    title: string
    status: ReleaseRiskProfileStatus
    score: number
    findingCount: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }

  interface ReleaseRiskProfileSummary {
    status: ReleaseRiskProfileStatus
    score: number
    findingCount: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
    topRiskCount: number
    categoryCount: number
    sourceErrorCount: number
    readinessStatus?: ReadinessGateStatus
    readinessScore?: number
    readinessBlockedCheckCount: number
    readinessWarningCheckCount: number
    componentCount: number
    dependencyCriticalRiskCount: number
    dependencyHighRiskCount: number
    dependencyMediumRiskCount: number
    licenseRiskCount: number
    policyViolationComponentCount: number
    registryEndpointCount: number
    unreachableRegistryCount: number
    insecureRegistryCount: number
    credentialEndpointCount: number
    missingCredentialEndpointCount: number
    weakCredentialMatchCount: number
    insecureCredentialCount: number
    unusedCredentialCount: number
    workspaceCount: number
    workspaceManagerCount: number
    lockfileDriftFindingCount: number
    runtimePinningFindingCount: number
    offlineCacheFindingCount: number
    deploymentReferenceCount: number
    floatingDeploymentRefCount: number
    deploymentBaselineEvidenceCount: number
    missingDeploymentBaselineCount: number
    auditEvidenceFindingCount: number
    auditCriticalFindingCount: number
    auditHighFindingCount: number
    auditMediumFindingCount: number
    auditFixAvailableCount: number
    missingOfflineCacheLockfileCount: number
    missingOfflineCacheConfigCount: number
    missingOfflineCommandCount: number
    floatingContainerTagCount: number
    operationCount: number
    failedOperationCount: number
    failedMutatingOperationCount: number
  }

  interface ReleaseRiskProfileSources {
    readiness?: {
      generatedAt: string
      status: ReadinessGateStatus
      score: number
      summary: ReadinessGateSummary
    }
    license?: {
      generatedAt: string
      policy: LicenseCompliancePolicySnapshot
      summary: LicenseComplianceSummary
    }
    dependencyDiff?: {
      fromSnapshotId: string
      comparedAt: string
      summary: DependencyComponentDiffSummary
    }
    registries?: {
      generatedAt: string
      summary: RegistryReachabilitySummary
    }
    credentials?: {
      generatedAt: string
      vaultStatus: CredentialVaultStatus
      summary: CredentialUsageSummary
    }
    lockfileDrift?: {
      generatedAt: string
      summary: LockfileDriftSummary
    }
    runtimePinning?: {
      generatedAt: string
      summary: RuntimePinningSummary
    }
    offlineCache?: {
      generatedAt: string
      summary: OfflineCacheReadinessSummary
    }
    auditEvidence?: {
      generatedAt: string
      summary: AuditEvidenceSummary
    }
    workspaces?: {
      generatedAt: string
      summary: WorkspaceDiscoverySummary
    }
    operations?: OperationHistorySummary
    errors: Partial<Record<ReleaseRiskSource, string>>
  }

  interface ReleaseRiskProfileReport {
    generatedAt: string
    projectPath: string
    status: ReleaseRiskProfileStatus
    score: number
    summary: ReleaseRiskProfileSummary
    categories: ReleaseRiskCategorySummary[]
    topRisks: ReleaseRiskProfileFinding[]
    findings: ReleaseRiskProfileFinding[]
    sources: ReleaseRiskProfileSources
  }

  interface ReleaseRiskProfileExportResult {
    path: string
    format: ReleaseRiskProfileExportFormat
    generatedAt: string
    status: ReleaseRiskProfileStatus
    score: number
    findingCount: number
    count: number
    summary: ReleaseRiskProfileSummary
  }

  type CiIntegrationPlanExportFormat = 'markdown' | 'json' | 'github-actions'
  type CiIntegrationProvider = 'github-actions'
  type CiIntegrationPlanStatus = 'ready' | 'warning' | 'blocked'
  type CiIntegrationWarningSeverity = 'info' | 'warning' | 'blocked'
  type CiIntegrationWarningSource =
    | 'readiness-gate'
    | 'lockfile-drift'
    | 'runtime-pinning'
    | 'offline-cache-readiness'
    | 'release-risk-profile'
    | 'ci-integration-plan'
  type CiIntegrationStepStage =
    | 'checkout'
    | 'setup'
    | 'cache'
    | 'install'
    | 'verify'
    | 'audit'
    | 'evidence'
    | 'publish'

  interface CiIntegrationCommand {
    managerId: DependencyManagerId
    title: string
    command: string
    source: 'offline-cache' | 'generated'
    offlineCapable: boolean
  }

  interface CiIntegrationMatrixEntry {
    workspaceId: string
    workspaceName: string
    workspaceRelativePath: string
    cwd: string
    managerIds: DependencyManagerId[]
    manifestFiles: string[]
    lockFiles: string[]
    configFiles: string[]
    installCommands: CiIntegrationCommand[]
    verificationCommands: CiIntegrationCommand[]
    cacheKeys: string[]
    requiredSecrets: string[]
  }

  interface CiIntegrationStep {
    id: string
    title: string
    stage: CiIntegrationStepStage
    kind: 'uses' | 'run' | 'upload-artifact'
    command?: string
    uses?: string
    if?: string
    workingDirectory?: string
    managerId?: DependencyManagerId
    source: 'generated' | 'offline-cache' | 'governance'
  }

  interface CiIntegrationWarning {
    id: string
    severity: CiIntegrationWarningSeverity
    source: CiIntegrationWarningSource
    releaseRiskCategory?: ReleaseRiskCategory
    title: string
    summary: string
    recommendation: string
    evidence: string[]
    managerId?: DependencyManagerId
    workspaceId?: string
    workspaceName?: string
    workspaceRelativePath?: string
  }

  interface CiIntegrationJob {
    id: string
    name: string
    provider: CiIntegrationProvider
    runner: string
    needs: string[]
    workspaceCount: number
    managerIds: DependencyManagerId[]
    matrix: CiIntegrationMatrixEntry[]
    steps: CiIntegrationStep[]
    cacheKeys: string[]
    requiredSecrets: string[]
    artifacts: string[]
    warnings: CiIntegrationWarning[]
  }

  interface CiIntegrationPlanSummary {
    status: CiIntegrationPlanStatus
    workspaceCount: number
    managerCount: number
    managers: DependencyManagerId[]
    jobCount: number
    matrixEntryCount: number
    installCommandCount: number
    offlineCommandCount: number
    verificationCommandCount: number
    cacheKeyCount: number
    requiredSecretCount: number
    artifactCount: number
    warningCount: number
    blockedWarningCount: number
    readinessStatus?: ReadinessGateStatus
    releaseRiskStatus?: ReleaseRiskProfileStatus
    lockfileDriftFindingCount: number
    runtimePinningFindingCount: number
    offlineCacheFindingCount: number
    deploymentReferenceCount: number
    floatingDeploymentRefCount: number
    deploymentBaselineEvidenceCount: number
    missingDeploymentBaselineCount: number
    deploymentWarningCount: number
  }

  interface CiIntegrationPlanSources {
    discovery: {
      generatedAt: string
      summary: WorkspaceDiscoverySummary
    }
    readiness?: {
      generatedAt: string
      status: ReadinessGateStatus
      score: number
      summary: ReadinessGateSummary
    }
    lockfileDrift?: {
      generatedAt: string
      summary: LockfileDriftSummary
    }
    runtimePinning?: {
      generatedAt: string
      summary: RuntimePinningSummary
    }
    offlineCache?: {
      generatedAt: string
      summary: OfflineCacheReadinessSummary
    }
    releaseRisk?: {
      generatedAt: string
      status: ReleaseRiskProfileStatus
      score: number
      summary: ReleaseRiskProfileSummary
    }
    errors: Partial<Record<CiIntegrationWarningSource, string>>
  }

  interface CiIntegrationPlanReport {
    generatedAt: string
    projectPath: string
    provider: CiIntegrationProvider
    status: CiIntegrationPlanStatus
    summary: CiIntegrationPlanSummary
    matrix: CiIntegrationMatrixEntry[]
    jobs: CiIntegrationJob[]
    warnings: CiIntegrationWarning[]
    requiredSecrets: string[]
    cacheKeys: string[]
    artifacts: string[]
    workflowYaml: string
    sources: CiIntegrationPlanSources
  }

  interface CiIntegrationPlanExportResult {
    path: string
    format: CiIntegrationPlanExportFormat
    generatedAt: string
    status: CiIntegrationPlanStatus
    workspaceCount: number
    jobCount: number
    warningCount: number
    count: number
    summary: CiIntegrationPlanSummary
  }

  type DependencyAutomationPlanExportFormat = 'markdown' | 'json' | 'dependabot' | 'renovate'
  type DependencyAutomationProvider = 'dependabot' | 'renovate'
  type DependencyAutomationPlanStatus = 'ready' | 'warning' | 'blocked'
  type DependencyAutomationWarningSeverity = 'info' | 'warning' | 'blocked'
  type DependencyAutomationWarningSource =
    | 'workspace-discovery'
    | 'lockfile-drift'
    | 'dependabot-support'
    | 'renovate-support'
    | 'registry-secrets'

  interface DependencyAutomationTarget {
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

  interface DependencyAutomationWarning {
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

  interface DependencyAutomationPlanSummary {
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

  interface DependencyAutomationPlanSources {
    discovery: {
      generatedAt: string
      summary: WorkspaceDiscoverySummary
    }
    lockfileDrift?: {
      generatedAt: string
      summary: LockfileDriftSummary
    }
    errors: Partial<Record<DependencyAutomationWarningSource, string>>
  }

  interface DependencyAutomationPlanReport {
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

  interface DependencyAutomationPlanExportResult {
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

  type CredentialRotationPlanExportFormat = 'markdown' | 'json'
  type CredentialRotationStatus = 'ready' | 'warning' | 'blocked'
  type CredentialRotationSeverity = 'info' | 'warning' | 'blocked'
  type CredentialRotationActionKind =
    | 'create-credential'
    | 'rotate-credential'
    | 'rescope-credential'
    | 'remove-credential'
    | 'enable-secure-storage'
    | 'configure-automation-secret'
    | 'move-endpoint-to-https'

  interface CredentialRotationCredential {
    id: string
    label: string
    managerId: DependencyManagerId
    service: string
    account?: string
    kind: string
    url?: string
    encrypted: boolean
    storage: string
    createdAt: string
    updatedAt: string
    lastUsedAt?: string
    ageDays: number
    daysSinceUse?: number
    endpointCount: number
    matchTypes: string[]
    stale: boolean
    unused: boolean
    needsRotation: boolean
  }

  interface CredentialRotationEndpoint {
    id: string
    managerId?: DependencyManagerId
    name: string
    url: string
    sourceFile: string
    requiresCredential: boolean
    usageStatus: CredentialUsageStatus
    secure: boolean
    privateHost: boolean
    matchCount: number
    recommendation: string
  }

  interface CredentialRotationAction {
    id: string
    kind: CredentialRotationActionKind
    severity: CredentialRotationSeverity
    title: string
    summary: string
    recommendation: string
    evidence: string[]
    managerId?: DependencyManagerId
    credentialId?: string
    endpointId?: string
    automationSecret?: string
  }

  interface CredentialRotationPlanSummary {
    status: CredentialRotationStatus
    credentialCount: number
    endpointCount: number
    privateEndpointCount: number
    missingCredentialEndpointCount: number
    weakMatchEndpointCount: number
    insecureStorageCredentialCount: number
    insecureEndpointCount: number
    staleCredentialCount: number
    unusedCredentialCount: number
    automationSecretCount: number
    actionCount: number
    blockedActionCount: number
    warningActionCount: number
    vaultEncrypted: boolean
  }

  interface CredentialRotationPlanReport {
    generatedAt: string
    projectPath: string
    status: CredentialRotationStatus
    summary: CredentialRotationPlanSummary
    credentials: CredentialRotationCredential[]
    endpoints: CredentialRotationEndpoint[]
    automationSecrets: string[]
    actions: CredentialRotationAction[]
    sources: {
      credentialUsage: {
        generatedAt: string
        summary: CredentialUsageSummary
        vaultStatus: CredentialVaultStatus
      }
      dependencyAutomation?: {
        generatedAt: string
        summary: DependencyAutomationPlanSummary
        requiredSecrets: string[]
      }
      errors: Partial<Record<'credential-usage' | 'dependency-automation', string>>
    }
  }

  interface CredentialRotationPlanExportResult {
    path: string
    format: CredentialRotationPlanExportFormat
    generatedAt: string
    status: CredentialRotationStatus
    actionCount: number
    count: number
    summary: CredentialRotationPlanSummary
  }

  type AutomationSafetyPlanExportFormat = 'markdown' | 'json'
  type AutomationSafetyStatus = 'ready' | 'warning' | 'blocked'
  type AutomationUpdateType = 'security' | 'patch' | 'minor' | 'major'
  type AutomationSafetyDecision = 'auto-merge' | 'review' | 'blocked'
  type AutomationSafetyFindingSeverity = 'info' | 'warning' | 'blocked'
  type AutomationSafetyFindingSource =
    | 'dependency-automation'
    | 'credential-rotation'
    | 'readiness-gate'
    | 'release-risk-profile'
    | 'automation-safety'

  interface AutomationSafetyRule {
    id: string
    provider: DependencyAutomationProvider
    managerId: DependencyManagerId
    workspaceId: string
    workspaceName: string
    workspaceRelativePath: string
    directory: string
    updateType: AutomationUpdateType
    decision: AutomationSafetyDecision
    requiredEvidence: string[]
    requiredApprovals: number
    rationale: string
    blockers: string[]
    warnings: string[]
  }

  interface AutomationSafetyFinding {
    id: string
    severity: AutomationSafetyFindingSeverity
    source: AutomationSafetyFindingSource
    title: string
    summary: string
    recommendation: string
    evidence: string[]
    managerId?: DependencyManagerId
    workspaceId?: string
    workspaceName?: string
    workspaceRelativePath?: string
  }

  interface AutomationSafetyPlanSummary {
    status: AutomationSafetyStatus
    targetCount: number
    supportedTargetCount: number
    ruleCount: number
    autoMergeRuleCount: number
    reviewRuleCount: number
    blockedRuleCount: number
    securityRuleCount: number
    patchRuleCount: number
    minorRuleCount: number
    majorRuleCount: number
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
    managerCount: number
    managers: DependencyManagerId[]
    workspaceCount: number
    readinessStatus?: ReadinessGateStatus
    releaseRiskStatus?: ReleaseRiskProfileStatus
    credentialRotationStatus?: AutomationSafetyStatus
    dependencyAutomationStatus?: AutomationSafetyStatus
  }

  interface AutomationSafetyPlanReport {
    generatedAt: string
    projectPath: string
    status: AutomationSafetyStatus
    summary: AutomationSafetyPlanSummary
    rules: AutomationSafetyRule[]
    findings: AutomationSafetyFinding[]
    renovateSafetyPreset: string
    sources: {
      dependencyAutomation?: {
        generatedAt: string
        status: DependencyAutomationPlanStatus
        summary: DependencyAutomationPlanSummary
      }
      credentialRotation?: {
        generatedAt: string
        status: CredentialRotationStatus
        summary: CredentialRotationPlanSummary
      }
      readiness?: {
        generatedAt: string
        status: ReadinessGateStatus
        score: number
        summary: ReadinessGateSummary
      }
      releaseRisk?: {
        generatedAt: string
        status: ReleaseRiskProfileStatus
        score: number
        summary: ReleaseRiskProfileSummary
      }
      errors: Partial<Record<AutomationSafetyFindingSource, string>>
    }
  }

  interface AutomationSafetyPlanExportResult {
    path: string
    format: AutomationSafetyPlanExportFormat
    generatedAt: string
    status: AutomationSafetyStatus
    ruleCount: number
    findingCount: number
    count: number
    summary: AutomationSafetyPlanSummary
  }

  type DependencyOwnershipPlanExportFormat = 'markdown' | 'json' | 'codeowners'
  type DependencyOwnershipStatus = 'ready' | 'warning' | 'blocked'
  type DependencyOwnershipSource = 'codeowners' | 'missing'
  type DependencyOwnershipFindingSeverity = 'info' | 'warning' | 'blocked'
  type DependencyOwnershipFindingSource =
    | 'codeowners'
    | 'workspace-discovery'
    | 'dependency-automation'
    | 'automation-safety'
    | 'ownership-plan'

  interface CodeownersSourceFile {
    path: string
    relativePath: string
    entryCount: number
  }

  interface DependencyOwnerAssignment {
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

  interface DependencyReviewRoute {
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

  interface SuggestedCodeownersEntry {
    pattern: string
    owners: string[]
    reason: string
    workspaceId?: string
    workspaceRelativePath?: string
    managerId?: DependencyManagerId
  }

  interface DependencyOwnershipFinding {
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

  interface DependencyOwnershipPlanSummary {
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

  interface DependencyOwnershipPlanReport {
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
      discovery: {
        generatedAt: string
        summary: WorkspaceDiscoverySummary
      }
      dependencyAutomation?: {
        generatedAt: string
        status: DependencyAutomationPlanStatus
        summary: DependencyAutomationPlanSummary
      }
      automationSafety?: {
        generatedAt: string
        status: AutomationSafetyStatus
        summary: AutomationSafetyPlanSummary
      }
      errors: Partial<Record<DependencyOwnershipFindingSource, string>>
    }
  }

  interface DependencyOwnershipPlanExportResult {
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

  type DependencyUpgradePlaybookStatus = 'ready' | 'warning' | 'blocked'
  type DependencyUpgradeLaneKind =
    | 'security-hotfix'
    | 'release-blocker'
    | 'risk-review'
    | 'routine-update'
    | 'automation-onboarding'
    | 'ownership-routing'
  type DependencyUpgradeLanePriority = 'immediate' | 'urgent' | 'scheduled' | 'backlog'
  type DependencyUpgradePlaybookSource =
    | 'workspace-update-plan'
    | 'vulnerability-remediation-plan'
    | 'release-risk-profile'
    | 'dependency-automation-plan'
    | 'dependency-ownership-plan'

  interface DependencyUpgradePlaybookItem {
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

  interface DependencyUpgradePlaybookLane {
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

  interface DependencyUpgradePlaybookSummary {
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

  interface DependencyUpgradePlaybookReport {
    generatedAt: string
    projectPath: string
    status: DependencyUpgradePlaybookStatus
    summary: DependencyUpgradePlaybookSummary
    lanes: DependencyUpgradePlaybookLane[]
    items: DependencyUpgradePlaybookItem[]
    sources: {
      updatePlan?: {
        generatedAt: string
        summary: WorkspaceUpdatePlanSummary
      }
      vulnerabilityRemediation?: {
        generatedAt: string
        status: VulnerabilityRemediationStatus
        summary: VulnerabilityRemediationPlanSummary
      }
      releaseRisk?: {
        generatedAt: string
        status: ReleaseRiskProfileStatus
        score: number
        summary: ReleaseRiskProfileSummary
      }
      automation?: {
        generatedAt: string
        status: DependencyAutomationPlanStatus
        summary: DependencyAutomationPlanSummary
      }
      ownership?: {
        generatedAt: string
        status: DependencyOwnershipStatus
        summary: DependencyOwnershipPlanSummary
      }
      errors: Partial<Record<DependencyUpgradePlaybookSource, string>>
    }
  }

  interface DependencyUpgradePlaybookExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: DependencyUpgradePlaybookStatus
    itemCount: number
    laneCount: number
    summary: DependencyUpgradePlaybookSummary
  }

  type DependencyRollbackPlanStatus = 'ready' | 'warning' | 'blocked'
  type DependencyRollbackPlanPriority = 'required' | 'recommended' | 'optional'
  type DependencyRollbackAnchorKind =
    | 'managed-snapshot'
    | 'source-control'
    | 'lockfile'
    | 'manifest'
    | 'operation-history'
  type DependencyRollbackStrategy =
    | 'snapshot-restore'
    | 'source-control-restore'
    | 'lockfile-restore'
    | 'manager-rehydrate'
    | 'verification'
  type DependencyRollbackPlanSource =
    | 'workspace-governance'
    | 'workspace-update-plan'
    | 'operation-history'

  interface DependencyRollbackAnchor {
    kind: DependencyRollbackAnchorKind
    status: DependencyRollbackPlanStatus
    label: string
    path?: string
    count?: number
  }

  interface DependencyRollbackPlanItem {
    id: string
    priority: DependencyRollbackPlanPriority
    status: DependencyRollbackPlanStatus
    workspaceId: string
    workspaceName: string
    workspaceRelativePath: string
    managerId: DependencyManagerId
    managerName: string
    risk: WorkspaceUpdatePlanRisk
    updateStatus: WorkspaceUpdatePlanItemStatus
    snapshotSource: WorkspaceSnapshotSource
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

  interface DependencyRollbackPlanSummary {
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

  interface DependencyRollbackPlanReport {
    generatedAt: string
    projectPath: string
    status: DependencyRollbackPlanStatus
    summary: DependencyRollbackPlanSummary
    items: DependencyRollbackPlanItem[]
    sources: {
      governance?: {
        generatedAt: string
        summary: WorkspaceGovernanceSummary
      }
      updatePlan?: {
        generatedAt: string
        summary: WorkspaceUpdatePlanSummary
      }
      operationHistory: OperationHistorySummary
      errors: Partial<Record<DependencyRollbackPlanSource, string>>
    }
  }

  interface DependencyRollbackPlanExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: DependencyRollbackPlanStatus
    itemCount: number
    blockedItemCount: number
    summary: DependencyRollbackPlanSummary
  }

  type DependencyImpactAnalysisStatus = 'ready' | 'warning' | 'blocked'
  type DependencyImpactSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
  type DependencyImpactDimension =
    | 'workspace'
    | 'manager'
    | 'owner'
    | 'ci'
    | 'release-gate'
    | 'security'
    | 'rollback'
    | 'automation'
  type DependencyImpactAnalysisSource =
    | 'workspace-update-plan'
    | 'dependency-upgrade-playbook'
    | 'dependency-rollback-plan'
    | 'release-risk-profile'
    | 'ci-integration-plan'
    | 'dependency-ownership-plan'

  interface DependencyImpactCiJobRef {
    id: string
    name: string
    runner: string
    stepCount: number
    requiredSecrets: string[]
    artifacts: string[]
  }

  interface DependencyImpactRiskRef {
    id: string
    severity: ReleaseRiskSeverity
    category: string
    source: string
    title: string
  }

  interface DependencyImpactAnalysisItem {
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
    updateStatus: WorkspaceUpdatePlanItemStatus
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

  interface DependencyImpactAnalysisSummary {
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

  interface DependencyImpactAnalysisReport {
    generatedAt: string
    projectPath: string
    status: DependencyImpactAnalysisStatus
    summary: DependencyImpactAnalysisSummary
    items: DependencyImpactAnalysisItem[]
    sources: {
      updatePlan?: {
        generatedAt: string
        summary: WorkspaceUpdatePlanSummary
      }
      upgradePlaybook?: {
        generatedAt: string
        status: DependencyUpgradePlaybookStatus
        summary: DependencyUpgradePlaybookSummary
      }
      rollbackPlan?: {
        generatedAt: string
        status: DependencyRollbackPlanStatus
        summary: DependencyRollbackPlanSummary
      }
      releaseRisk?: {
        generatedAt: string
        status: ReleaseRiskProfileStatus
        score: number
        summary: ReleaseRiskProfileSummary
      }
      ciIntegration?: {
        generatedAt: string
        status: CiIntegrationPlanStatus
        summary: CiIntegrationPlanSummary
      }
      ownership?: {
        generatedAt: string
        status: DependencyOwnershipStatus
        summary: DependencyOwnershipPlanSummary
      }
      errors: Partial<Record<DependencyImpactAnalysisSource, string>>
    }
  }

  interface DependencyImpactAnalysisExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: DependencyImpactAnalysisStatus
    itemCount: number
    summary: DependencyImpactAnalysisSummary
  }

  type DependencyChangeApprovalPacketStatus = 'ready' | 'warning' | 'blocked'
  type DependencyChangeApprovalDecision = 'approved' | 'needs-review' | 'blocked'
  type DependencyChangeApprovalCheckStatus = 'passed' | 'warning' | 'blocked' | 'info'
  type DependencyChangeApprovalCheckSource =
    | 'dependency-impact-analysis'
    | 'dependency-upgrade-playbook'
    | 'dependency-rollback-plan'
    | 'release-trust-policy'
    | 'release-approval'
    | 'release-exception'
    | 'approval-packet'

  interface DependencyChangeApprovalChecklistItem {
    id: string
    source: DependencyChangeApprovalCheckSource
    status: DependencyChangeApprovalCheckStatus
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface DependencyChangeApprovalParticipant {
    owner: string
    role: 'owner' | 'reviewer' | 'exception-reviewer'
    workspaceCount: number
    managerIds: DependencyManagerId[]
    approvalCount: number
  }

  interface DependencyChangeApprovalScopeItem {
    id: string
    severity: DependencyImpactSeverity
    status: DependencyChangeApprovalPacketStatus
    workspaceName: string
    workspaceRelativePath: string
    managerId: DependencyManagerId
    managerName: string
    owners: string[]
    ciJobCount: number
    riskFindingCount: number
    rollbackStatus?: DependencyChangeApprovalPacketStatus
    verificationCommandCount: number
    releaseGateCount: number
    recommendation: string
  }

  interface DependencyChangeApprovalPacketSummary {
    status: DependencyChangeApprovalPacketStatus
    decision: DependencyChangeApprovalDecision
    scopeItemCount: number
    blockedScopeItemCount: number
    warningScopeItemCount: number
    criticalImpactCount: number
    highImpactCount: number
    workspaceCount: number
    managerCount: number
    ownerCount: number
    missingOwnerItemCount: number
    participantCount: number
    approvalRecordCount: number
    approvedRecordCount: number
    rejectedRecordCount: number
    activeExceptionCount: number
    trustBlockedCheckCount: number
    trustWarningCheckCount: number
    rollbackBlockedItemCount: number
    rollbackWarningItemCount: number
    ciJobCount: number
    verificationCommandCount: number
    checklistCount: number
    blockedChecklistCount: number
    warningChecklistCount: number
    passedChecklistCount: number
    sourceErrorCount: number
  }

  interface DependencyChangeApprovalPacketReport {
    generatedAt: string
    projectPath: string
    status: DependencyChangeApprovalPacketStatus
    decision: DependencyChangeApprovalDecision
    summary: DependencyChangeApprovalPacketSummary
    checklist: DependencyChangeApprovalChecklistItem[]
    participants: DependencyChangeApprovalParticipant[]
    scope: DependencyChangeApprovalScopeItem[]
    sources: {
      impactAnalysis?: {
        generatedAt: string
        status: DependencyImpactAnalysisStatus
        summary: DependencyImpactAnalysisSummary
      }
      upgradePlaybook?: {
        generatedAt: string
        status: DependencyUpgradePlaybookStatus
        summary: DependencyUpgradePlaybookSummary
      }
      rollbackPlan?: {
        generatedAt: string
        status: DependencyRollbackPlanStatus
        summary: DependencyRollbackPlanSummary
      }
      trustPolicy?: {
        generatedAt: string
        status: ReleaseTrustPolicyStatus
        summary: ReleaseTrustPolicySummary
      }
      approvals?: {
        generatedAt: string
        summary: ReleaseApprovalSummary
      }
      exceptions?: {
        generatedAt: string
        summary: ReleaseExceptionSummary
      }
      errors: Partial<Record<DependencyChangeApprovalCheckSource, string>>
    }
  }

  interface DependencyChangeApprovalPacketExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: DependencyChangeApprovalPacketStatus
    decision: DependencyChangeApprovalDecision
    checklistCount: number
    scopeItemCount: number
    summary: DependencyChangeApprovalPacketSummary
  }

  type DependencyChangeCalendarStatus = 'ready' | 'warning' | 'blocked'
  type DependencyChangeWindowKind = 'automation' | 'standard' | 'manual-review' | 'security-hotfix' | 'frozen'
  type DependencyChangeWindowStatus = 'scheduled' | 'needs-review' | 'frozen' | 'blocked'
  type DependencyChangeFreezeReason =
    | 'approval-blocked'
    | 'trust-policy-blocked'
    | 'rollback-blocked'
    | 'missing-owner'
    | 'critical-impact'
    | 'active-exception'
    | 'calendar-policy'
  type DependencyChangeCalendarSource =
    | 'dependency-change-approval-packet'
    | 'dependency-impact-analysis'
  type DependencyChangeCalendarExportFormat =
    | 'markdown'
    | 'json'
    | 'ics'
    | 'github-actions'
    | 'ticket-template'

  interface DependencyChangeCalendarWindow {
    id: string
    kind: DependencyChangeWindowKind
    status: DependencyChangeWindowStatus
    title: string
    startAt?: string
    endAt?: string
    timezone: 'UTC'
    severity: DependencyImpactSeverity
    workspaceName: string
    workspaceRelativePath: string
    managerId: DependencyManagerId
    managerName: string
    owners: string[]
    releaseGateCount: number
    verificationCommandCount: number
    requiredActions: string[]
    evidence: string[]
  }

  interface DependencyChangeFreezeWindow {
    id: string
    status: DependencyChangeCalendarStatus
    reason: DependencyChangeFreezeReason
    title: string
    startsAt: string
    endsAt?: string
    scope: string
    affectedWorkspaceCount: number
    affectedManagerCount: number
    recommendation: string
    evidence: string[]
  }

  interface DependencyChangeCalendarSummary {
    status: DependencyChangeCalendarStatus
    windowCount: number
    scheduledWindowCount: number
    needsReviewWindowCount: number
    frozenWindowCount: number
    blockedWindowCount: number
    freezeWindowCount: number
    blockedFreezeWindowCount: number
    warningFreezeWindowCount: number
    automationWindowCount: number
    manualReviewWindowCount: number
    securityHotfixWindowCount: number
    workspaceCount: number
    managerCount: number
    ownerCount: number
    missingOwnerItemCount: number
    activeExceptionCount: number
    rejectedApprovalCount: number
    trustBlockedCheckCount: number
    rollbackBlockedItemCount: number
    verificationCommandCount: number
    sourceErrorCount: number
  }

  interface DependencyChangeCalendarReport {
    generatedAt: string
    projectPath: string
    status: DependencyChangeCalendarStatus
    summary: DependencyChangeCalendarSummary
    freezeWindows: DependencyChangeFreezeWindow[]
    windows: DependencyChangeCalendarWindow[]
    sources: {
      approvalPacket?: {
        generatedAt: string
        status: DependencyChangeApprovalPacketStatus
        decision: DependencyChangeApprovalDecision
        summary: DependencyChangeApprovalPacketSummary
      }
      impactAnalysis?: {
        generatedAt: string
        status: DependencyImpactAnalysisStatus
        summary: DependencyImpactAnalysisSummary
      }
      errors: Partial<Record<DependencyChangeCalendarSource, string>>
    }
  }

  interface DependencyChangeCalendarExportResult {
    path: string
    format: DependencyChangeCalendarExportFormat
    generatedAt: string
    status: DependencyChangeCalendarStatus
    windowCount: number
    freezeWindowCount: number
    summary: DependencyChangeCalendarSummary
  }

  type DependencyChangeExecutionStatus = 'ready' | 'warning' | 'blocked'
  type DependencyChangeExecutionRecordStatus =
    | 'completed'
    | 'pending'
    | 'failed'
    | 'blocked'
    | 'unscheduled'
  type DependencyChangeExecutionVerificationStatus =
    | 'passed'
    | 'failed'
    | 'missing'
    | 'pending'
  type DependencyChangeExecutionSource =
    | 'dependency-change-calendar'
    | 'dependency-change-approval-packet'
    | 'ci-evidence'
    | 'operation-history'

  interface DependencyChangeExecutionOperation {
    id: string
    command: string
    cwd: string
    status: OperationHistoryStatus
    operation: OperationHistoryOperationKind
    risk: OperationHistoryRisk
    startedAt: string
    finishedAt: string
    durationMs: number
    summary?: string
  }

  interface DependencyChangeExecutionCiEvidence {
    id: string
    status: CiEvidenceStatus
    provider?: string
    workflow?: string
    job?: string
    branch?: string
    commit?: string
    url?: string
    finishedAt: string
    summary?: string
  }

  interface DependencyChangeExecutionRecordItem {
    id: string
    status: DependencyChangeExecutionRecordStatus
    verificationStatus: DependencyChangeExecutionVerificationStatus
    title: string
    windowKind: DependencyChangeWindowKind
    windowStatus: DependencyChangeWindowStatus
    scheduledStartAt?: string
    scheduledEndAt?: string
    severity: DependencyImpactSeverity
    workspaceName: string
    workspaceRelativePath: string
    managerId: DependencyManagerId
    managerName: string
    owners: string[]
    approvalDecision?: DependencyChangeApprovalDecision
    operationCount: number
    successfulOperationCount: number
    failedOperationCount: number
    ciEvidenceCount: number
    latestCiStatus?: CiEvidenceStatus
    relatedOperations: DependencyChangeExecutionOperation[]
    relatedCiEvidence: DependencyChangeExecutionCiEvidence[]
    requiredActions: string[]
    gaps: string[]
    evidence: string[]
    recommendation: string
  }

  interface DependencyChangeExecutionSummary {
    status: DependencyChangeExecutionStatus
    recordCount: number
    completedRecordCount: number
    pendingRecordCount: number
    failedRecordCount: number
    blockedRecordCount: number
    unscheduledRecordCount: number
    operationCount: number
    successfulOperationCount: number
    failedOperationCount: number
    ciEvidenceCount: number
    ciSuccessRecordCount: number
    ciFailedRecordCount: number
    missingOperationEvidenceCount: number
    missingCiEvidenceCount: number
    approvalBlockedCount: number
    freezeBlockedCount: number
    verificationPassedCount: number
    verificationFailedCount: number
    sourceErrorCount: number
  }

  interface DependencyChangeExecutionReport {
    generatedAt: string
    projectPath: string
    status: DependencyChangeExecutionStatus
    summary: DependencyChangeExecutionSummary
    records: DependencyChangeExecutionRecordItem[]
    sources: {
      calendar?: {
        generatedAt: string
        status: DependencyChangeCalendarStatus
        summary: DependencyChangeCalendarSummary
      }
      approvalPacket?: {
        generatedAt: string
        status: DependencyChangeApprovalPacketStatus
        decision: DependencyChangeApprovalDecision
        summary: DependencyChangeApprovalPacketSummary
      }
      ciEvidence?: {
        generatedAt: string
        summary: CiEvidenceSummary
      }
      operationHistory: {
        count: number
        mutatingCount: number
        failedCount: number
      }
      errors: Partial<Record<DependencyChangeExecutionSource, string>>
    }
  }

  interface DependencyChangeExecutionExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: DependencyChangeExecutionStatus
    recordCount: number
    summary: DependencyChangeExecutionSummary
  }

  type PolicyAsCodeExportFormat = 'markdown' | 'json' | 'policy-json' | 'github-actions'
  type PolicyAsCodeStatus = 'ready' | 'warning' | 'blocked'
  type PolicyAsCodeFindingSeverity = 'info' | 'warning' | 'blocked'
  type PolicyAsCodeFindingSource =
    | 'dependency-policy'
    | 'readiness-policy'
    | 'dependency-automation'
    | 'automation-safety'
    | 'dependency-ownership'
    | 'workspace-discovery'
    | 'policy-as-code'

  interface PolicyAsCodeDependencyPolicySource {
    path: string
    policy: DependencyPolicy
    evaluation?: {
      generatedAt: string
      componentCount: number
      violationCount: number
    }
  }

  interface PolicyAsCodeReadinessPolicySource {
    path: string
    policy: ReadinessPolicy
    status?: ReadinessGateStatus
    score?: number
  }

  interface PolicyAsCodePack {
    schemaVersion: string
    generatedAt: string
    projectPath: string
    managers: DependencyManagerId[]
    policies: {
      dependencyPolicy?: PolicyAsCodeDependencyPolicySource
      readinessPolicy?: PolicyAsCodeReadinessPolicySource
    }
    enforcement: {
      dependencyPolicyRules: string[]
      readinessGates: string[]
      deploymentPolicyGates: string[]
      automationSafetyRules: Array<{
        id: string
        provider: string
        workspace: string
        managerId: DependencyManagerId
        updateType: string
        decision: string
        requiredApprovals: number
        requiredEvidence: string[]
      }>
      reviewRoutes: Array<{
        id: string
        workspace: string
        managerId: DependencyManagerId
        updateType: string
        provider: string
        status: string
        owners: string[]
        requiredApprovals: number
      }>
    }
    ci: {
      requiredSecrets: string[]
      requiredArtifacts: string[]
      suggestedWorkflowPath: string
      commands: string[]
    }
  }

  interface PolicyAsCodeFinding {
    id: string
    severity: PolicyAsCodeFindingSeverity
    source: PolicyAsCodeFindingSource
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface PolicyAsCodeSummary {
    status: PolicyAsCodeStatus
    managerCount: number
    managers: DependencyManagerId[]
    dependencyPolicyRuleCount: number
    readinessGateCount: number
    deploymentPolicyGateCount: number
    automationSafetyRuleCount: number
    blockedAutomationSafetyRuleCount: number
    reviewRouteCount: number
    missingOwnerRouteCount: number
    requiredSecretCount: number
    requiredArtifactCount: number
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
    readinessStatus?: ReadinessGateStatus
    automationSafetyStatus?: PolicyAsCodeStatus
    ownershipStatus?: PolicyAsCodeStatus
  }

  interface PolicyAsCodeReport {
    generatedAt: string
    projectPath: string
    status: PolicyAsCodeStatus
    summary: PolicyAsCodeSummary
    pack: PolicyAsCodePack
    githubActionsWorkflow: string
    findings: PolicyAsCodeFinding[]
    sources: {
      discovery?: {
        generatedAt: string
        summary: WorkspaceDiscoverySummary
      }
      readiness?: {
        generatedAt: string
        status: ReadinessGateStatus
        score: number
        summary: ReadinessGateSummary
      }
      dependencyAutomation?: {
        generatedAt: string
        status: DependencyAutomationPlanStatus
        summary: DependencyAutomationPlanSummary
      }
      automationSafety?: {
        generatedAt: string
        status: AutomationSafetyStatus
        summary: AutomationSafetyPlanSummary
      }
      dependencyOwnership?: {
        generatedAt: string
        status: DependencyOwnershipStatus
        summary: DependencyOwnershipPlanSummary
      }
      errors: Partial<Record<PolicyAsCodeFindingSource, string>>
    }
  }

  interface PolicyAsCodeExportResult {
    path: string
    format: PolicyAsCodeExportFormat
    generatedAt: string
    status: PolicyAsCodeStatus
    findingCount: number
    count: number
    summary: PolicyAsCodeSummary
  }

  type WorkspaceKind =
    | 'root'
    | 'npm-workspace'
    | 'pnpm-workspace'
    | 'yarn-workspace'
    | 'cargo-member'
    | 'maven-module'
    | 'gradle-project'
    | 'sbt-project'
    | 'leiningen-project'
    | 'mix-project'
    | 'rebar3-project'
    | 'cabal-project'
    | 'stack-project'
    | 'renv-project'
    | 'julia-project'
    | 'terraform-project'
    | 'ansible-project'
    | 'automation-project'
    | 'bazel-workspace'
    | 'pants-project'
    | 'buck-project'
    | 'go-work-module'
    | 'poetry-package'
    | 'python-package'
    | 'flutter-package'
    | 'native-project'
    | 'deno-project'
    | 'nuget-project'
    | 'composer-package'
    | 'ruby-package'
    | 'swiftpm-package'
    | 'cocoapods-project'
    | 'helm-chart'
    | 'docker-compose-project'

  interface WorkspaceNode {
    id: string
    name: string
    path: string
    relativePath: string
    kind: WorkspaceKind
    managerIds: DependencyManagerId[]
    manifestFiles: string[]
    lockFiles: string[]
    configFiles: string[]
    discoveredBy: string[]
    parentId?: string
    packageName?: string
    version?: string
  }

  interface WorkspaceDiscoverySummary {
    workspaceCount: number
    explicitWorkspaceCount: number
    managerCount: number
    managers: DependencyManagerId[]
    manifestFileCount: number
    lockFileCount: number
    configFileCount: number
    byKind: Record<string, number>
    byManager: Record<string, number>
  }

  interface WorkspaceDiscoveryReport {
    generatedAt: string
    projectPath: string
    workspaces: WorkspaceNode[]
    summary: WorkspaceDiscoverySummary
  }

  interface WorkspaceDiscoveryExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    workspaceCount: number
    summary: WorkspaceDiscoverySummary
  }

  type WorkspaceGovernanceStatus = 'ready' | 'warning' | 'blocked'
  type WorkspaceGovernanceFindingSeverity = 'info' | 'warning' | 'blocked'
  type WorkspaceGovernanceExportFormat = 'markdown' | 'json'
  type WorkspaceReleaseEvidenceExportFormat = 'markdown' | 'json'
  type WorkspaceSbomExportFormat = 'cyclonedx' | 'spdx'
  type WorkspaceRemediationPlanExportFormat = 'markdown' | 'json'
  type WorkspaceUpdatePlanExportFormat = 'markdown' | 'json'
  type RemediationPlanItemScope = 'project' | 'workspace'
  type RemediationPlanItemSource =
    | 'readiness'
    | 'release-risk'
    | 'workspace-governance'
    | 'workspace-readiness'
    | 'export-error'
  type RemediationPlanPriority = 'critical' | 'high' | 'medium' | 'low' | 'info'
  type WorkspaceUpdatePlanRisk = 'blocked' | 'high' | 'medium' | 'low' | 'info'
  type WorkspaceUpdatePlanItemStatus = 'ready' | 'needs-review' | 'blocked'
  type WorkspaceUpdatePlanCommandStage = 'inspect' | 'update' | 'verify' | 'audit' | 'lock'
  type ReleaseBundleArtifactKind =
    | 'readiness'
    | 'workspace-discovery'
    | 'workspace-governance'
    | 'workspace-release-evidence'
    | 'remediation-plan'
    | 'update-plan'
    | 'workspace-sbom'
    | 'root-sbom'
    | 'license-compliance'
    | 'third-party-notices'
    | 'dependency-diff'
    | 'operation-history'
    | 'ci-evidence'
    | 'audit-evidence'
    | 'vulnerability-remediation-plan'
    | 'release-provenance-attestation'
    | 'release-approval'
    | 'release-exception'
    | 'credential-usage'
    | 'lockfile-drift'
    | 'runtime-pinning'
    | 'offline-cache-readiness'
    | 'release-risk-profile'
    | 'ci-integration-plan'
    | 'dependency-automation-plan'
    | 'credential-rotation-plan'
    | 'automation-safety-plan'
    | 'dependency-ownership-plan'
    | 'dependency-upgrade-playbook'
    | 'dependency-rollback-plan'
    | 'dependency-impact-analysis'
    | 'dependency-change-approval-packet'
    | 'dependency-change-calendar'
    | 'dependency-change-execution-record'
    | 'policy-as-code-pack'
    | 'registry-reachability'
  type WorkspacePolicySource = 'workspace' | 'inherited-root' | 'none'
  type WorkspaceReadinessPolicySource = 'workspace' | 'inherited-root' | 'default'
  type WorkspaceSnapshotSource = 'workspace' | 'inherited-root' | 'none'
  type WorkspaceReleaseApprovalSource = 'workspace' | 'inherited-root' | 'none'
  type WorkspaceCiEvidenceSource = 'workspace' | 'inherited-root' | 'none'
  type WorkspaceReleaseExceptionSource = 'workspace' | 'inherited-root' | 'none'

  interface WorkspaceGovernanceFinding {
    id: string
    title: string
    severity: WorkspaceGovernanceFindingSeverity
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface WorkspaceReadinessCheckSummary {
    id: string
    title: string
    status: ReadinessGateCheckStatus
    severity: ReadinessGateSeverity
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface WorkspaceGovernanceNode {
    workspace: WorkspaceNode
    status: WorkspaceGovernanceStatus
    score: number
    componentCount: number
    policyViolationCount: number
    highSeverityPolicyViolationCount: number
    snapshotCount: number
    snapshotSource: WorkspaceSnapshotSource
    snapshotPath?: string
    snapshotCoveredFileCount: number
    snapshotCoveredFiles: string[]
    recentOperationCount: number
    failedOperationCount: number
    manifestFileCount: number
    lockFileCount: number
    missingLockManagers: DependencyManagerId[]
    policySource: WorkspacePolicySource
    policyPath?: string
    readinessStatus: ReadinessGateStatus
    readinessScore: number
    readinessBlockedCheckCount: number
    readinessWarningCheckCount: number
    readinessBlockedChecks: WorkspaceReadinessCheckSummary[]
    readinessWarningChecks: WorkspaceReadinessCheckSummary[]
    readinessPolicySource: WorkspaceReadinessPolicySource
    readinessPolicyPath?: string
    ciEvidenceSource: WorkspaceCiEvidenceSource
    ciEvidencePath?: string
    ciEvidenceCount: number
    latestCiStatus?: CiEvidenceStatus
    latestCiFinishedAt?: string
    releaseApprovalSource: WorkspaceReleaseApprovalSource
    releaseApprovalPath?: string
    releaseApprovalCount: number
    activeReleaseApprovalCount: number
    latestReleaseApprovalDecision?: ReleaseApprovalDecision
    releaseExceptionSource: WorkspaceReleaseExceptionSource
    releaseExceptionPath?: string
    releaseExceptionCount: number
    activeReleaseExceptionCount: number
    latestReleaseExceptionDecision?: ReleaseExceptionDecision
    findings: WorkspaceGovernanceFinding[]
  }

  interface WorkspaceGovernanceSummary {
    workspaceCount: number
    ready: number
    warning: number
    blocked: number
    componentCount: number
    policyViolationCount: number
    highSeverityPolicyViolationCount: number
    snapshotCount: number
    recentOperationCount: number
    failedOperationCount: number
    missingLockWorkspaceCount: number
    workspaceSnapshotCount: number
    inheritedSnapshotWorkspaceCount: number
    missingSnapshotWorkspaceCount: number
    inheritedSnapshotCoveredFileCount: number
    workspacePolicyCount: number
    inheritedPolicyWorkspaceCount: number
    missingPolicyWorkspaceCount: number
    readinessReady: number
    readinessWarning: number
    readinessBlocked: number
    workspaceReadinessPolicyCount: number
    inheritedReadinessPolicyWorkspaceCount: number
    defaultReadinessPolicyWorkspaceCount: number
    ciEvidenceRecordCount: number
    workspaceCiEvidenceCount: number
    inheritedCiEvidenceWorkspaceCount: number
    missingCiEvidenceWorkspaceCount: number
    failedCiEvidenceWorkspaceCount: number
    releaseApprovalRecordCount: number
    activeReleaseApprovalCount: number
    workspaceReleaseApprovalEvidenceCount: number
    inheritedReleaseApprovalEvidenceWorkspaceCount: number
    missingReleaseApprovalEvidenceWorkspaceCount: number
    rejectedReleaseApprovalWorkspaceCount: number
    releaseExceptionRecordCount: number
    activeReleaseExceptionCount: number
    workspaceReleaseExceptionEvidenceCount: number
    inheritedReleaseExceptionEvidenceWorkspaceCount: number
    missingReleaseExceptionEvidenceWorkspaceCount: number
    managers: DependencyManagerId[]
    byManager: Record<string, number>
  }

  interface WorkspaceGovernanceReport {
    generatedAt: string
    projectPath: string
    discovery: WorkspaceDiscoveryReport
    workspaces: WorkspaceGovernanceNode[]
    summary: WorkspaceGovernanceSummary
  }

  interface WorkspaceReleaseEvidenceManifest {
    generatedAt: string
    projectPath: string
    governanceGeneratedAt: string
    summary: WorkspaceGovernanceSummary
    workspaces: WorkspaceReleaseEvidenceWorkspace[]
  }

  interface WorkspaceReleaseEvidenceWorkspace {
    workspace: WorkspaceNode
    status: WorkspaceGovernanceStatus
    score: number
    managers: DependencyManagerId[]
    manifests: string[]
    lockfiles: string[]
    configs: string[]
    components: SupplyChainComponent[]
    componentError?: string
    snapshots: {
      source: WorkspaceSnapshotSource
      count: number
      latest?: SupplyChainSnapshotSummary
      path?: string
      coveredFileCount: number
      coveredFiles: string[]
      error?: string
    }
    operations: {
      recentCount: number
      failedCount: number
      failed: Array<Pick<OperationHistoryRecord, 'id' | 'command' | 'status' | 'finishedAt' | 'summary'>>
      error?: string
    }
    policy: {
      source: WorkspacePolicySource
      path?: string
      violationCount: number
      highSeverityViolationCount: number
    }
    readiness: {
      status: ReadinessGateStatus
      score: number
      policySource: WorkspaceReadinessPolicySource
      policyPath?: string
      blockedChecks: WorkspaceReadinessCheckSummary[]
      warningChecks: WorkspaceReadinessCheckSummary[]
    }
    ciEvidence: {
      source: WorkspaceCiEvidenceSource
      path?: string
      count: number
      latestStatus?: CiEvidenceStatus
      latestFinishedAt?: string
    }
    releaseApprovals: {
      source: WorkspaceReleaseApprovalSource
      path?: string
      count: number
      activeCount: number
      latestDecision?: ReleaseApprovalDecision
    }
    releaseExceptions: {
      source: WorkspaceReleaseExceptionSource
      path?: string
      count: number
      activeCount: number
      latestDecision?: ReleaseExceptionDecision
    }
    findings: WorkspaceGovernanceFinding[]
  }

  interface WorkspaceReleaseEvidenceExportResult {
    path: string
    format: WorkspaceReleaseEvidenceExportFormat
    generatedAt: string
    workspaceCount: number
    summary: WorkspaceGovernanceSummary
  }

  interface RemediationPlanItem {
    id: string
    scope: RemediationPlanItemScope
    source: RemediationPlanItemSource
    priority: RemediationPlanPriority
    title: string
    status: string
    summary: string
    recommendation: string
    evidence: string[]
    workspaceId?: string
    workspaceName?: string
    workspacePath?: string
    workspaceRelativePath?: string
    managers?: DependencyManagerId[]
  }

  interface WorkspaceRemediationPlanSummary {
    itemCount: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
    projectItemCount: number
    workspaceItemCount: number
    releaseRiskItemCount: number
    deploymentItemCount: number
    affectedWorkspaceCount: number
    blockedWorkspaceCount: number
    warningWorkspaceCount: number
    activeReleaseExceptionCount: number
  }

  interface WorkspaceRemediationPlan {
    generatedAt: string
    projectPath: string
    readinessGeneratedAt?: string
    governanceGeneratedAt?: string
    releaseRiskGeneratedAt?: string
    summary: WorkspaceRemediationPlanSummary
    items: RemediationPlanItem[]
  }

  interface WorkspaceRemediationPlanExportResult {
    path: string
    format: WorkspaceRemediationPlanExportFormat
    generatedAt: string
    itemCount: number
    summary: WorkspaceRemediationPlanSummary
  }

  interface WorkspaceUpdatePlanCommand {
    stage: WorkspaceUpdatePlanCommandStage
    command: string
    mutating: boolean
    dryRunCommand?: string
    purpose: string
  }

  interface WorkspaceUpdatePlanItem {
    id: string
    workspaceId: string
    workspaceName: string
    workspacePath: string
    workspaceRelativePath: string
    managerId: DependencyManagerId
    managerName: string
    ecosystem: string
    tool: string
    status: WorkspaceUpdatePlanItemStatus
    risk: WorkspaceUpdatePlanRisk
    componentCount: number
    manifestFiles: string[]
    lockFiles: string[]
    missingLockfile: boolean
    snapshotSource: WorkspaceSnapshotSource
    snapshotCount: number
    readinessStatus: ReadinessGateStatus
    readinessBlockedCheckCount: number
    readinessWarningCheckCount: number
    policySource: WorkspacePolicySource
    recentOperationCount: number
    failedOperationCount: number
    releaseExceptionCount: number
    commands: WorkspaceUpdatePlanCommand[]
    warnings: string[]
    evidence: string[]
    recommendation: string
  }

  interface WorkspaceUpdatePlanSummary {
    itemCount: number
    workspaceCount: number
    managerCount: number
    blocked: number
    needsReview: number
    ready: number
    highRisk: number
    mediumRisk: number
    missingLockfile: number
    missingSnapshot: number
    mutatingCommandCount: number
    dryRunCommandCount: number
    auditCommandCount: number
    lockCommandCount: number
  }

  interface WorkspaceUpdatePlan {
    generatedAt: string
    projectPath: string
    governanceGeneratedAt: string
    summary: WorkspaceUpdatePlanSummary
    items: WorkspaceUpdatePlanItem[]
  }

  interface WorkspaceUpdatePlanExportResult {
    path: string
    format: WorkspaceUpdatePlanExportFormat
    generatedAt: string
    itemCount: number
    summary: WorkspaceUpdatePlanSummary
  }

  interface WorkspaceSbomArtifact {
    workspaceId: string
    workspaceName: string
    relativePath: string
    status: WorkspaceGovernanceStatus
    managers: DependencyManagerId[]
    path: string
    format: WorkspaceSbomExportFormat
    componentCount: number
  }

  interface WorkspaceSbomManifest {
    generatedAt: string
    projectPath: string
    format: WorkspaceSbomExportFormat
    workspaceCount: number
    componentCount: number
    artifacts: WorkspaceSbomArtifact[]
  }

  interface WorkspaceSbomExportResult {
    path: string
    format: WorkspaceSbomExportFormat
    generatedAt: string
    workspaceCount: number
    componentCount: number
    artifacts: WorkspaceSbomArtifact[]
  }

  interface ReleaseBundleArtifact {
    id: string
    kind: ReleaseBundleArtifactKind
    label: string
    format: string
    path?: string
    ok: boolean
    required: boolean
    sha256?: string
    sizeBytes?: number
    workspaceCount?: number
    componentCount?: number
    count?: number
    status?: string
    error?: string
  }

  interface ReleaseBundleManifest {
    generatedAt: string
    projectPath: string
    status: ReadinessGateStatus
    score: number
    summary: {
      workspaceCount: number
      readyWorkspaces: number
      warningWorkspaces: number
      blockedWorkspaces: number
      componentCount: number
      artifactCount: number
      failedArtifactCount: number
      requiredArtifactCount: number
      requiredFailedArtifactCount: number
      optionalFailedArtifactCount: number
    }
    artifacts: ReleaseBundleArtifact[]
  }

  interface ReleaseBundleExportResult {
    path: string
    markdownPath: string
    generatedAt: string
    status: ReadinessGateStatus
    score: number
    artifactCount: number
    failedArtifactCount: number
    summary: ReleaseBundleManifest['summary']
  }

  interface ReleaseDashboardExportResult {
    path: string
    bundleManifestPath: string
    markdownPath: string
    generatedAt: string
    status: ReadinessGateStatus
    score: number
    artifactCount: number
    failedArtifactCount: number
    summary: ReleaseBundleManifest['summary']
  }

  interface DependencyHealthDashboardSummary {
    status: ReadinessGateStatus
    score: number
    componentCount: number
    workspaceCount: number
    managerCount: number
    managers: DependencyManagerId[]
    policyViolationCount: number
    criticalPolicyViolationCount: number
    highPolicyViolationCount: number
    mediumPolicyViolationCount: number
    licenseRiskCount: number
    blockedLicenseComponentCount: number
    unknownLicenseComponentCount: number
    dependencyChangeCount: number
    criticalDependencyRiskCount: number
    highDependencyRiskCount: number
    mediumDependencyRiskCount: number
    auditFindingCount: number
    auditCriticalFindingCount: number
    auditHighFindingCount: number
    readinessBlockedCheckCount: number
    readinessWarningCheckCount: number
    blockedWorkspaceCount: number
    warningWorkspaceCount: number
    lockfileDriftFindingCount: number
    lockfileDriftBlockedCount: number
    runtimePinningFindingCount: number
    runtimePinningBlockedCount: number
    offlineCacheFindingCount: number
    offlineCacheBlockedCount: number
    registryEndpointCount: number
    unreachableRegistryCount: number
    insecureRegistryCount: number
    credentialEndpointCount: number
    missingCredentialEndpointCount: number
    insecureCredentialEndpointCount: number
    weakCredentialMatchCount: number
    releaseRiskFindingCount: number
    releaseRiskCriticalCount: number
    releaseRiskHighCount: number
    floatingExecutionRiskCount: number
    deploymentReferenceCount: number
    floatingDeploymentRefCount: number
    deploymentBaselineEvidenceCount: number
    missingDeploymentBaselineCount: number
    blockingRiskCount: number
    warningRiskCount: number
    sourceErrorCount: number
  }

  interface DependencyHealthDashboardExportResult {
    path: string
    generatedAt: string
    status: ReadinessGateStatus
    score: number
    componentCount: number
    workspaceCount: number
    riskCount: number
    summary: DependencyHealthDashboardSummary
  }

  type FrameworkCoverageGapSeverity = 'info' | 'warning'
  type FrameworkCoverageGapType =
    | 'dedicated-page'
    | 'health-scan'
    | 'search'
    | 'lockfile'
    | 'production-tooling'

  interface FrameworkCoverageManagerRecord {
    id: DependencyManagerId
    name: string
    shortName: string
    language: string
    ecosystem: string
    packageManager: string
    category: string
    route: string
    routeLabel: string
    implemented: boolean
    builtIn: boolean
    status: ManagerImplementationStatus
    searchable: boolean
    healthSupported: boolean
    tools: string[]
    manifestFiles: string[]
    lockFiles: string[]
    configFiles: string[]
    scopes: ManagerScope[]
    capabilities: ManagerCapability[]
    productionTools: string[]
    scenarios: string[]
  }

  interface FrameworkCoverageRouteGroup {
    route: string
    label: string
    managerCount: number
    implementedCount: number
    stableCount: number
    previewCount: number
    plannedCount: number
    managerIds: DependencyManagerId[]
  }

  interface FrameworkCoverageGap {
    id: string
    managerId: DependencyManagerId
    managerName: string
    type: FrameworkCoverageGapType
    severity: FrameworkCoverageGapSeverity
    message: string
  }

  interface FrameworkCoverageSummary {
    managerCount: number
    implementedCount: number
    stableCount: number
    previewCount: number
    plannedCount: number
    languageCount: number
    ecosystemCount: number
    categoryCount: number
    routeGroupCount: number
    workspaceRoutedCount: number
    searchableCount: number
    healthSupportedCount: number
    publishWorkflowCount: number
    auditWorkflowCount: number
    lockfileWorkflowCount: number
    sbomWorkflowCount: number
    implementationCoveragePercent: number
    healthCoveragePercent: number
    gapCount: number
    warningGapCount: number
    categoryCounts: Record<string, number>
    scopeCounts: Record<ManagerScope, number>
    capabilityCounts: Record<ManagerCapability, number>
  }

  interface FrameworkCoverageReport {
    generatedAt: string
    projectPath?: string
    managers: FrameworkCoverageManagerRecord[]
    routeGroups: FrameworkCoverageRouteGroup[]
    gaps: FrameworkCoverageGap[]
    summary: FrameworkCoverageSummary
  }

  interface FrameworkCoverageExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    managerCount: number
    gapCount: number
    summary: FrameworkCoverageSummary
  }

  type ReportArtifactCategory =
    | 'inventory'
    | 'workspace'
    | 'release'
    | 'risk'
    | 'evidence'
    | 'automation'
    | 'policy'
    | 'security'
    | 'reproducibility'
    | 'operations'
    | 'other'
  type ReportArtifactFormat =
    | 'markdown'
    | 'json'
    | 'html'
    | 'yaml'
    | 'text'
    | 'calendar'
    | 'codeowners'
    | 'sbom'
    | 'unknown'

  interface ReportArtifactRecord {
    id: string
    name: string
    category: ReportArtifactCategory
    format: ReportArtifactFormat
    path: string
    relativePath: string
    sizeBytes: number
    sha256: string
    modifiedAt: string
  }

  interface ReportArtifactIndexSummary {
    artifactCount: number
    totalSizeBytes: number
    latestModifiedAt?: string
    categoryCounts: Record<ReportArtifactCategory, number>
    formatCounts: Record<ReportArtifactFormat, number>
  }

  interface ReportArtifactIndexReport {
    generatedAt: string
    projectPath: string
    reportDir: string
    artifacts: ReportArtifactRecord[]
    summary: ReportArtifactIndexSummary
  }

  interface ReportArtifactIndexExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    artifactCount: number
    totalSizeBytes: number
    summary: ReportArtifactIndexSummary
  }

  type ReleaseEvidenceCompletenessStatus = 'ready' | 'warning' | 'blocked'
  type ReleaseEvidenceCompletenessSeverity = 'info' | 'warning' | 'blocked'
  type ReleaseEvidenceCompletenessSource =
    | 'policy-as-code'
    | 'release-bundle'
    | 'report-library'
    | 'release-evidence'

  interface ReleaseEvidenceExpectedArtifact {
    id: string
    source: ReleaseEvidenceCompletenessSource
    label: string
    required: boolean
    expectedPath?: string
    expectedSha256?: string
    expectedSizeBytes?: number
    status: 'present' | 'missing' | 'failed' | 'mismatch'
    integrityStatus: 'not-applicable' | 'verified' | 'mismatch'
    matchedArtifactCount: number
    matchedArtifacts: Array<Pick<ReportArtifactRecord, 'id' | 'name' | 'category' | 'format' | 'relativePath' | 'sizeBytes' | 'sha256' | 'modifiedAt'>>
    mismatchReasons: string[]
    error?: string
  }

  interface ReleaseEvidenceCompletenessFinding {
    id: string
    severity: ReleaseEvidenceCompletenessSeverity
    source: ReleaseEvidenceCompletenessSource
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface ReleaseEvidenceCompletenessSummary {
    status: ReleaseEvidenceCompletenessStatus
    expectedArtifactCount: number
    requiredArtifactCount: number
    presentArtifactCount: number
    missingArtifactCount: number
    missingRequiredArtifactCount: number
    failedArtifactCount: number
    failedRequiredArtifactCount: number
    integrityMismatchCount: number
    requiredIntegrityMismatchCount: number
    policyRequiredArtifactCount: number
    releaseBundleArtifactCount: number
    releaseBundleRequiredArtifactCount: number
    reportArtifactCount: number
    totalSizeBytes: number
    latestModifiedAt?: string
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
  }

  interface ReleaseEvidenceCompletenessReport {
    generatedAt: string
    projectPath: string
    reportDir: string
    status: ReleaseEvidenceCompletenessStatus
    summary: ReleaseEvidenceCompletenessSummary
    expectedArtifacts: ReleaseEvidenceExpectedArtifact[]
    findings: ReleaseEvidenceCompletenessFinding[]
    sources: {
      reportArtifacts: {
        generatedAt: string
        summary: ReportArtifactIndexSummary
      }
      policyAsCode?: {
        generatedAt: string
        status: PolicyAsCodeStatus
        summary: PolicyAsCodeSummary
      }
      releaseBundle?: {
        generatedAt: string
        status: ReadinessGateStatus
        score: number
        summary: ReleaseBundleManifest['summary']
      }
      releaseBundleManifestPath?: string
      errors: Partial<Record<ReleaseEvidenceCompletenessSource, string>>
    }
  }

  interface ReleaseEvidenceCompletenessExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: ReleaseEvidenceCompletenessStatus
    findingCount: number
    count: number
    summary: ReleaseEvidenceCompletenessSummary
  }

  type ReleaseProvenanceAttestationStatus = 'ready' | 'warning' | 'blocked'
  type ReleaseProvenanceAttestationExportFormat = 'markdown' | 'json'
  type ReleaseProvenanceSource =
    | 'project'
    | 'git'
    | 'report-library'
    | 'release-bundle'
    | 'release-evidence'

  interface ReleaseProvenanceProjectInfo {
    path: string
    name: string
    version?: string
    packageManager?: string
    manifestPath?: string
  }

  interface ReleaseProvenanceGitInfo {
    available: boolean
    branch?: string
    commit?: string
    shortCommit?: string
    commitDate?: string
    dirty?: boolean
    changedFileCount?: number
    remoteUrl?: string
    error?: string
  }

  interface ReleaseProvenanceEvidenceDigest {
    id: string
    label: string
    category: ReportArtifactCategory
    format: ReportArtifactFormat
    relativePath: string
    sizeBytes: number
    sha256: string
    modifiedAt: string
  }

  interface ReleaseProvenanceAttestationSummary {
    status: ReleaseProvenanceAttestationStatus
    artifactCount: number
    totalSizeBytes: number
    releaseBundleArtifactCount: number
    requiredBundleArtifactCount: number
    failedBundleArtifactCount: number
    requiredFailedBundleArtifactCount: number
    policyRequiredArtifactCount: number
    missingRequiredEvidenceCount: number
    failedRequiredEvidenceCount: number
    integrityMismatchCount: number
    requiredIntegrityMismatchCount: number
    blockedEvidenceFindingCount: number
    warningEvidenceFindingCount: number
    sourceErrorCount: number
    gitDirty: boolean
    gitAvailable: boolean
    selfReferencedEvidenceCount: number
  }

  interface ReleaseProvenanceAttestationReport {
    generatedAt: string
    projectPath: string
    project: ReleaseProvenanceProjectInfo
    status: ReleaseProvenanceAttestationStatus
    summary: ReleaseProvenanceAttestationSummary
    git: ReleaseProvenanceGitInfo
    releaseBundle?: {
      generatedAt: string
      status: ReadinessGateStatus
      score: number
      summary: ReleaseBundleManifest['summary']
    }
    evidenceCompleteness?: {
      generatedAt: string
      status: ReleaseEvidenceCompletenessStatus
      summary: ReleaseEvidenceCompletenessSummary
    }
    artifacts: ReleaseProvenanceEvidenceDigest[]
    sources: {
      reportArtifacts: {
        generatedAt: string
        summary: ReportArtifactIndexSummary
      }
      releaseBundleManifestPath: string
      errors: Partial<Record<ReleaseProvenanceSource, string>>
    }
  }

  interface ReleaseProvenanceAttestationExportResult {
    path: string
    format: ReleaseProvenanceAttestationExportFormat
    generatedAt: string
    status: ReleaseProvenanceAttestationStatus
    artifactCount: number
    summary: ReleaseProvenanceAttestationSummary
  }

  type ReleaseIntegrityVerificationStatus = 'ready' | 'warning' | 'blocked'
  type ReleaseIntegrityVerificationSeverity = 'info' | 'warning' | 'blocked'
  type ReleaseIntegrityArtifactStatus =
    | 'verified'
    | 'missing'
    | 'mismatch'
    | 'failed-recorded'
    | 'unverifiable'
  type ReleaseIntegrityProvenanceStatus =
    | 'matched'
    | 'mismatch'
    | 'not-recorded'
    | 'not-available'

  interface ReleaseIntegrityVerifiedArtifact {
    id: string
    kind: ReleaseBundleArtifactKind
    label: string
    format: string
    required: boolean
    ok: boolean
    path?: string
    relativePath?: string
    expectedSha256?: string
    actualSha256?: string
    expectedSizeBytes?: number
    actualSizeBytes?: number
    status: ReleaseIntegrityArtifactStatus
    provenanceStatus: ReleaseIntegrityProvenanceStatus
    provenanceSha256?: string
    provenanceSizeBytes?: number
    issues: string[]
    error?: string
  }

  interface ReleaseIntegrityVerificationFinding {
    id: string
    severity: ReleaseIntegrityVerificationSeverity
    artifactId?: string
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface ReleaseIntegrityVerificationSummary {
    status: ReleaseIntegrityVerificationStatus
    artifactCount: number
    requiredArtifactCount: number
    verifiedArtifactCount: number
    missingArtifactCount: number
    mismatchArtifactCount: number
    failedRecordedArtifactCount: number
    unverifiableArtifactCount: number
    requiredMissingArtifactCount: number
    requiredMismatchArtifactCount: number
    requiredFailedRecordedArtifactCount: number
    requiredUnverifiableArtifactCount: number
    provenanceMatchedArtifactCount: number
    provenanceMismatchArtifactCount: number
    provenanceNotRecordedArtifactCount: number
    provenanceAvailable: boolean
    sourceErrorCount: number
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
  }

  interface ReleaseIntegrityVerificationReport {
    generatedAt: string
    projectPath: string
    status: ReleaseIntegrityVerificationStatus
    summary: ReleaseIntegrityVerificationSummary
    releaseBundle?: {
      generatedAt: string
      status: ReadinessGateStatus
      score: number
      summary: ReleaseBundleManifest['summary']
    }
    provenance?: {
      generatedAt: string
      status: ReleaseProvenanceAttestationStatus
      summary: ReleaseProvenanceAttestationSummary
      git: ReleaseProvenanceGitInfo
      project: ReleaseProvenanceProjectInfo
    }
    artifacts: ReleaseIntegrityVerifiedArtifact[]
    findings: ReleaseIntegrityVerificationFinding[]
    sources: {
      releaseBundleManifestPath: string
      provenanceAttestationPath: string
      errors: Partial<Record<'release-bundle' | 'provenance-attestation', string>>
    }
  }

  interface ReleaseIntegrityVerificationExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: ReleaseIntegrityVerificationStatus
    artifactCount: number
    findingCount: number
    summary: ReleaseIntegrityVerificationSummary
  }

  type ReleaseSignatureStatus = 'ready' | 'warning' | 'blocked'
  type ReleaseSignatureSeverity = 'info' | 'warning' | 'blocked'
  type ReleaseSignatureSourceId =
    | 'release-bundle'
    | 'release-provenance-attestation'
    | 'release-integrity-verification'
  type ReleaseSignatureSourceStatus = 'included' | 'missing' | 'error'
  type ReleaseSignatureEnvelopeStatus = 'signed' | 'unsigned'
  type ReleaseSignatureAlgorithm = 'HMAC-SHA256' | 'SHA-256-DIGEST'
  type ReleaseSignatureVerificationStatus =
    | 'created'
    | 'verified'
    | 'not-signed'
    | 'unsigned'
    | 'key-unavailable'
    | 'mismatch'
    | 'invalid'

  interface ReleaseSignatureSource {
    id: ReleaseSignatureSourceId
    label: string
    required: boolean
    path: string
    relativePath: string
    status: ReleaseSignatureSourceStatus
    sha256?: string
    sizeBytes?: number
    generatedAt?: string
    reportStatus?: string
    error?: string
  }

  interface ReleaseSignaturePayloadSource {
    id: ReleaseSignatureSourceId
    relativePath: string
    sha256: string
    sizeBytes: number
    generatedAt?: string
    reportStatus?: string
  }

  interface ReleaseSignaturePayload {
    schemaVersion: 'release-signature-v1'
    purpose: 'DependencyHub Desktop.release-evidence'
    sourceCount: number
    includedSourceCount: number
    sources: ReleaseSignaturePayloadSource[]
    canonicalJson: string
    sha256: string
  }

  interface ReleaseSignatureEnvelope {
    status: ReleaseSignatureEnvelopeStatus
    algorithm: ReleaseSignatureAlgorithm
    signer: string
    signedAt: string
    payloadSha256: string
    keyId?: string
    value?: string
  }

  interface ReleaseSignatureVerification {
    status: ReleaseSignatureVerificationStatus
    verified: boolean
    checkedAt: string
    signaturePath: string
    details: string[]
    existingSignedAt?: string
    existingSigner?: string
    existingKeyId?: string
  }

  interface ReleaseSignatureFinding {
    id: string
    severity: ReleaseSignatureSeverity
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface ReleaseSignatureSummary {
    status: ReleaseSignatureStatus
    sourceCount: number
    requiredSourceCount: number
    includedSourceCount: number
    missingSourceCount: number
    sourceErrorCount: number
    blockedSourceReportCount: number
    warningSourceReportCount: number
    signed: boolean
    hasSigningKey: boolean
    verificationStatus: ReleaseSignatureVerificationStatus
    findingCount: number
    blockedFindingCount: number
    warningFindingCount: number
  }

  interface ReleaseSignatureReport {
    generatedAt: string
    projectPath: string
    status: ReleaseSignatureStatus
    summary: ReleaseSignatureSummary
    payload: ReleaseSignaturePayload
    signature: ReleaseSignatureEnvelope
    verification: ReleaseSignatureVerification
    sources: ReleaseSignatureSource[]
    findings: ReleaseSignatureFinding[]
  }

  interface ReleaseSignatureExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: ReleaseSignatureStatus
    signed: boolean
    verificationStatus: ReleaseSignatureVerificationStatus
    sourceCount: number
    findingCount: number
    summary: ReleaseSignatureSummary
  }

  type ReleaseTrustPolicyStatus = 'ready' | 'warning' | 'blocked'
  type ReleaseTrustPolicyCheckStatus = 'passed' | 'warning' | 'blocked' | 'info'
  type ReleaseTrustPolicySeverity = 'info' | 'warning' | 'blocked'
  type ReleaseTrustPolicySource =
    | 'release-signature'
    | 'release-integrity'
    | 'release-provenance'
    | 'release-evidence'
    | 'release-approval'
    | 'release-exception'

  interface ReleaseTrustPolicyCheck {
    id: string
    source: ReleaseTrustPolicySource
    status: ReleaseTrustPolicyCheckStatus
    title: string
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface ReleaseTrustPolicySummary {
    status: ReleaseTrustPolicyStatus
    checkCount: number
    passedCheckCount: number
    warningCheckCount: number
    blockedCheckCount: number
    infoCheckCount: number
    sourceErrorCount: number
    signed: boolean
    signatureVerified: boolean
    integrityVerifiedArtifactCount: number
    integrityRequiredMismatchCount: number
    provenanceGitAvailable: boolean
    provenanceGitDirty: boolean
    evidenceMissingRequiredCount: number
    evidenceIntegrityMismatchCount: number
    approvalRecordCount: number
    activeExceptionCount: number
  }

  interface ReleaseTrustPolicyReport {
    generatedAt: string
    projectPath: string
    status: ReleaseTrustPolicyStatus
    summary: ReleaseTrustPolicySummary
    checks: ReleaseTrustPolicyCheck[]
    sources: {
      signature?: {
        generatedAt: string
        status: ReleaseSignatureStatus
        summary: ReleaseSignatureSummary
        signature: ReleaseSignatureEnvelope
        verification: ReleaseSignatureVerification
      }
      integrity?: {
        generatedAt: string
        status: ReleaseIntegrityVerificationStatus
        summary: ReleaseIntegrityVerificationSummary
      }
      provenance?: {
        generatedAt: string
        status: ReleaseProvenanceAttestationStatus
        summary: ReleaseProvenanceAttestationSummary
        git: ReleaseProvenanceGitInfo
        project: ReleaseProvenanceProjectInfo
      }
      evidence?: {
        generatedAt: string
        status: ReleaseEvidenceCompletenessStatus
        summary: ReleaseEvidenceCompletenessSummary
      }
      approvals?: {
        generatedAt: string
        summary: ReleaseApprovalSummary
      }
      exceptions?: {
        generatedAt: string
        summary: ReleaseExceptionSummary
      }
      errors: Partial<Record<ReleaseTrustPolicySource, string>>
    }
  }

  interface ReleaseTrustPolicyExportResult {
    path: string
    format: 'markdown' | 'json'
    generatedAt: string
    status: ReleaseTrustPolicyStatus
    checkCount: number
    summary: ReleaseTrustPolicySummary
  }

  interface WorkspaceGovernanceExportResult {
    path: string
    format: WorkspaceGovernanceExportFormat
    generatedAt: string
    workspaceCount: number
    summary: WorkspaceGovernanceSummary
  }

  type ReadinessGateStatus = 'ready' | 'warning' | 'blocked'
  type ReadinessGateCheckStatus = 'passed' | 'warning' | 'blocked' | 'info'
  type ReadinessGateSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
  type ReadinessGateExportFormat = 'markdown' | 'json'

  interface ReadinessPolicy {
    recentOperationDays: number
    snapshotStaleDays: number
    blockOnMissingSnapshots: boolean
    blockOnStaleSnapshots: boolean
    blockOnMissingTools: boolean
    blockOnFailedMutatingOperations: boolean
    maxHighRiskDependencyChanges: number
    maxMediumRiskDependencyChanges: number
    maxHighSeverityPolicyViolations: number
    maxPolicyWarnings: number
    maxPolicyViolations: number
    maxRecentFailedPublishOperations: number
    maxRecentFailedMutatingOperations: number
    ciEvidenceMaxAgeDays: number
    blockOnMissingCiEvidence: boolean
    blockOnStaleCiEvidence: boolean
    blockOnFailedCiEvidence: boolean
    auditEvidenceMaxAgeDays: number
    blockOnMissingAuditEvidence: boolean
    blockOnStaleAuditEvidence: boolean
    maxCriticalAuditFindings: number
    maxHighAuditFindings: number
    maxMediumAuditFindings: number
    blockOnCriticalAuditFindings: boolean
    blockOnHighAuditFindings: boolean
    requiredReleaseApprovals: number
    releaseApprovalMaxAgeDays: number
    blockOnMissingReleaseApprovals: boolean
    blockOnRejectedReleaseApproval: boolean
    registryReachabilityTimeoutMs: number
    blockOnMissingRegistryEndpoints: boolean
    blockOnUnreachableRegistries: boolean
    blockOnInsecureRegistries: boolean
    maxUnreachableRegistries: number
    maxLockfileDriftWarnings: number
    blockOnLockfileDrift: boolean
    maxRuntimePinningWarnings: number
    blockOnRuntimePinning: boolean
    blockOnFloatingContainerTags: boolean
    maxFloatingDeploymentRefs: number
    blockOnFloatingDeploymentRefs: boolean
    maxMissingDeploymentBaselines: number
    blockOnMissingDeploymentBaselines: boolean
    maxMissingCredentialEndpoints: number
    blockOnMissingCredentialEndpoints: boolean
    blockOnInsecureCredentialUsage: boolean
    maxWeakCredentialMatches: number
    blockOnWeakCredentialMatches: boolean
    maxUnusedCredentials: number
    blockOnUnusedCredentials: boolean
    minimumScore: number
    blockBelowMinimumScore: boolean
  }

  interface ReadinessPolicyFile {
    path: string
    policy: ReadinessPolicy
  }

  interface ReadinessGateCheck {
    id: string
    title: string
    status: ReadinessGateCheckStatus
    severity: ReadinessGateSeverity
    passed: boolean
    summary: string
    recommendation: string
    evidence: string[]
  }

  interface ReadinessGateSummary {
    detectedManagerCount: number
    detectedManagers: DependencyManagerId[]
    implementedManagerCount: number
    extendedManagerCount: number
    componentCount: number
    policyViolationCount: number
    snapshotCount: number
    recentOperationCount: number
    failedOperationCount: number
    requiredToolCount: number
    missingToolCount: number
    dependencyChangeCount: number
    dependencyHighRiskCount: number
    dependencyMediumRiskCount: number
    dependencyMajorUpdateCount: number
    dependencyPrereleaseChangeCount: number
    ciEvidenceCount: number
    latestCiStatus?: CiEvidenceStatus
    latestCiFinishedAt?: string
    auditEvidenceSourceCount: number
    auditEvidenceFindingCount: number
    auditCriticalFindingCount: number
    auditHighFindingCount: number
    auditMediumFindingCount: number
    auditFixAvailableCount: number
    latestAuditImportedAt?: string
    releaseApprovalCount: number
    activeReleaseApprovalCount: number
    latestReleaseApprovalDecision?: ReleaseApprovalDecision
    releaseExceptionCount: number
    activeReleaseExceptionCount: number
    exceptionedCheckCount: number
    registryEndpointCount: number
    unreachableRegistryCount: number
    insecureRegistryCount: number
    workspaceCount: number
    explicitWorkspaceCount: number
    workspaceManagerCount: number
    lockfileDriftFindingCount: number
    lockfileDriftBlockedCount: number
    lockfileDriftWarningCount: number
    runtimePinningFindingCount: number
    runtimePinningBlockedCount: number
    runtimePinningWarningCount: number
    floatingContainerTagCount: number
    deploymentReferenceCount: number
    floatingDeploymentRefCount: number
    deploymentBaselineEvidenceCount: number
    missingDeploymentBaselineCount: number
    credentialEndpointCount: number
    missingCredentialEndpointCount: number
    weakCredentialMatchCount: number
    insecureCredentialStorageEndpointCount: number
    insecureCredentialEndpointCount: number
    unusedCredentialCount: number
    credentialStorage?: string
  }

  interface ReadinessGateReport {
    generatedAt: string
    projectPath: string
    status: ReadinessGateStatus
    score: number
    policy: ReadinessPolicyFile
    summary: ReadinessGateSummary
    checks: ReadinessGateCheck[]
  }

  interface ReadinessGateExportResult {
    path: string
    format: ReadinessGateExportFormat
    generatedAt: string
    status: ReadinessGateStatus
    score: number
  }

  interface DependencyHealthAction {
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

  interface DependencyHealthIssue {
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

  interface DependencyHealthSummary {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }

  interface DependencyHealthScanResult {
    manager: DependencyHealthManager
    cwd: string
    scannedAt: string
    summary: DependencyHealthSummary
    issues: DependencyHealthIssue[]
    raw?: string
  }
  
  interface FileChangeData {
    type: 'package.json'
    path: string
  }

  interface InstallArgs {
    packageName: string
    cwd?: string
    global?: boolean
    dev?: boolean
    version?: string
  }

  interface UninstallArgs {
    packageName: string
    cwd?: string
    global?: boolean
  }

  interface UpdateArgs {
    packageName?: string
    cwd?: string
    global?: boolean
    version?: string
  }

  interface PublishArgs {
    cwd: string
    tag?: string
    access?: 'public' | 'restricted'
    registry?: string
    credentialId?: string
    token?: string
    overrideReadinessGate?: boolean
  }

  interface MoveDepArgs {
    packageName: string
    cwd: string
    from: 'dependencies' | 'devDependencies'
    to: 'dependencies' | 'devDependencies'
  }

  interface InstallVersionArgs {
    packageName: string
    version: string
    cwd?: string
    global?: boolean
    dev?: boolean
  }
}

export {}
