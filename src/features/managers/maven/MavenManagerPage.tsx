import React, { useEffect, useMemo, useState } from 'react'
import { Alert, AutoComplete, Button, Collapse, Descriptions, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Spin, Switch, Table, Tag, Tooltip } from 'antd'
import {
  ApartmentOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  SecurityScanOutlined,
  SwapOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ProjectPathBar from '../../../components/ProjectPathBar/ProjectPathBar'
import RuntimeManagerSwitch from '../../../components/ManagerSwitch/RuntimeManagerSwitch'
import { DependencyHealthModal } from '../../../components/Package/DependencyHealthModal'
import { DependencyTreeViewer } from '../../../components/Package/DependencyTreeViewer'
import { useDependencyHealthReminder } from '../../../hooks/useDependencyHealthReminder'
import { getManagerDefinition } from '../../../domain/managers/registry'
import { useAppStore } from '../../../stores/appStore'
import styles from './MavenManagerPage.module.css'

const COMMON_MAVEN_GOALS = ['clean', 'compile', 'test', 'package', 'install', 'clean package', 'dependency:tree']
const MAVEN_REPOSITORY_OPTIONS = [
  { value: 'https://repo.maven.apache.org/maven2', label: 'Maven Central' },
  { value: 'https://maven.aliyun.com/repository/public', label: '阿里云公共仓库' },
  { value: 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/', label: '腾讯云公共仓库' },
  { value: 'https://s01.oss.sonatype.org/service/local/staging/deploy/maven2/', label: 'Sonatype OSSRH Release' },
  { value: 'https://s01.oss.sonatype.org/content/repositories/snapshots/', label: 'Sonatype OSSRH Snapshot' },
  { value: 'https://packages.aliyun.com/maven/repository', label: '阿里云 Packages' },
  { value: 'https://maven.pkg.github.com/owner/repository', label: 'GitHub Packages' }
]

type MavenMirrorPreset = 'central' | 'aliyun' | 'tencent' | 'custom'

function toMavenSearchOptions(deps: MavenSearchResult[], field: 'groupId' | 'artifactId') {
  return deps.map((dep) => {
    const version = dep.latestVersion || dep.version
    const source = dep.description ? ` · ${dep.description}` : ''
    return {
      value: field === 'groupId' ? dep.groupId : dep.artifactId,
      label: `${dep.groupId}:${dep.artifactId}${version ? ` (${version})` : ''}${source}`,
      dep
    }
  })
}

const MavenManagerPage: React.FC = () => {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const manager = getManagerDefinition('maven')

  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [mavenDeps, setMavenDeps] = useState<MavenDependencyInfo[]>([])
  const [mavenLatestMap, setMavenLatestMap] = useState<Record<string, string>>({})
  const [mavenInfo, setMavenInfo] = useState<MavenGlobalInfo | null>(null)
  const [mavenLoading, setMavenLoading] = useState(false)

  const [mavenAddVisible, setMavenAddVisible] = useState(false)
  const [goalVisible, setGoalVisible] = useState(false)
  const [goalOutputVisible, setGoalOutputVisible] = useState(false)
  const [goalOutput, setGoalOutput] = useState('')
  const [mavenAuditVisible, setMavenAuditVisible] = useState(false)
  const [mavenAuditIssues, setMavenAuditIssues] = useState<MavenAuditIssue[]>([])
  const [mavenTreeVisible, setMavenTreeVisible] = useState(false)
  const [mavenTree, setMavenTree] = useState<MavenDependencyTreeNode | null>(null)
  const [mavenHealthVisible, setMavenHealthVisible] = useState(false)
  const [mavenVersionVisible, setMavenVersionVisible] = useState(false)
  const [mavenSelectedDep, setMavenSelectedDep] = useState<MavenDependencyInfo | null>(null)
  const [mavenPublishVisible, setMavenPublishVisible] = useState(false)
  const [mavenMirrorVisible, setMavenMirrorVisible] = useState(false)
  const [mavenServerVisible, setMavenServerVisible] = useState(false)
  const [mavenSearchResults, setMavenSearchResults] = useState<MavenSearchResult[]>([])
  const [mavenVersionOptions, setMavenVersionOptions] = useState<Array<{ value: string; label: string }>>([])
  const [mavenMirror, setMavenMirror] = useState<MavenMirrorPreset>('central')
  const [customMavenGoals, setCustomMavenGoals] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('custom-maven-goals') || '[]')
    } catch {
      return []
    }
  })
  const [customGoal, setCustomGoal] = useState('')
  const [draggedGoal, setDraggedGoal] = useState<string | null>(null)

  const [mavenForm] = Form.useForm()
  const [goalForm] = Form.useForm()
  const [mavenPublishForm] = Form.useForm()
  const [mavenMirrorForm] = Form.useForm()
  const [mavenServerForm] = Form.useForm()

  const mavenGoalButtons = useMemo(() => {
    return [...customMavenGoals, ...COMMON_MAVEN_GOALS.filter((goal) => !customMavenGoals.includes(goal))]
  }, [customMavenGoals])

  const mavenGroupOptions = useMemo(() => toMavenSearchOptions(mavenSearchResults, 'groupId'), [mavenSearchResults])
  const mavenArtifactOptions = useMemo(() => toMavenSearchOptions(mavenSearchResults, 'artifactId'), [mavenSearchResults])
  const detected = useMemo(() => {
    return Boolean(
      projectInfo?.hasPomXml ||
      projectInfo?.detectedManagers?.some((item) => item.id === 'maven' && item.detected)
    )
  }, [projectInfo])
  const outdatedCount = useMemo(() => {
    return mavenDeps.filter((dep) => {
      const latest = mavenLatestMap[`${dep.groupId}:${dep.artifactId}`]
      return latest && latest !== dep.version
    }).length
  }, [mavenDeps, mavenLatestMap])

  useDependencyHealthReminder('maven', currentPath, Boolean(currentPath && mavenDeps.length > 0))

  useEffect(() => {
    localStorage.setItem('custom-maven-goals', JSON.stringify(customMavenGoals))
  }, [customMavenGoals])

  useEffect(() => {
    void loadProjectInfo()
    void loadMavenDependencies()
    void loadMavenInfo()
  }, [currentPath])

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

  const loadMavenDependencies = async () => {
    if (!currentPath) {
      setMavenDeps([])
      setMavenLatestMap({})
      return
    }

    setMavenLoading(true)
    try {
      const detectedProject = await window.electronAPI.maven.detect(currentPath)
      if (!detectedProject.hasPom) {
        setMavenDeps([])
        setMavenLatestMap({})
        return
      }

      const deps = await window.electronAPI.maven.list(currentPath)
      setMavenDeps(deps)
      const latestEntries = await Promise.all(
        deps.slice(0, 20).map(async (dep) => {
          try {
            const versions = await window.electronAPI.maven.versions(dep.groupId, dep.artifactId)
            return [`${dep.groupId}:${dep.artifactId}`, versions[0] || dep.version] as const
          } catch {
            return [`${dep.groupId}:${dep.artifactId}`, dep.version] as const
          }
        })
      )
      setMavenLatestMap(Object.fromEntries(latestEntries))
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '读取 Maven 依赖失败',
        description: error.message
      })
    } finally {
      setMavenLoading(false)
    }
  }

  const loadMavenInfo = async () => {
    try {
      const info = await window.electronAPI.maven.info(currentPath)
      setMavenInfo(info)
    } catch {
      setMavenInfo(null)
    }
  }

  const openMavenSettings = async () => {
    try {
      const settingsPath = await window.electronAPI.maven.ensureSettings()
      await window.electronAPI.system.openFile(settingsPath)
      await loadMavenInfo()
    } catch (error: any) {
      addNotification({ type: 'error', message: '打开 Maven settings.xml 失败', description: error.message })
    }
  }

  const setMavenLocalRepository = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return

    setMavenLoading(true)
    try {
      await window.electronAPI.maven.setLocalRepository(path)
      await loadMavenInfo()
      addNotification({ type: 'success', message: 'Maven 本地仓库已更新', description: path })
    } catch (error: any) {
      addNotification({ type: 'error', message: '设置 Maven 本地仓库失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const showEffectiveSettings = async () => {
    setMavenLoading(true)
    setGoalOutputVisible(true)
    setGoalOutput('正在生成 effective settings...')
    try {
      const output = await window.electronAPI.maven.effectiveSettings(currentPath)
      setGoalOutput(output)
    } catch (error: any) {
      setGoalOutput(error.message)
      addNotification({ type: 'error', message: '生成 effective settings 失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const goMavenOffline = async () => {
    if (!currentPath) return
    setMavenLoading(true)
    setGoalOutputVisible(true)
    setGoalOutput('正在预拉取依赖...')
    try {
      const output = await window.electronAPI.maven.goOffline(currentPath)
      setGoalOutput(output)
      addNotification({ type: 'success', message: 'Maven 离线依赖准备完成' })
    } catch (error: any) {
      setGoalOutput(error.message)
      addNotification({ type: 'error', message: 'Maven 离线依赖准备失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const purgeMavenLocalRepository = async () => {
    if (!currentPath) return
    setMavenLoading(true)
    setGoalOutputVisible(true)
    setGoalOutput('正在清理当前项目依赖的本地仓库缓存...')
    try {
      const output = await window.electronAPI.maven.purgeLocalRepository(currentPath)
      setGoalOutput(output)
      addNotification({ type: 'success', message: 'Maven 本地仓库缓存已清理' })
    } catch (error: any) {
      setGoalOutput(error.message)
      addNotification({ type: 'error', message: '清理 Maven 本地仓库缓存失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const runMavenSecurityAudit = async () => {
    if (!currentPath) return
    setMavenLoading(true)
    try {
      const result = await window.electronAPI.maven.securityAudit(currentPath)
      setMavenAuditIssues(result.issues)
      setMavenAuditVisible(true)
      if (result.error) {
        addNotification({ type: 'warning', message: 'Maven 安全审计完成但有警告', description: result.error })
      }
    } catch (error: any) {
      addNotification({ type: 'error', message: 'Maven 安全审计失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const showMavenTree = async () => {
    if (!currentPath) return
    setMavenLoading(true)
    try {
      const tree = await window.electronAPI.maven.dependencyTree(currentPath)
      setMavenTree(tree)
      setMavenTreeVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: '生成 Maven 依赖树失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const applyMavenMirror = async (preset: MavenMirrorPreset) => {
    if (preset === 'custom') {
      mavenMirrorForm.setFieldsValue({
        id: 'custom-central',
        url: 'https://repo.maven.apache.org/maven2',
        mirrorOf: 'central'
      })
      setMavenMirrorVisible(true)
      return
    }

    const presets = {
      central: { id: 'central-default', url: 'https://repo.maven.apache.org/maven2', mirrorOf: 'central' },
      aliyun: { id: 'aliyun-central', url: 'https://maven.aliyun.com/repository/public', mirrorOf: 'central' },
      tencent: { id: 'tencent-central', url: 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public/', mirrorOf: 'central' }
    }
    const target = presets[preset]
    setMavenLoading(true)
    try {
      await window.electronAPI.maven.setMirror(target.id, target.url, target.mirrorOf)
      await loadMavenInfo()
      addNotification({ type: 'success', message: 'Maven 镜像已设置', description: target.url })
    } catch (error: any) {
      addNotification({ type: 'error', message: '设置 Maven 镜像失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const saveCustomMavenMirror = async (values: { id: string; url: string; mirrorOf?: string }) => {
    setMavenLoading(true)
    try {
      await window.electronAPI.maven.setMirror(values.id, values.url, values.mirrorOf || 'central')
      setMavenMirror('custom')
      setMavenMirrorVisible(false)
      mavenMirrorForm.resetFields()
      await loadMavenInfo()
      addNotification({ type: 'success', message: 'Maven 自定义镜像已保存', description: values.url })
    } catch (error: any) {
      addNotification({ type: 'error', message: '保存 Maven 自定义镜像失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const saveMavenServer = async (values: { id: string; username: string; password: string }) => {
    setMavenLoading(true)
    try {
      await window.electronAPI.maven.setSecureServer(values.id, values.username, values.password)
      setMavenServerVisible(false)
      mavenServerForm.resetFields()
      addNotification({ type: 'success', message: 'Maven 远程仓库凭据已保存到保险箱' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '保存 Maven 远程仓库凭据失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const publishMavenPackage = async (values: { repositoryId?: string; repositoryUrl?: string; skipTests?: boolean | string; goals?: string; overrideReadinessGate?: boolean }) => {
    if (!currentPath) return
    setMavenLoading(true)
    try {
      const output = await window.electronAPI.maven.deploy({
        cwd: currentPath,
        repositoryId: values.repositoryId,
        repositoryUrl: values.repositoryUrl,
        skipTests: values.skipTests === true || values.skipTests === 'true',
        goals: values.goals,
        overrideReadinessGate: values.overrideReadinessGate === true
      })
      setGoalOutput(output)
      setGoalOutputVisible(true)
      setMavenPublishVisible(false)
      mavenPublishForm.resetFields()
      addNotification({ type: 'success', message: 'Maven 发布完成' })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'Maven 发布失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const searchMavenDependencies = async (query: string, scope: MavenSearchScope = 'artifactId') => {
    if (!query.trim()) {
      setMavenSearchResults([])
      return
    }
    try {
      const results = await window.electronAPI.maven.search(query, currentPath, {
        mode: 'startsWith',
        scope,
        source: 'mavenCentral',
        includeLocal: false
      })
      setMavenSearchResults(results)
    } catch {
      setMavenSearchResults([])
    }
  }

  const loadMavenVersions = async () => {
    const groupId = mavenForm.getFieldValue('groupId')
    const artifactId = mavenForm.getFieldValue('artifactId')
    if (!groupId || !artifactId) return
    setMavenLoading(true)
    try {
      const versions = await window.electronAPI.maven.versions(groupId, artifactId)
      setMavenVersionOptions(versions.map((version) => ({ value: version, label: version })))
      if (versions.length > 0) {
        mavenForm.setFieldValue('version', versions[0])
      }
    } catch (error: any) {
      addNotification({ type: 'error', message: '获取 Maven 版本失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const showMavenVersions = async (dep: MavenDependencyInfo) => {
    setMavenSelectedDep(dep)
    setMavenLoading(true)
    try {
      const versions = await window.electronAPI.maven.versions(dep.groupId, dep.artifactId)
      setMavenVersionOptions(versions.map((version) => ({ value: version, label: version })))
      setMavenVersionVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: '获取 Maven 版本失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const installMavenVersion = async (version: string) => {
    if (!mavenSelectedDep || !currentPath) return
    setMavenLoading(true)
    try {
      await window.electronAPI.maven.addDependency(currentPath, {
        ...mavenSelectedDep,
        version
      })
      setMavenVersionVisible(false)
      await loadMavenDependencies()
      addNotification({ type: 'success', message: 'Maven 版本切换成功', description: `${mavenSelectedDep.artifactId}:${version}` })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'Maven 版本切换失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const backupMavenSettings = async () => {
    setMavenLoading(true)
    try {
      const backupPath = await window.electronAPI.maven.backupSettings()
      addNotification({ type: 'success', message: 'Maven settings.xml 已备份', description: backupPath })
    } catch (error: any) {
      addNotification({ type: 'error', message: '备份 Maven settings.xml 失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const executeMavenGoalText = async (goal: string) => {
    await runMavenGoal({ goal })
  }

  const addCustomMavenGoal = () => {
    const value = customGoal.trim()
    if (!value) return
    setCustomMavenGoals((prev) => [value, ...prev.filter((item) => item !== value)])
    setCustomGoal('')
  }

  const moveCustomGoal = (targetGoal: string) => {
    if (!draggedGoal || draggedGoal === targetGoal) return
    setCustomMavenGoals((prev) => {
      const withoutDragged = prev.filter((goal) => goal !== draggedGoal)
      const targetIndex = withoutDragged.indexOf(targetGoal)
      if (targetIndex < 0) return prev
      return [
        ...withoutDragged.slice(0, targetIndex),
        draggedGoal,
        ...withoutDragged.slice(targetIndex)
      ]
    })
    setDraggedGoal(null)
  }

  const addMavenDependency = async (values: MavenDependencyInfo) => {
    if (!currentPath) return
    setMavenLoading(true)
    try {
      await window.electronAPI.maven.addDependency(currentPath, values)
      setMavenAddVisible(false)
      mavenForm.resetFields()
      await loadMavenDependencies()
      addNotification({ type: 'success', message: 'Maven 依赖已添加' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '添加 Maven 依赖失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const removeMavenDependency = async (dep: MavenDependencyInfo) => {
    if (!currentPath) return
    setMavenLoading(true)
    try {
      await window.electronAPI.maven.removeDependency(currentPath, {
        groupId: dep.groupId,
        artifactId: dep.artifactId
      })
      await loadMavenDependencies()
      addNotification({ type: 'success', message: 'Maven 依赖已移除' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '移除 Maven 依赖失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const runMavenGoal = async (values: { goal: string }) => {
    if (!currentPath) return
    setMavenLoading(true)
    setGoalOutputVisible(true)
    setGoalOutput('正在执行...')
    try {
      const output = await window.electronAPI.maven.runGoal(currentPath, values.goal)
      setGoalOutput(output)
      setGoalVisible(false)
      await loadMavenDependencies()
      addNotification({ type: 'success', message: `mvn ${values.goal} 执行完成` })
    } catch (error: any) {
      setGoalOutput(error.message)
      addNotification({ type: 'error', message: 'Maven 命令执行失败', description: error.message })
    } finally {
      setMavenLoading(false)
    }
  }

  const columns = [
    {
      title: 'Group',
      dataIndex: 'groupId',
      key: 'groupId',
      width: 260
    },
    {
      title: 'Artifact',
      dataIndex: 'artifactId',
      key: 'artifactId',
      width: 220
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 150,
      render: (text: string) => text ? <Tag>{text}</Tag> : <Tag color="orange">继承/变量</Tag>
    },
    {
      title: '最新',
      key: 'latest',
      width: 150,
      render: (_: unknown, record: MavenDependencyInfo) => {
        const latest = mavenLatestMap[`${record.groupId}:${record.artifactId}`]
        if (!latest) return '-'
        return (
          <Tag color={latest !== record.version ? 'blue' : 'green'}>
            {latest}
          </Tag>
        )
      }
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      width: 120,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: MavenDependencyInfo) => (
        <Space>
          <Tooltip title="切换版本">
            <Button size="small" icon={<SwapOutlined />} onClick={() => showMavenVersions(record)} />
          </Tooltip>
          <Popconfirm title={`移除 ${record.artifactId}?`} onConfirm={() => removeMavenDependency(record)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Java / Maven 管理</h2>
          <div className={styles.subtitle}>pom.xml 依赖、生命周期 Goal、settings.xml、仓库镜像、发布和安全审计。</div>
        </div>
        <div className={styles.actions}>
          <RuntimeManagerSwitch active="maven" />
          <ProjectPathBar compact />
          <Button icon={<SettingOutlined />} onClick={() => navigate('/environment')}>
            工具链
          </Button>
        </div>
      </div>

      <Alert
        type={detected ? 'success' : 'info'}
        showIcon
        title={detected ? '当前项目已识别为 Java / Maven 生态' : '当前项目未检测到 pom.xml'}
        description={
          <Space wrap>
            {(manager?.manifestFiles || []).map((file) => <Tag key={file}>{file}</Tag>)}
            {(manager?.lockFiles || []).map((file) => <Tag key={file} color="blue">{file}</Tag>)}
            {(manager?.productionTools || []).slice(0, 6).map((tool) => <Tag key={tool} color="green">{tool}</Tag>)}
          </Space>
        }
      />

      <div className={styles.overview}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>依赖数</span>
          <span className={styles.metricValue}>{mavenDeps.length}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>可升级</span>
          <span className={styles.metricValue}>{outdatedCount}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>本地仓库</span>
          <span className={styles.metricValue}>{mavenInfo?.localRepository || '未检测到'}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>变更保护</span>
          <span className={styles.metricValue}>IPC 自动快照</span>
        </div>
      </div>

      <div className={styles.workspace}>
        <main className={styles.surface}>
          <Descriptions size="small" column={1} bordered className={styles.infoPanel}>
            <Descriptions.Item label="Maven">
              <span className={styles.multiLineValue}>{mavenInfo?.version?.split(/\r?\n/)[0] || '未检测到'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="本地仓库">
              <Space>
                <span className={styles.pathValue}>{mavenInfo?.localRepository || '-'}</span>
                {mavenInfo?.localRepository && (
                  <Button size="small" icon={<FolderOpenOutlined />} onClick={() => window.electronAPI.system.openPath(mavenInfo.localRepository)}>
                    打开
                  </Button>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="settings.xml">
              <Space>
                <span className={styles.pathValue}>{mavenInfo?.settingsPath || '-'}</span>
                <Tag color={mavenInfo?.hasSettings ? 'green' : 'orange'}>{mavenInfo?.hasSettings ? '已存在' : '未创建'}</Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>

          <div className={styles.toolbar}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setMavenAddVisible(true)} disabled={!currentPath}>
              添加依赖
            </Button>
            <Button icon={<ApartmentOutlined />} onClick={showMavenTree} disabled={!currentPath}>
              依赖树
            </Button>
            <Button icon={<SecurityScanOutlined />} onClick={runMavenSecurityAudit} disabled={!currentPath}>
              安全审计
            </Button>
            <Button icon={<WarningOutlined />} onClick={() => setMavenHealthVisible(true)} disabled={!currentPath}>
              依赖诊断
            </Button>
            <Button icon={<CodeOutlined />} onClick={() => setGoalVisible(true)} disabled={!currentPath}>
              执行 Goal
            </Button>
            <Button icon={<CloudUploadOutlined />} onClick={() => setMavenPublishVisible(true)} disabled={!currentPath}>
              发布/Deploy
            </Button>
            <Button icon={<DownloadOutlined />} onClick={goMavenOffline} disabled={!currentPath}>
              离线依赖
            </Button>
            <Button icon={<DeleteOutlined />} onClick={purgeMavenLocalRepository} disabled={!currentPath}>
              清理项目缓存
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadMavenDependencies} loading={mavenLoading} disabled={!currentPath}>
              刷新
            </Button>
          </div>

          <Spin spinning={mavenLoading}>
            {mavenDeps.length === 0 ? (
              <Empty description="未检测到 pom.xml，或当前 Maven 项目暂无依赖" />
            ) : (
              <Table
                dataSource={mavenDeps}
                columns={columns}
                rowKey={(record) => `${record.groupId}:${record.artifactId}:${record.version || ''}:${record.scope || ''}`}
                size="small"
                pagination={{ pageSize: 20 }}
                scroll={{ x: 900 }}
              />
            )}
          </Spin>
        </main>

        <aside className={styles.sideStack}>
          <section className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <Space>
                <SettingOutlined />
                <span>Maven 设置</span>
              </Space>
              <Button size="small" onClick={backupMavenSettings}>备份 settings.xml</Button>
            </div>
            <Collapse
              size="small"
              ghost
              items={[
                {
                  key: 'mirror',
                  label: '镜像源',
                  children: (
                    <Segmented
                      value={mavenMirror}
                      onChange={(value) => {
                        const next = value as MavenMirrorPreset
                        setMavenMirror(next)
                        void applyMavenMirror(next)
                      }}
                      options={[
                        { label: 'Central', value: 'central' },
                        { label: '阿里云', value: 'aliyun' },
                        { label: '腾讯云', value: 'tencent' },
                        { label: '自定义', value: 'custom' }
                      ]}
                    />
                  )
                },
                {
                  key: 'settings',
                  label: 'settings.xml',
                  children: (
                    <Space wrap>
                      <Button size="small" icon={<SettingOutlined />} onClick={() => setMavenServerVisible(true)}>仓库凭据</Button>
                      <Button size="small" icon={<SettingOutlined />} onClick={openMavenSettings}>打开设置</Button>
                      <Button size="small" icon={<FolderOpenOutlined />} onClick={setMavenLocalRepository}>本地仓库</Button>
                      <Button size="small" icon={<CodeOutlined />} onClick={showEffectiveSettings}>Effective</Button>
                    </Space>
                  )
                }
              ]}
            />
          </section>

          <section className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <Space>
                <CodeOutlined />
                <span>Maven Goals</span>
              </Space>
              <Space.Compact>
                <Input size="small" value={customGoal} onChange={(event) => setCustomGoal(event.target.value)} placeholder="自定义 goal" className={styles.goalInput} />
                <Button size="small" onClick={addCustomMavenGoal}>添加</Button>
              </Space.Compact>
            </div>
            <div className={styles.scriptButtons}>
              {mavenGoalButtons.map((goal) => (
                <Button
                  key={goal}
                  draggable={customMavenGoals.includes(goal)}
                  onDragStart={() => setDraggedGoal(goal)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveCustomGoal(goal)}
                  size="small"
                  type={customMavenGoals.includes(goal) ? 'primary' : 'default'}
                  onClick={() => executeMavenGoalText(goal)}
                  disabled={!currentPath}
                >
                  {goal}
                </Button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <Modal
        title="添加 Maven 依赖"
        open={mavenAddVisible}
        onCancel={() => setMavenAddVisible(false)}
        onOk={() => mavenForm.submit()}
        okText="添加"
        cancelText="取消"
        forceRender
      >
        <Form form={mavenForm} layout="vertical" onFinish={addMavenDependency}>
          <Form.Item name="groupId" label="groupId" rules={[{ required: true, message: '请输入 groupId' }]}>
            <AutoComplete
              options={mavenGroupOptions}
              onSearch={(query) => searchMavenDependencies(query, 'groupId')}
              onSelect={(_, option) => {
                const dep = (option as any).dep as MavenSearchResult
                mavenForm.setFieldsValue({
                  groupId: dep.groupId,
                  artifactId: dep.artifactId,
                  version: dep.latestVersion || dep.version
                })
                setMavenVersionOptions(dep.latestVersion ? [{ value: dep.latestVersion, label: dep.latestVersion }] : [])
              }}
              placeholder="输入 groupId，自动提示本地仓库与 Maven Central"
            />
          </Form.Item>
          <Form.Item name="artifactId" label="artifactId" rules={[{ required: true, message: '请输入 artifactId' }]}>
            <AutoComplete
              options={mavenArtifactOptions}
              onSearch={(query) => searchMavenDependencies(query, 'artifactId')}
              onSelect={(_, option) => {
                const dep = (option as any).dep as MavenSearchResult
                mavenForm.setFieldsValue({
                  groupId: dep.groupId,
                  artifactId: dep.artifactId,
                  version: dep.latestVersion || dep.version
                })
                setMavenVersionOptions(dep.latestVersion ? [{ value: dep.latestVersion, label: dep.latestVersion }] : [])
              }}
              placeholder="输入 artifactId 或关键字搜索"
            />
          </Form.Item>
          <Form.Item label="version" required>
            <Space.Compact className={styles.fullWidth}>
              <Form.Item name="version" noStyle rules={[{ required: true, message: '请输入 version' }]}>
                <AutoComplete
                  options={mavenVersionOptions}
                  placeholder="选择最近 10 个版本或手动输入"
                  className={styles.fullWidth}
                />
              </Form.Item>
              <Button onClick={loadMavenVersions}>获取版本</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="scope" label="scope">
            <Select allowClear placeholder="默认 compile">
              <Select.Option value="compile">compile</Select.Option>
              <Select.Option value="provided">provided</Select.Option>
              <Select.Option value="runtime">runtime</Select.Option>
              <Select.Option value="test">test</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="执行 Maven Goal"
        open={goalVisible}
        onCancel={() => setGoalVisible(false)}
        onOk={() => goalForm.submit()}
        okText="执行"
        cancelText="取消"
        forceRender
      >
        <Form form={goalForm} layout="vertical" onFinish={runMavenGoal} initialValues={{ goal: 'test' }}>
          <Form.Item name="goal" label="Goal" rules={[{ required: true, message: '请输入 Maven goal' }]}>
            <Select showSearch options={COMMON_MAVEN_GOALS.map((goal) => ({ label: goal, value: goal }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`切换 Maven 版本 - ${mavenSelectedDep?.artifactId || ''}`}
        open={mavenVersionVisible}
        onCancel={() => setMavenVersionVisible(false)}
        footer={null}
        width={560}
      >
        <Space direction="vertical" className={styles.fullWidth}>
          <span>当前版本: <Tag color="blue">{mavenSelectedDep?.version || '继承/变量'}</Tag></span>
          <div className={styles.versions}>
            {mavenVersionOptions.length === 0 ? (
              <Empty description="未找到版本信息" />
            ) : (
              mavenVersionOptions.slice(0, 50).map((item) => (
                <Tag
                  key={item.value}
                  className={styles.versionTag}
                  color={item.value === mavenSelectedDep?.version ? 'blue' : 'default'}
                  onClick={() => installMavenVersion(item.value)}
                >
                  {item.value}
                </Tag>
              ))
            )}
          </div>
        </Space>
      </Modal>

      <Modal
        title="自定义 Maven 镜像"
        open={mavenMirrorVisible}
        onCancel={() => setMavenMirrorVisible(false)}
        onOk={() => mavenMirrorForm.submit()}
        okText="保存"
        cancelText="取消"
        forceRender
      >
        <Form form={mavenMirrorForm} layout="vertical" onFinish={saveCustomMavenMirror}>
          <Form.Item name="id" label="Mirror ID" rules={[{ required: true, message: '请输入 mirror id' }]}>
            <Input placeholder="例如: company-central" />
          </Form.Item>
          <Form.Item name="url" label="镜像 URL" rules={[{ required: true, message: '请输入镜像 URL' }]}>
            <AutoComplete options={MAVEN_REPOSITORY_OPTIONS} placeholder="例如: https://repo.maven.apache.org/maven2" />
          </Form.Item>
          <Form.Item name="mirrorOf" label="Mirror Of">
            <AutoComplete
              options={[
                { value: 'central', label: 'central' },
                { value: '*', label: '*' },
                { value: 'external:*', label: 'external:*' }
              ]}
              placeholder="默认 central"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Maven 远程仓库凭据"
        open={mavenServerVisible}
        onCancel={() => setMavenServerVisible(false)}
        onOk={() => mavenServerForm.submit()}
        okText="保存"
        cancelText="取消"
        forceRender
      >
        <Form form={mavenServerForm} layout="vertical" onFinish={saveMavenServer}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="密码会保存到系统凭据保险箱，settings.xml 仅写入 env 占位符。"
          />
          <Form.Item name="id" label="Server ID" rules={[{ required: true, message: '请输入 server id' }]}>
            <AutoComplete
              options={[
                { value: 'releases', label: 'releases' },
                { value: 'snapshots', label: 'snapshots' },
                { value: 'github', label: 'github' },
                { value: 'ossrh', label: 'ossrh' }
              ]}
              placeholder="需与 pom.xml distributionManagement 或 deploy 配置一致"
            />
          </Form.Item>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="仓库用户名或 token 用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码 / Token" rules={[{ required: true, message: '请输入密码或 token' }]}>
            <Input.Password placeholder="远程仓库密码或 token" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发布 Maven 包"
        open={mavenPublishVisible}
        onCancel={() => setMavenPublishVisible(false)}
        onOk={() => mavenPublishForm.submit()}
        okText="发布"
        cancelText="取消"
      >
        <Form
          form={mavenPublishForm}
          layout="vertical"
          onFinish={publishMavenPackage}
          initialValues={{ goals: 'deploy', skipTests: 'true', repositoryId: 'releases', overrideReadinessGate: false }}
        >
          <Form.Item name="goals" label="发布 Goal">
            <AutoComplete
              options={[
                { value: 'deploy', label: 'deploy' },
                { value: 'clean deploy', label: 'clean deploy' },
                { value: 'deploy -Prelease', label: 'deploy -Prelease' }
              ]}
              placeholder="默认 deploy"
            />
          </Form.Item>
          <Form.Item name="repositoryId" label="远程仓库 ID">
            <AutoComplete
              options={[
                { value: 'releases', label: 'releases' },
                { value: 'snapshots', label: 'snapshots' },
                { value: 'github', label: 'github' },
                { value: 'ossrh', label: 'ossrh' }
              ]}
              placeholder="与 settings.xml server id 一致"
            />
          </Form.Item>
          <Form.Item name="repositoryUrl" label="远程仓库 URL">
            <AutoComplete options={MAVEN_REPOSITORY_OPTIONS} placeholder="留空则使用 pom.xml distributionManagement" />
          </Form.Item>
          <Form.Item name="skipTests" label="跳过测试">
            <Select
              options={[
                { value: 'true', label: '是，追加 -DskipTests' },
                { value: 'false', label: '否' }
              ]}
            />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            message="Production readiness gate runs before Maven deploy"
            description="Blocked readiness checks stop deployment unless an approved override is enabled."
            style={{ marginBottom: 12 }}
          />
          <Form.Item name="overrideReadinessGate" valuePropName="checked">
            <Switch checkedChildren="Override gate" unCheckedChildren="Gate enforced" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="命令输出"
        open={goalOutputVisible}
        onCancel={() => setGoalOutputVisible(false)}
        footer={null}
        width={800}
      >
        <pre className={styles.output}>{goalOutput}</pre>
      </Modal>

      <DependencyTreeViewer
        title="Maven 依赖树"
        visible={mavenTreeVisible}
        data={mavenTree}
        onClose={() => setMavenTreeVisible(false)}
      />

      <DependencyHealthModal
        visible={mavenHealthVisible}
        manager="maven"
        cwd={currentPath}
        onClose={() => setMavenHealthVisible(false)}
      />

      <Modal
        title="Maven 安全审计"
        open={mavenAuditVisible}
        onCancel={() => setMavenAuditVisible(false)}
        footer={null}
        width={980}
      >
        {mavenAuditIssues.length === 0 ? (
          <Empty description="未发现安全问题，或 OWASP dependency-check 未返回报告" />
        ) : (
          <Table
            dataSource={mavenAuditIssues}
            rowKey={(record, index) => `${record.dependency}:${record.name}:${index}`}
            size="small"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: '依赖', dataIndex: 'dependency', key: 'dependency', width: 220, ellipsis: true },
              { title: '严重程度', dataIndex: 'severity', key: 'severity', width: 110, render: (text: string) => <Tag color={text === 'CRITICAL' || text === 'HIGH' ? 'red' : 'orange'}>{text}</Tag> },
              { title: '漏洞', dataIndex: 'name', key: 'name', width: 160 },
              { title: '问题说明', dataIndex: 'description', key: 'description', ellipsis: true },
              { title: '操作', key: 'action', width: 100, render: (_: unknown, record: MavenAuditIssue) => record.url ? <Button size="small" type="link" onClick={() => window.electronAPI.openExternal(record.url!)}>详情</Button> : null }
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

export default MavenManagerPage
