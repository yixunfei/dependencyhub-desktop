import { ExportOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { ciWarningColor, formatArtifactBytes, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'currentPath' | 'releaseSignature' | 'refreshReleaseSignature' | 'reporting' | 'exportReleaseSignature' |
  'releaseSignatureSourceRows' | 'releaseSignatureFindings'
>

export function ReleaseSignaturePanel({ currentPath, releaseSignature, refreshReleaseSignature, reporting, exportReleaseSignature, releaseSignatureSourceRows, releaseSignatureFindings }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Release signature</Text>
          {releaseSignature ? (
            <>
              <Tag color={readinessStatusColor(releaseSignature.status)}>
                {readinessStatusLabel(releaseSignature.status)}
              </Tag>
              <Tag color={releaseSignature.summary.signed ? 'green' : 'orange'}>
                {releaseSignature.summary.signed ? 'signed' : 'unsigned'}
              </Tag>
              <Tag>{releaseSignature.summary.verificationStatus}</Tag>
            </>
          ) : (
            <Tag>Not checked</Tag>
          )}
        </Space>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseSignature} loading={reporting}>
            Verify signature
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseSignature('markdown')} loading={reporting}>
            Export signature
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseSignature('json')} loading={reporting}>
            Export signature JSON
          </Button>
        </Space>
      </div>
      {releaseSignature && (
        <>
          <div className={styles.readinessSummary}>
            <span>Sources: {releaseSignature.summary.includedSourceCount}/{releaseSignature.summary.sourceCount}</span>
            <span>Missing: {releaseSignature.summary.missingSourceCount}</span>
            <span>Source errors: {releaseSignature.summary.sourceErrorCount}</span>
            <span>Blocked sources: {releaseSignature.summary.blockedSourceReportCount}</span>
            <span>Warning sources: {releaseSignature.summary.warningSourceReportCount}</span>
            <span>Algorithm: {releaseSignature.signature.algorithm}</span>
            <span>Key ID: {releaseSignature.signature.keyId || '-'}</span>
            <span>Payload: {releaseSignature.payload.sha256.slice(0, 16)}</span>
            <span>Findings: {releaseSignature.summary.findingCount}</span>
          </div>
          <ReleaseSignaturePanelTable releaseSignatureSourceRows={releaseSignatureSourceRows} />
          <ReleaseSignaturePanelTable2 releaseSignatureFindings={releaseSignatureFindings} />
        </>
      )}
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ReleaseSignaturePanelTable({ releaseSignatureSourceRows }: Pick<PanelValues, 'releaseSignatureSourceRows'>) {
  return (<Table
    dataSource={releaseSignatureSourceRows}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No release signature sources" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: ReleaseSignatureSourceStatus) => (
          <Tag color={status === 'included' ? 'green' : status === 'missing' ? 'red' : 'orange'}>{status}</Tag>
        )
      },
      {
        title: 'Source',
        key: 'source',
        width: 280,
        render: (_: unknown, record: ReleaseSignatureSource) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.label}</Text>
            <Text type="secondary">{record.relativePath}</Text>
          </Space>
        )
      },
      {
        title: 'Report',
        dataIndex: 'reportStatus',
        key: 'reportStatus',
        width: 120,
        render: (status?: string) => status ? <Tag color={readinessStatusColor(status as ReleaseSignatureStatus)}>{status}</Tag> : '-'
      },
      {
        title: 'Size',
        dataIndex: 'sizeBytes',
        key: 'sizeBytes',
        width: 100,
        render: (size?: number) => typeof size === 'number' ? formatArtifactBytes(size) : '-'
      },
      {
        title: 'SHA-256',
        dataIndex: 'sha256',
        key: 'sha256',
        width: 150,
        render: (hash?: string) => hash ? <Text code>{hash.slice(0, 16)}</Text> : '-'
      },
      {
        title: 'Error',
        dataIndex: 'error',
        key: 'error',
        ellipsis: true,
        render: (error?: string) => error || '-'
      }
    ]}
  />)
}

function ReleaseSignaturePanelTable2({ releaseSignatureFindings }: Pick<PanelValues, 'releaseSignatureFindings'>) {
  return (<Table
    dataSource={releaseSignatureFindings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No release signature findings" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: ReleaseSignatureSeverity) => <Tag color={ciWarningColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Finding',
        dataIndex: 'summary',
        key: 'summary',
        ellipsis: true
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
