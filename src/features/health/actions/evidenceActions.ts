import type { HealthData } from '../healthData'

export async function exportOperationHistoryAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setOperationHistory'
>, format: OperationHistoryExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setOperationHistory } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.operationHistory.exportReport(currentPath, format)
    addNotification({
      type: 'success',
      message: t('health.operationHistoryExported'),
      description: t('health.operationHistoryExportedDescription', { count: result.count, path: result.path })
    })
    await window.electronAPI.system.openFile(result.path)
    setOperationHistory(await window.electronAPI.operationHistory.list(currentPath, 80))
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.operationHistoryExportFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function importCiEvidenceAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setCiEvidence' | 'setReadinessReport'
>) {
  const { t, currentPath, addNotification, setReporting, setCiEvidence, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'CI evidence import failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function recordManualCiEvidenceAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setCiEvidence' | 'setReadinessReport'
>, status: CiEvidenceStatus) {
  const { t, currentPath, addNotification, setReporting, setCiEvidence, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'CI evidence record failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportCiEvidenceAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setCiEvidence'
>, format: CiEvidenceExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setCiEvidence } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'CI evidence export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function recordReleaseApprovalAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseApprovals' | 'setReadinessReport'
>, decision: ReleaseApprovalDecision) {
  const { t, currentPath, addNotification, setReporting, setReleaseApprovals, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release approval record failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseApprovalsAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseApprovals'
>, format: ReleaseApprovalExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setReleaseApprovals } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release approval export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function recordReleaseExceptionAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'readinessRows' | 'setReporting' | 'setReleaseExceptions' |
  'setReadinessReport'
>) {
  const { t, currentPath, addNotification, readinessRows, setReporting, setReleaseExceptions, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release exception record failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReleaseExceptionsAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setReleaseExceptions'
>, format: ReleaseExceptionExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setReleaseExceptions } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Release exception export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function importAuditEvidenceAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setAuditEvidence' | 'setVulnerabilityRemediationPlan'
>) {
  const { t, currentPath, addNotification, setReporting, setAuditEvidence, setVulnerabilityRemediationPlan } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Audit evidence import failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportAuditEvidenceAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setAuditEvidence' | 'setVulnerabilityRemediationPlan'
>, format: AuditEvidenceExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setAuditEvidence, setVulnerabilityRemediationPlan } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Audit evidence export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportVulnerabilityRemediationPlanAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setVulnerabilityRemediationPlan' |
  'setReportArtifactIndex'
>, format: VulnerabilityRemediationPlanExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setVulnerabilityRemediationPlan, setReportArtifactIndex } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Vulnerability remediation export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}
