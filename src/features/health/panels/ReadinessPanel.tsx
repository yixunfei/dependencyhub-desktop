import { SafetyCertificateOutlined, SettingOutlined } from '@ant-design/icons'
import { Button, Space, Table, Tag, Tooltip, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { readinessCheckColor, readinessSeverityColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'readinessReport' | 'setReadinessPolicyEditorOpen' | 'readinessRows'>

export function ReadinessPanel({ readinessReport, setReadinessPolicyEditorOpen, readinessRows }: Props) {
  return (readinessReport && (
    <div className={styles.readinessPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Production readiness gate</Text>
          <Tag color={readinessStatusColor(readinessReport.status)}>
            {readinessStatusLabel(readinessReport.status)}
          </Tag>
          <Tag>{readinessReport.score}/100</Tag>
        </Space>
        <Space wrap>
          <Text type="secondary">{new Date(readinessReport.generatedAt).toLocaleString()}</Text>
          <Tooltip title={readinessReport.policy.path}>
            <Tag>Policy: {readinessReport.policy.policy.recentOperationDays}d ops / {readinessReport.policy.policy.snapshotStaleDays}d snapshot</Tag>
          </Tooltip>
          <Button size="small" icon={<SettingOutlined />} onClick={() => setReadinessPolicyEditorOpen(true)}>
            Policy
          </Button>
        </Space>
      </div>
      <div className={styles.readinessSummary}>
        <span>Managers: {readinessReport.summary.detectedManagerCount}</span>
        <span>Components: {readinessReport.summary.componentCount}</span>
        <span>Policy violations: {readinessReport.summary.policyViolationCount}</span>
        <span>Snapshots: {readinessReport.summary.snapshotCount}</span>
        <span>Diff high+: {readinessReport.summary.dependencyHighRiskCount}</span>
        <span>Diff medium: {readinessReport.summary.dependencyMediumRiskCount}</span>
        <span>Major updates: {readinessReport.summary.dependencyMajorUpdateCount}</span>
        <span>CI evidence: {readinessReport.summary.ciEvidenceCount}</span>
        <span>Latest CI: {readinessReport.summary.latestCiStatus || '-'}</span>
        <span>Audit findings: {readinessReport.summary.auditEvidenceFindingCount}</span>
        <span>Audit high+: {readinessReport.summary.auditCriticalFindingCount + readinessReport.summary.auditHighFindingCount}</span>
        <span>Audit fixes: {readinessReport.summary.auditFixAvailableCount}</span>
        <span>Approvals: {readinessReport.summary.activeReleaseApprovalCount}/{readinessReport.policy.policy.requiredReleaseApprovals}</span>
        <span>Latest approval: {readinessReport.summary.latestReleaseApprovalDecision || '-'}</span>
        <span>Exceptions: {readinessReport.summary.activeReleaseExceptionCount}/{readinessReport.summary.releaseExceptionCount}</span>
        <span>Exceptioned gates: {readinessReport.summary.exceptionedCheckCount}</span>
        <span>Registries: {readinessReport.summary.registryEndpointCount}</span>
        <span>Registry failures: {readinessReport.summary.unreachableRegistryCount}</span>
        <span>Workspaces: {readinessReport.summary.workspaceCount}</span>
        <span>Workspace managers: {readinessReport.summary.workspaceManagerCount}</span>
        <span>Deploy refs: {readinessReport.summary.deploymentReferenceCount}</span>
        <span>Floating deploy refs: {readinessReport.summary.floatingDeploymentRefCount}</span>
        <span>Missing deploy baselines: {readinessReport.summary.missingDeploymentBaselineCount}</span>
        <span>Missing tools: {readinessReport.summary.missingToolCount}/{readinessReport.summary.requiredToolCount}</span>
      </div>
      <ReadinessPanelTable readinessRows={readinessRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ReadinessPanelTable({ readinessRows }: Pick<PanelValues, 'readinessRows'>) {
  return (<Table
    dataSource={readinessRows}
    rowKey="id"
    size="small"
    pagination={false}
    columns={[
      {
        title: 'Gate',
        dataIndex: 'title',
        key: 'title',
        width: 220,
        render: (title: string, record: ReadinessGateCheck) => (
          <Space size={4} wrap>
            <Tag color={readinessCheckColor(record.status)}>{record.status}</Tag>
            <span>{title}</span>
          </Space>
        )
      },
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 110,
        render: (severity: ReadinessGateSeverity) => <Tag color={readinessSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Summary',
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
