import {
  ApartmentOutlined, ExperimentOutlined, FolderOpenOutlined, HistoryOutlined, ReloadOutlined,
  RollbackOutlined, SafetyCertificateOutlined, SettingOutlined, WarningOutlined
} from '@ant-design/icons'
import { Alert, Button, Space, Typography } from 'antd'
import React from 'react'
import DependencyPolicyEditor from '../../features/policies/DependencyPolicyEditor'
import ReadinessPolicyEditor from '../../features/policies/ReadinessPolicyEditor'
import { useAppStore } from '../../stores/appStore'
import { AutomationGovernanceOverview, CiIntegrationPlanPanel } from './automationGovernance'
import { WorkflowSectionNav } from './components'
import { EvidenceGovernanceOverview } from './evidenceGovernance'
import styles from './HealthCenter.module.css'
import { renderWorkflowSection } from './healthPresentation'
import { HealthReportFailures } from './HealthReportFailures'
import { AuditEvidencePanel } from './panels/AuditEvidencePanel'
import { AutomationSafetyPanel } from './panels/AutomationSafetyPanel'
import { ChangeApprovalPanel } from './panels/ChangeApprovalPanel'
import { ChangeCalendarPanel } from './panels/ChangeCalendarPanel'
import { ChangeExecutionPanel } from './panels/ChangeExecutionPanel'
import { CiEvidencePanel } from './panels/CiEvidencePanel'
import { CredentialRotationPanel } from './panels/CredentialRotationPanel'
import { DependencyAutomationPanel } from './panels/DependencyAutomationPanel'
import { DependencyImpactPanel } from './panels/DependencyImpactPanel'
import { DependencyOwnershipPanel } from './panels/DependencyOwnershipPanel'
import { DependencyPolicyPanel } from './panels/DependencyPolicyPanel'
import { DependencyRiskPanel } from './panels/DependencyRiskPanel'
import { DependencyRollbackPanel } from './panels/DependencyRollbackPanel'
import { DependencyUpgradePanel } from './panels/DependencyUpgradePanel'
import { EvidenceCompletenessPanel } from './panels/EvidenceCompletenessPanel'
import { FrameworkCoveragePanel } from './panels/FrameworkCoveragePanel'
import { HealthMetrics } from './panels/HealthMetrics'
import { HealthToolbar } from './panels/HealthToolbar'
import { IntegrityPanel } from './panels/IntegrityPanel'
import { LicenseCompliancePanel } from './panels/LicenseCompliancePanel'
import { ManagerHealthTable } from './panels/ManagerHealthTable'
import { OperationHistoryPanel } from './panels/OperationHistoryPanel'
import { PolicyAsCodePanel } from './panels/PolicyAsCodePanel'
import { ProvenancePanel } from './panels/ProvenancePanel'
import { ReadinessPanel } from './panels/ReadinessPanel'
import { RegistryReachabilityPanel } from './panels/RegistryReachabilityPanel'
import { ReleaseApprovalsPanel } from './panels/ReleaseApprovalsPanel'
import { ReleaseExceptionsPanel } from './panels/ReleaseExceptionsPanel'
import { ReleaseRiskPanel } from './panels/ReleaseRiskPanel'
import { ReleaseSignaturePanel } from './panels/ReleaseSignaturePanel'
import { ReleaseTrustPanel } from './panels/ReleaseTrustPanel'
import { ReportLibraryPanel } from './panels/ReportLibraryPanel'
import { SnapshotHistoryPanel } from './panels/SnapshotHistoryPanel'
import { ThirdPartyNoticesPanel } from './panels/ThirdPartyNoticesPanel'
import { VulnerabilityRemediationPanel } from './panels/VulnerabilityRemediationPanel'
import { WorkspaceDiscoveryPanel } from './panels/WorkspaceDiscoveryPanel'
import { WorkspaceGovernancePanel } from './panels/WorkspaceGovernancePanel'
import { PolicyGovernanceOverview } from './policyGovernance'
import { ReleaseGovernanceOverview } from './releaseGovernance'
import { ReproducibilityGovernanceOverview } from './reproducibilityGovernance'
import { RiskGovernanceOverview } from './riskGovernance'
import { useHealthCenterModel } from './useHealthCenterModel'
import { WorkspaceGovernanceOverview } from './workspaceGovernance'
const { Paragraph, Title } = Typography

