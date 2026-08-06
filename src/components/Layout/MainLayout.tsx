import React, { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Segmented, Tooltip } from 'antd'
import {
  SearchOutlined,
  SettingOutlined,
  DesktopOutlined,
  BulbOutlined,
  BulbFilled,
  DashboardOutlined,
  ToolOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { ThemeMode, useThemeStore } from '../../stores/themeStore'
import { useResolvedTheme } from '../../hooks/useResolvedTheme'
import { useT } from '../../i18n'
import { getImplementedManagerDefinitions } from '../../domain/managers/registry'
import { managerIcon } from '../../domain/managers/presentation'
import { MANAGER_WORKSPACE_GROUPS, findWorkspaceGroupByPath } from '../../domain/managers/workspaces'
import styles from './MainLayout.module.css'

const { Sider, Content, Footer } = Layout

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, setMode } = useThemeStore()
  const resolvedMode = useResolvedTheme(mode)
  const t = useT()
  
  const isDark = resolvedMode === 'dark'
  const activeMenuKey = (() => {
    if (location.pathname === '/' || location.pathname === '/hub' || location.pathname === '/workspace') return '/workspace'
    const workspaceGroup = findWorkspaceGroupByPath(location.pathname)
    if (workspaceGroup) return workspaceGroup.route
    if (location.pathname === '/tool-versions' || location.pathname === '/environment') return '/environment'
    return location.pathname
  })()
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedMode)
  }, [resolvedMode])
  
  const groupedManagerIds = new Set(MANAGER_WORKSPACE_GROUPS.flatMap((group) => group.managerIds))
  const managerItems = [
    ...MANAGER_WORKSPACE_GROUPS.map((group) => ({
      key: group.route,
      icon: managerIcon(group.iconManagerId),
      label: group.shortLabel
    })),
    ...getImplementedManagerDefinitions().filter((manager) => !groupedManagerIds.has(manager.id)).map((manager) => ({
      key: manager.route || `/${manager.id}`,
      icon: managerIcon(manager.id),
      label: manager.shortName
    }))
  ]

  const menuItems = [
    {
      key: '/workspace',
      icon: <DashboardOutlined />,
      label: '工作区'
    },
    {
      key: 'managers',
      label: '生态管理',
      type: 'group' as const,
      children: managerItems
    },
    {
      key: '/environment',
      icon: <ToolOutlined />,
      label: '环境与工具链'
    },
    {
      key: '/health',
      icon: <SafetyCertificateOutlined />,
      label: '健康与安全'
    },
    {
      key: '/extended',
      icon: <ExperimentOutlined />,
      label: '扩展生态'
    },
    {
      key: '/search',
      icon: <SearchOutlined />,
      label: t('layout.search')
    },
    {
      key: '/plugins',
      icon: <DeploymentUnitOutlined />,
      label: t('layout.plugins')
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('layout.settings')
    }
  ]
  
  return (
    <Layout 
      className={styles.layout} 
      style={{ 
        background: isDark ? 'var(--bg-primary)' : 'var(--bg-primary)'
      }}
    >
      <Sider 
        width={200} 
        className={styles.sider}
        theme={isDark ? 'dark' : 'light'}
        style={{ 
          background: isDark ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className={styles.logo}>
          <img 
            src="../../../icon.jpg" 
            alt="Logo" 
            className={styles.logoIcon}
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 4,
              objectFit: 'cover'
            }}
          />
          <div className={styles.logoText} style={{ color: isDark ? '#ccc' : '#333' }}>
            Dependency Hub
          </div>
        </div>
          <Menu
          mode="inline"
          selectedKeys={[activeMenuKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className={styles.menu}
          theme={isDark ? 'dark' : 'light'}
        />
        <div className={styles.themeSwitch}>
          <Tooltip title={t('layout.themeTooltip')}>
            <Segmented<ThemeMode>
              size="small"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'system', icon: <DesktopOutlined /> },
                { value: 'light', icon: <BulbOutlined /> },
                { value: 'dark', icon: <BulbFilled /> }
              ]}
            />
          </Tooltip>
        </div>
      </Sider>
      <Layout 
        className={styles.contentLayout} 
        style={{ background: 'var(--bg-primary)' }}
      >
        <Content 
          className={styles.content} 
          style={{ background: 'var(--bg-primary)' }}
        >
          {children}
        </Content>
        <Footer 
          className={styles.footer} 
          style={{ 
            background: 'var(--bg-primary)', 
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-color)'
          }}
        >
          Dependency Manager Framework v1.0.0
        </Footer>
      </Layout>
    </Layout>
  )
}

export default MainLayout
