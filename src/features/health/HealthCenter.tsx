import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import {
  ApartmentOutlined,
  CalendarOutlined,
  ExperimentOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { getImplementedManagerDefinitions, type ImplementedPackageManagerId } from '../../domain/managers/registry'
import { managerColor, managerIcon } from '../../domain/managers/presentation'
import DependencyPolicyEditor from '../../features/policies/DependencyPolicyEditor'
import ReadinessPolicyEditor from '../../features/policies/ReadinessPolicyEditor'
import { AutomationGovernanceOverview, CiIntegrationPlanPanel } from './automationGovernance'
import { WorkflowSectionHeader, WorkflowSectionNav } from './components'
import { EvidenceGovernanceOverview } from './evidenceGovernance'
import { PolicyGovernanceOverview } from './policyGovernance'
import { ReproducibilityGovernanceOverview } from './reproducibilityGovernance'
import { ReleaseGovernanceOverview } from './releaseGovernance'
import { RiskGovernanceOverview } from './riskGovernance'
import type { HealthWorkflowSectionId } from './workflows'
import { WorkspaceGovernanceOverview } from './workspaceGovernance'
import styles from './HealthCenter.module.css'

const { Paragraph, Text, Title } = Typography

const REPORT_ARTIFACT_CATEGORY_OPTIONS: Array<{ value: 'all' | ReportArtifactCategory; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'release', label: 'Release' },
  { value: 'risk', label: 'Risk' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'automation', label: 'Automation' },
  { value: 'policy', label: 'Policy' },
  { value: 'security', label: 'Security' },
  { value: 'reproducibility', label: 'Reproducibility' },
  { value: 'operations', label: 'Operations' },
  { value: 'other', label: 'Other' }
]

const REPORT_ARTIFACT_FORMAT_OPTIONS: Array<{ value: 'all' | ReportArtifactFormat; label: string }> = [
  { value: 'all', label: 'All formats' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'text', label: 'Text' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'codeowners', label: 'CODEOWNERS' },
  { value: 'sbom', label: 'SBOM' },
  { value: 'unknown', label: 'Unknown' }
]

type ScanState = Record<string, DependencyHealthScanResult | { error: string }>

