import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { automationDecisionColor, automationSafetySeverityColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'automationSafetyPlan' | 'automationSafetyFindings'>

export function AutomationSafetyPanel({ automationSafetyPlan, automationSafetyFindings }: Props) {
  return (automationSafetyPlan && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Automation safety plan</Text>
          <Tag color={readinessStatusColor(automationSafetyPlan.status)}>
            {readinessStatusLabel(automationSafetyPlan.status)}
          </Tag>
          <Tag>{automationSafetyPlan.summary.ruleCount} rules</Tag>
          <Tag>{automationSafetyPlan.summary.autoMergeRuleCount} auto-merge</Tag>
        </Space>
        <Text type="secondary">{new Date(automationSafetyPlan.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Targets: {automationSafetyPlan.summary.supportedTargetCount}/{automationSafetyPlan.summary.targetCount}</span>
        <span>Review: {automationSafetyPlan.summary.reviewRuleCount}</span>
        <span>Blocked: {automationSafetyPlan.summary.blockedRuleCount}</span>
        <span>Findings: {automationSafetyPlan.summary.findingCount}</span>
        <span>Readiness: {automationSafetyPlan.summary.readinessStatus || '-'}</span>
        <span>Risk: {automationSafetyPlan.summary.releaseRiskStatus || '-'}</span>
        <span>Credentials: {automationSafetyPlan.summary.credentialRotationStatus || '-'}</span>
        <span>Automation: {automationSafetyPlan.summary.dependencyAutomationStatus || '-'}</span>
      </div>
      <AutomationSafetyPanelTable automationSafetyPlan={automationSafetyPlan} />
      <AutomationSafetyPanelTable2 automationSafetyFindings={automationSafetyFindings} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function AutomationSafetyPanelTable({ automationSafetyPlan }: Pick<PanelValues, 'automationSafetyPlan'>) {
  return (<Table
    dataSource={automationSafetyPlan.rules.slice(0, 16)}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No automation safety rules" /> }}
    columns={[
      {
        title: 'Decision',
        dataIndex: 'decision',
        key: 'decision',
        width: 130,
        render: (decision: AutomationSafetyDecision) => <Tag color={automationDecisionColor(decision)}>{decision}</Tag>
      },
      {
        title: 'Provider',
        dataIndex: 'provider',
        key: 'provider',
        width: 120,
        render: (provider: DependencyAutomationProvider) => <Tag>{provider}</Tag>
      },
      {
        title: 'Manager',
        dataIndex: 'managerId',
        key: 'managerId',
        width: 110,
        render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
      },
      {
        title: 'Update',
        dataIndex: 'updateType',
        key: 'updateType',
        width: 100
      },
      {
        title: 'Approvals',
        dataIndex: 'requiredApprovals',
        key: 'requiredApprovals',
        width: 100
      },
      {
        title: 'Rationale',
        dataIndex: 'rationale',
        key: 'rationale',
        ellipsis: true
      }
    ]}
  />)
}

function AutomationSafetyPanelTable2({ automationSafetyFindings }: Pick<PanelValues, 'automationSafetyFindings'>) {
  return (<Table
    dataSource={automationSafetyFindings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No automation safety findings" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: AutomationSafetyFindingSeverity) => <Tag color={automationSafetySeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 180,
        render: (source: AutomationSafetyFindingSource) => <Tag>{source}</Tag>
      },
      {
        title: 'Finding',
        dataIndex: 'summary',
        key: 'summary',
        ellipsis: true
      },
      {
        title: 'Recommendation',
        dataIndex: 'recommendation',
        key: 'recommendation',
        ellipsis: true
      }
    ]}
  />)
}
