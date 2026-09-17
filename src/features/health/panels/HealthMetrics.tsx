import { Card, Space, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import {
  ciEvidenceStatusColor, offlineCacheStatusColor, readinessStatusColor, readinessStatusLabel,
  releaseApprovalColor, releaseRiskStatusColor
} from '../healthPresentation'
import { useT } from '../../../i18n'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text, Title } = Typography

type Props = Pick<HealthCenterModel,
  'detectedIds' | 'toolStatuses' | 'scans' | 'supplyChainReport' | 'extendedDetectedCount' |
  'frameworkCoverage' | 'unknownLicenseCount' | 'licenseReport' | 'licenseRiskCount' | 'thirdPartyNotices' |
  'snapshots' | 'dependencyDiff' | 'dependencyHighRiskCount' | 'operationHistory' | 'ciEvidence' |
  'latestCiEvidence' | 'auditEvidence' | 'vulnerabilityRemediationPlan' | 'releaseApprovals' |
  'latestReleaseApproval' | 'releaseExceptions' | 'latestReleaseException' | 'registryReport' |
  'registryEndpoints' | 'workspaceReport' | 'workspaceGovernanceReport' | 'readinessReport' |
  'offlineCacheReport' | 'releaseRiskProfile' | 'ciIntegrationPlan' | 'dependencyAutomationPlan' |
  'credentialRotationPlan' | 'automationSafetyPlan' | 'dependencyOwnershipPlan' |
  'dependencyUpgradePlaybook' | 'dependencyRollbackPlan' | 'dependencyImpactAnalysis' |
  'dependencyChangeApprovalPacket' | 'dependencyChangeCalendar' | 'dependencyChangeExecutionRecord' |
  'policyAsCodePack' | 'releaseEvidenceCompleteness' | 'releaseProvenanceAttestation' |
  'releaseIntegrityVerification' | 'releaseSignature' | 'releaseTrustPolicy'
>

export function HealthMetrics(props: Props) {
  return (<div className={styles.cards}>
    <DetectedIdsMetric {...props} />
    <ToolStatusesMetric {...props} />
    <ScansMetric {...props} />
    <SupplyChainReportMetric {...props} />
    <ExtendedDetectedCountMetric {...props} />
    <FrameworkCoverageMetric {...props} />
    <UnknownLicenseCountMetric {...props} />
    <LicenseReportMetric {...props} />
    <ThirdPartyNoticesMetric {...props} />
    <SnapshotsMetric {...props} />
    <DependencyDiffMetric {...props} />
    <OperationHistoryMetric {...props} />
    <CiEvidenceMetric {...props} />
    <AuditEvidenceMetric {...props} />
    <VulnerabilityRemediationPlanMetric {...props} />
    <ReleaseApprovalsMetric {...props} />
    <ReleaseExceptionsMetric {...props} />
    <RegistryReportMetric {...props} />
    <WorkspaceReportMetric {...props} />
    <WorkspaceGovernanceReportMetric {...props} />
    <ReadinessReportMetric {...props} />
    <OfflineCacheReportMetric {...props} />
    <ReleaseRiskProfileMetric {...props} />
    <CiIntegrationPlanMetric {...props} />
    <DependencyAutomationPlanMetric {...props} />
    <CredentialRotationPlanMetric {...props} />
    <AutomationSafetyPlanMetric {...props} />
    <DependencyOwnershipPlanMetric {...props} />
    <DependencyUpgradePlaybookMetric {...props} />
    <DependencyRollbackPlanMetric {...props} />
    <DependencyImpactAnalysisMetric {...props} />
    <DependencyChangeApprovalPacketMetric {...props} />
    <DependencyChangeCalendarMetric {...props} />
    <DependencyChangeExecutionRecordMetric {...props} />
    <PolicyAsCodePackMetric {...props} />
    <ReleaseEvidenceCompletenessMetric {...props} />
    <ReleaseProvenanceAttestationMetric {...props} />
    <ReleaseIntegrityVerificationMetric {...props} />
    <ReleaseSignatureMetric {...props} />
    <ReleaseTrustPolicyMetric {...props} />
  </div>)
}

