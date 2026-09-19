// @vitest-environment node
import { expect, it } from 'vitest'
import { createLimiter } from './concurrency'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

it('never runs more tasks than its budget', async () => {
  const limiter = createLimiter(3)
  let active = 0
  let peak = 0

  await limiter.runAll([1, 2, 3, 4, 5, 6, 7], async () => {
    active += 1
    peak = Math.max(peak, active)
    await wait(10)
    active -= 1
  })

  expect(peak).toBe(3)
  expect(limiter.pending).toBe(0)
})

it('preserves input order regardless of completion order', async () => {
  const limiter = createLimiter(2)
  const results = await limiter.runAll([30, 1, 20], async (delay) => {
    await wait(delay)
    return delay
  })
  expect(results).toEqual([30, 1, 20])
})

it('lets a nested task through instead of queueing behind its parent', async () => {
  // A mutation that probes the toolchain reaches the same spawn point again; if
  // the limiter counted that as a second permit, a full budget would deadlock.
  const limiter = createLimiter(1)
  const nested = await limiter.run(async () => await limiter.run(async () => 'done'))
  expect(nested).toBe('done')
})

it('keeps the queue drained after a task rejects', async () => {
  const limiter = createLimiter(1)
  const first = limiter.run(async () => {
    await wait(5)
    throw new Error('boom')
  })
  await expect(first).rejects.toThrow('boom')
  await expect(limiter.run(async () => 'after')).resolves.toBe('after')
})
