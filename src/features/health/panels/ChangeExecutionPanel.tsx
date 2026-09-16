import { HistoryOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import {
  changeWindowStatusColor, ciEvidenceStatusColor, executionRecordStatusColor,
  executionVerificationStatusColor, readinessStatusColor, readinessStatusLabel
} from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyChangeExecutionRecord' | 'dependencyExecutionRecords'>

export function ChangeExecutionPanel({ dependencyChangeExecutionRecord, dependencyExecutionRecords }: Props) {
  return (dependencyChangeExecutionRecord && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <HistoryOutlined />
          <Text strong>Dependency change execution record</Text>
          <Tag color={readinessStatusColor(dependencyChangeExecutionRecord.status)}>
            {readinessStatusLabel(dependencyChangeExecutionRecord.status)}
          </Tag>
          <Tag>{dependencyChangeExecutionRecord.summary.recordCount} records</Tag>
          <Tag>{dependencyChangeExecutionRecord.summary.operationCount} operations</Tag>
          <Tag>{dependencyChangeExecutionRecord.summary.ciEvidenceCount} CI evidence</Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyChangeExecutionRecord.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Completed: {dependencyChangeExecutionRecord.summary.completedRecordCount}</span>
        <span>Pending: {dependencyChangeExecutionRecord.summary.pendingRecordCount}</span>
        <span>Failed: {dependencyChangeExecutionRecord.summary.failedRecordCount}</span>
        <span>Blocked: {dependencyChangeExecutionRecord.summary.blockedRecordCount}</span>
        <span>Unscheduled: {dependencyChangeExecutionRecord.summary.unscheduledRecordCount}</span>
        <span>Missing ops: {dependencyChangeExecutionRecord.summary.missingOperationEvidenceCount}</span>
        <span>Missing CI: {dependencyChangeExecutionRecord.summary.missingCiEvidenceCount}</span>
        <span>Verify failed: {dependencyChangeExecutionRecord.summary.verificationFailedCount}</span>
      </div>
      <ChangeExecutionPanelTable dependencyExecutionRecords={dependencyExecutionRecords} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ChangeExecutionPanelTable({ dependencyExecutionRecords }: Pick<PanelValues, 'dependencyExecutionRecords'>) {
  return (<Table
    dataSource={dependencyExecutionRecords}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No dependency change execution records" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 125,
        render: (status: DependencyChangeExecutionRecordStatus) => <Tag color={executionRecordStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Verify',
        dataIndex: 'verificationStatus',
        key: 'verificationStatus',
        width: 115,
        render: (status: DependencyChangeExecutionVerificationStatus) => <Tag color={executionVerificationStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Scope',
        key: 'scope',
        width: 210,
        render: (_: unknown, record: DependencyChangeExecutionRecordItem) => (
          <Space size={4} wrap>
            <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
            <Tag>{record.workspaceRelativePath || '.'}</Tag>
          </Space>
        )
      },
      {
        title: 'Window',
        key: 'window',
        width: 220,
        render: (_: unknown, record: DependencyChangeExecutionRecordItem) => (
          <Space size={4} wrap>
            <Tag>{record.windowKind}</Tag>
            <Tag color={changeWindowStatusColor(record.windowStatus)}>{record.windowStatus}</Tag>
          </Space>
        )
      },
      {
        title: 'Evidence',
        key: 'evidence',
        width: 230,
        render: (_: unknown, record: DependencyChangeExecutionRecordItem) => (
          <Space size={4} wrap>
            <Tag>{record.operationCount} ops</Tag>
            <Tag color={record.failedOperationCount > 0 ? 'red' : 'default'}>{record.failedOperationCount} failed</Tag>
            <Tag>{record.ciEvidenceCount} CI</Tag>
            {record.latestCiStatus && <Tag color={ciEvidenceStatusColor(record.latestCiStatus)}>{record.latestCiStatus}</Tag>}
          </Space>
        )
      },
      {
        title: 'Gaps',
        dataIndex: 'gaps',
        key: 'gaps',
        width: 280,
        ellipsis: true,
        render: (gaps: string[]) => gaps.join('; ') || '-'
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