type PanelValues = Props

function DetectedIdsMetric({ detectedIds }: Pick<PanelValues, 'detectedIds'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.detectedEcosystems')}</Text>
    <Title level={3}>{detectedIds.size}</Title>
  </Card>)
}

function ToolStatusesMetric({ toolStatuses }: Pick<PanelValues, 'toolStatuses'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.availableTools')}</Text>
    <Title level={3}>{toolStatuses.filter((tool) => tool.available).length}/{toolStatuses.length}</Title>
  </Card>)
}

function ScansMetric({ scans }: Pick<PanelValues, 'scans'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.scannedEcosystems')}</Text>
    <Title level={3}>{Object.keys(scans).length}</Title>
  </Card>)
}

function SupplyChainReportMetric({ supplyChainReport }: Pick<PanelValues, 'supplyChainReport'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.supplyChainComponents')}</Text>
    <Title level={3}>{supplyChainReport?.componentCount || 0}</Title>
  </Card>)
}

function ExtendedDetectedCountMetric({ extendedDetectedCount }: Pick<PanelValues, 'extendedDetectedCount'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.extendedEcosystems')}</Text>
    <Title level={3}>{extendedDetectedCount}</Title>
  </Card>)
}

function FrameworkCoverageMetric({ frameworkCoverage }: Pick<PanelValues, 'frameworkCoverage'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.frameworkCoverage')}</Text>
    <Title level={3}>{frameworkCoverage ? frameworkCoverage.summary.managerCount : '-'}</Title>
    {frameworkCoverage && (
      <Space size={4} wrap>
        <Tag color="blue">{frameworkCoverage.summary.routeGroupCount} groups</Tag>
        <Tag color={frameworkCoverage.summary.warningGapCount > 0 ? 'orange' : 'green'}>
          {frameworkCoverage.summary.warningGapCount} gaps
        </Tag>
      </Space>
    )}
  </Card>)
}

function UnknownLicenseCountMetric({ unknownLicenseCount }: Pick<PanelValues, 'unknownLicenseCount'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.unknownLicenses')}</Text>
    <Title level={3}>{unknownLicenseCount}</Title>
  </Card>)
}

function LicenseReportMetric({ licenseReport, licenseRiskCount }: Pick<PanelValues, 'licenseReport' | 'licenseRiskCount'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.licenseRisks')}</Text>
    <Title level={3}>{licenseReport ? licenseRiskCount : '-'}</Title>
    {licenseReport && (
      <Tag color={licenseRiskCount > 0 ? 'orange' : 'green'}>
        {licenseReport.summary.licenseCount} licenses
      </Tag>
    )}
  </Card>)
}

function ThirdPartyNoticesMetric({ thirdPartyNotices }: Pick<PanelValues, 'thirdPartyNotices'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.thirdPartyNotices')}</Text>
    <Title level={3}>{thirdPartyNotices ? thirdPartyNotices.summary.noticeCount : '-'}</Title>
    {thirdPartyNotices && (
      <Space size={4} wrap>
        <Tag color={thirdPartyNotices.summary.policyViolationCount > 0 ? 'orange' : 'green'}>
          {thirdPartyNotices.summary.policyViolationCount} policy
        </Tag>
        <Tag>{thirdPartyNotices.summary.unknownLicenseComponentCount} unknown</Tag>
      </Space>
    )}
  </Card>)
}

function SnapshotsMetric({ snapshots }: Pick<PanelValues, 'snapshots'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.snapshots')}</Text>
    <Title level={3}>{snapshots.length}</Title>
  </Card>)
}

