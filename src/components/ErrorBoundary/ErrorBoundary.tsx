import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
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
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <main role="alert" style={{ padding: 24 }}>
        <h1>页面加载失败</h1>
        <p>当前页面发生异常，请刷新后重试。</p>
        <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
      </main>
    )
  }
}
