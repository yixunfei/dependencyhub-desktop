import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import {
  BranchesOutlined,
  FileSyncOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RollbackOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface ReproducibilityGovernanceOverviewProps {
  snapshots: SupplyChainSnapshotSummary[]
  snapshotDiff: SupplyChainSnapshotDiff | null
  dependencyDiff: DependencyComponentDiff | null
  offlineCacheReport: OfflineCacheReadinessReport | null
  dependencyRollbackPlan: DependencyRollbackPlanReport | null
  releaseRiskProfile: ReleaseRiskProfileReport | null
  readinessReport: ReadinessGateReport | null
  reportArtifactIndex: ReportArtifactIndexReport | null
}

const ReproducibilityGovernanceOverview: React.FC<ReproducibilityGovernanceOverviewProps> = ({
  snapshots,
  snapshotDiff,
  dependencyDiff,
  offlineCacheReport,
  dependencyRollbackPlan,
  releaseRiskProfile,
  readinessReport,
  reportArtifactIndex
}) => {
  const dependencyHighRiskCount = dependencyDiff
    ? dependencyDiff.summary.criticalRisk + dependencyDiff.summary.highRisk
    : (releaseRiskProfile?.summary.dependencyCriticalRiskCount || 0)
      + (releaseRiskProfile?.summary.dependencyHighRiskCount || 0)
  const snapshotFileChangeCount = snapshotDiff
    ? snapshotDiff.added.length + snapshotDiff.removed.length + snapshotDiff.changed.length
    : 0
  const offlineFindingCount = offlineCacheReport?.summary.findingCount || releaseRiskProfile?.summary.offlineCacheFindingCount || 0
  const lockfileFindingCount = releaseRiskProfile?.summary.lockfileDriftFindingCount || readinessReport?.summary.lockfileDriftFindingCount || 0
  const runtimeFindingCount = releaseRiskProfile?.summary.runtimePinningFindingCount || readinessReport?.summary.runtimePinningFindingCount || 0
  const rollbackGapCount = dependencyRollbackPlan?.summary.blockedItemCount || 0
  const offlineStatus = offlineCacheReport
    ? offlineCacheReport.summary.blocked > 0
      ? 'blocked'
      : offlineCacheReport.summary.warning > 0
        ? 'warning'
        : 'ready'
    : undefined
  const deploymentGapCount = (releaseRiskProfile?.summary.missingDeploymentBaselineCount || readinessReport?.summary.missingDeploymentBaselineCount || 0)
    + (releaseRiskProfile?.summary.floatingDeploymentRefCount || readinessReport?.summary.floatingDeploymentRefCount || 0)
  const blocked = offlineStatus === 'blocked' || dependencyRollbackPlan?.status === 'blocked' || rollbackGapCount > 0
  const warning = dependencyHighRiskCount > 0 || snapshotFileChangeCount > 0 || offlineFindingCount > 0 || lockfileFindingCount > 0 || runtimeFindingCount > 0 || deploymentGapCount > 0

  return (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <FileSyncOutlined />
          <Text strong>Reproducibility cockpit</Text>
          <Tag color={blocked ? 'red' : warning ? 'orange' : 'green'}>
            {blocked ? 'blocked' : warning ? 'needs review' : 'ready'}
          </Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.reproducibility || 0} reproducibility reports</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.risk || 0} risk reports</Tag>
        </Space>
        <Text type="secondary">Snapshots, dependency diffs, rollback anchors, runtime pins, and offline readiness</Text>
      </div>

      <div className={styles.cards}>
        <ReproCard
          icon={<HistoryOutlined />}
          title="Snapshots"
          status={snapshots.length > 0 ? 'ready' : 'warning'}
          primary={`${snapshots.length} snapshots`}
          detail={snapshots[0] ? `latest ${new Date(snapshots[0].createdAt).toLocaleString()}` : 'no managed snapshot'}
        />
        <ReproCard
          icon={<BranchesOutlined />}
          title="Snapshot diff"
          status={snapshotFileChangeCount > 0 ? 'warning' : snapshotDiff ? 'ready' : undefined}
          primary={`${snapshotFileChangeCount} file changes`}
          detail={snapshotDiff ? `${snapshotDiff.added.length} added / ${snapshotDiff.removed.length} removed / ${snapshotDiff.changed.length} changed` : 'not compared'}
        />
        <ReproCard
          icon={<WarningOutlined />}
          title="Dependency diff"
          status={dependencyHighRiskCount > 0 ? 'blocked' : dependencyDiff ? 'ready' : undefined}
          primary={`${dependencyHighRiskCount} high+ risks`}
          detail={dependencyDiff ? `${dependencyDiff.summary.added} added / ${dependencyDiff.summary.updated} updated / ${dependencyDiff.summary.removed} removed` : 'no baseline diff'}
        />
        <ReproCard
          icon={<RollbackOutlined />}
          title="Rollback"
          status={dependencyRollbackPlan?.status}
          primary={`${dependencyRollbackPlan?.summary.itemCount || 0} rollback scopes`}
          detail={`${dependencyRollbackPlan?.summary.snapshotCoveredItemCount || 0} snapshot-covered / ${dependencyRollbackPlan?.summary.lockfileCoveredItemCount || 0} lockfile-covered`}
        />
        <ReproCard
          icon={<FileSyncOutlined />}
          title="Offline cache"
          status={offlineStatus}
          primary={`${offlineFindingCount} findings`}
          detail={`${offlineCacheReport?.summary.offlineCommandManagerCount || 0} offline commands / ${offlineCacheReport?.summary.missingOfflineCommandManagerCount || 0} missing`}
        />
        <ReproCard
          icon={<ReloadOutlined />}
          title="Runtime and locks"
          status={lockfileFindingCount + runtimeFindingCount > 0 ? 'warning' : releaseRiskProfile || readinessReport ? 'ready' : undefined}
          primary={`${lockfileFindingCount + runtimeFindingCount} findings`}
          detail={`${lockfileFindingCount} lock drift / ${runtimeFindingCount} runtime pinning`}
        />
        <ReproCard
          icon={<BranchesOutlined />}
          title="Deployment baselines"
          status={deploymentGapCount > 0 ? 'warning' : releaseRiskProfile || readinessReport ? 'ready' : undefined}
          primary={`${deploymentGapCount} gaps`}
          detail={`${releaseRiskProfile?.summary.floatingDeploymentRefCount || readinessReport?.summary.floatingDeploymentRefCount || 0} floating refs`}
        />
      </div>
    </div>
  )
}

interface ReproCardProps {
  icon: React.ReactNode
  title: string
  status?: string
  primary: string
  detail: string
}

const ReproCard: React.FC<ReproCardProps> = ({ icon, title, status, primary, detail }) => (
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
  if (!status) return 'default'
  if (status === 'ready' || status === 'passed' || status === 'success') return 'green'
  if (status === 'blocked' || status === 'failed' || status === 'error') return 'red'
  if (status === 'warning' || status === 'needs-review') return 'orange'
  return 'blue'
}

function statusLabel(status?: string): string {
  return status || 'not available'
}

export default ReproducibilityGovernanceOverview
