import { ExportOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { ciWarningColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'currentPath' | 'releaseEvidenceCompleteness' | 'refreshReleaseEvidenceCompleteness' | 'reporting' |
  'exportReleaseEvidenceCompleteness' | 'releaseEvidenceExpectedRows' | 'releaseEvidenceFindings'
>

export function EvidenceCompletenessPanel({ currentPath, releaseEvidenceCompleteness, refreshReleaseEvidenceCompleteness, reporting, exportReleaseEvidenceCompleteness, releaseEvidenceExpectedRows, releaseEvidenceFindings }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Release evidence completeness</Text>
          {releaseEvidenceCompleteness ? (
            <>
              <Tag color={readinessStatusColor(releaseEvidenceCompleteness.status)}>
                {readinessStatusLabel(releaseEvidenceCompleteness.status)}
              </Tag>
              <Tag>{releaseEvidenceCompleteness.summary.presentArtifactCount}/{releaseEvidenceCompleteness.summary.expectedArtifactCount} present</Tag>
              <Tag color={releaseEvidenceCompleteness.summary.missingRequiredArtifactCount > 0 ? 'red' : 'green'}>
                {releaseEvidenceCompleteness.summary.missingRequiredArtifactCount} required missing
              </Tag>
              <Tag color={releaseEvidenceCompleteness.summary.requiredIntegrityMismatchCount > 0 ? 'red' : 'green'}>
                {releaseEvidenceCompleteness.summary.requiredIntegrityMismatchCount} integrity mismatch
              </Tag>
            </>
          ) : (
            <Tag>Not checked</Tag>
          )}
        </Space>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseEvidenceCompleteness} loading={reporting}>
            Check evidence
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseEvidenceCompleteness('markdown')} loading={reporting}>
            Export evidence check
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseEvidenceCompleteness('json')} loading={reporting}>
            Export evidence JSON
          </Button>
        </Space>
      </div>
      {releaseEvidenceCompleteness && (
        <>
          <div className={styles.readinessSummary}>
            <span>Required: {releaseEvidenceCompleteness.summary.requiredArtifactCount}</span>
            <span>Missing: {releaseEvidenceCompleteness.summary.missingArtifactCount}</span>
            <span>Failed: {releaseEvidenceCompleteness.summary.failedArtifactCount}</span>
            <span>Integrity mismatches: {releaseEvidenceCompleteness.summary.integrityMismatchCount}</span>
            <span>Policy required: {releaseEvidenceCompleteness.summary.policyRequiredArtifactCount}</span>
            <span>Bundle artifacts: {releaseEvidenceCompleteness.summary.releaseBundleArtifactCount}</span>
            <span>Report library: {releaseEvidenceCompleteness.summary.reportArtifactCount}</span>
            <span>Findings: {releaseEvidenceCompleteness.summary.findingCount}</span>
          </div>
          <EvidenceCompletenessPanelTable releaseEvidenceExpectedRows={releaseEvidenceExpectedRows} />
          <EvidenceCompletenessPanelTable2 releaseEvidenceFindings={releaseEvidenceFindings} />
        </>
      )}
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function EvidenceCompletenessPanelTable({ releaseEvidenceExpectedRows }: Pick<PanelValues, 'releaseEvidenceExpectedRows'>) {
  return (<Table
    dataSource={releaseEvidenceExpectedRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No expected release evidence artifacts" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: ReleaseEvidenceExpectedArtifact['status']) => (
          <Tag color={status === 'present' ? 'green' : status === 'failed' || status === 'mismatch' ? 'red' : 'orange'}>{status}</Tag>
        )
      },
      {
        title: 'Integrity',
        dataIndex: 'integrityStatus',
        key: 'integrityStatus',
        width: 120,
        render: (status: ReleaseEvidenceExpectedArtifact['integrityStatus']) => (
          <Tag color={status === 'verified' ? 'green' : status === 'mismatch' ? 'red' : 'default'}>{status}</Tag>
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
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 150,
        render: (source: ReleaseEvidenceCompletenessSource) => <Tag>{source}</Tag>
      },
      {
        title: 'Artifact',
        dataIndex: 'label',
        key: 'label',
        width: 260,
        ellipsis: true
      },
      {
        title: 'Expected path',
        dataIndex: 'expectedPath',
        key: 'expectedPath',
        ellipsis: true,
        render: (path?: string) => path || '-'
      },
      {
        title: 'Matches',
        dataIndex: 'matchedArtifactCount',
        key: 'matchedArtifactCount',
        width: 90
      }
    ]}
  />)
}

function EvidenceCompletenessPanelTable2({ releaseEvidenceFindings }: Pick<PanelValues, 'releaseEvidenceFindings'>) {
  return (<Table
    dataSource={releaseEvidenceFindings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No release evidence completeness findings" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: ReleaseEvidenceCompletenessSeverity) => <Tag color={ciWarningColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 150,
        render: (source: ReleaseEvidenceCompletenessSource) => <Tag>{source}</Tag>
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
