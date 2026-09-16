import { ExperimentOutlined } from '@ant-design/icons'
import type { TableProps } from 'antd'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { dependencyImpactSeverityColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyImpactAnalysis' | 'dependencyImpactItems'>

export function DependencyImpactPanel({ dependencyImpactAnalysis, dependencyImpactItems }: Props) {
  return (dependencyImpactAnalysis && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ExperimentOutlined />
          <Text strong>Dependency impact analysis</Text>
          <Tag color={readinessStatusColor(dependencyImpactAnalysis.status)}>
            {readinessStatusLabel(dependencyImpactAnalysis.status)}
          </Tag>
          <Tag>{dependencyImpactAnalysis.summary.itemCount} items</Tag>
          <Tag>{dependencyImpactAnalysis.summary.workspaceCount} workspaces</Tag>
          <Tag>{dependencyImpactAnalysis.summary.ciJobCount} CI jobs</Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyImpactAnalysis.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Critical: {dependencyImpactAnalysis.summary.criticalItemCount}</span>
        <span>High: {dependencyImpactAnalysis.summary.highItemCount}</span>
        <span>Medium: {dependencyImpactAnalysis.summary.mediumItemCount}</span>
        <span>Missing owners: {dependencyImpactAnalysis.summary.missingOwnerItemCount}</span>
        <span>CI impacted: {dependencyImpactAnalysis.summary.ciImpactedItemCount}</span>
        <span>Release gates: {dependencyImpactAnalysis.summary.releaseGateImpactCount}</span>
        <span>Security: {dependencyImpactAnalysis.summary.securityImpactCount}</span>
        <span>Rollback blocked: {dependencyImpactAnalysis.summary.rollbackBlockedItemCount}</span>
        <span>Verify: {dependencyImpactAnalysis.summary.verificationCommandCount}</span>
      </div>
      <DependencyImpactPanelTable dependencyImpactItems={dependencyImpactItems} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

const DependencyImpactPanelTableColumnSeverity: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Severity',
    dataIndex: 'severity',
    key: 'severity',
    width: 110,
    render: (severity: DependencyImpactSeverity) => <Tag color={dependencyImpactSeverityColor(severity)}>{severity}</Tag>
  }

const DependencyImpactPanelTableColumnStatus: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 110,
    render: (status: DependencyImpactAnalysisStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
  }

const DependencyImpactPanelTableColumnScope: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Scope',
    key: 'scope',
    width: 210,
    render: (_: unknown, record: DependencyImpactAnalysisItem) => (
      <Space size={4} wrap>
        <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
        <Tag>{record.workspaceRelativePath || '.'}</Tag>
      </Space>
    )
  }

const DependencyImpactPanelTableColumnDimensions: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Dimensions',
    dataIndex: 'dimensions',
    key: 'dimensions',
    width: 260,
    render: (dimensions: DependencyImpactDimension[]) => (
      <Space size={4} wrap>
        {dimensions.map((dimension) => <Tag key={dimension}>{dimension}</Tag>)}
      </Space>
    )
  }

const DependencyImpactPanelTableColumnOwners: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Owners',
    dataIndex: 'owners',
    key: 'owners',
    width: 180,
    render: (owners: string[]) => owners.length > 0
      ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
      : <Tag color="orange">missing</Tag>
  }

const DependencyImpactPanelTableColumnImpact: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Impact',
    key: 'impact',
    width: 210,
    render: (_: unknown, record: DependencyImpactAnalysisItem) => (
      <Space size={4} wrap>
        <Tag>{record.ciJobs.length} CI</Tag>
        <Tag>{record.releaseGateCount} gates</Tag>
        <Tag>{record.riskFindings.length} risks</Tag>
        <Tag>{record.verificationCommands.length} verify</Tag>
      </Space>
    )
  }

const DependencyImpactPanelTableColumnRollback: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Rollback',
    key: 'rollback',
    width: 160,
    render: (_: unknown, record: DependencyImpactAnalysisItem) => (
      <Space size={4} wrap>
        <Tag color={record.rollbackStatus ? readinessStatusColor(record.rollbackStatus) : 'default'}>
          {record.rollbackStatus || 'missing'}
        </Tag>
        <Tag>{record.rollbackActionCount} actions</Tag>
      </Space>
    )
  }

const DependencyImpactPanelTableColumnRecommendation: NonNullable<TableProps<NonNullable<Props['dependencyImpactItems']>[number]>['columns']>[number] = {
    title: 'Recommendation',
    dataIndex: 'recommendation',
    key: 'recommendation',
    ellipsis: true
  }

function DependencyImpactPanelTable({ dependencyImpactItems }: Pick<PanelValues, 'dependencyImpactItems'>) {
  return (<Table
    dataSource={dependencyImpactItems}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No dependency impact items" /> }}
    columns={[DependencyImpactPanelTableColumnSeverity, DependencyImpactPanelTableColumnStatus, DependencyImpactPanelTableColumnScope, DependencyImpactPanelTableColumnDimensions, DependencyImpactPanelTableColumnOwners, DependencyImpactPanelTableColumnImpact, DependencyImpactPanelTableColumnRollback, DependencyImpactPanelTableColumnRecommendation]}
  />)
}