const HealthCenter: React.FC = () => {
  const currentPath = useAppStore((state) => state.currentPath)
  return <HealthCenterProject key={currentPath} />
}

function HealthCenterProject() {
  const model = useHealthCenterModel()
  return <div className={styles.container}>
    <HealthHeader {...model} />
    <GovernanceOverviews {...model} />
    <InventorySection {...model} />
    <RiskSection {...model} />
    <AutomationSection {...model} />
    <PolicySection {...model} />
    <ReproducibilitySection {...model} />
    <WorkspacesSection {...model} />
    <EvidenceSection {...model} />
    <OperationsSection {...model} />
  </div>
}

export default HealthCenter

import type { HealthCenterModel } from './useHealthCenterModel'

function HealthHeader(model: Pick<HealthCenterModel,
  'currentPath' | 'chooseDirectory' | 'loadOverview' | 'loading' | 'failedReports' | 'retryReport' |
  'reloadFailedReports'
>) {
  return (<><div className={styles.header}>
    <div>
      <Title level={2} className={styles.title}>健康与安全中心</Title>
      <Paragraph className={styles.subtitle}>
        聚合工具链可用性、项目生态识别、依赖诊断、审计入口和可导出的生产清单。
      </Paragraph>
    </div>
    <Space wrap>
      <span className={styles.pathInfo}>
        <span className={styles.pathLabel}>当前项目:</span>
        <span className={styles.pathValue}>{model.currentPath || '未选择'}</span>
      </span>
      <Button icon={<FolderOpenOutlined />} onClick={model.chooseDirectory}>选择目录</Button>
      <Button icon={<ReloadOutlined />} onClick={model.loadOverview} loading={model.loading}>重新检测</Button>
    </Space>
  </div>

    <WorkflowSectionNav />

    <HealthReportFailures failures={model.failedReports} onRetry={model.retryReport} onRetryAll={model.reloadFailedReports} /></>)
}

