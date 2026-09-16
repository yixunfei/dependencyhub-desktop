import { Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'policyEvaluation'>

export function DependencyPolicyPanel({ policyEvaluation }: Props) {
  return (policyEvaluation && (
    <div className={styles.policyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <Text strong>依赖策略检查</Text>
          <Tag color={policyEvaluation.violationCount > 0 ? 'orange' : 'green'}>
            {policyEvaluation.violationCount} 个违规项
          </Tag>
          <Tag>{policyEvaluation.componentCount} 个组件</Tag>
        </Space>
        <Text type="secondary">{policyEvaluation.policyPath}</Text>
      </div>
      <DependencyPolicyPanelTable policyEvaluation={policyEvaluation} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function DependencyPolicyPanelTable({ policyEvaluation }: Pick<PanelValues, 'policyEvaluation'>) {
  return (<Table
    dataSource={policyEvaluation.violations}
    rowKey={(record, index) => `${record.title}:${record.packageName || ''}:${index}`}
    size="small"
    pagination={{ pageSize: 6 }}
    locale={{ emptyText: <Empty description="策略检查通过" /> }}
    columns={[
      {
        title: '级别',
        dataIndex: 'severity',
        key: 'severity',
        width: 90,
        render: (severity: DependencyPolicyViolation['severity']) => (
          <Tag color={severity === 'critical' || severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'blue'}>
            {severity}
          </Tag>
        )
      },
      {
        title: '依赖',
        key: 'dependency',
        width: 240,
        render: (_: unknown, record: DependencyPolicyViolation) => (
          <Space size={4} wrap>
            {record.managerId && <Tag>{record.managerId}</Tag>}
            <span>{record.packageName || '-'}</span>
            {record.version && <Tag>{record.version}</Tag>}
          </Space>
        )
      },
      {
        title: '问题',
        dataIndex: 'title',
        key: 'title',
        width: 220
      },
      {
        title: '说明',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true
      },
      {
        title: '建议',
        dataIndex: 'recommendation',
        key: 'recommendation',
        ellipsis: true
      }
    ]}
  />)
}
