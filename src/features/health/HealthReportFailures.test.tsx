import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HealthReportFailures } from './HealthReportFailures'

describe('HealthReportFailures', () => {
  it('renders each backend failure and retries one block', () => {
    const onRetry = vi.fn()
    const onRetryAll = vi.fn()
    render(
      <HealthReportFailures
        failures={[{ key: 'license', label: '许可证合规报告', message: 'registry unreachable' }]}
        onRetry={onRetry}
        onRetryAll={onRetryAll}
      />
    )

    expect(screen.getByText(/registry unreachable/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试许可证合规报告' }))
    expect(onRetry).toHaveBeenCalledWith('license')
    fireEvent.click(screen.getByRole('button', { name: '重试全部失败报告' }))
    expect(onRetryAll).toHaveBeenCalledTimes(1)
  })

  it('does not render an alert when all reports are healthy', () => {
    const { container } = render(<HealthReportFailures failures={[]} onRetry={vi.fn()} onRetryAll={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