function GovernanceOverviews(model: Pick<HealthCenterModel,
  'readinessReport' | 'releaseRiskProfile' | 'releaseEvidenceCompleteness' | 'releaseIntegrityVerification' |
  'releaseSignature' | 'releaseTrustPolicy' | 'dependencyChangeApprovalPacket' | 'dependencyChangeCalendar' |
  'dependencyChangeExecutionRecord' | 'reportArtifactIndex' | 'dependencyDiff' | 'auditEvidence' |
  'vulnerabilityRemediationPlan' | 'licenseReport' | 'registryReport' | 'credentialRotationPlan' |
  'operationHistory' | 'ciEvidence' | 'releaseApprovals' | 'releaseExceptions' | 'policyEvaluation' |
  'thirdPartyNotices' | 'policyAsCodePack' | 'registryEndpoints' | 'ciIntegrationPlan' |
  'dependencyAutomationPlan' | 'automationSafetyPlan' | 'dependencyOwnershipPlan' |
  'dependencyUpgradePlaybook' | 'dependencyImpactAnalysis' | 'snapshots' | 'snapshotDiff' |
  'offlineCacheReport' | 'dependencyRollbackPlan' | 'workspaceReport' | 'workspaceGovernanceReport'
>) {
  return (<><ReleaseGovernanceOverview
    readinessReport={model.readinessReport}
    releaseRiskProfile={model.releaseRiskProfile}
    releaseEvidenceCompleteness={model.releaseEvidenceCompleteness}
    releaseIntegrityVerification={model.releaseIntegrityVerification}
    releaseSignature={model.releaseSignature}
    releaseTrustPolicy={model.releaseTrustPolicy}
    dependencyChangeApprovalPacket={model.dependencyChangeApprovalPacket}
    dependencyChangeCalendar={model.dependencyChangeCalendar}
    dependencyChangeExecutionRecord={model.dependencyChangeExecutionRecord}
    reportArtifactIndex={model.reportArtifactIndex}
  />

    <RiskGovernanceOverview
      releaseRiskProfile={model.releaseRiskProfile}
      dependencyDiff={model.dependencyDiff}
      auditEvidence={model.auditEvidence}
      vulnerabilityRemediationPlan={model.vulnerabilityRemediationPlan}
      licenseReport={model.licenseReport}
      registryReport={model.registryReport}
      credentialRotationPlan={model.credentialRotationPlan}
      readinessReport={model.readinessReport}
      reportArtifactIndex={model.reportArtifactIndex}
    />

    <EvidenceGovernanceOverview
      operationHistory={model.operationHistory}
      ciEvidence={model.ciEvidence}
      auditEvidence={model.auditEvidence}
      vulnerabilityRemediationPlan={model.vulnerabilityRemediationPlan}
      releaseApprovals={model.releaseApprovals}
      releaseExceptions={model.releaseExceptions}
      reportArtifactIndex={model.reportArtifactIndex}
    />

    <PolicyGovernanceOverview
      readinessReport={model.readinessReport}
      policyEvaluation={model.policyEvaluation}
      licenseReport={model.licenseReport}
      thirdPartyNotices={model.thirdPartyNotices}
      policyAsCodePack={model.policyAsCodePack}
      registryEndpoints={model.registryEndpoints}
      registryReport={model.registryReport}
      credentialRotationPlan={model.credentialRotationPlan}
      reportArtifactIndex={model.reportArtifactIndex}
    />

    <AutomationGovernanceOverview
      ciIntegrationPlan={model.ciIntegrationPlan}
      dependencyAutomationPlan={model.dependencyAutomationPlan}
      credentialRotationPlan={model.credentialRotationPlan}
      automationSafetyPlan={model.automationSafetyPlan}
      dependencyOwnershipPlan={model.dependencyOwnershipPlan}
      dependencyUpgradePlaybook={model.dependencyUpgradePlaybook}
      dependencyImpactAnalysis={model.dependencyImpactAnalysis}
      dependencyChangeCalendar={model.dependencyChangeCalendar}
      dependencyChangeExecutionRecord={model.dependencyChangeExecutionRecord}
      reportArtifactIndex={model.reportArtifactIndex}
    />

    <ReproducibilityGovernanceOverview
      snapshots={model.snapshots}
      snapshotDiff={model.snapshotDiff}
      dependencyDiff={model.dependencyDiff}
      offlineCacheReport={model.offlineCacheReport}
      dependencyRollbackPlan={model.dependencyRollbackPlan}
      releaseRiskProfile={model.releaseRiskProfile}
      readinessReport={model.readinessReport}
      reportArtifactIndex={model.reportArtifactIndex}
    />

    <WorkspaceGovernanceOverview
      workspaceReport={model.workspaceReport}
      workspaceGovernanceReport={model.workspaceGovernanceReport}
      readinessReport={model.readinessReport}
      reportArtifactIndex={model.reportArtifactIndex}
    /></>)
}

