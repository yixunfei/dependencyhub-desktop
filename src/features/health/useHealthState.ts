import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'


type ScanState = Record<string, DependencyHealthScanResult | { error: string }>

export function useHealthState() {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([])
  const [plugins, setPlugins] = useState<PackageManagerPlugin[]>([])
  const [scans, setScans] = useState<ScanState>({})
  const [supplyChainReport, setSupplyChainReport] = useState<SupplyChainReport | null>(null)
  const [licenseReport, setLicenseReport] = useState<LicenseComplianceReport | null>(null)
  const [thirdPartyNotices, setThirdPartyNotices] = useState<ThirdPartyNoticesReport | null>(null)
  const [snapshots, setSnapshots] = useState<SupplyChainSnapshotSummary[]>([])
  const [operationHistory, setOperationHistory] = useState<OperationHistoryRecord[]>([])
  const [ciEvidence, setCiEvidence] = useState<CiEvidenceRecord[]>([])
  const [auditEvidence, setAuditEvidence] = useState<AuditEvidenceReport | null>(null)
  const [vulnerabilityRemediationPlan, setVulnerabilityRemediationPlan] = useState<VulnerabilityRemediationPlanReport | null>(null)
  const [releaseApprovals, setReleaseApprovals] = useState<ReleaseApprovalRecord[]>([])
  const [releaseExceptions, setReleaseExceptions] = useState<ReleaseExceptionRecord[]>([])
  const [registryEndpoints, setRegistryEndpoints] = useState<RegistryEndpoint[]>([])
  const [registryReport, setRegistryReport] = useState<RegistryReachabilityReport | null>(null)
  const [workspaceReport, setWorkspaceReport] = useState<WorkspaceDiscoveryReport | null>(null)
  const [workspaceGovernanceReport, setWorkspaceGovernanceReport] = useState<WorkspaceGovernanceReport | null>(null)
  const [readinessReport, setReadinessReport] = useState<ReadinessGateReport | null>(null)
  const [offlineCacheReport, setOfflineCacheReport] = useState<OfflineCacheReadinessReport | null>(null)
  const [releaseRiskProfile, setReleaseRiskProfile] = useState<ReleaseRiskProfileReport | null>(null)
  const [ciIntegrationPlan, setCiIntegrationPlan] = useState<CiIntegrationPlanReport | null>(null)
  const [dependencyAutomationPlan, setDependencyAutomationPlan] = useState<DependencyAutomationPlanReport | null>(null)
  const [credentialRotationPlan, setCredentialRotationPlan] = useState<CredentialRotationPlanReport | null>(null)
  const [automationSafetyPlan, setAutomationSafetyPlan] = useState<AutomationSafetyPlanReport | null>(null)
  const [dependencyOwnershipPlan, setDependencyOwnershipPlan] = useState<DependencyOwnershipPlanReport | null>(null)
  const [dependencyUpgradePlaybook, setDependencyUpgradePlaybook] = useState<DependencyUpgradePlaybookReport | null>(null)
  const [dependencyRollbackPlan, setDependencyRollbackPlan] = useState<DependencyRollbackPlanReport | null>(null)
  const [dependencyImpactAnalysis, setDependencyImpactAnalysis] = useState<DependencyImpactAnalysisReport | null>(null)
  const [dependencyChangeApprovalPacket, setDependencyChangeApprovalPacket] = useState<DependencyChangeApprovalPacketReport | null>(null)
  const [dependencyChangeCalendar, setDependencyChangeCalendar] = useState<DependencyChangeCalendarReport | null>(null)
  const [dependencyChangeExecutionRecord, setDependencyChangeExecutionRecord] = useState<DependencyChangeExecutionReport | null>(null)
  const [policyAsCodePack, setPolicyAsCodePack] = useState<PolicyAsCodeReport | null>(null)
  const [reportArtifactIndex, setReportArtifactIndex] = useState<ReportArtifactIndexReport | null>(null)
  const [releaseEvidenceCompleteness, setReleaseEvidenceCompleteness] = useState<ReleaseEvidenceCompletenessReport | null>(null)
  const [releaseProvenanceAttestation, setReleaseProvenanceAttestation] = useState<ReleaseProvenanceAttestationReport | null>(null)
  const [releaseIntegrityVerification, setReleaseIntegrityVerification] = useState<ReleaseIntegrityVerificationReport | null>(null)
  const [releaseSignature, setReleaseSignature] = useState<ReleaseSignatureReport | null>(null)
  const [releaseTrustPolicy, setReleaseTrustPolicy] = useState<ReleaseTrustPolicyReport | null>(null)
  const [frameworkCoverage, setFrameworkCoverage] = useState<FrameworkCoverageReport | null>(null)
  const [snapshotDiff, setSnapshotDiff] = useState<SupplyChainSnapshotDiff | null>(null)
  const [dependencyDiff, setDependencyDiff] = useState<DependencyComponentDiff | null>(null)
  const [policyEvaluation, setPolicyEvaluation] = useState<DependencyPolicyEvaluation | null>(null)
  const [policyEditorOpen, setPolicyEditorOpen] = useState(false)
  const [readinessPolicyEditorOpen, setReadinessPolicyEditorOpen] = useState(false)
  const [scanning, setScanning] = useState<string>('')
  const [reporting, setReporting] = useState(false)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | OperationHistoryStatus>('all')
  const [historyManagerFilter, setHistoryManagerFilter] = useState<string>('all')
  const [historyChangeFilter, setHistoryChangeFilter] = useState<'all' | 'mutating' | 'readonly'>('all')
  const [artifactCategoryFilter, setArtifactCategoryFilter] = useState<'all' | ReportArtifactCategory>('all')
  const [artifactFormatFilter, setArtifactFormatFilter] = useState<'all' | ReportArtifactFormat>('all')
  const [artifactSearchTerm, setArtifactSearchTerm] = useState('')
  return {
    navigate, currentPath, setCurrentPath, addNotification, projectInfo, setProjectInfo, toolStatuses,
    setToolStatuses, plugins, setPlugins, scans, setScans, supplyChainReport, setSupplyChainReport,
    licenseReport, setLicenseReport, thirdPartyNotices, setThirdPartyNotices, snapshots, setSnapshots,
    operationHistory, setOperationHistory, ciEvidence, setCiEvidence, auditEvidence, setAuditEvidence,
    vulnerabilityRemediationPlan, setVulnerabilityRemediationPlan, releaseApprovals, setReleaseApprovals,
    releaseExceptions, setReleaseExceptions, registryEndpoints, setRegistryEndpoints, registryReport,
    setRegistryReport, workspaceReport, setWorkspaceReport, workspaceGovernanceReport,
    setWorkspaceGovernanceReport, readinessReport, setReadinessReport, offlineCacheReport,
    setOfflineCacheReport, releaseRiskProfile, setReleaseRiskProfile, ciIntegrationPlan,
    setCiIntegrationPlan, dependencyAutomationPlan, setDependencyAutomationPlan, credentialRotationPlan,
    setCredentialRotationPlan, automationSafetyPlan, setAutomationSafetyPlan, dependencyOwnershipPlan,
    setDependencyOwnershipPlan, dependencyUpgradePlaybook, setDependencyUpgradePlaybook,
    dependencyRollbackPlan, setDependencyRollbackPlan, dependencyImpactAnalysis, setDependencyImpactAnalysis,
    dependencyChangeApprovalPacket, setDependencyChangeApprovalPacket, dependencyChangeCalendar,
    setDependencyChangeCalendar, dependencyChangeExecutionRecord, setDependencyChangeExecutionRecord,
    policyAsCodePack, setPolicyAsCodePack, reportArtifactIndex, setReportArtifactIndex,
    releaseEvidenceCompleteness, setReleaseEvidenceCompleteness, releaseProvenanceAttestation,
    setReleaseProvenanceAttestation, releaseIntegrityVerification, setReleaseIntegrityVerification,
    releaseSignature, setReleaseSignature, releaseTrustPolicy, setReleaseTrustPolicy, frameworkCoverage,
    setFrameworkCoverage, snapshotDiff, setSnapshotDiff, dependencyDiff, setDependencyDiff, policyEvaluation,
    setPolicyEvaluation, policyEditorOpen, setPolicyEditorOpen, readinessPolicyEditorOpen,
    setReadinessPolicyEditorOpen, scanning, setScanning, reporting, setReporting, historyStatusFilter,
    setHistoryStatusFilter, historyManagerFilter, setHistoryManagerFilter, historyChangeFilter,
    setHistoryChangeFilter, artifactCategoryFilter, setArtifactCategoryFilter, artifactFormatFilter,
    setArtifactFormatFilter, artifactSearchTerm, setArtifactSearchTerm
  }
}

export type HealthState = ReturnType<typeof useHealthState>
