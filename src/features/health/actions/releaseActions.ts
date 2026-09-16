import type { HealthData } from '../healthData'
import { formatArtifactBytes, readinessStatusLabel } from '../healthPresentation'

export async function exportReleaseRiskProfileAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseRiskProfile'
>, format: ReleaseRiskProfileExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setReleaseRiskProfile } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release risk profile export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseBundleAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' |
  'setWorkspaceReport' | 'setReportArtifactIndex' | 'setReleaseEvidenceCompleteness' |
  'setReleaseProvenanceAttestation' | 'setReleaseIntegrityVerification' | 'setReleaseSignature' |
  'setReleaseTrustPolicy'
>) {
  const {
    currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport,
    setReportArtifactIndex, setReleaseEvidenceCompleteness, setReleaseProvenanceAttestation,
    setReleaseIntegrityVerification, setReleaseSignature, setReleaseTrustPolicy
  } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release bundle export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseDashboardAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' |
  'setWorkspaceReport' | 'setReportArtifactIndex' | 'setReleaseEvidenceCompleteness' |
  'setReleaseProvenanceAttestation' | 'setReleaseIntegrityVerification' | 'setReleaseSignature' |
  'setReleaseTrustPolicy'
>) {
  const {
    currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport,
    setReportArtifactIndex, setReleaseEvidenceCompleteness, setReleaseProvenanceAttestation,
    setReleaseIntegrityVerification, setReleaseSignature, setReleaseTrustPolicy
  } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release review dashboard export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyHealthDashboardAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' |
  'setWorkspaceReport' | 'setReadinessReport' | 'setReleaseRiskProfile'
>) {
  const { currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport, setReadinessReport, setReleaseRiskProfile } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency health dashboard export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function refreshReportArtifactIndexAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReportArtifactIndex'
>) {
  const { currentPath, addNotification, setReporting, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Report library refresh failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReportArtifactIndexAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Report artifact index export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function openReportArtifactDirectoryAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'reportArtifactIndex'>) {
  const { currentPath, addNotification, reportArtifactIndex } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: 'Select a project directory first' })
    return
  }

  const reportDir = reportArtifactIndex?.reportDir || `${currentPath}\\.npmDesktopManager\\reports`
  try {
    await window.electronAPI.system.openFile(reportDir)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Report folder open failed',
      description: error instanceof Error ? error.message : String(error)
    })
  }
}

export async function refreshReleaseEvidenceCompletenessAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseEvidenceCompleteness' |
  'setReportArtifactIndex'
>) {
  const { currentPath, addNotification, setReporting, setReleaseEvidenceCompleteness, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release evidence completeness check failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseEvidenceCompletenessAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseEvidenceCompleteness' |
  'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setReleaseEvidenceCompleteness, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release evidence completeness export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function refreshReleaseProvenanceAttestationAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseProvenanceAttestation' |
  'setReportArtifactIndex'
>) {
  const { currentPath, addNotification, setReporting, setReleaseProvenanceAttestation, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release provenance check failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseProvenanceAttestationAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseProvenanceAttestation' |
  'setReportArtifactIndex' | 'setReleaseEvidenceCompleteness' | 'setReleaseSignature'
>, format: 'markdown' | 'json' = 'markdown') {
  const {
    currentPath, addNotification, setReporting, setReleaseProvenanceAttestation, setReportArtifactIndex,
    setReleaseEvidenceCompleteness, setReleaseSignature
  } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release provenance export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function refreshReleaseIntegrityVerificationAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseIntegrityVerification' |
  'setReportArtifactIndex'
>) {
  const { currentPath, addNotification, setReporting, setReleaseIntegrityVerification, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release integrity verification failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseIntegrityVerificationAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseIntegrityVerification' |
  'setReportArtifactIndex' | 'setReleaseSignature'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setReleaseIntegrityVerification, setReportArtifactIndex, setReleaseSignature } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release integrity verification export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function refreshReleaseSignatureAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseSignature' | 'setReportArtifactIndex' |
  'setReleaseTrustPolicy'
>) {
  const { currentPath, addNotification, setReporting, setReleaseSignature, setReportArtifactIndex, setReleaseTrustPolicy } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release signature verification failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseSignatureAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseSignature' | 'setReportArtifactIndex' |
  'setReleaseTrustPolicy'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setReleaseSignature, setReportArtifactIndex, setReleaseTrustPolicy } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release signature export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function refreshReleaseTrustPolicyAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseTrustPolicy' | 'setReportArtifactIndex'
>) {
  const { currentPath, addNotification, setReporting, setReleaseTrustPolicy, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release trust policy check failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseTrustPolicyAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseTrustPolicy' | 'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setReleaseTrustPolicy, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release trust policy export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function refreshFrameworkCoverageAction(context: Pick<HealthData, 'setReporting' | 'currentPath' | 'setFrameworkCoverage' | 'addNotification'>) {
  const { setReporting, currentPath, setFrameworkCoverage, addNotification } = context
  setReporting(true)
  try {
    const result = await window.electronAPI.frameworkCoverage.report(currentPath || undefined)
    setFrameworkCoverage(result)
    addNotification({
      type: result.summary.warningGapCount > 0 ? 'warning' : 'success',
      message: 'Framework coverage refreshed',
      description: `${result.summary.managerCount} manager(s), ${result.summary.routeGroupCount} workspace group(s), ${result.summary.warningGapCount} warning gap(s)`
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Framework coverage refresh failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportFrameworkCoverageAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setFrameworkCoverage' | 'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setFrameworkCoverage, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Framework coverage export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}
