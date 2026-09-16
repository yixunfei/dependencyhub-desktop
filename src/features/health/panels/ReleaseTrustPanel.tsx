import { ExportOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'currentPath' | 'releaseTrustPolicy' | 'refreshReleaseTrustPolicy' | 'reporting' |
  'exportReleaseTrustPolicy' | 'releaseTrustPolicyRows'
>

export function ReleaseTrustPanel({ currentPath, releaseTrustPolicy, refreshReleaseTrustPolicy, reporting, exportReleaseTrustPolicy, releaseTrustPolicyRows }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Release trust policy</Text>
          {releaseTrustPolicy ? (
            <>
              <Tag color={readinessStatusColor(releaseTrustPolicy.status)}>
                {readinessStatusLabel(releaseTrustPolicy.status)}
              </Tag>
              <Tag>{releaseTrustPolicy.summary.passedCheckCount}/{releaseTrustPolicy.summary.checkCount} passed</Tag>
              <Tag color={releaseTrustPolicy.summary.blockedCheckCount > 0 ? 'red' : 'green'}>
                {releaseTrustPolicy.summary.blockedCheckCount} blocked
              </Tag>
            </>
          ) : (
            <Tag>Not checked</Tag>
          )}
        </Space>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseTrustPolicy} loading={reporting}>
            Check trust
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseTrustPolicy('markdown')} loading={reporting}>
            Export trust
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseTrustPolicy('json')} loading={reporting}>
            Export trust JSON
          </Button>
        </Space>
      </div>
      {releaseTrustPolicy && (
        <>
          <div className={styles.readinessSummary}>
            <span>Passed: {releaseTrustPolicy.summary.passedCheckCount}</span>
            <span>Warnings: {releaseTrustPolicy.summary.warningCheckCount}</span>
            <span>Blocked: {releaseTrustPolicy.summary.blockedCheckCount}</span>
            <span>Source errors: {releaseTrustPolicy.summary.sourceErrorCount}</span>
            <span>Signed: {releaseTrustPolicy.summary.signed ? 'yes' : 'no'}</span>
            <span>Signature verified: {releaseTrustPolicy.summary.signatureVerified ? 'yes' : 'no'}</span>
            <span>Integrity verified: {releaseTrustPolicy.summary.integrityVerifiedArtifactCount}</span>
            <span>Approvals: {releaseTrustPolicy.summary.approvalRecordCount}</span>
            <span>Active exceptions: {releaseTrustPolicy.summary.activeExceptionCount}</span>
          </div>
          <ReleaseTrustPanelTable releaseTrustPolicyRows={releaseTrustPolicyRows} />
        </>
      )}
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ReleaseTrustPanelTable({ releaseTrustPolicyRows }: Pick<PanelValues, 'releaseTrustPolicyRows'>) {
  return (<Table
    dataSource={releaseTrustPolicyRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 6 }}
    locale={{ emptyText: <Empty description="No release trust checks" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: ReleaseTrustPolicyCheckStatus) => (
          <Tag color={status === 'passed' ? 'green' : status === 'blocked' ? 'red' : status === 'warning' ? 'orange' : 'blue'}>{status}</Tag>
        )
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 160,
        render: (source: ReleaseTrustPolicySource) => <Tag>{source}</Tag>
      },
      {
        title: 'Check',
        key: 'check',
        width: 260,
        render: (_: unknown, record: ReleaseTrustPolicyCheck) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.title}</Text>
            <Text type="secondary">{record.summary}</Text>
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
