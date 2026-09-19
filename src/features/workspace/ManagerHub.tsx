import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Space, Tag, Typography } from 'antd'
import { CloudUploadOutlined, ExperimentOutlined, SearchOutlined, SafetyCertificateOutlined, ToolOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import ProjectPathBar from '../../components/ProjectPathBar/ProjectPathBar'
import { useT } from '../../i18n'
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
  const t = useT()
  const currentPath = useAppStore((state) => state.currentPath)
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
    // A slow detect() reply for the previous path must not label the current
    // workspace with another project's detected ecosystems.
    let active = true
    void (async () => {
      if (!currentPath) {
        setProjectInfo(null)
        return
      }

      try {
        const info = await window.electronAPI.project.detect(currentPath)
        if (active) setProjectInfo(info)
      } catch {
        if (active) setProjectInfo(null)
      }
    })()
    return () => { active = false }
  }, [currentPath])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>{t('workspace.title')}</Title>
        <Paragraph className={styles.subtitle}>{t('workspace.subtitle')}</Paragraph>
        <Space wrap>
          <ProjectPathBar />
          <Button icon={<ToolOutlined />} onClick={() => navigate('/environment')}>{t('layout.environmentToolchains')}</Button>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/health')}>{t('layout.healthSecurity')}</Button>
        </Space>
      </div>

      <Alert
        type={detectedIds.size > 0 ? 'success' : 'info'}
        showIcon
        title={detectedIds.size > 0 ? t('workspace.detectedEcosystems') : t('workspace.awaitingDirectory')}
        description={
          detectedIds.size > 0
            ? [...detectedIds].map((id) => {
                const manager = projectInfo?.detectedManagers.find((item) => item.id === id)
                return manager ? `${manager.name}: ${manager.files.join(', ')}` : id
              }).join(t('common.listSeparator'))
            : t('workspace.detectionHint')
        }
      />

      <section>
        <div className={styles.sectionHeader}>
          <Title level={4}>{t('workspace.unifiedWorkspaces')}</Title>
          <Text type="secondary">{workspaceGroups.length} {t('workspace.unifiedWorkspacesHint')}</Text>
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
                      <Text type="secondary">{group.managerIds.length} {t('workspace.managerCount')}</Text>
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
                    {detectedCount > 0 && <Tag color="processing">{detectedCount} {t('workspace.detectedCount')}</Tag>}
                  </Space>
                  <Button type={detectedCount > 0 ? 'primary' : 'default'} onClick={() => navigate(group.route)}>
                    {t('workspace.enter')} {group.shortLabel}
                  </Button>
                </Space>
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <div className={styles.sectionHeader}>
          <Title level={4}>{t('workspace.managedManagers')}</Title>
          <Text type="secondary">{implementedManagers.length} {t('workspace.managedManagersHint')}</Text>
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
                  <Tag color={managerColor(manager.id)}>{implementationStatusText(manager.status, t)}</Tag>
                  {detectedIds.has(manager.id) && <Tag color="success">{t('workspace.inProject')}</Tag>}
                  <Tag>{formatManagerFiles(manager.manifestFiles)}</Tag>
                </Space>
                <div className={styles.toolList}>
                  {manager.productionTools.slice(0, 3).map((tool) => (
                    <Tag key={tool}>{tool}</Tag>
                  ))}
                </div>
                <Button type="primary" onClick={() => navigate(getManagerRoute(manager.id))}>
                  {t('workspace.enter')} {manager.shortName}
                </Button>
              </Space>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className={styles.sectionHeader}>
          <Title level={4}>{t('workspace.roadmap')}</Title>
          <Text type="secondary">{t('workspace.roadmapHint')}</Text>
        </div>
        <div className={styles.roadmap}>
          {plannedManagers.map((manager) => (
            <div key={manager.id} className={styles.roadmapItem}>
              <Space size={8} wrap>
                {managerIcon(manager.id)}
                <Text strong>{manager.shortName}</Text>
                <Tag>{manager.language}</Tag>
                <Tag>{formatManagerFiles(manager.lockFiles.length ? manager.lockFiles : manager.manifestFiles)}</Tag>
                {detectedIds.has(manager.id) && <Tag color="processing">{t('workspace.detectedTag')}</Tag>}
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
        <Button icon={<SearchOutlined />} onClick={() => navigate('/search')}>{t('workspace.search')}</Button>
        <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/health')}>{t('workspace.healthCenter')}</Button>
        <Button icon={<ExperimentOutlined />} onClick={() => navigate('/extended')}>{t('workspace.extendedEcosystems')}</Button>
        <Button icon={<CloudUploadOutlined />} onClick={() => navigate('/publish')}>{t('workspace.publishManagement')}</Button>
      </div>
    </div>
  )
}

export default ManagerHub
