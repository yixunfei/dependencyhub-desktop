import { Empty, Space, Table, Tag, Typography } from 'antd'
import { useT } from '../../../i18n'
import styles from '../HealthCenter.module.css'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'policyEvaluation'>

export function DependencyPolicyPanel({ policyEvaluation }: Props) {
  const t = useT()
  return (policyEvaluation && (
    <div className={styles.policyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <Text strong>{t('health.policyCheck')}</Text>
          <Tag color={policyEvaluation.violationCount > 0 ? 'orange' : 'green'}>
            {t('health.violationCount', { count: policyEvaluation.violationCount })}
          </Tag>
          <Tag>{t('health.componentCount', { count: policyEvaluation.componentCount })}</Tag>
        </Space>
        <Text type="secondary">{policyEvaluation.policyPath}</Text>
      </div>
      <DependencyPolicyPanelTable policyEvaluation={policyEvaluation} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function DependencyPolicyPanelTable({ policyEvaluation }: Pick<PanelValues, 'policyEvaluation'>) {
  const t = useT()
  return (<Table
    dataSource={policyEvaluation.violations}
    rowKey={(record, index) => `${record.title}:${record.packageName || ''}:${index}`}
    size="small"
    pagination={{ pageSize: 6 }}
    locale={{ emptyText: <Empty description={t('health.policyPassed')} /> }}
    columns={[
      {
        title: t('health.columnSeverity'),
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
        title: t('health.columnDependency'),
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
        title: t('health.columnIssue'),
        dataIndex: 'title',
        key: 'title',
        width: 220
      },
      {
        title: t('health.columnExplanation'),
        dataIndex: 'description',
        key: 'description',
        ellipsis: true
      },
      {
        title: t('health.columnSuggestion'),
        dataIndex: 'recommendation',
        key: 'recommendation',
        ellipsis: true
      }
    ]}
  />)
}
