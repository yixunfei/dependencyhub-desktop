// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { withProjectMutation, projectMutationQueueSize } from './projectMutation'

afterEach(() => vi.useRealTimers())

it('keeps running writes serialized after waiting callers time out', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const running = withProjectMutation('/queue-timeout-regression', () => new Promise<void>((resolve) => { finish = resolve }))
  await vi.advanceTimersByTimeAsync(0)
  const skipped = vi.fn(async () => undefined)
  const waiting = withProjectMutation('/queue-timeout-regression', skipped)
  const rejected = expect(waiting).rejects.toThrow('waiting for the previous')
  await vi.advanceTimersByTimeAsync(60_001)
  await rejected
  expect(projectMutationQueueSize()).toBe(1)
  const nextTask = vi.fn(async () => 'done')
  const next = withProjectMutation('/queue-timeout-regression', nextTask)
  await vi.advanceTimersByTimeAsync(0)
  expect(nextTask).not.toHaveBeenCalled()
  finish()
  await expect(running).resolves.toBeUndefined()
  await expect(next).resolves.toBe('done')
  expect(skipped).not.toHaveBeenCalled()
  expect(projectMutationQueueSize()).toBe(0)
})

it('releases failed writes and permits nested mutations', async () => {
  await expect(withProjectMutation('/queue-nested-regression', async () => {
    await withProjectMutation('/queue-nested-regression', async () => undefined)
    throw new Error('write failed')
  })).rejects.toThrow('write failed')
  await expect(withProjectMutation('/queue-nested-regression', async () => 42)).resolves.toBe(42)
  expect(projectMutationQueueSize()).toBe(0)
})
