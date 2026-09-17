import { createHealthReportBlock, type HealthReportBlock } from './reportBlocks'
import type { HealthState } from './useHealthState'

export function buildHealthReportBlocks(context: Pick<HealthState,
  'setToolStatuses' | 'setPlugins' | 'setProjectInfo' | 'setFrameworkCoverage' | 'setSupplyChainReport' |
  'setLicenseReport' | 'setThirdPartyNotices' | 'setSnapshots' | 'setOperationHistory' | 'setCiEvidence' |
  'setAuditEvidence' | 'setVulnerabilityRemediationPlan' | 'setReleaseApprovals' | 'setReleaseExceptions' |
  'setRegistryEndpoints' | 'setRegistryReport' | 'setWorkspaceReport' | 'setWorkspaceGovernanceReport' |
  'setReadinessReport' | 'setDependencyDiff' | 'setOfflineCacheReport' | 'setReleaseRiskProfile' |
  'setCiIntegrationPlan' | 'setDependencyAutomationPlan' | 'setCredentialRotationPlan' |
  'setAutomationSafetyPlan' | 'setDependencyOwnershipPlan' | 'setDependencyUpgradePlaybook' |
  'setDependencyRollbackPlan' | 'setDependencyImpactAnalysis' | 'setDependencyChangeApprovalPacket' |
  'setDependencyChangeCalendar' | 'setDependencyChangeExecutionRecord' | 'setPolicyAsCodePack' |
  'setReportArtifactIndex' | 'setReleaseEvidenceCompleteness' | 'setReleaseProvenanceAttestation' |
  'setReleaseIntegrityVerification' | 'setReleaseSignature' | 'setReleaseTrustPolicy'
>, path: string): HealthReportBlock[] {
  const {
    setToolStatuses, setPlugins, setProjectInfo, setFrameworkCoverage, setSupplyChainReport,
    setLicenseReport, setThirdPartyNotices, setSnapshots, setOperationHistory, setCiEvidence,
    setAuditEvidence, setVulnerabilityRemediationPlan, setReleaseApprovals, setReleaseExceptions,
    setRegistryEndpoints, setRegistryReport, setWorkspaceReport, setWorkspaceGovernanceReport,
    setReadinessReport, setDependencyDiff, setOfflineCacheReport, setReleaseRiskProfile,
    setCiIntegrationPlan, setDependencyAutomationPlan, setCredentialRotationPlan, setAutomationSafetyPlan,
    setDependencyOwnershipPlan, setDependencyUpgradePlaybook, setDependencyRollbackPlan,
    setDependencyImpactAnalysis, setDependencyChangeApprovalPacket, setDependencyChangeCalendar,
    setDependencyChangeExecutionRecord, setPolicyAsCodePack, setReportArtifactIndex,
    setReleaseEvidenceCompleteness, setReleaseProvenanceAttestation, setReleaseIntegrityVerification,
    setReleaseSignature, setReleaseTrustPolicy
  } = context
  const needsPath = <T,>(loader: (target: string) => Promise<T>) =>
    path ? loader(path) : Promise.resolve(null)
  const needsList = <T,>(loader: (target: string) => Promise<T[]>) =>
    path ? loader(path) : Promise.resolve([] as T[])
  return [
    createHealthReportBlock('tools', 'health.block.tools', () => window.electronAPI.system.checkTools(), setToolStatuses),
    createHealthReportBlock('plugins', 'health.block.plugins', () => window.electronAPI.plugins.catalog(path || undefined), setPlugins),
    createHealthReportBlock('projectDetect', 'health.block.projectDetect', () => needsPath((target) => window.electronAPI.project.detect(target)), setProjectInfo),
    createHealthReportBlock('frameworkCoverage', 'health.block.frameworkCoverage', () => window.electronAPI.frameworkCoverage.report(path || undefined), setFrameworkCoverage),
    createHealthReportBlock('supplyChain', 'health.block.supplyChain', () => needsPath((target) => window.electronAPI.supplyChain.report(target)), setSupplyChainReport),
    createHealthReportBlock('license', 'health.block.license', () => needsPath((target) => window.electronAPI.supplyChain.licenseReport(target)), setLicenseReport),
    createHealthReportBlock('thirdPartyNotices', 'health.block.thirdPartyNotices', () => needsPath((target) => window.electronAPI.thirdPartyNotices.report(target)), setThirdPartyNotices),
    createHealthReportBlock('snapshots', 'health.block.snapshots', () => needsList((target) => window.electronAPI.supplyChain.listSnapshots(target)), setSnapshots),
    createHealthReportBlock('operationHistory', 'health.block.operationHistory', () => needsList((target) => window.electronAPI.operationHistory.list(target, 80)), setOperationHistory),
    createHealthReportBlock('ciEvidence', 'health.block.ciEvidence', () => needsList((target) => window.electronAPI.ciEvidence.list(target, 50)), setCiEvidence),
    createHealthReportBlock('auditEvidence', 'health.block.auditEvidence', () => needsPath((target) => window.electronAPI.auditEvidence.report(target)), setAuditEvidence),
    createHealthReportBlock('vulnerabilityRemediation', 'health.block.vulnerabilityRemediation', () => needsPath((target) => window.electronAPI.vulnerabilityRemediationPlan.plan(target)), setVulnerabilityRemediationPlan),
    createHealthReportBlock('releaseApprovals', 'health.block.releaseApprovals', () => needsList((target) => window.electronAPI.releaseApproval.list(target, 50)), setReleaseApprovals),
    createHealthReportBlock('releaseExceptions', 'health.block.releaseExceptions', () => needsList((target) => window.electronAPI.releaseException.list(target, 50)), setReleaseExceptions),
    createHealthReportBlock('registryEndpoints', 'health.block.registryEndpoints', () => needsPath((target) => window.electronAPI.registryReachability.discover(target)), (value: RegistryEndpoint[] | null) => {
      setRegistryEndpoints(value || [])
      setRegistryReport(null)
    }),
    createHealthReportBlock('workspaces', 'health.block.workspaces', () => needsPath((target) => window.electronAPI.workspaceDiscovery.report(target)), setWorkspaceReport),
    createHealthReportBlock('workspaceGovernance', 'health.block.workspaceGovernance', () => needsPath((target) => window.electronAPI.workspaceGovernance.report(target)), setWorkspaceGovernanceReport),
    createHealthReportBlock('readiness', 'health.block.readiness', () => needsPath((target) => window.electronAPI.readiness.report(target)), setReadinessReport),
    createHealthReportBlock('dependencyDiff', 'health.block.dependencyDiff', () => needsPath((target) => window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(target)), setDependencyDiff),
    createHealthReportBlock('offlineCache', 'health.block.offlineCache', () => needsPath((target) => window.electronAPI.offlineCacheReadiness.report(target)), setOfflineCacheReport),
    createHealthReportBlock('releaseRisk', 'health.block.releaseRisk', () => needsPath((target) => window.electronAPI.releaseRiskProfile.report(target)), setReleaseRiskProfile),
    createHealthReportBlock('ciPlan', 'health.block.ciPlan', () => needsPath((target) => window.electronAPI.ciIntegrationPlan.plan(target)), setCiIntegrationPlan),
    createHealthReportBlock('automationPlan', 'health.block.automationPlan', () => needsPath((target) => window.electronAPI.dependencyAutomationPlan.plan(target)), setDependencyAutomationPlan),
    createHealthReportBlock('rotationPlan', 'health.block.rotationPlan', () => needsPath((target) => window.electronAPI.credentialRotationPlan.plan(target)), setCredentialRotationPlan),
    createHealthReportBlock('safetyPlan', 'health.block.safetyPlan', () => needsPath((target) => window.electronAPI.automationSafetyPlan.plan(target)), setAutomationSafetyPlan),
    createHealthReportBlock('ownershipPlan', 'health.block.ownershipPlan', () => needsPath((target) => window.electronAPI.dependencyOwnershipPlan.plan(target)), setDependencyOwnershipPlan),
    createHealthReportBlock('upgradePlaybook', 'health.block.upgradePlaybook', () => needsPath((target) => window.electronAPI.dependencyUpgradePlaybook.report(target)), setDependencyUpgradePlaybook),
    createHealthReportBlock('rollbackPlan', 'health.block.rollbackPlan', () => needsPath((target) => window.electronAPI.dependencyRollbackPlan.report(target)), setDependencyRollbackPlan),
    createHealthReportBlock('impactAnalysis', 'health.block.impactAnalysis', () => needsPath((target) => window.electronAPI.dependencyImpactAnalysis.report(target)), setDependencyImpactAnalysis),
    createHealthReportBlock('approvalPacket', 'health.block.approvalPacket', () => needsPath((target) => window.electronAPI.dependencyChangeApprovalPacket.report(target)), setDependencyChangeApprovalPacket),
    createHealthReportBlock('changeCalendar', 'health.block.changeCalendar', () => needsPath((target) => window.electronAPI.dependencyChangeCalendar.report(target)), setDependencyChangeCalendar),
    createHealthReportBlock('executionRecord', 'health.block.executionRecord', () => needsPath((target) => window.electronAPI.dependencyChangeExecutionRecord.report(target)), setDependencyChangeExecutionRecord),
    createHealthReportBlock('policyPack', 'health.block.policyPack', () => needsPath((target) => window.electronAPI.policyAsCodePack.report(target)), setPolicyAsCodePack),
    createHealthReportBlock('reportArtifacts', 'health.block.reportArtifacts', () => needsPath((target) => window.electronAPI.reportArtifacts.report(target)), setReportArtifactIndex),
    createHealthReportBlock('evidenceCompleteness', 'health.block.evidenceCompleteness', () => needsPath((target) => window.electronAPI.releaseEvidenceCompleteness.report(target)), setReleaseEvidenceCompleteness),
    createHealthReportBlock('provenanceAttestation', 'health.block.provenanceAttestation', () => needsPath((target) => window.electronAPI.releaseProvenanceAttestation.report(target)), setReleaseProvenanceAttestation),
    createHealthReportBlock('integrityVerification', 'health.block.integrityVerification', () => needsPath((target) => window.electronAPI.releaseIntegrityVerification.report(target)), setReleaseIntegrityVerification),
    createHealthReportBlock('signature', 'health.block.signature', () => needsPath((target) => window.electronAPI.releaseSignature.report(target)), setReleaseSignature),
    createHealthReportBlock('trustPolicy', 'health.block.trustPolicy', () => needsPath((target) => window.electronAPI.releaseTrustPolicy.report(target)), setReleaseTrustPolicy)
  ]
}
