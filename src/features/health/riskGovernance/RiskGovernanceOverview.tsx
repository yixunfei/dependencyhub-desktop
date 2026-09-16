import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import {
  AuditOutlined,
  BranchesOutlined,
  ExperimentOutlined,
  FileProtectOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface RiskGovernanceOverviewProps {
  releaseRiskProfile: ReleaseRiskProfileReport | null
  dependencyDiff: DependencyComponentDiff | null
  auditEvidence: AuditEvidenceReport | null
  vulnerabilityRemediationPlan: VulnerabilityRemediationPlanReport | null
  licenseReport: LicenseComplianceReport | null
  registryReport: RegistryReachabilityReport | null
  credentialRotationPlan: CredentialRotationPlanReport | null
  readinessReport: ReadinessGateReport | null
  reportArtifactIndex: ReportArtifactIndexReport | null
}

interface RiskSummary {
  dependencyHigh: number
  dependencyMedium: number
  auditHigh: number
  auditMedium: number
  license: number
  registry: number
  credential: number
  readinessBlocked: number
  readinessWarning: number
  deployment: number
  reproducibility: number
  operations: number
  cockpitStatus: string
  totalSignals: number
}

const RiskGovernanceOverview: React.FC<RiskGovernanceOverviewProps> = (props) => {
  const summary = buildRiskSummary(props)
  const { releaseRiskProfile, reportArtifactIndex } = props

  return (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <WarningOutlined />
          <Text strong>Risk governance cockpit</Text>
          <Tag color={statusColor(summary.cockpitStatus)}>{summary.cockpitStatus}</Tag>
          <Tag>{releaseRiskProfile ? `${releaseRiskProfile.score}/100` : 'not scored'}</Tag>
          <Tag>{summary.totalSignals} key risk signals</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.risk || 0} risk reports</Tag>
          <Tag>{reportArtifactIndex?.summary.categoryCounts.security || 0} security reports</Tag>
        </Space>
        <Text type="secondary">Release risk, dependency deltas, vulnerabilities, licenses, registries, credentials, readiness, and deployment inputs</Text>
      </div>
      <RiskCardGrid {...props} summary={summary} />
    </div>
  )
}

