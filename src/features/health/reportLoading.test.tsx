import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createHealthReportBlock, HealthReportLoader } from './reportBlocks'
import { reportStatusTag } from './reportStatus'
import { useHealthReportLoader } from './useHealthReportLoader'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

describe('health report requests', () => {
  it('keeps the newest retry when an older request finishes last', async () => {
    const loader = new HealthReportLoader()
    const old = deferred<string>()
    const apply = vi.fn()
    const status = vi.fn()
    const first = loader.load(createHealthReportBlock('report', 'Report', () => old.promise, apply), status)
    await loader.load(createHealthReportBlock('report', 'Report', async () => 'new', apply), status)
    old.resolve('old')
    await first
    expect(apply.mock.calls).toEqual([['new']])
    expect(status.mock.calls).toEqual([['report', 'ready']])
  })

  it('invalidates both data and errors from a previous project or refresh', async () => {
    const loader = new HealthReportLoader()
    const old = deferred<string>()
    const apply = vi.fn()
    const status = vi.fn()
    const first = loader.load(createHealthReportBlock('report', 'Report', () => old.promise, apply), status)
    loader.invalidate()
    old.reject(new Error('old project error'))
    await first
    expect(apply).not.toHaveBeenCalled()
    expect(status).not.toHaveBeenCalled()
  })

  it('reports apply failures and does not mark loading as ready', async () => {
    const status = vi.fn()
    await new HealthReportLoader().load(createHealthReportBlock('broken', 'Broken', async () => 1, () => {
      throw new Error('render data invalid')
    }), status)
    expect(status).toHaveBeenCalledWith('broken', 'error', expect.any(Error))
    expect(reportStatusTag({ status: 'loading' })).toBe('loading')
  })

  it('isolates failures and retries only failed report blocks', async () => {
    const healthy = vi.fn().mockResolvedValue('good')
    const failing = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('recovered')
    const apply = vi.fn()
    const { result } = renderHook(() => useHealthReportLoader(() => [
      createHealthReportBlock('good', 'Healthy', healthy, apply),
      createHealthReportBlock('bad', 'Failing', failing, apply)
    ]))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.failedReports).toEqual([{ key: 'bad', label: 'Failing', message: 'offline' }])
    await act(() => result.current.reloadFailedReports())
    expect(result.current.failedReports).toEqual([])
    expect(healthy).toHaveBeenCalledTimes(1)
    expect(failing).toHaveBeenCalledTimes(2)
    expect(apply).toHaveBeenCalledWith('recovered')
  })

  it('does not commit a pending report after unmount', async () => {
    const pending = deferred<string>()
    const apply = vi.fn()
    const { unmount } = renderHook(() => useHealthReportLoader(() => [
      createHealthReportBlock('report', 'Report', () => pending.promise, apply)
    ]))
    unmount()
    await act(async () => { pending.resolve('stale'); await pending.promise })
    expect(apply).not.toHaveBeenCalled()
  })
})
