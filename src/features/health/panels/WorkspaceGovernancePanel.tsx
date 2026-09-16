import { SafetyCertificateOutlined } from '@ant-design/icons'
import type { TableProps } from 'antd'
import { Empty, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import {
  ciEvidenceStatusColor, readinessStatusColor, readinessStatusLabel, releaseApprovalColor,
  workspaceCiEvidenceSourceColor, workspaceGovernanceStatusColor, workspacePolicySourceColor,
  workspaceReadinessPolicySourceColor, workspaceReleaseApprovalSourceColor,
  workspaceReleaseExceptionSourceColor, workspaceSnapshotSourceColor
} from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'workspaceGovernanceReport' | 'readinessReport' | 'workspaceGovernanceRows'>

export function WorkspaceGovernancePanel({ currentPath, workspaceGovernanceReport, readinessReport, workspaceGovernanceRows }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Workspace governance</Text>
          <Tag>{workspaceGovernanceReport?.summary.workspaceCount || 0} workspaces</Tag>
          {workspaceGovernanceReport && (
            <>
              <Tag color={workspaceGovernanceReport.summary.blocked > 0 ? 'red' : 'default'}>
                {workspaceGovernanceReport.summary.blocked} blocked
              </Tag>
              <Tag color={workspaceGovernanceReport.summary.warning > 0 ? 'orange' : 'green'}>
                {workspaceGovernanceReport.summary.warning} warning
              </Tag>
              <Tag color="blue">{workspaceGovernanceReport.summary.ready} ready</Tag>
            </>
          )}
        </Space>
        <Text type="secondary">
          {workspaceGovernanceReport ? new Date(workspaceGovernanceReport.generatedAt).toLocaleString() : 'Not governed'}
        </Text>
      </div>
      {workspaceGovernanceReport && (
        <div className={styles.readinessSummary}>
          <span>Components: {workspaceGovernanceReport.summary.componentCount}</span>
          <span>Policy findings: {workspaceGovernanceReport.summary.policyViolationCount}</span>
          <span>High policy: {workspaceGovernanceReport.summary.highSeverityPolicyViolationCount}</span>
          <span>Snapshots: {workspaceGovernanceReport.summary.snapshotCount}</span>
          <span>Inherited snapshots: {workspaceGovernanceReport.summary.inheritedSnapshotWorkspaceCount}</span>
          <span>Missing snapshots: {workspaceGovernanceReport.summary.missingSnapshotWorkspaceCount}</span>
          <span>Missing locks: {workspaceGovernanceReport.summary.missingLockWorkspaceCount}</span>
          {readinessReport && (
            <>
              <span>Lock drift: {readinessReport.summary.lockfileDriftFindingCount}</span>
              <span>Runtime pins: {readinessReport.summary.runtimePinningFindingCount}</span>
              <span>Floating images: {readinessReport.summary.floatingContainerTagCount}</span>
              <span>Floating deploy refs: {readinessReport.summary.floatingDeploymentRefCount}</span>
              <span>Missing deploy baselines: {readinessReport.summary.missingDeploymentBaselineCount}</span>
              <span>Credential gaps: {readinessReport.summary.missingCredentialEndpointCount}</span>
              <span>Weak credentials: {readinessReport.summary.weakCredentialMatchCount}</span>
            </>
          )}
          <span>Inherited policy: {workspaceGovernanceReport.summary.inheritedPolicyWorkspaceCount}</span>
          <span>Workspace policy: {workspaceGovernanceReport.summary.workspacePolicyCount}</span>
          <span>Gate blocked: {workspaceGovernanceReport.summary.readinessBlocked}</span>
          <span>Gate warning: {workspaceGovernanceReport.summary.readinessWarning}</span>
          <span>Inherited gate: {workspaceGovernanceReport.summary.inheritedReadinessPolicyWorkspaceCount}</span>
          <span>CI: {workspaceGovernanceReport.summary.ciEvidenceRecordCount}</span>
          <span>Inherited CI: {workspaceGovernanceReport.summary.inheritedCiEvidenceWorkspaceCount}</span>
          <span>Failed CI: {workspaceGovernanceReport.summary.failedCiEvidenceWorkspaceCount}</span>
          <span>Approvals: {workspaceGovernanceReport.summary.activeReleaseApprovalCount}/{workspaceGovernanceReport.summary.releaseApprovalRecordCount}</span>
          <span>Inherited approvals: {workspaceGovernanceReport.summary.inheritedReleaseApprovalEvidenceWorkspaceCount}</span>
          <span>Rejected approvals: {workspaceGovernanceReport.summary.rejectedReleaseApprovalWorkspaceCount}</span>
          <span>Exceptions: {workspaceGovernanceReport.summary.activeReleaseExceptionCount}/{workspaceGovernanceReport.summary.releaseExceptionRecordCount}</span>
          <span>Inherited exceptions: {workspaceGovernanceReport.summary.inheritedReleaseExceptionEvidenceWorkspaceCount}</span>
          <span>Failed ops: {workspaceGovernanceReport.summary.failedOperationCount}</span>
        </div>
      )}
      <WorkspaceGovernancePanelTable workspaceGovernanceRows={workspaceGovernanceRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

const WorkspaceGovernancePanelTableColumnStatus: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 110,
    render: (status: WorkspaceGovernanceStatus, record: WorkspaceGovernanceNode) => (
      <Space size={4} wrap>
        <Tag color={workspaceGovernanceStatusColor(status)}>{status}</Tag>
        <Tag>{record.score}</Tag>
      </Space>
    )
  }

const WorkspaceGovernancePanelTableColumnWorkspace: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Workspace',
    key: 'workspace',
    width: 230,
    render: (_: unknown, record: WorkspaceGovernanceNode) => (
      <Space orientation="vertical" size={2}>
        <Text strong>{record.workspace.name}</Text>
        <Text type="secondary">{record.workspace.relativePath}</Text>
      </Space>
    )
  }

const WorkspaceGovernancePanelTableColumnManagers: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Managers',
    key: 'managers',
    width: 200,
    render: (_: unknown, record: WorkspaceGovernanceNode) => (
      <Space size={4} wrap>
        {record.workspace.managerIds.length
          ? record.workspace.managerIds.map((managerId) => (
            <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>
          ))
          : '-'}
      </Space>
    )
  }

