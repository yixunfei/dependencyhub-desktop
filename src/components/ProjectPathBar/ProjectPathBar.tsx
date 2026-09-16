import React from 'react'
import { Button, Dropdown, Tooltip } from 'antd'
import { ClearOutlined, DownOutlined, FolderOpenOutlined, HistoryOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import styles from './ProjectPathBar.module.css'

interface ProjectPathBarProps {
  label?: string
  buttonText?: string
  className?: string
  compact?: boolean
}

const ProjectPathBar: React.FC<ProjectPathBarProps> = ({ label = '项目路径', buttonText = '选择目录', className, compact = false }) => {
  const currentPath = useAppStore((state) => state.currentPath)
  const recentPaths = useAppStore((state) => state.recentPaths)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const clearRecentPaths = useAppStore((state) => state.clearRecentPaths)
  const addNotification = useAppStore((state) => state.addNotification)

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setCurrentPath(path)
    addNotification({ type: 'info', message: '项目路径已切换', description: path })
  }

  const recentMenu = {
    items: [
      ...recentPaths.map((path) => ({ key: path, label: <Tooltip title={path}><span>{path}</span></Tooltip> })),
      ...(recentPaths.length ? [{ type: 'divider' as const }] : []),
      { key: '__clear__', label: '清除最近目录', icon: <ClearOutlined />, danger: true }
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === '__clear__') clearRecentPaths()
      else if (key) {
        setCurrentPath(key)
        addNotification({ type: 'info', message: '项目路径已切换', description: key })
      }
    }
  }

  const displayPath = currentPath || '未选择'
  return (
    <div className={[styles.pathBar, compact ? styles.compact : styles.expanded, className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}:</span>
      <Tooltip title={displayPath}><span className={[styles.value, currentPath ? '' : styles.empty].filter(Boolean).join(' ')}>{displayPath}</span></Tooltip>
      {recentPaths.length > 0 && <Dropdown menu={recentMenu} trigger={['click']}><Button size="small" icon={<HistoryOutlined />} aria-label="最近目录"><DownOutlined /></Button></Dropdown>}
      <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectDirectory}>{buttonText}</Button>
    </div>
  )
}

export default ProjectPathBar