function buildRiskSummary(props: RiskGovernanceOverviewProps): RiskSummary {
  const { releaseRiskProfile, dependencyDiff, auditEvidence, licenseReport, registryReport, credentialRotationPlan, readinessReport, vulnerabilityRemediationPlan } = props
  const dependencyHigh = dependencyDiff
    ? dependencyDiff.summary.criticalRisk + dependencyDiff.summary.highRisk
    : (releaseRiskProfile?.summary.dependencyCriticalRiskCount || 0) + (releaseRiskProfile?.summary.dependencyHighRiskCount || 0)
  const dependencyMedium = dependencyDiff?.summary.mediumRisk ?? releaseRiskProfile?.summary.dependencyMediumRiskCount ?? 0
  const auditHigh = auditEvidence
    ? auditEvidence.summary.critical + auditEvidence.summary.high
    : (releaseRiskProfile?.summary.auditCriticalFindingCount || 0) + (releaseRiskProfile?.summary.auditHighFindingCount || 0)
  const auditMedium = auditEvidence?.summary.medium ?? releaseRiskProfile?.summary.auditMediumFindingCount ?? 0
  const license = licenseReport
    ? licenseReport.summary.blockedLicenseComponentCount + licenseReport.summary.notAllowedLicenseComponentCount + (licenseReport.policy.requireKnownLicenses ? licenseReport.summary.unknownLicenseComponentCount : 0)
    : releaseRiskProfile?.summary.licenseRiskCount || 0
  const registry = registryReport
    ? registryReport.summary.unreachable + registryReport.summary.insecure
    : (releaseRiskProfile?.summary.unreachableRegistryCount || 0) + (releaseRiskProfile?.summary.insecureRegistryCount || 0)
  const credential = credentialRotationPlan
    ? credentialRotationPlan.summary.missingCredentialEndpointCount + credentialRotationPlan.summary.weakMatchEndpointCount + credentialRotationPlan.summary.insecureStorageCredentialCount + credentialRotationPlan.summary.staleCredentialCount
    : (releaseRiskProfile?.summary.missingCredentialEndpointCount || 0) + (releaseRiskProfile?.summary.weakCredentialMatchCount || 0) + (releaseRiskProfile?.summary.insecureCredentialCount || 0)
  const readinessBlocked = readinessReport ? readinessReport.checks.filter((check) => check.status === 'blocked').length : releaseRiskProfile?.summary.readinessBlockedCheckCount ?? 0
  const readinessWarning = readinessReport ? readinessReport.checks.filter((check) => check.status === 'warning').length : releaseRiskProfile?.summary.readinessWarningCheckCount ?? 0
  const deployment = (releaseRiskProfile?.summary.floatingDeploymentRefCount ?? readinessReport?.summary.floatingDeploymentRefCount ?? 0) + (releaseRiskProfile?.summary.missingDeploymentBaselineCount ?? readinessReport?.summary.missingDeploymentBaselineCount ?? 0)
  const reproducibility = (releaseRiskProfile?.summary.lockfileDriftFindingCount ?? readinessReport?.summary.lockfileDriftFindingCount ?? 0) + (releaseRiskProfile?.summary.runtimePinningFindingCount ?? readinessReport?.summary.runtimePinningFindingCount ?? 0) + (releaseRiskProfile?.summary.offlineCacheFindingCount ?? 0)
  const operations = releaseRiskProfile?.summary.failedMutatingOperationCount ?? releaseRiskProfile?.summary.failedOperationCount ?? readinessReport?.summary.failedOperationCount ?? 0
  const blocked = dependencyHigh > 0 || auditHigh > 0 || readinessBlocked > 0 || vulnerabilityRemediationPlan?.status === 'blocked' || releaseRiskProfile?.status === 'blocked' || readinessReport?.status === 'blocked'
  const warning = dependencyMedium > 0 || auditMedium > 0 || license > 0 || registry > 0 || credential > 0 || readinessWarning > 0 || deployment > 0 || reproducibility > 0 || operations > 0 || vulnerabilityRemediationPlan?.status === 'warning' || releaseRiskProfile?.status === 'warning' || readinessReport?.status === 'warning'
  const cockpitStatus = aggregateStatus(Boolean(releaseRiskProfile || dependencyDiff || auditEvidence || vulnerabilityRemediationPlan || licenseReport || registryReport || credentialRotationPlan || readinessReport), blocked, warning)
  return { dependencyHigh, dependencyMedium, auditHigh, auditMedium, license, registry, credential, readinessBlocked, readinessWarning, deployment, reproducibility, operations, cockpitStatus, totalSignals: dependencyHigh + auditHigh + license + registry + credential + readinessBlocked + deployment + reproducibility + operations }
}

interface RiskCardGridProps extends RiskGovernanceOverviewProps { summary: RiskSummary }

