import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AutoComplete, Button, Checkbox, Descriptions, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, Table, Tabs, Tag, Tooltip } from 'antd'
import {
  BranchesOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  DeleteOutlined,
  ExportOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useAppStore } from '../../../stores/appStore'
import RuntimeManagerSwitch from '../../../components/ManagerSwitch/RuntimeManagerSwitch'
import { DependencyHealthModal } from '../../../components/Package/DependencyHealthModal'
import { DependencyTreeViewer, TreeLikeNode } from '../../../components/Package/DependencyTreeViewer'
import { useDependencyHealthReminder } from '../../../hooks/useDependencyHealthReminder'
import { useT, type LabelTranslator } from '../../../i18n'
import styles from './Flutter.module.css'

const DEPENDENCY_TYPE_OPTIONS: Array<{ value: FlutterDependencyType; label: string }> = [
  { value: 'dependencies', label: 'dependencies' },
  { value: 'dev_dependencies', label: 'dev_dependencies' },
  { value: 'dependency_overrides', label: 'dependency_overrides' }
]

const SOURCE_OPTIONS: Array<{ value: FlutterDependencySource; label: string }> = [
  { value: 'hosted', label: 'pub.dev / hosted' },
  { value: 'sdk', label: 'Flutter SDK' },
  { value: 'path', label: 'Local path' },
  { value: 'git', label: 'Git' }
]

const FLUTTER_COMMAND_OPTIONS = [
  { value: 'pub get', label: 'flutter pub get' },
  { value: 'pub upgrade', label: 'flutter pub upgrade' },
  { value: 'pub upgrade --major-versions', label: 'flutter pub upgrade --major-versions' },
  { value: 'pub outdated', label: 'flutter pub outdated' },
  { value: 'pub deps', label: 'flutter pub deps' },
  { value: 'analyze', label: 'flutter analyze' },
  { value: 'test', label: 'flutter test' },
  { value: 'build apk', label: 'flutter build apk' },
  { value: 'build web', label: 'flutter build web' }
]

const dependencyTypeColor: Record<FlutterDependencyType, string> = {
  dependencies: 'cyan',
  dev_dependencies: 'geekblue',
  dependency_overrides: 'volcano'
}

const sourceColor: Record<FlutterDependencySource, string> = {
  hosted: 'green',
  sdk: 'blue',
  path: 'purple',
  git: 'gold'
}

const securitySeverityColor: Record<FlutterSecurityIssue['severity'], string> = {
  critical: 'magenta',
  high: 'red',
  medium: 'orange',
  low: 'gold',
  info: 'blue',
  unknown: 'default'
}

function outdatedPackagesByName(result: FlutterOutdatedResult): Record<string, FlutterOutdatedPackage> {
  if (!result.packages) return {}
  if (Array.isArray(result.packages)) {
    return Object.fromEntries(result.packages.map((item) => [item.package || item.name || '', item]).filter(([name]) => name))
  }
  return result.packages
}

function versionFromOutdated(value: FlutterOutdatedVersion | string | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.version || ''
}

function dependencySourceText(record: FlutterDependencyInfo): string {
  if (record.source === 'sdk') return `sdk:${record.sdk || 'flutter'}`
  if (record.source === 'path') return record.path || 'path'
  if (record.source === 'git') return record.git || 'git'
  return 'pub.dev'
}

