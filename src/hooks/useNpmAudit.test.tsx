import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNpmAudit } from './useNpmAudit'

const audit = vi.fn()
const clean: AuditResult = { vulnerabilities: {}, metadata: {
  vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: 0, devDependencies: 0
} }
beforeEach(() => {
  audit.mockReset()
  vi.stubGlobal('electronAPI', { npm: { audit } })
})

it('does not turn a failed audit into a clean security result', async () => {
  audit.mockRejectedValue(new Error('Registry offline'))
  const { result } = renderHook(() => useNpmAudit(true, '/project', false))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.auditResult).toBeNull()
  expect(result.current.auditError).toBe('Registry offline')
})

it('reports unsupported global audits without sending an IPC request', async () => {
  const { result } = renderHook(() => useNpmAudit(true, '', true))
  await waitFor(() => expect(result.current.auditError).not.toBe(''))
  expect(result.current.auditResult).toBeNull()
  expect(audit).not.toHaveBeenCalled()
})

it('rejects a previous project response after switching projects', async () => {
  let finish!: (value: AuditResult) => void
  audit.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  audit.mockResolvedValueOnce(clean)
  const { result, rerender } = renderHook(({ path }) => useNpmAudit(true, path, false), { initialProps: { path: '/first' } })
  rerender({ path: '/second' })
  await waitFor(() => expect(result.current.auditResult).toEqual(clean))
  await act(async () => { finish({ error: 'Stale error' }) })
  expect(result.current.auditResult).toEqual(clean)
  expect(result.current.auditError).toBe('')
})

it('clears old results on rescan and closing invalidates an in-flight reply', async () => {
  audit.mockResolvedValueOnce(clean)
  let finish!: (value: AuditResult) => void
  const { result, rerender } = renderHook(({ visible }) => useNpmAudit(visible, '/project', false), { initialProps: { visible: true } })
  await waitFor(() => expect(result.current.auditResult).toEqual(clean))
  audit.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  act(() => { void result.current.runAudit() })
  expect(result.current.auditResult).toBeNull()
  rerender({ visible: false })
  await act(async () => { finish(clean) })
  expect(result.current.auditResult).toBeNull()
  expect(result.current.loading).toBe(false)
})