const RiskCardGrid: React.FC<RiskCardGridProps> = ({ summary, ...props }) => {
  const { releaseRiskProfile, dependencyDiff, auditEvidence, vulnerabilityRemediationPlan, licenseReport, registryReport, credentialRotationPlan, readinessReport } = props
  return (
    <div className={styles.cards}>
      <RiskCard icon={<WarningOutlined />} title="Release risk" status={releaseRiskProfile?.status} primary={releaseRiskProfile ? `${releaseRiskProfile.summary.critical + releaseRiskProfile.summary.high} high+ findings` : 'not profiled'} detail={`${releaseRiskProfile?.summary.topRiskCount || 0} top risks / ${releaseRiskProfile?.summary.categoryCount || 0} categories / ${releaseRiskProfile?.summary.sourceErrorCount || 0} source errors`} />
      <RiskCard icon={<BranchesOutlined />} title="Dependency changes" status={riskStatus(summary.dependencyHigh, summary.dependencyMedium, Boolean(dependencyDiff))} primary={`${summary.dependencyHigh} high+ risks`} detail={`${dependencyDiff?.summary.added || 0} added / ${dependencyDiff?.summary.updated || 0} updated / ${dependencyDiff?.summary.majorUpdates || 0} major`} />
      <RiskCard icon={<AuditOutlined />} title="Vulnerabilities" status={riskStatus(summary.auditHigh, summary.auditMedium, Boolean(auditEvidence))} primary={`${summary.auditHigh} high+ findings`} detail={`${auditEvidence?.summary.findingCount || releaseRiskProfile?.summary.auditEvidenceFindingCount || 0} findings / ${auditEvidence?.summary.fixAvailableCount || releaseRiskProfile?.summary.auditFixAvailableCount || 0} fixes available`} />
      <RiskCard icon={<ToolOutlined />} title="Remediation" status={vulnerabilityRemediationPlan?.status} primary={`${vulnerabilityRemediationPlan?.summary.itemCount || 0} actions`} detail={`${vulnerabilityRemediationPlan?.summary.immediateItemCount || 0} immediate / ${vulnerabilityRemediationPlan?.summary.commandCount || 0} commands`} />
      <RiskCard icon={<FileProtectOutlined />} title="License risk" status={summary.license > 0 ? 'warning' : licenseReport ? 'ready' : undefined} primary={`${summary.license} license risks`} detail={`${licenseReport?.summary.blockedLicenseComponentCount || releaseRiskProfile?.summary.licenseRiskCount || 0} blocked/not allowed / ${licenseReport?.summary.unknownLicenseComponentCount || 0} unknown`} />
      <RiskCard icon={<GlobalOutlined />} title="Registry and credentials" status={summary.registry + summary.credential > 0 ? 'warning' : registryReport || credentialRotationPlan ? 'ready' : undefined} primary={`${summary.registry + summary.credential} access risks`} detail={`${registryReport?.summary.unreachable || releaseRiskProfile?.summary.unreachableRegistryCount || 0} unreachable / ${credentialRotationPlan?.summary.missingCredentialEndpointCount || releaseRiskProfile?.summary.missingCredentialEndpointCount || 0} missing credentials`} />
      <RiskCard icon={<SafetyCertificateOutlined />} title="Readiness gates" status={readinessReport?.status || releaseRiskProfile?.summary.readinessStatus} primary={`${summary.readinessBlocked} blocked gates`} detail={`${summary.readinessWarning} warning gates / ${readinessReport ? `${readinessReport.score}/100` : releaseRiskProfile?.summary.readinessScore ? `${releaseRiskProfile.summary.readinessScore}/100` : 'not gated'}`} />
      <RiskCard icon={<ExperimentOutlined />} title="Runtime and deployment" status={summary.deployment + summary.reproducibility + summary.operations > 0 ? 'warning' : releaseRiskProfile || readinessReport ? 'ready' : undefined} primary={`${summary.deployment + summary.reproducibility + summary.operations} operational risks`} detail={`${summary.deployment} deploy gaps / ${summary.reproducibility} reproducibility / ${summary.operations} failed ops`} />
    </div>
  )
}

interface RiskCardProps { icon: React.ReactNode; title: string; status?: string; primary: string; detail: string }

const RiskCard: React.FC<RiskCardProps> = ({ icon, title, status, primary, detail }) => (
  <Card className={styles.metricCard} variant="borderless">
    <Space orientation="vertical" size={6}><Space wrap>{icon}<Text type="secondary">{title}</Text><Tag color={statusColor(status)}>{status || 'not available'}</Tag></Space><Text strong>{primary}</Text><Text type="secondary">{detail}</Text></Space>
  </Card>
)

function riskStatus(blockedCount: number, warningCount: number, hasReport: boolean): string | undefined {
  if (blockedCount > 0) return 'blocked'
  if (warningCount > 0) return 'warning'
  return hasReport ? 'ready' : undefined
}

function aggregateStatus(hasReport: boolean, blocked: boolean, warning: boolean): string {
  if (blocked) return 'blocked'
  if (warning) return 'warning'
  return hasReport ? 'ready' : 'not scored'
}

function statusColor(status?: string): string {
  if (!status || status === 'not scored') return 'default'
  if (status === 'ready' || status === 'passed' || status === 'success') return 'green'
  if (status === 'blocked' || status === 'failed' || status === 'error') return 'red'
  if (status === 'warning' || status === 'needs review' || status === 'needs-review') return 'orange'
  return 'blue'
}

export default RiskGovernanceOverview
