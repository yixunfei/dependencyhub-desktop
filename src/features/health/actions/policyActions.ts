import type { HealthData } from '../healthData'
import { readinessStatusLabel } from '../healthPresentation'

export async function exportPolicyAsCodePackAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'setPolicyAsCodePack'
>, format: PolicyAsCodeExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setPolicyAsCodePack } = context
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

export async function runReadinessGateAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'setReporting' | 'setReadinessReport'>) {
  const { currentPath, addNotification, setReporting, setReadinessReport } = context
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
  'currentPath' | 'addNotification' | 'setReporting' | 'setReadinessReport'
>, format: ReadinessGateExportFormat = 'markdown') {
  const { currentPath, addNotification, setReporting, setReadinessReport } = context
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
  'currentPath' | 'addNotification' | 'setReporting' | 'setSnapshots' | 'setDependencyRollbackPlan'
>) {
  const { currentPath, addNotification, setReporting, setSnapshots, setDependencyRollbackPlan } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: '创建快照失败',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function diffLatestSnapshotAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'setReporting' | 'setSnapshotDiff'>) {
  const { currentPath, addNotification, setReporting, setSnapshotDiff } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: '对比快照失败',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function restoreLatestSnapshotAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'setReporting' | 'loadOverview'>) {
  const { currentPath, addNotification, setReporting, loadOverview } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: '恢复快照失败',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function restoreSnapshotAction(context: Pick<HealthData,
  'currentPath' | 'addNotification' | 'setReporting' | 'loadOverview'
>, snapshot: SupplyChainSnapshotSummary) {
  const { currentPath, addNotification, setReporting, loadOverview } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: '恢复指定快照失败',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function openSnapshotAction(context: Pick<HealthData, 'addNotification'>, snapshot: SupplyChainSnapshotSummary) {
  const { addNotification } = context
  try {
    await window.electronAPI.system.openFile(snapshot.path)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: '打开快照失败',
      description: error instanceof Error ? error.message : String(error)
    })
  }
}

export async function ensurePolicyAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'setReporting'>) {
  const { currentPath, addNotification, setReporting } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: '创建依赖策略失败',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function ensureReadinessPolicyAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'setReporting' | 'setReadinessReport'>) {
  const { currentPath, addNotification, setReporting, setReadinessReport } = context
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
  'addNotification' | 'currentPath' | 'setReadinessReport'
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

export async function evaluatePolicyAction(context: Pick<HealthData, 'currentPath' | 'addNotification' | 'setReporting' | 'setPolicyEvaluation'>) {
  const { currentPath, addNotification, setReporting, setPolicyEvaluation } = context
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
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: '依赖策略检查失败',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function handlePolicySavedAction(context: Pick<HealthData,
  'addNotification' | 'currentPath' | 'setReporting' | 'setPolicyEvaluation'
>, result: DependencyPolicyFile) {
  const { addNotification } = context
  addNotification({
    type: 'success',
    message: '依赖策略已保存',
    description: result.path
  })
  await evaluatePolicyAction(context,)
}
