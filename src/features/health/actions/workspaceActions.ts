import type { HealthData } from '../healthData'

export async function scanWorkspacesAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceReport'>) {
  const { currentPath, addNotification, setReporting, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Workspace discovery failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportWorkspacesAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceReport'
>, format: WorkspaceDiscoveryExportResult['format'] = 'markdown') {
  const { currentPath, addNotification, setReporting, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Workspace export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function scanWorkspaceGovernanceAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' | 'setWorkspaceReport'
>) {
  const { currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Workspace governance failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportWorkspaceGovernanceAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' | 'setWorkspaceReport'
>, format: WorkspaceGovernanceExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Workspace governance export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportWorkspaceReleaseEvidenceAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' | 'setWorkspaceReport'
>, format: WorkspaceReleaseEvidenceExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Workspace release evidence export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportRemediationPlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' | 'setWorkspaceReport'
>, format: WorkspaceRemediationPlanExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Remediation plan export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportWorkspaceUpdatePlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' | 'setWorkspaceReport'
>, format: WorkspaceUpdatePlanExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Workspace dependency update plan export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportWorkspaceSbomsAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setWorkspaceGovernanceReport' | 'setWorkspaceReport'
>, format: WorkspaceSbomExportFormat = 'cyclonedx') {
  const { currentPath, addNotification, setReporting, setWorkspaceGovernanceReport, setWorkspaceReport } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Workspace SBOM export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}
