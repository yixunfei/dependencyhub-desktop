import { ReloadOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { automationWarningColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyAutomationPlan' | 'dependencyAutomationWarnings'>

export function DependencyAutomationPanel({ dependencyAutomationPlan, dependencyAutomationWarnings }: Props) {
  return (dependencyAutomationPlan && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ReloadOutlined />
          <Text strong>Dependency automation plan</Text>
          <Tag color={readinessStatusColor(dependencyAutomationPlan.status)}>
            {readinessStatusLabel(dependencyAutomationPlan.status)}
          </Tag>
          <Tag>{dependencyAutomationPlan.summary.dependabotTargetCount} Dependabot</Tag>
          <Tag>{dependencyAutomationPlan.summary.renovateTargetCount} Renovate</Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyAutomationPlan.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Managers: {dependencyAutomationPlan.summary.managers.join(', ') || '-'}</span>
        <span>Secrets: {dependencyAutomationPlan.summary.requiredSecretCount}</span>
        <span>Unsupported Dependabot: {dependencyAutomationPlan.summary.unsupportedDependabotManagerCount}</span>
        <span>Unsupported Renovate: {dependencyAutomationPlan.summary.unsupportedRenovateManagerCount}</span>
        <span>Lock warnings: {dependencyAutomationPlan.summary.lockfileWarningCount}</span>
        <span>Warnings: {dependencyAutomationPlan.summary.warningCount}</span>
      </div>
      <DependencyAutomationPanelTable dependencyAutomationPlan={dependencyAutomationPlan} />
      <DependencyAutomationPanelTable2 dependencyAutomationWarnings={dependencyAutomationWarnings} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function DependencyAutomationPanelTable({ dependencyAutomationPlan }: Pick<PanelValues, 'dependencyAutomationPlan'>) {
  return (<Table
    dataSource={dependencyAutomationPlan.targets.filter((target) => target.supported).slice(0, 16)}
    rowKey="id"
    size="small"
    pagination={false}
    columns={[
      {
        title: 'Provider',
        dataIndex: 'provider',
        key: 'provider',
        width: 120,
        render: (provider: DependencyAutomationProvider) => <Tag>{provider}</Tag>
      },
      {
        title: 'Workspace',
        dataIndex: 'workspaceRelativePath',
        key: 'workspaceRelativePath',
        width: 180,
        render: (path: string, record: DependencyAutomationTarget) => (
          <Space orientation="vertical" size={0}>
            <Text>{record.workspaceName}</Text>
            <Text type="secondary">{path}</Text>
          </Space>
        )
      },
      {
        title: 'Manager',
        dataIndex: 'managerId',
        key: 'managerId',
        width: 110,
        render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
      },
      {
        title: 'Ecosystem',
        key: 'ecosystem',
        width: 170,
        render: (_: unknown, record: DependencyAutomationTarget) => record.packageEcosystem || record.renovateManager || '-'
      },
      {
        title: 'Directory',
        dataIndex: 'directory',
        key: 'directory',
        width: 160
      },
      {
        title: 'Secrets',
        dataIndex: 'requiredSecrets',
        key: 'requiredSecrets',
        ellipsis: true,
        render: (secrets: string[]) => secrets.join(', ') || '-'
      }
    ]}
  />)
}

function DependencyAutomationPanelTable2({ dependencyAutomationWarnings }: Pick<PanelValues, 'dependencyAutomationWarnings'>) {
  return (<Table
    dataSource={dependencyAutomationWarnings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No automation warnings" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: DependencyAutomationWarningSeverity) => <Tag color={automationWarningColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 180,
        render: (source: DependencyAutomationWarningSource) => <Tag>{source}</Tag>
      },
      {
        title: 'Warning',
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
