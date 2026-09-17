
import type { HealthData } from '../healthData'
import {
  exportAutomationSafetyPlanAction, exportCiIntegrationPlanAction, exportCredentialRotationPlanAction,
  exportDependencyAutomationPlanAction, exportDependencyOwnershipPlanAction
} from './automationActions'
import {
  exportDependencyChangeApprovalPacketAction, exportDependencyChangeCalendarAction,
  exportDependencyChangeExecutionRecordAction, exportDependencyImpactAnalysisAction,
  exportDependencyRollbackPlanAction, exportDependencyUpgradePlaybookAction
} from './changeActions'
import {
  exportAuditEvidenceAction, exportCiEvidenceAction, exportOperationHistoryAction,
  exportReleaseApprovalsAction, exportReleaseExceptionsAction, exportVulnerabilityRemediationPlanAction,
  importAuditEvidenceAction, importCiEvidenceAction, recordManualCiEvidenceAction,
  recordReleaseApprovalAction, recordReleaseExceptionAction
} from './evidenceActions'
import {
  checkRegistriesAction, diffDependencyComponentsAction, exportCredentialUsageAction,
  exportDependencyDiffAction, exportInventoryAction, exportLicenseComplianceAction,
  exportLockfileDriftAction, exportOfflineCacheReadinessAction, exportRegistryReachabilityAction,
  exportRuntimePinningAction, exportSupplyChainAction, exportThirdPartyNoticesAction,
  scanDetectedManagersAction, scanManagerAction
} from './inventoryActions'
import {
  createSnapshotAction, diffLatestSnapshotAction, ensurePolicyAction, ensureReadinessPolicyAction,
  evaluatePolicyAction, exportPolicyAsCodePackAction, exportReadinessAction, handlePolicySavedAction,
  onReadinessPolicySavedAction, openSnapshotAction, restoreLatestSnapshotAction, restoreSnapshotAction,
  runReadinessGateAction
} from './policyActions'
import {
  exportDependencyHealthDashboardAction, exportFrameworkCoverageAction, exportReleaseBundleAction,
  exportReleaseDashboardAction, exportReleaseEvidenceCompletenessAction,
  exportReleaseIntegrityVerificationAction, exportReleaseProvenanceAttestationAction,
  exportReleaseRiskProfileAction, exportReleaseSignatureAction, exportReleaseTrustPolicyAction,
  exportReportArtifactIndexAction, openReportArtifactDirectoryAction, refreshFrameworkCoverageAction,
  refreshReleaseEvidenceCompletenessAction, refreshReleaseIntegrityVerificationAction,
  refreshReleaseProvenanceAttestationAction, refreshReleaseSignatureAction, refreshReleaseTrustPolicyAction,
  refreshReportArtifactIndexAction
} from './releaseActions'
import {
  exportRemediationPlanAction, exportWorkspaceGovernanceAction, exportWorkspaceReleaseEvidenceAction,
  exportWorkspacesAction, exportWorkspaceSbomsAction, exportWorkspaceUpdatePlanAction,
  scanWorkspaceGovernanceAction, scanWorkspacesAction
} from './workspaceActions'

function bindAction<Args extends unknown[], Result>(context: HealthData, action: (context: HealthData, ...args: Args) => Result) {
  return (...args: Args) => action(context, ...args)
}

