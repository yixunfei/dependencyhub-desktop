import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Form } from 'antd'
import { usePackageCheck } from './Publish'
import type { PublishFormValues } from './publishTypes'

it('discards an old project check after the selected directory changes', async () => {
  let resolveCheck!: (value: unknown) => void
  const check = vi.fn(() => new Promise((resolve) => { resolveCheck = resolve }))
  const original = window.electronAPI
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
    publish: { check }, project: { readPackage: vi.fn().mockResolvedValue({ name: 'old-project' }) }
  } })
  try {
    const hook = renderHook(() => {
      const [form] = Form.useForm<PublishFormValues>()
      return usePackageCheck(form)
    })
    act(() => hook.result.current.selectProject('/project-a'))
    let pending!: Promise<void>
    act(() => { pending = hook.result.current.handleCheck() })
    act(() => hook.result.current.selectProject('/project-b'))
    await act(async () => {
      resolveCheck({ canPublish: true, packageInfo: { name: 'old-project' } })
      await pending
    })
    expect(hook.result.current.projectPath).toBe('/project-b')
    expect(hook.result.current.checkResult).toBeNull()
    expect(hook.result.current.packageJson).toBeNull()
    expect(hook.result.current.checking).toBe(false)
    hook.unmount()
  } finally {
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: original })
  }
})
