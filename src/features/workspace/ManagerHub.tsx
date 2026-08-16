import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Space, Tag, Typography } from 'antd'
import { CloudUploadOutlined, ExperimentOutlined, FolderOpenOutlined, SearchOutlined, SafetyCertificateOutlined, ToolOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import {
  formatManagerFiles,
  getImplementedManagerDefinitions,
  getManagerDefinition,
  getManagerRoute,
  getPlannedManagerDefinitions
} from '../../domain/managers/registry'
import { implementationStatusText, managerColor, managerIcon } from '../../domain/managers/presentation'
import { MANAGER_WORKSPACE_GROUPS } from '../../domain/managers/workspaces'
import styles from './ManagerHub.module.css'

const { Paragraph, Text, Title } = Typography

const ManagerHub: React.FC = () => {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)

  const workspaceGroups = useMemo(() => MANAGER_WORKSPACE_GROUPS, [])
  const implementedManagers = useMemo(() => getImplementedManagerDefinitions(), [])
  const plannedManagers = useMemo(() => getPlannedManagerDefinitions(), [])
  const detectedIds = useMemo(() => {
    return new Set(
      projectInfo?.detectedManagers
        .filter((manager) => manager.detected)
        .map((manager) => manager.id) || []
    )
  }, [projectInfo])

  useEffect(() => {
    void loadProjectInfo()
  }, [currentPath])

  const chooseDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setCurrentPath(path)
    addNotification({
      type: 'info',
      message: '工作目录已切换',
      description: path
    })
  }

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>一站式项目依赖工作区</Title>
        <Paragraph className={styles.subtitle}>
          统一管理项目依赖、语言工具链、仓库镜像、发布流程、健康诊断和后续插件化生态。
        </Paragraph>
        <Space wrap>
          <span className={styles.pathLabel}>当前目录</span>
          <Text className={styles.pathValue}>{currentPath || '未选择'}</Text>
          <Button icon={<FolderOpenOutlined />} onClick={chooseDirectory}>选择目录</Button>
          <Button icon={<ToolOutlined />} onClick={() => navigate('/environment')}>环境与工具链</Button>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/health')}>健康与安全</Button>
        </Space>
      </div>

      <Alert
        type={detectedIds.size > 0 ? 'success' : 'info'}
        showIcon
        title={detectedIds.size > 0 ? '已根据当前目录识别依赖生态' : '选择项目目录后会自动识别依赖生态'}
        description={
          detectedIds.size > 0
            ? [...detectedIds].map((id) => {
                const manager = projectInfo?.detectedManagers.find((item) => item.id === id)
                return manager ? `${manager.name}: ${manager.files.join(', ')}` : id
              }).join('；')
            : '支持从 package.json、requirements.txt、pom.xml、Cargo.toml、build.gradle、go.mod、pubspec.yaml、CMake/vcpkg/Conan 等清单识别项目。'
        }
      />

      <section>
        <div className={styles.sectionHeader}>
          <Title level={4}>Unified workspaces</Title>
          <Text type="secondary">{workspaceGroups.length} grouped entry points from the shared manager map</Text>
        </div>
        <div className={styles.workspaceGrid}>
          {workspaceGroups.map((group) => {
            const detectedCount = group.managerIds.filter((id) => detectedIds.has(id)).length
            return (
              <Card key={group.key} className={styles.workspaceCard} variant="borderless">
                <Space orientation="vertical" size={10} className={styles.cardBody}>
                  <div className={styles.cardTitleRow}>
                    <span className={styles.workspaceIcon}>{managerIcon(group.iconManagerId)}</span>
                    <div>
                      <Title level={5} className={styles.cardTitle}>{group.label}</Title>
                      <Text type="secondary">{group.managerIds.length} managers</Text>
                    </div>
                  </div>
                  <Paragraph className={styles.workspaceDescription}>{group.description}</Paragraph>
                  <Space size={6} wrap>
                    {group.managerIds.slice(0, 5).map((id) => {
                      const status = getManagerDefinition(id)?.status
                      return (
                        <Tag key={id} color={detectedIds.has(id) ? 'success' : status === 'preview' ? 'processing' : undefined}>
                          {id}{status === 'preview' ? ' · preview' : ''}
                        </Tag>
                      )
                    })}
                    {group.managerIds.length > 5 && <Tag>+{group.managerIds.length - 5}</Tag>}
                    {detectedCount > 0 && <Tag color="processing">{detectedCount} detected</Tag>}
                  </Space>
                  <Button type={detectedCount > 0 ? 'primary' : 'default'} onClick={() => navigate(group.route)}>
                    Open {group.shortLabel}
                  </Button>
                </Space>
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <div className={styles.sectionHeader}>
          <Title level={4}>已接入管理器</Title>
          <Text type="secondary">{implementedManagers.length} 个生态可直接管理</Text>
        </div>
        <div className={styles.grid}>
          {implementedManagers.map((manager) => (
            <Card key={manager.id} className={styles.card} variant="borderless">
              <Space orientation="vertical" size={12} className={styles.cardBody}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.icon}>{managerIcon(manager.id)}</span>
                  <div>
                    <Title level={4} className={styles.cardTitle}>{manager.shortName}</Title>
                    <Text type="secondary">{manager.language}</Text>
                  </div>
                </div>
                <Paragraph className={styles.cardText}>
                  {manager.scenarios.slice(0, 3).join(' / ')}
                </Paragraph>
                <Space size={6} wrap>
                  <Tag color={managerColor(manager.id)}>{implementationStatusText(manager.status)}</Tag>
                  {detectedIds.has(manager.id) && <Tag color="success">当前项目</Tag>}
                  <Tag>{formatManagerFiles(manager.manifestFiles)}</Tag>
                </Space>
                <div className={styles.toolList}>
                  {manager.productionTools.slice(0, 3).map((tool) => (
                    <Tag key={tool}>{tool}</Tag>
                  ))}
                </div>
                <Button type="primary" onClick={() => navigate(getManagerRoute(manager.id))}>
                  进入 {manager.shortName}
                </Button>
              </Space>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className={styles.sectionHeader}>
          <Title level={4}>扩展路线</Title>
          <Text type="secondary">这些生态已进入统一 registry，可逐步补齐 adapter 与页面能力</Text>
        </div>
        <div className={styles.roadmap}>
          {plannedManagers.map((manager) => (
            <div key={manager.id} className={styles.roadmapItem}>
              <Space size={8} wrap>
                {managerIcon(manager.id)}
                <Text strong>{manager.shortName}</Text>
                <Tag>{manager.language}</Tag>
                <Tag>{formatManagerFiles(manager.lockFiles.length ? manager.lockFiles : manager.manifestFiles)}</Tag>
                {detectedIds.has(manager.id) && <Tag color="processing">已识别</Tag>}
              </Space>
              <Text type="secondary">{manager.productionTools.slice(0, 2).join(' / ')}</Text>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.footerLinks}>
        {workspaceGroups.map((group) => (
          <Button key={group.key} icon={managerIcon(group.iconManagerId)} onClick={() => navigate(group.route)}>
            {group.shortLabel}
          </Button>
        ))}
        <Button icon={<SearchOutlined />} onClick={() => navigate('/search')}>跨生态搜索</Button>
        <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/health')}>健康与安全中心</Button>
        <Button icon={<ExperimentOutlined />} onClick={() => navigate('/extended')}>扩展生态管理</Button>
        <Button icon={<CloudUploadOutlined />} onClick={() => navigate('/publish')}>npm 发布管理</Button>
      </div>
    </div>
  )
}

export default ManagerHub