function InventorySection(model: Pick<HealthCenterModel,
  'detectedIds' | 'supplyChainReport' | 'reportArtifactIndex' | 'toolStatuses' | 'scans' |
  'extendedDetectedCount' | 'frameworkCoverage' | 'unknownLicenseCount' | 'licenseReport' |
  'licenseRiskCount' | 'thirdPartyNotices' | 'snapshots' | 'dependencyDiff' | 'dependencyHighRiskCount' |
  'operationHistory' | 'ciEvidence' | 'latestCiEvidence' | 'auditEvidence' | 'vulnerabilityRemediationPlan' |
  'releaseApprovals' | 'latestReleaseApproval' | 'releaseExceptions' | 'latestReleaseException' |
  'registryReport' | 'registryEndpoints' | 'workspaceReport' | 'workspaceGovernanceReport' |
  'readinessReport' | 'offlineCacheReport' | 'releaseRiskProfile' | 'ciIntegrationPlan' |
  'dependencyAutomationPlan' | 'credentialRotationPlan' | 'automationSafetyPlan' |
  'dependencyOwnershipPlan' | 'dependencyUpgradePlaybook' | 'dependencyRollbackPlan' |
  'dependencyImpactAnalysis' | 'dependencyChangeApprovalPacket' | 'dependencyChangeCalendar' |
  'dependencyChangeExecutionRecord' | 'policyAsCodePack' | 'releaseEvidenceCompleteness' |
  'releaseProvenanceAttestation' | 'releaseIntegrityVerification' | 'releaseSignature' |
  'releaseTrustPolicy' | 'refreshFrameworkCoverage' | 'reporting' | 'exportFrameworkCoverage' |
  'currentPath' | 'frameworkCoverageRows'
>) {
  return (<>{renderWorkflowSection(
    'health-inventory',
    <SafetyCertificateOutlined />,
    'Inventory',
    `${model.detectedIds.size} ecosystems / ${model.supplyChainReport?.componentCount || 0} components / ${model.reportArtifactIndex?.summary.artifactCount || 0} reports`
  )}

    <HealthMetrics {...model} />

    <FrameworkCoveragePanel {...model} />

    <Alert
      type="info"
      showIcon
      title="生产级管理入口"
      description="当前已提供跨生态工具链检测、项目依赖清单导出、依赖健康扫描聚合、CycloneDX/SPDX SBOM、Markdown 报告、清单快照、快照差异与恢复；扩展生态页已支持标准操作计划、dry-run 判断、执行前备份与恢复。"
    /></>)
}

function RiskSection(model: Pick<HealthCenterModel, 'releaseRiskProfile' | 'dependencyHighRiskCount' | 'releaseRiskRows'>) {
  return (<>{renderWorkflowSection(
    'health-risk',
    <WarningOutlined />,
    'Risk',
    `${model.releaseRiskProfile ? `${model.releaseRiskProfile.score}/100` : 'not scored'} / ${model.dependencyHighRiskCount} dependency high+ / ${model.releaseRiskProfile?.summary.topRiskCount || 0} top risks`
  )}

    <ReleaseRiskPanel {...model} /></>)
}

function AutomationSection(model: Pick<HealthCenterModel,
  'ciIntegrationPlan' | 'dependencyAutomationPlan' | 'automationSafetyPlan' |
  'dependencyAutomationWarnings' | 'credentialRotationPlan' | 'credentialRotationActions' |
  'automationSafetyFindings' | 'dependencyOwnershipPlan' | 'dependencyOwnershipFindings' |
  'dependencyUpgradePlaybook' | 'dependencyUpgradeLanes' | 'dependencyUpgradeItems' |
  'dependencyRollbackPlan' | 'dependencyRollbackItems' | 'dependencyImpactAnalysis' |
  'dependencyImpactItems' | 'dependencyChangeApprovalPacket' | 'dependencyApprovalChecklist' |
  'dependencyApprovalScopeItems' | 'dependencyChangeCalendar' | 'dependencyFreezeWindows' |
  'dependencyChangeWindows' | 'dependencyChangeExecutionRecord' | 'dependencyExecutionRecords'
>) {
  return (<>{renderWorkflowSection(
    'health-automation',
    <ExperimentOutlined />,
    'Automation',
    `${model.ciIntegrationPlan?.summary.jobCount || 0} CI jobs / ${model.dependencyAutomationPlan?.summary.generatedConfigCount || 0} configs / ${model.automationSafetyPlan?.summary.ruleCount || 0} safety rules`
  )}

    {model.ciIntegrationPlan && <CiIntegrationPlanPanel report={model.ciIntegrationPlan} />}

    <DependencyAutomationPanel {...model} />

    <CredentialRotationPanel {...model} />

    <AutomationSafetyPanel {...model} />

    <DependencyOwnershipPanel {...model} />

    <DependencyUpgradePanel {...model} />

    <DependencyRollbackPanel {...model} />

    <DependencyImpactPanel {...model} />

    <ChangeApprovalPanel {...model} />

    <ChangeCalendarPanel {...model} />

    <ChangeExecutionPanel {...model} /></>)
}

