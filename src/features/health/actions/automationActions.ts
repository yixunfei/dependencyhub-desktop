import type { HealthData } from '../healthData'

export async function exportCiIntegrationPlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setCiIntegrationPlan'
>, format: CiIntegrationPlanExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setCiIntegrationPlan } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'CI integration plan export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyAutomationPlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyAutomationPlan'
>, format: DependencyAutomationPlanExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyAutomationPlan } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency automation export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportCredentialRotationPlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setCredentialRotationPlan'
>, format: CredentialRotationPlanExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setCredentialRotationPlan } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Credential rotation export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportAutomationSafetyPlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setAutomationSafetyPlan'
>, format: AutomationSafetyPlanExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setAutomationSafetyPlan } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Automation safety export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyOwnershipPlanAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyOwnershipPlan' |
  'setDependencyUpgradePlaybook'
>, format: DependencyOwnershipPlanExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setDependencyOwnershipPlan, setDependencyUpgradePlaybook } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency ownership export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}
