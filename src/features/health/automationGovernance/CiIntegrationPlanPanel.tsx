import React from 'react'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface CiIntegrationPlanPanelProps { report: CiIntegrationPlanReport }

const CiIntegrationPlanPanel: React.FC<CiIntegrationPlanPanelProps> = ({ report }) => {
  const deploymentWarnings = report.warnings.filter((warning) => (
    warning.releaseRiskCategory === 'deployment' || warning.id === 'readiness:deployment-references' || warning.id === 'readiness:deployment-baselines'
  )).slice(0, 8)
  return (
    <div className={styles.riskPanel}>
      <CiPlanHeader report={report} />
      <CiPlanSummary report={report} />
      <CiWorkspaceMatrix matrix={report.matrix} />
      <CiDeploymentHeader report={report} />
      <WarningTable warnings={deploymentWarnings} emptyText="No deployment release gate warnings" includeTitle />
      <WarningTable warnings={report.warnings.slice(0, 8)} emptyText="No CI integration warnings" />
    </div>
  )
}

const CiPlanHeader: React.FC<{ report: CiIntegrationPlanReport }> = ({ report }) => (
  <div className={styles.policyHeader}>
    <Space wrap>
      <ToolOutlined /><Text strong>CI integration plan</Text><Tag color={statusColor(report.status)}>{report.status}</Tag>
      <Tag>{report.summary.jobCount} jobs</Tag><Tag>{report.summary.matrixEntryCount} targets</Tag>
      <Tag color={report.summary.deploymentWarningCount > 0 ? 'orange' : 'green'}>{report.summary.deploymentWarningCount} deployment gates</Tag>
    </Space>
    <Text type="secondary">{new Date(report.generatedAt).toLocaleString()}</Text>
  </div>
)

const CiPlanSummary: React.FC<{ report: CiIntegrationPlanReport }> = ({ report }) => (
  <div className={styles.readinessSummary}>
    <span>Managers: {report.summary.managers.join(', ') || '-'}</span><span>Install commands: {report.summary.installCommandCount}</span>
    <span>Offline commands: {report.summary.offlineCommandCount}</span><span>Verify commands: {report.summary.verificationCommandCount}</span>
    <span>Cache keys: {report.summary.cacheKeyCount}</span><span>Secrets: {report.summary.requiredSecretCount}</span>
    <span>Warnings: {report.summary.warningCount}</span><span>Readiness: {report.summary.readinessStatus || '-'}</span>
    <span>Risk: {report.summary.releaseRiskStatus || '-'}</span><span>Deployment refs: {report.summary.deploymentReferenceCount}</span>
    <span>Floating deploy refs: {report.summary.floatingDeploymentRefCount}</span><span>Deployment baseline evidence: {report.summary.deploymentBaselineEvidenceCount}</span>
    <span>Missing deploy baselines: {report.summary.missingDeploymentBaselineCount}</span>
  </div>
)

const CiWorkspaceMatrix: React.FC<{ matrix: CiIntegrationMatrixEntry[] }> = ({ matrix }) => (
  <Table
    dataSource={matrix}
    rowKey="workspaceId"
    size="small"
    pagination={{ pageSize: 6 }}
    columns={[
      {
        title: 'Workspace', dataIndex: 'workspaceRelativePath', key: 'workspaceRelativePath', width: 180,
        render: (path: string, record: CiIntegrationMatrixEntry) => <Space direction="vertical" size={0}><Text>{record.workspaceName}</Text><Text type="secondary">{path}</Text></Space>
      },
      {
        title: 'Managers', dataIndex: 'managerIds', key: 'managerIds', width: 260,
        render: (managerIds: DependencyManagerId[]) => <Space size={4} wrap>{managerIds.map((managerId) => <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>)}</Space>
      },
      {
        title: 'Install commands', dataIndex: 'installCommands', key: 'installCommands', ellipsis: true,
        render: (commands: CiIntegrationCommand[]) => commands.map((command) => `${command.managerId}: ${command.command}`).join(' | ') || '-'
      },
      {
        title: 'Secrets', dataIndex: 'requiredSecrets', key: 'requiredSecrets', width: 220, ellipsis: true,
        render: (secrets: string[]) => secrets.join(', ') || '-'
      }
    ]}
  />
)

const CiDeploymentHeader: React.FC<{ report: CiIntegrationPlanReport }> = ({ report }) => (
  <div className={styles.policyHeader}>
    <Space wrap><Text strong>Deployment release gates</Text><Tag color={report.summary.deploymentWarningCount > 0 ? 'orange' : 'green'}>{report.summary.deploymentWarningCount} CI warning(s)</Tag><Tag>{report.summary.floatingDeploymentRefCount} floating refs</Tag><Tag>{report.summary.missingDeploymentBaselineCount} missing baselines</Tag></Space>
  </div>
)

const WarningTable: React.FC<{ warnings: CiIntegrationWarning[]; emptyText: string; includeTitle?: boolean }> = ({ warnings, emptyText, includeTitle = false }) => (
  <Table
    dataSource={warnings} rowKey="id" size="small" pagination={false}
    locale={{ emptyText: <Empty description={emptyText} /> }}
    columns={[
      { title: 'Severity', dataIndex: 'severity', key: 'severity', width: 120, render: (severity: CiIntegrationWarningSeverity) => <Tag color={warningColor(severity)}>{severity}</Tag> },
      { title: 'Source', dataIndex: 'source', key: 'source', width: 180, render: (source: CiIntegrationWarningSource) => <Tag>{source}</Tag> },
      ...(includeTitle ? [{ title: 'Gate', dataIndex: 'title', key: 'title', width: 220, ellipsis: true }] : []),
      { title: includeTitle ? 'Finding' : 'Warning', dataIndex: 'summary', key: 'summary', ellipsis: true },
      { title: 'Recommendation', dataIndex: 'recommendation', key: 'recommendation', ellipsis: true }
    ]}
  />
)

function statusColor(status: string): string {
  if (status === 'blocked') return 'red'
  if (status === 'warning') return 'orange'
  return 'green'
}

function warningColor(severity: CiIntegrationWarningSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

export default CiIntegrationPlanPanel