function DependencyDiffMetric({ dependencyDiff, dependencyHighRiskCount }: Pick<PanelValues, 'dependencyDiff' | 'dependencyHighRiskCount'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.diffRisk')}</Text>
    <Title level={3}>{dependencyDiff ? dependencyHighRiskCount : '-'}</Title>
    {dependencyDiff && <Tag color={dependencyHighRiskCount > 0 ? 'red' : 'green'}>high+</Tag>}
  </Card>)
}

function OperationHistoryMetric({ operationHistory }: Pick<PanelValues, 'operationHistory'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.operationHistory')}</Text>
    <Title level={3}>{operationHistory.length}</Title>
  </Card>)
}

function CiEvidenceMetric({ ciEvidence, latestCiEvidence }: Pick<PanelValues, 'ciEvidence' | 'latestCiEvidence'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.ciEvidence')}</Text>
    <Title level={3}>{ciEvidence.length}</Title>
    {latestCiEvidence && (
      <Tag color={ciEvidenceStatusColor(latestCiEvidence.status)}>
        {latestCiEvidence.status}
      </Tag>
    )}
  </Card>)
}

function AuditEvidenceMetric({ auditEvidence }: Pick<PanelValues, 'auditEvidence'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.auditEvidence')}</Text>
    <Title level={3}>{auditEvidence ? auditEvidence.summary.findingCount : '-'}</Title>
    {auditEvidence && (
      <Space size={4} wrap>
        <Tag color={auditEvidence.summary.critical + auditEvidence.summary.high > 0 ? 'red' : auditEvidence.summary.medium > 0 ? 'orange' : 'green'}>
          {auditEvidence.summary.critical + auditEvidence.summary.high} high+
        </Tag>
        <Tag>{auditEvidence.summary.sourceCount} sources</Tag>
      </Space>
    )}
  </Card>)
}

function VulnerabilityRemediationPlanMetric({ vulnerabilityRemediationPlan }: Pick<PanelValues, 'vulnerabilityRemediationPlan'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.vulnRemediation')}</Text>
    <Title level={3}>{vulnerabilityRemediationPlan ? vulnerabilityRemediationPlan.summary.itemCount : '-'}</Title>
    {vulnerabilityRemediationPlan && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(vulnerabilityRemediationPlan.status)}>
          {readinessStatusLabel(vulnerabilityRemediationPlan.status)}
        </Tag>
        <Tag color={vulnerabilityRemediationPlan.summary.immediateItemCount > 0 ? 'red' : 'default'}>
          {vulnerabilityRemediationPlan.summary.immediateItemCount} immediate
        </Tag>
      </Space>
    )}
  </Card>)
}

function ReleaseApprovalsMetric({ releaseApprovals, latestReleaseApproval }: Pick<PanelValues, 'releaseApprovals' | 'latestReleaseApproval'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.releaseApprovals')}</Text>
    <Title level={3}>{releaseApprovals.length}</Title>
    {latestReleaseApproval && (
      <Tag color={releaseApprovalColor(latestReleaseApproval.decision)}>
        {latestReleaseApproval.decision}
      </Tag>
    )}
  </Card>)
}

function ReleaseExceptionsMetric({ releaseExceptions, latestReleaseException }: Pick<PanelValues, 'releaseExceptions' | 'latestReleaseException'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.releaseExceptions')}</Text>
    <Title level={3}>{releaseExceptions.length}</Title>
    {latestReleaseException && (
      <Tag color={latestReleaseException.decision === 'approved' ? 'orange' : 'default'}>
        {latestReleaseException.decision}
      </Tag>
    )}
  </Card>)
}

function RegistryReportMetric({ registryReport, registryEndpoints }: Pick<PanelValues, 'registryReport' | 'registryEndpoints'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.registries')}</Text>
    <Title level={3}>{registryReport?.summary.endpointCount ?? registryEndpoints.length}</Title>
    {registryReport && (
      <Tag color={registryReport.summary.unreachable > 0 ? 'red' : 'green'}>
        {registryReport.summary.reachable} reachable
      </Tag>
    )}
  </Card>)
}

