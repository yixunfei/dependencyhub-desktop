import React from 'react'
import { Button, Result, Space, Typography } from 'antd'
import { useT } from '../../i18n'
import { rememberRendererError } from './errors'

const { Paragraph, Text } = Typography

interface ErrorBoundaryProps {
  children: React.ReactNode
  /**
   * Changing this value clears a previous failure, so navigating to another
   * route is enough to recover instead of forcing a full page reload.
   */
  resetKey?: string
  /** Defaults to a compact inline card when a route boundary failed. */
  variant?: 'page' | 'inline'
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Renderer error', error, info.componentStack)
    rememberRendererError(error)
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  private retry = () => this.setState({ error: null })

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <BoundaryFallback
        error={this.state.error}
        onRetry={this.retry}
        variant={this.props.variant || 'page'}
      />
    )
  }
}

function BoundaryFallback({ error, onRetry, variant }: {
  error: Error
  onRetry: () => void
  variant: 'page' | 'inline'
}) {
  const t = useT()
  const [copied, setCopied] = React.useState(false)

  const copyDetails = () => {
    void navigator.clipboard?.writeText(`${error.name}: ${error.message}\n\n${error.stack || ''}`)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    <Result
      status="warning"
      style={variant === 'inline' ? { padding: '24px 12px' } : { padding: '48px 12px' }}
      title={t('errorBoundary.title')}
      subTitle={t('errorBoundary.description')}
      extra={
        <Space wrap>
          <Button type="primary" onClick={onRetry}>{t('errorBoundary.retry')}</Button>
          <Button onClick={copyDetails}>
            {copied ? t('errorBoundary.detailsCopied') : t('errorBoundary.copyDetails')}
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary" ellipsis={{ rows: 3, tooltip: error.message }}>
        <Text code>{error.name}</Text> {error.message}
      </Paragraph>
    </Result>
  )
}

export default ErrorBoundary
