import type { HealthData } from '../healthData'

export async function exportDependencyUpgradePlaybookAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyUpgradePlaybook' |
  'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyUpgradePlaybook, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency upgrade playbook export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyRollbackPlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyRollbackPlan' | 'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyRollbackPlan, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency rollback plan export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyImpactAnalysisAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyImpactAnalysis' |
  'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyImpactAnalysis, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency impact analysis export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyChangeApprovalPacketAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyChangeApprovalPacket' |
  'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyChangeApprovalPacket, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency change approval packet export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyChangeCalendarAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyChangeCalendar' |
  'setReportArtifactIndex'
>, format: DependencyChangeCalendarExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyChangeCalendar, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency change calendar export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyChangeExecutionRecordAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyChangeExecutionRecord' |
  'setReportArtifactIndex'
>, format: 'markdown' | 'json' = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyChangeExecutionRecord, setReportArtifactIndex } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency change execution record export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}
