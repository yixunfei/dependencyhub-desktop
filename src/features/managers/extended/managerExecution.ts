import type { Dispatch,RefObject,SetStateAction } from 'react'
import type { ManagerBackup,ManagerCommandResult,ManagerOperationFailure } from '@shared/managerWorkspace'
import type { DependencyManagerId } from '../../../domain/managers/registry'
import type { Notification } from '../../../stores/appStore'

type Setter<T>=Dispatch<SetStateAction<T>>
export interface ManagerExecutionContext {
  currentPath: string
  activeManager: DependencyManagerId
  operationScopeRef: RefObject<{ currentPath: string; activeManager: DependencyManagerId; id: string }>
  currentPathRef: RefObject<string>
  setActiveOperationId: Setter<string|null>
  setRunning: Setter<boolean>
  setCommandOutput: Setter<string>
  setLastBackup: Setter<ManagerBackup|null>
  addNotification: (notification: Omit<Notification,'id'>) => void
  loadDependencies: (managerId?: DependencyManagerId) => Promise<void>
  setDependencyDiff: Setter<DependencyComponentDiff|null>
  setReadinessReport: Setter<ReadinessGateReport|null>
}

export async function executeManagerCommand(context: ManagerExecutionContext,operation: (operationId: string) => Promise<ManagerCommandResult>) {
  const { currentPath,activeManager,operationScopeRef,currentPathRef,setActiveOperationId,setRunning,setCommandOutput,setLastBackup,addNotification,loadDependencies,setDependencyDiff,setReadinessReport }=context

  if(!currentPath) return
  const operationPath=currentPath
  // A user-triggered write always declares its operation id first, so a stuck
  // command can be cancelled from the same panel that started it.
  const operationId=`ui-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  operationScopeRef.current.id=operationId
  const isCurrent=() => operationScopeRef.current.id===operationId
  setActiveOperationId(operationId)
  setRunning(true)
  setCommandOutput('Running...')
  try {
    const result=await operation(operationId)
    if(!isCurrent()) return
    if(result.backup) setLastBackup(result.backup)
    setCommandOutput([
      `$ ${result.command}`,
      '',
      result.stdout,
      result.stderr,
      result.dryRun? '[dry-run] no project changes were requested':'',
      result.backup? `[backup] ${result.backup.files.length} files saved to ${result.backup.path}`:''
    ].filter(Boolean).join('\n'))
    addNotification({ type: 'success',message: result.dryRun? 'Dry-run completed':'Command completed',description: result.command })
    // Apply the refresh only while the project the command targeted is still active.
    const applyIfSameProject=(apply: () => void) => {
      if(isCurrent() && currentPathRef.current===operationPath) apply()
    }
    await Promise.all([
      loadDependencies(activeManager),
      window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(operationPath).then((value) => applyIfSameProject(() => setDependencyDiff(value))).catch(() => null),
      window.electronAPI.readiness.report(operationPath).then((value) => applyIfSameProject(() => setReadinessReport(value))).catch(() => null)
    ])
  } catch(cause: unknown) {
    const error=(cause instanceof Error? cause:new Error(String(cause))) as Error&{
      backup?: ManagerBackup
      failure?: ManagerOperationFailure
      restore?: { attempted: boolean; restored: boolean; error?: string }
    }
    if(!isCurrent()) return
    const backup=error?.backup as ManagerBackup|undefined
    if(backup) setLastBackup(backup)
    const failure=error?.failure as ManagerOperationFailure|undefined
    setCommandOutput([
      failure?.category==='cancelled'? '[cancelled] the process was terminated':error.message||String(error),
      failure? `[category] ${failure.category}${failure.exitCode!==undefined? ` (exit ${failure.exitCode})`:''}`:'',
      error?.restore?.attempted? `[restore] ${error.restore.restored? 'Manifest and lockfile backup restored':error.restore.error||'Restore failed'}`:''
    ].filter(Boolean).join('\n'))
    if(failure?.category==='cancelled') {
      addNotification({ type: 'info',message: 'Command cancelled',description: error.message })
    } else if(failure?.category==='timeout') {
      addNotification({ type: 'warning',message: 'Command timed out',description: 'The process was stopped; you can retry or restore the last backup.' })
    } else {
      addNotification({ type: 'error',message: failure?.retryable? 'Command failed (retryable)':'Command failed',description: error.message })
    }
  } finally {
    if(isCurrent()) {
      setActiveOperationId(null)
      setRunning(false)
    }
  }

}

export async function cancelManagerCommand(activeOperationId: string|null,setCommandOutput: Setter<string>,addNotification: ManagerExecutionContext['addNotification']) {
  if(!activeOperationId) return
  const accepted=await window.electronAPI.operations.cancel(activeOperationId)
  if(!accepted) {
    addNotification({ type: 'info',message: 'Command already finished' })
    return
  }
  setCommandOutput((prev) => `${prev}\n[cancel] requested`)
}
