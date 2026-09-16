import { RollbackOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { readinessStatusColor, readinessStatusLabel, rollbackPriorityColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyRollbackPlan' | 'dependencyRollbackItems'>

export function DependencyRollbackPanel({ dependencyRollbackPlan, dependencyRollbackItems }: Props) {
  return (dependencyRollbackPlan && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <RollbackOutlined />
          <Text strong>Dependency rollback plan</Text>
          <Tag color={readinessStatusColor(dependencyRollbackPlan.status)}>
            {readinessStatusLabel(dependencyRollbackPlan.status)}
          </Tag>
          <Tag>{dependencyRollbackPlan.summary.itemCount} items</Tag>
          <Tag>{dependencyRollbackPlan.summary.snapshotCoveredItemCount} snapshot-covered</Tag>
          <Tag color={dependencyRollbackPlan.summary.blockedItemCount > 0 ? 'red' : 'default'}>
            {dependencyRollbackPlan.summary.blockedItemCount} blocked
          </Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyRollbackPlan.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Required: {dependencyRollbackPlan.summary.requiredItemCount}</span>
        <span>Recommended: {dependencyRollbackPlan.summary.recommendedItemCount}</span>
        <span>Optional: {dependencyRollbackPlan.summary.optionalItemCount}</span>
        <span>Lockfile-covered: {dependencyRollbackPlan.summary.lockfileCoveredItemCount}</span>
        <span>Manifests: {dependencyRollbackPlan.summary.manifestCoveredItemCount}</span>
        <span>Git restore: {dependencyRollbackPlan.summary.sourceControlCommandCount}</span>
        <span>Actions: {dependencyRollbackPlan.summary.rollbackActionCount}</span>
        <span>Verify: {dependencyRollbackPlan.summary.verificationCommandCount}</span>
        <span>Failed ops: {dependencyRollbackPlan.summary.recentFailedOperationCount}</span>
      </div>
      <DependencyRollbackPanelTable dependencyRollbackItems={dependencyRollbackItems} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function DependencyRollbackPanelTable({ dependencyRollbackItems }: Pick<PanelValues, 'dependencyRollbackItems'>) {
  return (<Table
    dataSource={dependencyRollbackItems}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No dependency rollback items" /> }}
    columns={[
      {
        title: 'Priority',
        dataIndex: 'priority',
        key: 'priority',
        width: 125,
        render: (priority: DependencyRollbackPlanPriority) => <Tag color={rollbackPriorityColor(priority)}>{priority}</Tag>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DependencyRollbackPlanStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Scope',
        key: 'scope',
        width: 210,
        render: (_: unknown, record: DependencyRollbackPlanItem) => (
          <Space size={4} wrap>
            <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
            <Tag>{record.workspaceRelativePath || '.'}</Tag>
          </Space>
        )
      },
      {
        title: 'Anchors',
        key: 'anchors',
        width: 270,
        render: (_: unknown, record: DependencyRollbackPlanItem) => (
          <Space size={4} wrap>
            {record.anchors.map((anchor) => (
              <Tag key={`${record.id}:${anchor.kind}`} color={readinessStatusColor(anchor.status)}>
                {anchor.kind}: {anchor.count ?? 0}
              </Tag>
            ))}
          </Space>
        )
      },
      {
        title: 'Commands',
        key: 'commands',
        width: 155,
        render: (_: unknown, record: DependencyRollbackPlanItem) => (
          <Space size={4} wrap>
            <Tag>{record.rollbackActions.length} actions</Tag>
            <Tag>{record.commands.length} run</Tag>
            <Tag>{record.verificationCommands.length} verify</Tag>
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
