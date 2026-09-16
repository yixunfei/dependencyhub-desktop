import { HistoryOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { ciEvidenceStatusColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'latestCiEvidence' | 'ciEvidence' | 'recentCiEvidence'>

export function CiEvidencePanel({ currentPath, latestCiEvidence, ciEvidence, recentCiEvidence }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <HistoryOutlined />
          <Text strong>CI evidence</Text>
          {latestCiEvidence && (
            <Tag color={ciEvidenceStatusColor(latestCiEvidence.status)}>
              {latestCiEvidence.status}
            </Tag>
          )}
          <Tag>{ciEvidence.length} records</Tag>
        </Space>
        <Text type="secondary">
          {latestCiEvidence ? new Date(latestCiEvidence.finishedAt).toLocaleString() : 'No CI evidence recorded'}
        </Text>
      </div>
      <CiEvidencePanelTable recentCiEvidence={recentCiEvidence} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function CiEvidencePanelTable({ recentCiEvidence }: Pick<PanelValues, 'recentCiEvidence'>) {
  return (<Table
    dataSource={recentCiEvidence}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No CI evidence imported" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: CiEvidenceStatus) => <Tag color={ciEvidenceStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Workflow',
        key: 'workflow',
        width: 220,
        render: (_: unknown, record: CiEvidenceRecord) => (
          <Space size={4} wrap>
            <Tag>{record.source}</Tag>
            <span>{record.workflow || record.provider || '-'}</span>
          </Space>
        )
      },
      {
        title: 'Tests',
        key: 'tests',
        width: 190,
        render: (_: unknown, record: CiEvidenceRecord) => typeof record.totalTests === 'number'
          ? `${record.passedTests ?? '-'} passed / ${record.failedTests ?? 0} failed / ${record.totalTests} total`
          : '-'
      },
      {
        title: 'Finished',
        dataIndex: 'finishedAt',
        key: 'finishedAt',
        width: 190,
        render: (value: string) => new Date(value).toLocaleString()
      },
      {
        title: 'Summary',
        dataIndex: 'summary',
        key: 'summary',
        ellipsis: true
      }
    ]}
  />)
}
