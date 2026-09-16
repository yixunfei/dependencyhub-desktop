import { ApartmentOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { dependencyOwnershipSeverityColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyOwnershipPlan' | 'dependencyOwnershipFindings'>

export function DependencyOwnershipPanel({ dependencyOwnershipPlan, dependencyOwnershipFindings }: Props) {
  return (dependencyOwnershipPlan && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ApartmentOutlined />
          <Text strong>Dependency ownership plan</Text>
          <Tag color={readinessStatusColor(dependencyOwnershipPlan.status)}>
            {readinessStatusLabel(dependencyOwnershipPlan.status)}
          </Tag>
          <Tag>{dependencyOwnershipPlan.summary.ownedAssignmentCount}/{dependencyOwnershipPlan.summary.assignmentCount} owned</Tag>
          <Tag>{dependencyOwnershipPlan.summary.reviewRouteCount} routes</Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyOwnershipPlan.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>CODEOWNERS: {dependencyOwnershipPlan.summary.codeownersFileCount} file(s)</span>
        <span>Entries: {dependencyOwnershipPlan.summary.codeownersEntryCount}</span>
        <span>Owners: {dependencyOwnershipPlan.summary.ownerCount}</span>
        <span>Missing assignments: {dependencyOwnershipPlan.summary.missingOwnerAssignmentCount}</span>
        <span>Blocked routes: {dependencyOwnershipPlan.summary.blockedReviewRouteCount}</span>
        <span>Suggested: {dependencyOwnershipPlan.summary.suggestedEntryCount}</span>
      </div>
      <DependencyOwnershipPanelTable dependencyOwnershipPlan={dependencyOwnershipPlan} />
      <DependencyOwnershipPanelTable2 dependencyOwnershipPlan={dependencyOwnershipPlan} />
      <DependencyOwnershipPanelTable3 dependencyOwnershipFindings={dependencyOwnershipFindings} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function DependencyOwnershipPanelTable({ dependencyOwnershipPlan }: Pick<PanelValues, 'dependencyOwnershipPlan'>) {
  return (<Table
    dataSource={dependencyOwnershipPlan.assignments.slice(0, 16)}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No ownership assignments" /> }}
    columns={[
      {
        title: 'Workspace',
        dataIndex: 'workspaceRelativePath',
        key: 'workspaceRelativePath',
        width: 180,
        ellipsis: true
      },
      {
        title: 'Manager',
        dataIndex: 'managerId',
        key: 'managerId',
        width: 110,
        render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
      },
      {
        title: 'Owners',
        dataIndex: 'owners',
        key: 'owners',
        width: 220,
        render: (owners: string[]) => owners.length > 0
          ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
          : <Tag color="red">missing</Tag>
      },
      {
        title: 'Routes',
        key: 'routes',
        width: 160,
        render: (_: unknown, record: DependencyOwnerAssignment) => (
          <Space size={4} wrap>
            <Tag>{record.automationTargetCount} automation</Tag>
            <Tag color={record.blockedSafetyRuleCount > 0 ? 'red' : 'default'}>{record.safetyRuleCount} safety</Tag>
          </Space>
        )
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

function DependencyOwnershipPanelTable2({ dependencyOwnershipPlan }: Pick<PanelValues, 'dependencyOwnershipPlan'>) {
  return (<Table
    dataSource={dependencyOwnershipPlan.reviewRoutes.slice(0, 16)}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No ownership review routes" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DependencyOwnershipStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
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
        title: 'Owners',
        dataIndex: 'owners',
        key: 'owners',
        width: 220,
        render: (owners: string[]) => owners.length > 0
          ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
          : <Tag color="red">missing</Tag>
      },
      {
        title: 'Escalation',
        dataIndex: 'escalation',
        key: 'escalation',
        ellipsis: true
      }
    ]}
  />)
}

function DependencyOwnershipPanelTable3({ dependencyOwnershipFindings }: Pick<PanelValues, 'dependencyOwnershipFindings'>) {
  return (<Table
    dataSource={dependencyOwnershipFindings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No dependency ownership findings" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: DependencyOwnershipFindingSeverity) => <Tag color={dependencyOwnershipSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 170,
        render: (source: DependencyOwnershipFindingSource) => <Tag>{source}</Tag>
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
