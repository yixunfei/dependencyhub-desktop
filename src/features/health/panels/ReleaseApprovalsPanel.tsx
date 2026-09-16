import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { releaseApprovalColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'latestReleaseApproval' | 'releaseApprovals' | 'recentReleaseApprovals'>

export function ReleaseApprovalsPanel({ currentPath, latestReleaseApproval, releaseApprovals, recentReleaseApprovals }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Release approvals</Text>
          {latestReleaseApproval && (
            <Tag color={releaseApprovalColor(latestReleaseApproval.decision)}>
              {latestReleaseApproval.decision}
            </Tag>
          )}
          <Tag>{releaseApprovals.length} records</Tag>
        </Space>
        <Text type="secondary">
          {latestReleaseApproval ? new Date(latestReleaseApproval.decidedAt).toLocaleString() : 'No release approval recorded'}
        </Text>
      </div>
      <ReleaseApprovalsPanelTable recentReleaseApprovals={recentReleaseApprovals} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ReleaseApprovalsPanelTable({ recentReleaseApprovals }: Pick<PanelValues, 'recentReleaseApprovals'>) {
  return (<Table
    dataSource={recentReleaseApprovals}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No release approval evidence recorded" /> }}
    columns={[
      {
        title: 'Decision',
        dataIndex: 'decision',
        key: 'decision',
        width: 120,
        render: (decision: ReleaseApprovalDecision) => <Tag color={releaseApprovalColor(decision)}>{decision}</Tag>
      },
      {
        title: 'Reviewer',
        dataIndex: 'reviewer',
        key: 'reviewer',
        width: 180
      },
      {
        title: 'Scope',
        dataIndex: 'scope',
        key: 'scope',
        width: 160,
        render: (scope: ReleaseApprovalScope) => <Tag>{scope}</Tag>
      },
      {
        title: 'Decided',
        dataIndex: 'decidedAt',
        key: 'decidedAt',
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
