import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Layout, Menu, Segmented, Tooltip } from 'antd'
import {
  DesktopOutlined,
  BulbOutlined,
  BulbFilled,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import { ThemeMode, useThemeStore } from '../../stores/themeStore'
import { useResolvedTheme } from '../../hooks/useResolvedTheme'
import { useT } from '../../i18n'
import { useAppStore } from '../../stores/appStore'
import { findWorkspaceGroupByPath } from '../../domain/managers/workspaces'
import { buildMainMenuEntries, buildManagerMenuEntries } from './layoutMenu'
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
  const [collapsed, setCollapsed] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1199.98px)').matches
  ))
  const currentPath = useAppStore((state) => state.currentPath)
  const projectLabel = currentPath ? currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath : t('layout.noProject')
  const collapseLabel = collapsed ? t('layout.expandNavigation') : t('layout.collapseNavigation')
  
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
  
  // Dozens of entries per rebuild would defeat Menu's own diffing, so both
  // menus are derived once per language and only rebuilt when that changes.
  const managerItems = useMemo(() => buildManagerMenuEntries(), [])
  const menuItems = useMemo(() => buildMainMenuEntries(t, managerItems), [t, managerItems])
  
  return (
    <Layout 
      className={styles.layout} 
      style={{ 
        background: isDark ? 'var(--bg-primary)' : 'var(--bg-primary)'
      }}
    >
      <Sider 
        width={200} 
        collapsedWidth={72}
        breakpoint="xl"
        collapsible
        collapsed={collapsed}
        trigger={null}
        onCollapse={setCollapsed}
        className={`${styles.sider} ${collapsed ? styles.siderCollapsed : ''}`}
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
          {!collapsed && (
            <div className={styles.logoText} style={{ color: isDark ? '#ccc' : '#333' }}>
              Dependency Hub
            </div>
          )}
        </div>
        <div className={styles.currentProject}>
          <Tooltip title={currentPath || t('layout.noProject')} placement="right">
            <Button type="text" block onClick={() => navigate('/workspace')} icon={<FolderOpenOutlined />}>
              {!collapsed && projectLabel}
            </Button>
          </Tooltip>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeMenuKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className={styles.menu}
          theme={isDark ? 'dark' : 'light'}
        />
        <div className={styles.sidebarControls}>
          <div className={styles.themeSwitch}>
            <Tooltip title={t('layout.themeTooltip')} placement={collapsed ? 'right' : 'top'}>
              <Segmented<ThemeMode>
                size="small"
                vertical={collapsed}
                value={mode}
                onChange={setMode}
                aria-label={t('layout.themeTooltip')}
                options={[
                  { value: 'system', icon: <DesktopOutlined /> },
                  { value: 'light', icon: <BulbOutlined /> },
                  { value: 'dark', icon: <BulbFilled /> }
                ]}
              />
            </Tooltip>
          </div>
          <Tooltip title={collapseLabel} placement="right">
            <Button
              type="text"
              className={styles.collapseButton}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              aria-label={collapseLabel}
              onClick={() => setCollapsed((value) => !value)}
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
