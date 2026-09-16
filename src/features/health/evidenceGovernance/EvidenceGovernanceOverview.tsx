import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import {
  AuditOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface EvidenceGovernanceOverviewProps {
  operationHistory: OperationHistoryRecord[]
  ciEvidence: CiEvidenceRecord[]
  auditEvidence: AuditEvidenceReport | null
  vulnerabilityRemediationPlan: VulnerabilityRemediationPlanReport | null
  releaseApprovals: ReleaseApprovalRecord[]
  releaseExceptions: ReleaseExceptionRecord[]
  reportArtifactIndex: ReportArtifactIndexReport | null
}

const EvidenceGovernanceOverview: React.FC<EvidenceGovernanceOverviewProps> = ({
  operationHistory,
  ciEvidence,
  auditEvidence,
  vulnerabilityRemediationPlan,
  releaseApprovals,
  releaseExceptions,
  reportArtifactIndex
}) => {
  const latestCi = ciEvidence[0]
  const latestApproval = releaseApprovals[0]
  const latestException = releaseExceptions[0]
  const failedOperations = operationHistory.filter((record) => record.status === 'error').length
  const mutatingOperations = operationHistory.filter((record) => record.classification?.mutating).length
  const highAuditFindings = (auditEvidence?.summary.critical || 0) + (auditEvidence?.summary.high || 0)
  const activeExceptions = releaseExceptions.filter((record) => (
    record.decision === 'approved' &&
    (!record.expiresAt || Date.parse(record.expiresAt) > Date.now())
  )).length

  return (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <FileSearchOutlined />
          <Text strong>Evidence operations cockpit</Text>
          <Tag color={highAuditFindings > 0 || failedOperations > 0 ? 'orange' : 'green'}>
            {highAuditFindings > 0 || failedOperations > 0 ? 'needs review' : 'ready'}
          </Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.evidence || 0} evidence reports</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.operations || 0} operation reports</Tag>
        </Space>
        <Text type="secondary">CI, audit, approval, exception, and operation evidence</Text>
      </div>

      <div className={styles.cards}>
        <EvidenceCard
          icon={<HistoryOutlined />}
          title="Operations"
          status={failedOperations > 0 ? 'warning' : 'ready'}
          primary={`${operationHistory.length} records`}
          detail={`${mutatingOperations} mutating / ${failedOperations} failed`}
        />
        <EvidenceCard
          icon={<CheckCircleOutlined />}
          title="CI evidence"
          status={latestCi?.status}
          primary={`${ciEvidence.length} records`}
          detail={latestCi ? latestCi.workflow || latestCi.provider || latestCi.source : 'not recorded'}
        />
        <EvidenceCard
          icon={<WarningOutlined />}
          title="Audit evidence"
          status={highAuditFindings > 0 ? 'blocked' : auditEvidence ? 'ready' : undefined}
          primary={`${auditEvidence?.summary.findingCount || 0} findings`}
          detail={`${highAuditFindings} high+ / ${auditEvidence?.summary.sourceCount || 0} sources`}
        />
        <EvidenceCard
          icon={<AuditOutlined />}
          title="Remediation"
          status={vulnerabilityRemediationPlan?.status}
          primary={`${vulnerabilityRemediationPlan?.summary.itemCount || 0} actions`}
          detail={`${vulnerabilityRemediationPlan?.summary.fixAvailableItemCount || 0} fixable items`}
        />
        <EvidenceCard
          icon={<SafetyCertificateOutlined />}
          title="Approvals"
          status={latestApproval?.decision}
          primary={`${releaseApprovals.length} records`}
          detail={latestApproval ? `${latestApproval.decision} by ${latestApproval.reviewer}` : 'not recorded'}
        />
        <EvidenceCard
          icon={<WarningOutlined />}
          title="Exceptions"
          status={activeExceptions > 0 ? 'warning' : latestException?.decision}
          primary={`${releaseExceptions.length} records`}
          detail={`${activeExceptions} active exceptions`}
        />
      </div>
    </div>
  )
}

interface EvidenceCardProps {
  icon: React.ReactNode
  title: string
  status?: string
  primary: string
  detail: string
}

const EvidenceCard: React.FC<EvidenceCardProps> = ({ icon, title, status, primary, detail }) => (
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
  if (status === 'ready' || status === 'success' || status === 'approved') return 'green'
  if (status === 'blocked' || status === 'failed' || status === 'rejected' || status === 'error') return 'red'
  if (status === 'warning' || status === 'cancelled' || status === 'revoked') return 'orange'
  return 'blue'
}

function statusLabel(status?: string): string {
  return status || 'not available'
}

export default EvidenceGovernanceOverview
