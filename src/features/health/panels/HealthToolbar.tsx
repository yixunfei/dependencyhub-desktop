import {
  ApartmentOutlined, CalendarOutlined, ExperimentOutlined, ExportOutlined, HistoryOutlined, ReloadOutlined,
  RollbackOutlined, SafetyCertificateOutlined, SettingOutlined, ToolOutlined, WarningOutlined
} from '@ant-design/icons'
import { Button, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'scanDetectedManagers' | 'scanning' | 'exportInventory' | 'exportSupplyChain' | 'reporting' |
  'exportLicenseCompliance' | 'exportThirdPartyNotices' | 'exportOperationHistory' |
  'refreshReportArtifactIndex' | 'exportReportArtifactIndex' | 'refreshFrameworkCoverage' |
  'exportFrameworkCoverage' | 'importCiEvidence' | 'recordManualCiEvidence' | 'exportCiEvidence' |
  'importAuditEvidence' | 'exportAuditEvidence' | 'exportVulnerabilityRemediationPlan' |
  'recordReleaseApproval' | 'exportReleaseApprovals' | 'recordReleaseException' | 'exportReleaseExceptions' |
  'checkRegistries' | 'exportRegistryReachability' | 'exportCredentialUsage' |
  'exportCredentialRotationPlan' | 'exportLockfileDrift' | 'exportRuntimePinning' |
  'exportOfflineCacheReadiness' | 'exportDependencyRollbackPlan' | 'exportDependencyImpactAnalysis' |
  'exportDependencyChangeApprovalPacket' | 'exportDependencyChangeCalendar' |
  'exportDependencyChangeExecutionRecord' | 'exportReleaseRiskProfile' | 'exportCiIntegrationPlan' |
  'exportDependencyAutomationPlan' | 'exportAutomationSafetyPlan' | 'exportDependencyOwnershipPlan' |
  'exportDependencyUpgradePlaybook' | 'exportPolicyAsCodePack' | 'scanWorkspaces' | 'exportWorkspaces' |
  'scanWorkspaceGovernance' | 'exportWorkspaceGovernance' | 'exportWorkspaceReleaseEvidence' |
  'exportRemediationPlan' | 'exportWorkspaceUpdatePlan' | 'exportWorkspaceSboms' | 'exportReleaseBundle' |
  'exportReleaseDashboard' | 'refreshReleaseProvenanceAttestation' | 'exportReleaseProvenanceAttestation' |
  'refreshReleaseIntegrityVerification' | 'exportReleaseIntegrityVerification' | 'refreshReleaseSignature' |
  'exportReleaseSignature' | 'refreshReleaseTrustPolicy' | 'exportReleaseTrustPolicy' |
  'exportDependencyHealthDashboard' | 'createSnapshot' | 'diffLatestSnapshot' | 'diffDependencyComponents' |
  'exportDependencyDiff' | 'restoreLatestSnapshot' | 'ensurePolicy' | 'setPolicyEditorOpen' | 'currentPath' |
  'evaluatePolicy' | 'runReadinessGate' | 'ensureReadinessPolicy' | 'setReadinessPolicyEditorOpen' |
  'exportReadiness' | 'navigate'
>

export function HealthToolbar(props: Props) {
  return (<div className={styles.toolbar}>
    <InventorySBOMActions {...props} />

    <EvidenceIntakeActions {...props} />

    <ReleaseDecisionsActions {...props} />

    <RegistryCredentialsActions {...props} />

    <ReproducibilityReportsActions {...props} />

    <AutomationOwnershipActions {...props} />

    <WorkspaceReleaseExportsActions {...props} />

    <SnapshotPoliciesActions {...props} />

    <NavigationActions {...props} />
  </div>)
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function InventorySBOMActions({ scanDetectedManagers, scanning, exportInventory, exportSupplyChain, reporting, exportLicenseCompliance, exportThirdPartyNotices, exportOperationHistory, refreshReportArtifactIndex, exportReportArtifactIndex, refreshFrameworkCoverage, exportFrameworkCoverage }: Pick<PanelValues,
  'scanDetectedManagers' | 'scanning' | 'exportInventory' | 'exportSupplyChain' | 'reporting' |
  'exportLicenseCompliance' | 'exportThirdPartyNotices' | 'exportOperationHistory' |
  'refreshReportArtifactIndex' | 'exportReportArtifactIndex' | 'refreshFrameworkCoverage' |
  'exportFrameworkCoverage'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <SafetyCertificateOutlined />
      <Text className={styles.toolGroupTitle}>Inventory & SBOM</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={scanDetectedManagers} loading={!!scanning}>
        扫描已识别生态
      </Button>
      <Button icon={<ExportOutlined />} onClick={exportInventory}>
        导出项目依赖清单
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportSupplyChain('cyclonedx')} loading={reporting}>
        CycloneDX SBOM
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportSupplyChain('spdx')} loading={reporting}>
        SPDX SBOM
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportSupplyChain('markdown')} loading={reporting}>
        Markdown 报告
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportLicenseCompliance('markdown')} loading={reporting}>
        License matrix
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportThirdPartyNotices('text')} loading={reporting}>
        Third-party notices
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportThirdPartyNotices('markdown')} loading={reporting}>
        Notices MD
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportThirdPartyNotices('json')} loading={reporting}>
        Notices JSON
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportOperationHistory('markdown')} loading={reporting}>
        导出操作历史
      </Button>
      <Button icon={<ReloadOutlined />} onClick={refreshReportArtifactIndex} loading={reporting}>
        Refresh reports
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReportArtifactIndex('markdown')} loading={reporting}>
        Report index
      </Button>
      <Button icon={<ReloadOutlined />} onClick={refreshFrameworkCoverage} loading={reporting}>
        Refresh coverage
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportFrameworkCoverage('markdown')} loading={reporting}>
        Framework coverage
      </Button>
    </div>
  </div>)
}

