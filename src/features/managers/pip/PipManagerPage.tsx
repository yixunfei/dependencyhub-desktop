import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AutoComplete, Button, Collapse, Descriptions, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Spin, Switch, Table, Tag, Tooltip } from 'antd'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  SecurityScanOutlined,
  SwapOutlined,
  SyncOutlined,
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
import styles from './PipManagerPage.module.css'

const PIP_CONFIG_KEY_OPTIONS = [
  { value: 'global.index-url', label: 'global.index-url（主镜像源）' },
  { value: 'global.extra-index-url', label: 'global.extra-index-url（额外镜像源）' },
  { value: 'global.trusted-host', label: 'global.trusted-host（可信主机）' },
  { value: 'global.cache-dir', label: 'global.cache-dir（缓存目录）' },
  { value: 'global.timeout', label: 'global.timeout（超时秒数）' },
  { value: 'global.proxy', label: 'global.proxy（代理）' }
]

const PIP_CONFIG_VALUE_OPTIONS = [
  { value: 'https://pypi.org/simple', label: 'PyPI 官方' },
  { value: 'https://pypi.tuna.tsinghua.edu.cn/simple', label: '清华 PyPI' },
  { value: 'https://mirrors.aliyun.com/pypi/simple', label: '阿里云 PyPI' },
  { value: 'pypi.org', label: 'pypi.org' },
  { value: 'pypi.tuna.tsinghua.edu.cn', label: 'pypi.tuna.tsinghua.edu.cn' },
  { value: 'mirrors.aliyun.com', label: 'mirrors.aliyun.com' }
]

const PIP_REPOSITORY_OPTIONS = [
  { value: 'https://upload.pypi.org/legacy/', label: 'PyPI 官方' },
  { value: 'https://test.pypi.org/legacy/', label: 'Test PyPI' }
]

type PipScope = 'environment' | 'user'
type PipMirrorPreset = 'official' | 'tsinghua' | 'aliyun' | 'custom'
type PipPackageRow = PipPackageInfo & { latest?: string; outdated: boolean }

function normalizePackageKey(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-')
}