const WorkspaceGovernancePanelTableColumnComponentCount: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Components',
    dataIndex: 'componentCount',
    key: 'componentCount',
    width: 110
  }

const WorkspaceGovernancePanelTableColumnPolicyViolationCount: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Policy',
    dataIndex: 'policyViolationCount',
    key: 'policyViolationCount',
    width: 96,
    render: (count: number, record: WorkspaceGovernanceNode) => (
      <Tag color={record.highSeverityPolicyViolationCount > 0 ? 'red' : count > 0 ? 'orange' : 'green'}>
        {count}
      </Tag>
    )
  }

const WorkspaceGovernancePanelTableColumnGate: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Gate',
    key: 'gate',
    width: 130,
    render: (_: unknown, record: WorkspaceGovernanceNode) => (
      <Tooltip title={`${record.readinessBlockedCheckCount} blocked / ${record.readinessWarningCheckCount} warning checks`}>
        <Space size={4} wrap>
          <Tag color={readinessStatusColor(record.readinessStatus)}>
            {readinessStatusLabel(record.readinessStatus)}
          </Tag>
          <Tag>{record.readinessScore}</Tag>
        </Space>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnCiEvidence: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'CI',
    key: 'ciEvidence',
    width: 120,
    render: (_: unknown, record: WorkspaceGovernanceNode) => (
      <Tooltip title={record.latestCiFinishedAt ? new Date(record.latestCiFinishedAt).toLocaleString() : 'No CI evidence'}>
        <Space size={4} wrap>
          <Tag color={record.latestCiStatus ? ciEvidenceStatusColor(record.latestCiStatus) : 'default'}>
            {record.ciEvidenceCount}
          </Tag>
          {record.latestCiStatus && (
            <Tag color={ciEvidenceStatusColor(record.latestCiStatus)}>
              {record.latestCiStatus}
            </Tag>
          )}
        </Space>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnCiEvidenceSource: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'CI source',
    dataIndex: 'ciEvidenceSource',
    key: 'ciEvidenceSource',
    width: 130,
    render: (source: WorkspaceCiEvidenceSource, record: WorkspaceGovernanceNode) => (
      <Tooltip title={record.ciEvidencePath || 'No CI evidence'}>
        <Tag color={workspaceCiEvidenceSourceColor(source)}>{source}</Tag>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnApprovals: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Approvals',
    key: 'approvals',
    width: 130,
    render: (_: unknown, record: WorkspaceGovernanceNode) => (
      <Tooltip title={`${record.activeReleaseApprovalCount} active / ${record.releaseApprovalCount} total release approval records`}>
        <Space size={4} wrap>
          <Tag color={record.activeReleaseApprovalCount > 0 ? 'green' : 'default'}>
            {record.activeReleaseApprovalCount}/{record.releaseApprovalCount}
          </Tag>
          {record.latestReleaseApprovalDecision && (
            <Tag color={releaseApprovalColor(record.latestReleaseApprovalDecision)}>
              {record.latestReleaseApprovalDecision}
            </Tag>
          )}
        </Space>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus0: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Approval source',
    dataIndex: 'releaseApprovalSource',
    key: 'releaseApprovalSource',
    width: 150,
    render: (source: WorkspaceReleaseApprovalSource, record: WorkspaceGovernanceNode) => (
      <Tooltip title={record.releaseApprovalPath || 'No release approval evidence'}>
        <Tag color={workspaceReleaseApprovalSourceColor(source)}>{source}</Tag>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus1: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Exceptions',
    key: 'exceptions',
    width: 130,
    render: (_: unknown, record: WorkspaceGovernanceNode) => (
      <Tooltip title={`${record.activeReleaseExceptionCount} active / ${record.releaseExceptionCount} total release exception records`}>
        <Space size={4} wrap>
          <Tag color={record.activeReleaseExceptionCount > 0 ? 'orange' : 'default'}>
            {record.activeReleaseExceptionCount}/{record.releaseExceptionCount}
          </Tag>
          {record.latestReleaseExceptionDecision && (
            <Tag color={record.latestReleaseExceptionDecision === 'approved' ? 'orange' : 'default'}>
              {record.latestReleaseExceptionDecision}
            </Tag>
          )}
        </Space>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus2: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Exception source',
    dataIndex: 'releaseExceptionSource',
    key: 'releaseExceptionSource',
    width: 150,
    render: (source: WorkspaceReleaseExceptionSource, record: WorkspaceGovernanceNode) => (
      <Tooltip title={record.releaseExceptionPath || 'No release exception evidence'}>
        <Tag color={workspaceReleaseExceptionSourceColor(source)}>{source}</Tag>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus3: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Source',
    dataIndex: 'policySource',
    key: 'policySource',
    width: 130,
    render: (source: WorkspacePolicySource, record: WorkspaceGovernanceNode) => (
      <Tooltip title={record.policyPath || 'No dependency policy'}>
        <Tag color={workspacePolicySourceColor(source)}>{source}</Tag>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus4: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Gate source',
    dataIndex: 'readinessPolicySource',
    key: 'readinessPolicySource',
    width: 140,
    render: (source: WorkspaceReadinessPolicySource, record: WorkspaceGovernanceNode) => (
      <Tooltip title={record.readinessPolicyPath || 'No readiness policy'}>
        <Tag color={workspaceReadinessPolicySourceColor(source)}>{source}</Tag>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus5: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Snapshots',
    dataIndex: 'snapshotCount',
    key: 'snapshotCount',
    width: 100,
    render: (count: number, record: WorkspaceGovernanceNode) => (
      <Tooltip title={`${record.snapshotCoveredFileCount} covered dependency file(s)`}>
        <Tag color={count > 0 ? 'green' : 'default'}>{count}</Tag>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus6: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Snapshot source',
    dataIndex: 'snapshotSource',
    key: 'snapshotSource',
    width: 150,
    render: (source: WorkspaceSnapshotSource, record: WorkspaceGovernanceNode) => (
      <Tooltip title={record.snapshotPath || 'No rollback snapshot'}>
        <Tag color={workspaceSnapshotSourceColor(source)}>{source}</Tag>
      </Tooltip>
    )
  }

const WorkspaceGovernancePanelTableColumnStatus7: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Missing locks',
    dataIndex: 'missingLockManagers',
    key: 'missingLockManagers',
    width: 160,
    render: (managerIds: DependencyManagerId[]) => managerIds.length
      ? managerIds.map((managerId) => <Tag key={managerId} color="orange">{managerId}</Tag>)
      : <Tag color="green">covered</Tag>
  }

const WorkspaceGovernancePanelTableColumnStatus8: NonNullable<TableProps<NonNullable<Props['workspaceGovernanceRows']>[number]>['columns']>[number] = {
    title: 'Top finding',
    key: 'finding',
    ellipsis: true,
    render: (_: unknown, record: WorkspaceGovernanceNode) => {
      const finding = record.findings.find((item) => item.severity === 'blocked')
        || record.findings.find((item) => item.severity === 'warning')
        || record.findings[0]
      if (!finding) return '-'
      return (
        <Tooltip title={`${finding.title}: ${finding.recommendation}`}>
          <span>{finding.summary}</span>
        </Tooltip>
      )
    }
  }

function WorkspaceGovernancePanelTable({ workspaceGovernanceRows }: Pick<PanelValues, 'workspaceGovernanceRows'>) {
  return (<Table
    dataSource={workspaceGovernanceRows}
    rowKey={(record) => record.workspace.id}
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No workspace governance results" /> }}
    columns={[WorkspaceGovernancePanelTableColumnStatus, WorkspaceGovernancePanelTableColumnWorkspace, WorkspaceGovernancePanelTableColumnManagers, WorkspaceGovernancePanelTableColumnComponentCount, WorkspaceGovernancePanelTableColumnPolicyViolationCount, WorkspaceGovernancePanelTableColumnGate, WorkspaceGovernancePanelTableColumnCiEvidence, WorkspaceGovernancePanelTableColumnCiEvidenceSource, WorkspaceGovernancePanelTableColumnApprovals, WorkspaceGovernancePanelTableColumnStatus0, WorkspaceGovernancePanelTableColumnStatus1, WorkspaceGovernancePanelTableColumnStatus2, WorkspaceGovernancePanelTableColumnStatus3, WorkspaceGovernancePanelTableColumnStatus4, WorkspaceGovernancePanelTableColumnStatus5, WorkspaceGovernancePanelTableColumnStatus6, WorkspaceGovernancePanelTableColumnStatus7, WorkspaceGovernancePanelTableColumnStatus8]}
  />)
}
