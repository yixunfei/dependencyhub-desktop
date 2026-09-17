import { Button, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { useT } from '../../../i18n'
import { snapshotSourceColor, snapshotSourceLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'recentSnapshots' | 'snapshots' | 'openSnapshot' | 'restoreSnapshot' | 'reporting'>

export function SnapshotHistoryPanel({ recentSnapshots, snapshots, openSnapshot, restoreSnapshot, reporting }: Props) {
  const t = useT()
  return (recentSnapshots.length > 0 && (
    <div className={styles.snapshotPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <Text strong>{t('health.recentSnapshots')}</Text>
          <Tag>{t('health.snapshotCount', { count: snapshots.length })}</Tag>
        </Space>
        <Text type="secondary">{t('health.snapshotAutoHint')}</Text>
      </div>
      <SnapshotHistoryPanelTable recentSnapshots={recentSnapshots} openSnapshot={openSnapshot} restoreSnapshot={restoreSnapshot} reporting={reporting} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function SnapshotHistoryPanelTable({ recentSnapshots, openSnapshot, restoreSnapshot, reporting }: Pick<PanelValues,
  'recentSnapshots' | 'openSnapshot' | 'restoreSnapshot' | 'reporting'
>) {
  const t = useT()
  return (<Table
    dataSource={recentSnapshots}
    rowKey="id"
    size="small"
    pagination={false}
    columns={[
      {
        title: t('common.time'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 190,
        render: (value: string) => new Date(value).toLocaleString()
      },
      {
        title: t('common.source'),
        dataIndex: 'source',
        key: 'source',
        width: 110,
        render: (source: SupplyChainSnapshotSource | undefined) => (
          <Tag color={snapshotSourceColor(source)}>{snapshotSourceLabel(source, t)}</Tag>
        )
      },
      {
        title: t('health.columnReason'),
        dataIndex: 'reason',
        key: 'reason',
        ellipsis: true,
        render: (reason: string | undefined) => reason || t('health.reasonManual')
      },
      {
        title: t('common.file'),
        dataIndex: 'fileCount',
        key: 'fileCount',
        width: 80
      },
      {
        title: t('common.actions'),
        key: 'action',
        width: 150,
        render: (_: unknown, snapshot: SupplyChainSnapshotSummary) => (
          <Space>
            <Button size="small" onClick={() => openSnapshot(snapshot)}>
              {t('common.open')}
            </Button>
            <Popconfirm
              title={t('health.restoreConfirmTitle')}
              description={t('health.restoreConfirmDescription')}
              okText={t('health.restore')}
              cancelText={t('common.cancel')}
              onConfirm={() => restoreSnapshot(snapshot)}
            >
              <Button size="small" danger loading={reporting}>
                {t('health.restore')}
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ]}
  />)
}
