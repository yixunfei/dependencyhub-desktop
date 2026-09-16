import { useMemo } from 'react'
import { getImplementedManagerDefinitions } from '../../domain/managers/registry'
import type { HealthState } from './useHealthState'

function useInventoryDerived(context: Pick<HealthState,
  'projectInfo' | 'supplyChainReport' | 'licenseReport' | 'thirdPartyNotices' | 'toolStatuses' | 'plugins'
>) {
  const { projectInfo, supplyChainReport, licenseReport, thirdPartyNotices, toolStatuses, plugins } = context
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
  return { managers, detectedIds, extendedDetectedCount, unknownLicenseCount, licenseRows, thirdPartyNoticeRows, licenseRiskCount, toolStatusMap, pluginMap }
}

function useEvidenceDerived(context: Pick<HealthState & ReturnType<typeof useInventoryDerived>,
  'snapshots' | 'operationHistory' | 'historyStatusFilter' | 'historyManagerFilter' | 'historyChangeFilter' |
  'ciEvidence' | 'auditEvidence' | 'vulnerabilityRemediationPlan' | 'releaseApprovals' | 'releaseExceptions'
>) {
  const {
    snapshots, operationHistory, historyStatusFilter, historyManagerFilter, historyChangeFilter, ciEvidence,
    auditEvidence, vulnerabilityRemediationPlan, releaseApprovals, releaseExceptions
  } = context
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
  return {
    recentSnapshots, filteredOperations, recentOperations, recentCiEvidence, latestCiEvidence,
    auditEvidenceFindings, vulnerabilityRemediationRows, recentReleaseApprovals, latestReleaseApproval,
    recentReleaseExceptions, latestReleaseException
  }
}

function useRiskDerived(context: Pick<HealthState & ReturnType<typeof useInventoryDerived> & ReturnType<typeof useEvidenceDerived>,
  'registryReport' | 'registryEndpoints' | 'workspaceReport' | 'workspaceGovernanceReport' |
  'dependencyDiff' | 'readinessReport' | 'releaseRiskProfile' | 'dependencyAutomationPlan' |
  'credentialRotationPlan' | 'automationSafetyPlan' | 'dependencyOwnershipPlan' |
  'dependencyUpgradePlaybook' | 'dependencyRollbackPlan' | 'dependencyImpactAnalysis'
>) {
  const {
    registryReport, registryEndpoints, workspaceReport, workspaceGovernanceReport, dependencyDiff,
    readinessReport, releaseRiskProfile, dependencyAutomationPlan, credentialRotationPlan,
    automationSafetyPlan, dependencyOwnershipPlan, dependencyUpgradePlaybook, dependencyRollbackPlan,
    dependencyImpactAnalysis
  } = context
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
  return {
    registryRows, workspaceRows, workspaceGovernanceRows, dependencyDiffRows, dependencyHighRiskCount,
    readinessRows, releaseRiskRows, dependencyAutomationWarnings, credentialRotationActions,
    automationSafetyFindings, dependencyOwnershipFindings, dependencyUpgradeLanes, dependencyUpgradeItems,
    dependencyRollbackItems, dependencyImpactItems
  }
}

function useChangeDerived(context: Pick<HealthState & ReturnType<typeof useInventoryDerived> & ReturnType<typeof useEvidenceDerived> & ReturnType<typeof useRiskDerived>,
  'dependencyChangeApprovalPacket' | 'dependencyChangeCalendar' | 'dependencyChangeExecutionRecord' |
  'policyAsCodePack' | 'releaseEvidenceCompleteness' | 'releaseProvenanceAttestation' |
  'releaseIntegrityVerification'
>) {
  const {
    dependencyChangeApprovalPacket, dependencyChangeCalendar, dependencyChangeExecutionRecord,
    policyAsCodePack, releaseEvidenceCompleteness, releaseProvenanceAttestation, releaseIntegrityVerification
  } = context
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
  return {
    dependencyApprovalChecklist, dependencyApprovalScopeItems, dependencyFreezeWindows,
    dependencyChangeWindows, dependencyExecutionRecords, policyAsCodeFindings, releaseEvidenceFindings,
    releaseEvidenceExpectedRows, releaseProvenanceArtifactRows, releaseIntegrityArtifactRows,
    releaseIntegrityFindings
  }
}

function useArtifactDerived(context: Pick<HealthState & ReturnType<typeof useInventoryDerived> & ReturnType<typeof useEvidenceDerived> & ReturnType<typeof useRiskDerived> & ReturnType<typeof useChangeDerived>,
  'releaseSignature' | 'releaseTrustPolicy' | 'policyAsCodePack' | 'artifactSearchTerm' |
  'reportArtifactIndex' | 'artifactCategoryFilter' | 'artifactFormatFilter' | 'frameworkCoverage' |
  'operationHistory'
>) {
  const {
    releaseSignature, releaseTrustPolicy, policyAsCodePack, artifactSearchTerm, reportArtifactIndex,
    artifactCategoryFilter, artifactFormatFilter, frameworkCoverage, operationHistory
  } = context
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
  return {
    releaseSignatureSourceRows, releaseSignatureFindings, releaseTrustPolicyRows, policyDeploymentGateRows,
    policyRequiredArtifactRows, reportArtifactRows, frameworkCoverageRows, operationStats,
    operationManagerOptions
  }
}

export function useHealthDerived(state: HealthState) {
  const part0 = useInventoryDerived({ ...state })
  const part1 = useEvidenceDerived({ ...state, ...part0 })
  const part2 = useRiskDerived({ ...state, ...part0, ...part1 })
  const part3 = useChangeDerived({ ...state, ...part0, ...part1, ...part2 })
  const part4 = useArtifactDerived({ ...state, ...part0, ...part1, ...part2, ...part3 })
  const { managers, detectedIds, pluginMap } = part0
  const { scans } = state
  const rows = managers.map((manager) => ({
    ...manager,
    detected: detectedIds.has(manager.id),
    plugin: pluginMap.get(manager.id),
    scan: scans[manager.id]
  }))
  return { ...part0, ...part1, ...part2, ...part3, ...part4, rows }
}

export type HealthDerived = ReturnType<typeof useHealthDerived>
