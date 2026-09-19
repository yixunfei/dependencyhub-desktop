// @vitest-environment node
import { existsSync } from 'fs'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runLoggedCommand } from './commandRunner'
import { withProjectMutation, projectMutationQueueSize } from './projectMutation'
import { runProjectOperation } from './projectGuard'
import {
  attachOperationFailure, beginOperation, currentOperationContext, requestOperationCancel,
  resetOperations, runWithOperationContext
} from './operationContext'

vi.mock('./commandLogger', () => ({
  createLogId: () => 'test-log', formatCommand: (bin: string) => bin, sendCommandLog: vi.fn()
}))
vi.mock('./operationHistory', () => ({ recordOperationHistory: vi.fn().mockResolvedValue(undefined) }))

const directories: string[] = []
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const dependencies = {
  beginOperation, runWithOperationContext, withProjectMutation, attachFailure: attachOperationFailure
}
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'dependencyhub-execution-test-'))
  directories.push(directory)
  return directory
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
afterEach(async () => {
  resetOperations()
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('project operation boundary', () => {
  it('allows a guarded adapter to acquire its existing lock while serializing independent writes', async () => {
    const cwd = await fixture()
    const events: string[] = []
    await Promise.all([
      runProjectOperation(dependencies, cwd, 'outer', () => withProjectMutation(cwd, async () => {
        events.push('inner-start')
        await wait(20)
        events.push('inner-end')
      })),
      withProjectMutation(cwd, async () => { events.push('next') })
    ])
    expect(events).toEqual(['inner-start', 'inner-end', 'next'])
    expect(projectMutationQueueSize()).toBe(0)
  }, 2000)

  it('serializes operations without a project path through an explicit queue key', async () => {
    // Global npm mutations have no cwd; without serializeKey they would skip
    // the queue entirely and could clobber the shared global prefix.
    const events: string[] = []
    await Promise.all([
      runProjectOperation(dependencies, undefined, 'global-a', async () => {
        events.push('a-start')
        await wait(25)
        events.push('a-end')
      }, { serializeKey: '__global__' }),
      runProjectOperation(dependencies, undefined, 'global-b', async () => {
        events.push('b-start')
        await wait(5)
        events.push('b-end')
      }, { serializeKey: '__global__' })
    ])
    expect(events).toEqual(['a-start', 'a-end', 'b-start', 'b-end'])
    expect(projectMutationQueueSize()).toBe(0)
  }, 2000)

  it('never snapshots or writes a cancelled queued operation', async () => {
    const cwd = await fixture()
    const gate = deferred()
    const first = withProjectMutation(cwd, () => gate.promise)
    const write = vi.fn().mockResolvedValue(undefined)
    const snapshot = vi.fn().mockResolvedValue(undefined)
    const next = runProjectOperation({ ...dependencies, snapshot }, cwd, 'queued', write, { operationId: 'queued' })
    expect(requestOperationCancel('queued')).toBe(true)
    const failure = expect(next).rejects.toMatchObject({ failure: { category: 'cancelled' } })
    await failure
    gate.resolve()
    await Promise.all([first, failure])
    expect(snapshot).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  }, 2000)

  it('rechecks cancellation after an asynchronous snapshot', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const snapshot = async () => { requestOperationCancel('snapshot') }
    await expect(runProjectOperation({ ...dependencies, snapshot }, await fixture(), 'snapshot', write, {
      operationId: 'snapshot'
    })).rejects.toMatchObject({ failure: { category: 'cancelled' } })
    expect(write).not.toHaveBeenCalled()
  })

  it('preserves the explicit no-timeout option and does not snapshot reads', async () => {
    const snapshot = vi.fn()
    await runProjectOperation({ ...dependencies, snapshot }, await fixture(), 'read', async () => {
      expect(currentOperationContext()?.timeoutMs).toBeUndefined()
    }, { timeoutMs: null, kind: 'read' })
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('rejects duplicate ids without replacing the existing cancellation controller', () => {
    const first = beginOperation({ operationId: 'duplicate' })
    expect(() => beginOperation({ operationId: 'duplicate' })).toThrow('already active')
    requestOperationCancel('duplicate')
    expect(first.context.signal.aborted).toBe(true)
    first.finish()
  })

  it.runIf(process.platform === 'win32')('uses one queue for Windows path case aliases', async () => {
    const cwd = await fixture()
    const events: number[] = []
    await Promise.all([
      withProjectMutation(cwd, async () => { await wait(30); events.push(1) }),
      withProjectMutation(cwd.toUpperCase(), async () => { events.push(2) })
    ])
    expect(events).toEqual([1, 2])
  })
})

describe('process lifetime', () => {
  it('does not spawn a pre-cancelled command', async () => {
    const marker = join(await fixture(), 'must-not-exist')
    const controller = new AbortController()
    controller.abort()
    await expect(runLoggedCommand(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`], {
      signal: controller.signal, log: false
    })).rejects.toMatchObject({ failure: { category: 'cancelled' } })
    await wait(100)
    expect(existsSync(marker)).toBe(false)
  })

  it('terminates descendants before releasing a cancelled command', async () => {
    const cwd = await fixture()
    const ready = join(cwd, 'ready')
    const marker = join(cwd, 'late-write')
    const descendant = `const fs=require('fs'); fs.writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setTimeout(()=>fs.writeFileSync(${JSON.stringify(marker)},'bad'), 1000); setInterval(()=>{},1000)`
    const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'inherit'}); setInterval(()=>{},1000)`
    const controller = new AbortController()
    const command = runLoggedCommand(process.execPath, ['-e', parent], { signal: controller.signal, timeoutMs: 5000, log: false })
    const outcome = command.catch((error: unknown) => error)
    try {
      for (let i = 0; i < 100 && !existsSync(ready); i += 1) await wait(20)
      expect(existsSync(ready)).toBe(true)
      controller.abort()
      expect(await outcome).toMatchObject({ failure: { category: 'cancelled' } })
      const pid = Number(await readFile(ready, 'utf8'))
      // The process tree is already gone when rollback/next mutation may begin.
      expect(() => process.kill(pid, 0)).toThrow()
      await wait(1100)
      expect(existsSync(marker)).toBe(false)
    } finally {
      controller.abort()
      await outcome
    }
  }, 8000)

  it('limits cumulative output in bytes, including multibyte text', async () => {
    const script = "process.stdout.write('中'.repeat(100)); setTimeout(()=>process.stdout.write('中'.repeat(100)),40)"
    await expect(runLoggedCommand(process.execPath, ['-e', script], { maxBuffer: 400, log: false }))
      .rejects.toMatchObject({ failure: { category: 'output-limit' } })
  })

  it('waits for timed-out process exit and preserves classification through the guard', async () => {
    // Mutations require a real project path now (a missing cwd is rejected
    // instead of silently running against the app directory).
    const cwd = await fixture()
    await expect(runProjectOperation(dependencies, cwd, 'timeout', () =>
      runLoggedCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { log: false, cwd }),
    { operationId: 'timeout', timeoutMs: 100 })).rejects.toMatchObject({
      failure: { category: 'timeout', operationId: 'timeout' }
    })
  })
})
