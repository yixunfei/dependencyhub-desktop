import { ExportOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { ciWarningColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'currentPath' | 'releaseIntegrityVerification' | 'refreshReleaseIntegrityVerification' | 'reporting' |
  'exportReleaseIntegrityVerification' | 'releaseIntegrityArtifactRows' | 'releaseIntegrityFindings'
>

export function IntegrityPanel({ currentPath, releaseIntegrityVerification, refreshReleaseIntegrityVerification, reporting, exportReleaseIntegrityVerification, releaseIntegrityArtifactRows, releaseIntegrityFindings }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Release integrity verification</Text>
          {releaseIntegrityVerification ? (
            <>
              <Tag color={readinessStatusColor(releaseIntegrityVerification.status)}>
                {readinessStatusLabel(releaseIntegrityVerification.status)}
              </Tag>
              <Tag>{releaseIntegrityVerification.summary.verifiedArtifactCount}/{releaseIntegrityVerification.summary.artifactCount} verified</Tag>
              <Tag color={releaseIntegrityVerification.summary.requiredMismatchArtifactCount > 0 ? 'red' : 'green'}>
                {releaseIntegrityVerification.summary.requiredMismatchArtifactCount} required mismatch
              </Tag>
            </>
          ) : (
            <Tag>Not checked</Tag>
          )}
        </Space>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseIntegrityVerification} loading={reporting}>
            Verify integrity
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseIntegrityVerification('markdown')} loading={reporting}>
            Export verification
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseIntegrityVerification('json')} loading={reporting}>
            Export verification JSON
          </Button>
        </Space>
      </div>
      {releaseIntegrityVerification && (
        <>
          <div className={styles.readinessSummary}>
            <span>Required: {releaseIntegrityVerification.summary.requiredArtifactCount}</span>
            <span>Missing: {releaseIntegrityVerification.summary.missingArtifactCount}</span>
            <span>Mismatched: {releaseIntegrityVerification.summary.mismatchArtifactCount}</span>
            <span>Failed recorded: {releaseIntegrityVerification.summary.failedRecordedArtifactCount}</span>
            <span>Unverifiable: {releaseIntegrityVerification.summary.unverifiableArtifactCount}</span>
            <span>Provenance matched: {releaseIntegrityVerification.summary.provenanceMatchedArtifactCount}</span>
            <span>Provenance mismatch: {releaseIntegrityVerification.summary.provenanceMismatchArtifactCount}</span>
            <span>Findings: {releaseIntegrityVerification.summary.findingCount}</span>
          </div>
          <IntegrityPanelTable releaseIntegrityArtifactRows={releaseIntegrityArtifactRows} />
          <IntegrityPanelTable2 releaseIntegrityFindings={releaseIntegrityFindings} />
        </>
      )}
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function IntegrityPanelTable({ releaseIntegrityArtifactRows }: Pick<PanelValues, 'releaseIntegrityArtifactRows'>) {
  return (<Table
    dataSource={releaseIntegrityArtifactRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 7 }}
    locale={{ emptyText: <Empty description="No release integrity artifacts" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 130,
        render: (status: ReleaseIntegrityArtifactStatus) => (
          <Tag color={status === 'verified' ? 'green' : status === 'mismatch' || status === 'missing' || status === 'failed-recorded' ? 'red' : 'orange'}>{status}</Tag>
        )
      },
      {
        title: 'Provenance',
        dataIndex: 'provenanceStatus',
        key: 'provenanceStatus',
        width: 130,
        render: (status: ReleaseIntegrityProvenanceStatus) => (
          <Tag color={status === 'matched' ? 'green' : status === 'mismatch' ? 'orange' : 'default'}>{status}</Tag>
        )
      },
      {
        title: 'Required',
        dataIndex: 'required',
        key: 'required',
        width: 100,
        render: (required: boolean) => <Tag color={required ? 'red' : 'default'}>{required ? 'required' : 'optional'}</Tag>
      },
      {
        title: 'Artifact',
        key: 'artifact',
        width: 260,
        render: (_: unknown, record: ReleaseIntegrityVerifiedArtifact) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.label}</Text>
            <Text type="secondary">{record.relativePath || record.path || '-'}</Text>
          </Space>
        )
      },
      {
        title: 'Kind',
        dataIndex: 'kind',
        key: 'kind',
        width: 170,
        render: (kind: ReleaseBundleArtifactKind) => <Tag>{kind}</Tag>
      },
      {
        title: 'Expected',
        dataIndex: 'expectedSha256',
        key: 'expectedSha256',
        width: 140,
        render: (hash?: string) => hash ? <Text code>{hash.slice(0, 16)}</Text> : '-'
      },
      {
        title: 'Actual',
        dataIndex: 'actualSha256',
        key: 'actualSha256',
        width: 140,
        render: (hash?: string) => hash ? <Text code>{hash.slice(0, 16)}</Text> : '-'
      },
      {
        title: 'Issues',
        dataIndex: 'issues',
        key: 'issues',
        ellipsis: true,
        render: (issues: string[]) => issues.join('; ') || '-'
      }
    ]}
  />)
}

function IntegrityPanelTable2({ releaseIntegrityFindings }: Pick<PanelValues, 'releaseIntegrityFindings'>) {
  return (<Table
    dataSource={releaseIntegrityFindings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No release integrity findings" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: ReleaseIntegrityVerificationSeverity) => <Tag color={ciWarningColor(severity)}>{severity}</Tag>
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