function PolicySection(model: Pick<HealthCenterModel,
  'readinessReport' | 'licenseRiskCount' | 'policyAsCodePack' | 'policyDeploymentGateRows' |
  'policyRequiredArtifactRows' | 'policyAsCodeFindings' | 'setReadinessPolicyEditorOpen' | 'readinessRows' |
  'licenseReport' | 'licenseRows' | 'thirdPartyNotices' | 'thirdPartyNoticeRows' | 'scanDetectedManagers' |
  'scanning' | 'exportInventory' | 'exportSupplyChain' | 'reporting' | 'exportLicenseCompliance' |
  'exportThirdPartyNotices' | 'exportOperationHistory' | 'refreshReportArtifactIndex' |
  'exportReportArtifactIndex' | 'refreshFrameworkCoverage' | 'exportFrameworkCoverage' | 'importCiEvidence' |
  'recordManualCiEvidence' | 'exportCiEvidence' | 'importAuditEvidence' | 'exportAuditEvidence' |
  'exportVulnerabilityRemediationPlan' | 'recordReleaseApproval' | 'exportReleaseApprovals' |
  'recordReleaseException' | 'exportReleaseExceptions' | 'checkRegistries' | 'exportRegistryReachability' |
  'exportCredentialUsage' | 'exportCredentialRotationPlan' | 'exportLockfileDrift' | 'exportRuntimePinning' |
  'exportOfflineCacheReadiness' | 'exportDependencyRollbackPlan' | 'exportDependencyImpactAnalysis' |
  'exportDependencyChangeApprovalPacket' | 'exportDependencyChangeCalendar' |
  'exportDependencyChangeExecutionRecord' | 'exportReleaseRiskProfile' | 'exportCiIntegrationPlan' |
  'exportDependencyAutomationPlan' | 'exportAutomationSafetyPlan' | 'exportDependencyOwnershipPlan' |
  'exportDependencyUpgradePlaybook' | 'exportPolicyAsCodePack' | 'scanWorkspaces' | 'exportWorkspaces' |
  'scanWorkspaceGovernance' | 'exportWorkspaceGovernance' | 'exportWorkspaceReleaseEvidence' |
  'exportRemediationPlan' | 'exportWorkspaceUpdatePlan' | 'exportWorkspaceSboms' | 'exportReleaseBundle' |
  'exportReleaseDashboard' | 'refreshReleaseProvenanceAttestation' | 'exportReleaseProvenanceAttestation' |
  'refreshReleaseIntegrityVerification' | 'exportReleaseIntegrityVerification' | 'refreshReleaseSignature' |
  'exportReleaseSignature' | 'refreshReleaseTrustPolicy' | 'exportReleaseTrustPolicy' |
  'exportDependencyHealthDashboard' | 'createSnapshot' | 'diffLatestSnapshot' | 'diffDependencyComponents' |
  'exportDependencyDiff' | 'restoreLatestSnapshot' | 'ensurePolicy' | 'setPolicyEditorOpen' | 'currentPath' |
  'evaluatePolicy' | 'runReadinessGate' | 'ensureReadinessPolicy' | 'exportReadiness' | 'navigate'
>) {
  return (<>{renderWorkflowSection(
    'health-policy',
    <SettingOutlined />,
    'Policy',
    `${model.readinessReport ? `${model.readinessReport.score}/100` : 'not gated'} / ${model.licenseRiskCount} license risks / ${model.policyAsCodePack?.summary.dependencyPolicyRuleCount || 0} rules`
  )}

    <PolicyAsCodePanel {...model} />

    <ReadinessPanel {...model} />

    <LicenseCompliancePanel {...model} />

    <ThirdPartyNoticesPanel {...model} />

    <HealthToolbar {...model} /></>)
}

