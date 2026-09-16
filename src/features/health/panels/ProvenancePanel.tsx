import { ExportOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { formatArtifactBytes, readinessStatusColor, readinessStatusLabel, reportArtifactCategoryColor, reportArtifactFormatColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'currentPath' | 'releaseProvenanceAttestation' | 'refreshReleaseProvenanceAttestation' | 'reporting' |
  'exportReleaseProvenanceAttestation' | 'releaseProvenanceArtifactRows'
>

export function ProvenancePanel({ currentPath, releaseProvenanceAttestation, refreshReleaseProvenanceAttestation, reporting, exportReleaseProvenanceAttestation, releaseProvenanceArtifactRows }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Release provenance attestation</Text>
          {releaseProvenanceAttestation ? (
            <>
              <Tag color={readinessStatusColor(releaseProvenanceAttestation.status)}>
                {readinessStatusLabel(releaseProvenanceAttestation.status)}
              </Tag>
              <Tag>{releaseProvenanceAttestation.summary.artifactCount} digests</Tag>
              <Tag color={releaseProvenanceAttestation.summary.gitDirty ? 'orange' : 'green'}>
                {releaseProvenanceAttestation.summary.gitDirty ? 'dirty Git' : 'clean Git'}
              </Tag>
            </>
          ) : (
            <Tag>Not checked</Tag>
          )}
        </Space>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseProvenanceAttestation} loading={reporting}>
            Check provenance
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseProvenanceAttestation('markdown')} loading={reporting}>
            Export provenance
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseProvenanceAttestation('json')} loading={reporting}>
            Export provenance JSON
          </Button>
        </Space>
      </div>
      {releaseProvenanceAttestation && (
        <>
          <div className={styles.readinessSummary}>
            <span>Project: {releaseProvenanceAttestation.project.name}</span>
            <span>Version: {releaseProvenanceAttestation.project.version || '-'}</span>
            <span>Branch: {releaseProvenanceAttestation.git.branch || '-'}</span>
            <span>Commit: {releaseProvenanceAttestation.git.shortCommit || '-'}</span>
            <span>Changed files: {releaseProvenanceAttestation.git.changedFileCount ?? '-'}</span>
            <span>Bundle artifacts: {releaseProvenanceAttestation.summary.releaseBundleArtifactCount}</span>
            <span>Required bundle: {releaseProvenanceAttestation.summary.requiredBundleArtifactCount}</span>
            <span>Missing required: {releaseProvenanceAttestation.summary.missingRequiredEvidenceCount}</span>
            <span>Integrity mismatches: {releaseProvenanceAttestation.summary.integrityMismatchCount}</span>
            <span>Source errors: {releaseProvenanceAttestation.summary.sourceErrorCount}</span>
          </div>
          <ProvenancePanelTable releaseProvenanceArtifactRows={releaseProvenanceArtifactRows} />
        </>
      )}
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ProvenancePanelTable({ releaseProvenanceArtifactRows }: Pick<PanelValues, 'releaseProvenanceArtifactRows'>) {
  return (<Table
    dataSource={releaseProvenanceArtifactRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 6 }}
    locale={{ emptyText: <Empty description="No provenance artifact digests" /> }}
    columns={[
      {
        title: 'Artifact',
        key: 'artifact',
        width: 260,
        render: (_: unknown, record: ReleaseProvenanceEvidenceDigest) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.label}</Text>
            <Text type="secondary">{record.relativePath}</Text>
          </Space>
        )
      },
      {
        title: 'Category',
        dataIndex: 'category',
        key: 'category',
        width: 130,
        render: (category: ReportArtifactCategory) => <Tag color={reportArtifactCategoryColor(category)}>{category}</Tag>
      },
      {
        title: 'Format',
        dataIndex: 'format',
        key: 'format',
        width: 100,
        render: (format: ReportArtifactFormat) => <Tag color={reportArtifactFormatColor(format)}>{format}</Tag>
      },
      {
        title: 'Size',
        dataIndex: 'sizeBytes',
        key: 'sizeBytes',
        width: 100,
        render: (size: number) => formatArtifactBytes(size)
      },
      {
        title: 'SHA-256',
        dataIndex: 'sha256',
        key: 'sha256',
        width: 150,
        render: (hash: string) => <Text code>{hash.slice(0, 16)}</Text>
      },
      {
        title: 'Modified',
        dataIndex: 'modifiedAt',
        key: 'modifiedAt',
        width: 170,
        render: (value: string) => new Date(value).toLocaleString()
      }
    ]}
  />)
}
