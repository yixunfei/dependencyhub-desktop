import { ExportOutlined, FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import {
  formatArtifactBytes, REPORT_ARTIFACT_CATEGORY_OPTIONS, REPORT_ARTIFACT_FORMAT_OPTIONS,
  reportArtifactCategoryColor, reportArtifactFormatColor
} from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'currentPath' | 'reportArtifactIndex' | 'refreshReportArtifactIndex' | 'reporting' |
  'openReportArtifactDirectory' | 'exportReportArtifactIndex' | 'reportArtifactRows' |
  'artifactCategoryFilter' | 'setArtifactCategoryFilter' | 'artifactFormatFilter' |
  'setArtifactFormatFilter' | 'artifactSearchTerm' | 'setArtifactSearchTerm'
>

export function ReportLibraryPanel({ currentPath, reportArtifactIndex, refreshReportArtifactIndex, reporting, openReportArtifactDirectory, exportReportArtifactIndex, reportArtifactRows, artifactCategoryFilter, setArtifactCategoryFilter, artifactFormatFilter, setArtifactFormatFilter, artifactSearchTerm, setArtifactSearchTerm }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <FolderOpenOutlined />
          <Text strong>Report library</Text>
          <Tag>{reportArtifactIndex?.summary.artifactCount || 0} artifacts</Tag>
          {reportArtifactIndex && (
            <>
              <Tag color="blue">{formatArtifactBytes(reportArtifactIndex.summary.totalSizeBytes)}</Tag>
              <Tag>{reportArtifactIndex.summary.latestModifiedAt ? new Date(reportArtifactIndex.summary.latestModifiedAt).toLocaleString() : 'No reports'}</Tag>
            </>
          )}
        </Space>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} onClick={refreshReportArtifactIndex} loading={reporting}>
            Refresh reports
          </Button>
          <Button size="small" icon={<FolderOpenOutlined />} onClick={openReportArtifactDirectory}>
            Open reports folder
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReportArtifactIndex('markdown')} loading={reporting}>
            Export index
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportReportArtifactIndex('json')} loading={reporting}>
            Export JSON
          </Button>
        </Space>
      </div>
      {reportArtifactIndex && (
        <div className={styles.readinessSummary}>
          <span>Inventory: {reportArtifactIndex.summary.categoryCounts.inventory}</span>
          <span>Workspace: {reportArtifactIndex.summary.categoryCounts.workspace}</span>
          <span>Release: {reportArtifactIndex.summary.categoryCounts.release}</span>
          <span>Risk: {reportArtifactIndex.summary.categoryCounts.risk}</span>
          <span>Evidence: {reportArtifactIndex.summary.categoryCounts.evidence}</span>
          <span>Automation: {reportArtifactIndex.summary.categoryCounts.automation}</span>
          <span>Policy: {reportArtifactIndex.summary.categoryCounts.policy}</span>
          <span>Security: {reportArtifactIndex.summary.categoryCounts.security}</span>
          <span>Reproducibility: {reportArtifactIndex.summary.categoryCounts.reproducibility}</span>
        </div>
      )}
      <div className={styles.historyControls}>
        <Text type="secondary">
          {reportArtifactRows.length}/{reportArtifactIndex?.summary.artifactCount || 0} artifact(s)
        </Text>
        <Select
          size="small"
          value={artifactCategoryFilter}
          onChange={(value: 'all' | ReportArtifactCategory) => setArtifactCategoryFilter(value)}
          options={REPORT_ARTIFACT_CATEGORY_OPTIONS}
          style={{ width: 170 }}
        />
        <Select
          size="small"
          value={artifactFormatFilter}
          onChange={(value: 'all' | ReportArtifactFormat) => setArtifactFormatFilter(value)}
          options={REPORT_ARTIFACT_FORMAT_OPTIONS}
          style={{ width: 140 }}
        />
        <Input.Search
          allowClear
          size="small"
          placeholder="Search reports, paths, hashes"
          value={artifactSearchTerm}
          onChange={(event) => setArtifactSearchTerm(event.target.value)}
          style={{ width: 260 }}
        />
      </div>
      <ReportLibraryPanelTable reportArtifactRows={reportArtifactRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ReportLibraryPanelTable({ reportArtifactRows }: Pick<PanelValues, 'reportArtifactRows'>) {
  return (<Table
    dataSource={reportArtifactRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 6 }}
    locale={{ emptyText: <Empty description="No generated report artifacts found" /> }}
    columns={[
      {
        title: 'Artifact',
        key: 'artifact',
        width: 260,
        render: (_: unknown, record: ReportArtifactRecord) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.name}</Text>
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
      },
      {
        title: 'Action',
        key: 'action',
        width: 100,
        render: (_: unknown, record: ReportArtifactRecord) => (
          <Button size="small" icon={<FolderOpenOutlined />} onClick={() => void window.electronAPI.system.openFile(record.path)}>
            Open
          </Button>
        )
      }
    ]}
  />)
}
