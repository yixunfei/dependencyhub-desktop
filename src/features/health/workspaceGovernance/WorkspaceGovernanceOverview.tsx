import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import {
  ApartmentOutlined,
  AuditOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface WorkspaceGovernanceOverviewProps {
  workspaceReport: WorkspaceDiscoveryReport | null
  workspaceGovernanceReport: WorkspaceGovernanceReport | null
  readinessReport: ReadinessGateReport | null
  reportArtifactIndex: ReportArtifactIndexReport | null
}

const WorkspaceGovernanceOverview: React.FC<WorkspaceGovernanceOverviewProps> = ({
  workspaceReport,
  workspaceGovernanceReport,
  readinessReport,
  reportArtifactIndex
}) => {
  const workspaceCount = workspaceGovernanceReport?.summary.workspaceCount || workspaceReport?.summary.workspaceCount || 0
  const managerCount = workspaceGovernanceReport?.summary.managers.length || workspaceReport?.summary.managerCount || 0
  const blockedCount = workspaceGovernanceReport?.summary.blocked || 0
  const warningCount = workspaceGovernanceReport?.summary.warning || 0
  const evidenceGapCount = (workspaceGovernanceReport?.summary.missingCiEvidenceWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.missingReleaseApprovalEvidenceWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.missingReleaseExceptionEvidenceWorkspaceCount || 0)
  const inheritanceCount = (workspaceGovernanceReport?.summary.inheritedPolicyWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.inheritedReadinessPolicyWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.inheritedSnapshotWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.inheritedCiEvidenceWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.inheritedReleaseApprovalEvidenceWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.inheritedReleaseExceptionEvidenceWorkspaceCount || 0)
  const reproducibilityGapCount = (workspaceGovernanceReport?.summary.missingSnapshotWorkspaceCount || 0)
    + (workspaceGovernanceReport?.summary.missingLockWorkspaceCount || 0)
    + (readinessReport?.summary.lockfileDriftFindingCount || 0)
  const deploymentGapCount = (readinessReport?.summary.floatingDeploymentRefCount || 0)
    + (readinessReport?.summary.missingDeploymentBaselineCount || 0)
  const cockpitStatus = !workspaceGovernanceReport
    ? 'not governed'
    : blockedCount > 0
      ? 'blocked'
      : warningCount > 0
        ? 'needs review'
        : 'ready'

  return (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ApartmentOutlined />
          <Text strong>Workspace governance cockpit</Text>
          <Tag color={statusColor(cockpitStatus)}>{cockpitStatus}</Tag>
          <Tag>{workspaceCount} workspaces</Tag>
          <Tag>{managerCount} managers</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.workspace || 0} workspace reports</Tag>
        </Space>
        <Text type="secondary">Workspace discovery, inherited governance sources, local overrides, release evidence, and monorepo readiness</Text>
      </div>

      <div className={styles.cards}>
        <WorkspaceCard
          icon={<FileSearchOutlined />}
          title="Discovery"
          status={workspaceReport ? 'ready' : undefined}
          primary={`${workspaceCount} workspaces`}
          detail={`${workspaceReport?.summary.explicitWorkspaceCount || 0} explicit / ${workspaceReport?.summary.manifestFileCount || 0} manifests / ${workspaceReport?.summary.lockFileCount || 0} locks`}
        />
        <WorkspaceCard
          icon={<WarningOutlined />}
          title="Governance risk"
          status={workspaceGovernanceReport?.summary.blocked ? 'blocked' : workspaceGovernanceReport?.summary.warning ? 'warning' : workspaceGovernanceReport ? 'ready' : undefined}
          primary={`${blockedCount + warningCount} risky workspaces`}
          detail={`${blockedCount} blocked / ${warningCount} warning / ${workspaceGovernanceReport?.summary.ready || 0} ready`}
        />
        <WorkspaceCard
          icon={<SafetyCertificateOutlined />}
          title="Policy and gates"
          status={(workspaceGovernanceReport?.summary.highSeverityPolicyViolationCount || 0) > 0 || (workspaceGovernanceReport?.summary.readinessBlocked || 0) > 0 ? 'blocked' : workspaceGovernanceReport ? 'ready' : undefined}
          primary={`${workspaceGovernanceReport?.summary.policyViolationCount || 0} policy findings`}
          detail={`${workspaceGovernanceReport?.summary.readinessBlocked || 0} blocked gates / ${workspaceGovernanceReport?.summary.readinessWarning || 0} warning gates`}
        />
        <WorkspaceCard
          icon={<BranchesOutlined />}
          title="Inherited sources"
          status={workspaceGovernanceReport ? 'ready' : undefined}
          primary={`${inheritanceCount} inherited sources`}
          detail={`${workspaceGovernanceReport?.summary.workspacePolicyCount || 0} local policies / ${workspaceGovernanceReport?.summary.workspaceReadinessPolicyCount || 0} local gates`}
        />
        <WorkspaceCard
          icon={<CheckCircleOutlined />}
          title="Release evidence"
          status={evidenceGapCount > 0 || (workspaceGovernanceReport?.summary.rejectedReleaseApprovalWorkspaceCount || 0) > 0 ? 'warning' : workspaceGovernanceReport ? 'ready' : undefined}
          primary={`${evidenceGapCount} evidence gaps`}
          detail={`${workspaceGovernanceReport?.summary.activeReleaseApprovalCount || 0} active approvals / ${workspaceGovernanceReport?.summary.activeReleaseExceptionCount || 0} active exceptions`}
        />
        <WorkspaceCard
          icon={<AuditOutlined />}
          title="Reproducibility"
          status={reproducibilityGapCount > 0 ? 'warning' : workspaceGovernanceReport || readinessReport ? 'ready' : undefined}
          primary={`${reproducibilityGapCount} gaps`}
          detail={`${workspaceGovernanceReport?.summary.inheritedSnapshotWorkspaceCount || 0} inherited snapshots / ${workspaceGovernanceReport?.summary.missingLockWorkspaceCount || 0} missing locks`}
        />
        <WorkspaceCard
          icon={<HistoryOutlined />}
          title="Operations"
          status={(workspaceGovernanceReport?.summary.failedOperationCount || 0) > 0 ? 'warning' : workspaceGovernanceReport ? 'ready' : undefined}
          primary={`${workspaceGovernanceReport?.summary.failedOperationCount || 0} failed ops`}
          detail={`${workspaceGovernanceReport?.summary.recentOperationCount || 0} recent operations / ${workspaceGovernanceReport?.summary.ciEvidenceRecordCount || 0} CI evidence records`}
        />
        <WorkspaceCard
          icon={<BranchesOutlined />}
          title="Deployment inputs"
          status={deploymentGapCount > 0 ? 'warning' : readinessReport ? 'ready' : undefined}
          primary={`${deploymentGapCount} deployment gaps`}
          detail={`${readinessReport?.summary.floatingDeploymentRefCount || 0} floating refs / ${readinessReport?.summary.missingDeploymentBaselineCount || 0} missing baselines`}
        />
      </div>
    </div>
  )
}

interface WorkspaceCardProps {
  icon: React.ReactNode
  title: string
  status?: string
  primary: string
  detail: string
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ icon, title, status, primary, detail }) => (
  <Card className={styles.metricCard} variant="borderless">
    <Space orientation="vertical" size={6}>
      <Space wrap>
        {icon}
        <Text type="secondary">{title}</Text>
        <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>
      </Space>
      <Text strong>{primary}</Text>
      <Text type="secondary">{detail}</Text>
    </Space>
  </Card>
)

function statusColor(status?: string): string {
  if (!status || status === 'not governed') return 'default'
  if (status === 'ready' || status === 'passed' || status === 'success') return 'green'
  if (status === 'blocked' || status === 'failed' || status === 'error') return 'red'
  if (status === 'warning' || status === 'needs review' || status === 'needs-review') return 'orange'
  return 'blue'
}

function statusLabel(status?: string): string {
  return status || 'not available'
}

export default WorkspaceGovernanceOverview
