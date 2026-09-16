import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ManagerCommandResult } from '@shared/managerWorkspace'
import { executeManagerCommand, type ManagerExecutionContext } from './managerExecution'

function context() {
  return {
    currentPath: '/project-a', activeManager: 'pnpm',
    operationScopeRef: { current: { currentPath: '/project-a', activeManager: 'pnpm', id: '' } },
    currentPathRef: { current: '/project-a' },
    setActiveOperationId: vi.fn(), setRunning: vi.fn(), setCommandOutput: vi.fn(),
    setLastBackup: vi.fn(), addNotification: vi.fn(), loadDependencies: vi.fn(),
    setDependencyDiff: vi.fn(), setReadinessReport: vi.fn()
  } satisfies ManagerExecutionContext
}

describe('manager command feedback', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ignores delayed post-command health refreshes after the operation scope changes', async () => {
    const state = context()
    let resolve!: (value: null) => void
    const response = new Promise<null>((done) => { resolve = done })
    const api = {
      supplyChain: { dependencyDiffLatestSnapshot: vi.fn(() => response) },
      readiness: { report: vi.fn(() => response) }
    }
    vi.stubGlobal('electronAPI', api)
    const pending = executeManagerCommand(state, async () => ({
      managerId: 'pnpm', command: 'pnpm install', stdout: '', stderr: '', dryRun: false
    }))
    await vi.waitFor(() => expect(api.readiness.report).toHaveBeenCalled())
    state.operationScopeRef.current.id = 'different-manager'
    resolve(null)
    await pending
    expect(state.setDependencyDiff).not.toHaveBeenCalled()
    expect(state.setReadinessReport).not.toHaveBeenCalled()
  })

  it('does not apply an old command result or clear the new operation after a scope change', async () => {
    const state = context()
    let resolve!: (result: ManagerCommandResult) => void
    const pending = executeManagerCommand(state, () => new Promise((done) => { resolve = done }))
    state.operationScopeRef.current.id = 'new-operation'
    state.setRunning.mockClear()
    state.setCommandOutput.mockClear()
    resolve({ managerId: 'pnpm', command: 'pnpm install', stdout: 'old project', stderr: '', dryRun: false })
    await pending
    expect(state.setCommandOutput).not.toHaveBeenCalled()
    expect(state.setRunning).not.toHaveBeenCalled()
    expect(state.loadDependencies).not.toHaveBeenCalled()
    expect(state.addNotification).not.toHaveBeenCalled()
  })

  it('shows cancellation and the actual manifest restoration result', async () => {
    const state = context()
    const backup = { path: '/project-a/backup.json', files: [] }
    await executeManagerCommand(state, async () => {
      throw Object.assign(new Error('Command cancelled'), {
        backup,
        failure: { category: 'cancelled', operationId: 'operation' },
        restore: { attempted: true, restored: true }
      })
    })
    expect(state.setLastBackup).toHaveBeenCalledWith(backup)
    expect(state.setCommandOutput).toHaveBeenLastCalledWith(expect.stringContaining('backup restored'))
    expect(state.addNotification).toHaveBeenCalledWith(expect.objectContaining({ message: 'Command cancelled' }))
    expect(state.setRunning).toHaveBeenLastCalledWith(false)
  })
})
