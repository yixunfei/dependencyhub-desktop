import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'
import HealthCenter from './HealthCenter'

const bridge = {
  system: { checkTools: vi.fn().mockResolvedValue([]) },
  plugins: { catalog: vi.fn().mockResolvedValue([]) },
  frameworkCoverage: { report: vi.fn().mockResolvedValue(null) }
}
// The assertions below read Chinese copy, which now comes from the dictionary.
// Pinning the language keeps them meaningful as more of HealthCenter is localized.
beforeEach(() => {
  useAppStore.setState({ currentPath: '', notifications: [] })
  useSettingsStore.setState({ language: 'zh-CN' })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: bridge })
})
afterEach(() => {
  useSettingsStore.setState({ language: 'en-US' })
  vi.clearAllMocks()
})

describe('health center integration', () => {
  it('renders without a project, including empty list reports, and refreshes safely', async () => {
    render(<MemoryRouter><HealthCenter /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '健康与安全中心' })).toBeInTheDocument()
    await waitFor(() => expect(bridge.system.checkTools).toHaveBeenCalledTimes(1))
    const refresh = screen.getByRole('button', { name: /重新检测/ })
    await waitFor(() => expect(refresh).not.toHaveClass('ant-btn-loading'))
    expect(screen.queryByText(/个报告加载失败/)).not.toBeInTheDocument()
    await act(async () => refresh.click())
    expect(bridge.system.checkTools).toHaveBeenCalledTimes(2)
    expect(screen.getByText('未选择')).toBeInTheDocument()
  }, 15000)

  it('keeps the selected project when the previous project detection finishes late', async () => {
    let finishOld!: (value: unknown) => void
    const oldDetection = new Promise((resolve) => { finishOld = resolve })
    const detected = (id: string) => ({ detectedManagers: [{ id, detected: true, implemented: true }] })
    const api = new Proxy({}, {
      get: (_, service: string) => new Proxy({}, {
        get: (_, method: string) => async (project: string) => {
          if (service === 'project' && method === 'detect') return project === '/project-a' ? oldDetection : detected('cargo')
          if (['checkTools', 'catalog', 'list', 'listSnapshots', 'discover'].includes(method)) return []
          return null
        }
      })
    })
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: api })
    useAppStore.setState({ currentPath: '/project-a' })
    render(<MemoryRouter><HealthCenter /></MemoryRouter>)
    await act(async () => { useAppStore.setState({ currentPath: '/project-b' }) })
    await waitFor(() => expect(screen.getByText('Cargo').closest('tr')).toHaveTextContent('当前项目'))
    await act(async () => { finishOld(detected('npm')); await oldDetection })
    expect(screen.getByText('Cargo').closest('tr')).toHaveTextContent('当前项目')
    expect(screen.getByText('npm').closest('tr')).not.toHaveTextContent('当前项目')
    expect(screen.getByText('/project-b')).toBeInTheDocument()
  }, 15000)
})
