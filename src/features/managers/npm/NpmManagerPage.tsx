import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Space, Tag } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ProjectPathBar from '../../../components/ProjectPathBar/ProjectPathBar'
import RuntimeManagerSwitch from '../../../components/ManagerSwitch/RuntimeManagerSwitch'
import ProjectPage from './scopes/project/Project'
import GlobalPage from './scopes/global/Global'
import PublishPage from './scopes/publish/Publish'
import { useAppStore } from '../../../stores/appStore'
import { getManagerDefinition } from '../../../domain/managers/registry'
import { NPM_WORKSPACE_SCOPES, type NpmWorkspaceScope } from '../../../domain/managers/workspaces'
import styles from './NpmManagerPage.module.css'

export type NpmManagerScope = NpmWorkspaceScope

interface NpmManagerPageProps {
  initialScope?: NpmManagerScope
}

const SCOPE_ITEMS = NPM_WORKSPACE_SCOPES

const NpmManagerPage: React.FC<NpmManagerPageProps> = ({ initialScope = 'project' }) => {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const [scope, setScope] = useState<NpmManagerScope>(initialScope)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const manager = getManagerDefinition('npm')

  useEffect(() => {
    setScope(initialScope)
  }, [initialScope])

  useEffect(() => {
    void loadProjectInfo()
  }, [currentPath])

  const detected = useMemo(() => {
    return Boolean(projectInfo?.detectedManagers?.some((item) => item.id === 'npm' && item.detected))
  }, [projectInfo])

  const scopeContent = useMemo(() => {
    if (scope === 'global') return <GlobalPage />
    if (scope === 'publish') return <PublishPage />
    return <ProjectPage hideToolchainPanel hideProjectSelector />
  }, [scope])

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

  const switchScope = (nextScope: NpmManagerScope) => {
    setScope(nextScope)
    navigate(SCOPE_ITEMS.find((item) => item.key === nextScope)?.path || '/npm')
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>npm / Node.js 管理</h2>
          <div className={styles.subtitle}>
            将原本分散的项目依赖、全局包和发布能力收敛到同一个 Node.js 生态工作台，避免“全局 npm”和其他语言管理入口混在同一层级。
          </div>
        </div>
        <div className={styles.actions}>
          <RuntimeManagerSwitch active="npm" />
          <ProjectPathBar compact />
          <Button icon={<SettingOutlined />} onClick={() => navigate('/environment')}>
            工具链
          </Button>
        </div>
      </div>

      <Alert
        type={detected ? 'success' : 'info'}
        showIcon
        title={detected ? '当前项目已识别为 npm / Node.js 生态' : '当前项目未识别到 package.json'}
        description={
          <Space wrap>
            <span>{manager?.productionTools.join(' / ')}</span>
            {projectInfo?.packageManager && projectInfo.packageManager !== 'unknown' && (
              <Tag color="blue">{projectInfo.packageManager}</Tag>
            )}
          </Space>
        }
      />

      <div className={styles.overview}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Manifest</span>
          <span className={styles.metricValue}>{projectInfo?.hasPackageJson ? 'package.json' : '未检测到'}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>当前范围</span>
          <span className={styles.metricValue}>{SCOPE_ITEMS.find((item) => item.key === scope)?.title}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>生产能力</span>
          <span className={styles.metricValue}>{manager?.capabilities.length || 0}</span>
        </div>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          {SCOPE_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`${styles.scopeButton} ${scope === item.key ? styles.active : ''}`}
              onClick={() => switchScope(item.key)}
            >
              <span className={styles.scopeTitle}>{item.title}</span>
              <span className={styles.scopeDescription}>{item.description}</span>
            </button>
          ))}
        </aside>
        <main className={styles.content}>
          {scopeContent}
        </main>
      </div>
    </div>
  )
}

export default NpmManagerPage
