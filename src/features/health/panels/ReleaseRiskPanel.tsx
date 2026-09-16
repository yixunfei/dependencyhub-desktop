import { WarningOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { readinessStatusLabel, releaseRiskSeverityColor, releaseRiskStatusColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'releaseRiskProfile' | 'releaseRiskRows'>

export function ReleaseRiskPanel({ releaseRiskProfile, releaseRiskRows }: Props) {
  return (releaseRiskProfile && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <WarningOutlined />
          <Text strong>Release risk profile</Text>
          <Tag color={releaseRiskStatusColor(releaseRiskProfile.status)}>
            {readinessStatusLabel(releaseRiskProfile.status)}
          </Tag>
          <Tag>{releaseRiskProfile.score}/100</Tag>
          <Tag color={releaseRiskProfile.summary.high + releaseRiskProfile.summary.critical > 0 ? 'red' : 'green'}>
            {releaseRiskProfile.summary.critical + releaseRiskProfile.summary.high} high+
          </Tag>
        </Space>
        <Text type="secondary">{new Date(releaseRiskProfile.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Findings: {releaseRiskProfile.summary.findingCount}</span>
        <span>Readiness: {releaseRiskProfile.summary.readinessStatus || '-'}</span>
        <span>Components: {releaseRiskProfile.summary.componentCount}</span>
        <span>Dependency high+: {releaseRiskProfile.summary.dependencyCriticalRiskCount + releaseRiskProfile.summary.dependencyHighRiskCount}</span>
        <span>License risk: {releaseRiskProfile.summary.licenseRiskCount}</span>
        <span>Registry failures: {releaseRiskProfile.summary.unreachableRegistryCount}</span>
        <span>Credential gaps: {releaseRiskProfile.summary.missingCredentialEndpointCount}</span>
        <span>Lock drift: {releaseRiskProfile.summary.lockfileDriftFindingCount}</span>
        <span>Runtime pins: {releaseRiskProfile.summary.runtimePinningFindingCount}</span>
        <span>Offline cache: {releaseRiskProfile.summary.offlineCacheFindingCount}</span>
        <span>Deploy refs: {releaseRiskProfile.summary.deploymentReferenceCount}</span>
        <span>Floating deploy refs: {releaseRiskProfile.summary.floatingDeploymentRefCount}</span>
        <span>Missing deploy baselines: {releaseRiskProfile.summary.missingDeploymentBaselineCount}</span>
        <span>Audit high+: {releaseRiskProfile.summary.auditCriticalFindingCount + releaseRiskProfile.summary.auditHighFindingCount}</span>
        <span>Audit fixes: {releaseRiskProfile.summary.auditFixAvailableCount}</span>
        <span>Floating images: {releaseRiskProfile.summary.floatingContainerTagCount}</span>
        <span>Workspaces: {releaseRiskProfile.summary.workspaceCount}</span>
        <span>Failed ops: {releaseRiskProfile.summary.failedOperationCount}</span>
      </div>
      <ReleaseRiskPanelTable releaseRiskProfile={releaseRiskProfile} />
      <ReleaseRiskPanelTable2 releaseRiskRows={releaseRiskRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ReleaseRiskPanelTable({ releaseRiskProfile }: Pick<PanelValues, 'releaseRiskProfile'>) {
  return (<Table
    dataSource={releaseRiskProfile.categories}
    rowKey="category"
    size="small"
    pagination={false}
    columns={[
      {
        title: 'Category',
        dataIndex: 'title',
        key: 'title',
        width: 220
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: ReleaseRiskProfileStatus) => <Tag color={releaseRiskStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Score',
        dataIndex: 'score',
        key: 'score',
        width: 90
      },
      {
        title: 'Findings',
        key: 'findings',
        render: (_: unknown, record: ReleaseRiskCategorySummary) => (
          <Space size={4} wrap>
            <Tag>{record.findingCount}</Tag>
            <Tag color={record.critical + record.high > 0 ? 'red' : 'default'}>{record.critical + record.high} high+</Tag>
            <Tag color={record.medium > 0 ? 'orange' : 'default'}>{record.medium} medium</Tag>
          </Space>
        )
      }
    ]}
  />)
}

function ReleaseRiskPanelTable2({ releaseRiskRows }: Pick<PanelValues, 'releaseRiskRows'>) {
  return (<Table
    dataSource={releaseRiskRows}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No release risks" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: ReleaseRiskSeverity) => <Tag color={releaseRiskSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 170,
        render: (source: ReleaseRiskSource) => <Tag>{source}</Tag>
      },
      {
        title: 'Risk',
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
