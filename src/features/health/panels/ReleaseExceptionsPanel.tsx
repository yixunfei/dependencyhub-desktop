import { WarningOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'latestReleaseException' | 'releaseExceptions' | 'recentReleaseExceptions'>

export function ReleaseExceptionsPanel({ currentPath, latestReleaseException, releaseExceptions, recentReleaseExceptions }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <WarningOutlined />
          <Text strong>Release exceptions</Text>
          {latestReleaseException && (
            <Tag color={latestReleaseException.decision === 'approved' ? 'orange' : 'default'}>
              {latestReleaseException.decision}
            </Tag>
          )}
          <Tag>{releaseExceptions.length} records</Tag>
        </Space>
        <Text type="secondary">
          {latestReleaseException ? new Date(latestReleaseException.decidedAt).toLocaleString() : 'No release exception recorded'}
        </Text>
      </div>
      <ReleaseExceptionsPanelTable recentReleaseExceptions={recentReleaseExceptions} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ReleaseExceptionsPanelTable({ recentReleaseExceptions }: Pick<PanelValues, 'recentReleaseExceptions'>) {
  return (<Table
    dataSource={recentReleaseExceptions}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No release exception evidence recorded" /> }}
    columns={[
      {
        title: 'Decision',
        dataIndex: 'decision',
        key: 'decision',
        width: 120,
        render: (decision: ReleaseExceptionDecision) => <Tag color={decision === 'approved' ? 'orange' : 'default'}>{decision}</Tag>
      },
      {
        title: 'Reviewer',
        dataIndex: 'reviewer',
        key: 'reviewer',
        width: 180
      },
      {
        title: 'Checks',
        dataIndex: 'checkIds',
        key: 'checkIds',
        width: 220,
        render: (checkIds: string[]) => (
          <Space size={4} wrap>
            {checkIds.slice(0, 4).map((checkId) => <Tag key={checkId}>{checkId}</Tag>)}
            {checkIds.length > 4 && <Tag>+{checkIds.length - 4}</Tag>}
          </Space>
        )
      },
      {
        title: 'Expires',
        dataIndex: 'expiresAt',
        key: 'expiresAt',
        width: 190,
        render: (value?: string) => value ? new Date(value).toLocaleString() : '-'
      },
      {
        title: 'Reason',
        dataIndex: 'reason',
        key: 'reason',
        ellipsis: true
      }
    ]}
  />)
}