function WorkspaceReportMetric({ workspaceReport }: Pick<PanelValues, 'workspaceReport'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.workspaces')}</Text>
    <Title level={3}>{workspaceReport?.summary.workspaceCount ?? '-'}</Title>
    {workspaceReport && (
      <Tag color={workspaceReport.summary.explicitWorkspaceCount > 0 ? 'blue' : 'default'}>
        {workspaceReport.summary.managerCount} managers
      </Tag>
    )}
  </Card>)
}

function WorkspaceGovernanceReportMetric({ workspaceGovernanceReport }: Pick<PanelValues, 'workspaceGovernanceReport'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.workspaceRisks')}</Text>
    <Title level={3}>{workspaceGovernanceReport ? workspaceGovernanceReport.summary.blocked + workspaceGovernanceReport.summary.warning : '-'}</Title>
    {workspaceGovernanceReport && (
      <Space size={4} wrap>
        <Tag color={workspaceGovernanceReport.summary.blocked > 0 ? 'red' : 'default'}>
          {workspaceGovernanceReport.summary.blocked} blocked
        </Tag>
        <Tag color={workspaceGovernanceReport.summary.warning > 0 ? 'orange' : 'green'}>
          {workspaceGovernanceReport.summary.warning} warning
        </Tag>
      </Space>
    )}
  </Card>)
}

function ReadinessReportMetric({ readinessReport }: Pick<PanelValues, 'readinessReport'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.productionReadiness')}</Text>
    <Title level={3}>{readinessReport ? readinessReport.score : '-'}</Title>
    {readinessReport && (
      <Tag color={readinessStatusColor(readinessReport.status)}>
        {readinessStatusLabel(readinessReport.status)}
      </Tag>
    )}
  </Card>)
}

function OfflineCacheReportMetric({ offlineCacheReport }: Pick<PanelValues, 'offlineCacheReport'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.offlineCache')}</Text>
    <Title level={3}>{offlineCacheReport ? offlineCacheReport.summary.findingCount : '-'}</Title>
    {offlineCacheReport && (
      <Space size={4} wrap>
        <Tag color={offlineCacheStatusColor(offlineCacheReport.summary.blocked > 0 ? 'blocked' : offlineCacheReport.summary.warning > 0 ? 'warning' : 'ready')}>
          {offlineCacheReport.summary.blocked} blocked
        </Tag>
        <Tag>{offlineCacheReport.summary.offlineCommandManagerCount} commands</Tag>
      </Space>
    )}
  </Card>)
}

function ReleaseRiskProfileMetric({ releaseRiskProfile }: Pick<PanelValues, 'releaseRiskProfile'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.releaseRisk')}</Text>
    <Title level={3}>{releaseRiskProfile ? releaseRiskProfile.score : '-'}</Title>
    {releaseRiskProfile && (
      <Space size={4} wrap>
        <Tag color={releaseRiskStatusColor(releaseRiskProfile.status)}>
          {readinessStatusLabel(releaseRiskProfile.status)}
        </Tag>
        <Tag>{releaseRiskProfile.summary.topRiskCount} top</Tag>
      </Space>
    )}
  </Card>)
}

function CiIntegrationPlanMetric({ ciIntegrationPlan }: Pick<PanelValues, 'ciIntegrationPlan'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.ciPlan')}</Text>
    <Title level={3}>{ciIntegrationPlan ? ciIntegrationPlan.summary.jobCount : '-'}</Title>
    {ciIntegrationPlan && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(ciIntegrationPlan.status)}>
          {readinessStatusLabel(ciIntegrationPlan.status)}
        </Tag>
        <Tag>{ciIntegrationPlan.summary.matrixEntryCount} targets</Tag>
        <Tag color={ciIntegrationPlan.summary.deploymentWarningCount > 0 ? 'orange' : 'green'}>
          {ciIntegrationPlan.summary.deploymentWarningCount} deploy
        </Tag>
      </Space>
    )}
  </Card>)
}

