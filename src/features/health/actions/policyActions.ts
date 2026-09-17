import type { HealthData } from '../healthData'
import { readinessStatusLabel } from '../healthPresentation'

export async function exportPolicyAsCodePackAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setPolicyAsCodePack'
>, format: PolicyAsCodeExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setPolicyAsCodePack } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Policy-as-code export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function runReadinessGateAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setReadinessReport'>) {
  const { t, currentPath, addNotification, setReporting, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Production readiness check failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportReadinessAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setReadinessReport'
>, format: ReadinessGateExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Production readiness report export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function createSnapshotAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setSnapshots' | 'setDependencyRollbackPlan'
>) {
  const { t, currentPath, addNotification, setReporting, setSnapshots, setDependencyRollbackPlan } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.supplyChain.createSnapshot(currentPath)
    addNotification({
      type: 'success',
      message: t('health.snapshotCreated'),
      description: t('health.snapshotCreatedDescription', { count: result.files.length, path: result.path })
    })
    await window.electronAPI.system.openFile(result.path)
    const [snapshotList, rollbackPlan] = await Promise.all([
      window.electronAPI.supplyChain.listSnapshots(currentPath),
      window.electronAPI.dependencyRollbackPlan.report(currentPath).catch(() => null)
    ])
    setSnapshots(snapshotList)
    setDependencyRollbackPlan(rollbackPlan)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.snapshotCreateFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function diffLatestSnapshotAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setSnapshotDiff'>) {
  const { t, currentPath, addNotification, setReporting, setSnapshotDiff } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.supplyChain.diffLatestSnapshot(currentPath)
    setSnapshotDiff(result)
    if (!result) {
      addNotification({ type: 'info', message: t('health.noSnapshotToCompare') })
    }
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.snapshotDiffFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function restoreLatestSnapshotAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting' | 'loadOverview'>) {
  const { t, currentPath, addNotification, setReporting, loadOverview } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.supplyChain.restoreLatestSnapshot(currentPath)
    if (!result) {
      addNotification({ type: 'info', message: t('health.noSnapshotToRestore') })
      return
    }

    addNotification({
      type: 'success',
      message: t('health.snapshotRestoredLatest'),
      description: t('health.snapshotRestoredLatestDescription', { count: result.restoredCount, path: result.preRestoreSnapshot.path })
    })
    await loadOverview()
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.snapshotRestoreFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function restoreSnapshotAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'loadOverview'
>, snapshot: SupplyChainSnapshotSummary) {
  const { t, currentPath, addNotification, setReporting, loadOverview } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.supplyChain.restoreSnapshot(currentPath, snapshot.path)
    addNotification({
      type: 'success',
      message: t('health.snapshotRestored'),
      description: t('health.snapshotRestoredDescription', { reason: snapshot.reason || snapshot.id, count: result.restoredCount, path: result.preRestoreSnapshot.path })
    })
    await loadOverview()
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.snapshotRestoreSpecificFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function openSnapshotAction(context: Pick<HealthData, 't' | 'addNotification'>, snapshot: SupplyChainSnapshotSummary) {
  const { t, addNotification } = context
  try {
    await window.electronAPI.system.openFile(snapshot.path)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.snapshotOpenFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  }
}

export async function ensurePolicyAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting'>) {
  const { t, currentPath, addNotification, setReporting } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const filePath = await window.electronAPI.supplyChain.ensurePolicy(currentPath)
    addNotification({
      type: 'success',
      message: t('health.policyFileReady'),
      description: filePath
    })
    await window.electronAPI.system.openFile(filePath)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.policyCreateFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function ensureReadinessPolicyAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setReadinessReport'>) {
  const { t, currentPath, addNotification, setReporting, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Readiness policy setup failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function onReadinessPolicySavedAction(context: Pick<HealthData,
  't' | 'addNotification' | 'currentPath' | 'setReadinessReport'
>, result: ReadinessPolicyFile) {
  const { addNotification, currentPath, setReadinessReport } = context
  addNotification({
    type: 'success',
    message: 'Readiness policy saved',
    description: result.path
  })
  if (currentPath) {
    setReadinessReport(await window.electronAPI.readiness.report(currentPath))
  }
}

export async function evaluatePolicyAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setPolicyEvaluation'>) {
  const { t, currentPath, addNotification, setReporting, setPolicyEvaluation } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('health.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.supplyChain.evaluatePolicy(currentPath)
    setPolicyEvaluation(result)
    addNotification({
      type: result.violationCount > 0 ? 'warning' : 'success',
      message: result.violationCount > 0 ? t('health.policyViolations') : t('health.policyPassed'),
      description: t('health.violationCount', { count: result.violationCount })
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.policyCheckFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function handlePolicySavedAction(context: Pick<HealthData,
  't' | 'addNotification' | 'currentPath' | 'setReporting' | 'setPolicyEvaluation'
>, result: DependencyPolicyFile) {
  const { t, addNotification } = context
  addNotification({
    type: 'success',
    message: t('health.policySaved'),
    description: result.path
  })
  await evaluatePolicyAction(context,)
}
