import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../../stores/settingsStore'
import { HealthReportFailures } from './HealthReportFailures'

const failures = [{ key: 'license', label: '许可证合规报告', message: 'registry unreachable' }]

// The component resolves its copy through the dictionary, so the language has to
// be pinned for the assertions to mean anything.
beforeEach(() => useSettingsStore.setState({ language: 'zh-CN' }))
afterEach(() => useSettingsStore.setState({ language: 'en-US' }))

describe('HealthReportFailures', () => {
  it('renders each backend failure and retries one block', () => {
    const onRetry = vi.fn()
    const onRetryAll = vi.fn()
    render(<HealthReportFailures failures={failures} onRetry={onRetry} onRetryAll={onRetryAll} />)

    expect(screen.getByText(/registry unreachable/)).toBeInTheDocument()
    expect(screen.getByText('1 个报告加载失败')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试许可证合规报告' }))
    expect(onRetry).toHaveBeenCalledWith('license')
    fireEvent.click(screen.getByRole('button', { name: '重试全部失败报告' }))
    expect(onRetryAll).toHaveBeenCalledTimes(1)
  })

  it('renders the English copy for the default language', () => {
    useSettingsStore.setState({ language: 'en-US' })
    render(<HealthReportFailures failures={failures} onRetry={vi.fn()} onRetryAll={vi.fn()} />)

    expect(screen.getByText('Reports failed to load: 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry 许可证合规报告' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry all failed reports' })).toBeInTheDocument()
  })

  it('does not render an alert when all reports are healthy', () => {
    const { container } = render(<HealthReportFailures failures={[]} onRetry={vi.fn()} onRetryAll={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