function DependencyAutomationPlanMetric({ dependencyAutomationPlan }: Pick<PanelValues, 'dependencyAutomationPlan'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.automation')}</Text>
    <Title level={3}>{dependencyAutomationPlan ? dependencyAutomationPlan.summary.generatedConfigCount : '-'}</Title>
    {dependencyAutomationPlan && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyAutomationPlan.status)}>
          {readinessStatusLabel(dependencyAutomationPlan.status)}
        </Tag>
        <Tag>{dependencyAutomationPlan.summary.dependabotTargetCount + dependencyAutomationPlan.summary.renovateTargetCount} targets</Tag>
      </Space>
    )}
  </Card>)
}

function CredentialRotationPlanMetric({ credentialRotationPlan }: Pick<PanelValues, 'credentialRotationPlan'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.credentialRotation')}</Text>
    <Title level={3}>{credentialRotationPlan ? credentialRotationPlan.summary.actionCount : '-'}</Title>
    {credentialRotationPlan && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(credentialRotationPlan.status)}>
          {readinessStatusLabel(credentialRotationPlan.status)}
        </Tag>
        <Tag>{credentialRotationPlan.summary.automationSecretCount} secrets</Tag>
      </Space>
    )}
  </Card>)
}

function AutomationSafetyPlanMetric({ automationSafetyPlan }: Pick<PanelValues, 'automationSafetyPlan'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.automationSafety')}</Text>
    <Title level={3}>{automationSafetyPlan ? automationSafetyPlan.summary.ruleCount : '-'}</Title>
    {automationSafetyPlan && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(automationSafetyPlan.status)}>
          {readinessStatusLabel(automationSafetyPlan.status)}
        </Tag>
        <Tag>{automationSafetyPlan.summary.autoMergeRuleCount} auto</Tag>
      </Space>
    )}
  </Card>)
}

function DependencyOwnershipPlanMetric({ dependencyOwnershipPlan }: Pick<PanelValues, 'dependencyOwnershipPlan'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.ownership')}</Text>
    <Title level={3}>{dependencyOwnershipPlan ? dependencyOwnershipPlan.summary.ownedAssignmentCount : '-'}</Title>
    {dependencyOwnershipPlan && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyOwnershipPlan.status)}>
          {readinessStatusLabel(dependencyOwnershipPlan.status)}
        </Tag>
        <Tag>{dependencyOwnershipPlan.summary.missingOwnerAssignmentCount} missing</Tag>
      </Space>
    )}
  </Card>)
}

function DependencyUpgradePlaybookMetric({ dependencyUpgradePlaybook }: Pick<PanelValues, 'dependencyUpgradePlaybook'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.upgradePlaybook')}</Text>
    <Title level={3}>{dependencyUpgradePlaybook ? dependencyUpgradePlaybook.summary.itemCount : '-'}</Title>
    {dependencyUpgradePlaybook && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyUpgradePlaybook.status)}>
          {readinessStatusLabel(dependencyUpgradePlaybook.status)}
        </Tag>
        <Tag>{dependencyUpgradePlaybook.summary.blockedItemCount} blocked</Tag>
        <Tag>{dependencyUpgradePlaybook.summary.laneCount} lanes</Tag>
      </Space>
    )}
  </Card>)
}

function DependencyRollbackPlanMetric({ dependencyRollbackPlan }: Pick<PanelValues, 'dependencyRollbackPlan'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.rollbackPlan')}</Text>
    <Title level={3}>{dependencyRollbackPlan ? dependencyRollbackPlan.summary.itemCount : '-'}</Title>
    {dependencyRollbackPlan && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyRollbackPlan.status)}>
          {readinessStatusLabel(dependencyRollbackPlan.status)}
        </Tag>
        <Tag>{dependencyRollbackPlan.summary.snapshotCoveredItemCount} snapshots</Tag>
        <Tag>{dependencyRollbackPlan.summary.blockedItemCount} blocked</Tag>
      </Space>
    )}
  </Card>)
}