function toPubspecRelativePath(basePath: string, targetPath: string): string {
  const base = normalizePath(basePath).replace(/\/$/, '')
  const target = normalizePath(targetPath).replace(/\/$/, '')
  const baseRoot = base.match(/^[A-Za-z]:/)?.[0]?.toLowerCase()
  const targetRoot = target.match(/^[A-Za-z]:/)?.[0]?.toLowerCase()

  if (baseRoot && targetRoot && baseRoot !== targetRoot) return target
  if (!base || !target) return target

  const baseParts = stripDrive(base).split('/').filter(Boolean)
  const targetParts = stripDrive(target).split('/').filter(Boolean)
  let common = 0
  while (common < baseParts.length && common < targetParts.length && baseParts[common].toLowerCase() === targetParts[common].toLowerCase()) {
    common += 1
  }

  const up = Array.from({ length: baseParts.length - common }, () => '..')
  const down = targetParts.slice(common)
  const relative = [...up, ...down].join('/')
  return relative || '.'
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function stripDrive(path: string): string {
  return path.replace(/^[A-Za-z]:/, '')
}

/**
 * Builds the security-audit notification. Kept outside the component because
 * FlutterPage is already at its size budget, and this is the one notification whose
 * message and description both branch.
 */
function securityNotification(
  result: FlutterSecurityAuditResult,
  t: LabelTranslator
): { type: 'warning' | 'success'; message: string; description: string } {
  const issues = result.issues.length
  return {
    type: issues > 0 ? 'warning' : 'success',
    message: issues > 0 ? t('flutter.securityRisksFound') : t('flutter.noSecurityRisks'),
    description:
      issues > 0
        ? t('flutter.vulnerableDependencies', { count: result.vulnerableCount })
        : t('flutter.checkedDependencies', { count: result.dependencyCount })
  }
}

const FlutterPage: React.FC = () => {
  const t = useT()
  const currentPath = useAppStore((state) => state.currentPath)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const addNotification = useAppStore((state) => state.addNotification)

  const [projectInfo, setProjectInfo] = useState<FlutterPubspecInfo | null>(null)
  const [dependencies, setDependencies] = useState<FlutterDependencyInfo[]>([])
  const [assets, setAssets] = useState<FlutterAssetInfo[]>([])
  const [outdatedMap, setOutdatedMap] = useState<Record<string, FlutterOutdatedPackage>>({})
  const [loading, setLoading] = useState(false)
  const [dependencyVisible, setDependencyVisible] = useState(false)
  const [assetVisible, setAssetVisible] = useState(false)
  const [commandVisible, setCommandVisible] = useState(false)
  const [outputVisible, setOutputVisible] = useState(false)
  const [versionVisible, setVersionVisible] = useState(false)
  const [publishVisible, setPublishVisible] = useState(false)
  const [healthVisible, setHealthVisible] = useState(false)
  const [treeVisible, setTreeVisible] = useState(false)
  const [securityVisible, setSecurityVisible] = useState(false)
  const [outputTitle, setOutputTitle] = useState('')
  const [output, setOutput] = useState('')
  const [dependencyTree, setDependencyTree] = useState<FlutterDependencyTreeNode | null>(null)
  const [securityAudit, setSecurityAudit] = useState<FlutterSecurityAuditResult | null>(null)
  const [selectedDependency, setSelectedDependency] = useState<FlutterDependencyInfo | null>(null)
  const [searchOptions, setSearchOptions] = useState<Array<{ value: string; label: string; item?: FlutterSearchResult }>>([])
  const [versionOptions, setVersionOptions] = useState<Array<{ value: string; label: string }>>([])
  const [dependencyForm] = Form.useForm()
  const [assetForm] = Form.useForm()
  const [commandForm] = Form.useForm()
  const [publishForm] = Form.useForm()
  // Monotonic epoch so a stale list() reply from a previous currentPath cannot
  // overwrite the freshly loaded project data.
  const loadEpochRef = useRef(0)
  // Version loads are keyed to the package currently in the form; a stale
  // reply for a replaced package must not fill the version select.
  const versionRequestRef = useRef(0)

  const dependencyRows = useMemo(() => dependencies.map((dependency) => {
    const outdated = outdatedMap[dependency.name]
    const latest = versionFromOutdated(outdated?.latest)
    const resolvable = versionFromOutdated(outdated?.resolvable)
    return {
      ...dependency,
      latest,
      resolvable,
      outdated: Boolean(latest && latest !== dependency.version)
    }
  }), [dependencies, outdatedMap])

  const summaryItems = useMemo(() => {
    const regular = dependencies.filter((item) => item.type === 'dependencies').length
    const dev = dependencies.filter((item) => item.type === 'dev_dependencies').length
    const overrides = dependencies.filter((item) => item.type === 'dependency_overrides').length
    return [
      { label: t('common.manifest'), value: projectInfo?.hasPubspec ? 'pubspec.yaml' : t('common.notDetected') },
      { label: t('common.dependencies'), value: String(regular) },
      { label: t('package.devDependenciesLabel'), value: String(dev) },
      { label: t('flutter.overrides'), value: String(overrides) },
      { label: t('flutter.assets'), value: String(assets.length) }
    ]
  }, [dependencies, assets.length, projectInfo?.hasPubspec, t])

  useDependencyHealthReminder('flutter', currentPath, !!currentPath && !!projectInfo?.hasPubspec && dependencies.length > 0)

  useEffect(() => {
    void loadFlutterProject()
  }, [currentPath])

  const chooseDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setCurrentPath(path)
    addNotification({ type: 'info', message: t('common.workdirSwitched'), description: path })
  }

  const loadFlutterProject = async () => {
    const epoch = ++loadEpochRef.current
    if (!currentPath) {
      setProjectInfo(null)
      setDependencies([])
      setAssets([])
      setOutdatedMap({})
      return
    }

    setLoading(true)
    try {
      const detected = await window.electronAPI.flutter.detect(currentPath)
      if (epoch !== loadEpochRef.current) return
      if (!detected.hasPubspec) {
        setProjectInfo({
          hasPubspec: false,
          path: detected.path,
          name: '',
          version: '',
          description: '',
          dependencies: [],
          assets: []
        })
        setDependencies([])
        setAssets([])
        setOutdatedMap({})
        return
      }

      const [info, outdated] = await Promise.all([
        window.electronAPI.flutter.read(currentPath),
        window.electronAPI.flutter.outdated(currentPath).catch(() => ({ packages: [] }))
      ])
      if (epoch !== loadEpochRef.current) return
      setProjectInfo(info)
      setDependencies(info.dependencies)
      setAssets(info.assets)
      setOutdatedMap(outdatedPackagesByName(outdated))
    } catch (error: any) {
      if (epoch !== loadEpochRef.current) return
      setDependencies([])
      setAssets([])
      addNotification({ type: 'error', message: t('flutter.loadProjectFailed'), description: error.message })
    } finally {
      if (epoch === loadEpochRef.current) setLoading(false)
    }
  }

  const openPubspec = async () => {
    if (!projectInfo?.hasPubspec) return
    try {
      await window.electronAPI.system.openFile(projectInfo.path)
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.openPubspecFailed'), description: error.message })
    }
  }

  const openDependencyModal = () => {
    dependencyForm.resetFields()
    dependencyForm.setFieldsValue({ type: 'dependencies', source: 'hosted' })
    setSearchOptions([])
    setVersionOptions([])
    setDependencyVisible(true)
  }

  const searchPackages = async (query: string) => {
    const normalized = query.trim()
    if (!normalized) {
      setSearchOptions([])
      return
    }

    try {
      const result = await window.electronAPI.flutter.search(normalized)
      setSearchOptions(result.map((item) => ({
        value: item.name,
        label: `${item.name}${item.version ? ` (${item.version})` : ''}${item.description ? ` - ${item.description}` : ''}`,
        item
      })))
    } catch {
      setSearchOptions([])
    }
  }

  const selectPackage = (_: string, option: any) => {
    const item = option.item as FlutterSearchResult | undefined
    if (!item) return
    dependencyForm.setFieldsValue({
      packageName: item.name,
      version: item.version
    })
    setVersionOptions(item.version ? [{ value: item.version, label: item.version }] : [])
  }

  const loadInstallVersions = async () => {
    const packageName = dependencyForm.getFieldValue('packageName')
    if (!packageName) return
    const requestId = ++versionRequestRef.current

    try {
      const versions = await window.electronAPI.flutter.versions(packageName)
      if (requestId !== versionRequestRef.current || dependencyForm.getFieldValue('packageName') !== packageName) return
      setVersionOptions(versions.map((version) => ({ value: version, label: version })))
      if (versions.length === 0) {
        addNotification({ type: 'info', message: t('package.noVersionInfo'), description: packageName })
      }
    } catch (error: any) {
      if (requestId !== versionRequestRef.current) return
      setVersionOptions([])
      addNotification({ type: 'error', message: t('flutter.loadVersionsFailed'), description: error.message })
    }
  }

  const chooseLocalDependencyPath = async () => {
    const directory = await window.electronAPI.selectDirectory()
    if (!directory) return
    dependencyForm.setFieldsValue({
      path: currentPath ? toPubspecRelativePath(currentPath, directory) : normalizePath(directory)
    })
  }

  const addDependency = async (values: FlutterDependencyArgs) => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: t('flutter.selectProjectFirst') })
      return
    }

    setLoading(true)
    try {
      await window.electronAPI.flutter.addDependency({
        ...values,
        cwd: currentPath
      })
      setDependencyVisible(false)
      dependencyForm.resetFields()
      await loadFlutterProject()
      addNotification({ type: 'success', message: t('flutter.dependencySaved'), description: values.packageName })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.saveDependencyFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const updateDependency = async (record: FlutterDependencyInfo) => {
    if (!currentPath) return
    setLoading(true)
    try {
      await window.electronAPI.flutter.updateDependency({
        cwd: currentPath,
        packageName: record.name,
        type: record.type
      })
      await loadFlutterProject()
      addNotification({ type: 'success', message: t('flutter.dependencyUpdated'), description: record.name })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.updateDependencyFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const updateAllDependencies = async () => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.updateDependency({ cwd: currentPath })
      await loadFlutterProject()
      setOutputTitle('flutter pub upgrade --major-versions')
      setOutput(result || 'Completed')
      setOutputVisible(true)
      addNotification({ type: 'success', message: t('flutter.upgradeAllComplete') })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.upgradeAllFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const removeDependency = async (record: FlutterDependencyInfo) => {
    if (!currentPath) return
    setLoading(true)
    try {
      await window.electronAPI.flutter.removeDependency({
        cwd: currentPath,
        packageName: record.name,
        type: record.type
      })
      await loadFlutterProject()
      addNotification({ type: 'success', message: t('flutter.dependencyRemoved'), description: record.name })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.removeDependencyFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const showDependencyVersions = async (record: FlutterDependencyInfo) => {
    setSelectedDependency(record)
    setVersionOptions([])
    setVersionVisible(true)
    setLoading(true)
    try {
      const versions = await window.electronAPI.flutter.versions(record.name)
      setVersionOptions(versions.map((version) => ({ value: version, label: version })))
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.loadVersionsFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const installSelectedVersion = async (version: string) => {
    if (!currentPath || !selectedDependency) return
    setLoading(true)
    try {
      await window.electronAPI.flutter.addDependency({
        cwd: currentPath,
        packageName: selectedDependency.name,
        version,
        type: selectedDependency.type,
        source: selectedDependency.source || 'hosted',
        sdk: selectedDependency.sdk,
        path: selectedDependency.path,
        git: selectedDependency.git
      })
      setVersionVisible(false)
      await loadFlutterProject()
      addNotification({ type: 'success', message: t('flutter.versionSwitched'), description: `${selectedDependency.name}@${version}` })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.switchVersionFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const runPubGet = async () => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.get(currentPath)
      setOutputTitle('flutter pub get')
      setOutput(result || 'Completed')
      setOutputVisible(true)
      await loadFlutterProject()
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.pubGetFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const showDependencyGraph = async () => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.dependencyTree(currentPath)
      setDependencyTree(result)
      setTreeVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.dependencyGraphFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const modifyTreeNode = (node: TreeLikeNode) => {
    const directDependency = dependencies.find((item) => item.name === node.name)
    if (directDependency) {
      void showDependencyVersions(directDependency)
      return
    }

    dependencyForm.resetFields()
    dependencyForm.setFieldsValue({
      packageName: node.name,
      version: node.version,
      type: 'dependency_overrides',
      source: 'hosted'
    })
    setSearchOptions([])
    setVersionOptions(node.version ? [{ value: node.version, label: node.version }] : [])
    setDependencyVisible(true)
  }

  const showOutdated = async () => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.outdated(currentPath)
      setOutdatedMap(outdatedPackagesByName(result))
      setOutputTitle('flutter pub outdated')
      setOutput(JSON.stringify(result, null, 2))
      setOutputVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.checkOutdatedFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const runSecurityAudit = async () => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.securityAudit(currentPath)
      setSecurityAudit(result)
      setSecurityVisible(true)
      addNotification(securityNotification(result, t))
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.securityAuditFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const openCommandModal = () => {
    commandForm.setFieldsValue({ command: 'pub get' })
    setCommandVisible(true)
  }

  const runCommand = async (values: { command: string }) => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.run(currentPath, values.command)
      setOutputTitle(`flutter ${values.command}`)
      setOutput(result || 'Completed')
      setOutputVisible(true)
      setCommandVisible(false)
      await loadFlutterProject()
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.commandFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const openPackagePage = async (packageName: string) => {
    try {
      await window.electronAPI.openExternal(`https://pub.dev/packages/${encodeURIComponent(packageName)}`)
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.openPubDevFailed'), description: error.message })
    }
  }

  const openAssetModal = () => {
    assetForm.resetFields()
    setAssetVisible(true)
  }

  const addAsset = async (values: { path: string }) => {
    if (!currentPath) return
    setLoading(true)
    try {
      await window.electronAPI.flutter.addAsset({ cwd: currentPath, path: values.path })
      setAssetVisible(false)
      await loadFlutterProject()
      addNotification({ type: 'success', message: t('flutter.assetAdded'), description: values.path })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.addAssetFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const removeAsset = async (record: FlutterAssetInfo) => {
    if (!currentPath) return
    setLoading(true)
    try {
      await window.electronAPI.flutter.removeAsset({ cwd: currentPath, path: record.path })
      await loadFlutterProject()
      addNotification({ type: 'success', message: t('flutter.assetRemoved'), description: record.path })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.removeAssetFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const checkPublish = async () => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.checkPublish(currentPath)
      setOutputTitle(t('flutter.publishCheckTitle'))
      setOutput(JSON.stringify(result, null, 2))
      setOutputVisible(true)
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.publishCheckFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const openPublishModal = () => {
    publishForm.resetFields()
    publishForm.setFieldsValue({ dryRun: true, force: false, overrideReadinessGate: false })
    setPublishVisible(true)
  }

  const publishPackage = async (values: FlutterPublishArgs) => {
    if (!currentPath) return
    setLoading(true)
    try {
      const result = await window.electronAPI.flutter.publish({
        cwd: currentPath,
        dryRun: values.dryRun !== false,
        force: values.force,
        server: values.server,
        overrideReadinessGate: values.overrideReadinessGate === true
      })
      setPublishVisible(false)
      setOutputTitle(values.dryRun === false ? 'flutter pub publish' : 'flutter pub publish --dry-run')
      setOutput(result || 'Completed')
      setOutputVisible(true)
      addNotification({ type: 'success', message: t('flutter.publishComplete') })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('flutter.publishFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const dependencyColumns = useMemo<any[]>(() => [
    {
      title: 'Package',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (text: string, record: FlutterDependencyInfo & { outdated?: boolean }) => (
        <Space size={6} wrap>
          <Tag color={record.outdated ? 'orange' : 'cyan'}>{text}</Tag>
          {record.source && record.source !== 'hosted' && <Tag color={sourceColor[record.source]}>{record.source}</Tag>}
        </Space>
      )
    },
    {
      title: t('flutter.versionConstraint'),
      dataIndex: 'version',
      key: 'version',
      width: 160,
      render: (text: string) => text || <Tag>source</Tag>
    },
    {
      title: 'Latest',
      dataIndex: 'latest',
      key: 'latest',
      width: 140,
      render: (text: string) => text || '-'
    },
    {
      title: t('common.group'),
      dataIndex: 'type',
      key: 'type',
      width: 180,
      render: (text: FlutterDependencyType) => <Tag color={dependencyTypeColor[text]}>{text}</Tag>
    },
    {
      title: t('common.source'),
      key: 'source',
      ellipsis: true,
      render: (_: unknown, record: FlutterDependencyInfo) => dependencySourceText(record)
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 340,
      render: (_: unknown, record: FlutterDependencyInfo) => (
        <Space wrap size={6}>
          <Button size="small" onClick={() => showDependencyVersions(record)}>{t('common.version')}</Button>
          <Button size="small" icon={<SyncOutlined />} onClick={() => updateDependency(record)}>{t('common.update')}</Button>
          <Tooltip title={t('flutter.openPubDev')}>
            <Button size="small" icon={<ExportOutlined />} onClick={() => openPackagePage(record.name)} />
          </Tooltip>
          <Popconfirm
            title={t('flutter.confirmRemoveDependency')}
            okText={t('common.remove')}
            okButtonProps={{ danger: true }}
            onConfirm={() => removeDependency(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>{t('common.remove')}</Button>
          </Popconfirm>
        </Space>
      )
    }
  ], [currentPath, outdatedMap, t])

  const assetColumns = useMemo<any[]>(() => [
    {
      title: t('flutter.assetPath'),
      dataIndex: 'path',
      key: 'path',
      render: (text: string, record: FlutterAssetInfo) => (
        <Space>
          <Tag color={record.kind === 'directory' ? 'blue' : 'green'}>{record.kind}</Tag>
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, record: FlutterAssetInfo) => (
        <Popconfirm
          title={t('flutter.confirmRemoveAsset')}
          okText={t('common.remove')}
          okButtonProps={{ danger: true }}
          onConfirm={() => removeAsset(record)}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>{t('common.remove')}</Button>
        </Popconfirm>
      )
    }
  ], [currentPath, t])

  const securityColumns = useMemo<any[]>(() => [
    {
      title: t('common.dependencies'),
      dataIndex: 'packageName',
      key: 'packageName',
      width: 180,
      render: (text: string, record: FlutterSecurityIssue) => (
        <Space size={6} wrap>
          <Tag color="red">{text}</Tag>
          <Tag>{record.version}</Tag>
        </Space>
      )
    },
    {
      title: t('common.severity'),
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity: FlutterSecurityIssue['severity']) => (
        <Tag color={securitySeverityColor[severity]}>{severity.toUpperCase()}</Tag>
      )
    },
    {
      title: t('security.advisory'),
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (text: string, record: FlutterSecurityIssue) => (
        <Button type="link" size="small" onClick={() => window.electronAPI.openExternal(record.url)}>
          {text}
        </Button>
      )
    },
    {
      title: t('flutter.impactAndFix'),
      key: 'summary',
      render: (_: unknown, record: FlutterSecurityIssue) => (
        <Space orientation="vertical" size={2} style={{ width: '100%' }}>
          <strong>{record.summary}</strong>
          <span>{record.affectedRange || t('flutter.affectedRangeFromAdvisory')}</span>
          <span>{record.fixedVersion ? t('flutter.upgradeSuggested', { version: record.fixedVersion }) : t('flutter.noFixedVersionInAdvisory')}</span>
          {record.aliases.length > 0 && <span>{record.aliases.join(', ')}</span>}
        </Space>
      )
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 170,
      render: (_: unknown, record: FlutterSecurityIssue) => (
        <Space wrap>
          <Button size="small" onClick={() => openPackagePage(record.packageName)}>pub.dev</Button>
          <Button size="small" type="primary" onClick={() => {
            const dep = dependencies.find((item) => item.name === record.packageName)
            if (dep) {
              void showDependencyVersions(dep)
            }
          }}>
            {t('common.upgrade')}
          </Button>
        </Space>
      )
    }
  ], [dependencies, t])

  const renderSourceFields = () => (
    <Form.Item shouldUpdate noStyle>
      {({ getFieldValue }) => {
        const source = getFieldValue('source') as FlutterDependencySource
        if (source === 'sdk') {
          return (
            <Form.Item name="sdk" label="SDK">
              <Input placeholder="flutter" />
            </Form.Item>
          )
        }
        if (source === 'path') {
          return (
            <Form.Item name="path" label="Path" rules={[{ required: true, message: t('flutter.enterLocalPath') }]}>
              <Space.Compact style={{ width: '100%' }}>
                <Input placeholder="../local_package" />
                <Button icon={<FolderOpenOutlined />} onClick={chooseLocalDependencyPath}>{t('common.select')}</Button>
              </Space.Compact>
            </Form.Item>
          )
        }
        if (source === 'git') {
          return (
            <Form.Item name="git" label="Git URL" rules={[{ required: true, message: t('flutter.enterGitUrl') }]}>
              <Input placeholder="https://github.com/org/package.git" />
            </Form.Item>
          )
        }
        return null
      }}
    </Form.Item>
  )

  const hasPubspec = !!projectInfo?.hasPubspec
  const actionsDisabled = !currentPath || !hasPubspec

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h2 className={styles.title}>{t('flutter.title')}</h2>
            <div className={styles.subtitle}>{t('flutter.subtitle')}</div>
          </div>
          <RuntimeManagerSwitch active="flutter" />
        </div>
        <Space className={styles.actions} wrap>
          <span className={styles.pathValue}>{currentPath || t('common.noDirectorySelected')}</span>
          <Button icon={<FolderOpenOutlined />} onClick={chooseDirectory}>{t('common.selectDirectory')}</Button>
        </Space>
      </div>

      <div className={styles.summaryGrid}>
        {summaryItems.map((item) => (
          <div key={item.label} className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <strong className={styles.summaryValue}>{item.value}</strong>
          </div>
        ))}
      </div>

      {!currentPath && (
        <Alert type="info" showIcon title={t('flutter.selectProjectHint')} />
      )}
      {currentPath && projectInfo && !projectInfo.hasPubspec && (
        <Alert
          type="warning"
          showIcon
          title={t('flutter.noPubspecDetected')}
          description={t('flutter.selectProjectRootHint')}
        />
      )}

      <div className={styles.workspace}>
        <Tabs
          items={[
            {
              key: 'dependencies',
              label: t('common.dependencies'),
              children: (
                <>
                  <div className={styles.sectionHeader}>
                    <Space>
                      <CodeOutlined />
                      <strong>{t('flutter.pubspecDependencies')}</strong>
                    </Space>
                    <Space wrap>
                      <Button icon={<ReloadOutlined />} onClick={loadFlutterProject} loading={loading} disabled={!currentPath}>{t('common.refresh')}</Button>
                      <Button icon={<FileTextOutlined />} onClick={openPubspec} disabled={!hasPubspec}>{t('flutter.openPubspec')}</Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={openDependencyModal} disabled={actionsDisabled}>{t('common.addDependency')}</Button>
                      <Button icon={<SyncOutlined />} onClick={updateAllDependencies} loading={loading} disabled={actionsDisabled || dependencies.length === 0}>{t('common.updateAll')}</Button>
                      <Button icon={<PlayCircleOutlined />} onClick={runPubGet} loading={loading} disabled={actionsDisabled}>pub get</Button>
                      <Button icon={<BranchesOutlined />} onClick={showDependencyGraph} loading={loading} disabled={actionsDisabled}>{t('flutter.dependencyGraph')}</Button>
                      <Button icon={<WarningOutlined />} onClick={runSecurityAudit} loading={loading} disabled={actionsDisabled}>{t('common.securityAudit')}</Button>
                      <Button icon={<WarningOutlined />} onClick={() => setHealthVisible(true)} disabled={actionsDisabled}>{t('common.dependencyDiagnostics')}</Button>
                    </Space>
                  </div>

                  {hasPubspec && (
                    <Descriptions bordered size="small" column={1} className={styles.manifestInfo}>
                      <Descriptions.Item label={t('common.manifest')}>{projectInfo?.path}</Descriptions.Item>
                      <Descriptions.Item label={t('package.columnName')}>{projectInfo?.name || '-'}</Descriptions.Item>
                      <Descriptions.Item label={t('common.version')}>{projectInfo?.version || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Dart SDK">{projectInfo?.environmentSdk || '-'}</Descriptions.Item>
                    </Descriptions>
                  )}

                  <Spin spinning={loading}>
                    {dependencies.length === 0 ? (
                      <Empty description={hasPubspec ? t('flutter.noDependencies') : t('flutter.noProjectLoaded')} />
                    ) : (
                      <Table
                        dataSource={dependencyRows}
                        columns={dependencyColumns}
                        rowKey={(record) => `${record.type}:${record.name}`}
                        size="small"
                        pagination={{ pageSize: 20 }}
                        scroll={{ x: 1200 }}
                      />
                    )}
                  </Spin>
                </>
              )
            },
            {
              key: 'assets',
              label: t('flutter.assetsAndPublish'),
              children: (
                <>
                  <div className={styles.sectionHeader}>
                    <Space>
                      <FileTextOutlined />
                      <strong>{t('flutter.assetsPublishSection')}</strong>
                    </Space>
                    <Space wrap>
                      <Button icon={<PlusOutlined />} onClick={openAssetModal} disabled={actionsDisabled}>{t('flutter.addAsset')}</Button>
                      <Button icon={<WarningOutlined />} onClick={showOutdated} loading={loading} disabled={actionsDisabled}>Outdated</Button>
                      <Button icon={<PlayCircleOutlined />} onClick={openCommandModal} disabled={actionsDisabled}>{t('flutter.runCommand')}</Button>
                      <Button icon={<CloudUploadOutlined />} onClick={checkPublish} loading={loading} disabled={actionsDisabled}>{t('flutter.publishCheck')}</Button>
                      <Button type="primary" icon={<CloudUploadOutlined />} onClick={openPublishModal} disabled={actionsDisabled}>{t('common.publish')}</Button>
                    </Space>
                  </div>

                  <Spin spinning={loading}>
                    {assets.length === 0 ? (
                      <Empty description={hasPubspec ? t('flutter.noAssets') : t('flutter.noProjectLoaded')} />
                    ) : (
                      <Table
                        dataSource={assets}
                        columns={assetColumns}
                        rowKey="path"
                        size="small"
                        pagination={false}
                      />
                    )}
                  </Spin>
                </>
              )
            }
          ]}
        />
      </div>

      <Modal
        title={t('flutter.addDependencyTitle')}
        open={dependencyVisible}
        onCancel={() => setDependencyVisible(false)}
        onOk={() => dependencyForm.submit()}
        okText={t('common.save')}
        forceRender
      >
        <Form form={dependencyForm} layout="vertical" onFinish={addDependency}>
          <Form.Item name="packageName" label="Package" rules={[{ required: true, message: t('flutter.enterPackageName') }]}>
            <AutoComplete
              options={searchOptions}
              onSearch={searchPackages}
              onSelect={selectPackage}
              placeholder="provider"
            />
          </Form.Item>
          <Form.Item name="source" label={t('common.source')}>
            <Select options={SOURCE_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('common.version')}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="version" noStyle>
                <AutoComplete options={versionOptions} placeholder={t('flutter.versionPlaceholder')} style={{ width: '100%' }} />
              </Form.Item>
              <Button onClick={loadInstallVersions}>{t('common.version')}</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="type" label={t('common.group')}>
            <Select options={DEPENDENCY_TYPE_OPTIONS} />
          </Form.Item>
          {renderSourceFields()}
        </Form>
      </Modal>

      <Modal
        title={t('flutter.addAssetTitle')}
        open={assetVisible}
        onCancel={() => setAssetVisible(false)}
        onOk={() => assetForm.submit()}
        okText={t('common.add')}
        forceRender
      >
        <Form form={assetForm} layout="vertical" onFinish={addAsset}>
          <Form.Item name="path" label="Asset path" rules={[{ required: true, message: t('flutter.enterAssetPath') }]}>
            <AutoComplete
              options={[
                { value: 'assets/' },
                { value: 'assets/images/' },
                { value: 'assets/icons/' },
                { value: 'assets/config/app.json' }
              ]}
              placeholder="assets/images/"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('flutter.runCommandTitle')}
        open={commandVisible}
        onCancel={() => setCommandVisible(false)}
        onOk={() => commandForm.submit()}
        okText={t('common.run')}
        forceRender
      >
        <Form form={commandForm} layout="vertical" onFinish={runCommand}>
          <Form.Item name="command" label={t('flutter.commandArgs')} rules={[{ required: true, message: t('flutter.enterCommandArgs') }]}>
            <AutoComplete options={FLUTTER_COMMAND_OPTIONS} placeholder="pub get" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('flutter.versionTitle', { name: selectedDependency?.name || '' })}
        open={versionVisible}
        onCancel={() => setVersionVisible(false)}
        footer={null}
        width={620}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <span>{t('flutter.currentVersionConstraint')} <Tag color="cyan">{selectedDependency?.version || '-'}</Tag></span>
          <div className={styles.versions}>
            {versionOptions.length === 0 ? (
              <Empty description={t('package.noVersionInfo')} />
            ) : (
              versionOptions.map((item) => (
                <Tag
                  key={item.value}
                  color={item.value === selectedDependency?.version ? 'cyan' : 'default'}
                  className={styles.versionTag}
                  onClick={() => installSelectedVersion(item.value)}
                >
                  {item.value}
                </Tag>
              ))
            )}
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('flutter.publishToPubDev')}
        open={publishVisible}
        onCancel={() => setPublishVisible(false)}
        onOk={() => publishForm.submit()}
        okText={t('common.execute')}
        forceRender
      >
        <Form form={publishForm} layout="vertical" onFinish={publishPackage} initialValues={{ dryRun: true, force: false, overrideReadinessGate: false }}>
          <Form.Item name="dryRun" valuePropName="checked">
            <Checkbox>{t('flutter.dryRunHint')}</Checkbox>
          </Form.Item>
          <Form.Item name="force" valuePropName="checked">
            <Checkbox>{t('flutter.forceHint')}</Checkbox>
          </Form.Item>
          <Form.Item name="server" label="Server">
            <Input placeholder={t('flutter.serverPlaceholder')} />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            message="Production readiness gate runs before real publish"
            description="Dry runs are allowed, but blocked readiness checks stop real publishing unless an approved override is enabled."
            style={{ marginBottom: 12 }}
          />
          <Form.Item name="overrideReadinessGate" valuePropName="checked">
            <Checkbox>Override production readiness gate after approval</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={outputTitle}
        open={outputVisible}
        onCancel={() => setOutputVisible(false)}
        footer={null}
        width={900}
      >
        <pre className={styles.output}>{output}</pre>
      </Modal>

      <DependencyTreeViewer
        title={t('flutter.dependencyTreeTitle')}
        visible={treeVisible}
        data={dependencyTree}
        actionLabel={t('common.modify')}
        canNodeAction={(node) => node.name !== projectInfo?.name}
        onNodeAction={modifyTreeNode}
        onClose={() => setTreeVisible(false)}
      />

      <Modal
        title={t('flutter.securityAuditTitle')}
        open={securityVisible}
        onCancel={() => setSecurityVisible(false)}
        footer={null}
        width={1100}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type={securityAudit?.issues.length ? 'warning' : 'success'}
            showIcon
            title={securityAudit?.issues.length ? t('flutter.securityRisksFoundCount', { count: securityAudit.issues.length }) : t('flutter.noSecurityRisks')}
            description={[
              securityAudit ? t('flutter.dataSource', { source: securityAudit.source }) : '',
              securityAudit ? t('flutter.dependenciesChecked', { count: securityAudit.dependencyCount }) : '',
              securityAudit?.skipped.length ? t('flutter.skippedUnpinned', { list: securityAudit.skipped.join(', ') }) : '',
              securityAudit?.error || ''
            ].filter(Boolean).join(t('common.detailSeparator'))}
            action={<Button onClick={runSecurityAudit} loading={loading}>{t('security.rescan')}</Button>}
          />
          {!securityAudit || securityAudit.issues.length === 0 ? (
            <Empty description={t('flutter.noSecurityResults')} />
          ) : (
            <Table
              dataSource={securityAudit.issues}
              columns={securityColumns}
              rowKey={(record) => `${record.packageName}:${record.version}:${record.id}`}
              size="small"
              pagination={{ pageSize: 8 }}
              scroll={{ x: 980 }}
            />
          )}
        </Space>
      </Modal>

      <DependencyHealthModal
        visible={healthVisible}
        manager="flutter"
        cwd={currentPath}
        onClose={() => setHealthVisible(false)}
      />
    </div>
  )
}

export default FlutterPage
