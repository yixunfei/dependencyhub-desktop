import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useWorkspaceRequest } from './useWorkspaceRequest'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

describe('workspace async requests', () => {
  it('ignores old inventory after switching away and back to the same project', async () => {
    const { result, rerender } = renderHook(({ projectPath }) => useWorkspaceRequest({ projectPath }), {
      initialProps: { projectPath: 'A' }
    })
    const old = deferred<string>()
    const apply = vi.fn()
    let pending!: Promise<void>
    act(() => { pending = result.current.run(() => old.promise, apply, vi.fn()) })
    rerender({ projectPath: 'B' })
    rerender({ projectPath: 'A' })
    await act(async () => { old.resolve('old inventory'); await pending })
    expect(apply).not.toHaveBeenCalled()
    expect(result.current.pending).toBe(false)
  })

  it('only applies the latest plan and keeps its loading state when an older request fails', async () => {
    const { result } = renderHook(() => useWorkspaceRequest({ projectPath: 'A', managerId: 'pnpm' }))
    const old = deferred<string>()
    const latest = deferred<string>()
    const apply = vi.fn()
    const fail = vi.fn()
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.run(() => old.promise, apply, fail)
      second = result.current.run(() => latest.promise, apply, fail)
    })
    await act(async () => { old.reject(new Error('stale')); await first })
    expect(fail).not.toHaveBeenCalled()
    expect(result.current.pending).toBe(true)
    await act(async () => { latest.resolve('latest plan'); await second })
    expect(apply).toHaveBeenCalledExactlyOnceWith('latest plan')
    expect(result.current.pending).toBe(false)
  })

  it('does not apply a restore response after unmount', async () => {
    const { result, unmount } = renderHook(() => useWorkspaceRequest({ projectPath: 'A' }))
    const restore = deferred<string>()
    const apply = vi.fn()
    let pending!: Promise<void>
    act(() => { pending = result.current.run(() => restore.promise, apply, vi.fn()) })
    unmount()
    await act(async () => { restore.resolve('restored'); await pending })
    expect(apply).not.toHaveBeenCalled()
  })
})
