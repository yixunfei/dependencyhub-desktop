import { Button, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { snapshotSourceColor, snapshotSourceLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'recentSnapshots' | 'snapshots' | 'openSnapshot' | 'restoreSnapshot' | 'reporting'>

export function SnapshotHistoryPanel({ recentSnapshots, snapshots, openSnapshot, restoreSnapshot, reporting }: Props) {
  return (recentSnapshots.length > 0 && (
    <div className={styles.snapshotPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <Text strong>最近快照</Text>
          <Tag>{snapshots.length} 个快照</Tag>
        </Space>
        <Text type="secondary">自动快照会记录触发命令，便于恢复前判断来源。</Text>
      </div>
      <SnapshotHistoryPanelTable recentSnapshots={recentSnapshots} openSnapshot={openSnapshot} restoreSnapshot={restoreSnapshot} reporting={reporting} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function SnapshotHistoryPanelTable({ recentSnapshots, openSnapshot, restoreSnapshot, reporting }: Pick<PanelValues,
  'recentSnapshots' | 'openSnapshot' | 'restoreSnapshot' | 'reporting'
>) {
  return (<Table
    dataSource={recentSnapshots}
    rowKey="id"
    size="small"
    pagination={false}
    columns={[
      {
        title: '时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 190,
        render: (value: string) => new Date(value).toLocaleString()
      },
      {
        title: '来源',
        dataIndex: 'source',
        key: 'source',
        width: 110,
        render: (source: SupplyChainSnapshotSource | undefined) => (
          <Tag color={snapshotSourceColor(source)}>{snapshotSourceLabel(source)}</Tag>
        )
      },
      {
        title: '触发原因',
        dataIndex: 'reason',
        key: 'reason',
        ellipsis: true,
        render: (reason: string | undefined) => reason || '手动创建'
      },
      {
        title: '文件',
        dataIndex: 'fileCount',
        key: 'fileCount',
        width: 80
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        render: (_: unknown, snapshot: SupplyChainSnapshotSummary) => (
          <Space>
            <Button size="small" onClick={() => openSnapshot(snapshot)}>
              打开
            </Button>
            <Popconfirm
              title="恢复这个快照？"
              description="恢复前会自动创建保护快照。"
              okText="恢复"
              cancelText="取消"
              onConfirm={() => restoreSnapshot(snapshot)}
            >
              <Button size="small" danger loading={reporting}>
                恢复
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ]}
  />)
}
