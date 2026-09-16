import { WarningOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { auditEvidenceSeverityColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'auditEvidence' | 'auditEvidenceFindings'>

export function AuditEvidencePanel({ currentPath, auditEvidence, auditEvidenceFindings }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <WarningOutlined />
          <Text strong>Audit evidence</Text>
          {auditEvidence && (
            <Tag color={auditEvidence.summary.critical + auditEvidence.summary.high > 0 ? 'red' : auditEvidence.summary.medium > 0 ? 'orange' : 'green'}>
              {auditEvidence.summary.critical + auditEvidence.summary.high} high+
            </Tag>
          )}
          <Tag>{auditEvidence?.summary.findingCount || 0} findings</Tag>
          <Tag>{auditEvidence?.summary.sourceCount || 0} sources</Tag>
        </Space>
        <Text type="secondary">
          {auditEvidence ? new Date(auditEvidence.generatedAt).toLocaleString() : 'No audit evidence imported'}
        </Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Tools: {auditEvidence?.summary.tools.join(', ') || '-'}</span>
        <span>Managers: {auditEvidence?.summary.managers.join(', ') || '-'}</span>
        <span>Affected packages: {auditEvidence?.summary.affectedPackageCount || 0}</span>
        <span>Fixes available: {auditEvidence?.summary.fixAvailableCount || 0}</span>
      </div>
      <AuditEvidencePanelTable auditEvidenceFindings={auditEvidenceFindings} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function AuditEvidencePanelTable({ auditEvidenceFindings }: Pick<PanelValues, 'auditEvidenceFindings'>) {
  return (<Table
    dataSource={auditEvidenceFindings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No audit evidence imported" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 110,
        render: (severity: AuditEvidenceSeverity) => <Tag color={auditEvidenceSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Tool',
        dataIndex: 'tool',
        key: 'tool',
        width: 130,
        render: (tool: AuditEvidenceTool) => <Tag>{tool}</Tag>
      },
      {
        title: 'Package',
        dataIndex: 'packageName',
        key: 'packageName',
        width: 180,
        render: (value: string | undefined, record: AuditEvidenceFinding) => (
          <Space size={4} wrap>
            {record.managerId && <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>}
            <span>{value || '-'}</span>
          </Space>
        )
      },
      {
        title: 'Vulnerability',
        dataIndex: 'vulnerabilityId',
        key: 'vulnerabilityId',
        width: 170,
        render: (value: string | undefined, record: AuditEvidenceFinding) => value || record.aliases[0] || '-'
      },
      {
        title: 'Fix',
        dataIndex: 'fixedVersion',
        key: 'fixedVersion',
        width: 150,
        render: (value: string | undefined) => value || '-'
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