function DependencyImpactAnalysisMetric({ dependencyImpactAnalysis }: Pick<PanelValues, 'dependencyImpactAnalysis'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.impactAnalysis')}</Text>
    <Title level={3}>{dependencyImpactAnalysis ? dependencyImpactAnalysis.summary.itemCount : '-'}</Title>
    {dependencyImpactAnalysis && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyImpactAnalysis.status)}>
          {readinessStatusLabel(dependencyImpactAnalysis.status)}
        </Tag>
        <Tag>{dependencyImpactAnalysis.summary.highItemCount + dependencyImpactAnalysis.summary.criticalItemCount} high+</Tag>
        <Tag>{dependencyImpactAnalysis.summary.ciJobCount} CI jobs</Tag>
      </Space>
    )}
  </Card>)
}

function DependencyChangeApprovalPacketMetric({ dependencyChangeApprovalPacket }: Pick<PanelValues, 'dependencyChangeApprovalPacket'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.approvalPacket')}</Text>
    <Title level={3}>{dependencyChangeApprovalPacket ? dependencyChangeApprovalPacket.summary.checklistCount : '-'}</Title>
    {dependencyChangeApprovalPacket && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyChangeApprovalPacket.status)}>
          {readinessStatusLabel(dependencyChangeApprovalPacket.status)}
        </Tag>
        <Tag>{dependencyChangeApprovalPacket.decision}</Tag>
        <Tag>{dependencyChangeApprovalPacket.summary.blockedChecklistCount} blocked</Tag>
      </Space>
    )}
  </Card>)
}

function DependencyChangeCalendarMetric({ dependencyChangeCalendar }: Pick<PanelValues, 'dependencyChangeCalendar'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.changeCalendar')}</Text>
    <Title level={3}>{dependencyChangeCalendar ? dependencyChangeCalendar.summary.windowCount : '-'}</Title>
    {dependencyChangeCalendar && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyChangeCalendar.status)}>
          {readinessStatusLabel(dependencyChangeCalendar.status)}
        </Tag>
        <Tag>{dependencyChangeCalendar.summary.freezeWindowCount} freezes</Tag>
        <Tag>{dependencyChangeCalendar.summary.needsReviewWindowCount} review</Tag>
      </Space>
    )}
  </Card>)
}

function DependencyChangeExecutionRecordMetric({ dependencyChangeExecutionRecord }: Pick<PanelValues, 'dependencyChangeExecutionRecord'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.executionRecord')}</Text>
    <Title level={3}>{dependencyChangeExecutionRecord ? dependencyChangeExecutionRecord.summary.recordCount : '-'}</Title>
    {dependencyChangeExecutionRecord && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(dependencyChangeExecutionRecord.status)}>
          {readinessStatusLabel(dependencyChangeExecutionRecord.status)}
        </Tag>
        <Tag>{dependencyChangeExecutionRecord.summary.completedRecordCount} done</Tag>
        <Tag>{dependencyChangeExecutionRecord.summary.missingOperationEvidenceCount} gaps</Tag>
      </Space>
    )}
  </Card>)
}

function PolicyAsCodePackMetric({ policyAsCodePack }: Pick<PanelValues, 'policyAsCodePack'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.policyAsCode')}</Text>
    <Title level={3}>{policyAsCodePack ? policyAsCodePack.summary.dependencyPolicyRuleCount : '-'}</Title>
    {policyAsCodePack && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(policyAsCodePack.status)}>
          {readinessStatusLabel(policyAsCodePack.status)}
        </Tag>
        <Tag>{policyAsCodePack.summary.readinessGateCount} gates</Tag>
        <Tag>{policyAsCodePack.summary.deploymentPolicyGateCount} deploy</Tag>
      </Space>
    )}
  </Card>)
}