const HealthCenter: React.FC = () => {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([])
  const [plugins, setPlugins] = useState<PackageManagerPlugin[]>([])
  const [scans, setScans] = useState<ScanState>({})
  const [supplyChainReport, setSupplyChainReport] = useState<SupplyChainReport | null>(null)
  const [licenseReport, setLicenseReport] = useState<LicenseComplianceReport | null>(null)
  const [thirdPartyNotices, setThirdPartyNotices] = useState<ThirdPartyNoticesReport | null>(null)
  const [snapshots, setSnapshots] = useState<SupplyChainSnapshotSummary[]>([])
  const [operationHistory, setOperationHistory] = useState<OperationHistoryRecord[]>([])
  const [ciEvidence, setCiEvidence] = useState<CiEvidenceRecord[]>([])
  const [auditEvidence, setAuditEvidence] = useState<AuditEvidenceReport | null>(null)
  const [vulnerabilityRemediationPlan, setVulnerabilityRemediationPlan] = useState<VulnerabilityRemediationPlanReport | null>(null)
  const [releaseApprovals, setReleaseApprovals] = useState<ReleaseApprovalRecord[]>([])
  const [releaseExceptions, setReleaseExceptions] = useState<ReleaseExceptionRecord[]>([])
  const [registryEndpoints, setRegistryEndpoints] = useState<RegistryEndpoint[]>([])
  const [registryReport, setRegistryReport] = useState<RegistryReachabilityReport | null>(null)
  const [workspaceReport, setWorkspaceReport] = useState<WorkspaceDiscoveryReport | null>(null)
  const [workspaceGovernanceReport, setWorkspaceGovernanceReport] = useState<WorkspaceGovernanceReport | null>(null)
  const [readinessReport, setReadinessReport] = useState<ReadinessGateReport | null>(null)
  const [offlineCacheReport, setOfflineCacheReport] = useState<OfflineCacheReadinessReport | null>(null)
  const [releaseRiskProfile, setReleaseRiskProfile] = useState<ReleaseRiskProfileReport | null>(null)
  const [ciIntegrationPlan, setCiIntegrationPlan] = useState<CiIntegrationPlanReport | null>(null)
  const [dependencyAutomationPlan, setDependencyAutomationPlan] = useState<DependencyAutomationPlanReport | null>(null)
  const [credentialRotationPlan, setCredentialRotationPlan] = useState<CredentialRotationPlanReport | null>(null)
  const [automationSafetyPlan, setAutomationSafetyPlan] = useState<AutomationSafetyPlanReport | null>(null)
  const [dependencyOwnershipPlan, setDependencyOwnershipPlan] = useState<DependencyOwnershipPlanReport | null>(null)
  const [dependencyUpgradePlaybook, setDependencyUpgradePlaybook] = useState<DependencyUpgradePlaybookReport | null>(null)
  const [dependencyRollbackPlan, setDependencyRollbackPlan] = useState<DependencyRollbackPlanReport | null>(null)
  const [dependencyImpactAnalysis, setDependencyImpactAnalysis] = useState<DependencyImpactAnalysisReport | null>(null)
  const [dependencyChangeApprovalPacket, setDependencyChangeApprovalPacket] = useState<DependencyChangeApprovalPacketReport | null>(null)
  const [dependencyChangeCalendar, setDependencyChangeCalendar] = useState<DependencyChangeCalendarReport | null>(null)
  const [dependencyChangeExecutionRecord, setDependencyChangeExecutionRecord] = useState<DependencyChangeExecutionReport | null>(null)
  const [policyAsCodePack, setPolicyAsCodePack] = useState<PolicyAsCodeReport | null>(null)
  const [reportArtifactIndex, setReportArtifactIndex] = useState<ReportArtifactIndexReport | null>(null)
  const [releaseEvidenceCompleteness, setReleaseEvidenceCompleteness] = useState<ReleaseEvidenceCompletenessReport | null>(null)
  const [releaseProvenanceAttestation, setReleaseProvenanceAttestation] = useState<ReleaseProvenanceAttestationReport | null>(null)
  const [releaseIntegrityVerification, setReleaseIntegrityVerification] = useState<ReleaseIntegrityVerificationReport | null>(null)
  const [releaseSignature, setReleaseSignature] = useState<ReleaseSignatureReport | null>(null)
  const [releaseTrustPolicy, setReleaseTrustPolicy] = useState<ReleaseTrustPolicyReport | null>(null)
  const [frameworkCoverage, setFrameworkCoverage] = useState<FrameworkCoverageReport | null>(null)
  const [snapshotDiff, setSnapshotDiff] = useState<SupplyChainSnapshotDiff | null>(null)
  const [dependencyDiff, setDependencyDiff] = useState<DependencyComponentDiff | null>(null)
  const [policyEvaluation, setPolicyEvaluation] = useState<DependencyPolicyEvaluation | null>(null)
  const [policyEditorOpen, setPolicyEditorOpen] = useState(false)
  const [readinessPolicyEditorOpen, setReadinessPolicyEditorOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState<string>('')
  const [reporting, setReporting] = useState(false)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | OperationHistoryStatus>('all')
  const [historyManagerFilter, setHistoryManagerFilter] = useState<string>('all')
  const [historyChangeFilter, setHistoryChangeFilter] = useState<'all' | 'mutating' | 'readonly'>('all')
  const [artifactCategoryFilter, setArtifactCategoryFilter] = useState<'all' | ReportArtifactCategory>('all')
  const [artifactFormatFilter, setArtifactFormatFilter] = useState<'all' | ReportArtifactFormat>('all')
  const [artifactSearchTerm, setArtifactSearchTerm] = useState('')

  const managers = useMemo(() => getImplementedManagerDefinitions(), [])
  const detectedIds = useMemo(() => {
    return new Set(
      projectInfo?.detectedManagers
        .filter((manager) => manager.detected && manager.implemented)
        .map((manager) => manager.id) || []
    )
  }, [projectInfo])
  const extendedDetectedCount = useMemo(() => {
    return projectInfo?.detectedManagers.filter((manager) => manager.detected && !manager.implemented).length || 0
  }, [projectInfo])
  const unknownLicenseCount = useMemo(() => {
    return supplyChainReport?.components.filter((component) => !component.license).length || 0
  }, [supplyChainReport])
  const licenseRows = useMemo(() => licenseReport?.licenses || [], [licenseReport])
  const thirdPartyNoticeRows = useMemo(() => thirdPartyNotices?.entries || [], [thirdPartyNotices])
  const licenseRiskCount = useMemo(() => {
    if (!licenseReport) return 0
    return licenseReport.summary.blockedLicenseComponentCount
      + licenseReport.summary.notAllowedLicenseComponentCount
      + (licenseReport.policy.requireKnownLicenses ? licenseReport.summary.unknownLicenseComponentCount : 0)
  }, [licenseReport])
  const toolStatusMap = useMemo(() => new Map(toolStatuses.map((status) => [status.tool, status])), [toolStatuses])
  const pluginMap = useMemo(() => new Map(plugins.map((plugin) => [plugin.id, plugin])), [plugins])
  const recentSnapshots = useMemo(() => snapshots.slice(0, 6), [snapshots])
  const filteredOperations = useMemo(() => {
    return operationHistory.filter((record) => {
      const classification = record.classification
      const managerId = classification?.managerId || classification?.tool || 'unknown'
      if (historyStatusFilter !== 'all' && record.status !== historyStatusFilter) return false
      if (historyManagerFilter !== 'all' && managerId !== historyManagerFilter) return false
      if (historyChangeFilter === 'mutating' && !classification?.mutating) return false
      if (historyChangeFilter === 'readonly' && classification?.mutating) return false
      return true
    })
  }, [historyChangeFilter, historyManagerFilter, historyStatusFilter, operationHistory])
  const recentOperations = useMemo(() => filteredOperations.slice(0, 8), [filteredOperations])
  const recentCiEvidence = useMemo(() => ciEvidence.slice(0, 6), [ciEvidence])
  const latestCiEvidence = recentCiEvidence[0]
  const auditEvidenceFindings = useMemo(() => auditEvidence?.findings.slice(0, 10) || [], [auditEvidence])
  const vulnerabilityRemediationRows = useMemo(() => vulnerabilityRemediationPlan?.items.slice(0, 12) || [], [vulnerabilityRemediationPlan])
  const recentReleaseApprovals = useMemo(() => releaseApprovals.slice(0, 6), [releaseApprovals])
  const latestReleaseApproval = recentReleaseApprovals[0]
  const recentReleaseExceptions = useMemo(() => releaseExceptions.slice(0, 6), [releaseExceptions])
  const latestReleaseException = recentReleaseExceptions[0]
  const registryRows = useMemo(() => registryReport?.results || registryEndpoints, [registryEndpoints, registryReport])
  const workspaceRows = useMemo(() => workspaceReport?.workspaces || [], [workspaceReport])
  const workspaceGovernanceRows = useMemo(() => workspaceGovernanceReport?.workspaces || [], [workspaceGovernanceReport])
  const dependencyDiffRows = useMemo(() => {
    if (!dependencyDiff) return []
    const changed = dependencyDiff.changes.filter((change) => change.kind !== 'unchanged')
    return changed.length > 0 ? changed : dependencyDiff.changes.slice(0, 8)
  }, [dependencyDiff])
  const dependencyHighRiskCount = useMemo(() => {
    if (!dependencyDiff) return 0
    return dependencyDiff.summary.criticalRisk + dependencyDiff.summary.highRisk
  }, [dependencyDiff])
  const readinessRows = useMemo(() => {
    if (!readinessReport) return []
    const findings = readinessReport.checks.filter((check) => check.status === 'blocked' || check.status === 'warning')
    return findings.length > 0 ? findings : readinessReport.checks
  }, [readinessReport])
  const releaseRiskRows = useMemo(() => releaseRiskProfile?.topRisks || [], [releaseRiskProfile])
  const dependencyAutomationWarnings = useMemo(() => dependencyAutomationPlan?.warnings.slice(0, 8) || [], [dependencyAutomationPlan])
  const credentialRotationActions = useMemo(() => credentialRotationPlan?.actions.slice(0, 10) || [], [credentialRotationPlan])
  const automationSafetyFindings = useMemo(() => automationSafetyPlan?.findings.slice(0, 10) || [], [automationSafetyPlan])
  const dependencyOwnershipFindings = useMemo(() => dependencyOwnershipPlan?.findings.slice(0, 10) || [], [dependencyOwnershipPlan])
  const dependencyUpgradeLanes = useMemo(() => dependencyUpgradePlaybook?.lanes || [], [dependencyUpgradePlaybook])
  const dependencyUpgradeItems = useMemo(() => {
    if (!dependencyUpgradePlaybook) return []
    const findings = dependencyUpgradePlaybook.items.filter((item) => item.status === 'blocked' || item.priority === 'immediate')
    return (findings.length > 0 ? findings : dependencyUpgradePlaybook.items).slice(0, 16)
  }, [dependencyUpgradePlaybook])
  const dependencyRollbackItems = useMemo(() => {
    if (!dependencyRollbackPlan) return []
    const findings = dependencyRollbackPlan.items.filter((item) => item.status === 'blocked' || item.priority === 'required')
    return (findings.length > 0 ? findings : dependencyRollbackPlan.items).slice(0, 16)
  }, [dependencyRollbackPlan])
  const dependencyImpactItems = useMemo(() => {
    if (!dependencyImpactAnalysis) return []
    const findings = dependencyImpactAnalysis.items.filter((item) => item.status === 'blocked' || item.severity === 'critical' || item.severity === 'high')
    return (findings.length > 0 ? findings : dependencyImpactAnalysis.items).slice(0, 16)
  }, [dependencyImpactAnalysis])
  const dependencyApprovalChecklist = useMemo(() => dependencyChangeApprovalPacket?.checklist || [], [dependencyChangeApprovalPacket])
  const dependencyApprovalScopeItems = useMemo(() => {
    if (!dependencyChangeApprovalPacket) return []
    const findings = dependencyChangeApprovalPacket.scope.filter((item) => item.status === 'blocked' || item.severity === 'critical' || item.severity === 'high')
    return (findings.length > 0 ? findings : dependencyChangeApprovalPacket.scope).slice(0, 16)
  }, [dependencyChangeApprovalPacket])
  const dependencyFreezeWindows = useMemo(() => dependencyChangeCalendar?.freezeWindows || [], [dependencyChangeCalendar])
  const dependencyChangeWindows = useMemo(() => {
    if (!dependencyChangeCalendar) return []
    const findings = dependencyChangeCalendar.windows.filter((item) => item.status === 'blocked' || item.status === 'frozen' || item.status === 'needs-review')
    return (findings.length > 0 ? findings : dependencyChangeCalendar.windows).slice(0, 16)
  }, [dependencyChangeCalendar])
  const dependencyExecutionRecords = useMemo(() => {
    if (!dependencyChangeExecutionRecord) return []
    const findings = dependencyChangeExecutionRecord.records.filter((item) => item.status !== 'completed' || item.gaps.length > 0)
    return (findings.length > 0 ? findings : dependencyChangeExecutionRecord.records).slice(0, 16)
  }, [dependencyChangeExecutionRecord])
  const policyAsCodeFindings = useMemo(() => policyAsCodePack?.findings.slice(0, 10) || [], [policyAsCodePack])
  const releaseEvidenceFindings = useMemo(() => releaseEvidenceCompleteness?.findings.slice(0, 10) || [], [releaseEvidenceCompleteness])
  const releaseEvidenceExpectedRows = useMemo(() => {
    if (!releaseEvidenceCompleteness) return []
    const findings = releaseEvidenceCompleteness.expectedArtifacts.filter((artifact) => artifact.status !== 'present')
    return (findings.length > 0 ? findings : releaseEvidenceCompleteness.expectedArtifacts).slice(0, 16)
  }, [releaseEvidenceCompleteness])
  const releaseProvenanceArtifactRows = useMemo(() => releaseProvenanceAttestation?.artifacts.slice(0, 12) || [], [releaseProvenanceAttestation])
  const releaseIntegrityArtifactRows = useMemo(() => {
    if (!releaseIntegrityVerification) return []
    const findings = releaseIntegrityVerification.artifacts.filter((artifact) => artifact.status !== 'verified' || artifact.provenanceStatus === 'mismatch')
    return (findings.length > 0 ? findings : releaseIntegrityVerification.artifacts).slice(0, 14)
  }, [releaseIntegrityVerification])
  const releaseIntegrityFindings = useMemo(() => releaseIntegrityVerification?.findings.slice(0, 10) || [], [releaseIntegrityVerification])
  const releaseSignatureSourceRows = useMemo(() => {
    if (!releaseSignature) return []
    const findings = releaseSignature.sources.filter((source) => source.status !== 'included' || source.reportStatus === 'blocked')
    return (findings.length > 0 ? findings : releaseSignature.sources).slice(0, 8)
  }, [releaseSignature])
  const releaseSignatureFindings = useMemo(() => releaseSignature?.findings.slice(0, 10) || [], [releaseSignature])
  const releaseTrustPolicyRows = useMemo(() => {
    if (!releaseTrustPolicy) return []
    const findings = releaseTrustPolicy.checks.filter((item) => item.status === 'blocked' || item.status === 'warning')
    return (findings.length > 0 ? findings : releaseTrustPolicy.checks).slice(0, 12)
  }, [releaseTrustPolicy])
  const policyDeploymentGateRows = useMemo(() => {
    return policyAsCodePack?.pack.enforcement.deploymentPolicyGates
      .slice(0, 12)
      .map((gate, index) => ({ id: `deployment-gate:${index}`, gate })) || []
  }, [policyAsCodePack])
  const policyRequiredArtifactRows = useMemo(() => {
    return policyAsCodePack?.pack.ci.requiredArtifacts
      .map((artifact, index) => ({ id: `artifact:${index}`, artifact })) || []
  }, [policyAsCodePack])
  const reportArtifactRows = useMemo(() => {
    const search = artifactSearchTerm.trim().toLowerCase()
    return (reportArtifactIndex?.artifacts || []).filter((artifact) => {
      if (artifactCategoryFilter !== 'all' && artifact.category !== artifactCategoryFilter) return false
      if (artifactFormatFilter !== 'all' && artifact.format !== artifactFormatFilter) return false
      if (!search) return true
      return [
        artifact.name,
        artifact.relativePath,
        artifact.category,
        artifact.format,
        artifact.sha256
      ].some((value) => value.toLowerCase().includes(search))
    })
  }, [artifactCategoryFilter, artifactFormatFilter, artifactSearchTerm, reportArtifactIndex])
  const frameworkCoverageRows = useMemo(() => frameworkCoverage?.managers || [], [frameworkCoverage])
  const operationStats = useMemo(() => ({
    errors: operationHistory.filter((record) => record.status === 'error').length,
    mutating: operationHistory.filter((record) => record.classification?.mutating).length
  }), [operationHistory])
  const operationManagerOptions = useMemo(() => {
    const managers = Array.from(new Set(operationHistory.map((record) => (
      record.classification?.managerId || record.classification?.tool || 'unknown'
    )))).sort()
    return [
      { value: 'all', label: '全部工具' },
      ...managers.map((manager) => ({ value: manager, label: manager }))
    ]
  }, [operationHistory])

  useEffect(() => {
    void loadOverview()
  }, [currentPath])

  const chooseDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setCurrentPath(path)
    addNotification({ type: 'info', message: '项目路径已切换', description: path })
  }

  const loadOverview = async () => {
    setLoading(true)
    try {
      const [tools, catalog, detected, coverage] = await Promise.all([
        window.electronAPI.system.checkTools(),
        window.electronAPI.plugins.catalog(currentPath || undefined),
        currentPath ? window.electronAPI.project.detect(currentPath) : Promise.resolve(null),
        window.electronAPI.frameworkCoverage.report(currentPath || undefined)
      ])
      setToolStatuses(tools)
      setPlugins(catalog)
      setProjectInfo(detected)
      setFrameworkCoverage(coverage)
      if (currentPath) {
        const [report, licenseCompliance, thirdPartyNoticeReport, snapshotList, history, ciRecords, auditReport, vulnerabilityPlan, approvalRecords, exceptionRecords, registryDiscovered, workspaces, workspaceGovernance, readiness, componentDiff, offlineCache, riskProfile, ciPlan, automationPlan, rotationPlan, safetyPlan, ownershipPlan, upgradePlaybook, rollbackPlan, impactAnalysis, approvalPacket, changeCalendar, executionRecord, policyPack, reportArtifacts, evidenceCompleteness, provenanceAttestation, integrityVerification, signatureReport, trustPolicy] = await Promise.all([
          window.electronAPI.supplyChain.report(currentPath),
          window.electronAPI.supplyChain.licenseReport(currentPath).catch(() => null),
          window.electronAPI.thirdPartyNotices.report(currentPath).catch(() => null),
          window.electronAPI.supplyChain.listSnapshots(currentPath),
          window.electronAPI.operationHistory.list(currentPath, 80),
          window.electronAPI.ciEvidence.list(currentPath, 50),
          window.electronAPI.auditEvidence.report(currentPath).catch(() => null),
          window.electronAPI.vulnerabilityRemediationPlan.plan(currentPath).catch(() => null),
          window.electronAPI.releaseApproval.list(currentPath, 50),
          window.electronAPI.releaseException.list(currentPath, 50),
          window.electronAPI.registryReachability.discover(currentPath),
          window.electronAPI.workspaceDiscovery.report(currentPath).catch(() => null),
          window.electronAPI.workspaceGovernance.report(currentPath).catch(() => null),
          window.electronAPI.readiness.report(currentPath).catch(() => null),
          window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(currentPath).catch(() => null),
          window.electronAPI.offlineCacheReadiness.report(currentPath).catch(() => null),
          window.electronAPI.releaseRiskProfile.report(currentPath).catch(() => null),
          window.electronAPI.ciIntegrationPlan.plan(currentPath).catch(() => null),
          window.electronAPI.dependencyAutomationPlan.plan(currentPath).catch(() => null),
          window.electronAPI.credentialRotationPlan.plan(currentPath).catch(() => null),
          window.electronAPI.automationSafetyPlan.plan(currentPath).catch(() => null),
          window.electronAPI.dependencyOwnershipPlan.plan(currentPath).catch(() => null),
          window.electronAPI.dependencyUpgradePlaybook.report(currentPath).catch(() => null),
          window.electronAPI.dependencyRollbackPlan.report(currentPath).catch(() => null),
          window.electronAPI.dependencyImpactAnalysis.report(currentPath).catch(() => null),
          window.electronAPI.dependencyChangeApprovalPacket.report(currentPath).catch(() => null),
          window.electronAPI.dependencyChangeCalendar.report(currentPath).catch(() => null),
          window.electronAPI.dependencyChangeExecutionRecord.report(currentPath).catch(() => null),
          window.electronAPI.policyAsCodePack.report(currentPath).catch(() => null),
          window.electronAPI.reportArtifacts.report(currentPath).catch(() => null),
          window.electronAPI.releaseEvidenceCompleteness.report(currentPath).catch(() => null),
          window.electronAPI.releaseProvenanceAttestation.report(currentPath).catch(() => null),
          window.electronAPI.releaseIntegrityVerification.report(currentPath).catch(() => null),
          window.electronAPI.releaseSignature.report(currentPath).catch(() => null),
          window.electronAPI.releaseTrustPolicy.report(currentPath).catch(() => null)
        ])
        setSupplyChainReport(report)
        setLicenseReport(licenseCompliance)
        setThirdPartyNotices(thirdPartyNoticeReport)
        setSnapshots(snapshotList)
        setOperationHistory(history)
        setCiEvidence(ciRecords)
        setAuditEvidence(auditReport)
        setVulnerabilityRemediationPlan(vulnerabilityPlan)
        setReleaseApprovals(approvalRecords)
        setReleaseExceptions(exceptionRecords)
        setRegistryEndpoints(registryDiscovered)
        setRegistryReport(null)
        setWorkspaceReport(workspaces)
        setWorkspaceGovernanceReport(workspaceGovernance)
        setReadinessReport(readiness)
        setDependencyDiff(componentDiff)
        setOfflineCacheReport(offlineCache)
        setReleaseRiskProfile(riskProfile)
        setCiIntegrationPlan(ciPlan)
        setDependencyAutomationPlan(automationPlan)
        setCredentialRotationPlan(rotationPlan)
        setAutomationSafetyPlan(safetyPlan)
        setDependencyOwnershipPlan(ownershipPlan)
        setDependencyUpgradePlaybook(upgradePlaybook)
        setDependencyRollbackPlan(rollbackPlan)
        setDependencyImpactAnalysis(impactAnalysis)
        setDependencyChangeApprovalPacket(approvalPacket)
        setDependencyChangeCalendar(changeCalendar)
        setDependencyChangeExecutionRecord(executionRecord)
        setPolicyAsCodePack(policyPack)
        setReportArtifactIndex(reportArtifacts)
        setReleaseEvidenceCompleteness(evidenceCompleteness)
        setReleaseProvenanceAttestation(provenanceAttestation)
        setReleaseIntegrityVerification(integrityVerification)
        setReleaseSignature(signatureReport)
        setReleaseTrustPolicy(trustPolicy)
      } else {
        setSupplyChainReport(null)
        setLicenseReport(null)
        setThirdPartyNotices(null)
        setSnapshots([])
        setOperationHistory([])
        setCiEvidence([])
        setAuditEvidence(null)
        setVulnerabilityRemediationPlan(null)
        setReleaseApprovals([])
        setReleaseExceptions([])
        setRegistryEndpoints([])
        setRegistryReport(null)
        setWorkspaceReport(null)
        setWorkspaceGovernanceReport(null)
        setReadinessReport(null)
        setOfflineCacheReport(null)
        setReleaseRiskProfile(null)
        setCiIntegrationPlan(null)
        setDependencyAutomationPlan(null)
        setCredentialRotationPlan(null)
        setAutomationSafetyPlan(null)
        setDependencyOwnershipPlan(null)
        setDependencyUpgradePlaybook(null)
        setDependencyRollbackPlan(null)
        setDependencyImpactAnalysis(null)
        setDependencyChangeApprovalPacket(null)
        setDependencyChangeCalendar(null)
        setDependencyChangeExecutionRecord(null)
        setPolicyAsCodePack(null)
        setReportArtifactIndex(null)
        setReleaseEvidenceCompleteness(null)
        setReleaseProvenanceAttestation(null)
        setReleaseIntegrityVerification(null)
        setReleaseSignature(null)
        setReleaseTrustPolicy(null)
        setDependencyDiff(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const scanManager = async (managerId: ImplementedPackageManagerId) => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setScanning(managerId)
    try {
      const result = await window.electronAPI.dependencyHealth.scan(managerId as PackageManagerId, currentPath)
      setScans((prev) => ({ ...prev, [managerId]: result }))
    } catch (error: any) {
      setScans((prev) => ({ ...prev, [managerId]: { error: error.message || String(error) } }))
    } finally {
      setScanning('')
    }
  }

  const scanDetectedManagers = async () => {
    const targets = managers.filter((manager) => detectedIds.has(manager.id))
    if (targets.length === 0) {
      addNotification({ type: 'info', message: '当前目录未识别到可扫描的依赖生态' })
      return
    }

    for (const manager of targets) {
      await scanManager(manager.id)
    }
  }

  const exportInventory = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    try {
      const filePath = await window.electronAPI.project.exportInventory(currentPath)
      addNotification({
        type: 'success',
        message: '依赖清单已导出',
        description: filePath
      })
      await window.electronAPI.system.openFile(filePath)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '导出依赖清单失败',
        description: error.message
      })
    }
  }

  const exportSupplyChain = async (format: SupplyChainExportResult['format']) => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'cyclonedx'
        ? await window.electronAPI.supplyChain.exportCycloneDx(currentPath)
        : format === 'spdx'
          ? await window.electronAPI.supplyChain.exportSpdx(currentPath)
          : await window.electronAPI.supplyChain.exportMarkdown(currentPath)
      addNotification({
        type: 'success',
        message: '供应链报告已导出',
        description: `${result.format}: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setSupplyChainReport(await window.electronAPI.supplyChain.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '导出供应链报告失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportLicenseCompliance = async (format: LicenseComplianceExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.supplyChain.exportLicenseJson(currentPath)
        : await window.electronAPI.supplyChain.exportLicenseMarkdown(currentPath)
      addNotification({
        type: result.summary.policyViolationComponentCount > 0 ? 'warning' : 'success',
        message: 'License compliance matrix exported',
        description: `${result.licenseCount} license value(s), ${result.summary.policyViolationComponentCount} policy finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setLicenseReport(await window.electronAPI.supplyChain.licenseReport(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'License compliance export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportThirdPartyNotices = async (format: ThirdPartyNoticeFormat = 'text') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.thirdPartyNotices.exportJson(currentPath)
        : format === 'markdown'
          ? await window.electronAPI.thirdPartyNotices.exportMarkdown(currentPath)
          : await window.electronAPI.thirdPartyNotices.exportText(currentPath)
      addNotification({
        type: result.summary.policyViolationCount > 0 ? 'warning' : 'success',
        message: 'Third-party notices exported',
        description: `${result.noticeCount} notice(s), ${result.summary.unknownLicenseComponentCount} unknown license(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [noticeReport, artifacts] = await Promise.all([
        window.electronAPI.thirdPartyNotices.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setThirdPartyNotices(noticeReport)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Third-party notice export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportOperationHistory = async (format: OperationHistoryExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.operationHistory.exportReport(currentPath, format)
      addNotification({
        type: 'success',
        message: '操作历史已导出',
        description: `${result.count} 条记录：${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setOperationHistory(await window.electronAPI.operationHistory.list(currentPath, 80))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '导出操作历史失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const importCiEvidence = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    const filePath = await window.electronAPI.selectFile({
      title: 'Select CI evidence report',
      filters: [
        { name: 'CI reports', extensions: ['json', 'xml'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (!filePath) return

    setReporting(true)
    try {
      const result = await window.electronAPI.ciEvidence.importFromFile(currentPath, filePath)
      addNotification({
        type: result.summary.failed > 0 ? 'warning' : 'success',
        message: 'CI evidence imported',
        description: `${result.records.length} record(s): ${filePath}`
      })
      setCiEvidence(await window.electronAPI.ciEvidence.list(currentPath, 50))
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'CI evidence import failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const recordManualCiEvidence = async (status: CiEvidenceStatus) => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const record = await window.electronAPI.ciEvidence.record(currentPath, {
        source: 'manual',
        provider: 'manual',
        workflow: 'Manual release verification',
        status,
        finishedAt: new Date().toISOString(),
        summary: status === 'success'
          ? 'Manual verification recorded as passed'
          : 'Manual verification recorded as failed'
      })
      addNotification({
        type: status === 'success' ? 'success' : 'warning',
        message: 'CI evidence recorded',
        description: `${record.status}: ${record.workflow}`
      })
      setCiEvidence(await window.electronAPI.ciEvidence.list(currentPath, 50))
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'CI evidence record failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportCiEvidence = async (format: CiEvidenceExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.ciEvidence.exportJson(currentPath)
        : await window.electronAPI.ciEvidence.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.failed > 0 ? 'warning' : 'success',
        message: 'CI evidence report exported',
        description: `${result.count} record(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setCiEvidence(await window.electronAPI.ciEvidence.list(currentPath, 50))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'CI evidence export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const recordReleaseApproval = async (decision: ReleaseApprovalDecision) => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const record = await window.electronAPI.releaseApproval.record(currentPath, {
        reviewer: 'local-reviewer',
        decision,
        scope: 'release',
        decidedAt: new Date().toISOString(),
        summary: decision === 'approved'
          ? 'Local reviewer approved this dependency release gate'
          : 'Local reviewer rejected this dependency release gate'
      })
      addNotification({
        type: decision === 'approved' ? 'success' : 'warning',
        message: 'Release approval recorded',
        description: `${record.decision}: ${record.reviewer}`
      })
      setReleaseApprovals(await window.electronAPI.releaseApproval.list(currentPath, 50))
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release approval record failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseApprovals = async (format: ReleaseApprovalExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseApproval.exportJson(currentPath)
        : await window.electronAPI.releaseApproval.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.rejected > 0 ? 'warning' : 'success',
        message: 'Release approval report exported',
        description: `${result.count} record(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setReleaseApprovals(await window.electronAPI.releaseApproval.list(currentPath, 50))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release approval export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const recordReleaseException = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    const targetChecks = readinessRows
      .filter((check) => check.status === 'blocked' || check.status === 'warning')
      .map((check) => check.id)
    if (targetChecks.length === 0) {
      addNotification({
        type: 'info',
        message: 'No blocked or warning readiness checks need an exception'
      })
      return
    }

    setReporting(true)
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const record = await window.electronAPI.releaseException.record(currentPath, {
        reviewer: 'local-reviewer',
        reason: 'Temporary reviewed exception for current readiness findings',
        scope: 'policy-exception',
        checkIds: targetChecks,
        decidedAt: new Date().toISOString(),
        expiresAt,
        annotations: ['Generated from Health Center readiness findings']
      })
      addNotification({
        type: 'warning',
        message: 'Release exception recorded',
        description: `${record.checkIds.length} check(s), expires ${new Date(record.expiresAt || expiresAt).toLocaleString()}`
      })
      setReleaseExceptions(await window.electronAPI.releaseException.list(currentPath, 50))
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release exception record failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseExceptions = async (format: ReleaseExceptionExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseException.exportJson(currentPath)
        : await window.electronAPI.releaseException.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.active > 0 ? 'warning' : 'success',
        message: 'Release exception report exported',
        description: `${result.summary.active} active / ${result.count} record(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setReleaseExceptions(await window.electronAPI.releaseException.list(currentPath, 50))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release exception export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const checkRegistries = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.registryReachability.check(currentPath)
      setRegistryReport(result)
      setRegistryEndpoints(result.endpoints)
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
      addNotification({
        type: result.summary.unreachable > 0 ? 'warning' : 'success',
        message: 'Registry reachability checked',
        description: `${result.summary.reachable}/${result.summary.endpointCount} reachable; ${result.summary.unreachable} unreachable`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Registry reachability check failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportRegistryReachability = async (format: RegistryReachabilityExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.registryReachability.exportJson(currentPath)
        : await window.electronAPI.registryReachability.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.unreachable > 0 ? 'warning' : 'success',
        message: 'Registry reachability report exported',
        description: `${result.summary.endpointCount} endpoint(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const refreshed = await window.electronAPI.registryReachability.check(currentPath)
      setRegistryReport(refreshed)
      setRegistryEndpoints(refreshed.endpoints)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Registry reachability export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const importAuditEvidence = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    const filePath = await window.electronAPI.selectFile({
      title: 'Select audit evidence report',
      filters: [
        { name: 'Audit reports', extensions: ['json', 'sarif'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (!filePath) return

    setReporting(true)
    try {
      const result = await window.electronAPI.auditEvidence.importFromFile(currentPath, filePath)
      addNotification({
        type: result.summary.critical + result.summary.high > 0 ? 'warning' : 'success',
        message: 'Audit evidence imported',
        description: `${result.findings.length} finding(s): ${filePath}`
      })
      const [auditReport, remediationPlan] = await Promise.all([
        window.electronAPI.auditEvidence.report(currentPath),
        window.electronAPI.vulnerabilityRemediationPlan.plan(currentPath).catch(() => null)
      ])
      setAuditEvidence(auditReport)
      setVulnerabilityRemediationPlan(remediationPlan)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Audit evidence import failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportAuditEvidence = async (format: AuditEvidenceExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.auditEvidence.exportJson(currentPath)
        : format === 'html'
          ? await window.electronAPI.auditEvidence.exportHtml(currentPath)
          : await window.electronAPI.auditEvidence.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.critical + result.summary.high > 0 ? 'warning' : 'success',
        message: 'Audit evidence report exported',
        description: `${result.count} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [auditReport, remediationPlan] = await Promise.all([
        window.electronAPI.auditEvidence.report(currentPath),
        window.electronAPI.vulnerabilityRemediationPlan.plan(currentPath).catch(() => null)
      ])
      setAuditEvidence(auditReport)
      setVulnerabilityRemediationPlan(remediationPlan)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Audit evidence export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportVulnerabilityRemediationPlan = async (format: VulnerabilityRemediationPlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.vulnerabilityRemediationPlan.exportJson(currentPath)
        : await window.electronAPI.vulnerabilityRemediationPlan.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Vulnerability remediation plan exported',
        description: `${result.itemCount} action(s), ${result.findingCount} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [plan, artifacts] = await Promise.all([
        window.electronAPI.vulnerabilityRemediationPlan.plan(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setVulnerabilityRemediationPlan(plan)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Vulnerability remediation export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportCredentialUsage = async (format: CredentialUsageExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.credentialUsage.exportJson(currentPath)
        : await window.electronAPI.credentialUsage.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.missingCredentialEndpointCount > 0 || result.summary.insecureStorageEndpointCount > 0 ? 'warning' : 'success',
        message: 'Credential usage map exported',
        description: `${result.summary.endpointCount} endpoint(s), ${result.summary.missingCredentialEndpointCount} missing credential(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Credential usage map export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportLockfileDrift = async (format: LockfileDriftExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.lockfileDrift.exportJson(currentPath)
        : await window.electronAPI.lockfileDrift.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.blocked > 0 ? 'warning' : 'success',
        message: 'Lockfile drift report exported',
        description: `${result.summary.workspaceCount} workspace(s), ${result.summary.findingCount} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Lockfile drift export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportRuntimePinning = async (format: RuntimePinningExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.runtimePinning.exportJson(currentPath)
        : await window.electronAPI.runtimePinning.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.blocked > 0 || result.summary.warning > 0 ? 'warning' : 'success',
        message: 'Runtime pinning report exported',
        description: `${result.summary.workspaceCount} workspace(s), ${result.summary.findingCount} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Runtime pinning export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportOfflineCacheReadiness = async (format: OfflineCacheReadinessExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.offlineCacheReadiness.exportJson(currentPath)
        : await window.electronAPI.offlineCacheReadiness.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.blocked > 0 ? 'error' : result.summary.warning > 0 ? 'warning' : 'success',
        message: 'Offline cache readiness exported',
        description: `${result.summary.workspaceCount} workspace(s), ${result.summary.findingCount} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setOfflineCacheReport(await window.electronAPI.offlineCacheReadiness.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Offline cache readiness export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseRiskProfile = async (format: ReleaseRiskProfileExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseRiskProfile.exportJson(currentPath)
        : await window.electronAPI.releaseRiskProfile.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release risk profile exported',
        description: `${result.score}/100, ${result.findingCount} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setReleaseRiskProfile(await window.electronAPI.releaseRiskProfile.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release risk profile export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportCiIntegrationPlan = async (format: CiIntegrationPlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.ciIntegrationPlan.exportJson(currentPath)
        : format === 'github-actions'
          ? await window.electronAPI.ciIntegrationPlan.exportGithubActions(currentPath)
          : await window.electronAPI.ciIntegrationPlan.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: format === 'github-actions' ? 'GitHub Actions workflow exported' : 'CI integration plan exported',
        description: `${result.summary.jobCount} job(s), ${result.summary.matrixEntryCount} workspace target(s), ${result.warningCount} warning(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setCiIntegrationPlan(await window.electronAPI.ciIntegrationPlan.plan(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'CI integration plan export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyAutomationPlan = async (format: DependencyAutomationPlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyAutomationPlan.exportJson(currentPath)
        : format === 'dependabot'
          ? await window.electronAPI.dependencyAutomationPlan.exportDependabot(currentPath)
          : format === 'renovate'
            ? await window.electronAPI.dependencyAutomationPlan.exportRenovate(currentPath)
            : await window.electronAPI.dependencyAutomationPlan.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: format === 'dependabot' ? 'Dependabot config exported' : format === 'renovate' ? 'Renovate config exported' : 'Dependency automation plan exported',
        description: `${result.summary.dependabotTargetCount} Dependabot target(s), ${result.summary.renovateTargetCount} Renovate target(s), ${result.warningCount} warning(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setDependencyAutomationPlan(await window.electronAPI.dependencyAutomationPlan.plan(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency automation export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportCredentialRotationPlan = async (format: CredentialRotationPlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.credentialRotationPlan.exportJson(currentPath)
        : await window.electronAPI.credentialRotationPlan.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Credential rotation plan exported',
        description: `${result.summary.credentialCount} credential(s), ${result.actionCount} action(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setCredentialRotationPlan(await window.electronAPI.credentialRotationPlan.plan(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Credential rotation export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportAutomationSafetyPlan = async (format: AutomationSafetyPlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.automationSafetyPlan.exportJson(currentPath)
        : await window.electronAPI.automationSafetyPlan.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Automation safety plan exported',
        description: `${result.ruleCount} rule(s), ${result.findingCount} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setAutomationSafetyPlan(await window.electronAPI.automationSafetyPlan.plan(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Automation safety export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyOwnershipPlan = async (format: DependencyOwnershipPlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyOwnershipPlan.exportJson(currentPath)
        : format === 'codeowners'
          ? await window.electronAPI.dependencyOwnershipPlan.exportCodeowners(currentPath)
          : await window.electronAPI.dependencyOwnershipPlan.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: format === 'codeowners' ? 'Suggested CODEOWNERS exported' : 'Dependency ownership plan exported',
        description: `${result.assignmentCount} assignment(s), ${result.missingOwnerAssignmentCount} missing owner(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setDependencyOwnershipPlan(await window.electronAPI.dependencyOwnershipPlan.plan(currentPath))
      setDependencyUpgradePlaybook(await window.electronAPI.dependencyUpgradePlaybook.report(currentPath).catch(() => null))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency ownership export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyUpgradePlaybook = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyUpgradePlaybook.exportJson(currentPath)
        : await window.electronAPI.dependencyUpgradePlaybook.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Dependency upgrade playbook exported',
        description: `${result.itemCount} item(s), ${result.laneCount} lane(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [playbook, artifacts] = await Promise.all([
        window.electronAPI.dependencyUpgradePlaybook.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setDependencyUpgradePlaybook(playbook)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency upgrade playbook export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyRollbackPlan = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyRollbackPlan.exportJson(currentPath)
        : await window.electronAPI.dependencyRollbackPlan.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Dependency rollback plan exported',
        description: `${result.itemCount} item(s), ${result.blockedItemCount} blocked: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [rollbackPlan, artifacts] = await Promise.all([
        window.electronAPI.dependencyRollbackPlan.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setDependencyRollbackPlan(rollbackPlan)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency rollback plan export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyImpactAnalysis = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyImpactAnalysis.exportJson(currentPath)
        : await window.electronAPI.dependencyImpactAnalysis.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Dependency impact analysis exported',
        description: `${result.itemCount} item(s), ${result.summary.releaseGateImpactCount} release gate impact(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [impactAnalysis, artifacts] = await Promise.all([
        window.electronAPI.dependencyImpactAnalysis.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setDependencyImpactAnalysis(impactAnalysis)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency impact analysis export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyChangeApprovalPacket = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyChangeApprovalPacket.exportJson(currentPath)
        : await window.electronAPI.dependencyChangeApprovalPacket.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Dependency change approval packet exported',
        description: `${result.decision}, ${result.checklistCount} check(s), ${result.scopeItemCount} scope item(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [approvalPacket, artifacts] = await Promise.all([
        window.electronAPI.dependencyChangeApprovalPacket.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setDependencyChangeApprovalPacket(approvalPacket)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency change approval packet export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyChangeCalendar = async (format: DependencyChangeCalendarExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyChangeCalendar.exportJson(currentPath)
        : format === 'ics'
          ? await window.electronAPI.dependencyChangeCalendar.exportIcs(currentPath)
          : format === 'github-actions'
            ? await window.electronAPI.dependencyChangeCalendar.exportFreezeGate(currentPath)
            : format === 'ticket-template'
              ? await window.electronAPI.dependencyChangeCalendar.exportTicketTemplate(currentPath)
              : await window.electronAPI.dependencyChangeCalendar.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Dependency change calendar exported',
        description: `${result.windowCount} window(s), ${result.freezeWindowCount} freeze window(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [changeCalendar, artifacts] = await Promise.all([
        window.electronAPI.dependencyChangeCalendar.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setDependencyChangeCalendar(changeCalendar)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency change calendar export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyChangeExecutionRecord = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.dependencyChangeExecutionRecord.exportJson(currentPath)
        : await window.electronAPI.dependencyChangeExecutionRecord.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Dependency change execution record exported',
        description: `${result.recordCount} execution record(s), ${result.summary.missingOperationEvidenceCount} missing operation evidence: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [executionRecord, artifacts] = await Promise.all([
        window.electronAPI.dependencyChangeExecutionRecord.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setDependencyChangeExecutionRecord(executionRecord)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency change execution record export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportPolicyAsCodePack = async (format: PolicyAsCodeExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.policyAsCodePack.exportJson(currentPath)
        : format === 'policy-json'
          ? await window.electronAPI.policyAsCodePack.exportPolicyJson(currentPath)
          : format === 'github-actions'
            ? await window.electronAPI.policyAsCodePack.exportGithubActions(currentPath)
            : await window.electronAPI.policyAsCodePack.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: format === 'github-actions' ? 'Policy workflow exported' : format === 'policy-json' ? 'Governance policy JSON exported' : 'Policy-as-code pack exported',
        description: `${result.summary.dependencyPolicyRuleCount} policy rule(s), ${result.summary.readinessGateCount} gate(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setPolicyAsCodePack(await window.electronAPI.policyAsCodePack.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Policy-as-code export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const scanWorkspaces = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.workspaceDiscovery.report(currentPath)
      setWorkspaceReport(result)
      addNotification({
        type: result.summary.workspaceCount > 1 ? 'success' : 'info',
        message: 'Workspace discovery completed',
        description: `${result.summary.workspaceCount} workspace(s), ${result.summary.managerCount} manager(s)`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Workspace discovery failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportWorkspaces = async (format: WorkspaceDiscoveryExportResult['format'] = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.workspaceDiscovery.exportJson(currentPath)
        : await window.electronAPI.workspaceDiscovery.exportMarkdown(currentPath)
      addNotification({
        type: 'success',
        message: 'Workspace discovery report exported',
        description: `${result.workspaceCount} workspace(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setWorkspaceReport(await window.electronAPI.workspaceDiscovery.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Workspace export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const scanWorkspaceGovernance = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.workspaceGovernance.report(currentPath)
      setWorkspaceGovernanceReport(result)
      setWorkspaceReport(result.discovery)
      addNotification({
        type: result.summary.blocked > 0 ? 'error' : result.summary.warning > 0 ? 'warning' : 'success',
        message: 'Workspace governance completed',
        description: `${result.summary.ready} ready, ${result.summary.warning} warning, ${result.summary.blocked} blocked`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Workspace governance failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportWorkspaceGovernance = async (format: WorkspaceGovernanceExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.workspaceGovernance.exportJson(currentPath)
        : await window.electronAPI.workspaceGovernance.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.blocked > 0 ? 'warning' : 'success',
        message: 'Workspace governance report exported',
        description: `${result.workspaceCount} workspace(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const refreshed = await window.electronAPI.workspaceGovernance.report(currentPath)
      setWorkspaceGovernanceReport(refreshed)
      setWorkspaceReport(refreshed.discovery)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Workspace governance export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportWorkspaceReleaseEvidence = async (format: WorkspaceReleaseEvidenceExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.workspaceGovernance.exportEvidenceJson(currentPath)
        : await window.electronAPI.workspaceGovernance.exportEvidenceMarkdown(currentPath)
      addNotification({
        type: result.summary.blocked > 0 ? 'warning' : 'success',
        message: 'Workspace release evidence exported',
        description: `${result.workspaceCount} workspace(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const refreshed = await window.electronAPI.workspaceGovernance.report(currentPath)
      setWorkspaceGovernanceReport(refreshed)
      setWorkspaceReport(refreshed.discovery)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Workspace release evidence export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportRemediationPlan = async (format: WorkspaceRemediationPlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.workspaceGovernance.exportRemediationJson(currentPath)
        : await window.electronAPI.workspaceGovernance.exportRemediationMarkdown(currentPath)
      addNotification({
        type: result.summary.critical + result.summary.high > 0 ? 'warning' : 'success',
        message: 'Remediation plan exported',
        description: `${result.itemCount} action item(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const refreshed = await window.electronAPI.workspaceGovernance.report(currentPath)
      setWorkspaceGovernanceReport(refreshed)
      setWorkspaceReport(refreshed.discovery)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Remediation plan export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportWorkspaceUpdatePlan = async (format: WorkspaceUpdatePlanExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.workspaceGovernance.exportUpdatePlanJson(currentPath)
        : await window.electronAPI.workspaceGovernance.exportUpdatePlanMarkdown(currentPath)
      addNotification({
        type: result.summary.blocked > 0 || result.summary.highRisk > 0 ? 'warning' : 'success',
        message: 'Workspace dependency update plan exported',
        description: `${result.itemCount} manager plan(s), ${result.summary.mutatingCommandCount} mutating command(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const refreshed = await window.electronAPI.workspaceGovernance.report(currentPath)
      setWorkspaceGovernanceReport(refreshed)
      setWorkspaceReport(refreshed.discovery)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Workspace dependency update plan export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportWorkspaceSboms = async (format: WorkspaceSbomExportFormat = 'cyclonedx') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.workspaceGovernance.exportWorkspaceSboms(currentPath, format)
      addNotification({
        type: result.componentCount > 0 ? 'success' : 'warning',
        message: 'Workspace SBOMs exported',
        description: `${result.workspaceCount} workspace(s), ${result.componentCount} component(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const refreshed = await window.electronAPI.workspaceGovernance.report(currentPath)
      setWorkspaceGovernanceReport(refreshed)
      setWorkspaceReport(refreshed.discovery)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Workspace SBOM export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseBundle = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.workspaceGovernance.exportReleaseBundle(currentPath)
      addNotification({
        type: result.summary.requiredFailedArtifactCount > 0 ? 'error' : result.failedArtifactCount > 0 ? 'warning' : 'success',
        message: 'Release bundle exported',
        description: `${result.artifactCount} artifact(s), ${result.failedArtifactCount} failed: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.markdownPath || result.path)
      const [refreshed, artifacts, evidenceCompleteness, provenanceAttestation, integrityVerification, signatureReport, trustPolicy] = await Promise.all([
        window.electronAPI.workspaceGovernance.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null),
        window.electronAPI.releaseEvidenceCompleteness.report(currentPath).catch(() => null),
        window.electronAPI.releaseProvenanceAttestation.report(currentPath).catch(() => null),
        window.electronAPI.releaseIntegrityVerification.report(currentPath).catch(() => null),
        window.electronAPI.releaseSignature.report(currentPath).catch(() => null),
        window.electronAPI.releaseTrustPolicy.report(currentPath).catch(() => null)
      ])
      setWorkspaceGovernanceReport(refreshed)
      setWorkspaceReport(refreshed.discovery)
      if (artifacts) setReportArtifactIndex(artifacts)
      if (evidenceCompleteness) setReleaseEvidenceCompleteness(evidenceCompleteness)
      if (provenanceAttestation) setReleaseProvenanceAttestation(provenanceAttestation)
      if (integrityVerification) setReleaseIntegrityVerification(integrityVerification)
      if (signatureReport) setReleaseSignature(signatureReport)
      if (trustPolicy) setReleaseTrustPolicy(trustPolicy)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release bundle export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseDashboard = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.workspaceGovernance.exportReleaseDashboard(currentPath)
      addNotification({
        type: result.summary.requiredFailedArtifactCount > 0 ? 'error' : result.failedArtifactCount > 0 ? 'warning' : 'success',
        message: 'Release review dashboard exported',
        description: `${result.artifactCount} artifact(s), ${result.failedArtifactCount} failed: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [refreshed, artifacts, evidenceCompleteness, provenanceAttestation, integrityVerification, signatureReport, trustPolicy] = await Promise.all([
        window.electronAPI.workspaceGovernance.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null),
        window.electronAPI.releaseEvidenceCompleteness.report(currentPath).catch(() => null),
        window.electronAPI.releaseProvenanceAttestation.report(currentPath).catch(() => null),
        window.electronAPI.releaseIntegrityVerification.report(currentPath).catch(() => null),
        window.electronAPI.releaseSignature.report(currentPath).catch(() => null),
        window.electronAPI.releaseTrustPolicy.report(currentPath).catch(() => null)
      ])
      setWorkspaceGovernanceReport(refreshed)
      setWorkspaceReport(refreshed.discovery)
      if (artifacts) setReportArtifactIndex(artifacts)
      if (evidenceCompleteness) setReleaseEvidenceCompleteness(evidenceCompleteness)
      if (provenanceAttestation) setReleaseProvenanceAttestation(provenanceAttestation)
      if (integrityVerification) setReleaseIntegrityVerification(integrityVerification)
      if (signatureReport) setReleaseSignature(signatureReport)
      if (trustPolicy) setReleaseTrustPolicy(trustPolicy)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release review dashboard export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyHealthDashboard = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.dependencyHealthDashboard.exportHtml(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Dependency health dashboard exported',
        description: `${result.componentCount} component(s), ${result.riskCount} risk signal(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [
        refreshedGovernance,
        refreshedReadiness,
        refreshedReleaseRisk
      ] = await Promise.all([
        window.electronAPI.workspaceGovernance.report(currentPath).catch(() => null),
        window.electronAPI.readiness.report(currentPath).catch(() => null),
        window.electronAPI.releaseRiskProfile.report(currentPath).catch(() => null)
      ])
      if (refreshedGovernance) {
        setWorkspaceGovernanceReport(refreshedGovernance)
        setWorkspaceReport(refreshedGovernance.discovery)
      }
      if (refreshedReadiness) setReadinessReport(refreshedReadiness)
      if (refreshedReleaseRisk) setReleaseRiskProfile(refreshedReleaseRisk)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency health dashboard export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const refreshReportArtifactIndex = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.reportArtifacts.report(currentPath)
      setReportArtifactIndex(result)
      addNotification({
        type: 'success',
        message: 'Report library refreshed',
        description: `${result.summary.artifactCount} artifact(s), ${formatArtifactBytes(result.summary.totalSizeBytes)}`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Report library refresh failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReportArtifactIndex = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.reportArtifacts.exportJson(currentPath)
        : await window.electronAPI.reportArtifacts.exportMarkdown(currentPath)
      addNotification({
        type: 'success',
        message: 'Report artifact index exported',
        description: `${result.artifactCount} artifact(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setReportArtifactIndex(await window.electronAPI.reportArtifacts.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Report artifact index export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const openReportArtifactDirectory = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    const reportDir = reportArtifactIndex?.reportDir || `${currentPath}\\.npmDesktopManager\\reports`
    try {
      await window.electronAPI.system.openFile(reportDir)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Report folder open failed',
        description: error.message
      })
    }
  }

  const refreshReleaseEvidenceCompleteness = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.releaseEvidenceCompleteness.report(currentPath)
      setReleaseEvidenceCompleteness(result)
      setReportArtifactIndex(await window.electronAPI.reportArtifacts.report(currentPath))
      addNotification({
        type: result.status === 'blocked' ? 'warning' : 'success',
        message: 'Release evidence completeness checked',
        description: `${readinessStatusLabel(result.status)}: ${result.summary.presentArtifactCount}/${result.summary.expectedArtifactCount} artifact(s) present`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release evidence completeness check failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseEvidenceCompleteness = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseEvidenceCompleteness.exportJson(currentPath)
        : await window.electronAPI.releaseEvidenceCompleteness.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'warning' : 'success',
        message: 'Release evidence completeness exported',
        description: `${result.summary.findingCount} finding(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [evidenceCompleteness, artifacts] = await Promise.all([
        window.electronAPI.releaseEvidenceCompleteness.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setReleaseEvidenceCompleteness(evidenceCompleteness)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release evidence completeness export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const refreshReleaseProvenanceAttestation = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.releaseProvenanceAttestation.report(currentPath)
      setReleaseProvenanceAttestation(result)
      setReportArtifactIndex(await window.electronAPI.reportArtifacts.report(currentPath))
      addNotification({
        type: result.status === 'blocked' ? 'warning' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release provenance checked',
        description: `${readinessStatusLabel(result.status)}: ${result.summary.artifactCount} artifact digest(s), ${result.summary.gitDirty ? 'dirty Git tree' : 'clean Git state'}`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release provenance check failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseProvenanceAttestation = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseProvenanceAttestation.exportJson(currentPath)
        : await window.electronAPI.releaseProvenanceAttestation.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'warning' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release provenance exported',
        description: `${result.artifactCount} artifact digest(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [provenance, artifacts, evidenceCompleteness, signatureReport] = await Promise.all([
        window.electronAPI.releaseProvenanceAttestation.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null),
        window.electronAPI.releaseEvidenceCompleteness.report(currentPath).catch(() => null),
        window.electronAPI.releaseSignature.report(currentPath).catch(() => null)
      ])
      setReleaseProvenanceAttestation(provenance)
      if (artifacts) setReportArtifactIndex(artifacts)
      if (evidenceCompleteness) setReleaseEvidenceCompleteness(evidenceCompleteness)
      if (signatureReport) setReleaseSignature(signatureReport)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release provenance export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const refreshReleaseIntegrityVerification = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.releaseIntegrityVerification.report(currentPath)
      setReleaseIntegrityVerification(result)
      setReportArtifactIndex(await window.electronAPI.reportArtifacts.report(currentPath))
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release integrity verified',
        description: `${readinessStatusLabel(result.status)}: ${result.summary.verifiedArtifactCount}/${result.summary.artifactCount} artifact(s) verified`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release integrity verification failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseIntegrityVerification = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseIntegrityVerification.exportJson(currentPath)
        : await window.electronAPI.releaseIntegrityVerification.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release integrity verification exported',
        description: `${result.summary.verifiedArtifactCount}/${result.artifactCount} artifact(s) verified: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [verification, artifacts, signatureReport] = await Promise.all([
        window.electronAPI.releaseIntegrityVerification.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null),
        window.electronAPI.releaseSignature.report(currentPath).catch(() => null)
      ])
      setReleaseIntegrityVerification(verification)
      if (artifacts) setReportArtifactIndex(artifacts)
      if (signatureReport) setReleaseSignature(signatureReport)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release integrity verification export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const refreshReleaseSignature = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.releaseSignature.verify(currentPath)
      setReleaseSignature(result)
      setReportArtifactIndex(await window.electronAPI.reportArtifacts.report(currentPath))
      setReleaseTrustPolicy(await window.electronAPI.releaseTrustPolicy.report(currentPath))
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release signature verified',
        description: `${readinessStatusLabel(result.status)}: ${result.summary.includedSourceCount}/${result.summary.sourceCount} source(s), ${result.summary.verificationStatus}`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release signature verification failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseSignature = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseSignature.exportJson(currentPath)
        : await window.electronAPI.releaseSignature.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release signature exported',
        description: `${result.signed ? 'signed' : 'digest-only'} ${result.sourceCount} source(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [signatureReport, artifacts, trustPolicy] = await Promise.all([
        window.electronAPI.releaseSignature.verify(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null),
        window.electronAPI.releaseTrustPolicy.report(currentPath).catch(() => null)
      ])
      setReleaseSignature(signatureReport)
      if (artifacts) setReportArtifactIndex(artifacts)
      if (trustPolicy) setReleaseTrustPolicy(trustPolicy)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release signature export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const refreshReleaseTrustPolicy = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.releaseTrustPolicy.report(currentPath)
      setReleaseTrustPolicy(result)
      setReportArtifactIndex(await window.electronAPI.reportArtifacts.report(currentPath))
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release trust policy checked',
        description: `${readinessStatusLabel(result.status)}: ${result.summary.passedCheckCount}/${result.summary.checkCount} check(s) passed`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release trust policy check failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReleaseTrustPolicy = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.releaseTrustPolicy.exportJson(currentPath)
        : await window.electronAPI.releaseTrustPolicy.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'blocked' ? 'error' : result.status === 'warning' ? 'warning' : 'success',
        message: 'Release trust policy exported',
        description: `${result.summary.blockedCheckCount} blocked, ${result.summary.warningCheckCount} warning: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [trustPolicy, artifacts] = await Promise.all([
        window.electronAPI.releaseTrustPolicy.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setReleaseTrustPolicy(trustPolicy)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Release trust policy export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const refreshFrameworkCoverage = async () => {
    setReporting(true)
    try {
      const result = await window.electronAPI.frameworkCoverage.report(currentPath || undefined)
      setFrameworkCoverage(result)
      addNotification({
        type: result.summary.warningGapCount > 0 ? 'warning' : 'success',
        message: 'Framework coverage refreshed',
        description: `${result.summary.managerCount} manager(s), ${result.summary.routeGroupCount} workspace group(s), ${result.summary.warningGapCount} warning gap(s)`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Framework coverage refresh failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportFrameworkCoverage = async (format: 'markdown' | 'json' = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.frameworkCoverage.exportJson(currentPath)
        : await window.electronAPI.frameworkCoverage.exportMarkdown(currentPath)
      addNotification({
        type: result.summary.warningGapCount > 0 ? 'warning' : 'success',
        message: 'Framework coverage exported',
        description: `${result.managerCount} manager(s), ${result.gapCount} follow-up gap(s): ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [coverage, artifacts] = await Promise.all([
        window.electronAPI.frameworkCoverage.report(currentPath),
        window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
      ])
      setFrameworkCoverage(coverage)
      if (artifacts) setReportArtifactIndex(artifacts)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Framework coverage export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const runReadinessGate = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.readiness.report(currentPath)
      setReadinessReport(result)
      addNotification({
        type: result.status === 'ready' ? 'success' : result.status === 'blocked' ? 'error' : 'warning',
        message: 'Production readiness check completed',
        description: `${readinessStatusLabel(result.status)} / ${result.score} points`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Production readiness check failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportReadiness = async (format: ReadinessGateExportFormat = 'markdown') => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const result = format === 'json'
        ? await window.electronAPI.readiness.exportJson(currentPath)
        : await window.electronAPI.readiness.exportMarkdown(currentPath)
      addNotification({
        type: result.status === 'ready' ? 'success' : result.status === 'blocked' ? 'error' : 'warning',
        message: 'Production readiness report exported',
        description: `${result.score} points: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Production readiness report export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const createSnapshot = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.supplyChain.createSnapshot(currentPath)
      addNotification({
        type: 'success',
        message: '依赖清单快照已创建',
        description: `${result.files.length} 个文件: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      const [snapshotList, rollbackPlan] = await Promise.all([
        window.electronAPI.supplyChain.listSnapshots(currentPath),
        window.electronAPI.dependencyRollbackPlan.report(currentPath).catch(() => null)
      ])
      setSnapshots(snapshotList)
      setDependencyRollbackPlan(rollbackPlan)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '创建快照失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const diffLatestSnapshot = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.supplyChain.diffLatestSnapshot(currentPath)
      setSnapshotDiff(result)
      if (!result) {
        addNotification({ type: 'info', message: '还没有可对比的依赖清单快照' })
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '对比快照失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const diffDependencyComponents = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(currentPath)
      setDependencyDiff(result)
      if (!result) {
        addNotification({ type: 'info', message: '还没有可分析的依赖清单快照' })
        return
      }

      addNotification({
        type: result.summary.criticalRisk + result.summary.highRisk > 0 ? 'warning' : 'success',
        message: 'Dependency risk diff completed',
        description: `${result.summary.added} added, ${result.summary.updated} updated, ${result.summary.removed} removed`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency risk diff failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const exportDependencyDiff = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.supplyChain.exportDependencyDiffMarkdown(currentPath)
      addNotification({
        type: result.summary.criticalRisk + result.summary.highRisk > 0 ? 'warning' : 'success',
        message: 'Dependency risk report exported',
        description: `${result.changeCount} changes: ${result.path}`
      })
      await window.electronAPI.system.openFile(result.path)
      setDependencyDiff(await window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Dependency risk report export failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const restoreLatestSnapshot = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.supplyChain.restoreLatestSnapshot(currentPath)
      if (!result) {
        addNotification({ type: 'info', message: '还没有可恢复的依赖清单快照' })
        return
      }

      addNotification({
        type: 'success',
        message: '已恢复最新依赖清单快照',
        description: `${result.restoredCount} 个文件；恢复前快照: ${result.preRestoreSnapshot.path}`
      })
      await loadOverview()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '恢复快照失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const restoreSnapshot = async (snapshot: SupplyChainSnapshotSummary) => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.supplyChain.restoreSnapshot(currentPath, snapshot.path)
      addNotification({
        type: 'success',
        message: '已恢复依赖清单快照',
        description: `${snapshot.reason || snapshot.id}: ${result.restoredCount} 个文件；恢复前快照: ${result.preRestoreSnapshot.path}`
      })
      await loadOverview()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '恢复指定快照失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const openSnapshot = async (snapshot: SupplyChainSnapshotSummary) => {
    try {
      await window.electronAPI.system.openFile(snapshot.path)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '打开快照失败',
        description: error.message
      })
    }
  }

  const ensurePolicy = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const filePath = await window.electronAPI.supplyChain.ensurePolicy(currentPath)
      addNotification({
        type: 'success',
        message: '依赖策略文件已准备',
        description: filePath
      })
      await window.electronAPI.system.openFile(filePath)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '创建依赖策略失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const ensureReadinessPolicy = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    setReporting(true)
    try {
      const filePath = await window.electronAPI.readiness.ensurePolicy(currentPath)
      addNotification({
        type: 'success',
        message: 'Readiness policy is ready',
        description: filePath
      })
      await window.electronAPI.system.openFile(filePath)
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'Readiness policy setup failed',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const onReadinessPolicySaved = async (result: ReadinessPolicyFile) => {
    addNotification({
      type: 'success',
      message: 'Readiness policy saved',
      description: result.path
    })
    if (currentPath) {
      setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    }
  }

  const evaluatePolicy = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
      return
    }

    setReporting(true)
    try {
      const result = await window.electronAPI.supplyChain.evaluatePolicy(currentPath)
      setPolicyEvaluation(result)
      addNotification({
        type: result.violationCount > 0 ? 'warning' : 'success',
        message: result.violationCount > 0 ? '依赖策略存在违规项' : '依赖策略检查通过',
        description: `${result.violationCount} 个违规项`
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '依赖策略检查失败',
        description: error.message
      })
    } finally {
      setReporting(false)
    }
  }

  const handlePolicySaved = async (result: DependencyPolicyFile) => {
    addNotification({
      type: 'success',
      message: '依赖策略已保存',
      description: result.path
    })
    await evaluatePolicy()
  }

  const rows = managers.map((manager) => ({
    ...manager,
    detected: detectedIds.has(manager.id),
    plugin: pluginMap.get(manager.id),
    scan: scans[manager.id]
  }))

  const renderWorkflowSection = (id: HealthWorkflowSectionId, icon: React.ReactNode, title: string, meta: React.ReactNode) => (
    <WorkflowSectionHeader id={id} icon={icon} title={title} meta={meta} />
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>健康与安全中心</Title>
          <Paragraph className={styles.subtitle}>
            聚合工具链可用性、项目生态识别、依赖诊断、审计入口和可导出的生产清单。
          </Paragraph>
        </div>
        <Space wrap>
          <span className={styles.pathInfo}>
            <span className={styles.pathLabel}>当前项目:</span>
            <span className={styles.pathValue}>{currentPath || '未选择'}</span>
          </span>
          <Button icon={<FolderOpenOutlined />} onClick={chooseDirectory}>选择目录</Button>
          <Button icon={<ReloadOutlined />} onClick={loadOverview} loading={loading}>重新检测</Button>
        </Space>
      </div>

      <WorkflowSectionNav />

      <ReleaseGovernanceOverview
        readinessReport={readinessReport}
        releaseRiskProfile={releaseRiskProfile}
        releaseEvidenceCompleteness={releaseEvidenceCompleteness}
        releaseIntegrityVerification={releaseIntegrityVerification}
        releaseSignature={releaseSignature}
        releaseTrustPolicy={releaseTrustPolicy}
        dependencyChangeApprovalPacket={dependencyChangeApprovalPacket}
        dependencyChangeCalendar={dependencyChangeCalendar}
        dependencyChangeExecutionRecord={dependencyChangeExecutionRecord}
        reportArtifactIndex={reportArtifactIndex}
      />

      <RiskGovernanceOverview
        releaseRiskProfile={releaseRiskProfile}
        dependencyDiff={dependencyDiff}
        auditEvidence={auditEvidence}
        vulnerabilityRemediationPlan={vulnerabilityRemediationPlan}
        licenseReport={licenseReport}
        registryReport={registryReport}
        credentialRotationPlan={credentialRotationPlan}
        readinessReport={readinessReport}
        reportArtifactIndex={reportArtifactIndex}
      />

      <EvidenceGovernanceOverview
        operationHistory={operationHistory}
        ciEvidence={ciEvidence}
        auditEvidence={auditEvidence}
        vulnerabilityRemediationPlan={vulnerabilityRemediationPlan}
        releaseApprovals={releaseApprovals}
        releaseExceptions={releaseExceptions}
        reportArtifactIndex={reportArtifactIndex}
      />

      <PolicyGovernanceOverview
        readinessReport={readinessReport}
        policyEvaluation={policyEvaluation}
        licenseReport={licenseReport}
        thirdPartyNotices={thirdPartyNotices}
        policyAsCodePack={policyAsCodePack}
        registryEndpoints={registryEndpoints}
        registryReport={registryReport}
        credentialRotationPlan={credentialRotationPlan}
        reportArtifactIndex={reportArtifactIndex}
      />

      <AutomationGovernanceOverview
        ciIntegrationPlan={ciIntegrationPlan}
        dependencyAutomationPlan={dependencyAutomationPlan}
        credentialRotationPlan={credentialRotationPlan}
        automationSafetyPlan={automationSafetyPlan}
        dependencyOwnershipPlan={dependencyOwnershipPlan}
        dependencyUpgradePlaybook={dependencyUpgradePlaybook}
        dependencyImpactAnalysis={dependencyImpactAnalysis}
        dependencyChangeCalendar={dependencyChangeCalendar}
        dependencyChangeExecutionRecord={dependencyChangeExecutionRecord}
        reportArtifactIndex={reportArtifactIndex}
      />

      <ReproducibilityGovernanceOverview
        snapshots={snapshots}
        snapshotDiff={snapshotDiff}
        dependencyDiff={dependencyDiff}
        offlineCacheReport={offlineCacheReport}
        dependencyRollbackPlan={dependencyRollbackPlan}
        releaseRiskProfile={releaseRiskProfile}
        readinessReport={readinessReport}
        reportArtifactIndex={reportArtifactIndex}
      />

      <WorkspaceGovernanceOverview
        workspaceReport={workspaceReport}
        workspaceGovernanceReport={workspaceGovernanceReport}
        readinessReport={readinessReport}
        reportArtifactIndex={reportArtifactIndex}
      />

      {renderWorkflowSection(
        'health-inventory',
        <SafetyCertificateOutlined />,
        'Inventory',
        `${detectedIds.size} ecosystems / ${supplyChainReport?.componentCount || 0} components / ${reportArtifactIndex?.summary.artifactCount || 0} reports`
      )}

      <div className={styles.cards}>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">已识别生态</Text>
          <Title level={3}>{detectedIds.size}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">可用工具</Text>
          <Title level={3}>{toolStatuses.filter((tool) => tool.available).length}/{toolStatuses.length}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">已扫描生态</Text>
          <Title level={3}>{Object.keys(scans).length}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">供应链组件</Text>
          <Title level={3}>{supplyChainReport?.componentCount || 0}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">扩展生态</Text>
          <Title level={3}>{extendedDetectedCount}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Framework coverage</Text>
          <Title level={3}>{frameworkCoverage ? frameworkCoverage.summary.managerCount : '-'}</Title>
          {frameworkCoverage && (
            <Space size={4} wrap>
              <Tag color="blue">{frameworkCoverage.summary.routeGroupCount} groups</Tag>
              <Tag color={frameworkCoverage.summary.warningGapCount > 0 ? 'orange' : 'green'}>
                {frameworkCoverage.summary.warningGapCount} gaps
              </Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">未知许可证</Text>
          <Title level={3}>{unknownLicenseCount}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">License risks</Text>
          <Title level={3}>{licenseReport ? licenseRiskCount : '-'}</Title>
          {licenseReport && (
            <Tag color={licenseRiskCount > 0 ? 'orange' : 'green'}>
              {licenseReport.summary.licenseCount} licenses
            </Tag>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Third-party notices</Text>
          <Title level={3}>{thirdPartyNotices ? thirdPartyNotices.summary.noticeCount : '-'}</Title>
          {thirdPartyNotices && (
            <Space size={4} wrap>
              <Tag color={thirdPartyNotices.summary.policyViolationCount > 0 ? 'orange' : 'green'}>
                {thirdPartyNotices.summary.policyViolationCount} policy
              </Tag>
              <Tag>{thirdPartyNotices.summary.unknownLicenseComponentCount} unknown</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">快照</Text>
          <Title level={3}>{snapshots.length}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Diff risk</Text>
          <Title level={3}>{dependencyDiff ? dependencyHighRiskCount : '-'}</Title>
          {dependencyDiff && <Tag color={dependencyHighRiskCount > 0 ? 'red' : 'green'}>high+</Tag>}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">操作记录</Text>
          <Title level={3}>{operationHistory.length}</Title>
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">CI evidence</Text>
          <Title level={3}>{ciEvidence.length}</Title>
          {latestCiEvidence && (
            <Tag color={ciEvidenceStatusColor(latestCiEvidence.status)}>
              {latestCiEvidence.status}
            </Tag>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Audit evidence</Text>
          <Title level={3}>{auditEvidence ? auditEvidence.summary.findingCount : '-'}</Title>
          {auditEvidence && (
            <Space size={4} wrap>
              <Tag color={auditEvidence.summary.critical + auditEvidence.summary.high > 0 ? 'red' : auditEvidence.summary.medium > 0 ? 'orange' : 'green'}>
                {auditEvidence.summary.critical + auditEvidence.summary.high} high+
              </Tag>
              <Tag>{auditEvidence.summary.sourceCount} sources</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Vuln remediation</Text>
          <Title level={3}>{vulnerabilityRemediationPlan ? vulnerabilityRemediationPlan.summary.itemCount : '-'}</Title>
          {vulnerabilityRemediationPlan && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(vulnerabilityRemediationPlan.status)}>
                {readinessStatusLabel(vulnerabilityRemediationPlan.status)}
              </Tag>
              <Tag color={vulnerabilityRemediationPlan.summary.immediateItemCount > 0 ? 'red' : 'default'}>
                {vulnerabilityRemediationPlan.summary.immediateItemCount} immediate
              </Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Release approvals</Text>
          <Title level={3}>{releaseApprovals.length}</Title>
          {latestReleaseApproval && (
            <Tag color={releaseApprovalColor(latestReleaseApproval.decision)}>
              {latestReleaseApproval.decision}
            </Tag>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Release exceptions</Text>
          <Title level={3}>{releaseExceptions.length}</Title>
          {latestReleaseException && (
            <Tag color={latestReleaseException.decision === 'approved' ? 'orange' : 'default'}>
              {latestReleaseException.decision}
            </Tag>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Registries</Text>
          <Title level={3}>{registryReport?.summary.endpointCount ?? registryEndpoints.length}</Title>
          {registryReport && (
            <Tag color={registryReport.summary.unreachable > 0 ? 'red' : 'green'}>
              {registryReport.summary.reachable} reachable
            </Tag>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Workspaces</Text>
          <Title level={3}>{workspaceReport?.summary.workspaceCount ?? '-'}</Title>
          {workspaceReport && (
            <Tag color={workspaceReport.summary.explicitWorkspaceCount > 0 ? 'blue' : 'default'}>
              {workspaceReport.summary.managerCount} managers
            </Tag>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Workspace risks</Text>
          <Title level={3}>{workspaceGovernanceReport ? workspaceGovernanceReport.summary.blocked + workspaceGovernanceReport.summary.warning : '-'}</Title>
          {workspaceGovernanceReport && (
            <Space size={4} wrap>
              <Tag color={workspaceGovernanceReport.summary.blocked > 0 ? 'red' : 'default'}>
                {workspaceGovernanceReport.summary.blocked} blocked
              </Tag>
              <Tag color={workspaceGovernanceReport.summary.warning > 0 ? 'orange' : 'green'}>
                {workspaceGovernanceReport.summary.warning} warning
              </Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Production readiness</Text>
          <Title level={3}>{readinessReport ? readinessReport.score : '-'}</Title>
          {readinessReport && (
            <Tag color={readinessStatusColor(readinessReport.status)}>
              {readinessStatusLabel(readinessReport.status)}
            </Tag>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Offline cache</Text>
          <Title level={3}>{offlineCacheReport ? offlineCacheReport.summary.findingCount : '-'}</Title>
          {offlineCacheReport && (
            <Space size={4} wrap>
              <Tag color={offlineCacheStatusColor(offlineCacheReport.summary.blocked > 0 ? 'blocked' : offlineCacheReport.summary.warning > 0 ? 'warning' : 'ready')}>
                {offlineCacheReport.summary.blocked} blocked
              </Tag>
              <Tag>{offlineCacheReport.summary.offlineCommandManagerCount} commands</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Release risk</Text>
          <Title level={3}>{releaseRiskProfile ? releaseRiskProfile.score : '-'}</Title>
          {releaseRiskProfile && (
            <Space size={4} wrap>
              <Tag color={releaseRiskStatusColor(releaseRiskProfile.status)}>
                {readinessStatusLabel(releaseRiskProfile.status)}
              </Tag>
              <Tag>{releaseRiskProfile.summary.topRiskCount} top</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">CI plan</Text>
          <Title level={3}>{ciIntegrationPlan ? ciIntegrationPlan.summary.jobCount : '-'}</Title>
          {ciIntegrationPlan && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(ciIntegrationPlan.status)}>
                {readinessStatusLabel(ciIntegrationPlan.status)}
              </Tag>
              <Tag>{ciIntegrationPlan.summary.matrixEntryCount} targets</Tag>
              <Tag color={ciIntegrationPlan.summary.deploymentWarningCount > 0 ? 'orange' : 'green'}>
                {ciIntegrationPlan.summary.deploymentWarningCount} deploy
              </Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Automation</Text>
          <Title level={3}>{dependencyAutomationPlan ? dependencyAutomationPlan.summary.generatedConfigCount : '-'}</Title>
          {dependencyAutomationPlan && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyAutomationPlan.status)}>
                {readinessStatusLabel(dependencyAutomationPlan.status)}
              </Tag>
              <Tag>{dependencyAutomationPlan.summary.dependabotTargetCount + dependencyAutomationPlan.summary.renovateTargetCount} targets</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Credential rotation</Text>
          <Title level={3}>{credentialRotationPlan ? credentialRotationPlan.summary.actionCount : '-'}</Title>
          {credentialRotationPlan && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(credentialRotationPlan.status)}>
                {readinessStatusLabel(credentialRotationPlan.status)}
              </Tag>
              <Tag>{credentialRotationPlan.summary.automationSecretCount} secrets</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Automation safety</Text>
          <Title level={3}>{automationSafetyPlan ? automationSafetyPlan.summary.ruleCount : '-'}</Title>
          {automationSafetyPlan && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(automationSafetyPlan.status)}>
                {readinessStatusLabel(automationSafetyPlan.status)}
              </Tag>
              <Tag>{automationSafetyPlan.summary.autoMergeRuleCount} auto</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Ownership</Text>
          <Title level={3}>{dependencyOwnershipPlan ? dependencyOwnershipPlan.summary.ownedAssignmentCount : '-'}</Title>
          {dependencyOwnershipPlan && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyOwnershipPlan.status)}>
                {readinessStatusLabel(dependencyOwnershipPlan.status)}
              </Tag>
              <Tag>{dependencyOwnershipPlan.summary.missingOwnerAssignmentCount} missing</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Upgrade playbook</Text>
          <Title level={3}>{dependencyUpgradePlaybook ? dependencyUpgradePlaybook.summary.itemCount : '-'}</Title>
          {dependencyUpgradePlaybook && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyUpgradePlaybook.status)}>
                {readinessStatusLabel(dependencyUpgradePlaybook.status)}
              </Tag>
              <Tag>{dependencyUpgradePlaybook.summary.blockedItemCount} blocked</Tag>
              <Tag>{dependencyUpgradePlaybook.summary.laneCount} lanes</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Rollback plan</Text>
          <Title level={3}>{dependencyRollbackPlan ? dependencyRollbackPlan.summary.itemCount : '-'}</Title>
          {dependencyRollbackPlan && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyRollbackPlan.status)}>
                {readinessStatusLabel(dependencyRollbackPlan.status)}
              </Tag>
              <Tag>{dependencyRollbackPlan.summary.snapshotCoveredItemCount} snapshots</Tag>
              <Tag>{dependencyRollbackPlan.summary.blockedItemCount} blocked</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Impact analysis</Text>
          <Title level={3}>{dependencyImpactAnalysis ? dependencyImpactAnalysis.summary.itemCount : '-'}</Title>
          {dependencyImpactAnalysis && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyImpactAnalysis.status)}>
                {readinessStatusLabel(dependencyImpactAnalysis.status)}
              </Tag>
              <Tag>{dependencyImpactAnalysis.summary.highItemCount + dependencyImpactAnalysis.summary.criticalItemCount} high+</Tag>
              <Tag>{dependencyImpactAnalysis.summary.ciJobCount} CI jobs</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Approval packet</Text>
          <Title level={3}>{dependencyChangeApprovalPacket ? dependencyChangeApprovalPacket.summary.checklistCount : '-'}</Title>
          {dependencyChangeApprovalPacket && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyChangeApprovalPacket.status)}>
                {readinessStatusLabel(dependencyChangeApprovalPacket.status)}
              </Tag>
              <Tag>{dependencyChangeApprovalPacket.decision}</Tag>
              <Tag>{dependencyChangeApprovalPacket.summary.blockedChecklistCount} blocked</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Change calendar</Text>
          <Title level={3}>{dependencyChangeCalendar ? dependencyChangeCalendar.summary.windowCount : '-'}</Title>
          {dependencyChangeCalendar && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyChangeCalendar.status)}>
                {readinessStatusLabel(dependencyChangeCalendar.status)}
              </Tag>
              <Tag>{dependencyChangeCalendar.summary.freezeWindowCount} freezes</Tag>
              <Tag>{dependencyChangeCalendar.summary.needsReviewWindowCount} review</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Execution record</Text>
          <Title level={3}>{dependencyChangeExecutionRecord ? dependencyChangeExecutionRecord.summary.recordCount : '-'}</Title>
          {dependencyChangeExecutionRecord && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(dependencyChangeExecutionRecord.status)}>
                {readinessStatusLabel(dependencyChangeExecutionRecord.status)}
              </Tag>
              <Tag>{dependencyChangeExecutionRecord.summary.completedRecordCount} done</Tag>
              <Tag>{dependencyChangeExecutionRecord.summary.missingOperationEvidenceCount} gaps</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Policy-as-code</Text>
          <Title level={3}>{policyAsCodePack ? policyAsCodePack.summary.dependencyPolicyRuleCount : '-'}</Title>
          {policyAsCodePack && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(policyAsCodePack.status)}>
                {readinessStatusLabel(policyAsCodePack.status)}
              </Tag>
              <Tag>{policyAsCodePack.summary.readinessGateCount} gates</Tag>
              <Tag>{policyAsCodePack.summary.deploymentPolicyGateCount} deploy</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Evidence completeness</Text>
          <Title level={3}>{releaseEvidenceCompleteness ? releaseEvidenceCompleteness.summary.presentArtifactCount : '-'}</Title>
          {releaseEvidenceCompleteness && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(releaseEvidenceCompleteness.status)}>
                {readinessStatusLabel(releaseEvidenceCompleteness.status)}
              </Tag>
              <Tag>{releaseEvidenceCompleteness.summary.missingRequiredArtifactCount} missing</Tag>
              <Tag>{releaseEvidenceCompleteness.summary.requiredIntegrityMismatchCount} mismatch</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Release provenance</Text>
          <Title level={3}>{releaseProvenanceAttestation ? releaseProvenanceAttestation.summary.artifactCount : '-'}</Title>
          {releaseProvenanceAttestation && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(releaseProvenanceAttestation.status)}>
                {readinessStatusLabel(releaseProvenanceAttestation.status)}
              </Tag>
              <Tag color={releaseProvenanceAttestation.summary.gitDirty ? 'orange' : 'green'}>
                {releaseProvenanceAttestation.summary.gitDirty ? 'dirty' : 'clean'}
              </Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Release integrity</Text>
          <Title level={3}>{releaseIntegrityVerification ? releaseIntegrityVerification.summary.verifiedArtifactCount : '-'}</Title>
          {releaseIntegrityVerification && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(releaseIntegrityVerification.status)}>
                {readinessStatusLabel(releaseIntegrityVerification.status)}
              </Tag>
              <Tag>{releaseIntegrityVerification.summary.requiredMismatchArtifactCount} required mismatch</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Release signature</Text>
          <Title level={3}>{releaseSignature ? releaseSignature.summary.includedSourceCount : '-'}</Title>
          {releaseSignature && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(releaseSignature.status)}>
                {readinessStatusLabel(releaseSignature.status)}
              </Tag>
              <Tag color={releaseSignature.summary.signed ? 'green' : 'orange'}>
                {releaseSignature.summary.signed ? 'signed' : 'unsigned'}
              </Tag>
              <Tag>{releaseSignature.summary.verificationStatus}</Tag>
            </Space>
          )}
        </Card>
        <Card className={styles.metricCard} variant="borderless">
          <Text type="secondary">Release trust</Text>
          <Title level={3}>{releaseTrustPolicy ? releaseTrustPolicy.summary.passedCheckCount : '-'}</Title>
          {releaseTrustPolicy && (
            <Space size={4} wrap>
              <Tag color={readinessStatusColor(releaseTrustPolicy.status)}>
                {readinessStatusLabel(releaseTrustPolicy.status)}
              </Tag>
              <Tag>{releaseTrustPolicy.summary.blockedCheckCount} blocked</Tag>
              <Tag color={releaseTrustPolicy.summary.signatureVerified ? 'green' : 'orange'}>
                {releaseTrustPolicy.summary.signatureVerified ? 'verified' : 'unverified'}
              </Tag>
            </Space>
          )}
        </Card>
      </div>

      {frameworkCoverage && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Framework coverage</Text>
              <Tag>{frameworkCoverage.summary.managerCount} managers</Tag>
              <Tag color="blue">{frameworkCoverage.summary.routeGroupCount} workspaces</Tag>
              <Tag color={frameworkCoverage.summary.warningGapCount > 0 ? 'orange' : 'green'}>
                {frameworkCoverage.summary.warningGapCount} warning gaps
              </Tag>
            </Space>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshFrameworkCoverage} loading={reporting}>
                Refresh coverage
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportFrameworkCoverage('markdown')} loading={reporting} disabled={!currentPath}>
                Export coverage
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportFrameworkCoverage('json')} loading={reporting} disabled={!currentPath}>
                Export JSON
              </Button>
            </Space>
          </div>
          <div className={styles.readinessSummary}>
            <span>Implemented: {frameworkCoverage.summary.implementedCount}/{frameworkCoverage.summary.managerCount}</span>
            <span>Stable: {frameworkCoverage.summary.stableCount}</span>
            <span>Preview: {frameworkCoverage.summary.previewCount}</span>
            <span>Planned: {frameworkCoverage.summary.plannedCount}</span>
            <span>Languages: {frameworkCoverage.summary.languageCount}</span>
            <span>Health coverage: {frameworkCoverage.summary.healthCoveragePercent}%</span>
            <span>Audit workflows: {frameworkCoverage.summary.auditWorkflowCount}</span>
            <span>Publish workflows: {frameworkCoverage.summary.publishWorkflowCount}</span>
          </div>
          <Table
            dataSource={frameworkCoverageRows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Manager',
                key: 'manager',
                width: 220,
                render: (_: unknown, record: FrameworkCoverageManagerRecord) => (
                  <Space direction="vertical" size={2}>
                    <Space size={4} wrap>
                      <Tag color={managerColor(record.id)}>{record.id}</Tag>
                      <Text strong>{record.name}</Text>
                    </Space>
                    <Text type="secondary">{record.language}</Text>
                  </Space>
                )
              },
              {
                title: 'Workspace',
                dataIndex: 'routeLabel',
                key: 'routeLabel',
                width: 150,
                render: (label: string, record: FrameworkCoverageManagerRecord) => (
                  <Tooltip title={record.route}>
                    <Tag>{label}</Tag>
                  </Tooltip>
                )
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: ManagerImplementationStatus, record: FrameworkCoverageManagerRecord) => (
                  <Space size={4} wrap>
                    <Tag color={status === 'stable' ? 'green' : status === 'preview' ? 'blue' : 'default'}>{status}</Tag>
                    {!record.implemented && <Tag>extended</Tag>}
                  </Space>
                )
              },
              {
                title: 'Scopes',
                dataIndex: 'scopes',
                key: 'scopes',
                width: 190,
                render: (scopes: ManagerScope[]) => (
                  <Space size={4} wrap>
                    {scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)}
                  </Space>
                )
              },
              {
                title: 'Capabilities',
                dataIndex: 'capabilities',
                key: 'capabilities',
                ellipsis: true,
                render: (capabilities: ManagerCapability[]) => capabilities.join(', ')
              },
              {
                title: 'Files',
                key: 'files',
                ellipsis: true,
                render: (_: unknown, record: FrameworkCoverageManagerRecord) => (
                  <Tooltip title={`Manifests: ${record.manifestFiles.join(', ') || '-'} / Locks: ${record.lockFiles.join(', ') || '-'}`}>
                    <span>{[...record.manifestFiles, ...record.lockFiles].slice(0, 4).join(', ') || '-'}</span>
                  </Tooltip>
                )
              }
            ]}
          />
        </div>
      )}

      <Alert
        type="info"
        showIcon
        title="生产级管理入口"
        description="当前已提供跨生态工具链检测、项目依赖清单导出、依赖健康扫描聚合、CycloneDX/SPDX SBOM、Markdown 报告、清单快照、快照差异与恢复；扩展生态页已支持标准操作计划、dry-run 判断、执行前备份与恢复。"
      />

      {renderWorkflowSection(
        'health-risk',
        <WarningOutlined />,
        'Risk',
        `${releaseRiskProfile ? `${releaseRiskProfile.score}/100` : 'not scored'} / ${dependencyHighRiskCount} dependency high+ / ${releaseRiskProfile?.summary.topRiskCount || 0} top risks`
      )}

      {releaseRiskProfile && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <WarningOutlined />
              <Text strong>Release risk profile</Text>
              <Tag color={releaseRiskStatusColor(releaseRiskProfile.status)}>
                {readinessStatusLabel(releaseRiskProfile.status)}
              </Tag>
              <Tag>{releaseRiskProfile.score}/100</Tag>
              <Tag color={releaseRiskProfile.summary.high + releaseRiskProfile.summary.critical > 0 ? 'red' : 'green'}>
                {releaseRiskProfile.summary.critical + releaseRiskProfile.summary.high} high+
              </Tag>
            </Space>
            <Text type="secondary">{new Date(releaseRiskProfile.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Findings: {releaseRiskProfile.summary.findingCount}</span>
            <span>Readiness: {releaseRiskProfile.summary.readinessStatus || '-'}</span>
            <span>Components: {releaseRiskProfile.summary.componentCount}</span>
            <span>Dependency high+: {releaseRiskProfile.summary.dependencyCriticalRiskCount + releaseRiskProfile.summary.dependencyHighRiskCount}</span>
            <span>License risk: {releaseRiskProfile.summary.licenseRiskCount}</span>
            <span>Registry failures: {releaseRiskProfile.summary.unreachableRegistryCount}</span>
            <span>Credential gaps: {releaseRiskProfile.summary.missingCredentialEndpointCount}</span>
            <span>Lock drift: {releaseRiskProfile.summary.lockfileDriftFindingCount}</span>
            <span>Runtime pins: {releaseRiskProfile.summary.runtimePinningFindingCount}</span>
            <span>Offline cache: {releaseRiskProfile.summary.offlineCacheFindingCount}</span>
            <span>Deploy refs: {releaseRiskProfile.summary.deploymentReferenceCount}</span>
            <span>Floating deploy refs: {releaseRiskProfile.summary.floatingDeploymentRefCount}</span>
            <span>Missing deploy baselines: {releaseRiskProfile.summary.missingDeploymentBaselineCount}</span>
            <span>Audit high+: {releaseRiskProfile.summary.auditCriticalFindingCount + releaseRiskProfile.summary.auditHighFindingCount}</span>
            <span>Audit fixes: {releaseRiskProfile.summary.auditFixAvailableCount}</span>
            <span>Floating images: {releaseRiskProfile.summary.floatingContainerTagCount}</span>
            <span>Workspaces: {releaseRiskProfile.summary.workspaceCount}</span>
            <span>Failed ops: {releaseRiskProfile.summary.failedOperationCount}</span>
          </div>
          <Table
            dataSource={releaseRiskProfile.categories}
            rowKey="category"
            size="small"
            pagination={false}
            columns={[
              {
                title: 'Category',
                dataIndex: 'title',
                key: 'title',
                width: 220
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 120,
                render: (status: ReleaseRiskProfileStatus) => <Tag color={releaseRiskStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Score',
                dataIndex: 'score',
                key: 'score',
                width: 90
              },
              {
                title: 'Findings',
                key: 'findings',
                render: (_: unknown, record: ReleaseRiskCategorySummary) => (
                  <Space size={4} wrap>
                    <Tag>{record.findingCount}</Tag>
                    <Tag color={record.critical + record.high > 0 ? 'red' : 'default'}>{record.critical + record.high} high+</Tag>
                    <Tag color={record.medium > 0 ? 'orange' : 'default'}>{record.medium} medium</Tag>
                  </Space>
                )
              }
            ]}
          />
          <Table
            dataSource={releaseRiskRows}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No release risks" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 120,
                render: (severity: ReleaseRiskSeverity) => <Tag color={releaseRiskSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                width: 170,
                render: (source: ReleaseRiskSource) => <Tag>{source}</Tag>
              },
              {
                title: 'Risk',
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
          />
        </div>
      )}

      {renderWorkflowSection(
        'health-automation',
        <ExperimentOutlined />,
        'Automation',
        `${ciIntegrationPlan?.summary.jobCount || 0} CI jobs / ${dependencyAutomationPlan?.summary.generatedConfigCount || 0} configs / ${automationSafetyPlan?.summary.ruleCount || 0} safety rules`
      )}

      {ciIntegrationPlan && <CiIntegrationPlanPanel report={ciIntegrationPlan} />}

      {dependencyAutomationPlan && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <ReloadOutlined />
              <Text strong>Dependency automation plan</Text>
              <Tag color={readinessStatusColor(dependencyAutomationPlan.status)}>
                {readinessStatusLabel(dependencyAutomationPlan.status)}
              </Tag>
              <Tag>{dependencyAutomationPlan.summary.dependabotTargetCount} Dependabot</Tag>
              <Tag>{dependencyAutomationPlan.summary.renovateTargetCount} Renovate</Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyAutomationPlan.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Managers: {dependencyAutomationPlan.summary.managers.join(', ') || '-'}</span>
            <span>Secrets: {dependencyAutomationPlan.summary.requiredSecretCount}</span>
            <span>Unsupported Dependabot: {dependencyAutomationPlan.summary.unsupportedDependabotManagerCount}</span>
            <span>Unsupported Renovate: {dependencyAutomationPlan.summary.unsupportedRenovateManagerCount}</span>
            <span>Lock warnings: {dependencyAutomationPlan.summary.lockfileWarningCount}</span>
            <span>Warnings: {dependencyAutomationPlan.summary.warningCount}</span>
          </div>
          <Table
            dataSource={dependencyAutomationPlan.targets.filter((target) => target.supported).slice(0, 16)}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: 'Provider',
                dataIndex: 'provider',
                key: 'provider',
                width: 120,
                render: (provider: DependencyAutomationProvider) => <Tag>{provider}</Tag>
              },
              {
                title: 'Workspace',
                dataIndex: 'workspaceRelativePath',
                key: 'workspaceRelativePath',
                width: 180,
                render: (path: string, record: DependencyAutomationTarget) => (
                  <Space direction="vertical" size={0}>
                    <Text>{record.workspaceName}</Text>
                    <Text type="secondary">{path}</Text>
                  </Space>
                )
              },
              {
                title: 'Manager',
                dataIndex: 'managerId',
                key: 'managerId',
                width: 110,
                render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
              },
              {
                title: 'Ecosystem',
                key: 'ecosystem',
                width: 170,
                render: (_: unknown, record: DependencyAutomationTarget) => record.packageEcosystem || record.renovateManager || '-'
              },
              {
                title: 'Directory',
                dataIndex: 'directory',
                key: 'directory',
                width: 160
              },
              {
                title: 'Secrets',
                dataIndex: 'requiredSecrets',
                key: 'requiredSecrets',
                ellipsis: true,
                render: (secrets: string[]) => secrets.join(', ') || '-'
              }
            ]}
          />
          <Table
            dataSource={dependencyAutomationWarnings}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No automation warnings" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 120,
                render: (severity: DependencyAutomationWarningSeverity) => <Tag color={automationWarningColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                width: 180,
                render: (source: DependencyAutomationWarningSource) => <Tag>{source}</Tag>
              },
              {
                title: 'Warning',
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
          />
        </div>
      )}

      {credentialRotationPlan && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Credential rotation plan</Text>
              <Tag color={readinessStatusColor(credentialRotationPlan.status)}>
                {readinessStatusLabel(credentialRotationPlan.status)}
              </Tag>
              <Tag>{credentialRotationPlan.summary.actionCount} actions</Tag>
              <Tag>{credentialRotationPlan.summary.credentialCount} credentials</Tag>
            </Space>
            <Text type="secondary">{new Date(credentialRotationPlan.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Private endpoints: {credentialRotationPlan.summary.privateEndpointCount}</span>
            <span>Missing credentials: {credentialRotationPlan.summary.missingCredentialEndpointCount}</span>
            <span>Weak matches: {credentialRotationPlan.summary.weakMatchEndpointCount}</span>
            <span>Insecure storage: {credentialRotationPlan.summary.insecureStorageCredentialCount}</span>
            <span>Stale: {credentialRotationPlan.summary.staleCredentialCount}</span>
            <span>Unused: {credentialRotationPlan.summary.unusedCredentialCount}</span>
            <span>Automation secrets: {credentialRotationPlan.summary.automationSecretCount}</span>
            <span>Vault encrypted: {credentialRotationPlan.summary.vaultEncrypted ? 'yes' : 'no'}</span>
          </div>
          <Table
            dataSource={credentialRotationActions}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No credential rotation actions" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 120,
                render: (severity: CredentialRotationSeverity) => <Tag color={credentialRotationSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Kind',
                dataIndex: 'kind',
                key: 'kind',
                width: 190,
                render: (kind: CredentialRotationActionKind) => <Tag>{kind}</Tag>
              },
              {
                title: 'Action',
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
          />
          <Table
            dataSource={credentialRotationPlan.credentials.slice(0, 10)}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No credential metadata" /> }}
            columns={[
              {
                title: 'Credential',
                dataIndex: 'label',
                key: 'label',
                ellipsis: true
              },
              {
                title: 'Manager',
                dataIndex: 'managerId',
                key: 'managerId',
                width: 110,
                render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
              },
              {
                title: 'Age',
                dataIndex: 'ageDays',
                key: 'ageDays',
                width: 90,
                render: (age: number) => `${age}d`
              },
              {
                title: 'Encrypted',
                dataIndex: 'encrypted',
                key: 'encrypted',
                width: 110,
                render: (encrypted: boolean) => <Tag color={encrypted ? 'green' : 'red'}>{encrypted ? 'yes' : 'no'}</Tag>
              },
              {
                title: 'Flags',
                key: 'flags',
                width: 220,
                render: (_: unknown, record: CredentialRotationCredential) => (
                  <Space size={4} wrap>
                    {record.needsRotation && <Tag color="orange">rotate</Tag>}
                    {record.stale && <Tag>stale</Tag>}
                    {record.unused && <Tag>unused</Tag>}
                    {record.matchTypes.map((match) => <Tag key={match}>{match}</Tag>)}
                  </Space>
                )
              }
            ]}
          />
        </div>
      )}

      {automationSafetyPlan && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Automation safety plan</Text>
              <Tag color={readinessStatusColor(automationSafetyPlan.status)}>
                {readinessStatusLabel(automationSafetyPlan.status)}
              </Tag>
              <Tag>{automationSafetyPlan.summary.ruleCount} rules</Tag>
              <Tag>{automationSafetyPlan.summary.autoMergeRuleCount} auto-merge</Tag>
            </Space>
            <Text type="secondary">{new Date(automationSafetyPlan.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Targets: {automationSafetyPlan.summary.supportedTargetCount}/{automationSafetyPlan.summary.targetCount}</span>
            <span>Review: {automationSafetyPlan.summary.reviewRuleCount}</span>
            <span>Blocked: {automationSafetyPlan.summary.blockedRuleCount}</span>
            <span>Findings: {automationSafetyPlan.summary.findingCount}</span>
            <span>Readiness: {automationSafetyPlan.summary.readinessStatus || '-'}</span>
            <span>Risk: {automationSafetyPlan.summary.releaseRiskStatus || '-'}</span>
            <span>Credentials: {automationSafetyPlan.summary.credentialRotationStatus || '-'}</span>
            <span>Automation: {automationSafetyPlan.summary.dependencyAutomationStatus || '-'}</span>
          </div>
          <Table
            dataSource={automationSafetyPlan.rules.slice(0, 16)}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No automation safety rules" /> }}
            columns={[
              {
                title: 'Decision',
                dataIndex: 'decision',
                key: 'decision',
                width: 130,
                render: (decision: AutomationSafetyDecision) => <Tag color={automationDecisionColor(decision)}>{decision}</Tag>
              },
              {
                title: 'Provider',
                dataIndex: 'provider',
                key: 'provider',
                width: 120,
                render: (provider: DependencyAutomationProvider) => <Tag>{provider}</Tag>
              },
              {
                title: 'Manager',
                dataIndex: 'managerId',
                key: 'managerId',
                width: 110,
                render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
              },
              {
                title: 'Update',
                dataIndex: 'updateType',
                key: 'updateType',
                width: 100
              },
              {
                title: 'Approvals',
                dataIndex: 'requiredApprovals',
                key: 'requiredApprovals',
                width: 100
              },
              {
                title: 'Rationale',
                dataIndex: 'rationale',
                key: 'rationale',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={automationSafetyFindings}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No automation safety findings" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 120,
                render: (severity: AutomationSafetyFindingSeverity) => <Tag color={automationSafetySeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                width: 180,
                render: (source: AutomationSafetyFindingSource) => <Tag>{source}</Tag>
              },
              {
                title: 'Finding',
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
          />
        </div>
      )}

      {dependencyOwnershipPlan && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <ApartmentOutlined />
              <Text strong>Dependency ownership plan</Text>
              <Tag color={readinessStatusColor(dependencyOwnershipPlan.status)}>
                {readinessStatusLabel(dependencyOwnershipPlan.status)}
              </Tag>
              <Tag>{dependencyOwnershipPlan.summary.ownedAssignmentCount}/{dependencyOwnershipPlan.summary.assignmentCount} owned</Tag>
              <Tag>{dependencyOwnershipPlan.summary.reviewRouteCount} routes</Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyOwnershipPlan.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>CODEOWNERS: {dependencyOwnershipPlan.summary.codeownersFileCount} file(s)</span>
            <span>Entries: {dependencyOwnershipPlan.summary.codeownersEntryCount}</span>
            <span>Owners: {dependencyOwnershipPlan.summary.ownerCount}</span>
            <span>Missing assignments: {dependencyOwnershipPlan.summary.missingOwnerAssignmentCount}</span>
            <span>Blocked routes: {dependencyOwnershipPlan.summary.blockedReviewRouteCount}</span>
            <span>Suggested: {dependencyOwnershipPlan.summary.suggestedEntryCount}</span>
          </div>
          <Table
            dataSource={dependencyOwnershipPlan.assignments.slice(0, 16)}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No ownership assignments" /> }}
            columns={[
              {
                title: 'Workspace',
                dataIndex: 'workspaceRelativePath',
                key: 'workspaceRelativePath',
                width: 180,
                ellipsis: true
              },
              {
                title: 'Manager',
                dataIndex: 'managerId',
                key: 'managerId',
                width: 110,
                render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
              },
              {
                title: 'Owners',
                dataIndex: 'owners',
                key: 'owners',
                width: 220,
                render: (owners: string[]) => owners.length > 0
                  ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
                  : <Tag color="red">missing</Tag>
              },
              {
                title: 'Routes',
                key: 'routes',
                width: 160,
                render: (_: unknown, record: DependencyOwnerAssignment) => (
                  <Space size={4} wrap>
                    <Tag>{record.automationTargetCount} automation</Tag>
                    <Tag color={record.blockedSafetyRuleCount > 0 ? 'red' : 'default'}>{record.safetyRuleCount} safety</Tag>
                  </Space>
                )
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={dependencyOwnershipPlan.reviewRoutes.slice(0, 16)}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No ownership review routes" /> }}
            columns={[
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyOwnershipStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Provider',
                dataIndex: 'provider',
                key: 'provider',
                width: 120,
                render: (provider: DependencyAutomationProvider) => <Tag>{provider}</Tag>
              },
              {
                title: 'Manager',
                dataIndex: 'managerId',
                key: 'managerId',
                width: 110,
                render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
              },
              {
                title: 'Update',
                dataIndex: 'updateType',
                key: 'updateType',
                width: 100
              },
              {
                title: 'Owners',
                dataIndex: 'owners',
                key: 'owners',
                width: 220,
                render: (owners: string[]) => owners.length > 0
                  ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
                  : <Tag color="red">missing</Tag>
              },
              {
                title: 'Escalation',
                dataIndex: 'escalation',
                key: 'escalation',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={dependencyOwnershipFindings}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No dependency ownership findings" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 120,
                render: (severity: DependencyOwnershipFindingSeverity) => <Tag color={dependencyOwnershipSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                width: 170,
                render: (source: DependencyOwnershipFindingSource) => <Tag>{source}</Tag>
              },
              {
                title: 'Finding',
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
          />
        </div>
      )}

      {dependencyUpgradePlaybook && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <ToolOutlined />
              <Text strong>Dependency upgrade playbook</Text>
              <Tag color={readinessStatusColor(dependencyUpgradePlaybook.status)}>
                {readinessStatusLabel(dependencyUpgradePlaybook.status)}
              </Tag>
              <Tag>{dependencyUpgradePlaybook.summary.itemCount} items</Tag>
              <Tag>{dependencyUpgradePlaybook.summary.laneCount} lanes</Tag>
              <Tag color={dependencyUpgradePlaybook.summary.blockedItemCount > 0 ? 'red' : 'default'}>
                {dependencyUpgradePlaybook.summary.blockedItemCount} blocked
              </Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyUpgradePlaybook.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Immediate: {dependencyUpgradePlaybook.summary.immediateItemCount}</span>
            <span>Urgent: {dependencyUpgradePlaybook.summary.urgentItemCount}</span>
            <span>Scheduled: {dependencyUpgradePlaybook.summary.scheduledItemCount}</span>
            <span>Security: {dependencyUpgradePlaybook.summary.securityItemCount}</span>
            <span>Release blockers: {dependencyUpgradePlaybook.summary.releaseBlockerItemCount}</span>
            <span>Automation: {dependencyUpgradePlaybook.summary.automationItemCount}</span>
            <span>Ownership: {dependencyUpgradePlaybook.summary.ownershipItemCount}</span>
            <span>Commands: {dependencyUpgradePlaybook.summary.commandCount}</span>
            <span>Owners: {dependencyUpgradePlaybook.summary.ownerCount}</span>
          </div>
          <Table
            dataSource={dependencyUpgradeLanes}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No upgrade lanes" /> }}
            columns={[
              {
                title: 'Lane',
                dataIndex: 'title',
                key: 'title',
                width: 220
              },
              {
                title: 'Priority',
                dataIndex: 'priority',
                key: 'priority',
                width: 120,
                render: (priority: DependencyUpgradeLanePriority) => <Tag color={upgradePriorityColor(priority)}>{priority}</Tag>
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyUpgradePlaybookStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Items',
                key: 'items',
                width: 180,
                render: (_: unknown, record: DependencyUpgradePlaybookLane) => (
                  <Space size={4} wrap>
                    <Tag>{record.itemCount} total</Tag>
                    <Tag color={record.blockedItemCount > 0 ? 'red' : 'default'}>{record.blockedItemCount} blocked</Tag>
                    <Tag>{record.commandCount} commands</Tag>
                  </Space>
                )
              },
              {
                title: 'Scope',
                key: 'scope',
                render: (_: unknown, record: DependencyUpgradePlaybookLane) => (
                  <Space size={4} wrap>
                    <Tag>{record.workspaceCount} workspaces</Tag>
                    <Tag>{record.managerCount} managers</Tag>
                  </Space>
                )
              }
            ]}
          />
          <Table
            dataSource={dependencyUpgradeItems}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No upgrade playbook items" /> }}
            columns={[
              {
                title: 'Priority',
                dataIndex: 'priority',
                key: 'priority',
                width: 120,
                render: (priority: DependencyUpgradeLanePriority) => <Tag color={upgradePriorityColor(priority)}>{priority}</Tag>
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyUpgradePlaybookStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Item',
                key: 'item',
                width: 300,
                render: (_: unknown, record: DependencyUpgradePlaybookItem) => (
                  <Space direction="vertical" size={2}>
                    <Text strong>{record.title}</Text>
                    <Text type="secondary">{record.summary}</Text>
                  </Space>
                )
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 190,
                render: (_: unknown, record: DependencyUpgradePlaybookItem) => (
                  <Space size={4} wrap>
                    {record.managerId && <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>}
                    <Tag>{record.workspaceRelativePath || '.'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Owners',
                dataIndex: 'owners',
                key: 'owners',
                width: 190,
                render: (owners: string[]) => owners.length > 0
                  ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
                  : <Tag>unassigned</Tag>
              },
              {
                title: 'Commands',
                key: 'commands',
                width: 130,
                render: (_: unknown, record: DependencyUpgradePlaybookItem) => (
                  <Space size={4} wrap>
                    <Tag>{record.commands.length} run</Tag>
                    <Tag>{record.verificationCommands.length} verify</Tag>
                  </Space>
                )
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {dependencyRollbackPlan && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <RollbackOutlined />
              <Text strong>Dependency rollback plan</Text>
              <Tag color={readinessStatusColor(dependencyRollbackPlan.status)}>
                {readinessStatusLabel(dependencyRollbackPlan.status)}
              </Tag>
              <Tag>{dependencyRollbackPlan.summary.itemCount} items</Tag>
              <Tag>{dependencyRollbackPlan.summary.snapshotCoveredItemCount} snapshot-covered</Tag>
              <Tag color={dependencyRollbackPlan.summary.blockedItemCount > 0 ? 'red' : 'default'}>
                {dependencyRollbackPlan.summary.blockedItemCount} blocked
              </Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyRollbackPlan.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Required: {dependencyRollbackPlan.summary.requiredItemCount}</span>
            <span>Recommended: {dependencyRollbackPlan.summary.recommendedItemCount}</span>
            <span>Optional: {dependencyRollbackPlan.summary.optionalItemCount}</span>
            <span>Lockfile-covered: {dependencyRollbackPlan.summary.lockfileCoveredItemCount}</span>
            <span>Manifests: {dependencyRollbackPlan.summary.manifestCoveredItemCount}</span>
            <span>Git restore: {dependencyRollbackPlan.summary.sourceControlCommandCount}</span>
            <span>Actions: {dependencyRollbackPlan.summary.rollbackActionCount}</span>
            <span>Verify: {dependencyRollbackPlan.summary.verificationCommandCount}</span>
            <span>Failed ops: {dependencyRollbackPlan.summary.recentFailedOperationCount}</span>
          </div>
          <Table
            dataSource={dependencyRollbackItems}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No dependency rollback items" /> }}
            columns={[
              {
                title: 'Priority',
                dataIndex: 'priority',
                key: 'priority',
                width: 125,
                render: (priority: DependencyRollbackPlanPriority) => <Tag color={rollbackPriorityColor(priority)}>{priority}</Tag>
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyRollbackPlanStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 210,
                render: (_: unknown, record: DependencyRollbackPlanItem) => (
                  <Space size={4} wrap>
                    <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
                    <Tag>{record.workspaceRelativePath || '.'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Anchors',
                key: 'anchors',
                width: 270,
                render: (_: unknown, record: DependencyRollbackPlanItem) => (
                  <Space size={4} wrap>
                    {record.anchors.map((anchor) => (
                      <Tag key={`${record.id}:${anchor.kind}`} color={readinessStatusColor(anchor.status)}>
                        {anchor.kind}: {anchor.count ?? 0}
                      </Tag>
                    ))}
                  </Space>
                )
              },
              {
                title: 'Commands',
                key: 'commands',
                width: 155,
                render: (_: unknown, record: DependencyRollbackPlanItem) => (
                  <Space size={4} wrap>
                    <Tag>{record.rollbackActions.length} actions</Tag>
                    <Tag>{record.commands.length} run</Tag>
                    <Tag>{record.verificationCommands.length} verify</Tag>
                  </Space>
                )
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {dependencyImpactAnalysis && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <ExperimentOutlined />
              <Text strong>Dependency impact analysis</Text>
              <Tag color={readinessStatusColor(dependencyImpactAnalysis.status)}>
                {readinessStatusLabel(dependencyImpactAnalysis.status)}
              </Tag>
              <Tag>{dependencyImpactAnalysis.summary.itemCount} items</Tag>
              <Tag>{dependencyImpactAnalysis.summary.workspaceCount} workspaces</Tag>
              <Tag>{dependencyImpactAnalysis.summary.ciJobCount} CI jobs</Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyImpactAnalysis.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Critical: {dependencyImpactAnalysis.summary.criticalItemCount}</span>
            <span>High: {dependencyImpactAnalysis.summary.highItemCount}</span>
            <span>Medium: {dependencyImpactAnalysis.summary.mediumItemCount}</span>
            <span>Missing owners: {dependencyImpactAnalysis.summary.missingOwnerItemCount}</span>
            <span>CI impacted: {dependencyImpactAnalysis.summary.ciImpactedItemCount}</span>
            <span>Release gates: {dependencyImpactAnalysis.summary.releaseGateImpactCount}</span>
            <span>Security: {dependencyImpactAnalysis.summary.securityImpactCount}</span>
            <span>Rollback blocked: {dependencyImpactAnalysis.summary.rollbackBlockedItemCount}</span>
            <span>Verify: {dependencyImpactAnalysis.summary.verificationCommandCount}</span>
          </div>
          <Table
            dataSource={dependencyImpactItems}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No dependency impact items" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 110,
                render: (severity: DependencyImpactSeverity) => <Tag color={dependencyImpactSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyImpactAnalysisStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 210,
                render: (_: unknown, record: DependencyImpactAnalysisItem) => (
                  <Space size={4} wrap>
                    <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
                    <Tag>{record.workspaceRelativePath || '.'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Dimensions',
                dataIndex: 'dimensions',
                key: 'dimensions',
                width: 260,
                render: (dimensions: DependencyImpactDimension[]) => (
                  <Space size={4} wrap>
                    {dimensions.map((dimension) => <Tag key={dimension}>{dimension}</Tag>)}
                  </Space>
                )
              },
              {
                title: 'Owners',
                dataIndex: 'owners',
                key: 'owners',
                width: 180,
                render: (owners: string[]) => owners.length > 0
                  ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
                  : <Tag color="orange">missing</Tag>
              },
              {
                title: 'Impact',
                key: 'impact',
                width: 210,
                render: (_: unknown, record: DependencyImpactAnalysisItem) => (
                  <Space size={4} wrap>
                    <Tag>{record.ciJobs.length} CI</Tag>
                    <Tag>{record.releaseGateCount} gates</Tag>
                    <Tag>{record.riskFindings.length} risks</Tag>
                    <Tag>{record.verificationCommands.length} verify</Tag>
                  </Space>
                )
              },
              {
                title: 'Rollback',
                key: 'rollback',
                width: 160,
                render: (_: unknown, record: DependencyImpactAnalysisItem) => (
                  <Space size={4} wrap>
                    <Tag color={record.rollbackStatus ? readinessStatusColor(record.rollbackStatus) : 'default'}>
                      {record.rollbackStatus || 'missing'}
                    </Tag>
                    <Tag>{record.rollbackActionCount} actions</Tag>
                  </Space>
                )
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {dependencyChangeApprovalPacket && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Dependency change approval packet</Text>
              <Tag color={readinessStatusColor(dependencyChangeApprovalPacket.status)}>
                {readinessStatusLabel(dependencyChangeApprovalPacket.status)}
              </Tag>
              <Tag>{dependencyChangeApprovalPacket.decision}</Tag>
              <Tag>{dependencyChangeApprovalPacket.summary.scopeItemCount} scope items</Tag>
              <Tag>{dependencyChangeApprovalPacket.summary.participantCount} participants</Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyChangeApprovalPacket.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Checklist: {dependencyChangeApprovalPacket.summary.checklistCount}</span>
            <span>Blocked checks: {dependencyChangeApprovalPacket.summary.blockedChecklistCount}</span>
            <span>Warning checks: {dependencyChangeApprovalPacket.summary.warningChecklistCount}</span>
            <span>Approvals: {dependencyChangeApprovalPacket.summary.approvedRecordCount}</span>
            <span>Rejected: {dependencyChangeApprovalPacket.summary.rejectedRecordCount}</span>
            <span>Active exceptions: {dependencyChangeApprovalPacket.summary.activeExceptionCount}</span>
            <span>Trust blocked: {dependencyChangeApprovalPacket.summary.trustBlockedCheckCount}</span>
            <span>Missing owners: {dependencyChangeApprovalPacket.summary.missingOwnerItemCount}</span>
            <span>Verify: {dependencyChangeApprovalPacket.summary.verificationCommandCount}</span>
          </div>
          <Table
            dataSource={dependencyApprovalChecklist}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No approval checklist items" /> }}
            columns={[
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyChangeApprovalCheckStatus) => <Tag color={approvalCheckStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                width: 210,
                render: (source: DependencyChangeApprovalCheckSource) => <Tag>{source}</Tag>
              },
              {
                title: 'Check',
                dataIndex: 'title',
                key: 'title',
                width: 240,
                ellipsis: true
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
          />
          <Table
            dataSource={dependencyChangeApprovalPacket.participants.slice(0, 12)}
            rowKey="owner"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No approval participants" /> }}
            columns={[
              {
                title: 'Role',
                dataIndex: 'role',
                key: 'role',
                width: 150,
                render: (role: DependencyChangeApprovalParticipant['role']) => <Tag>{role}</Tag>
              },
              {
                title: 'Owner / Reviewer',
                dataIndex: 'owner',
                key: 'owner',
                ellipsis: true
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 240,
                render: (_: unknown, record: DependencyChangeApprovalParticipant) => (
                  <Space size={4} wrap>
                    <Tag>{record.workspaceCount} workspaces</Tag>
                    {record.managerIds.map((managerId) => <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>)}
                  </Space>
                )
              },
              {
                title: 'Approvals',
                dataIndex: 'approvalCount',
                key: 'approvalCount',
                width: 110
              }
            ]}
          />
          <Table
            dataSource={dependencyApprovalScopeItems}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No approval scope items" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 110,
                render: (severity: DependencyImpactSeverity) => <Tag color={dependencyImpactSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyChangeApprovalPacketStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 210,
                render: (_: unknown, record: DependencyChangeApprovalScopeItem) => (
                  <Space size={4} wrap>
                    <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
                    <Tag>{record.workspaceRelativePath || '.'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Owners',
                dataIndex: 'owners',
                key: 'owners',
                width: 180,
                render: (owners: string[]) => owners.length > 0
                  ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
                  : <Tag color="orange">missing</Tag>
              },
              {
                title: 'Evidence',
                key: 'evidence',
                width: 220,
                render: (_: unknown, record: DependencyChangeApprovalScopeItem) => (
                  <Space size={4} wrap>
                    <Tag>{record.ciJobCount} CI</Tag>
                    <Tag>{record.releaseGateCount} gates</Tag>
                    <Tag>{record.riskFindingCount} risks</Tag>
                    <Tag>{record.verificationCommandCount} verify</Tag>
                  </Space>
                )
              },
              {
                title: 'Rollback',
                dataIndex: 'rollbackStatus',
                key: 'rollbackStatus',
                width: 130,
                render: (status?: DependencyChangeApprovalPacketStatus) => (
                  <Tag color={status ? readinessStatusColor(status) : 'default'}>{status || 'missing'}</Tag>
                )
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {dependencyChangeCalendar && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <CalendarOutlined />
              <Text strong>Dependency change calendar</Text>
              <Tag color={readinessStatusColor(dependencyChangeCalendar.status)}>
                {readinessStatusLabel(dependencyChangeCalendar.status)}
              </Tag>
              <Tag>{dependencyChangeCalendar.summary.windowCount} windows</Tag>
              <Tag>{dependencyChangeCalendar.summary.freezeWindowCount} freeze windows</Tag>
              <Tag>{dependencyChangeCalendar.summary.verificationCommandCount} verify</Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyChangeCalendar.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Scheduled: {dependencyChangeCalendar.summary.scheduledWindowCount}</span>
            <span>Needs review: {dependencyChangeCalendar.summary.needsReviewWindowCount}</span>
            <span>Frozen: {dependencyChangeCalendar.summary.frozenWindowCount}</span>
            <span>Blocked: {dependencyChangeCalendar.summary.blockedWindowCount}</span>
            <span>Automation: {dependencyChangeCalendar.summary.automationWindowCount}</span>
            <span>Manual review: {dependencyChangeCalendar.summary.manualReviewWindowCount}</span>
            <span>Security hotfix: {dependencyChangeCalendar.summary.securityHotfixWindowCount}</span>
            <span>Missing owners: {dependencyChangeCalendar.summary.missingOwnerItemCount}</span>
            <span>Trust blocked: {dependencyChangeCalendar.summary.trustBlockedCheckCount}</span>
          </div>
          <Table
            dataSource={dependencyFreezeWindows}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No dependency freeze windows" /> }}
            columns={[
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: DependencyChangeCalendarStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Reason',
                dataIndex: 'reason',
                key: 'reason',
                width: 180,
                render: (reason: DependencyChangeFreezeReason) => <Tag color={freezeReasonColor(reason)}>{reason}</Tag>
              },
              {
                title: 'Scope',
                dataIndex: 'scope',
                key: 'scope',
                width: 210,
                ellipsis: true
              },
              {
                title: 'Window',
                key: 'window',
                width: 250,
                render: (_: unknown, record: DependencyChangeFreezeWindow) => (
                  <Space size={4} wrap>
                    <Tag>{record.startsAt}</Tag>
                    <Tag>{record.endsAt || 'open'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Affected',
                key: 'affected',
                width: 170,
                render: (_: unknown, record: DependencyChangeFreezeWindow) => (
                  <Space size={4} wrap>
                    <Tag>{record.affectedWorkspaceCount} workspaces</Tag>
                    <Tag>{record.affectedManagerCount} managers</Tag>
                  </Space>
                )
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={dependencyChangeWindows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No dependency change windows" /> }}
            columns={[
              {
                title: 'Kind',
                dataIndex: 'kind',
                key: 'kind',
                width: 140,
                render: (kind: DependencyChangeWindowKind) => <Tag>{kind}</Tag>
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 130,
                render: (status: DependencyChangeWindowStatus) => <Tag color={changeWindowStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 110,
                render: (severity: DependencyImpactSeverity) => <Tag color={dependencyImpactSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Schedule',
                key: 'schedule',
                width: 250,
                render: (_: unknown, record: DependencyChangeCalendarWindow) => (
                  <Space size={4} wrap>
                    <Tag>{record.startAt || 'unscheduled'}</Tag>
                    <Tag>{record.endAt || '-'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 210,
                render: (_: unknown, record: DependencyChangeCalendarWindow) => (
                  <Space size={4} wrap>
                    <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
                    <Tag>{record.workspaceRelativePath || '.'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Owners',
                dataIndex: 'owners',
                key: 'owners',
                width: 180,
                render: (owners: string[]) => owners.length > 0
                  ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
                  : <Tag color="orange">missing</Tag>
              },
              {
                title: 'Actions',
                dataIndex: 'requiredActions',
                key: 'requiredActions',
                ellipsis: true,
                render: (actions: string[]) => actions.join('; ')
              }
            ]}
          />
        </div>
      )}

      {dependencyChangeExecutionRecord && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <HistoryOutlined />
              <Text strong>Dependency change execution record</Text>
              <Tag color={readinessStatusColor(dependencyChangeExecutionRecord.status)}>
                {readinessStatusLabel(dependencyChangeExecutionRecord.status)}
              </Tag>
              <Tag>{dependencyChangeExecutionRecord.summary.recordCount} records</Tag>
              <Tag>{dependencyChangeExecutionRecord.summary.operationCount} operations</Tag>
              <Tag>{dependencyChangeExecutionRecord.summary.ciEvidenceCount} CI evidence</Tag>
            </Space>
            <Text type="secondary">{new Date(dependencyChangeExecutionRecord.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Completed: {dependencyChangeExecutionRecord.summary.completedRecordCount}</span>
            <span>Pending: {dependencyChangeExecutionRecord.summary.pendingRecordCount}</span>
            <span>Failed: {dependencyChangeExecutionRecord.summary.failedRecordCount}</span>
            <span>Blocked: {dependencyChangeExecutionRecord.summary.blockedRecordCount}</span>
            <span>Unscheduled: {dependencyChangeExecutionRecord.summary.unscheduledRecordCount}</span>
            <span>Missing ops: {dependencyChangeExecutionRecord.summary.missingOperationEvidenceCount}</span>
            <span>Missing CI: {dependencyChangeExecutionRecord.summary.missingCiEvidenceCount}</span>
            <span>Verify failed: {dependencyChangeExecutionRecord.summary.verificationFailedCount}</span>
          </div>
          <Table
            dataSource={dependencyExecutionRecords}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No dependency change execution records" /> }}
            columns={[
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 125,
                render: (status: DependencyChangeExecutionRecordStatus) => <Tag color={executionRecordStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Verify',
                dataIndex: 'verificationStatus',
                key: 'verificationStatus',
                width: 115,
                render: (status: DependencyChangeExecutionVerificationStatus) => <Tag color={executionVerificationStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 210,
                render: (_: unknown, record: DependencyChangeExecutionRecordItem) => (
                  <Space size={4} wrap>
                    <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
                    <Tag>{record.workspaceRelativePath || '.'}</Tag>
                  </Space>
                )
              },
              {
                title: 'Window',
                key: 'window',
                width: 220,
                render: (_: unknown, record: DependencyChangeExecutionRecordItem) => (
                  <Space size={4} wrap>
                    <Tag>{record.windowKind}</Tag>
                    <Tag color={changeWindowStatusColor(record.windowStatus)}>{record.windowStatus}</Tag>
                  </Space>
                )
              },
              {
                title: 'Evidence',
                key: 'evidence',
                width: 230,
                render: (_: unknown, record: DependencyChangeExecutionRecordItem) => (
                  <Space size={4} wrap>
                    <Tag>{record.operationCount} ops</Tag>
                    <Tag color={record.failedOperationCount > 0 ? 'red' : 'default'}>{record.failedOperationCount} failed</Tag>
                    <Tag>{record.ciEvidenceCount} CI</Tag>
                    {record.latestCiStatus && <Tag color={ciEvidenceStatusColor(record.latestCiStatus)}>{record.latestCiStatus}</Tag>}
                  </Space>
                )
              },
              {
                title: 'Gaps',
                dataIndex: 'gaps',
                key: 'gaps',
                width: 280,
                ellipsis: true,
                render: (gaps: string[]) => gaps.join('; ') || '-'
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {renderWorkflowSection(
        'health-policy',
        <SettingOutlined />,
        'Policy',
        `${readinessReport ? `${readinessReport.score}/100` : 'not gated'} / ${licenseRiskCount} license risks / ${policyAsCodePack?.summary.dependencyPolicyRuleCount || 0} rules`
      )}

      {policyAsCodePack && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Policy-as-code pack</Text>
              <Tag color={readinessStatusColor(policyAsCodePack.status)}>
                {readinessStatusLabel(policyAsCodePack.status)}
              </Tag>
              <Tag>{policyAsCodePack.summary.dependencyPolicyRuleCount} rules</Tag>
              <Tag>{policyAsCodePack.summary.readinessGateCount} gates</Tag>
              <Tag>{policyAsCodePack.summary.deploymentPolicyGateCount} deployment gates</Tag>
            </Space>
            <Text type="secondary">{new Date(policyAsCodePack.generatedAt).toLocaleString()}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Managers: {policyAsCodePack.summary.managers.join(', ') || '-'}</span>
            <span>Automation rules: {policyAsCodePack.summary.automationSafetyRuleCount}</span>
            <span>Review routes: {policyAsCodePack.summary.reviewRouteCount}</span>
            <span>Missing owner routes: {policyAsCodePack.summary.missingOwnerRouteCount}</span>
            <span>Required secrets: {policyAsCodePack.summary.requiredSecretCount}</span>
            <span>Required artifacts: {policyAsCodePack.summary.requiredArtifactCount}</span>
            <span>Deployment gates: {policyAsCodePack.summary.deploymentPolicyGateCount}</span>
          </div>
          <Table
            dataSource={policyAsCodePack.pack.enforcement.dependencyPolicyRules.slice(0, 12).map((rule, index) => ({ id: `rule:${index}`, rule }))}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No dependency policy rules" /> }}
            columns={[
              {
                title: 'Dependency policy rule',
                dataIndex: 'rule',
                key: 'rule',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={policyAsCodePack.pack.enforcement.readinessGates.slice(0, 12).map((gate, index) => ({ id: `gate:${index}`, gate }))}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No readiness policy gates" /> }}
            columns={[
              {
                title: 'Readiness gate',
                dataIndex: 'gate',
                key: 'gate',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={policyDeploymentGateRows}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No deployment policy gates" /> }}
            columns={[
              {
                title: 'Deployment policy gate',
                dataIndex: 'gate',
                key: 'gate',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={policyRequiredArtifactRows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No required evidence artifacts" /> }}
            columns={[
              {
                title: 'Required evidence artifact',
                dataIndex: 'artifact',
                key: 'artifact',
                ellipsis: true
              }
            ]}
          />
          <Table
            dataSource={policyAsCodeFindings}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No policy-as-code findings" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 120,
                render: (severity: PolicyAsCodeFindingSeverity) => <Tag color={policyAsCodeSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                width: 170,
                render: (source: PolicyAsCodeFindingSource) => <Tag>{source}</Tag>
              },
              {
                title: 'Finding',
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
          />
        </div>
      )}

      {readinessReport && (
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
          <Table
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
          />
        </div>
      )}

      {licenseReport && (
        <div className={styles.policyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>License compliance</Text>
              <Tag>{licenseReport.summary.licenseCount} licenses</Tag>
              <Tag color={licenseRiskCount > 0 ? 'orange' : 'green'}>
                {licenseRiskCount} risk
              </Tag>
              {licenseReport.policy.requireKnownLicenses && (
                <Tag color="blue">known required</Tag>
              )}
            </Space>
            <Tooltip title={licenseReport.policy.path}>
              <Text type="secondary">{new Date(licenseReport.generatedAt).toLocaleString()}</Text>
            </Tooltip>
          </div>
          <div className={styles.readinessSummary}>
            <span>Components: {licenseReport.summary.componentCount}</span>
            <span>Known: {licenseReport.summary.knownLicenseComponentCount}</span>
            <span>Unknown: {licenseReport.summary.unknownLicenseComponentCount}</span>
            <span>Allowed: {licenseReport.summary.allowedComponentCount}</span>
            <span>Blocked: {licenseReport.summary.blockedLicenseComponentCount}</span>
            <span>Not allowed: {licenseReport.summary.notAllowedLicenseComponentCount}</span>
            <span>Unrestricted: {licenseReport.summary.unrestrictedComponentCount}</span>
            <span>Policy findings: {licenseReport.summary.policyViolationComponentCount}</span>
          </div>
          <Table
            dataSource={licenseRows}
            rowKey="normalizedLicense"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No license metadata captured" /> }}
            columns={[
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 120,
                render: (status: LicenseComplianceStatus) => <Tag color={licenseComplianceStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'License',
                dataIndex: 'license',
                key: 'license',
                width: 180
              },
              {
                title: 'Components',
                dataIndex: 'componentCount',
                key: 'componentCount',
                width: 110
              },
              {
                title: 'Managers',
                dataIndex: 'managers',
                key: 'managers',
                width: 220,
                render: (managerIds: DependencyManagerId[]) => (
                  <Space size={4} wrap>
                    {managerIds.map((managerId) => <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>)}
                  </Space>
                )
              },
              {
                title: 'Packages',
                dataIndex: 'packages',
                key: 'packages',
                ellipsis: true,
                render: (packages: string[]) => packages.join(', ') || '-'
              },
              {
                title: 'Sources',
                dataIndex: 'sources',
                key: 'sources',
                ellipsis: true,
                render: (sources: string[]) => sources.join(', ') || '-'
              }
            ]}
          />
        </div>
      )}

      {thirdPartyNotices && (
        <div className={styles.policyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Third-party notices</Text>
              <Tag>{thirdPartyNotices.summary.noticeCount} notices</Tag>
              <Tag color={thirdPartyNotices.summary.policyViolationCount > 0 ? 'orange' : 'green'}>
                {thirdPartyNotices.summary.policyViolationCount} policy
              </Tag>
              <Tag>{thirdPartyNotices.summary.unknownLicenseComponentCount} unknown</Tag>
            </Space>
            <Tooltip title={thirdPartyNotices.policy.path}>
              <Text type="secondary">{new Date(thirdPartyNotices.generatedAt).toLocaleString()}</Text>
            </Tooltip>
          </div>
          <div className={styles.readinessSummary}>
            <span>Components: {thirdPartyNotices.summary.componentCount}</span>
            <span>Known: {thirdPartyNotices.summary.knownLicenseComponentCount}</span>
            <span>Unknown: {thirdPartyNotices.summary.unknownLicenseComponentCount}</span>
            <span>Distinct licenses: {thirdPartyNotices.summary.distinctLicenseCount}</span>
            <span>Managers: {thirdPartyNotices.summary.managerCount}</span>
            <span>Blocked: {thirdPartyNotices.summary.blockedLicenseComponentCount}</span>
            <span>Not allowed: {thirdPartyNotices.summary.notAllowedLicenseComponentCount}</span>
          </div>
          <Table
            dataSource={thirdPartyNoticeRows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No third-party notices captured" /> }}
            columns={[
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 120,
                render: (status: LicenseComplianceStatus) => <Tag color={licenseComplianceStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Manager',
                dataIndex: 'managerId',
                key: 'managerId',
                width: 120,
                render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
              },
              {
                title: 'Package',
                dataIndex: 'name',
                key: 'name',
                width: 220,
                ellipsis: true
              },
              {
                title: 'Version',
                dataIndex: 'version',
                key: 'version',
                width: 140,
                render: (version?: string) => version || '-'
              },
              {
                title: 'License',
                dataIndex: 'licenseExpression',
                key: 'licenseExpression',
                width: 180,
                ellipsis: true
              },
              {
                title: 'Source',
                dataIndex: 'sourceFile',
                key: 'sourceFile',
                ellipsis: true
              },
              {
                title: 'Recommendation',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>

        <div className={styles.toolGroup}>
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
        </div>
      </div>

      {renderWorkflowSection(
        'health-reproducibility',
        <RollbackOutlined />,
        'Reproducibility',
        `${snapshots.length} snapshots / ${dependencyHighRiskCount} dependency high+ / ${offlineCacheReport?.summary.findingCount || 0} offline findings`
      )}

      {snapshotDiff && (
        <Alert
          type={snapshotDiff.changed.length || snapshotDiff.added.length || snapshotDiff.removed.length ? 'warning' : 'success'}
          showIcon
          title={`与快照 ${snapshotDiff.fromSnapshotId} 对比`}
          description={
            <Space direction="vertical" size={4}>
              <span>新增: {snapshotDiff.added.length ? snapshotDiff.added.join(', ') : '无'}</span>
              <span>移除: {snapshotDiff.removed.length ? snapshotDiff.removed.join(', ') : '无'}</span>
              <span>变更: {snapshotDiff.changed.length ? snapshotDiff.changed.map((item) => item.file).join(', ') : '无'}</span>
              <span>未变更: {snapshotDiff.unchanged.length}</span>
            </Space>
          }
        />
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Release trust policy</Text>
              {releaseTrustPolicy ? (
                <>
                  <Tag color={readinessStatusColor(releaseTrustPolicy.status)}>
                    {readinessStatusLabel(releaseTrustPolicy.status)}
                  </Tag>
                  <Tag>{releaseTrustPolicy.summary.passedCheckCount}/{releaseTrustPolicy.summary.checkCount} passed</Tag>
                  <Tag color={releaseTrustPolicy.summary.blockedCheckCount > 0 ? 'red' : 'green'}>
                    {releaseTrustPolicy.summary.blockedCheckCount} blocked
                  </Tag>
                </>
              ) : (
                <Tag>Not checked</Tag>
              )}
            </Space>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseTrustPolicy} loading={reporting}>
                Check trust
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseTrustPolicy('markdown')} loading={reporting}>
                Export trust
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseTrustPolicy('json')} loading={reporting}>
                Export trust JSON
              </Button>
            </Space>
          </div>
          {releaseTrustPolicy && (
            <>
              <div className={styles.readinessSummary}>
                <span>Passed: {releaseTrustPolicy.summary.passedCheckCount}</span>
                <span>Warnings: {releaseTrustPolicy.summary.warningCheckCount}</span>
                <span>Blocked: {releaseTrustPolicy.summary.blockedCheckCount}</span>
                <span>Source errors: {releaseTrustPolicy.summary.sourceErrorCount}</span>
                <span>Signed: {releaseTrustPolicy.summary.signed ? 'yes' : 'no'}</span>
                <span>Signature verified: {releaseTrustPolicy.summary.signatureVerified ? 'yes' : 'no'}</span>
                <span>Integrity verified: {releaseTrustPolicy.summary.integrityVerifiedArtifactCount}</span>
                <span>Approvals: {releaseTrustPolicy.summary.approvalRecordCount}</span>
                <span>Active exceptions: {releaseTrustPolicy.summary.activeExceptionCount}</span>
              </div>
              <Table
                dataSource={releaseTrustPolicyRows}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 6 }}
                locale={{ emptyText: <Empty description="No release trust checks" /> }}
                columns={[
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 120,
                    render: (status: ReleaseTrustPolicyCheckStatus) => (
                      <Tag color={status === 'passed' ? 'green' : status === 'blocked' ? 'red' : status === 'warning' ? 'orange' : 'blue'}>{status}</Tag>
                    )
                  },
                  {
                    title: 'Source',
                    dataIndex: 'source',
                    key: 'source',
                    width: 160,
                    render: (source: ReleaseTrustPolicySource) => <Tag>{source}</Tag>
                  },
                  {
                    title: 'Check',
                    key: 'check',
                    width: 260,
                    render: (_: unknown, record: ReleaseTrustPolicyCheck) => (
                      <Space direction="vertical" size={2}>
                        <Text strong>{record.title}</Text>
                        <Text type="secondary">{record.summary}</Text>
                      </Space>
                    )
                  },
                  {
                    title: 'Recommendation',
                    dataIndex: 'recommendation',
                    key: 'recommendation',
                    ellipsis: true
                  }
                ]}
              />
            </>
          )}
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Release signature</Text>
              {releaseSignature ? (
                <>
                  <Tag color={readinessStatusColor(releaseSignature.status)}>
                    {readinessStatusLabel(releaseSignature.status)}
                  </Tag>
                  <Tag color={releaseSignature.summary.signed ? 'green' : 'orange'}>
                    {releaseSignature.summary.signed ? 'signed' : 'unsigned'}
                  </Tag>
                  <Tag>{releaseSignature.summary.verificationStatus}</Tag>
                </>
              ) : (
                <Tag>Not checked</Tag>
              )}
            </Space>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseSignature} loading={reporting}>
                Verify signature
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseSignature('markdown')} loading={reporting}>
                Export signature
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseSignature('json')} loading={reporting}>
                Export signature JSON
              </Button>
            </Space>
          </div>
          {releaseSignature && (
            <>
              <div className={styles.readinessSummary}>
                <span>Sources: {releaseSignature.summary.includedSourceCount}/{releaseSignature.summary.sourceCount}</span>
                <span>Missing: {releaseSignature.summary.missingSourceCount}</span>
                <span>Source errors: {releaseSignature.summary.sourceErrorCount}</span>
                <span>Blocked sources: {releaseSignature.summary.blockedSourceReportCount}</span>
                <span>Warning sources: {releaseSignature.summary.warningSourceReportCount}</span>
                <span>Algorithm: {releaseSignature.signature.algorithm}</span>
                <span>Key ID: {releaseSignature.signature.keyId || '-'}</span>
                <span>Payload: {releaseSignature.payload.sha256.slice(0, 16)}</span>
                <span>Findings: {releaseSignature.summary.findingCount}</span>
              </div>
              <Table
                dataSource={releaseSignatureSourceRows}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty description="No release signature sources" /> }}
                columns={[
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 120,
                    render: (status: ReleaseSignatureSourceStatus) => (
                      <Tag color={status === 'included' ? 'green' : status === 'missing' ? 'red' : 'orange'}>{status}</Tag>
                    )
                  },
                  {
                    title: 'Source',
                    key: 'source',
                    width: 280,
                    render: (_: unknown, record: ReleaseSignatureSource) => (
                      <Space direction="vertical" size={2}>
                        <Text strong>{record.label}</Text>
                        <Text type="secondary">{record.relativePath}</Text>
                      </Space>
                    )
                  },
                  {
                    title: 'Report',
                    dataIndex: 'reportStatus',
                    key: 'reportStatus',
                    width: 120,
                    render: (status?: string) => status ? <Tag color={readinessStatusColor(status as ReleaseSignatureStatus)}>{status}</Tag> : '-'
                  },
                  {
                    title: 'Size',
                    dataIndex: 'sizeBytes',
                    key: 'sizeBytes',
                    width: 100,
                    render: (size?: number) => typeof size === 'number' ? formatArtifactBytes(size) : '-'
                  },
                  {
                    title: 'SHA-256',
                    dataIndex: 'sha256',
                    key: 'sha256',
                    width: 150,
                    render: (hash?: string) => hash ? <Text code>{hash.slice(0, 16)}</Text> : '-'
                  },
                  {
                    title: 'Error',
                    dataIndex: 'error',
                    key: 'error',
                    ellipsis: true,
                    render: (error?: string) => error || '-'
                  }
                ]}
              />
              <Table
                dataSource={releaseSignatureFindings}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty description="No release signature findings" /> }}
                columns={[
                  {
                    title: 'Severity',
                    dataIndex: 'severity',
                    key: 'severity',
                    width: 120,
                    render: (severity: ReleaseSignatureSeverity) => <Tag color={ciWarningColor(severity)}>{severity}</Tag>
                  },
                  {
                    title: 'Finding',
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
              />
            </>
          )}
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <WarningOutlined />
              <Text strong>Vulnerability remediation plan</Text>
              {vulnerabilityRemediationPlan && (
                <Tag color={readinessStatusColor(vulnerabilityRemediationPlan.status)}>
                  {readinessStatusLabel(vulnerabilityRemediationPlan.status)}
                </Tag>
              )}
              <Tag>{vulnerabilityRemediationPlan?.summary.itemCount || 0} actions</Tag>
              <Tag color={(vulnerabilityRemediationPlan?.summary.immediateItemCount || 0) > 0 ? 'red' : 'default'}>
                {vulnerabilityRemediationPlan?.summary.immediateItemCount || 0} immediate
              </Tag>
            </Space>
            <Space wrap>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportVulnerabilityRemediationPlan('markdown')} loading={reporting}>
                Export remediation
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportVulnerabilityRemediationPlan('json')} loading={reporting}>
                Export remediation JSON
              </Button>
            </Space>
          </div>
          <div className={styles.readinessSummary}>
            <span>Findings: {vulnerabilityRemediationPlan?.summary.findingCount || 0}</span>
            <span>Fix available: {vulnerabilityRemediationPlan?.summary.fixAvailableFindingCount || 0}</span>
            <span>No captured fix: {vulnerabilityRemediationPlan?.summary.fixUnavailableFindingCount || 0}</span>
            <span>Managers: {vulnerabilityRemediationPlan?.summary.managers.join(', ') || '-'}</span>
            <span>Commands: {vulnerabilityRemediationPlan?.summary.commandCount || 0}</span>
          </div>
          <Table
            dataSource={vulnerabilityRemediationRows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            locale={{ emptyText: <Empty description="No vulnerability remediation actions" /> }}
            columns={[
              {
                title: 'Priority',
                dataIndex: 'priority',
                key: 'priority',
                width: 120,
                render: (priority: VulnerabilityRemediationPriority) => <Tag color={vulnerabilityRemediationPriorityColor(priority)}>{priority}</Tag>
              },
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 110,
                render: (severity: AuditEvidenceSeverity) => <Tag color={auditEvidenceSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Package',
                dataIndex: 'packageName',
                key: 'packageName',
                width: 210,
                render: (value: string | undefined, record: VulnerabilityRemediationItem) => (
                  <Space size={4} wrap>
                    {record.managerId && <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>}
                    <span>{value || '-'}</span>
                  </Space>
                )
              },
              {
                title: 'Fixed',
                dataIndex: 'fixedVersion',
                key: 'fixedVersion',
                width: 150,
                render: (value?: string) => value || '-'
              },
              {
                title: 'Findings',
                dataIndex: 'findingCount',
                key: 'findingCount',
                width: 90
              },
              {
                title: 'Command',
                dataIndex: 'recommendedCommand',
                key: 'recommendedCommand',
                ellipsis: true
              },
              {
                title: 'Verify',
                dataIndex: 'verificationCommand',
                key: 'verificationCommand',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Release evidence completeness</Text>
              {releaseEvidenceCompleteness ? (
                <>
                  <Tag color={readinessStatusColor(releaseEvidenceCompleteness.status)}>
                    {readinessStatusLabel(releaseEvidenceCompleteness.status)}
                  </Tag>
              <Tag>{releaseEvidenceCompleteness.summary.presentArtifactCount}/{releaseEvidenceCompleteness.summary.expectedArtifactCount} present</Tag>
              <Tag color={releaseEvidenceCompleteness.summary.missingRequiredArtifactCount > 0 ? 'red' : 'green'}>
                {releaseEvidenceCompleteness.summary.missingRequiredArtifactCount} required missing
              </Tag>
              <Tag color={releaseEvidenceCompleteness.summary.requiredIntegrityMismatchCount > 0 ? 'red' : 'green'}>
                {releaseEvidenceCompleteness.summary.requiredIntegrityMismatchCount} integrity mismatch
              </Tag>
                </>
              ) : (
                <Tag>Not checked</Tag>
              )}
            </Space>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseEvidenceCompleteness} loading={reporting}>
                Check evidence
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseEvidenceCompleteness('markdown')} loading={reporting}>
                Export evidence check
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseEvidenceCompleteness('json')} loading={reporting}>
                Export evidence JSON
              </Button>
            </Space>
          </div>
          {releaseEvidenceCompleteness && (
            <>
              <div className={styles.readinessSummary}>
                <span>Required: {releaseEvidenceCompleteness.summary.requiredArtifactCount}</span>
                <span>Missing: {releaseEvidenceCompleteness.summary.missingArtifactCount}</span>
                <span>Failed: {releaseEvidenceCompleteness.summary.failedArtifactCount}</span>
                <span>Integrity mismatches: {releaseEvidenceCompleteness.summary.integrityMismatchCount}</span>
                <span>Policy required: {releaseEvidenceCompleteness.summary.policyRequiredArtifactCount}</span>
                <span>Bundle artifacts: {releaseEvidenceCompleteness.summary.releaseBundleArtifactCount}</span>
                <span>Report library: {releaseEvidenceCompleteness.summary.reportArtifactCount}</span>
                <span>Findings: {releaseEvidenceCompleteness.summary.findingCount}</span>
              </div>
              <Table
                dataSource={releaseEvidenceExpectedRows}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 8 }}
                locale={{ emptyText: <Empty description="No expected release evidence artifacts" /> }}
                columns={[
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 100,
                    render: (status: ReleaseEvidenceExpectedArtifact['status']) => (
                      <Tag color={status === 'present' ? 'green' : status === 'failed' || status === 'mismatch' ? 'red' : 'orange'}>{status}</Tag>
                    )
                  },
                  {
                    title: 'Integrity',
                    dataIndex: 'integrityStatus',
                    key: 'integrityStatus',
                    width: 120,
                    render: (status: ReleaseEvidenceExpectedArtifact['integrityStatus']) => (
                      <Tag color={status === 'verified' ? 'green' : status === 'mismatch' ? 'red' : 'default'}>{status}</Tag>
                    )
                  },
                  {
                    title: 'Required',
                    dataIndex: 'required',
                    key: 'required',
                    width: 100,
                    render: (required: boolean) => <Tag color={required ? 'red' : 'default'}>{required ? 'required' : 'optional'}</Tag>
                  },
                  {
                    title: 'Source',
                    dataIndex: 'source',
                    key: 'source',
                    width: 150,
                    render: (source: ReleaseEvidenceCompletenessSource) => <Tag>{source}</Tag>
                  },
                  {
                    title: 'Artifact',
                    dataIndex: 'label',
                    key: 'label',
                    width: 260,
                    ellipsis: true
                  },
                  {
                    title: 'Expected path',
                    dataIndex: 'expectedPath',
                    key: 'expectedPath',
                    ellipsis: true,
                    render: (path?: string) => path || '-'
                  },
                  {
                    title: 'Matches',
                    dataIndex: 'matchedArtifactCount',
                    key: 'matchedArtifactCount',
                    width: 90
                  }
                ]}
              />
              <Table
                dataSource={releaseEvidenceFindings}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty description="No release evidence completeness findings" /> }}
                columns={[
                  {
                    title: 'Severity',
                    dataIndex: 'severity',
                    key: 'severity',
                    width: 120,
                    render: (severity: ReleaseEvidenceCompletenessSeverity) => <Tag color={ciWarningColor(severity)}>{severity}</Tag>
                  },
                  {
                    title: 'Source',
                    dataIndex: 'source',
                    key: 'source',
                    width: 150,
                    render: (source: ReleaseEvidenceCompletenessSource) => <Tag>{source}</Tag>
                  },
                  {
                    title: 'Finding',
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
              />
            </>
          )}
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Release provenance attestation</Text>
              {releaseProvenanceAttestation ? (
                <>
                  <Tag color={readinessStatusColor(releaseProvenanceAttestation.status)}>
                    {readinessStatusLabel(releaseProvenanceAttestation.status)}
                  </Tag>
                  <Tag>{releaseProvenanceAttestation.summary.artifactCount} digests</Tag>
                  <Tag color={releaseProvenanceAttestation.summary.gitDirty ? 'orange' : 'green'}>
                    {releaseProvenanceAttestation.summary.gitDirty ? 'dirty Git' : 'clean Git'}
                  </Tag>
                </>
              ) : (
                <Tag>Not checked</Tag>
              )}
            </Space>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseProvenanceAttestation} loading={reporting}>
                Check provenance
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseProvenanceAttestation('markdown')} loading={reporting}>
                Export provenance
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseProvenanceAttestation('json')} loading={reporting}>
                Export provenance JSON
              </Button>
            </Space>
          </div>
          {releaseProvenanceAttestation && (
            <>
              <div className={styles.readinessSummary}>
                <span>Project: {releaseProvenanceAttestation.project.name}</span>
                <span>Version: {releaseProvenanceAttestation.project.version || '-'}</span>
                <span>Branch: {releaseProvenanceAttestation.git.branch || '-'}</span>
                <span>Commit: {releaseProvenanceAttestation.git.shortCommit || '-'}</span>
                <span>Changed files: {releaseProvenanceAttestation.git.changedFileCount ?? '-'}</span>
                <span>Bundle artifacts: {releaseProvenanceAttestation.summary.releaseBundleArtifactCount}</span>
                <span>Required bundle: {releaseProvenanceAttestation.summary.requiredBundleArtifactCount}</span>
                <span>Missing required: {releaseProvenanceAttestation.summary.missingRequiredEvidenceCount}</span>
                <span>Integrity mismatches: {releaseProvenanceAttestation.summary.integrityMismatchCount}</span>
                <span>Source errors: {releaseProvenanceAttestation.summary.sourceErrorCount}</span>
              </div>
              <Table
                dataSource={releaseProvenanceArtifactRows}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 6 }}
                locale={{ emptyText: <Empty description="No provenance artifact digests" /> }}
                columns={[
                  {
                    title: 'Artifact',
                    key: 'artifact',
                    width: 260,
                    render: (_: unknown, record: ReleaseProvenanceEvidenceDigest) => (
                      <Space direction="vertical" size={2}>
                        <Text strong>{record.label}</Text>
                        <Text type="secondary">{record.relativePath}</Text>
                      </Space>
                    )
                  },
                  {
                    title: 'Category',
                    dataIndex: 'category',
                    key: 'category',
                    width: 130,
                    render: (category: ReportArtifactCategory) => <Tag color={reportArtifactCategoryColor(category)}>{category}</Tag>
                  },
                  {
                    title: 'Format',
                    dataIndex: 'format',
                    key: 'format',
                    width: 100,
                    render: (format: ReportArtifactFormat) => <Tag color={reportArtifactFormatColor(format)}>{format}</Tag>
                  },
                  {
                    title: 'Size',
                    dataIndex: 'sizeBytes',
                    key: 'sizeBytes',
                    width: 100,
                    render: (size: number) => formatArtifactBytes(size)
                  },
                  {
                    title: 'SHA-256',
                    dataIndex: 'sha256',
                    key: 'sha256',
                    width: 150,
                    render: (hash: string) => <Text code>{hash.slice(0, 16)}</Text>
                  },
                  {
                    title: 'Modified',
                    dataIndex: 'modifiedAt',
                    key: 'modifiedAt',
                    width: 170,
                    render: (value: string) => new Date(value).toLocaleString()
                  }
                ]}
              />
            </>
          )}
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Release integrity verification</Text>
              {releaseIntegrityVerification ? (
                <>
                  <Tag color={readinessStatusColor(releaseIntegrityVerification.status)}>
                    {readinessStatusLabel(releaseIntegrityVerification.status)}
                  </Tag>
                  <Tag>{releaseIntegrityVerification.summary.verifiedArtifactCount}/{releaseIntegrityVerification.summary.artifactCount} verified</Tag>
                  <Tag color={releaseIntegrityVerification.summary.requiredMismatchArtifactCount > 0 ? 'red' : 'green'}>
                    {releaseIntegrityVerification.summary.requiredMismatchArtifactCount} required mismatch
                  </Tag>
                </>
              ) : (
                <Tag>Not checked</Tag>
              )}
            </Space>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshReleaseIntegrityVerification} loading={reporting}>
                Verify integrity
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseIntegrityVerification('markdown')} loading={reporting}>
                Export verification
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReleaseIntegrityVerification('json')} loading={reporting}>
                Export verification JSON
              </Button>
            </Space>
          </div>
          {releaseIntegrityVerification && (
            <>
              <div className={styles.readinessSummary}>
                <span>Required: {releaseIntegrityVerification.summary.requiredArtifactCount}</span>
                <span>Missing: {releaseIntegrityVerification.summary.missingArtifactCount}</span>
                <span>Mismatched: {releaseIntegrityVerification.summary.mismatchArtifactCount}</span>
                <span>Failed recorded: {releaseIntegrityVerification.summary.failedRecordedArtifactCount}</span>
                <span>Unverifiable: {releaseIntegrityVerification.summary.unverifiableArtifactCount}</span>
                <span>Provenance matched: {releaseIntegrityVerification.summary.provenanceMatchedArtifactCount}</span>
                <span>Provenance mismatch: {releaseIntegrityVerification.summary.provenanceMismatchArtifactCount}</span>
                <span>Findings: {releaseIntegrityVerification.summary.findingCount}</span>
              </div>
              <Table
                dataSource={releaseIntegrityArtifactRows}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 7 }}
                locale={{ emptyText: <Empty description="No release integrity artifacts" /> }}
                columns={[
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 130,
                    render: (status: ReleaseIntegrityArtifactStatus) => (
                      <Tag color={status === 'verified' ? 'green' : status === 'mismatch' || status === 'missing' || status === 'failed-recorded' ? 'red' : 'orange'}>{status}</Tag>
                    )
                  },
                  {
                    title: 'Provenance',
                    dataIndex: 'provenanceStatus',
                    key: 'provenanceStatus',
                    width: 130,
                    render: (status: ReleaseIntegrityProvenanceStatus) => (
                      <Tag color={status === 'matched' ? 'green' : status === 'mismatch' ? 'orange' : 'default'}>{status}</Tag>
                    )
                  },
                  {
                    title: 'Required',
                    dataIndex: 'required',
                    key: 'required',
                    width: 100,
                    render: (required: boolean) => <Tag color={required ? 'red' : 'default'}>{required ? 'required' : 'optional'}</Tag>
                  },
                  {
                    title: 'Artifact',
                    key: 'artifact',
                    width: 260,
                    render: (_: unknown, record: ReleaseIntegrityVerifiedArtifact) => (
                      <Space direction="vertical" size={2}>
                        <Text strong>{record.label}</Text>
                        <Text type="secondary">{record.relativePath || record.path || '-'}</Text>
                      </Space>
                    )
                  },
                  {
                    title: 'Kind',
                    dataIndex: 'kind',
                    key: 'kind',
                    width: 170,
                    render: (kind: ReleaseBundleArtifactKind) => <Tag>{kind}</Tag>
                  },
                  {
                    title: 'Expected',
                    dataIndex: 'expectedSha256',
                    key: 'expectedSha256',
                    width: 140,
                    render: (hash?: string) => hash ? <Text code>{hash.slice(0, 16)}</Text> : '-'
                  },
                  {
                    title: 'Actual',
                    dataIndex: 'actualSha256',
                    key: 'actualSha256',
                    width: 140,
                    render: (hash?: string) => hash ? <Text code>{hash.slice(0, 16)}</Text> : '-'
                  },
                  {
                    title: 'Issues',
                    dataIndex: 'issues',
                    key: 'issues',
                    ellipsis: true,
                    render: (issues: string[]) => issues.join('; ') || '-'
                  }
                ]}
              />
              <Table
                dataSource={releaseIntegrityFindings}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty description="No release integrity findings" /> }}
                columns={[
                  {
                    title: 'Severity',
                    dataIndex: 'severity',
                    key: 'severity',
                    width: 120,
                    render: (severity: ReleaseIntegrityVerificationSeverity) => <Tag color={ciWarningColor(severity)}>{severity}</Tag>
                  },
                  {
                    title: 'Finding',
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
              />
            </>
          )}
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <FolderOpenOutlined />
              <Text strong>Report library</Text>
              <Tag>{reportArtifactIndex?.summary.artifactCount || 0} artifacts</Tag>
              {reportArtifactIndex && (
                <>
                  <Tag color="blue">{formatArtifactBytes(reportArtifactIndex.summary.totalSizeBytes)}</Tag>
                  <Tag>{reportArtifactIndex.summary.latestModifiedAt ? new Date(reportArtifactIndex.summary.latestModifiedAt).toLocaleString() : 'No reports'}</Tag>
                </>
              )}
            </Space>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshReportArtifactIndex} loading={reporting}>
                Refresh reports
              </Button>
              <Button size="small" icon={<FolderOpenOutlined />} onClick={openReportArtifactDirectory}>
                Open reports folder
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReportArtifactIndex('markdown')} loading={reporting}>
                Export index
              </Button>
              <Button size="small" icon={<ExportOutlined />} onClick={() => exportReportArtifactIndex('json')} loading={reporting}>
                Export JSON
              </Button>
            </Space>
          </div>
          {reportArtifactIndex && (
            <div className={styles.readinessSummary}>
              <span>Inventory: {reportArtifactIndex.summary.categoryCounts.inventory}</span>
              <span>Workspace: {reportArtifactIndex.summary.categoryCounts.workspace}</span>
              <span>Release: {reportArtifactIndex.summary.categoryCounts.release}</span>
              <span>Risk: {reportArtifactIndex.summary.categoryCounts.risk}</span>
              <span>Evidence: {reportArtifactIndex.summary.categoryCounts.evidence}</span>
              <span>Automation: {reportArtifactIndex.summary.categoryCounts.automation}</span>
              <span>Policy: {reportArtifactIndex.summary.categoryCounts.policy}</span>
              <span>Security: {reportArtifactIndex.summary.categoryCounts.security}</span>
              <span>Reproducibility: {reportArtifactIndex.summary.categoryCounts.reproducibility}</span>
            </div>
          )}
          <div className={styles.historyControls}>
            <Text type="secondary">
              {reportArtifactRows.length}/{reportArtifactIndex?.summary.artifactCount || 0} artifact(s)
            </Text>
            <Select
              size="small"
              value={artifactCategoryFilter}
              onChange={(value: 'all' | ReportArtifactCategory) => setArtifactCategoryFilter(value)}
              options={REPORT_ARTIFACT_CATEGORY_OPTIONS}
              style={{ width: 170 }}
            />
            <Select
              size="small"
              value={artifactFormatFilter}
              onChange={(value: 'all' | ReportArtifactFormat) => setArtifactFormatFilter(value)}
              options={REPORT_ARTIFACT_FORMAT_OPTIONS}
              style={{ width: 140 }}
            />
            <Input.Search
              allowClear
              size="small"
              placeholder="Search reports, paths, hashes"
              value={artifactSearchTerm}
              onChange={(event) => setArtifactSearchTerm(event.target.value)}
              style={{ width: 260 }}
            />
          </div>
          <Table
            dataSource={reportArtifactRows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            locale={{ emptyText: <Empty description="No generated report artifacts found" /> }}
            columns={[
              {
                title: 'Artifact',
                key: 'artifact',
                width: 260,
                render: (_: unknown, record: ReportArtifactRecord) => (
                  <Space direction="vertical" size={2}>
                    <Text strong>{record.name}</Text>
                    <Text type="secondary">{record.relativePath}</Text>
                  </Space>
                )
              },
              {
                title: 'Category',
                dataIndex: 'category',
                key: 'category',
                width: 130,
                render: (category: ReportArtifactCategory) => <Tag color={reportArtifactCategoryColor(category)}>{category}</Tag>
              },
              {
                title: 'Format',
                dataIndex: 'format',
                key: 'format',
                width: 100,
                render: (format: ReportArtifactFormat) => <Tag color={reportArtifactFormatColor(format)}>{format}</Tag>
              },
              {
                title: 'Size',
                dataIndex: 'sizeBytes',
                key: 'sizeBytes',
                width: 100,
                render: (size: number) => formatArtifactBytes(size)
              },
              {
                title: 'SHA-256',
                dataIndex: 'sha256',
                key: 'sha256',
                width: 150,
                render: (hash: string) => <Text code>{hash.slice(0, 16)}</Text>
              },
              {
                title: 'Modified',
                dataIndex: 'modifiedAt',
                key: 'modifiedAt',
                width: 170,
                render: (value: string) => new Date(value).toLocaleString()
              },
              {
                title: 'Action',
                key: 'action',
                width: 100,
                render: (_: unknown, record: ReportArtifactRecord) => (
                  <Button size="small" icon={<FolderOpenOutlined />} onClick={() => void window.electronAPI.system.openFile(record.path)}>
                    Open
                  </Button>
                )
              }
            ]}
          />
        </div>
      )}

      {renderWorkflowSection(
        'health-workspaces',
        <ApartmentOutlined />,
        'Workspaces',
        `${workspaceGovernanceReport?.summary.workspaceCount || workspaceReport?.summary.workspaceCount || 0} workspaces / ${workspaceGovernanceReport?.summary.blocked || 0} blocked / ${workspaceGovernanceReport?.summary.warning || 0} warning`
      )}

      {currentPath && (
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
          <Table
            dataSource={workspaceGovernanceRows}
            rowKey={(record) => record.workspace.id}
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No workspace governance results" /> }}
            columns={[
              {
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
              },
              {
                title: 'Workspace',
                key: 'workspace',
                width: 230,
                render: (_: unknown, record: WorkspaceGovernanceNode) => (
                  <Space direction="vertical" size={2}>
                    <Text strong>{record.workspace.name}</Text>
                    <Text type="secondary">{record.workspace.relativePath}</Text>
                  </Space>
                )
              },
              {
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
              },
              {
                title: 'Components',
                dataIndex: 'componentCount',
                key: 'componentCount',
                width: 110
              },
              {
                title: 'Policy',
                dataIndex: 'policyViolationCount',
                key: 'policyViolationCount',
                width: 96,
                render: (count: number, record: WorkspaceGovernanceNode) => (
                  <Tag color={record.highSeverityPolicyViolationCount > 0 ? 'red' : count > 0 ? 'orange' : 'green'}>
                    {count}
                  </Tag>
                )
              },
              {
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
              },
              {
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
              },
              {
                title: 'CI source',
                dataIndex: 'ciEvidenceSource',
                key: 'ciEvidenceSource',
                width: 130,
                render: (source: WorkspaceCiEvidenceSource, record: WorkspaceGovernanceNode) => (
                  <Tooltip title={record.ciEvidencePath || 'No CI evidence'}>
                    <Tag color={workspaceCiEvidenceSourceColor(source)}>{source}</Tag>
                  </Tooltip>
                )
              },
              {
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
              },
              {
                title: 'Approval source',
                dataIndex: 'releaseApprovalSource',
                key: 'releaseApprovalSource',
                width: 150,
                render: (source: WorkspaceReleaseApprovalSource, record: WorkspaceGovernanceNode) => (
                  <Tooltip title={record.releaseApprovalPath || 'No release approval evidence'}>
                    <Tag color={workspaceReleaseApprovalSourceColor(source)}>{source}</Tag>
                  </Tooltip>
                )
              },
              {
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
              },
              {
                title: 'Exception source',
                dataIndex: 'releaseExceptionSource',
                key: 'releaseExceptionSource',
                width: 150,
                render: (source: WorkspaceReleaseExceptionSource, record: WorkspaceGovernanceNode) => (
                  <Tooltip title={record.releaseExceptionPath || 'No release exception evidence'}>
                    <Tag color={workspaceReleaseExceptionSourceColor(source)}>{source}</Tag>
                  </Tooltip>
                )
              },
              {
                title: 'Source',
                dataIndex: 'policySource',
                key: 'policySource',
                width: 130,
                render: (source: WorkspacePolicySource, record: WorkspaceGovernanceNode) => (
                  <Tooltip title={record.policyPath || 'No dependency policy'}>
                    <Tag color={workspacePolicySourceColor(source)}>{source}</Tag>
                  </Tooltip>
                )
              },
              {
                title: 'Gate source',
                dataIndex: 'readinessPolicySource',
                key: 'readinessPolicySource',
                width: 140,
                render: (source: WorkspaceReadinessPolicySource, record: WorkspaceGovernanceNode) => (
                  <Tooltip title={record.readinessPolicyPath || 'No readiness policy'}>
                    <Tag color={workspaceReadinessPolicySourceColor(source)}>{source}</Tag>
                  </Tooltip>
                )
              },
              {
                title: 'Snapshots',
                dataIndex: 'snapshotCount',
                key: 'snapshotCount',
                width: 100,
                render: (count: number, record: WorkspaceGovernanceNode) => (
                  <Tooltip title={`${record.snapshotCoveredFileCount} covered dependency file(s)`}>
                    <Tag color={count > 0 ? 'green' : 'default'}>{count}</Tag>
                  </Tooltip>
                )
              },
              {
                title: 'Snapshot source',
                dataIndex: 'snapshotSource',
                key: 'snapshotSource',
                width: 150,
                render: (source: WorkspaceSnapshotSource, record: WorkspaceGovernanceNode) => (
                  <Tooltip title={record.snapshotPath || 'No rollback snapshot'}>
                    <Tag color={workspaceSnapshotSourceColor(source)}>{source}</Tag>
                  </Tooltip>
                )
              },
              {
                title: 'Missing locks',
                dataIndex: 'missingLockManagers',
                key: 'missingLockManagers',
                width: 160,
                render: (managerIds: DependencyManagerId[]) => managerIds.length
                  ? managerIds.map((managerId) => <Tag key={managerId} color="orange">{managerId}</Tag>)
                  : <Tag color="green">covered</Tag>
              },
              {
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
            ]}
          />
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <ApartmentOutlined />
              <Text strong>Workspace discovery</Text>
              <Tag>{workspaceReport?.summary.workspaceCount || 0} workspaces</Tag>
              <Tag>{workspaceReport?.summary.managerCount || 0} managers</Tag>
              {(workspaceReport?.summary.explicitWorkspaceCount || 0) > 0 && (
                <Tag color="blue">{workspaceReport?.summary.explicitWorkspaceCount} explicit</Tag>
              )}
            </Space>
            <Text type="secondary">
              {workspaceReport ? new Date(workspaceReport.generatedAt).toLocaleString() : 'Not scanned'}
            </Text>
          </div>
          {workspaceReport && (
            <div className={styles.readinessSummary}>
              <span>Manifests: {workspaceReport.summary.manifestFileCount}</span>
              <span>Locks: {workspaceReport.summary.lockFileCount}</span>
              <span>Configs: {workspaceReport.summary.configFileCount}</span>
              <span>Managers: {workspaceReport.summary.managers.join(', ') || '-'}</span>
            </div>
          )}
          <Table
            dataSource={workspaceRows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="No workspace scan results" /> }}
            columns={[
              {
                title: 'Workspace',
                key: 'workspace',
                width: 230,
                render: (_: unknown, record: WorkspaceNode) => (
                  <Space direction="vertical" size={2}>
                    <Text strong>{record.name}</Text>
                    {record.version && <Text type="secondary">{record.version}</Text>}
                  </Space>
                )
              },
              {
                title: 'Kind',
                dataIndex: 'kind',
                key: 'kind',
                width: 160,
                render: (kind: WorkspaceKind) => <Tag>{kind}</Tag>
              },
              {
                title: 'Managers',
                dataIndex: 'managerIds',
                key: 'managerIds',
                width: 210,
                render: (managerIds: DependencyManagerId[]) => (
                  <Space size={4} wrap>
                    {managerIds.length > 0
                      ? managerIds.map((managerId) => (
                        <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>
                      ))
                      : '-'}
                  </Space>
                )
              },
              {
                title: 'Path',
                dataIndex: 'relativePath',
                key: 'relativePath',
                width: 220,
                ellipsis: true
              },
              {
                title: 'Manifests',
                dataIndex: 'manifestFiles',
                key: 'manifestFiles',
                ellipsis: true,
                render: (files: string[]) => files.length ? files.join(', ') : '-'
              },
              {
                title: 'Locks',
                dataIndex: 'lockFiles',
                key: 'lockFiles',
                ellipsis: true,
                render: (files: string[]) => files.length ? files.join(', ') : '-'
              }
            ]}
          />
        </div>
      )}

      {renderWorkflowSection(
        'health-evidence',
        <HistoryOutlined />,
        'Evidence',
        `${ciEvidence.length} CI / ${auditEvidence?.summary.findingCount || 0} audit findings / ${releaseApprovals.length} approvals / ${releaseExceptions.length} exceptions`
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <HistoryOutlined />
              <Text strong>CI evidence</Text>
              {latestCiEvidence && (
                <Tag color={ciEvidenceStatusColor(latestCiEvidence.status)}>
                  {latestCiEvidence.status}
                </Tag>
              )}
              <Tag>{ciEvidence.length} records</Tag>
            </Space>
            <Text type="secondary">
              {latestCiEvidence ? new Date(latestCiEvidence.finishedAt).toLocaleString() : 'No CI evidence recorded'}
            </Text>
          </div>
          <Table
            dataSource={recentCiEvidence}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No CI evidence imported" /> }}
            columns={[
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 110,
                render: (status: CiEvidenceStatus) => <Tag color={ciEvidenceStatusColor(status)}>{status}</Tag>
              },
              {
                title: 'Workflow',
                key: 'workflow',
                width: 220,
                render: (_: unknown, record: CiEvidenceRecord) => (
                  <Space size={4} wrap>
                    <Tag>{record.source}</Tag>
                    <span>{record.workflow || record.provider || '-'}</span>
                  </Space>
                )
              },
              {
                title: 'Tests',
                key: 'tests',
                width: 190,
                render: (_: unknown, record: CiEvidenceRecord) => typeof record.totalTests === 'number'
                  ? `${record.passedTests ?? '-'} passed / ${record.failedTests ?? 0} failed / ${record.totalTests} total`
                  : '-'
              },
              {
                title: 'Finished',
                dataIndex: 'finishedAt',
                key: 'finishedAt',
                width: 190,
                render: (value: string) => new Date(value).toLocaleString()
              },
              {
                title: 'Summary',
                dataIndex: 'summary',
                key: 'summary',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <WarningOutlined />
              <Text strong>Audit evidence</Text>
              {auditEvidence && (
                <Tag color={auditEvidence.summary.critical + auditEvidence.summary.high > 0 ? 'red' : auditEvidence.summary.medium > 0 ? 'orange' : 'green'}>
                  {auditEvidence.summary.critical + auditEvidence.summary.high} high+
                </Tag>
              )}
              <Tag>{auditEvidence?.summary.findingCount || 0} findings</Tag>
              <Tag>{auditEvidence?.summary.sourceCount || 0} sources</Tag>
            </Space>
            <Text type="secondary">
              {auditEvidence ? new Date(auditEvidence.generatedAt).toLocaleString() : 'No audit evidence imported'}
            </Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Tools: {auditEvidence?.summary.tools.join(', ') || '-'}</span>
            <span>Managers: {auditEvidence?.summary.managers.join(', ') || '-'}</span>
            <span>Affected packages: {auditEvidence?.summary.affectedPackageCount || 0}</span>
            <span>Fixes available: {auditEvidence?.summary.fixAvailableCount || 0}</span>
          </div>
          <Table
            dataSource={auditEvidenceFindings}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No audit evidence imported" /> }}
            columns={[
              {
                title: 'Severity',
                dataIndex: 'severity',
                key: 'severity',
                width: 110,
                render: (severity: AuditEvidenceSeverity) => <Tag color={auditEvidenceSeverityColor(severity)}>{severity}</Tag>
              },
              {
                title: 'Tool',
                dataIndex: 'tool',
                key: 'tool',
                width: 130,
                render: (tool: AuditEvidenceTool) => <Tag>{tool}</Tag>
              },
              {
                title: 'Package',
                dataIndex: 'packageName',
                key: 'packageName',
                width: 180,
                render: (value: string | undefined, record: AuditEvidenceFinding) => (
                  <Space size={4} wrap>
                    {record.managerId && <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>}
                    <span>{value || '-'}</span>
                  </Space>
                )
              },
              {
                title: 'Vulnerability',
                dataIndex: 'vulnerabilityId',
                key: 'vulnerabilityId',
                width: 170,
                render: (value: string | undefined, record: AuditEvidenceFinding) => value || record.aliases[0] || '-'
              },
              {
                title: 'Fix',
                dataIndex: 'fixedVersion',
                key: 'fixedVersion',
                width: 150,
                render: (value: string | undefined) => value || '-'
              },
              {
                title: 'Summary',
                dataIndex: 'summary',
                key: 'summary',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <SafetyCertificateOutlined />
              <Text strong>Release approvals</Text>
              {latestReleaseApproval && (
                <Tag color={releaseApprovalColor(latestReleaseApproval.decision)}>
                  {latestReleaseApproval.decision}
                </Tag>
              )}
              <Tag>{releaseApprovals.length} records</Tag>
            </Space>
            <Text type="secondary">
              {latestReleaseApproval ? new Date(latestReleaseApproval.decidedAt).toLocaleString() : 'No release approval recorded'}
            </Text>
          </div>
          <Table
            dataSource={recentReleaseApprovals}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No release approval evidence recorded" /> }}
            columns={[
              {
                title: 'Decision',
                dataIndex: 'decision',
                key: 'decision',
                width: 120,
                render: (decision: ReleaseApprovalDecision) => <Tag color={releaseApprovalColor(decision)}>{decision}</Tag>
              },
              {
                title: 'Reviewer',
                dataIndex: 'reviewer',
                key: 'reviewer',
                width: 180
              },
              {
                title: 'Scope',
                dataIndex: 'scope',
                key: 'scope',
                width: 160,
                render: (scope: ReleaseApprovalScope) => <Tag>{scope}</Tag>
              },
              {
                title: 'Decided',
                dataIndex: 'decidedAt',
                key: 'decidedAt',
                width: 190,
                render: (value: string) => new Date(value).toLocaleString()
              },
              {
                title: 'Summary',
                dataIndex: 'summary',
                key: 'summary',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <WarningOutlined />
              <Text strong>Release exceptions</Text>
              {latestReleaseException && (
                <Tag color={latestReleaseException.decision === 'approved' ? 'orange' : 'default'}>
                  {latestReleaseException.decision}
                </Tag>
              )}
              <Tag>{releaseExceptions.length} records</Tag>
            </Space>
            <Text type="secondary">
              {latestReleaseException ? new Date(latestReleaseException.decidedAt).toLocaleString() : 'No release exception recorded'}
            </Text>
          </div>
          <Table
            dataSource={recentReleaseExceptions}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No release exception evidence recorded" /> }}
            columns={[
              {
                title: 'Decision',
                dataIndex: 'decision',
                key: 'decision',
                width: 120,
                render: (decision: ReleaseExceptionDecision) => <Tag color={decision === 'approved' ? 'orange' : 'default'}>{decision}</Tag>
              },
              {
                title: 'Reviewer',
                dataIndex: 'reviewer',
                key: 'reviewer',
                width: 180
              },
              {
                title: 'Checks',
                dataIndex: 'checkIds',
                key: 'checkIds',
                width: 220,
                render: (checkIds: string[]) => (
                  <Space size={4} wrap>
                    {checkIds.slice(0, 4).map((checkId) => <Tag key={checkId}>{checkId}</Tag>)}
                    {checkIds.length > 4 && <Tag>+{checkIds.length - 4}</Tag>}
                  </Space>
                )
              },
              {
                title: 'Expires',
                dataIndex: 'expiresAt',
                key: 'expiresAt',
                width: 190,
                render: (value?: string) => value ? new Date(value).toLocaleString() : '-'
              },
              {
                title: 'Reason',
                dataIndex: 'reason',
                key: 'reason',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      {currentPath && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <ToolOutlined />
              <Text strong>Registry reachability</Text>
              <Tag>{registryRows.length} endpoints</Tag>
              {registryReport && (
                <>
                  <Tag color={registryReport.summary.unreachable > 0 ? 'red' : 'green'}>
                    {registryReport.summary.reachable} reachable
                  </Tag>
                  <Tag color={registryReport.summary.insecure > 0 ? 'orange' : 'default'}>
                    {registryReport.summary.insecure} insecure
                  </Tag>
                </>
              )}
            </Space>
            <Text type="secondary">
              {registryReport ? new Date(registryReport.generatedAt).toLocaleString() : 'Discovered endpoints only'}
            </Text>
          </div>
          <Table
            dataSource={registryRows}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No registry endpoints discovered" /> }}
            columns={[
              {
                title: 'Status',
                key: 'status',
                width: 120,
                render: (_: unknown, record: RegistryEndpoint | RegistryReachabilityResult) => {
                  const status = 'status' in record ? record.status : 'not checked'
                  return <Tag color={registryStatusColor(status)}>{status}</Tag>
                }
              },
              {
                title: 'Manager',
                dataIndex: 'managerId',
                key: 'managerId',
                width: 110,
                render: (managerId: DependencyManagerId | undefined) => managerId ? <Tag>{managerId}</Tag> : '-'
              },
              {
                title: 'Kind',
                dataIndex: 'kind',
                key: 'kind',
                width: 130
              },
              {
                title: 'URL',
                dataIndex: 'url',
                key: 'url',
                ellipsis: true,
                render: (url: string, record: RegistryEndpoint | RegistryReachabilityResult) => (
                  <Space size={4} wrap>
                    <span>{url}</span>
                    {!record.secure && <Tag color="orange">http</Tag>}
                    {record.privateHost && <Tag color="blue">private</Tag>}
                  </Space>
                )
              },
              {
                title: 'Source',
                dataIndex: 'sourceFile',
                key: 'sourceFile',
                width: 160
              },
              {
                title: 'Message',
                key: 'message',
                width: 220,
                ellipsis: true,
                render: (_: unknown, record: RegistryEndpoint | RegistryReachabilityResult) => (
                  'message' in record ? (record.message || record.statusCode || '-') : '-'
                )
              }
            ]}
          />
        </div>
      )}

      {dependencyDiff && (
        <div className={styles.riskPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <WarningOutlined />
              <Text strong>Dependency change risk</Text>
              <Tag color={dependencyHighRiskCount > 0 ? 'red' : dependencyDiff.summary.mediumRisk > 0 ? 'orange' : 'green'}>
                {dependencyHighRiskCount} high+
              </Tag>
              <Tag>{dependencyDiff.summary.added} added</Tag>
              <Tag>{dependencyDiff.summary.updated} updated</Tag>
              <Tag>{dependencyDiff.summary.removed} removed</Tag>
            </Space>
            <Text type="secondary">Baseline {dependencyDiff.fromSnapshotId}</Text>
          </div>
          <div className={styles.readinessSummary}>
            <span>Before: {dependencyDiff.beforeComponentCount}</span>
            <span>After: {dependencyDiff.afterComponentCount}</span>
            <span>Major: {dependencyDiff.summary.majorUpdates}</span>
            <span>Prerelease: {dependencyDiff.summary.prereleaseChanges}</span>
            <span>Unpinned: {dependencyDiff.summary.unpinnedChanges}</span>
            <span>License: {dependencyDiff.summary.licenseChanges}</span>
          </div>
          <Table
            dataSource={dependencyDiffRows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Risk',
                dataIndex: 'risk',
                key: 'risk',
                width: 96,
                render: (risk: DependencyRiskLevel) => <Tag color={dependencyRiskColor(risk)}>{risk}</Tag>
              },
              {
                title: 'Change',
                dataIndex: 'kind',
                key: 'kind',
                width: 100,
                render: (kind: DependencyChangeKind) => <Tag color={dependencyChangeColor(kind)}>{kind}</Tag>
              },
              {
                title: 'Package',
                key: 'package',
                width: 260,
                render: (_: unknown, record: DependencyComponentChange) => (
                  <Space size={4} wrap>
                    <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
                    <span>{record.name}</span>
                  </Space>
                )
              },
              {
                title: 'Before',
                key: 'before',
                width: 130,
                render: (_: unknown, record: DependencyComponentChange) => record.before?.version || '-'
              },
              {
                title: 'After',
                key: 'after',
                width: 130,
                render: (_: unknown, record: DependencyComponentChange) => record.after?.version || '-'
              },
              {
                title: 'Reasons',
                key: 'reasons',
                ellipsis: true,
                render: (_: unknown, record: DependencyComponentChange) => (
                  <Tooltip title={record.riskReasons.join('; ')}>
                    <span>{record.riskReasons.join('; ')}</span>
                  </Tooltip>
                )
              }
            ]}
          />
        </div>
      )}

      {recentSnapshots.length > 0 && (
        <div className={styles.snapshotPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <Text strong>最近快照</Text>
              <Tag>{snapshots.length} 个快照</Tag>
            </Space>
            <Text type="secondary">自动快照会记录触发命令，便于恢复前判断来源。</Text>
          </div>
          <Table
            dataSource={recentSnapshots}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: '时间',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 190,
                render: (value: string) => new Date(value).toLocaleString()
              },
              {
                title: '来源',
                dataIndex: 'source',
                key: 'source',
                width: 110,
                render: (source: SupplyChainSnapshotSource | undefined) => (
                  <Tag color={snapshotSourceColor(source)}>{snapshotSourceLabel(source)}</Tag>
                )
              },
              {
                title: '触发原因',
                dataIndex: 'reason',
                key: 'reason',
                ellipsis: true,
                render: (reason: string | undefined) => reason || '手动创建'
              },
              {
                title: '文件',
                dataIndex: 'fileCount',
                key: 'fileCount',
                width: 80
              },
              {
                title: '操作',
                key: 'action',
                width: 150,
                render: (_: unknown, snapshot: SupplyChainSnapshotSummary) => (
                  <Space>
                    <Button size="small" onClick={() => openSnapshot(snapshot)}>
                      打开
                    </Button>
                    <Popconfirm
                      title="恢复这个快照？"
                      description="恢复前会自动创建保护快照。"
                      okText="恢复"
                      cancelText="取消"
                      onConfirm={() => restoreSnapshot(snapshot)}
                    >
                      <Button size="small" danger loading={reporting}>
                        恢复
                      </Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
          />
        </div>
      )}

      {renderWorkflowSection(
        'health-operations',
        <HistoryOutlined />,
        'Operations',
        `${operationHistory.length} records / ${operationStats.errors} failed / ${operationStats.mutating} mutating`
      )}

      {operationHistory.length > 0 && (
        <div className={styles.historyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <HistoryOutlined />
              <Text strong>最近操作</Text>
              <Tag>{operationHistory.length} 条记录</Tag>
            </Space>
            <Text type="secondary">CLI 命令会持久记录到当前项目的 `.npmDesktopManager/operations`。</Text>
          </div>
          <div className={styles.historyControls}>
            <Text type="secondary">
              {filteredOperations.length}/{operationHistory.length} 条记录
            </Text>
            <Select
              size="small"
              value={historyManagerFilter}
              onChange={(value) => setHistoryManagerFilter(value)}
              options={operationManagerOptions}
              style={{ width: 132 }}
            />
            <Select
              size="small"
              value={historyStatusFilter}
              onChange={(value: 'all' | OperationHistoryStatus) => setHistoryStatusFilter(value)}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'success', label: '成功' },
                { value: 'error', label: '失败' }
              ]}
              style={{ width: 112 }}
            />
            <Select
              size="small"
              value={historyChangeFilter}
              onChange={(value: 'all' | 'mutating' | 'readonly') => setHistoryChangeFilter(value)}
              options={[
                { value: 'all', label: '全部类型' },
                { value: 'mutating', label: '变更' },
                { value: 'readonly', label: '只读' }
              ]}
              style={{ width: 112 }}
            />
            <Tag color="orange">{operationStats.mutating} 变更</Tag>
            <Tag color={operationStats.errors > 0 ? 'red' : 'green'}>{operationStats.errors} 失败</Tag>
            <Button size="small" icon={<ExportOutlined />} onClick={() => exportOperationHistory('markdown')} loading={reporting}>
              导出
            </Button>
          </div>
          <Table
            dataSource={recentOperations}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: '完成时间',
                dataIndex: 'finishedAt',
                key: 'finishedAt',
                width: 190,
                render: (value: string) => new Date(value).toLocaleString()
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                width: 90,
                render: (status: OperationHistoryStatus) => (
                  <Tag color={status === 'success' ? 'green' : 'red'}>{status === 'success' ? '成功' : '失败'}</Tag>
                )
              },
              {
                title: '命令',
                dataIndex: 'command',
                key: 'command',
                ellipsis: true,
                render: (command: string, record: OperationHistoryRecord) => (
                  <Space direction="vertical" size={2} className={styles.historyCommand}>
                    <Space size={4} wrap>
                      <Tag color={record.classification?.managerId ? managerColor(record.classification.managerId) : 'default'}>
                        {record.classification?.managerId || record.classification?.tool || 'unknown'}
                      </Tag>
                      <Tag color={operationKindColor(record.classification?.operation)}>
                        {operationKindLabel(record.classification?.operation)}
                      </Tag>
                      <Tag color={record.classification?.mutating ? 'orange' : 'blue'}>
                        {record.classification?.mutating ? '变更' : '只读'}
                      </Tag>
                    </Space>
                    <Text code>{command}</Text>
                  </Space>
                )
              },
              {
                title: '耗时',
                dataIndex: 'durationMs',
                key: 'durationMs',
                width: 90,
                render: (durationMs: number) => formatDuration(durationMs)
              },
              {
                title: '摘要',
                key: 'summary',
                width: 220,
                ellipsis: true,
                render: (_: unknown, record: OperationHistoryRecord) => {
                  const summary = record.summary || record.error || record.stderr || record.stdout || '-'
                  return <Tooltip title={summary}><span>{summary}</span></Tooltip>
                }
              }
            ]}
          />
        </div>
      )}

      {policyEvaluation && (
        <div className={styles.policyPanel}>
          <div className={styles.policyHeader}>
            <Space wrap>
              <Text strong>依赖策略检查</Text>
              <Tag color={policyEvaluation.violationCount > 0 ? 'orange' : 'green'}>
                {policyEvaluation.violationCount} 个违规项
              </Tag>
              <Tag>{policyEvaluation.componentCount} 个组件</Tag>
            </Space>
            <Text type="secondary">{policyEvaluation.policyPath}</Text>
          </div>
          <Table
            dataSource={policyEvaluation.violations}
            rowKey={(record, index) => `${record.title}:${record.packageName || ''}:${index}`}
            size="small"
            pagination={{ pageSize: 6 }}
            locale={{ emptyText: <Empty description="策略检查通过" /> }}
            columns={[
              {
                title: '级别',
                dataIndex: 'severity',
                key: 'severity',
                width: 90,
                render: (severity: DependencyPolicyViolation['severity']) => (
                  <Tag color={severity === 'critical' || severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'blue'}>
                    {severity}
                  </Tag>
                )
              },
              {
                title: '依赖',
                key: 'dependency',
                width: 240,
                render: (_: unknown, record: DependencyPolicyViolation) => (
                  <Space size={4} wrap>
                    {record.managerId && <Tag>{record.managerId}</Tag>}
                    <span>{record.packageName || '-'}</span>
                    {record.version && <Tag>{record.version}</Tag>}
                  </Space>
                )
              },
              {
                title: '问题',
                dataIndex: 'title',
                key: 'title',
                width: 220
              },
              {
                title: '说明',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true
              },
              {
                title: '建议',
                dataIndex: 'recommendation',
                key: 'recommendation',
                ellipsis: true
              }
            ]}
          />
        </div>
      )}

      <Table
        dataSource={rows}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={false}
        scroll={{ x: 1120 }}
        locale={{ emptyText: <Empty description="暂无管理器信息" /> }}
        columns={[
          {
            title: '生态',
            key: 'manager',
            width: 210,
            render: (_: unknown, record) => (
              <Space>
                {managerIcon(record.id)}
                <span>{record.name}</span>
              </Space>
            )
          },
          {
            title: '识别',
            key: 'detected',
            width: 110,
            render: (_: unknown, record) => record.detected
              ? <Tag color="success">当前项目</Tag>
              : <Tag>未识别</Tag>
          },
          {
            title: '工具链',
            key: 'tools',
            width: 260,
            render: (_: unknown, record) => (
              <Space size={4} wrap>
                {record.tools.map((tool) => {
                  const status = toolStatusMap.get(tool as ToolName)
                  if (!status) return <Tag key={tool}>{tool}</Tag>
                  return status.available ? (
                    <Tooltip key={tool} title={status.version}>
                      <Tag color="green">{tool}</Tag>
                    </Tooltip>
                  ) : (
                    <Tooltip key={tool} title={status.message}>
                      <Tag color="red">{tool}</Tag>
                    </Tooltip>
                  )
                })}
              </Space>
            )
          },
          {
            title: '健康扫描',
            key: 'health',
            width: 240,
            render: (_: unknown, record) => renderScanStatus(record.scan)
          },
          {
            title: '生产工具',
            key: 'production',
            render: (_: unknown, record) => (
              <Space size={4} wrap>
                {record.productionTools.slice(0, 3).map((tool) => (
                  <Tag key={tool} color={managerColor(record.id)}>{tool}</Tag>
                ))}
              </Space>
            )
          },
          {
            title: '操作',
            key: 'action',
            width: 210,
            render: (_: unknown, record) => (
              <Space>
                <Button size="small" onClick={() => scanManager(record.id)} loading={scanning === record.id} disabled={!currentPath}>
                  扫描
                </Button>
                <Button size="small" onClick={() => navigate(record.route || '/plugins')}>
                  打开
                </Button>
              </Space>
            )
          }
        ]}
      />

      <DependencyPolicyEditor
        open={policyEditorOpen}
        projectPath={currentPath}
        onClose={() => setPolicyEditorOpen(false)}
        onSaved={handlePolicySaved}
      />
      <ReadinessPolicyEditor
        open={readinessPolicyEditorOpen}
        projectPath={currentPath}
        onClose={() => setReadinessPolicyEditorOpen(false)}
        onSaved={onReadinessPolicySaved}
      />
    </div>
  )
}

function snapshotSourceLabel(source: SupplyChainSnapshotSource | undefined): string {
  if (source === 'mutation') return '变更'
  if (source === 'restore') return '恢复'
  return '手动'
}

function readinessStatusLabel(status: ReadinessGateStatus): string {
  if (status === 'ready') return 'Ready'
  if (status === 'blocked') return 'Blocked'
  return 'Warning'
}

function readinessStatusColor(status: ReadinessGateStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

function releaseRiskStatusColor(status: ReleaseRiskProfileStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

function offlineCacheStatusColor(status: OfflineCacheReadinessStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

function releaseRiskSeverityColor(severity: ReleaseRiskSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  return 'default'
}

function ciWarningColor(severity: CiIntegrationWarningSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

function automationWarningColor(severity: DependencyAutomationWarningSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

function credentialRotationSeverityColor(severity: CredentialRotationSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

function automationDecisionColor(decision: AutomationSafetyDecision): string {
  if (decision === 'auto-merge') return 'green'
  if (decision === 'blocked') return 'red'
  return 'orange'
}

function automationSafetySeverityColor(severity: AutomationSafetyFindingSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

function dependencyOwnershipSeverityColor(severity: DependencyOwnershipFindingSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

function upgradePriorityColor(priority: DependencyUpgradeLanePriority): string {
  if (priority === 'immediate') return 'red'
  if (priority === 'urgent') return 'orange'
  if (priority === 'scheduled') return 'blue'
  return 'default'
}

function rollbackPriorityColor(priority: DependencyRollbackPlanPriority): string {
  if (priority === 'required') return 'red'
  if (priority === 'recommended') return 'orange'
  return 'blue'
}

function dependencyImpactSeverityColor(severity: DependencyImpactSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  return 'default'
}

function approvalCheckStatusColor(status: DependencyChangeApprovalCheckStatus): string {
  if (status === 'passed') return 'green'
  if (status === 'blocked') return 'red'
  if (status === 'warning') return 'orange'
  return 'blue'
}

function changeWindowStatusColor(status: DependencyChangeWindowStatus): string {
  if (status === 'scheduled') return 'green'
  if (status === 'blocked' || status === 'frozen') return 'red'
  return 'orange'
}

function freezeReasonColor(reason: DependencyChangeFreezeReason): string {
  if (reason === 'approval-blocked' || reason === 'trust-policy-blocked' || reason === 'rollback-blocked') return 'red'
  if (reason === 'missing-owner' || reason === 'active-exception' || reason === 'critical-impact') return 'orange'
  return 'blue'
}

function executionRecordStatusColor(status: DependencyChangeExecutionRecordStatus): string {
  if (status === 'completed') return 'green'
  if (status === 'failed' || status === 'blocked') return 'red'
  if (status === 'pending' || status === 'unscheduled') return 'orange'
  return 'default'
}

function executionVerificationStatusColor(status: DependencyChangeExecutionVerificationStatus): string {
  if (status === 'passed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'missing') return 'orange'
  return 'blue'
}

function policyAsCodeSeverityColor(severity: PolicyAsCodeFindingSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

function reportArtifactCategoryColor(category: ReportArtifactCategory): string {
  if (category === 'release') return 'purple'
  if (category === 'risk' || category === 'security') return 'red'
  if (category === 'policy') return 'orange'
  if (category === 'workspace') return 'cyan'
  if (category === 'automation') return 'geekblue'
  if (category === 'reproducibility') return 'blue'
  if (category === 'inventory') return 'green'
  if (category === 'evidence') return 'gold'
  if (category === 'operations') return 'volcano'
  return 'default'
}

function reportArtifactFormatColor(format: ReportArtifactFormat): string {
  if (format === 'html') return 'purple'
  if (format === 'json' || format === 'sbom') return 'blue'
  if (format === 'markdown') return 'green'
  if (format === 'yaml') return 'geekblue'
  if (format === 'calendar') return 'cyan'
  if (format === 'codeowners') return 'orange'
  return 'default'
}

function formatArtifactBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function readinessCheckColor(status: ReadinessGateCheckStatus): string {
  if (status === 'passed') return 'green'
  if (status === 'blocked') return 'red'
  if (status === 'warning') return 'orange'
  return 'blue'
}

function readinessSeverityColor(severity: ReadinessGateSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  return 'default'
}

function ciEvidenceStatusColor(status: CiEvidenceStatus): string {
  if (status === 'success') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'cancelled') return 'orange'
  return 'default'
}

function auditEvidenceSeverityColor(severity: AuditEvidenceSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  if (severity === 'info') return 'green'
  return 'default'
}

function vulnerabilityRemediationPriorityColor(priority: VulnerabilityRemediationPriority): string {
  if (priority === 'immediate') return 'red'
  if (priority === 'urgent') return 'orange'
  if (priority === 'scheduled') return 'blue'
  return 'default'
}

function releaseApprovalColor(decision: ReleaseApprovalDecision): string {
  if (decision === 'approved') return 'green'
  if (decision === 'rejected') return 'red'
  return 'orange'
}

function registryStatusColor(status: RegistryReachabilityStatus | 'not checked'): string {
  if (status === 'reachable') return 'green'
  if (status === 'unreachable') return 'red'
  if (status === 'unknown') return 'orange'
  return 'default'
}

function licenseComplianceStatusColor(status: LicenseComplianceStatus): string {
  if (status === 'blocked') return 'red'
  if (status === 'not-allowed' || status === 'unknown') return 'orange'
  if (status === 'allowed') return 'green'
  return 'default'
}

function workspaceGovernanceStatusColor(status: WorkspaceGovernanceStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

function workspacePolicySourceColor(source: WorkspacePolicySource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

function workspaceReadinessPolicySourceColor(source: WorkspaceReadinessPolicySource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

function workspaceSnapshotSourceColor(source: WorkspaceSnapshotSource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

function workspaceCiEvidenceSourceColor(source: WorkspaceCiEvidenceSource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

function workspaceReleaseApprovalSourceColor(source: WorkspaceReleaseApprovalSource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

function workspaceReleaseExceptionSourceColor(source: WorkspaceReleaseExceptionSource): string {
  if (source === 'workspace') return 'orange'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

function dependencyRiskColor(risk: DependencyRiskLevel): string {
  if (risk === 'critical' || risk === 'high') return 'red'
  if (risk === 'medium') return 'orange'
  if (risk === 'low') return 'blue'
  return 'default'
}

function dependencyChangeColor(kind: DependencyChangeKind): string {
  if (kind === 'added') return 'green'
  if (kind === 'removed') return 'red'
  if (kind === 'updated') return 'orange'
  return 'default'
}

function snapshotSourceColor(source: SupplyChainSnapshotSource | undefined): string {
  if (source === 'mutation') return 'orange'
  if (source === 'restore') return 'purple'
  return 'blue'
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '-'
  if (durationMs < 1000) return `${durationMs} ms`
  return `${(durationMs / 1000).toFixed(1)} s`
}

function operationKindLabel(kind: OperationHistoryOperationKind | undefined): string {
  const labels: Record<OperationHistoryOperationKind, string> = {
    install: '安装',
    uninstall: '移除',
    update: '更新',
    sync: '同步',
    audit: '审计',
    tree: '依赖树',
    list: '列表',
    search: '搜索',
    outdated: '过期检查',
    publish: '发布',
    config: '配置',
    cache: '缓存',
    build: '构建',
    test: '测试',
    run: '运行',
    clean: '清理',
    lock: '锁定',
    login: '凭据',
    toolchain: '工具链',
    restore: '恢复',
    info: '信息',
    unknown: '未知'
  }
  return labels[kind || 'unknown']
}

function operationKindColor(kind: OperationHistoryOperationKind | undefined): string {
  if (kind === 'publish' || kind === 'login') return 'red'
  if (kind === 'install' || kind === 'uninstall' || kind === 'update' || kind === 'sync' || kind === 'lock') return 'orange'
  if (kind === 'audit' || kind === 'tree' || kind === 'outdated') return 'blue'
  if (kind === 'build' || kind === 'run' || kind === 'clean') return 'purple'
  return 'default'
}

function renderScanStatus(scan: DependencyHealthScanResult | { error: string } | undefined) {
  if (!scan) return <Tag>未扫描</Tag>
  if ('error' in scan) return <Tooltip title={scan.error}><Tag color="red">扫描失败</Tag></Tooltip>

  const total = scan.summary.total
  if (total === 0) return <Tag color="green">无问题</Tag>

  return (
    <Space size={4} wrap>
      <Tag color="red">高危 {scan.summary.critical + scan.summary.high}</Tag>
      <Tag color="orange">中 {scan.summary.medium}</Tag>
      <Tag>总计 {total}</Tag>
    </Space>
  )
}

export default HealthCenter
