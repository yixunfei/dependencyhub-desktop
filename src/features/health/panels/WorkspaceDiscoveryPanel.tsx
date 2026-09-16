import { ApartmentOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'workspaceReport' | 'workspaceRows'>

export function WorkspaceDiscoveryPanel({ currentPath, workspaceReport, workspaceRows }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ApartmentOutlined />
          <Text strong>Workspace discovery</Text>
          <Tag>{workspaceReport?.summary.workspaceCount || 0} workspaces</Tag>
          <Tag>{workspaceReport?.summary.managerCount || 0} managers</Tag>
          {(workspaceReport?.summary.explicitWorkspaceCount || 0) > 0 && (
            <Tag color="blue">{workspaceReport?.summary.explicitWorkspaceCount} explicit</Tag>
          )}
        </Space>
        <Text type="secondary">
          {workspaceReport ? new Date(workspaceReport.generatedAt).toLocaleString() : 'Not scanned'}
        </Text>
      </div>
      {workspaceReport && (
        <div className={styles.readinessSummary}>
          <span>Manifests: {workspaceReport.summary.manifestFileCount}</span>
          <span>Locks: {workspaceReport.summary.lockFileCount}</span>
          <span>Configs: {workspaceReport.summary.configFileCount}</span>
          <span>Managers: {workspaceReport.summary.managers.join(', ') || '-'}</span>
        </div>
      )}
      <WorkspaceDiscoveryPanelTable workspaceRows={workspaceRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function WorkspaceDiscoveryPanelTable({ workspaceRows }: Pick<PanelValues, 'workspaceRows'>) {
  return (<Table
    dataSource={workspaceRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No workspace scan results" /> }}
    columns={[
      {
        title: 'Workspace',
        key: 'workspace',
        width: 230,
        render: (_: unknown, record: WorkspaceNode) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.name}</Text>
            {record.version && <Text type="secondary">{record.version}</Text>}
          </Space>
        )
      },
      {
        title: 'Kind',
        dataIndex: 'kind',
        key: 'kind',
        width: 160,
        render: (kind: WorkspaceKind) => <Tag>{kind}</Tag>
      },
      {
        title: 'Managers',
        dataIndex: 'managerIds',
        key: 'managerIds',
        width: 210,
        render: (managerIds: DependencyManagerId[]) => (
          <Space size={4} wrap>
            {managerIds.length > 0
              ? managerIds.map((managerId) => (
                <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>
              ))
              : '-'}
          </Space>
        )
      },
      {
        title: 'Path',
        dataIndex: 'relativePath',
        key: 'relativePath',
        width: 220,
        ellipsis: true
      },
      {
        title: 'Manifests',
        dataIndex: 'manifestFiles',
        key: 'manifestFiles',
        ellipsis: true,
        render: (files: string[]) => files.length ? files.join(', ') : '-'
      },
      {
        title: 'Locks',
        dataIndex: 'lockFiles',
        key: 'lockFiles',
        ellipsis: true,
        render: (files: string[]) => files.length ? files.join(', ') : '-'
      }
    ]}
  />)
}