function ReproducibilitySection(model: Pick<HealthCenterModel,
  'snapshots' | 'dependencyHighRiskCount' | 'offlineCacheReport' | 'snapshotDiff' | 'currentPath' |
  'releaseTrustPolicy' | 'refreshReleaseTrustPolicy' | 'reporting' | 'exportReleaseTrustPolicy' |
  'releaseTrustPolicyRows' | 'releaseSignature' | 'refreshReleaseSignature' | 'exportReleaseSignature' |
  'releaseSignatureSourceRows' | 'releaseSignatureFindings' | 'vulnerabilityRemediationPlan' |
  'exportVulnerabilityRemediationPlan' | 'vulnerabilityRemediationRows' | 'releaseEvidenceCompleteness' |
  'refreshReleaseEvidenceCompleteness' | 'exportReleaseEvidenceCompleteness' |
  'releaseEvidenceExpectedRows' | 'releaseEvidenceFindings' | 'releaseProvenanceAttestation' |
  'refreshReleaseProvenanceAttestation' | 'exportReleaseProvenanceAttestation' |
  'releaseProvenanceArtifactRows' | 'releaseIntegrityVerification' | 'refreshReleaseIntegrityVerification' |
  'exportReleaseIntegrityVerification' | 'releaseIntegrityArtifactRows' | 'releaseIntegrityFindings' |
  'reportArtifactIndex' | 'refreshReportArtifactIndex' | 'openReportArtifactDirectory' |
  'exportReportArtifactIndex' | 'reportArtifactRows' | 'artifactCategoryFilter' |
  'setArtifactCategoryFilter' | 'artifactFormatFilter' | 'setArtifactFormatFilter' | 'artifactSearchTerm' |
  'setArtifactSearchTerm'
>) {
  return (<>{renderWorkflowSection(
    'health-reproducibility',
    <RollbackOutlined />,
    'Reproducibility',
    `${model.snapshots.length} snapshots / ${model.dependencyHighRiskCount} dependency high+ / ${model.offlineCacheReport?.summary.findingCount || 0} offline findings`
  )}

    {model.snapshotDiff && (
      <Alert
        type={model.snapshotDiff.changed.length || model.snapshotDiff.added.length || model.snapshotDiff.removed.length ? 'warning' : 'success'}
        showIcon
        title={`与快照 ${model.snapshotDiff.fromSnapshotId} 对比`}
        description={
          <Space orientation="vertical" size={4}>
            <span>新增: {model.snapshotDiff.added.length ? model.snapshotDiff.added.join(', ') : '无'}</span>
            <span>移除: {model.snapshotDiff.removed.length ? model.snapshotDiff.removed.join(', ') : '无'}</span>
            <span>变更: {model.snapshotDiff.changed.length ? model.snapshotDiff.changed.map((item) => item.file).join(', ') : '无'}</span>
            <span>未变更: {model.snapshotDiff.unchanged.length}</span>
          </Space>
        }
      />
    )}

    <ReleaseTrustPanel {...model} />

    <ReleaseSignaturePanel {...model} />

    <VulnerabilityRemediationPanel {...model} />

    <EvidenceCompletenessPanel {...model} />

    <ProvenancePanel {...model} />

    <IntegrityPanel {...model} />

    <ReportLibraryPanel {...model} /></>)
}