export function bindHealthActions(context: HealthData) {
  return {
    scanManager: bindAction(context, scanManagerAction),
    scanDetectedManagers: bindAction(context, scanDetectedManagersAction),
    exportInventory: bindAction(context, exportInventoryAction),
    exportSupplyChain: bindAction(context, exportSupplyChainAction),
    exportLicenseCompliance: bindAction(context, exportLicenseComplianceAction),
    exportThirdPartyNotices: bindAction(context, exportThirdPartyNoticesAction),
    exportOperationHistory: bindAction(context, exportOperationHistoryAction),
    importCiEvidence: bindAction(context, importCiEvidenceAction),
    recordManualCiEvidence: bindAction(context, recordManualCiEvidenceAction),
    exportCiEvidence: bindAction(context, exportCiEvidenceAction),
    recordReleaseApproval: bindAction(context, recordReleaseApprovalAction),
    exportReleaseApprovals: bindAction(context, exportReleaseApprovalsAction),
    recordReleaseException: bindAction(context, recordReleaseExceptionAction),
    exportReleaseExceptions: bindAction(context, exportReleaseExceptionsAction),
    checkRegistries: bindAction(context, checkRegistriesAction),
    exportRegistryReachability: bindAction(context, exportRegistryReachabilityAction),
    importAuditEvidence: bindAction(context, importAuditEvidenceAction),
    exportAuditEvidence: bindAction(context, exportAuditEvidenceAction),
    exportVulnerabilityRemediationPlan: bindAction(context, exportVulnerabilityRemediationPlanAction),
    exportCredentialUsage: bindAction(context, exportCredentialUsageAction),
    exportLockfileDrift: bindAction(context, exportLockfileDriftAction),
    exportRuntimePinning: bindAction(context, exportRuntimePinningAction),
    exportOfflineCacheReadiness: bindAction(context, exportOfflineCacheReadinessAction),
    exportReleaseRiskProfile: bindAction(context, exportReleaseRiskProfileAction),
    exportCiIntegrationPlan: bindAction(context, exportCiIntegrationPlanAction),
    exportDependencyAutomationPlan: bindAction(context, exportDependencyAutomationPlanAction),
    exportCredentialRotationPlan: bindAction(context, exportCredentialRotationPlanAction),
    exportAutomationSafetyPlan: bindAction(context, exportAutomationSafetyPlanAction),
    exportDependencyOwnershipPlan: bindAction(context, exportDependencyOwnershipPlanAction),
    exportDependencyUpgradePlaybook: bindAction(context, exportDependencyUpgradePlaybookAction),
    exportDependencyRollbackPlan: bindAction(context, exportDependencyRollbackPlanAction),
    exportDependencyImpactAnalysis: bindAction(context, exportDependencyImpactAnalysisAction),
    exportDependencyChangeApprovalPacket: bindAction(context, exportDependencyChangeApprovalPacketAction),
    exportDependencyChangeCalendar: bindAction(context, exportDependencyChangeCalendarAction),
    exportDependencyChangeExecutionRecord: bindAction(context, exportDependencyChangeExecutionRecordAction),
    exportPolicyAsCodePack: bindAction(context, exportPolicyAsCodePackAction),
    scanWorkspaces: bindAction(context, scanWorkspacesAction),
    exportWorkspaces: bindAction(context, exportWorkspacesAction),
    scanWorkspaceGovernance: bindAction(context, scanWorkspaceGovernanceAction),
    exportWorkspaceGovernance: bindAction(context, exportWorkspaceGovernanceAction),
    exportWorkspaceReleaseEvidence: bindAction(context, exportWorkspaceReleaseEvidenceAction),
    exportRemediationPlan: bindAction(context, exportRemediationPlanAction),
    exportWorkspaceUpdatePlan: bindAction(context, exportWorkspaceUpdatePlanAction),
    exportWorkspaceSboms: bindAction(context, exportWorkspaceSbomsAction),
    exportReleaseBundle: bindAction(context, exportReleaseBundleAction),
    exportReleaseDashboard: bindAction(context, exportReleaseDashboardAction),
    exportDependencyHealthDashboard: bindAction(context, exportDependencyHealthDashboardAction),
    refreshReportArtifactIndex: bindAction(context, refreshReportArtifactIndexAction),
    exportReportArtifactIndex: bindAction(context, exportReportArtifactIndexAction),
    openReportArtifactDirectory: bindAction(context, openReportArtifactDirectoryAction),
    refreshReleaseEvidenceCompleteness: bindAction(context, refreshReleaseEvidenceCompletenessAction),
    exportReleaseEvidenceCompleteness: bindAction(context, exportReleaseEvidenceCompletenessAction),
    refreshReleaseProvenanceAttestation: bindAction(context, refreshReleaseProvenanceAttestationAction),
    exportReleaseProvenanceAttestation: bindAction(context, exportReleaseProvenanceAttestationAction),
    refreshReleaseIntegrityVerification: bindAction(context, refreshReleaseIntegrityVerificationAction),
    exportReleaseIntegrityVerification: bindAction(context, exportReleaseIntegrityVerificationAction),
    refreshReleaseSignature: bindAction(context, refreshReleaseSignatureAction),
    exportReleaseSignature: bindAction(context, exportReleaseSignatureAction),
    refreshReleaseTrustPolicy: bindAction(context, refreshReleaseTrustPolicyAction),
    exportReleaseTrustPolicy: bindAction(context, exportReleaseTrustPolicyAction),
    refreshFrameworkCoverage: bindAction(context, refreshFrameworkCoverageAction),
    exportFrameworkCoverage: bindAction(context, exportFrameworkCoverageAction),
    runReadinessGate: bindAction(context, runReadinessGateAction),
    exportReadiness: bindAction(context, exportReadinessAction),
    createSnapshot: bindAction(context, createSnapshotAction),
    diffLatestSnapshot: bindAction(context, diffLatestSnapshotAction),
    diffDependencyComponents: bindAction(context, diffDependencyComponentsAction),
    exportDependencyDiff: bindAction(context, exportDependencyDiffAction),
    restoreLatestSnapshot: bindAction(context, restoreLatestSnapshotAction),
    restoreSnapshot: bindAction(context, restoreSnapshotAction),
    openSnapshot: bindAction(context, openSnapshotAction),
    ensurePolicy: bindAction(context, ensurePolicyAction),
    ensureReadinessPolicy: bindAction(context, ensureReadinessPolicyAction),
    onReadinessPolicySaved: bindAction(context, onReadinessPolicySavedAction),
    evaluatePolicy: bindAction(context, evaluatePolicyAction),
    handlePolicySaved: bindAction(context, handlePolicySavedAction)
  }
}