function ReleaseEvidenceCompletenessMetric({ releaseEvidenceCompleteness }: Pick<PanelValues, 'releaseEvidenceCompleteness'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.evidenceCompleteness')}</Text>
    <Title level={3}>{releaseEvidenceCompleteness ? releaseEvidenceCompleteness.summary.presentArtifactCount : '-'}</Title>
    {releaseEvidenceCompleteness && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(releaseEvidenceCompleteness.status)}>
          {readinessStatusLabel(releaseEvidenceCompleteness.status)}
        </Tag>
        <Tag>{releaseEvidenceCompleteness.summary.missingRequiredArtifactCount} missing</Tag>
        <Tag>{releaseEvidenceCompleteness.summary.requiredIntegrityMismatchCount} mismatch</Tag>
      </Space>
    )}
  </Card>)
}

function ReleaseProvenanceAttestationMetric({ releaseProvenanceAttestation }: Pick<PanelValues, 'releaseProvenanceAttestation'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.releaseProvenance')}</Text>
    <Title level={3}>{releaseProvenanceAttestation ? releaseProvenanceAttestation.summary.artifactCount : '-'}</Title>
    {releaseProvenanceAttestation && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(releaseProvenanceAttestation.status)}>
          {readinessStatusLabel(releaseProvenanceAttestation.status)}
        </Tag>
        <Tag color={releaseProvenanceAttestation.summary.gitDirty ? 'orange' : 'green'}>
          {releaseProvenanceAttestation.summary.gitDirty ? 'dirty' : 'clean'}
        </Tag>
      </Space>
    )}
  </Card>)
}

function ReleaseIntegrityVerificationMetric({ releaseIntegrityVerification }: Pick<PanelValues, 'releaseIntegrityVerification'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.releaseIntegrity')}</Text>
    <Title level={3}>{releaseIntegrityVerification ? releaseIntegrityVerification.summary.verifiedArtifactCount : '-'}</Title>
    {releaseIntegrityVerification && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(releaseIntegrityVerification.status)}>
          {readinessStatusLabel(releaseIntegrityVerification.status)}
        </Tag>
        <Tag>{releaseIntegrityVerification.summary.requiredMismatchArtifactCount} required mismatch</Tag>
      </Space>
    )}
  </Card>)
}

function ReleaseSignatureMetric({ releaseSignature }: Pick<PanelValues, 'releaseSignature'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.releaseSignature')}</Text>
    <Title level={3}>{releaseSignature ? releaseSignature.summary.includedSourceCount : '-'}</Title>
    {releaseSignature && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(releaseSignature.status)}>
          {readinessStatusLabel(releaseSignature.status)}
        </Tag>
        <Tag color={releaseSignature.summary.signed ? 'green' : 'orange'}>
          {releaseSignature.summary.signed ? 'signed' : 'unsigned'}
        </Tag>
        <Tag>{releaseSignature.summary.verificationStatus}</Tag>
      </Space>
    )}
  </Card>)
}

function ReleaseTrustPolicyMetric({ releaseTrustPolicy }: Pick<PanelValues, 'releaseTrustPolicy'>) {
  const t = useT()
  return (<Card className={styles.metricCard} variant="borderless">
    <Text type="secondary">{t('health.metric.releaseTrust')}</Text>
    <Title level={3}>{releaseTrustPolicy ? releaseTrustPolicy.summary.passedCheckCount : '-'}</Title>
    {releaseTrustPolicy && (
      <Space size={4} wrap>
        <Tag color={readinessStatusColor(releaseTrustPolicy.status)}>
          {readinessStatusLabel(releaseTrustPolicy.status)}
        </Tag>
        <Tag>{releaseTrustPolicy.summary.blockedCheckCount} blocked</Tag>
        <Tag color={releaseTrustPolicy.summary.signatureVerified ? 'green' : 'orange'}>
          {releaseTrustPolicy.summary.signatureVerified ? 'verified' : 'unverified'}
        </Tag>
      </Space>
    )}
  </Card>)
}