function WorkspacesSection(model: Pick<HealthCenterModel,
  'workspaceGovernanceReport' | 'workspaceReport' | 'currentPath' | 'readinessReport' |
  'workspaceGovernanceRows' | 'workspaceRows'
>) {
  return (<>{renderWorkflowSection(
    'health-workspaces',
    <ApartmentOutlined />,
    'Workspaces',
    `${model.workspaceGovernanceReport?.summary.workspaceCount || model.workspaceReport?.summary.workspaceCount || 0} workspaces / ${model.workspaceGovernanceReport?.summary.blocked || 0} blocked / ${model.workspaceGovernanceReport?.summary.warning || 0} warning`
  )}

    <WorkspaceGovernancePanel {...model} />

    <WorkspaceDiscoveryPanel {...model} /></>)
}

function EvidenceSection(model: Pick<HealthCenterModel,
  'ciEvidence' | 'auditEvidence' | 'releaseApprovals' | 'releaseExceptions' | 'currentPath' |
  'latestCiEvidence' | 'recentCiEvidence' | 'auditEvidenceFindings' | 'latestReleaseApproval' |
  'recentReleaseApprovals' | 'latestReleaseException' | 'recentReleaseExceptions' | 'registryRows' |
  'registryReport' | 'dependencyDiff' | 'dependencyHighRiskCount' | 'dependencyDiffRows' |
  'recentSnapshots' | 'snapshots' | 'openSnapshot' | 'restoreSnapshot' | 'reporting'
>) {
  return (<>{renderWorkflowSection(
    'health-evidence',
    <HistoryOutlined />,
    'Evidence',
    `${model.ciEvidence.length} CI / ${model.auditEvidence?.summary.findingCount || 0} audit findings / ${model.releaseApprovals.length} approvals / ${model.releaseExceptions.length} exceptions`
  )}

    <CiEvidencePanel {...model} />

    <AuditEvidencePanel {...model} />

    <ReleaseApprovalsPanel {...model} />

    <ReleaseExceptionsPanel {...model} />

    <RegistryReachabilityPanel {...model} />

    <DependencyRiskPanel {...model} />

    <SnapshotHistoryPanel {...model} /></>)
}

function OperationsSection(model: Pick<HealthCenterModel,
  'operationHistory' | 'operationStats' | 'filteredOperations' | 'historyManagerFilter' |
  'setHistoryManagerFilter' | 'operationManagerOptions' | 'historyStatusFilter' | 'setHistoryStatusFilter' |
  'historyChangeFilter' | 'setHistoryChangeFilter' | 'exportOperationHistory' | 'reporting' |
  'recentOperations' | 'policyEvaluation' | 'rows' | 'loading' | 'toolStatusMap' | 'scanManager' |
  'scanning' | 'currentPath' | 'navigate' | 'policyEditorOpen' | 'setPolicyEditorOpen' |
  'handlePolicySaved' | 'readinessPolicyEditorOpen' | 'setReadinessPolicyEditorOpen' |
  'onReadinessPolicySaved'
>) {
  return (<>{renderWorkflowSection(
    'health-operations',
    <HistoryOutlined />,
    'Operations',
    `${model.operationHistory.length} records / ${model.operationStats.errors} failed / ${model.operationStats.mutating} mutating`
  )}

    <OperationHistoryPanel {...model} />

    <DependencyPolicyPanel {...model} />

    <ManagerHealthTable {...model} />

    <DependencyPolicyEditor
      open={model.policyEditorOpen}
      projectPath={model.currentPath}
      onClose={() => model.setPolicyEditorOpen(false)}
      onSaved={model.handlePolicySaved}
    />
    <ReadinessPolicyEditor
      open={model.readinessPolicyEditorOpen}
      projectPath={model.currentPath}
      onClose={() => model.setReadinessPolicyEditorOpen(false)}
      onSaved={model.onReadinessPolicySaved}
    /></>)
}
