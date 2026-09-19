// @vitest-environment node
import { expect, it } from 'vitest'
import { cachedReport, invalidateReports, reportCacheStats } from './reportCache'

it('runs one computation for concurrent callers', async () => {
  invalidateReports()
  let calls = 0
  const load = async () => {
    calls += 1
    return 'report'
  }
  const results = await Promise.all([
    cachedReport('a:1', 30_000, load),
    cachedReport('a:1', 30_000, load),
    cachedReport('a:1', 30_000, load)
  ])
  expect(results).toEqual(['report', 'report', 'report'])
  expect(calls).toBe(1)
})

it('reuses a fresh value and recomputes once the TTL passes', async () => {
  invalidateReports()
  let calls = 0
  const load = async () => {
    calls += 1
    return calls
  }
  expect(await cachedReport('b:1', 500, load)).toBe(1)
  expect(await cachedReport('b:1', 500, load)).toBe(1)

  const expired = await cachedReport('b:1', 0, load)
  expect(expired).toBe(2)
})

it('never caches a failure, so a transient error cannot pin the result', async () => {
  invalidateReports()
  let attempt = 0
  const load = async () => {
    attempt += 1
    if (attempt === 1) throw new Error('transient')
    return 'recovered'
  }
  await expect(cachedReport('c:1', 30_000, load)).rejects.toThrow('transient')
  expect(await cachedReport('c:1', 30_000, load)).toBe('recovered')
  expect(reportCacheStats().inflight).toBe(0)
})

it('drops a project after it is written to', async () => {
  invalidateReports('project:/tmp/demo')
  let calls = 0
  const load = async () => {
    calls += 1
    return calls
  }
  const key = 'project:/tmp/demo:report'
  expect(await cachedReport(key, 30_000, load)).toBe(1)
  invalidateReports('project:/tmp/demo')
  expect(await cachedReport(key, 30_000, load)).toBe(2)
})
