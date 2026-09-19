import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles/global.css'
import { useThemeStore } from './stores/themeStore'
import { useSettingsStore } from './stores/settingsStore'
import { useResolvedTheme } from './hooks/useResolvedTheme'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'

const Root: React.FC = () => {
  const mode = useThemeStore((state) => state.mode)
  const language = useSettingsStore((state) => state.language)
  const resolvedMode = useResolvedTheme(mode)
  
  return (
    <React.StrictMode>
      <HashRouter>
        <ConfigProvider
          locale={language === 'en-US' ? enUS : zhCN}
          theme={{
            algorithm: resolvedMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: {
              colorPrimary: '#1890ff',
              borderRadius: 6,
            }
          }}
        >
          <AntdApp>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AntdApp>
        </ConfigProvider>
      </HashRouter>
    </React.StrictMode>
  )
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(<Root />)
