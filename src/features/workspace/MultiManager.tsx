import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Space, Tag } from 'antd'
import { ArrowRightOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ProjectPathBar from '../../components/ProjectPathBar/ProjectPathBar'
import RuntimeManagerSwitch from '../../components/ManagerSwitch/RuntimeManagerSwitch'
import { getImplementedManagerDefinitions, implementedManagerRoutes } from '../../domain/managers/registry'
import { useAppStore } from '../../stores/appStore'
import styles from './MultiManager.module.css'

interface MultiManagerPageProps {
  initialManager?: PackageManagerId
}

const MultiManagerPage: React.FC<MultiManagerPageProps> = ({ initialManager = 'npm' }) => {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const managers = getImplementedManagerDefinitions()

  useEffect(() => {
    void loadProjectInfo()
  }, [currentPath])

  const detectedManagers = useMemo(() => {
    return (projectInfo?.detectedManagers || [])
      .filter((manager) => manager.detected && manager.implemented)
      .map((manager) => manager.id as PackageManagerId)
      .filter((manager) => Boolean(implementedManagerRoutes[manager]))
  }, [projectInfo])
  const activeManager = detectedManagers.includes(initialManager)
    ? initialManager
    : detectedManagers[0] || initialManager

  const loadProjectInfo = async () => {
    if (!currentPath) {
      setProjectInfo(null)
      return
    }

    try {
      setProjectInfo(await window.electronAPI.project.detect(currentPath))
    } catch {
      setProjectInfo(null)
    }
  }

  const openManager = (managerId: PackageManagerId) => {
    navigate(implementedManagerRoutes[managerId])
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h2 className={styles.title}>生态管理入口</h2>
            <div className={styles.subtitle}>旧版聚合页已收敛为兼容入口；具体能力已迁移到各生态独立工作台。</div>
          </div>
          <RuntimeManagerSwitch active={activeManager} />
        </div>
        <div className={styles.actions}>
          <ProjectPathBar compact />
          <Button icon={<SettingOutlined />} onClick={() => navigate('/environment')}>
            工具链
          </Button>
        </div>
      </div>

      <Alert
        className={styles.detectBanner}
        type={detectedManagers.length > 0 ? 'success' : 'info'}
        showIcon
        title={detectedManagers.length > 0 ? '已识别当前项目依赖类型' : '请选择生态工作台'}
        description={
          <Space wrap>
            {detectedManagers.length > 0 ? (
              detectedManagers.map((managerId) => (
                <Button
                  key={managerId}
                  size="small"
                  type={managerId === activeManager ? 'primary' : 'default'}
                  onClick={() => openManager(managerId)}
                >
                  {managerId}
                </Button>
              ))
            ) : (
              <span>未检测到已支持的清单文件，仍可直接进入下方生态工作台。</span>
            )}
          </Space>
        }
      />

      <div className={styles.panel}>
        <div className={styles.managerGrid}>
          {managers.map((manager) => {
            const managerId = manager.id as PackageManagerId
            const detected = detectedManagers.includes(managerId)

            return (
              <button
                key={manager.id}
                className={`${styles.managerButton} ${detected ? styles.detectedManager : ''}`}
                onClick={() => openManager(managerId)}
              >
                <span className={styles.managerTitleRow}>
                  <span className={styles.managerTitle}>{manager.shortName}</span>
                  <ArrowRightOutlined />
                </span>
                <span className={styles.managerDescription}>{manager.name}</span>
                <span className={styles.managerTags}>
                  <Tag color={detected ? 'green' : 'default'}>{detected ? '已检测' : manager.status}</Tag>
                  {manager.manifestFiles.slice(0, 2).map((file) => <Tag key={file}>{file}</Tag>)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MultiManagerPage
