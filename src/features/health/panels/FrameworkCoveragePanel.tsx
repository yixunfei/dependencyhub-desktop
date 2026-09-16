import { ExportOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { TableProps } from 'antd'
import { Button, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'frameworkCoverage' | 'refreshFrameworkCoverage' | 'reporting' | 'exportFrameworkCoverage' |
  'currentPath' | 'frameworkCoverageRows'
>

export function FrameworkCoveragePanel({ frameworkCoverage, refreshFrameworkCoverage, reporting, exportFrameworkCoverage, currentPath, frameworkCoverageRows }: Props) {
  return (frameworkCoverage && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Framework coverage</Text>
          <Tag>{frameworkCoverage.summary.managerCount} managers</Tag>
          <Tag color="blue">{frameworkCoverage.summary.routeGroupCount} workspaces</Tag>
          <Tag color={frameworkCoverage.summary.warningGapCount > 0 ? 'orange' : 'green'}>
            {frameworkCoverage.summary.warningGapCount} warning gaps
          </Tag>
        </Space>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} onClick={refreshFrameworkCoverage} loading={reporting}>
            Refresh coverage
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportFrameworkCoverage('markdown')} loading={reporting} disabled={!currentPath}>
            Export coverage
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportFrameworkCoverage('json')} loading={reporting} disabled={!currentPath}>
            Export JSON
          </Button>
        </Space>
      </div>
      <div className={styles.readinessSummary}>
        <span>Implemented: {frameworkCoverage.summary.implementedCount}/{frameworkCoverage.summary.managerCount}</span>
        <span>Stable: {frameworkCoverage.summary.stableCount}</span>
        <span>Preview: {frameworkCoverage.summary.previewCount}</span>
        <span>Planned: {frameworkCoverage.summary.plannedCount}</span>
        <span>Languages: {frameworkCoverage.summary.languageCount}</span>
        <span>Health coverage: {frameworkCoverage.summary.healthCoveragePercent}%</span>
        <span>Audit workflows: {frameworkCoverage.summary.auditWorkflowCount}</span>
        <span>Publish workflows: {frameworkCoverage.summary.publishWorkflowCount}</span>
      </div>
      <FrameworkCoveragePanelTable frameworkCoverageRows={frameworkCoverageRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

const FrameworkCoveragePanelTableColumnManager: NonNullable<TableProps<NonNullable<Props['frameworkCoverageRows']>[number]>['columns']>[number] = {
    title: 'Manager',
    key: 'manager',
    width: 220,
    render: (_: unknown, record: FrameworkCoverageManagerRecord) => (
      <Space orientation="vertical" size={2}>
        <Space size={4} wrap>
          <Tag color={managerColor(record.id)}>{record.id}</Tag>
          <Text strong>{record.name}</Text>
        </Space>
        <Text type="secondary">{record.language}</Text>
      </Space>
    )
  }

const FrameworkCoveragePanelTableColumnRouteLabel: NonNullable<TableProps<NonNullable<Props['frameworkCoverageRows']>[number]>['columns']>[number] = {
    title: 'Workspace',
    dataIndex: 'routeLabel',
    key: 'routeLabel',
    width: 150,
    render: (label: string, record: FrameworkCoverageManagerRecord) => (
      <Tooltip title={record.route}>
        <Tag>{label}</Tag>
      </Tooltip>
    )
  }

const FrameworkCoveragePanelTableColumnStatus: NonNullable<TableProps<NonNullable<Props['frameworkCoverageRows']>[number]>['columns']>[number] = {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 110,
    render: (status: ManagerImplementationStatus, record: FrameworkCoverageManagerRecord) => (
      <Space size={4} wrap>
        <Tag color={status === 'stable' ? 'green' : status === 'preview' ? 'blue' : 'default'}>{status}</Tag>
        {!record.implemented && <Tag>extended</Tag>}
      </Space>
    )
  }

const FrameworkCoveragePanelTableColumnScopes: NonNullable<TableProps<NonNullable<Props['frameworkCoverageRows']>[number]>['columns']>[number] = {
    title: 'Scopes',
    dataIndex: 'scopes',
    key: 'scopes',
    width: 190,
    render: (scopes: ManagerScope[]) => (
      <Space size={4} wrap>
        {scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)}
      </Space>
    )
  }

const FrameworkCoveragePanelTableColumnCapabilities: NonNullable<TableProps<NonNullable<Props['frameworkCoverageRows']>[number]>['columns']>[number] = {
    title: 'Capabilities',
    dataIndex: 'capabilities',
    key: 'capabilities',
    ellipsis: true,
    render: (capabilities: ManagerCapability[]) => capabilities.join(', ')
  }

const FrameworkCoveragePanelTableColumnFiles: NonNullable<TableProps<NonNullable<Props['frameworkCoverageRows']>[number]>['columns']>[number] = {
    title: 'Files',
    key: 'files',
    ellipsis: true,
    render: (_: unknown, record: FrameworkCoverageManagerRecord) => (
      <Tooltip title={`Manifests: ${record.manifestFiles.join(', ') || '-'} / Locks: ${record.lockFiles.join(', ') || '-'}`}>
        <span>{[...record.manifestFiles, ...record.lockFiles].slice(0, 4).join(', ') || '-'}</span>
      </Tooltip>
    )
  }

function FrameworkCoveragePanelTable({ frameworkCoverageRows }: Pick<PanelValues, 'frameworkCoverageRows'>) {
  return (<Table
    dataSource={frameworkCoverageRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    columns={[FrameworkCoveragePanelTableColumnManager, FrameworkCoveragePanelTableColumnRouteLabel, FrameworkCoveragePanelTableColumnStatus, FrameworkCoveragePanelTableColumnScopes, FrameworkCoveragePanelTableColumnCapabilities, FrameworkCoveragePanelTableColumnFiles]}
  />)
}
