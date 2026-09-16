import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import {
  CalendarOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface AutomationGovernanceOverviewProps {
  ciIntegrationPlan: CiIntegrationPlanReport | null
  dependencyAutomationPlan: DependencyAutomationPlanReport | null
  credentialRotationPlan: CredentialRotationPlanReport | null
  automationSafetyPlan: AutomationSafetyPlanReport | null
  dependencyOwnershipPlan: DependencyOwnershipPlanReport | null
  dependencyUpgradePlaybook: DependencyUpgradePlaybookReport | null
  dependencyImpactAnalysis: DependencyImpactAnalysisReport | null
  dependencyChangeCalendar: DependencyChangeCalendarReport | null
  dependencyChangeExecutionRecord: DependencyChangeExecutionReport | null
  reportArtifactIndex: ReportArtifactIndexReport | null
}

const AutomationGovernanceOverview: React.FC<AutomationGovernanceOverviewProps> = ({
  ciIntegrationPlan,
  dependencyAutomationPlan,
  credentialRotationPlan,
  automationSafetyPlan,
  dependencyOwnershipPlan,
  dependencyUpgradePlaybook,
  dependencyImpactAnalysis,
  dependencyChangeCalendar,
  dependencyChangeExecutionRecord,
  reportArtifactIndex
}) => {
  const hasAnySignal = Boolean(
    ciIntegrationPlan
    || dependencyAutomationPlan
    || credentialRotationPlan
    || automationSafetyPlan
    || dependencyOwnershipPlan
    || dependencyUpgradePlaybook
    || dependencyImpactAnalysis
    || dependencyChangeCalendar
    || dependencyChangeExecutionRecord
  )
  const blockedSignalCount = [
    ciIntegrationPlan?.status,
    dependencyAutomationPlan?.status,
    credentialRotationPlan?.status,
    automationSafetyPlan?.status,
    dependencyOwnershipPlan?.status,
    dependencyUpgradePlaybook?.status,
    dependencyImpactAnalysis?.status,
    dependencyChangeCalendar?.status,
    dependencyChangeExecutionRecord?.status
  ].filter((status) => status === 'blocked').length
  const warningSignalCount = [
    ciIntegrationPlan?.status,
    dependencyAutomationPlan?.status,
    credentialRotationPlan?.status,
    automationSafetyPlan?.status,
    dependencyOwnershipPlan?.status,
    dependencyUpgradePlaybook?.status,
    dependencyImpactAnalysis?.status,
    dependencyChangeCalendar?.status,
    dependencyChangeExecutionRecord?.status
  ].filter((status) => status === 'warning').length
  const cockpitStatus = !hasAnySignal
    ? 'not available'
    : blockedSignalCount > 0
      ? 'blocked'
      : warningSignalCount > 0
        ? 'needs review'
        : 'ready'
  const automationFindingCount = (dependencyAutomationPlan?.summary.warningCount || 0)
    + (automationSafetyPlan?.summary.findingCount || 0)
    + (dependencyOwnershipPlan?.summary.findingCount || 0)
    + (credentialRotationPlan?.summary.actionCount || 0)
  const executionGapCount = (dependencyChangeExecutionRecord?.summary.missingOperationEvidenceCount || 0)
    + (dependencyChangeExecutionRecord?.summary.missingCiEvidenceCount || 0)
    + (dependencyChangeExecutionRecord?.summary.failedRecordCount || 0)
    + (dependencyChangeExecutionRecord?.summary.blockedRecordCount || 0)
  const highImpactCount = (dependencyImpactAnalysis?.summary.criticalItemCount || 0)
    + (dependencyImpactAnalysis?.summary.highItemCount || 0)

  return (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ExperimentOutlined />
          <Text strong>Automation governance cockpit</Text>
          <Tag color={statusColor(cockpitStatus)}>{cockpitStatus}</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.automation || 0} automation reports</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.operations || 0} operation reports</Tag>
          <Tag>{automationFindingCount} automation findings</Tag>
        </Space>
        <Text type="secondary">CI plans, update bots, safety rules, ownership routing, change windows, and execution evidence</Text>
      </div>

      <div className={styles.cards}>
        <AutomationCard
          icon={<ToolOutlined />}
          title="CI integration"
          status={ciIntegrationPlan?.status}
          primary={`${ciIntegrationPlan?.summary.jobCount || 0} CI jobs`}
          detail={`${ciIntegrationPlan?.summary.matrixEntryCount || 0} targets / ${ciIntegrationPlan?.summary.deploymentWarningCount || 0} deployment gates`}
        />
        <AutomationCard
          icon={<RocketOutlined />}
          title="Update bots"
          status={dependencyAutomationPlan?.status}
          primary={`${dependencyAutomationPlan?.summary.generatedConfigCount || 0} configs`}
          detail={`${dependencyAutomationPlan?.summary.targetCount || 0} targets / ${dependencyAutomationPlan?.summary.requiredSecretCount || 0} required secrets`}
        />
        <AutomationCard
          icon={<SafetyCertificateOutlined />}
          title="Automation secrets"
          status={credentialRotationPlan?.status}
          primary={`${credentialRotationPlan?.summary.automationSecretCount || 0} secrets`}
          detail={`${credentialRotationPlan?.summary.blockedActionCount || 0} blocked actions / ${credentialRotationPlan?.summary.missingCredentialEndpointCount || 0} credential gaps`}
        />
        <AutomationCard
          icon={<WarningOutlined />}
          title="Safety rules"
          status={automationSafetyPlan?.status}
          primary={`${automationSafetyPlan?.summary.ruleCount || 0} rules`}
          detail={`${automationSafetyPlan?.summary.autoMergeRuleCount || 0} auto-merge / ${automationSafetyPlan?.summary.reviewRuleCount || 0} review / ${automationSafetyPlan?.summary.blockedRuleCount || 0} blocked`}
        />
        <AutomationCard
          icon={<TeamOutlined />}
          title="Ownership"
          status={dependencyOwnershipPlan?.status}
          primary={`${dependencyOwnershipPlan?.summary.reviewRouteCount || 0} routes`}
          detail={`${dependencyOwnershipPlan?.summary.missingOwnerAssignmentCount || 0} missing owners / ${dependencyOwnershipPlan?.summary.suggestedEntryCount || 0} CODEOWNERS suggestions`}
        />
        <AutomationCard
          icon={<RocketOutlined />}
          title="Upgrade playbook"
          status={dependencyUpgradePlaybook?.status}
          primary={`${dependencyUpgradePlaybook?.summary.itemCount || 0} items`}
          detail={`${dependencyUpgradePlaybook?.summary.laneCount || 0} lanes / ${dependencyUpgradePlaybook?.summary.securityItemCount || 0} security / ${dependencyUpgradePlaybook?.summary.releaseBlockerItemCount || 0} release blockers`}
        />
        <AutomationCard
          icon={<WarningOutlined />}
          title="Impact analysis"
          status={dependencyImpactAnalysis?.status}
          primary={`${dependencyImpactAnalysis?.summary.itemCount || 0} scopes`}
          detail={`${highImpactCount} high+ impact / ${dependencyImpactAnalysis?.summary.missingOwnerItemCount || 0} missing owners`}
        />
        <AutomationCard
          icon={<CalendarOutlined />}
          title="Change windows"
          status={dependencyChangeCalendar?.status}
          primary={`${dependencyChangeCalendar?.summary.windowCount || 0} windows`}
          detail={`${dependencyChangeCalendar?.summary.freezeWindowCount || 0} freezes / ${dependencyChangeCalendar?.summary.automationWindowCount || 0} automation windows`}
        />
        <AutomationCard
          icon={<HistoryOutlined />}
          title="Execution evidence"
          status={dependencyChangeExecutionRecord?.status}
          primary={`${dependencyChangeExecutionRecord?.summary.recordCount || 0} records`}
          detail={`${executionGapCount} evidence gaps / ${dependencyChangeExecutionRecord?.summary.verificationPassedCount || 0} verified`}
        />
      </div>
    </div>
  )
}

interface AutomationCardProps {
  icon: React.ReactNode
  title: string
  status?: string
  primary: string
  detail: string
}

const AutomationCard: React.FC<AutomationCardProps> = ({ icon, title, status, primary, detail }) => (
  <Card className={styles.metricCard} variant="borderless">
    <Space orientation="vertical" size={6}>
      <Space wrap>
        {icon}
        <Text type="secondary">{title}</Text>
        <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
      </Space>
      <Text strong>{primary}</Text>
      <Text type="secondary">{detail}</Text>
    </Space>
  </Card>
)

function statusColor(status?: string): string {
  if (!status || status === 'not available') return 'default'
  if (status === 'ready' || status === 'passed' || status === 'success' || status === 'auto-merge') return 'green'
  if (status === 'blocked' || status === 'failed' || status === 'error') return 'red'
  if (status === 'warning' || status === 'needs review' || status === 'needs-review' || status === 'review') return 'orange'
  return 'blue'
}

function statusLabel(status?: string): string {
  return status || 'not available'
}

export default AutomationGovernanceOverview