function EvidenceIntakeActions({ importCiEvidence, reporting, recordManualCiEvidence, exportCiEvidence, importAuditEvidence, exportAuditEvidence, exportVulnerabilityRemediationPlan }: Pick<PanelValues,
  'importCiEvidence' | 'reporting' | 'recordManualCiEvidence' | 'exportCiEvidence' | 'importAuditEvidence' |
  'exportAuditEvidence' | 'exportVulnerabilityRemediationPlan'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <HistoryOutlined />
      <Text className={styles.toolGroupTitle}>Evidence Intake</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button onClick={importCiEvidence} loading={reporting}>
        Import CI evidence
      </Button>
      <Button onClick={() => recordManualCiEvidence('success')} loading={reporting}>
        Record CI pass
      </Button>
      <Button danger onClick={() => recordManualCiEvidence('failed')} loading={reporting}>
        Record CI fail
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportCiEvidence('markdown')} loading={reporting}>
        Export CI
      </Button>
      <Button onClick={importAuditEvidence} loading={reporting}>
        Import audit
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportAuditEvidence('markdown')} loading={reporting}>
        Audit evidence
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportAuditEvidence('html')} loading={reporting}>
        Audit dashboard
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportVulnerabilityRemediationPlan('markdown')} loading={reporting}>
        Vulnerability remediation
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportVulnerabilityRemediationPlan('json')} loading={reporting}>
        Remediation JSON
      </Button>
    </div>
  </div>)
}

function ReleaseDecisionsActions({ recordReleaseApproval, reporting, exportReleaseApprovals, recordReleaseException, exportReleaseExceptions }: Pick<PanelValues,
  'recordReleaseApproval' | 'reporting' | 'exportReleaseApprovals' | 'recordReleaseException' |
  'exportReleaseExceptions'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <SafetyCertificateOutlined />
      <Text className={styles.toolGroupTitle}>Release Decisions</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button onClick={() => recordReleaseApproval('approved')} loading={reporting}>
        Approve release
      </Button>
      <Button danger onClick={() => recordReleaseApproval('rejected')} loading={reporting}>
        Reject release
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReleaseApprovals('markdown')} loading={reporting}>
        Export approvals
      </Button>
      <Button onClick={recordReleaseException} loading={reporting}>
        Approve exception
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReleaseExceptions('markdown')} loading={reporting}>
        Export exceptions
      </Button>
    </div>
  </div>)
}