const PipManagerPage: React.FC = () => {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const manager = getManagerDefinition('pip')

  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [pipPackages, setPipPackages] = useState<PipPackageInfo[]>([])
  const [pipOutdated, setPipOutdated] = useState<Record<string, PipPackageInfo>>({})
  const [pipLoading, setPipLoading] = useState(false)
  const [pipScope, setPipScope] = useState<PipScope>('environment')
  const [pipConfigScope, setPipConfigScope] = useState<PipConfigScope>('user')
  const [pipConfig, setPipConfig] = useState<PipConfigItem[]>([])
  const [pipCacheDir, setPipCacheDir] = useState('')
  const [breakSystemPackages, setBreakSystemPackages] = useState(false)

  const [pipInstallVisible, setPipInstallVisible] = useState(false)
  const [requirementsVisible, setRequirementsVisible] = useState(false)
  const [requirements, setRequirements] = useState<string[]>([])
  const [pipConfigVisible, setPipConfigVisible] = useState(false)
  const [pipMirrorVisible, setPipMirrorVisible] = useState(false)
  const [pipPublishVisible, setPipPublishVisible] = useState(false)
  const [pipDetailVisible, setPipDetailVisible] = useState(false)
  const [pipDetail, setPipDetail] = useState<PipPackageDetail | null>(null)
  const [pipOutputVisible, setPipOutputVisible] = useState(false)
  const [pipOutput, setPipOutput] = useState('')
  const [pipAuditVisible, setPipAuditVisible] = useState(false)
  const [pipAuditIssues, setPipAuditIssues] = useState<PipAuditIssue[]>([])
  const [pipTreeVisible, setPipTreeVisible] = useState(false)
  const [pipTree, setPipTree] = useState<PipDependencyTreeNode[] | null>(null)
  const [pipVersionVisible, setPipVersionVisible] = useState(false)
  const [pipSelectedPackage, setPipSelectedPackage] = useState<PipPackageInfo | null>(null)
  const [pipRepairVisible, setPipRepairVisible] = useState(false)
  const [pipRepairOutput, setPipRepairOutput] = useState('')
  const [pipHealthVisible, setPipHealthVisible] = useState(false)
  const [pipSearchOptions, setPipSearchOptions] = useState<Array<{ value: string; label: string }>>([])
  const [pipVersionOptions, setPipVersionOptions] = useState<Array<{ value: string; label: string }>>([])
  const [pipMirror, setPipMirror] = useState<PipMirrorPreset>('official')
  const [pipCredentials, setPipCredentials] = useState<CredentialMetadata[]>([])

  const [pipForm] = Form.useForm()
  const [pipConfigForm] = Form.useForm()
  const [pipMirrorForm] = Form.useForm()
  const [pipPublishForm] = Form.useForm()
  // Bumped by the load-triggering effects: concurrent loads capture it read-only
  // so a stale reply from a previous currentPath/scope cannot overwrite new data.
  const loadEpochRef = useRef(0)
  const projectInfoEpochRef = useRef(0)
  // Version loads are keyed to the package being requested; a stale reply must
  // not fill another package's version list (or auto-fill its first version
  // into the form, which would install the wrong package/version pair).
  const versionRequestRef = useRef(0)

  const pipRows = useMemo<PipPackageRow[]>(() => {
    return pipPackages.map((pkg) => ({
      ...pkg,
      latest: pipOutdated[normalizePackageKey(pkg.name)]?.latest,
      outdated: Boolean(pipOutdated[normalizePackageKey(pkg.name)])
    }))
  }, [pipPackages, pipOutdated])
  const pipCredentialOptions = useMemo(() => pipCredentials.map((credential) => ({
    value: credential.id,
    label: `${credential.label} ${credential.secretPreview}`
  })), [pipCredentials])

  const detected = useMemo(() => {
    return Boolean(
      projectInfo?.hasRequirementsTxt ||
      projectInfo?.detectedManagers?.some((item) => item.id === 'pip' && item.detected)
    )
  }, [projectInfo])

  const outdatedCount = useMemo(() => pipRows.filter((pkg) => pkg.outdated).length, [pipRows])
  const scopeLabel = pipScope === 'user' ? '用户全局' : '当前环境'

  useDependencyHealthReminder('pip', currentPath, Boolean(currentPath && pipRows.length > 0))

  useEffect(() => {
    projectInfoEpochRef.current += 1
    void loadProjectInfo()
    void loadPipCredentials()
  }, [currentPath])

  const loadPipCredentials = async () => {
    try {
      setPipCredentials(await window.electronAPI.credentials.list({ managerId: 'pip' }))
    } catch {
      setPipCredentials([])
    }
  }

  useEffect(() => {
    loadEpochRef.current += 1
    void loadPipPackages()
    void loadPipTooling()
  }, [currentPath, pipScope, pipConfigScope, breakSystemPackages])

  const loadProjectInfo = async () => {
    if (!currentPath) {
      setProjectInfo(null)
      return
    }
    const epoch = ++projectInfoEpochRef.current

    try {
      const info = await window.electronAPI.project.detect(currentPath)
      if (epoch !== projectInfoEpochRef.current) return
      setProjectInfo(info)
    } catch {
      if (epoch !== projectInfoEpochRef.current) return
      setProjectInfo(null)
    }
  }

  const getPipOptions = (): PipCommandOptions => ({
    cwd: currentPath,
    user: pipScope === 'user',
    breakSystemPackages
  })

  const loadPipPackages = async () => {
    const epoch = loadEpochRef.current
    setPipLoading(true)
    try {
      const options = getPipOptions()
      const [packages, outdated] = await Promise.all([
        window.electronAPI.pip.list(options),
        window.electronAPI.pip.outdated(options)
      ])
      if (epoch !== loadEpochRef.current) return
      setPipPackages(packages)
      setPipOutdated(Object.fromEntries(outdated.map((pkg) => [normalizePackageKey(pkg.name), pkg])))
    } catch (error: any) {
      if (epoch !== loadEpochRef.current) return
      setPipPackages([])
      setPipOutdated({})
      addNotification({
        type: 'error',
        message: '读取 pip 包失败',
        description: error.message
      })
    } finally {
      if (epoch === loadEpochRef.current) setPipLoading(false)
    }
  }

  const loadPipTooling = async () => {
    const epoch = loadEpochRef.current
    try {
      const [config, cacheDir] = await Promise.all([
        window.electronAPI.pip.configList(pipConfigScope),
        window.electronAPI.pip.cacheDir()
      ])
      if (epoch !== loadEpochRef.current) return
      setPipConfig(config)
      setPipCacheDir(cacheDir)
    } catch {
      if (epoch !== loadEpochRef.current) return
      setPipConfig([])
      setPipCacheDir('')
    }
  }

  const installPipPackage = async (values: any) => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.install({
        packageName: values.packageName,
        version: values.version,
        cwd: currentPath,
        user: pipScope === 'user',
        upgrade: values.upgrade === true || values.upgrade === 'true',
        indexUrl: values.indexUrl,
        extraIndexUrl: values.extraIndexUrl,
        trustedHost: values.trustedHost,
        breakSystemPackages
      })
      setPipInstallVisible(false)
      pipForm.resetFields()
      await loadPipPackages()
      addNotification({ type: 'success', message: 'pip 包安装成功' })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 包安装失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const updatePipPackage = async (packageName: string) => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.update({ packageName, cwd: currentPath, user: pipScope === 'user', breakSystemPackages })
      await loadPipPackages()
      addNotification({ type: 'success', message: `${packageName} 已升级` })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 包升级失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const uninstallPipPackage = async (packageName: string) => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.uninstall({ packageName, cwd: currentPath, user: pipScope === 'user', breakSystemPackages })
      await loadPipPackages()
      addNotification({ type: 'success', message: `${packageName} 已卸载` })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 包卸载失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const installRequirements = async () => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.install({
        cwd: currentPath,
        requirements: true,
        user: pipScope === 'user',
        breakSystemPackages
      })
      await loadPipPackages()
      addNotification({ type: 'success', message: 'requirements.txt 安装完成' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '安装 requirements.txt 失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const exportRequirements = async () => {
    if (!currentPath) return
    try {
      await window.electronAPI.pip.exportRequirements(currentPath)
      await loadProjectInfo()
      addNotification({ type: 'success', message: '已导出 requirements.txt' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '导出 requirements.txt 失败', description: error.message })
    }
  }

  const showRequirements = async () => {
    if (!currentPath) return
    try {
      const result = await window.electronAPI.pip.readRequirements(currentPath)
      setRequirements(result)
      setRequirementsVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: '读取 requirements.txt 失败', description: error.message })
    }
  }

  const updateAllPipPackages = async () => {
    setPipLoading(true)
    try {
      const result = await window.electronAPI.pip.updateAll(getPipOptions())
      setPipOutput(`成功: ${result.success}\n失败: ${result.failed}\n\n${result.output}`)
      setPipOutputVisible(true)
      await loadPipPackages()
      addNotification({ type: 'success', message: 'pip 批量升级完成', description: `成功: ${result.success}, 失败: ${result.failed}` })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 批量升级失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const showPipDetail = async (packageName: string) => {
    try {
      const detail = await window.electronAPI.pip.show(packageName, currentPath)
      setPipDetail(detail)
      setPipDetailVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: '读取 pip 包详情失败', description: error.message })
    }
  }

  const runPipCheck = async () => {
    setPipLoading(true)
    try {
      const output = await window.electronAPI.pip.check(currentPath)
      setPipOutput(output || '未发现依赖冲突')
      setPipOutputVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip check 执行失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const repairPipCheck = async () => {
    setPipLoading(true)
    try {
      const result = await window.electronAPI.pip.repairCheck(currentPath)
      setPipRepairOutput(result.output)
      setPipRepairVisible(true)
      setPipOutput(result.output)
      setPipOutputVisible(true)
      if (result.success > 0) {
        await loadPipPackages()
      }
      addNotification({
        type: result.failed > 0 ? 'warning' : 'success',
        message: 'pip 依赖自修复完成',
        description: `处理 ${result.actions.length} 项，成功 ${result.success} 项`
      })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 依赖自修复失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const purgePipCache = async () => {
    setPipLoading(true)
    try {
      const output = await window.electronAPI.pip.cachePurge()
      setPipOutput(output)
      setPipOutputVisible(true)
      await loadPipTooling()
      addNotification({ type: 'success', message: 'pip 缓存已清理' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '清理 pip 缓存失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const savePipConfig = async (values: { key: string; value: string }) => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.configSet(pipConfigScope, values.key, values.value)
      setPipConfigVisible(false)
      pipConfigForm.resetFields()
      await loadPipTooling()
      addNotification({ type: 'success', message: 'pip 配置已保存' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '保存 pip 配置失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const unsetPipConfig = async (key: string) => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.configUnset(pipConfigScope, key)
      await loadPipTooling()
      addNotification({ type: 'success', message: 'pip 配置已删除' })
    } catch (error: any) {
      addNotification({ type: 'error', message: '删除 pip 配置失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const runPipAudit = async () => {
    setPipLoading(true)
    try {
      const result = await window.electronAPI.pip.audit(currentPath)
      setPipAuditIssues(result.issues)
      setPipAuditVisible(true)
      if (result.error) {
        addNotification({ type: 'warning', message: 'pip 安全审计工具不可用', description: result.error })
      }
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 安全审计失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const installPipTool = async (tool: 'pip-audit' | 'pipdeptree') => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.installTool(tool, currentPath)
      addNotification({ type: 'success', message: `${tool} 已安装或升级` })
    } catch (error: any) {
      addNotification({ type: 'error', message: `${tool} 安装失败`, description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const showPipTree = async () => {
    setPipLoading(true)
    try {
      const tree = await window.electronAPI.pip.dependencyTree(currentPath)
      setPipTree(tree)
      setPipTreeVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: '生成 pip 依赖树失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const applyPipMirror = async (preset: PipMirrorPreset) => {
    if (preset === 'custom') {
      pipMirrorForm.setFieldsValue({
        indexUrl: 'https://pypi.org/simple',
        trustedHost: 'pypi.org'
      })
      setPipMirrorVisible(true)
      return
    }

    const presets = {
      official: { url: 'https://pypi.org/simple', host: 'pypi.org' },
      tsinghua: { url: 'https://pypi.tuna.tsinghua.edu.cn/simple', host: 'pypi.tuna.tsinghua.edu.cn' },
      aliyun: { url: 'https://mirrors.aliyun.com/pypi/simple', host: 'mirrors.aliyun.com' }
    }
    const target = presets[preset]
    setPipLoading(true)
    try {
      await window.electronAPI.pip.configSet('user', 'global.index-url', target.url)
      await window.electronAPI.pip.configSet('user', 'global.trusted-host', target.host)
      setPipConfigScope('user')
      await loadPipTooling()
      addNotification({ type: 'success', message: 'pip 镜像已设置', description: target.url })
    } catch (error: any) {
      addNotification({ type: 'error', message: '设置 pip 镜像失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const saveCustomPipMirror = async (values: { indexUrl: string; trustedHost?: string }) => {
    setPipLoading(true)
    try {
      await window.electronAPI.pip.configSet('user', 'global.index-url', values.indexUrl)
      if (values.trustedHost) {
        await window.electronAPI.pip.configSet('user', 'global.trusted-host', values.trustedHost)
      }
      setPipMirror('custom')
      setPipMirrorVisible(false)
      pipMirrorForm.resetFields()
      await loadPipTooling()
      addNotification({ type: 'success', message: 'pip 自定义镜像已保存', description: values.indexUrl })
    } catch (error: any) {
      addNotification({ type: 'error', message: '保存 pip 自定义镜像失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const publishPipPackage = async (values: { repositoryUrl?: string; username?: string; password?: string; credentialId?: string; saveCredential?: boolean; buildBefore?: boolean | string; overrideReadinessGate?: boolean }) => {
    setPipLoading(true)
    try {
      let credentialId = values.credentialId
      if (!credentialId && values.password && values.saveCredential) {
        const credential = await window.electronAPI.credentials.save({
          managerId: 'pip',
          service: values.repositoryUrl || 'https://upload.pypi.org/legacy/',
          account: values.username || '__token__',
          label: `PyPI ${values.repositoryUrl || 'upload.pypi.org'}`,
          kind: 'username-password',
          secret: values.password,
          url: values.repositoryUrl
        })
        credentialId = credential.id
        await loadPipCredentials()
      }
      const output = await window.electronAPI.pip.publish({
        cwd: currentPath,
        repositoryUrl: values.repositoryUrl,
        username: values.username,
        password: credentialId ? undefined : values.password,
        credentialId,
        buildBefore: values.buildBefore !== false && values.buildBefore !== 'false',
        overrideReadinessGate: values.overrideReadinessGate === true
      })
      setPipOutput(output)
      setPipOutputVisible(true)
      setPipPublishVisible(false)
      pipPublishForm.resetFields()
      addNotification({ type: 'success', message: 'pip 发布完成' })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 发布失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const setPipCacheDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setPipLoading(true)
    try {
      await window.electronAPI.pip.configSet('user', 'global.cache-dir', path)
      setPipConfigScope('user')
      await loadPipTooling()
      addNotification({ type: 'success', message: 'pip 缓存目录已设置', description: path })
    } catch (error: any) {
      addNotification({ type: 'error', message: '设置 pip 缓存目录失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const searchPipPackages = async (query: string) => {
    if (!query.trim()) {
      setPipSearchOptions([])
      return
    }
    try {
      const results = await window.electronAPI.pip.search(query, currentPath)
      setPipSearchOptions(results.map((item) => ({
        value: item.name,
        label: item.version ? `${item.name} (${item.version})` : item.name
      })))
    } catch {
      setPipSearchOptions([])
    }
  }

  const loadPipVersions = async () => {
    const packageName = pipForm.getFieldValue('packageName')
    if (!packageName) return
    const requestId = ++versionRequestRef.current
    setPipLoading(true)
    try {
      const versions = await window.electronAPI.pip.versions(packageName)
      if (requestId !== versionRequestRef.current || pipForm.getFieldValue('packageName') !== packageName) return
      setPipVersionOptions(versions.map((version) => ({ value: version, label: version })))
      if (versions.length > 0) {
        pipForm.setFieldValue('version', versions[0])
      }
    } catch (error: any) {
      if (requestId !== versionRequestRef.current) return
      addNotification({ type: 'error', message: '获取 pip 版本失败', description: error.message })
    } finally {
      if (requestId === versionRequestRef.current) setPipLoading(false)
    }
  }

  const showPipVersions = async (pkg: PipPackageInfo) => {
    const requestId = ++versionRequestRef.current
    setPipSelectedPackage(pkg)
    setPipLoading(true)
    try {
      const versions = await window.electronAPI.pip.versions(pkg.name)
      if (requestId !== versionRequestRef.current) return
      setPipVersionOptions(versions.map((version) => ({ value: version, label: version })))
      setPipVersionVisible(true)
    } catch (error: any) {
      if (requestId !== versionRequestRef.current) return
      addNotification({ type: 'error', message: '获取 pip 版本失败', description: error.message })
    } finally {
      if (requestId === versionRequestRef.current) setPipLoading(false)
    }
  }

  const installPipVersion = async (version: string) => {
    if (!pipSelectedPackage) return
    setPipLoading(true)
    try {
      await window.electronAPI.pip.install({
        packageName: pipSelectedPackage.name,
        version,
        cwd: currentPath,
        user: pipScope === 'user',
        upgrade: true,
        breakSystemPackages
      })
      setPipVersionVisible(false)
      await loadPipPackages()
      addNotification({ type: 'success', message: 'pip 版本切换成功', description: `${pipSelectedPackage.name}@${version}` })
    } catch (error: any) {
      addNotification({ type: 'error', message: 'pip 版本切换失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const backupPipConfig = async () => {
    setPipLoading(true)
    try {
      const backupPath = await window.electronAPI.pip.backupConfig(pipConfigScope)
      addNotification({ type: 'success', message: 'pip 配置已备份', description: backupPath })
    } catch (error: any) {
      addNotification({ type: 'error', message: '备份 pip 配置失败', description: error.message })
    } finally {
      setPipLoading(false)
    }
  }

  const columns = [
    {
      title: '包名',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (text: string, record: PipPackageRow) => (
        <Space>
          <Button type="link" size="small" className={styles.linkButton} onClick={() => showPipDetail(text)}>
            {text}
          </Button>
          {record.outdated && (
            <Tooltip title="有新版本可用">
              <WarningOutlined className={styles.warningIcon} />
            </Tooltip>
          )}
        </Space>
      )
    },
    {
      title: '当前版本',
      dataIndex: 'version',
      key: 'version',
      width: 140,
      render: (text: string) => <Tag>{text}</Tag>
    },
    {
      title: '最新版本',
      dataIndex: 'latest',
      key: 'latest',
      width: 140,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: unknown, record: PipPackageRow) => (
        <Space>
          <Tooltip title="详情">
            <Button size="small" icon={<CodeOutlined />} onClick={() => showPipDetail(record.name)} />
          </Tooltip>
          <Tooltip title="切换版本">
            <Button size="small" icon={<SwapOutlined />} onClick={() => showPipVersions(record)} />
          </Tooltip>
          <Tooltip title="升级">
            <Button size="small" icon={<SyncOutlined />} onClick={() => updatePipPackage(record.name)} />
          </Tooltip>
          <Popconfirm title={`卸载 ${record.name}?`} onConfirm={() => uninstallPipPackage(record.name)}>
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
          <h2 className={styles.title}>Python / pip 管理</h2>
          <div className={styles.subtitle}>Python 依赖、requirements、PyPI 发布、安全审计和 pip 环境配置。</div>
        </div>
        <div className={styles.actions}>
          <RuntimeManagerSwitch active="pip" />
          <ProjectPathBar compact />
          <Button icon={<SettingOutlined />} onClick={() => navigate('/environment')}>
            工具链
          </Button>
        </div>
      </div>

      <Alert
        type={detected ? 'success' : 'info'}
        showIcon
        title={detected ? '当前项目已识别为 Python / pip 生态' : '当前项目未检测到 requirements.txt'}
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
          <span className={styles.metricLabel}>范围</span>
          <span className={styles.metricValue}>{scopeLabel}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>已安装包</span>
          <span className={styles.metricValue}>{pipRows.length}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>可升级</span>
          <span className={styles.metricValue}>{outdatedCount}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>变更保护</span>
          <span className={styles.metricValue}>IPC 自动快照</span>
        </div>
      </div>

      <div className={styles.workspace}>
        <main className={styles.surface}>
          <div className={styles.scopeRow}>
            <Segmented
              value={pipScope}
              onChange={(value) => setPipScope(value as PipScope)}
              options={[
                { label: '当前环境', value: 'environment' },
                { label: '用户全局', value: 'user' }
              ]}
            />
            <Space wrap className={styles.inlineTools}>
              <span className={styles.metaText}>缓存: {pipCacheDir || '未检测到'}</span>
              <Switch
                size="small"
                checked={breakSystemPackages}
                onChange={setBreakSystemPackages}
              />
              <span className={styles.metaText}>break-system-packages</span>
            </Space>
          </div>

          <div className={styles.toolbar}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPipInstallVisible(true)}>
              安装包
            </Button>
            <Button icon={<SyncOutlined />} onClick={updateAllPipPackages} disabled={pipRows.every((pkg) => !pkg.outdated)}>
              升级全部
            </Button>
            <Button icon={<DownloadOutlined />} onClick={installRequirements} disabled={!currentPath}>
              安装 requirements.txt
            </Button>
            <Button icon={<ExportOutlined />} onClick={exportRequirements} disabled={!currentPath}>
              导出 requirements.txt
            </Button>
            <Button icon={<CloudUploadOutlined />} onClick={() => setPipPublishVisible(true)} disabled={!currentPath}>
              发布到 PyPI
            </Button>
            <Button icon={<CodeOutlined />} onClick={showRequirements} disabled={!currentPath}>
              查看 requirements
            </Button>
            <Button icon={<CheckCircleOutlined />} onClick={runPipCheck}>
              依赖检查
            </Button>
            <Button icon={<CheckCircleOutlined />} onClick={repairPipCheck}>
              自修复依赖
            </Button>
            <Button icon={<SecurityScanOutlined />} onClick={runPipAudit}>
              安全审计
            </Button>
            <Button icon={<ApartmentOutlined />} onClick={showPipTree}>
              依赖树
            </Button>
            <Button icon={<WarningOutlined />} onClick={() => setPipHealthVisible(true)} disabled={!currentPath}>
              依赖诊断
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadPipPackages} loading={pipLoading}>
              刷新
            </Button>
          </div>

          <Spin spinning={pipLoading}>
            {pipRows.length === 0 ? (
              <Empty description="暂无 pip 包，或当前环境未安装 pip" />
            ) : (
              <Table
                dataSource={pipRows}
                columns={columns}
                rowKey="name"
                size="small"
                pagination={{ pageSize: 20 }}
                scroll={{ x: 760 }}
              />
            )}
          </Spin>
        </main>

        <aside className={styles.sideStack}>
          <section className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <Space>
                <SettingOutlined />
                <span>pip 设置</span>
              </Space>
              <Button size="small" onClick={backupPipConfig}>备份配置</Button>
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
                      value={pipMirror}
                      onChange={(value) => {
                        const next = value as PipMirrorPreset
                        setPipMirror(next)
                        void applyPipMirror(next)
                      }}
                      options={[
                        { label: '官方', value: 'official' },
                        { label: '清华', value: 'tsinghua' },
                        { label: '阿里云', value: 'aliyun' },
                        { label: '自定义', value: 'custom' }
                      ]}
                    />
                  )
                },
                {
                  key: 'paths',
                  label: '存储与工具',
                  children: (
                    <Space wrap>
                      <Button size="small" icon={<FolderOpenOutlined />} onClick={setPipCacheDirectory}>缓存目录</Button>
                      <Button size="small" icon={<SecurityScanOutlined />} onClick={() => installPipTool('pip-audit')}>pip-audit</Button>
                      <Button size="small" icon={<ApartmentOutlined />} onClick={() => installPipTool('pipdeptree')}>pipdeptree</Button>
                      <Button size="small" icon={<DeleteOutlined />} onClick={purgePipCache}>清理缓存</Button>
                    </Space>
                  )
                }
              ]}
            />
          </section>

          <section className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <Space>
                <SettingOutlined />
                <span>pip 配置</span>
                <Select
                  size="small"
                  value={pipConfigScope}
                  onChange={setPipConfigScope}
                  className={styles.scopeSelect}
                  options={[
                    { label: '用户', value: 'user' },
                    { label: '全局', value: 'global' },
                    { label: '站点', value: 'site' }
                  ]}
                />
              </Space>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setPipConfigVisible(true)}>
                添加
              </Button>
            </div>
            <Table
              dataSource={pipConfig}
              columns={[
                { title: '配置项', dataIndex: 'key', key: 'key', width: 210, ellipsis: true },
                { title: '值', dataIndex: 'value', key: 'value', ellipsis: true },
                {
                  title: '',
                  key: 'action',
                  width: 54,
                  render: (_: unknown, record: PipConfigItem) => (
                    <Popconfirm title={`删除 ${record.key}?`} onConfirm={() => unsetPipConfig(record.key)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )
                }
              ]}
              rowKey="key"
              size="small"
              pagination={false}
              scroll={{ x: 460, y: 360 }}
            />
          </section>
        </aside>
      </div>

      <Modal
        title="安装 pip 包"
        open={pipInstallVisible}
        onCancel={() => setPipInstallVisible(false)}
        onOk={() => pipForm.submit()}
        okText="安装"
        cancelText="取消"
        forceRender
      >
        <Form form={pipForm} layout="vertical" onFinish={installPipPackage} initialValues={{ upgrade: 'false' }}>
          <Form.Item name="packageName" label="包名" rules={[{ required: true, message: '请输入包名' }]}>
            <AutoComplete
              options={pipSearchOptions}
              onSearch={searchPipPackages}
              onSelect={(value) => pipForm.setFieldValue('packageName', value)}
              placeholder="例如: requests"
            />
          </Form.Item>
          <Form.Item label="版本（可选）">
            <Space.Compact className={styles.fullWidth}>
              <Form.Item name="version" noStyle>
                <AutoComplete
                  options={pipVersionOptions}
                  placeholder="默认 latest，或选择指定版本"
                  className={styles.fullWidth}
                />
              </Form.Item>
              <Button onClick={loadPipVersions}>获取版本</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="upgrade" label="安装时升级">
            <Select
              options={[
                { label: '否', value: 'false' },
                { label: '是', value: 'true' }
              ]}
            />
          </Form.Item>
          <Form.Item name="indexUrl" label="Index URL（可选）">
            <Input placeholder="例如: https://pypi.org/simple" />
          </Form.Item>
          <Form.Item name="extraIndexUrl" label="Extra Index URL（可选）">
            <Input placeholder="额外索引地址" />
          </Form.Item>
          <Form.Item name="trustedHost" label="Trusted Host（可选）">
            <Input placeholder="例如: pypi.org" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="requirements.txt"
        open={requirementsVisible}
        onCancel={() => setRequirementsVisible(false)}
        footer={null}
      >
        <div className={styles.requirements}>
          {requirements.length === 0 ? (
            <Empty description="未找到 requirements.txt 或文件为空" />
          ) : (
            requirements.map((item) => <Tag key={item} className={styles.requirementTag}>{item}</Tag>)
          )}
        </div>
      </Modal>

      <Modal
        title="添加 pip 配置"
        open={pipConfigVisible}
        onCancel={() => setPipConfigVisible(false)}
        onOk={() => pipConfigForm.submit()}
        okText="保存"
        cancelText="取消"
        forceRender
      >
        <Form form={pipConfigForm} layout="vertical" onFinish={savePipConfig}>
          <Form.Item name="key" label="配置项" rules={[{ required: true, message: '请输入配置项' }]}>
            <AutoComplete options={PIP_CONFIG_KEY_OPTIONS} placeholder="选择常用配置项或输入自定义 key" />
          </Form.Item>
          <Form.Item name="value" label="值" rules={[{ required: true, message: '请输入配置值' }]}>
            <AutoComplete options={PIP_CONFIG_VALUE_OPTIONS} placeholder="选择默认场景值或输入自定义值" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="自定义 pip 镜像源"
        open={pipMirrorVisible}
        onCancel={() => setPipMirrorVisible(false)}
        onOk={() => pipMirrorForm.submit()}
        okText="保存"
        cancelText="取消"
        forceRender
      >
        <Form form={pipMirrorForm} layout="vertical" onFinish={saveCustomPipMirror}>
          <Form.Item name="indexUrl" label="Index URL" rules={[{ required: true, message: '请输入镜像源地址' }]}>
            <AutoComplete options={PIP_CONFIG_VALUE_OPTIONS} placeholder="例如: https://pypi.org/simple" />
          </Form.Item>
          <Form.Item name="trustedHost" label="Trusted Host">
            <AutoComplete options={PIP_CONFIG_VALUE_OPTIONS} placeholder="例如: pypi.org" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发布 Python 包"
        open={pipPublishVisible}
        onCancel={() => setPipPublishVisible(false)}
        onOk={() => pipPublishForm.submit()}
        okText="发布"
        cancelText="取消"
      >
        <Form
          form={pipPublishForm}
          layout="vertical"
          onFinish={publishPipPackage}
          initialValues={{ repositoryUrl: 'https://upload.pypi.org/legacy/', buildBefore: 'true', overrideReadinessGate: false }}
        >
          <Form.Item name="repositoryUrl" label="远程仓库">
            <AutoComplete options={PIP_REPOSITORY_OPTIONS} placeholder="PyPI/TestPyPI 或自定义 repository-url" />
          </Form.Item>
          <Form.Item name="credentialId" label="凭据保险箱">
            <Select
              allowClear
              options={pipCredentialOptions}
              placeholder="选择已保存的 PyPI token"
              onDropdownVisibleChange={(open) => {
                if (open) void loadPipCredentials()
              }}
            />
          </Form.Item>
          <Form.Item name="username" label="用户名">
            <Input placeholder="__token__ 或仓库用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码 / Token">
            <Input.Password placeholder="PyPI token 或仓库密码" />
          </Form.Item>
          <Form.Item name="saveCredential" valuePropName="checked">
            <Switch checkedChildren="保存到保险箱" unCheckedChildren="不保存" />
          </Form.Item>
          <Form.Item name="buildBefore" label="发布前构建">
            <Select
              options={[
                { value: 'true', label: '是，先执行 python -m build' },
                { value: 'false', label: '否，使用现有 dist 产物' }
              ]}
            />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            message="Production readiness gate runs before upload"
            description="Blocked readiness checks stop PyPI upload unless an approved override is enabled."
            style={{ marginBottom: 12 }}
          />
          <Form.Item name="overrideReadinessGate" valuePropName="checked">
            <Switch checkedChildren="Override gate" unCheckedChildren="Gate enforced" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="pip 包详情"
        open={pipDetailVisible}
        onCancel={() => setPipDetailVisible(false)}
        footer={null}
        width={700}
      >
        {pipDetail ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="名称">{pipDetail.name}</Descriptions.Item>
            <Descriptions.Item label="版本">{pipDetail.version}</Descriptions.Item>
            <Descriptions.Item label="摘要">{pipDetail.summary || '-'}</Descriptions.Item>
            <Descriptions.Item label="主页">{pipDetail.homePage || '-'}</Descriptions.Item>
            <Descriptions.Item label="作者">{pipDetail.author || '-'}</Descriptions.Item>
            <Descriptions.Item label="许可证">{pipDetail.license || '-'}</Descriptions.Item>
            <Descriptions.Item label="位置">{pipDetail.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="依赖">{pipDetail.requires || '-'}</Descriptions.Item>
            <Descriptions.Item label="被依赖">{pipDetail.requiredBy || '-'}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="未找到包详情" />
        )}
      </Modal>

      <Modal
        title={`切换 pip 版本 - ${pipSelectedPackage?.name || ''}`}
        open={pipVersionVisible}
        onCancel={() => setPipVersionVisible(false)}
        footer={null}
        width={560}
      >
        <Space direction="vertical" className={styles.fullWidth}>
          <span>当前版本: <Tag color="blue">{pipSelectedPackage?.version || '-'}</Tag></span>
          <div className={styles.versions}>
            {pipVersionOptions.length === 0 ? (
              <Empty description="未找到版本信息" />
            ) : (
              pipVersionOptions.slice(0, 50).map((item) => (
                <Tag
                  key={item.value}
                  className={styles.versionTag}
                  color={item.value === pipSelectedPackage?.version ? 'blue' : 'default'}
                  onClick={() => installPipVersion(item.value)}
                >
                  {item.value}
                </Tag>
              ))
            )}
          </div>
        </Space>
      </Modal>

      <Modal
        title="pip 输出"
        open={pipOutputVisible}
        onCancel={() => setPipOutputVisible(false)}
        footer={null}
        width={800}
      >
        <pre className={styles.output}>{pipOutput}</pre>
      </Modal>

      <Modal
        title="pip 依赖自修复结果"
        open={pipRepairVisible}
        onCancel={() => setPipRepairVisible(false)}
        footer={null}
        width={800}
      >
        <pre className={styles.output}>{pipRepairOutput}</pre>
      </Modal>

      <Modal
        title="pip 安全审计"
        open={pipAuditVisible}
        onCancel={() => setPipAuditVisible(false)}
        footer={null}
        width={900}
      >
        {pipAuditIssues.length === 0 ? (
          <Empty description="未发现安全问题，或 pip-audit 尚未安装" />
        ) : (
          <Table
            dataSource={pipAuditIssues}
            rowKey={(record) => `${record.name}:${record.id}`}
            size="small"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: '包名', dataIndex: 'name', key: 'name', width: 160 },
              { title: '版本', dataIndex: 'version', key: 'version', width: 110 },
              { title: '漏洞编号', dataIndex: 'id', key: 'id', width: 150, render: (text: string) => <Tag color="red">{text}</Tag> },
              { title: '问题说明', dataIndex: 'description', key: 'description', ellipsis: true },
              { title: '修复版本', dataIndex: 'fixVersions', key: 'fixVersions', width: 180, render: (items: string[]) => items?.length ? items.map((item) => <Tag key={item} color="green">{item}</Tag>) : '-' }
            ]}
          />
        )}
      </Modal>

      <DependencyTreeViewer
        title="pip 依赖树"
        visible={pipTreeVisible}
        data={pipTree}
        onClose={() => setPipTreeVisible(false)}
      />

      <DependencyHealthModal
        visible={pipHealthVisible}
        manager="pip"
        cwd={currentPath}
        onClose={() => setPipHealthVisible(false)}
      />
    </div>
  )
}

export default PipManagerPage
