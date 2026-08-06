import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import {
  CheckCircleOutlined,
  FileProtectOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface PolicyGovernanceOverviewProps {
  readinessReport: ReadinessGateReport | null
  policyEvaluation: DependencyPolicyEvaluation | null
  licenseReport: LicenseComplianceReport | null
  thirdPartyNotices: ThirdPartyNoticesReport | null
  policyAsCodePack: PolicyAsCodeReport | null
  registryEndpoints: RegistryEndpoint[]
  registryReport: RegistryReachabilityReport | null
  credentialRotationPlan: CredentialRotationPlanReport | null
  reportArtifactIndex: ReportArtifactIndexReport | null
}

const PolicyGovernanceOverview: React.FC<PolicyGovernanceOverviewProps> = ({
  readinessReport,
  policyEvaluation,
  licenseReport,
  thirdPartyNotices,
  policyAsCodePack,
  registryEndpoints,
  registryReport,
  credentialRotationPlan,
  reportArtifactIndex
}) => {
  const policyViolationCount = policyEvaluation?.violationCount ?? readinessReport?.summary.policyViolationCount ?? 0
  const licenseRiskCount = licenseReport
    ? licenseReport.summary.blockedLicenseComponentCount
      + licenseReport.summary.notAllowedLicenseComponentCount
      + (licenseReport.policy.requireKnownLicenses ? licenseReport.summary.unknownLicenseComponentCount : 0)
    : 0
  const noticePolicyFindings = thirdPartyNotices?.summary.policyViolationCount || 0
  const registryEndpointCount = registryReport?.summary.endpointCount ?? registryEndpoints.length
  const registryFailureCount = registryReport?.summary.unreachable ?? readinessReport?.summary.unreachableRegistryCount ?? 0
  const registryInsecureCount = registryReport?.summary.insecure ?? readinessReport?.summary.insecureRegistryCount ?? 0
  const credentialMissingCount = credentialRotationPlan?.summary.missingCredentialEndpointCount ?? readinessReport?.summary.missingCredentialEndpointCount ?? 0
  const credentialWarningCount = credentialRotationPlan
    ? credentialRotationPlan.summary.weakMatchEndpointCount
      + credentialRotationPlan.summary.insecureStorageCredentialCount
      + credentialRotationPlan.summary.staleCredentialCount
      + credentialRotationPlan.summary.unusedCredentialCount
    : (readinessReport?.summary.weakCredentialMatchCount || 0)
      + (readinessReport?.summary.insecureCredentialStorageEndpointCount || 0)
      + (readinessReport?.summary.unusedCredentialCount || 0)
  const blocked = readinessReport?.status === 'blocked' || policyAsCodePack?.status === 'blocked'
  const warning = policyViolationCount > 0 || licenseRiskCount > 0 || noticePolicyFindings > 0 || registryFailureCount > 0 || credentialMissingCount > 0

  return (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SettingOutlined />
          <Text strong>Policy governance cockpit</Text>
          <Tag color={blocked ? 'red' : warning ? 'orange' : 'green'}>
            {blocked ? 'blocked' : warning ? 'needs review' : 'ready'}
          </Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.policy || 0} policy reports</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.security || 0} security reports</Tag>
        </Space>
        <Text type="secondary">Policy, license, notice, registry, and credential governance</Text>
      </div>

      <div className={styles.cards}>
        <PolicyCard
          icon={<CheckCircleOutlined />}
          title="Readiness policy"
          status={readinessReport?.status}
          primary={readinessReport ? `${readinessReport.score}/100` : 'not gated'}
          detail={`${readinessReport?.summary.missingToolCount || 0}/${readinessReport?.summary.requiredToolCount || 0} missing tools`}
        />
        <PolicyCard
          icon={<SettingOutlined />}
          title="Dependency policy"
          status={policyViolationCount > 0 ? 'warning' : policyEvaluation ? 'ready' : undefined}
          primary={`${policyViolationCount} violations`}
          detail={`${policyEvaluation?.componentCount || readinessReport?.summary.componentCount || 0} components evaluated`}
        />
        <PolicyCard
          icon={<FileProtectOutlined />}
          title="License compliance"
          status={licenseRiskCount > 0 ? 'blocked' : licenseReport ? 'ready' : undefined}
          primary={`${licenseRiskCount} license risks`}
          detail={`${licenseReport?.summary.licenseCount || 0} licenses / ${licenseReport?.summary.unknownLicenseComponentCount || 0} unknown`}
        />
        <PolicyCard
          icon={<FileProtectOutlined />}
          title="Third-party notices"
          status={noticePolicyFindings > 0 ? 'warning' : thirdPartyNotices ? 'ready' : undefined}
          primary={`${thirdPartyNotices?.summary.noticeCount || 0} notices`}
          detail={`${noticePolicyFindings} policy findings`}
        />
        <PolicyCard
          icon={<SafetyCertificateOutlined />}
          title="Policy-as-code"
          status={policyAsCodePack?.status}
          primary={`${policyAsCodePack?.summary.dependencyPolicyRuleCount || 0} rules`}
          detail={`${policyAsCodePack?.summary.deploymentPolicyGateCount || 0} deployment gates / ${policyAsCodePack?.summary.requiredArtifactCount || 0} artifacts`}
        />
        <PolicyCard
          icon={<ToolOutlined />}
          title="Registries"
          status={registryFailureCount > 0 ? 'blocked' : registryInsecureCount > 0 ? 'warning' : registryReport ? 'ready' : undefined}
          primary={`${registryEndpointCount} endpoints`}
          detail={`${registryFailureCount} unreachable / ${registryInsecureCount} insecure`}
        />
        <PolicyCard
          icon={<WarningOutlined />}
          title="Credentials"
          status={credentialRotationPlan?.status || (credentialMissingCount > 0 ? 'warning' : undefined)}
          primary={`${credentialMissingCount} missing`}
          detail={`${credentialWarningCount} rotation or storage warnings`}
        />
      </div>
    </div>
  )
}

interface PolicyCardProps {
  icon: React.ReactNode
  title: string
  status?: string
  primary: string
  detail: string
}

const PolicyCard: React.FC<PolicyCardProps> = ({ icon, title, status, primary, detail }) => (
  <Card className={styles.metricCard} variant="borderless">
    <Space direction="vertical" size={6}>
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

export default PolicyGovernanceOverview