function RegistryCredentialsActions({ checkRegistries, reporting, exportRegistryReachability, exportCredentialUsage, exportCredentialRotationPlan }: Pick<PanelValues,
  'checkRegistries' | 'reporting' | 'exportRegistryReachability' | 'exportCredentialUsage' |
  'exportCredentialRotationPlan'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <WarningOutlined />
      <Text className={styles.toolGroupTitle}>Registry & Credentials</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button onClick={checkRegistries} loading={reporting}>
        Check registries
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportRegistryReachability('markdown')} loading={reporting}>
        Export registries
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportCredentialUsage('markdown')} loading={reporting}>
        Credential map
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportCredentialRotationPlan('markdown')} loading={reporting}>
        Credential rotation
      </Button>
    </div>
  </div>)
}

function ReproducibilityReportsActions({ exportLockfileDrift, reporting, exportRuntimePinning, exportOfflineCacheReadiness, exportDependencyRollbackPlan, exportDependencyImpactAnalysis, exportDependencyChangeApprovalPacket, exportDependencyChangeCalendar, exportDependencyChangeExecutionRecord, exportReleaseRiskProfile }: Pick<PanelValues,
  'exportLockfileDrift' | 'reporting' | 'exportRuntimePinning' | 'exportOfflineCacheReadiness' |
  'exportDependencyRollbackPlan' | 'exportDependencyImpactAnalysis' |
  'exportDependencyChangeApprovalPacket' | 'exportDependencyChangeCalendar' |
  'exportDependencyChangeExecutionRecord' | 'exportReleaseRiskProfile'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <RollbackOutlined />
      <Text className={styles.toolGroupTitle}>Reproducibility Reports</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button icon={<ExportOutlined />} onClick={() => exportLockfileDrift('markdown')} loading={reporting}>
        Lock drift
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportRuntimePinning('markdown')} loading={reporting}>
        Runtime pins
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportOfflineCacheReadiness('markdown')} loading={reporting}>
        Offline cache
      </Button>
      <Button icon={<RollbackOutlined />} onClick={() => exportDependencyRollbackPlan('markdown')} loading={reporting}>
        Rollback plan
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyRollbackPlan('json')} loading={reporting}>
        Rollback JSON
      </Button>
      <Button icon={<ExperimentOutlined />} onClick={() => exportDependencyImpactAnalysis('markdown')} loading={reporting}>
        Impact analysis
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyImpactAnalysis('json')} loading={reporting}>
        Impact JSON
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={() => exportDependencyChangeApprovalPacket('markdown')} loading={reporting}>
        Approval packet
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyChangeApprovalPacket('json')} loading={reporting}>
        Approval JSON
      </Button>
      <Button icon={<CalendarOutlined />} onClick={() => exportDependencyChangeCalendar('markdown')} loading={reporting}>
        Change calendar
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyChangeCalendar('json')} loading={reporting}>
        Calendar JSON
      </Button>
      <Button icon={<CalendarOutlined />} onClick={() => exportDependencyChangeCalendar('ics')} loading={reporting}>
        Calendar ICS
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyChangeCalendar('github-actions')} loading={reporting}>
        Freeze gate
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyChangeCalendar('ticket-template')} loading={reporting}>
        Ticket template
      </Button>
      <Button icon={<HistoryOutlined />} onClick={() => exportDependencyChangeExecutionRecord('markdown')} loading={reporting}>
        Execution record
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyChangeExecutionRecord('json')} loading={reporting}>
        Execution JSON
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReleaseRiskProfile('markdown')} loading={reporting}>
        Risk profile
      </Button>
    </div>
  </div>)
}

