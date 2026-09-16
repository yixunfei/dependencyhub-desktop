import { ToolOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { readinessStatusColor, readinessStatusLabel, upgradePriorityColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyUpgradePlaybook' | 'dependencyUpgradeLanes' | 'dependencyUpgradeItems'>

export function DependencyUpgradePanel({ dependencyUpgradePlaybook, dependencyUpgradeLanes, dependencyUpgradeItems }: Props) {
  return (dependencyUpgradePlaybook && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ToolOutlined />
          <Text strong>Dependency upgrade playbook</Text>
          <Tag color={readinessStatusColor(dependencyUpgradePlaybook.status)}>
            {readinessStatusLabel(dependencyUpgradePlaybook.status)}
          </Tag>
          <Tag>{dependencyUpgradePlaybook.summary.itemCount} items</Tag>
          <Tag>{dependencyUpgradePlaybook.summary.laneCount} lanes</Tag>
          <Tag color={dependencyUpgradePlaybook.summary.blockedItemCount > 0 ? 'red' : 'default'}>
            {dependencyUpgradePlaybook.summary.blockedItemCount} blocked
          </Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyUpgradePlaybook.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Immediate: {dependencyUpgradePlaybook.summary.immediateItemCount}</span>
        <span>Urgent: {dependencyUpgradePlaybook.summary.urgentItemCount}</span>
        <span>Scheduled: {dependencyUpgradePlaybook.summary.scheduledItemCount}</span>
        <span>Security: {dependencyUpgradePlaybook.summary.securityItemCount}</span>
        <span>Release blockers: {dependencyUpgradePlaybook.summary.releaseBlockerItemCount}</span>
        <span>Automation: {dependencyUpgradePlaybook.summary.automationItemCount}</span>
        <span>Ownership: {dependencyUpgradePlaybook.summary.ownershipItemCount}</span>
        <span>Commands: {dependencyUpgradePlaybook.summary.commandCount}</span>
        <span>Owners: {dependencyUpgradePlaybook.summary.ownerCount}</span>
      </div>
      <DependencyUpgradePanelTable dependencyUpgradeLanes={dependencyUpgradeLanes} />
      <DependencyUpgradePanelTable2 dependencyUpgradeItems={dependencyUpgradeItems} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function DependencyUpgradePanelTable({ dependencyUpgradeLanes }: Pick<PanelValues, 'dependencyUpgradeLanes'>) {
  return (<Table
    dataSource={dependencyUpgradeLanes}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No upgrade lanes" /> }}
    columns={[
      {
        title: 'Lane',
        dataIndex: 'title',
        key: 'title',
        width: 220
      },
      {
        title: 'Priority',
        dataIndex: 'priority',
        key: 'priority',
        width: 120,
        render: (priority: DependencyUpgradeLanePriority) => <Tag color={upgradePriorityColor(priority)}>{priority}</Tag>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DependencyUpgradePlaybookStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Items',
        key: 'items',
        width: 180,
        render: (_: unknown, record: DependencyUpgradePlaybookLane) => (
          <Space size={4} wrap>
            <Tag>{record.itemCount} total</Tag>
            <Tag color={record.blockedItemCount > 0 ? 'red' : 'default'}>{record.blockedItemCount} blocked</Tag>
            <Tag>{record.commandCount} commands</Tag>
          </Space>
        )
      },
      {
        title: 'Scope',
        key: 'scope',
        render: (_: unknown, record: DependencyUpgradePlaybookLane) => (
          <Space size={4} wrap>
            <Tag>{record.workspaceCount} workspaces</Tag>
            <Tag>{record.managerCount} managers</Tag>
          </Space>
        )
      }
    ]}
  />)
}

function DependencyUpgradePanelTable2({ dependencyUpgradeItems }: Pick<PanelValues, 'dependencyUpgradeItems'>) {
  return (<Table
    dataSource={dependencyUpgradeItems}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No upgrade playbook items" /> }}
    columns={[
      {
        title: 'Priority',
        dataIndex: 'priority',
        key: 'priority',
        width: 120,
        render: (priority: DependencyUpgradeLanePriority) => <Tag color={upgradePriorityColor(priority)}>{priority}</Tag>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DependencyUpgradePlaybookStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Item',
        key: 'item',
        width: 300,
        render: (_: unknown, record: DependencyUpgradePlaybookItem) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.title}</Text>
            <Text type="secondary">{record.summary}</Text>
          </Space>
        )
      },
      {
        title: 'Scope',
        key: 'scope',
        width: 190,
        render: (_: unknown, record: DependencyUpgradePlaybookItem) => (
          <Space size={4} wrap>
            {record.managerId && <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>}
            <Tag>{record.workspaceRelativePath || '.'}</Tag>
          </Space>
        )
      },
      {
        title: 'Owners',
        dataIndex: 'owners',
        key: 'owners',
        width: 190,
        render: (owners: string[]) => owners.length > 0
          ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
          : <Tag>unassigned</Tag>
      },
      {
        title: 'Commands',
        key: 'commands',
        width: 130,
        render: (_: unknown, record: DependencyUpgradePlaybookItem) => (
          <Space size={4} wrap>
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
