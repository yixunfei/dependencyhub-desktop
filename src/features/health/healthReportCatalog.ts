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
    createHealthReportBlock('tools', '工具链检测', () => window.electronAPI.system.checkTools(), setToolStatuses),
    createHealthReportBlock('plugins', '插件目录', () => window.electronAPI.plugins.catalog(path || undefined), setPlugins),
    createHealthReportBlock('projectDetect', '项目识别', () => needsPath((target) => window.electronAPI.project.detect(target)), setProjectInfo),
    createHealthReportBlock('frameworkCoverage', '框架覆盖', () => window.electronAPI.frameworkCoverage.report(path || undefined), setFrameworkCoverage),
    createHealthReportBlock('supplyChain', '供应链组件报告', () => needsPath((target) => window.electronAPI.supplyChain.report(target)), setSupplyChainReport),
    createHealthReportBlock('license', '许可证合规报告', () => needsPath((target) => window.electronAPI.supplyChain.licenseReport(target)), setLicenseReport),
    createHealthReportBlock('thirdPartyNotices', '第三方声明', () => needsPath((target) => window.electronAPI.thirdPartyNotices.report(target)), setThirdPartyNotices),
    createHealthReportBlock('snapshots', '快照列表', () => needsList((target) => window.electronAPI.supplyChain.listSnapshots(target)), setSnapshots),
    createHealthReportBlock('operationHistory', '操作记录', () => needsList((target) => window.electronAPI.operationHistory.list(target, 80)), setOperationHistory),
    createHealthReportBlock('ciEvidence', 'CI 证据', () => needsList((target) => window.electronAPI.ciEvidence.list(target, 50)), setCiEvidence),
    createHealthReportBlock('auditEvidence', '审计证据', () => needsPath((target) => window.electronAPI.auditEvidence.report(target)), setAuditEvidence),
    createHealthReportBlock('vulnerabilityRemediation', '漏洞修复计划', () => needsPath((target) => window.electronAPI.vulnerabilityRemediationPlan.plan(target)), setVulnerabilityRemediationPlan),
    createHealthReportBlock('releaseApprovals', '发布审批', () => needsList((target) => window.electronAPI.releaseApproval.list(target, 50)), setReleaseApprovals),
    createHealthReportBlock('releaseExceptions', '发布例外', () => needsList((target) => window.electronAPI.releaseException.list(target, 50)), setReleaseExceptions),
    createHealthReportBlock('registryEndpoints', '注册表发现', () => needsPath((target) => window.electronAPI.registryReachability.discover(target)), (value: RegistryEndpoint[] | null) => {
      setRegistryEndpoints(value || [])
      setRegistryReport(null)
    }),
    createHealthReportBlock('workspaces', '工作区发现', () => needsPath((target) => window.electronAPI.workspaceDiscovery.report(target)), setWorkspaceReport),
    createHealthReportBlock('workspaceGovernance', '工作区治理', () => needsPath((target) => window.electronAPI.workspaceGovernance.report(target)), setWorkspaceGovernanceReport),
    createHealthReportBlock('readiness', '生产就绪', () => needsPath((target) => window.electronAPI.readiness.report(target)), setReadinessReport),
    createHealthReportBlock('dependencyDiff', '依赖差异', () => needsPath((target) => window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(target)), setDependencyDiff),
    createHealthReportBlock('offlineCache', '离线缓存', () => needsPath((target) => window.electronAPI.offlineCacheReadiness.report(target)), setOfflineCacheReport),
    createHealthReportBlock('releaseRisk', '发布风险', () => needsPath((target) => window.electronAPI.releaseRiskProfile.report(target)), setReleaseRiskProfile),
    createHealthReportBlock('ciPlan', 'CI 计划', () => needsPath((target) => window.electronAPI.ciIntegrationPlan.plan(target)), setCiIntegrationPlan),
    createHealthReportBlock('automationPlan', '自动化计划', () => needsPath((target) => window.electronAPI.dependencyAutomationPlan.plan(target)), setDependencyAutomationPlan),
    createHealthReportBlock('rotationPlan', '凭据轮换', () => needsPath((target) => window.electronAPI.credentialRotationPlan.plan(target)), setCredentialRotationPlan),
    createHealthReportBlock('safetyPlan', '自动化安全', () => needsPath((target) => window.electronAPI.automationSafetyPlan.plan(target)), setAutomationSafetyPlan),
    createHealthReportBlock('ownershipPlan', '依赖归属', () => needsPath((target) => window.electronAPI.dependencyOwnershipPlan.plan(target)), setDependencyOwnershipPlan),
    createHealthReportBlock('upgradePlaybook', '升级手册', () => needsPath((target) => window.electronAPI.dependencyUpgradePlaybook.report(target)), setDependencyUpgradePlaybook),
    createHealthReportBlock('rollbackPlan', '回滚计划', () => needsPath((target) => window.electronAPI.dependencyRollbackPlan.report(target)), setDependencyRollbackPlan),
    createHealthReportBlock('impactAnalysis', '影响分析', () => needsPath((target) => window.electronAPI.dependencyImpactAnalysis.report(target)), setDependencyImpactAnalysis),
    createHealthReportBlock('approvalPacket', '变更审批包', () => needsPath((target) => window.electronAPI.dependencyChangeApprovalPacket.report(target)), setDependencyChangeApprovalPacket),
    createHealthReportBlock('changeCalendar', '变更日历', () => needsPath((target) => window.electronAPI.dependencyChangeCalendar.report(target)), setDependencyChangeCalendar),
    createHealthReportBlock('executionRecord', '变更执行记录', () => needsPath((target) => window.electronAPI.dependencyChangeExecutionRecord.report(target)), setDependencyChangeExecutionRecord),
    createHealthReportBlock('policyPack', '策略即代码包', () => needsPath((target) => window.electronAPI.policyAsCodePack.report(target)), setPolicyAsCodePack),
    createHealthReportBlock('reportArtifacts', '报告制品索引', () => needsPath((target) => window.electronAPI.reportArtifacts.report(target)), setReportArtifactIndex),
    createHealthReportBlock('evidenceCompleteness', '证据完整性', () => needsPath((target) => window.electronAPI.releaseEvidenceCompleteness.report(target)), setReleaseEvidenceCompleteness),
    createHealthReportBlock('provenanceAttestation', '来源证明', () => needsPath((target) => window.electronAPI.releaseProvenanceAttestation.report(target)), setReleaseProvenanceAttestation),
    createHealthReportBlock('integrityVerification', '完整性验证', () => needsPath((target) => window.electronAPI.releaseIntegrityVerification.report(target)), setReleaseIntegrityVerification),
    createHealthReportBlock('signature', '发布签名', () => needsPath((target) => window.electronAPI.releaseSignature.report(target)), setReleaseSignature),
    createHealthReportBlock('trustPolicy', '发布信任策略', () => needsPath((target) => window.electronAPI.releaseTrustPolicy.report(target)), setReleaseTrustPolicy)
  ]
}