function AutomationOwnershipActions({ exportCiIntegrationPlan, reporting, exportDependencyAutomationPlan, exportAutomationSafetyPlan, exportDependencyOwnershipPlan, exportDependencyUpgradePlaybook, exportPolicyAsCodePack }: Pick<PanelValues,
  'exportCiIntegrationPlan' | 'reporting' | 'exportDependencyAutomationPlan' | 'exportAutomationSafetyPlan' |
  'exportDependencyOwnershipPlan' | 'exportDependencyUpgradePlaybook' | 'exportPolicyAsCodePack'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <ExperimentOutlined />
      <Text className={styles.toolGroupTitle}>Automation & Ownership</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button icon={<ExportOutlined />} onClick={() => exportCiIntegrationPlan('markdown')} loading={reporting}>
        CI plan
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportCiIntegrationPlan('github-actions')} loading={reporting}>
        GitHub Actions
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyAutomationPlan('markdown')} loading={reporting}>
        Automation plan
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyAutomationPlan('dependabot')} loading={reporting}>
        Dependabot
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyAutomationPlan('renovate')} loading={reporting}>
        Renovate
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportAutomationSafetyPlan('markdown')} loading={reporting}>
        Automation safety
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyOwnershipPlan('markdown')} loading={reporting}>
        Ownership plan
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyOwnershipPlan('codeowners')} loading={reporting}>
        CODEOWNERS
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyUpgradePlaybook('markdown')} loading={reporting}>
        Upgrade playbook
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportDependencyUpgradePlaybook('json')} loading={reporting}>
        Playbook JSON
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportPolicyAsCodePack('markdown')} loading={reporting}>
        Policy pack
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportPolicyAsCodePack('policy-json')} loading={reporting}>
        Policy JSON
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportPolicyAsCodePack('github-actions')} loading={reporting}>
        Policy workflow
      </Button>
    </div>
  </div>)
}

function WorkspaceReleaseExportsActions({ scanWorkspaces, reporting, exportWorkspaces, scanWorkspaceGovernance, exportWorkspaceGovernance, exportWorkspaceReleaseEvidence, exportRemediationPlan, exportWorkspaceUpdatePlan, exportWorkspaceSboms, exportReleaseBundle, exportReleaseDashboard, refreshReleaseProvenanceAttestation, exportReleaseProvenanceAttestation, refreshReleaseIntegrityVerification, exportReleaseIntegrityVerification, refreshReleaseSignature, exportReleaseSignature, refreshReleaseTrustPolicy, exportReleaseTrustPolicy, exportDependencyHealthDashboard }: Pick<PanelValues,
  'scanWorkspaces' | 'reporting' | 'exportWorkspaces' | 'scanWorkspaceGovernance' |
  'exportWorkspaceGovernance' | 'exportWorkspaceReleaseEvidence' | 'exportRemediationPlan' |
  'exportWorkspaceUpdatePlan' | 'exportWorkspaceSboms' | 'exportReleaseBundle' | 'exportReleaseDashboard' |
  'refreshReleaseProvenanceAttestation' | 'exportReleaseProvenanceAttestation' |
  'refreshReleaseIntegrityVerification' | 'exportReleaseIntegrityVerification' | 'refreshReleaseSignature' |
  'exportReleaseSignature' | 'refreshReleaseTrustPolicy' | 'exportReleaseTrustPolicy' |
  'exportDependencyHealthDashboard'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <ApartmentOutlined />
      <Text className={styles.toolGroupTitle}>Workspace & Release Exports</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button icon={<ApartmentOutlined />} onClick={scanWorkspaces} loading={reporting}>
        Scan workspaces
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportWorkspaces('markdown')} loading={reporting}>
        Export workspaces
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={scanWorkspaceGovernance} loading={reporting}>
        Govern workspaces
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportWorkspaceGovernance('markdown')} loading={reporting}>
        Export governance
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportWorkspaceReleaseEvidence('markdown')} loading={reporting}>
        Export evidence
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportRemediationPlan('markdown')} loading={reporting}>
        Export actions
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportWorkspaceUpdatePlan('markdown')} loading={reporting}>
        Update plan
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportWorkspaceSboms('cyclonedx')} loading={reporting}>
        Export SBOMs
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportWorkspaceSboms('spdx')} loading={reporting}>
        Export SPDXs
      </Button>
      <Button icon={<ExportOutlined />} onClick={exportReleaseBundle} loading={reporting}>
        Export bundle
      </Button>
      <Button icon={<ExportOutlined />} onClick={exportReleaseDashboard} loading={reporting}>
        Review dashboard
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={refreshReleaseProvenanceAttestation} loading={reporting}>
        Release provenance
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReleaseProvenanceAttestation('json')} loading={reporting}>
        Provenance JSON
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={refreshReleaseIntegrityVerification} loading={reporting}>
        Verify integrity
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReleaseIntegrityVerification('json')} loading={reporting}>
        Integrity JSON
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={refreshReleaseSignature} loading={reporting}>
        Verify signature
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReleaseSignature('json')} loading={reporting}>
        Signature JSON
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={refreshReleaseTrustPolicy} loading={reporting}>
        Check trust
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReleaseTrustPolicy('json')} loading={reporting}>
        Trust JSON
      </Button>
      <Button icon={<ExportOutlined />} onClick={exportDependencyHealthDashboard} loading={reporting}>
        Dependency health dashboard
      </Button>
    </div>
  </div>)
}

