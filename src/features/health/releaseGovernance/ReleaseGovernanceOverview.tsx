import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface ReleaseGovernanceOverviewProps {
  readinessReport: ReadinessGateReport | null
  releaseRiskProfile: ReleaseRiskProfileReport | null
  releaseEvidenceCompleteness: ReleaseEvidenceCompletenessReport | null
  releaseIntegrityVerification: ReleaseIntegrityVerificationReport | null
  releaseSignature: ReleaseSignatureReport | null
  releaseTrustPolicy: ReleaseTrustPolicyReport | null
  dependencyChangeApprovalPacket: DependencyChangeApprovalPacketReport | null
  dependencyChangeCalendar: DependencyChangeCalendarReport | null
  dependencyChangeExecutionRecord: DependencyChangeExecutionReport | null
  reportArtifactIndex: ReportArtifactIndexReport | null
}

const ReleaseGovernanceOverview: React.FC<ReleaseGovernanceOverviewProps> = ({
  readinessReport,
  releaseRiskProfile,
  releaseEvidenceCompleteness,
  releaseIntegrityVerification,
  releaseSignature,
  releaseTrustPolicy,
  dependencyChangeApprovalPacket,
  dependencyChangeCalendar,
  dependencyChangeExecutionRecord,
  reportArtifactIndex
}) => {
  const releaseArtifactCount = reportArtifactIndex?.summary.categoryCounts.release || 0
  const evidenceArtifactCount = reportArtifactIndex?.summary.categoryCounts.evidence || 0
  const blockedTrustChecks = releaseTrustPolicy?.summary.blockedCheckCount || 0
  const missingRequiredEvidence = releaseEvidenceCompleteness?.summary.missingRequiredArtifactCount || 0
  const integrityMismatches = releaseIntegrityVerification?.summary.requiredMismatchArtifactCount || 0
  const executionGaps = dependencyChangeExecutionRecord
    ? dependencyChangeExecutionRecord.summary.missingOperationEvidenceCount
      + dependencyChangeExecutionRecord.summary.missingCiEvidenceCount
      + dependencyChangeExecutionRecord.summary.verificationFailedCount
    : 0

  return (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Release governance cockpit</Text>
          <Tag color={statusColor(releaseTrustPolicy?.status || releaseRiskProfile?.status || readinessReport?.status)}>
            {statusLabel(releaseTrustPolicy?.status || releaseRiskProfile?.status || readinessReport?.status)}
          </Tag>
          <Tag>{releaseArtifactCount} release reports</Tag>
          <Tag>{evidenceArtifactCount} evidence reports</Tag>
        </Space>
        <Text type="secondary">Production release signals</Text>
      </div>

      <div className={styles.cards}>
        <SignalCard
          icon={<CheckCircleOutlined />}
          title="Readiness"
          status={readinessReport?.status}
          primary={readinessReport ? `${readinessReport.score}/100` : 'not gated'}
          detail={`${readinessReport?.checks.filter((check) => check.status === 'blocked').length || 0} blocked / ${readinessReport?.checks.filter((check) => check.status === 'warning').length || 0} warnings`}
        />
        <SignalCard
          icon={<WarningOutlined />}
          title="Release risk"
          status={releaseRiskProfile?.status}
          primary={`${releaseRiskProfile?.summary.findingCount || 0} findings`}
          detail={`${releaseRiskProfile?.summary.critical || 0} critical / ${releaseRiskProfile?.summary.high || 0} high`}
        />
        <SignalCard
          icon={<FileProtectOutlined />}
          title="Evidence"
          status={releaseEvidenceCompleteness?.status}
          primary={releaseEvidenceCompleteness ? `${releaseEvidenceCompleteness.summary.presentArtifactCount}/${releaseEvidenceCompleteness.summary.expectedArtifactCount}` : 'not checked'}
          detail={`${missingRequiredEvidence} required missing / ${releaseEvidenceCompleteness?.summary.requiredIntegrityMismatchCount || 0} mismatches`}
        />
        <SignalCard
          icon={<FileProtectOutlined />}
          title="Integrity"
          status={releaseIntegrityVerification?.status}
          primary={releaseIntegrityVerification ? `${releaseIntegrityVerification.summary.verifiedArtifactCount}/${releaseIntegrityVerification.summary.artifactCount}` : 'not verified'}
          detail={`${integrityMismatches} required mismatches`}
        />
        <SignalCard
          icon={<SafetyCertificateOutlined />}
          title="Signature"
          status={releaseSignature?.status}
          primary={releaseSignature?.signature.status || 'unsigned'}
          detail={releaseSignature?.verification.status || 'not verified'}
        />
        <SignalCard
          icon={<SafetyCertificateOutlined />}
          title="Trust"
          status={releaseTrustPolicy?.status}
          primary={releaseTrustPolicy ? `${releaseTrustPolicy.summary.passedCheckCount}/${releaseTrustPolicy.summary.checkCount}` : 'not checked'}
          detail={`${blockedTrustChecks} blocked checks`}
        />
        <SignalCard
          icon={<CalendarOutlined />}
          title="Change approval"
          status={dependencyChangeApprovalPacket?.status}
          primary={dependencyChangeApprovalPacket?.decision || 'not packaged'}
          detail={`${dependencyChangeApprovalPacket?.summary.blockedChecklistCount || 0} blocked checklist items`}
        />
        <SignalCard
          icon={<CalendarOutlined />}
          title="Change calendar"
          status={dependencyChangeCalendar?.status}
          primary={`${dependencyChangeCalendar?.summary.windowCount || 0} windows`}
          detail={`${dependencyChangeCalendar?.summary.freezeWindowCount || 0} freeze windows`}
        />
        <SignalCard
          icon={<HistoryOutlined />}
          title="Execution record"
          status={dependencyChangeExecutionRecord?.status}
          primary={`${dependencyChangeExecutionRecord?.summary.recordCount || 0} records`}
          detail={`${executionGaps} evidence gaps`}
        />
      </div>
    </div>
  )
}

interface SignalCardProps {
  icon: React.ReactNode
  title: string
  status?: string
  primary: string
  detail: string
}

const SignalCard: React.FC<SignalCardProps> = ({ icon, title, status, primary, detail }) => (
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
  if (status === 'ready' || status === 'passed' || status === 'approved' || status === 'signed') return 'green'
  if (status === 'blocked' || status === 'failed' || status === 'rejected' || status === 'mismatch') return 'red'
  if (status === 'warning' || status === 'needs-review' || status === 'unsigned') return 'orange'
  return 'blue'
}

function statusLabel(status?: string): string {
  return status || 'not available'
}

export default ReleaseGovernanceOverview