function SnapshotPoliciesActions({ createSnapshot, reporting, diffLatestSnapshot, diffDependencyComponents, exportDependencyDiff, restoreLatestSnapshot, ensurePolicy, setPolicyEditorOpen, currentPath, evaluatePolicy, runReadinessGate, ensureReadinessPolicy, setReadinessPolicyEditorOpen, exportReadiness }: Pick<PanelValues,
  'createSnapshot' | 'reporting' | 'diffLatestSnapshot' | 'diffDependencyComponents' |
  'exportDependencyDiff' | 'restoreLatestSnapshot' | 'ensurePolicy' | 'setPolicyEditorOpen' | 'currentPath' |
  'evaluatePolicy' | 'runReadinessGate' | 'ensureReadinessPolicy' | 'setReadinessPolicyEditorOpen' |
  'exportReadiness'
>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <SettingOutlined />
      <Text className={styles.toolGroupTitle}>Snapshot & Policies</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button onClick={createSnapshot} loading={reporting}>
        创建清单快照
      </Button>
      <Button onClick={diffLatestSnapshot} loading={reporting}>
        对比最新快照
      </Button>
      <Button onClick={diffDependencyComponents} loading={reporting}>
        Dependency risk diff
      </Button>
      <Button icon={<ExportOutlined />} onClick={exportDependencyDiff} loading={reporting}>
        Export risk report
      </Button>
      <Button danger icon={<RollbackOutlined />} onClick={restoreLatestSnapshot} loading={reporting}>
        恢复最新快照
      </Button>
      <Button onClick={ensurePolicy} loading={reporting}>
        初始化策略
      </Button>
      <Button icon={<SettingOutlined />} onClick={() => setPolicyEditorOpen(true)} disabled={!currentPath}>
        编辑策略
      </Button>
      <Button onClick={evaluatePolicy} loading={reporting}>
        策略检查
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={runReadinessGate} loading={reporting}>
        Readiness gate
      </Button>
      <Button onClick={ensureReadinessPolicy} loading={reporting}>
        Init readiness policy
      </Button>
      <Button icon={<SettingOutlined />} onClick={() => setReadinessPolicyEditorOpen(true)} disabled={!currentPath}>
        Readiness policy
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => exportReadiness('markdown')} loading={reporting}>
        Export readiness
      </Button>
    </div>
  </div>)
}

function NavigationActions({ navigate }: Pick<PanelValues, 'navigate'>) {
  return (<div className={styles.toolGroup}>
    <div className={styles.toolGroupHeader}>
      <ToolOutlined />
      <Text className={styles.toolGroupTitle}>Navigation</Text>
    </div>
    <div className={styles.toolGroupActions}>
      <Button icon={<ToolOutlined />} onClick={() => navigate('/environment')}>
        环境与工具链
      </Button>
      <Button icon={<ExperimentOutlined />} onClick={() => navigate('/extended')}>
        扩展生态计划器
      </Button>
    </div>
  </div>)
}
