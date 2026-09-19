import React, { useEffect, useRef, useState } from 'react'
import { Alert, AutoComplete, Button, Empty, Spin, Modal, Form, Input, Switch, Select, Tag, Dropdown, Space, Tooltip, Table, Tabs, Card } from 'antd'
import { ReloadOutlined, FolderOpenOutlined, PlusOutlined, SwapOutlined, FolderFilled, PlayCircleOutlined, CheckCircleOutlined, WarningOutlined, SyncOutlined, HistoryOutlined, SecurityScanOutlined, InfoCircleOutlined, DownloadOutlined, ApartmentOutlined, CloudDownloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../../../stores/appStore'
import { usePackageStore, PackageInfo } from '../../../../../stores/packageStore'
import { resolvePackageUpdateTarget, resolveSmartPackageUpdateTarget, useSettingsStore } from '../../../../../stores/settingsStore'
import { useCommandLogStore } from '../../../../../stores/commandLogStore'
import { PackageDetailModal } from '../../../../../components/Package/PackageDetailModal'
import { SecurityAuditModal } from '../../../../../components/Package/SecurityAuditModal'
import { DependencyTreeModal } from '../../../../../components/Package/DependencyTreeModal'
import { DependencyHealthModal } from '../../../../../components/Package/DependencyHealthModal'
import { BatchVersionPreviewModal } from '../../../../../components/Package/BatchVersionPreviewModal'
import { NpmVersionPicker } from '../../../../../components/Package/NpmVersionPicker'
import ProjectToolchainPanel from '../../../../../components/Toolchain/ProjectToolchainPanel'
import ProjectPathBar from '../../../../../components/ProjectPathBar/ProjectPathBar'
import { localizedModal } from '../../../../../utils/localizedFeedback'
import { useT, type LabelTranslator } from '../../../../../i18n'
import { VERSION_PAGE_SIZE, VersionChannelFilter, toVersionOptions, versionsForFilter } from '../../../../../utils/npmVersions'
import { cleanPackageSummary, formatCompactNumber } from '../../../../../utils/npmDisplay'
import { useDependencyHealthReminder } from '../../../../../hooks/useDependencyHealthReminder'
import { pagedPagination } from '../../../../../utils/tablePagination'
import styles from './Project.module.css'

const SEARCH_PAGE_SIZE = 10

// Monotonic request id so a stale paged-search response cannot overwrite a
// newer one when the user types quickly in the install autocomplete.
let packageOptionsRequestId = 0

// Same idea for the "switch version" dialog: opening A then B must not let
// A's slower reply populate B's version list (installing would use it).
let versionDialogRequestId = 0

// Install-modal version loads: a stale reply for a replaced package name must
// not auto-fill the wrong version into the form.
let installVersionsRequestId = 0

interface ProjectPageProps {
  hideToolchainPanel?: boolean
  hideProjectSelector?: boolean
}

const ProjectPage: React.FC<ProjectPageProps> = ({ hideToolchainPanel = false, hideProjectSelector = false }) => {
  const [installVisible, setInstallVisible] = useState(false)
  const [moveDepVisible, setMoveDepVisible] = useState(false)
  const [versionVisible, setVersionVisible] = useState(false)
  const [installForm] = Form.useForm()
  const [moveDepForm] = Form.useForm()
  const [scripts, setScripts] = useState<string[]>([])
  const [runningScripts, setRunningScripts] = useState<Record<string, boolean>>({})
  const [outputScript, setOutputScript] = useState<string>('')
  const scriptRunIdRef = useRef(0)
  const [scriptOutput, setScriptOutput] = useState<string>('')
  const [scriptOutputVisible, setScriptOutputVisible] = useState(false)
  const [checkingAll, setCheckingAll] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(null)
  const [versions, setVersions] = useState<string[]>([])
  const [versionMetadata, setVersionMetadata] = useState<NpmVersionMetadata | null>(null)
  const [stableVersionPage, setStableVersionPage] = useState(1)
  const [prereleaseVersionPage, setPrereleaseVersionPage] = useState(1)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailPackage, setDetailPackage] = useState<string>('')
  const [auditVisible, setAuditVisible] = useState(false)
  const [depTreeVisible, setDepTreeVisible] = useState(false)
  const [healthVisible, setHealthVisible] = useState(false)
  const [packageSizes, setPackageSizes] = useState<Record<string, any>>({})
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [updatingSelected, setUpdatingSelected] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<PackageInfo[]>([])
  const [uninstallingSelected, setUninstallingSelected] = useState(false)
  const [packageOptions, setPackageOptions] = useState<Array<{ value: string; label: React.ReactNode }>>([])
  const [packageSearchQuery, setPackageSearchQuery] = useState('')
  const [packageSearchPage, setPackageSearchPage] = useState(1)
  const [packageSearchHasMore, setPackageSearchHasMore] = useState(false)
  const [packageSearchLoadingMore, setPackageSearchLoadingMore] = useState(false)
  const [installVersionOptions, setInstallVersionOptions] = useState<Array<{ value: string; label: React.ReactNode }>>([])
  const [installVersionMetadata, setInstallVersionMetadata] = useState<NpmVersionMetadata | null>(null)
  const [installVersionFilter, setInstallVersionFilter] = useState<VersionChannelFilter>('stable')
  const [installVersionPage, setInstallVersionPage] = useState(1)
  
  const currentPath = useAppStore((state) => state.currentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const t = useT()
  const updateStrategy = useSettingsStore((state) => state.updateStrategy)
  const conflictStrategy = useSettingsStore((state) => state.conflictStrategy)
  const setTerminalVisible = useCommandLogStore((state) => state.setVisible)
  const projectPackages = usePackageStore((state) => state.projectPackages)
  const projectLoading = usePackageStore((state) => state.projectLoading)
  const projectError = usePackageStore((state) => state.projectError)
  const mutating = usePackageStore((state) => state.mutating)
  const fetchProjectPackages = usePackageStore((state) => state.fetchProjectPackages)
  const installPackage = usePackageStore((state) => state.installPackage)
  const uninstallPackage = usePackageStore((state) => state.uninstallPackage)
  const installSpecificVersion = usePackageStore((state) => state.installSpecificVersion)

  useDependencyHealthReminder('npm', currentPath, !!currentPath && projectPackages.length > 0)
  
  useEffect(() => {
    let watcherActive = false
    if (currentPath) {
      fetchProjectPackages(currentPath)
      loadScripts(currentPath)
      watcherActive = true
      void startWatcher(currentPath, () => watcherActive)
    }

    return () => {
      watcherActive = false
      stopWatcher()
    }
  }, [currentPath])

  const startWatcher = async (path: string, isActive: () => boolean) => {
    if (!path) return
    try {
      // Disarm any listener left over from a previous path before arming a new
      // one: registration is async, so the previous effect's cleanup may have
      // already run by the time this continuation resumes.
      window.electronAPI?.watcher?.stop()
      window.electronAPI?.watcher?.removeChangeListener()
      const projectInfo = await window.electronAPI.project.detect(path)
      if (!isActive()) return
      if (projectInfo.hasPackageJson) {
        await window.electronAPI.watcher.start(path)
        if (!isActive()) {
          // Stale: only unwatch this exact path. A newer effect may have already
          // armed its own watcher/listener, and a full stop or listener teardown
          // here would kill that registration (watch:stop supports per-path).
          window.electronAPI?.watcher?.stop(path)
          return
        }
        window.electronAPI.watcher.onChange((data) => {
          if (!isActive() || data.path !== path) return
          addNotification({
            type: 'info',
            message: `${data.file || 'dependency manifest'} 已变更`,
            description: '正在自动刷新...'
          })
          fetchProjectPackages(path, true)
          loadScripts(path)
        })
      }
    } catch (error) {
      console.warn('Failed to start watcher:', error)
    }
  }

  const stopWatcher = () => {
    window.electronAPI?.watcher?.stop()
    window.electronAPI?.watcher?.removeChangeListener()
  }
  
  useEffect(() => {
    if (projectPackages.length === 0) return
    // Size lookups race with project switches: a slow reply for the previous
    // project must not label the current list with the wrong sizes.
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        projectPackages.slice(0, 20).map(async (pkg) => {
          if (pkg.size) {
            return [pkg.name, { prettySize: pkg.size, fileCount: pkg.fileCount || 0 }] as const
          }

          try {
            const size = await window.electronAPI.npm.getPackageSize(pkg.name, pkg.version)
            return [pkg.name, size] as const
          } catch {
            return null
          }
        })
      )
      if (cancelled) return
      const sizes = Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, any]>)
      setPackageSizes(sizes)
    })()
    return () => { cancelled = true }
  }, [projectPackages])
  
  const loadScripts = async (path: string) => {
    if (!path) return
    try {
      const result = await window.electronAPI.npm.getScripts(path)
      // A reply for a project the user already switched away from must not
      // overwrite the current project's script list.
      if (useAppStore.getState().currentPath !== path) return
      setScripts(result)
    } catch (error) {
      if (useAppStore.getState().currentPath === path) setScripts([])
    }
  }
  
  const handleRefresh = async () => {
    const refreshed = await fetchProjectPackages(currentPath)
    await loadScripts(currentPath)
    if (!refreshed) {
      // fetchProjectPackages resolves false when the current refresh failed;
      // showing "refresh succeeded" here would contradict the error alert.
      addNotification({
        type: 'error',
        message: t('npm.refreshFailed'),
        description: usePackageStore.getState().projectError || undefined
      })
      return
    }
    addNotification({
      type: 'success',
      message: t('npm.refreshSucceeded')
    })
  }
  
  const handleUpdate = async (packageName: string) => {
    const pkg = projectPackages.find(p => p.name === packageName)
    if (pkg) {
      setPendingUpdates([pkg])
      setPreviewVisible(true)
    }
  }

  const executeUpdate = async (selectedPackages: string[]) => {
    setPreviewVisible(false)
    setUpdatingSelected(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const packageName of selectedPackages) {
        try {
          const pkg = pendingUpdates.find((item) => item.name === packageName)
          const targetVersion = pkg && updateStrategy === 'smart'
            ? (await resolveSmartPackageUpdateTarget(pkg, conflictStrategy)).targetVersion
            : pkg ? resolvePackageUpdateTarget(pkg, updateStrategy) : undefined
          await window.electronAPI.npm.update({
            packageName,
            cwd: currentPath,
            version: targetVersion
          })
          successCount++
        } catch {
          failCount++
        }
      }

      addNotification({
        type: successCount > 0 ? 'success' : 'info',
        message: '批量更新完成',
        description: `成功: ${successCount}, 失败: ${failCount}`
      })

      setSelectedRowKeys([])
      await fetchProjectPackages(currentPath, true)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '批量更新失败',
        description: error.message
      })
    } finally {
      setUpdatingSelected(false)
    }
  }
  
  const handleUninstall = async (packageName: string) => {
    try {
      await uninstallPackage({
        packageName,
        cwd: currentPath
      })
      addNotification({
        type: 'success',
        message: t('npm.uninstallSucceeded'),
        description: t('npm.uninstalledDescription', { name: packageName })
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('npm.uninstallFailed'),
        description: error.message
      })
    }
  }
  
  const handleInstall = async (values: any) => {
    try {
      await installPackage({
        packageName: values.package,
        cwd: currentPath,
        dev: values.dev,
        version: values.version
      })
      addNotification({
        type: 'success',
        message: '安装成功',
        description: `${values.package} 已成功安装`
      })
      setInstallVisible(false)
      installForm.resetFields()
      await loadScripts(currentPath)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '安装失败',
        description: error.message
      })
    }
  }
  
  const handleMoveDep = async (values: any) => {
    try {
      await window.electronAPI.npm.moveDep({
        packageName: values.packageName,
        cwd: currentPath,
        from: values.from,
        to: values.to
      })
      addNotification({
        type: 'success',
        message: '依赖类型已切换',
        description: `${values.packageName} 已从 ${values.from} 移动到 ${values.to}`
      })
      setMoveDepVisible(false)
      moveDepForm.resetFields()
      await fetchProjectPackages(currentPath)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '切换失败',
        description: error.message
      })
    }
  }
  
  const handleOpenPackagePath = async (packageName: string) => {
    try {
      const path = await window.electronAPI.project.getNodeModulesPath(currentPath, packageName)
      await window.electronAPI.system.openPath(path)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('npm.openPathFailed'),
        description: error.message
      })
    }
  }
  
  const handleOpenPackageJson = async () => {
    try {
      const path = await window.electronAPI.project.getPackagePath(currentPath)
      await window.electronAPI.system.openFile(path)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '打开package.json失败',
        description: error.message
      })
    }
  }
  
  const handleOpenTerminal = async () => {
    setTerminalVisible(true)
    addNotification({
      type: 'success',
      message: t('npm.terminalOpened'),
      description: currentPath
    })
  }

  const searchInstallPackages = async (query: string) => {
    if (!query.trim()) {
      setPackageOptions([])
      setPackageSearchQuery('')
      setPackageSearchPage(1)
      setPackageSearchHasMore(false)
      return
    }
    await loadPackageOptions(query, 1)
  }

  const loadPackageOptions = async (query: string, page: number) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return
    const requestId = ++packageOptionsRequestId
    try {
      const limit = page * SEARCH_PAGE_SIZE
      const result = await window.electronAPI.npm.search(trimmedQuery, limit + 1)
      if (requestId !== packageOptionsRequestId) return
      const packages = uniqueByName(result)
      const visiblePackages = packages.slice(0, limit)
      const downloads = await loadSearchDownloads(visiblePackages)
      if (requestId !== packageOptionsRequestId) return
      const hasMore = packages.length > visiblePackages.length
      setPackageSearchQuery(trimmedQuery)
      setPackageSearchPage(page)
      setPackageSearchHasMore(hasMore)
      setPackageOptions(buildPackageOptions(visiblePackages, downloads, t))
    } catch {
      if (requestId !== packageOptionsRequestId) return
      setPackageOptions([])
      setPackageSearchHasMore(false)
    }
  }

  const loadMorePackageOptions = async () => {
    if (!packageSearchQuery || !packageSearchHasMore || packageSearchLoadingMore) return
    setPackageSearchLoadingMore(true)
    try {
      await loadPackageOptions(packageSearchQuery, packageSearchPage + 1)
    } finally {
      setPackageSearchLoadingMore(false)
    }
  }

  const loadInstallVersions = async () => {
    const packageName = installForm.getFieldValue('package')
    if (!packageName) return
    const rawName = String(packageName)
    const versionMark = rawName.startsWith('@') ? rawName.indexOf('@', 1) : rawName.indexOf('@')
    const name = versionMark > 0 ? rawName.slice(0, versionMark) : rawName
    const requestId = ++installVersionsRequestId
    const metadata = await window.electronAPI.npm.getVersionMetadata(name)
    if (requestId !== installVersionsRequestId || installForm.getFieldValue('package') !== packageName) return
    setInstallVersionMetadata(metadata)
    setInstallVersionPage(1)
    const options = buildInstallVersionOptions(metadata, installVersionFilter, 1)
    setInstallVersionOptions(options)
    if (options[0]) {
      installForm.setFieldValue('version', options[0].value)
    }
  }

  const handleInstallVersionFilterChange = (filter: VersionChannelFilter) => {
    setInstallVersionFilter(filter)
    setInstallVersionPage(1)
    if (installVersionMetadata) {
      const options = buildInstallVersionOptions(installVersionMetadata, filter, 1)
      setInstallVersionOptions(options)
      installForm.setFieldValue('version', options[0]?.value)
    }
  }

  const loadMoreInstallVersions = () => {
    if (!installVersionMetadata) return
    if (versionsForFilter(installVersionMetadata, installVersionFilter).length <= installVersionPage * VERSION_PAGE_SIZE) return
    const nextPage = installVersionPage + 1
    setInstallVersionPage(nextPage)
    setInstallVersionOptions(buildInstallVersionOptions(installVersionMetadata, installVersionFilter, nextPage))
  }

  const handlePackagePopupScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!isNearPopupBottom(event.currentTarget)) return
    void loadMorePackageOptions()
  }

  const handleVersionPopupScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!isNearPopupBottom(event.currentTarget)) return
    loadMoreInstallVersions()
  }
  
  const handleRunScript = async (script: string) => {
    // Scripts can run concurrently; a plain string flag would let the first
    // finisher clear the second's loading state and overwrite its output.
    const runId = ++scriptRunIdRef.current
    setRunningScripts((prev) => ({ ...prev, [script]: true }))
    setOutputScript(script)
    setScriptOutputVisible(true)
    setScriptOutput('正在执行...')

    try {
      const output = await window.electronAPI.npm.runScript(currentPath, script)
      if (runId !== scriptRunIdRef.current) return
      setScriptOutput(output)
      addNotification({
        type: 'success',
        message: '脚本执行完成',
        description: `npm run ${script}`
      })
    } catch (error: any) {
      if (runId !== scriptRunIdRef.current) return
      setScriptOutput(`执行失败: ${error.message}`)
      addNotification({
        type: 'error',
        message: '脚本执行失败',
        description: error.message
      })
    } finally {
      setRunningScripts((prev) => {
        if (!(script in prev)) return prev
        const { [script]: _done, ...rest } = prev
        return rest
      })
    }
  }
  
  const handleCheckAllOutdated = async () => {
    setCheckingAll(true)
    try {
      // Bypass the 5-minute cache: this entry must show fresh outdated info.
      const refreshed = await fetchProjectPackages(currentPath, true)
      if (!refreshed) {
        addNotification({
          type: 'error',
          message: t('npm.checkFailed'),
          description: usePackageStore.getState().projectError || undefined
        })
        return
      }
      addNotification({
        type: 'success',
        message: t('npm.checkComplete')
      })
    } finally {
      setCheckingAll(false)
    }
  }
  
  const handleUpdateAll = async () => {
    const outdatedPackages = projectPackages.filter(pkg => pkg.outdated)
    
    if (outdatedPackages.length === 0) {
      addNotification({
        type: 'info',
        message: '所有包已是最新版本'
      })
      return
    }

    setPendingUpdates(outdatedPackages)
    setPreviewVisible(true)
  }

  const handleUpdateSelected = async () => {
    if (selectedRowKeys.length === 0) {
      addNotification({
        type: 'warning',
        message: '请先选择要更新的包'
      })
      return
    }

    const packagesToUpdate = projectPackages.filter(pkg => 
      selectedRowKeys.includes(pkg.name) && pkg.outdated
    )
    
    if (packagesToUpdate.length === 0) {
      addNotification({
        type: 'warning',
        message: '没有可更新的包'
      })
      return
    }

    setPendingUpdates(packagesToUpdate)
    setPreviewVisible(true)
  }

  const handleUninstallSelected = async () => {
    if (selectedRowKeys.length === 0) {
      addNotification({
        type: 'warning',
        message: '请先选择要卸载的包'
      })
      return
    }

    localizedModal.confirm({
      title: '确认批量卸载',
      content: `确定要卸载选中的 ${selectedRowKeys.length} 个包吗？`,
      onOk: async () => {
        setUninstallingSelected(true)
        let successCount = 0
        let failCount = 0

        try {
          for (const packageName of selectedRowKeys) {
            try {
              await window.electronAPI.npm.uninstall({
                packageName: packageName as string,
                cwd: currentPath
              })
              successCount++
            } catch {
              failCount++
            }
          }

          addNotification({
            type: successCount > 0 ? 'success' : 'error',
            message: '批量卸载完成',
            description: `成功: ${successCount}, 失败: ${failCount}`
          })

          setSelectedRowKeys([])
          await fetchProjectPackages(currentPath, true)
        } catch (error: any) {
          addNotification({
            type: 'error',
            message: '批量卸载失败',
            description: error.message
          })
        } finally {
          setUninstallingSelected(false)
        }
      }
    })
  }
  
  const handleShowVersions = async (pkg: PackageInfo) => {
    const requestId = ++versionDialogRequestId
    setSelectedPackage(pkg)
    setVersionMetadata(null)
    setVersions([])
    setStableVersionPage(1)
    setPrereleaseVersionPage(1)
    try {
      const metadata = await window.electronAPI.npm.getVersionMetadata(pkg.name)
      if (requestId !== versionDialogRequestId) return
      setVersionMetadata(metadata)
      setVersions(metadata.versions.map((version) => version.version))
      setVersionVisible(true)
    } catch (error: any) {
      if (requestId !== versionDialogRequestId) return
      addNotification({
        type: 'error',
        message: t('npm.loadVersionsFailed'),
        description: error.message
      })
    }
  }

  const handleInstallVersion = async (version: string) => {
    if (!selectedPackage) return

    try {
      await installSpecificVersion({
        packageName: selectedPackage.name,
        version,
        cwd: currentPath,
        dev: selectedPackage.type === 'devDependencies'
      })
      addNotification({
        type: 'success',
        message: t('npm.versionSwitched'),
        description: t('npm.versionInstalledDescription', { name: selectedPackage.name, version })
      })
      setVersionVisible(false)
      await fetchProjectPackages(currentPath)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('npm.versionSwitchFailed'),
        description: error.message
      })
    }
  }
  
  const handleViewChangelog = async (packageName: string) => {
    try {
      const info = await window.electronAPI.npm.getPackageInfo(packageName)
      if (info?.homepage) {
        await window.electronAPI.openExternal(info.homepage)
      } else if (info?.repository?.url) {
        let url = info.repository.url
        if (url.startsWith('git+')) {
          url = url.replace('git+', '').replace('.git', '')
        }
        if (url.includes('github.com')) {
          await window.electronAPI.openExternal(`${url}/releases`)
        } else {
          await window.electronAPI.openExternal(url)
        }
      } else {
        await window.electronAPI.openExternal(`https://www.npmjs.com/package/${packageName}`)
      }
    } catch (error: any) {
      await window.electronAPI.openExternal(`https://www.npmjs.com/package/${packageName}`)
    }
  }
  
  const handleShowDetail = (packageName: string) => {
    setDetailPackage(packageName)
    setDetailVisible(true)
  }
  
  const handleInstallFromDetail = async (version?: string) => {
    try {
      if (version) {
        await installSpecificVersion({
          packageName: detailPackage,
          version,
          cwd: currentPath,
          dev: true
        })
      } else {
        await installPackage({
          packageName: detailPackage,
          cwd: currentPath
        })
      }
      setDetailVisible(false)
      await fetchProjectPackages(currentPath)
    } catch (error: any) {
      // Every other install path reports failures; this one must not stay
      // silent with an unhandled rejection.
      addNotification({
        type: 'error',
        message: t('npm.installFailed'),
        description: error.message
      })
    }
  }
  
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  const columns = [
    {
      title: t('package.columnName'),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: PackageInfo) => (
        <Space>
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => handleShowDetail(text)}
          >
            {text}
          </Button>
          {record.outdated && (
            <Tooltip title={t('package.updateAvailable')}>
              <WarningOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
        </Space>
      )
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: t('common.type'),
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (text: PackageInfo['type']) => {
        if (text === 'devDependencies') return <Tag color="orange">{t('package.devShort')}</Tag>
        if (text === 'optionalDependencies') return <Tag color="blue">{t('npm.tagOptional')}</Tag>
        if (text === 'peerDependencies') return <Tag color="purple">{t('npm.tagPeer')}</Tag>
        return <Tag color="green">{t('package.prodShort')}</Tag>
      }
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: PackageInfo['status'], record: PackageInfo) => (
        <Tooltip title={record.problems?.join('\n')}>
          <Tag color={!status || status === 'installed' ? 'green' : 'red'}>{status || 'installed'}</Tag>
        </Tooltip>
      )
    },
    {
      title: t('common.version'),
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (text: string) => <Tag>v{text}</Tag>
    },
    {
      title: t('npm.columnLatest'),
      dataIndex: 'latest',
      key: 'latest',
      width: 80,
      render: (text: string, record: PackageInfo) =>
        text ? (
          <Tag color={text !== record.version ? 'blue' : 'green'}>
            v{text}
          </Tag>
        ) : '-'
    },
    {
      title: t('npm.columnSize'),
      key: 'size',
      width: 90,
      render: (_: any, record: PackageInfo) => {
        const size = packageSizes[record.name]
        return size ? (
          <Tooltip title={t('npm.fileCountTooltip', { count: size.fileCount })}>
            <Tag icon={<DownloadOutlined />}>{size.prettySize}</Tag>
          </Tooltip>
        ) : '-'
      }
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 130,
      render: (_: any, record: PackageInfo) => (
        <Space>
          {record.outdated && (
            <Tooltip title={t('common.update')}>
              <Button size="small" icon={<SyncOutlined />} onClick={() => handleUpdate(record.name)} />
            </Tooltip>
          )}
          <Dropdown menu={{
            items: [
              { key: 'detail', label: t('package.viewDetail'), icon: <InfoCircleOutlined /> },
              { key: 'version', label: t('npm.switchVersion'), icon: <SwapOutlined /> },
              { key: 'move', label: t('npm.switchType'), icon: <SwapOutlined /> },
              { key: 'open', label: t('npm.openPath'), icon: <FolderFilled /> },
              { key: 'changelog', label: t('npm.changelog'), icon: <HistoryOutlined /> },
              { key: 'uninstall', label: t('package.uninstall'), icon: <ReloadOutlined />, danger: true }
            ],
            onClick: ({ key }) => {
              if (key === 'detail') {
                handleShowDetail(record.name)
              } else if (key === 'version') {
                handleShowVersions(record)
              } else if (key === 'move') {
                moveDepForm.setFieldsValue({
                  packageName: record.name,
                  from: record.type,
                  to: record.type === 'dependencies' ? 'devDependencies' : 'dependencies'
                })
                setMoveDepVisible(true)
              } else if (key === 'open') {
                handleOpenPackagePath(record.name)
              } else if (key === 'changelog') {
                handleViewChangelog(record.name)
              } else if (key === 'uninstall') {
                localizedModal.confirm({
                  title: t('npm.confirmUninstallTitle'),
                  content: t('npm.confirmUninstall', { name: record.name }),
                  onOk: () => handleUninstall(record.name)
                })
              }
            }
          }}>
            <Button size="small">{t('npm.more')}</Button>
          </Dropdown>
        </Space>
      )
    }
  ]
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('npm.projectDependenciesTitle')}</h2>
        <div className={styles.actions}>
          {!hideProjectSelector && <ProjectPathBar compact />}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setInstallVisible(true)} disabled={!currentPath}>
            {t('npm.installPackageTitle')}
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={handleCheckAllOutdated} loading={checkingAll} disabled={!currentPath}>
            {t('npm.checkUpdates')}
          </Button>
          <Button
            icon={<SyncOutlined />}
            onClick={handleUpdateSelected}
            loading={updatingSelected}
            disabled={!currentPath || selectedRowKeys.length === 0}
            type={selectedRowKeys.length > 0 ? 'primary' : 'default'}
          >
            {t('package.updateSelected', { count: selectedRowKeys.length })}
          </Button>
          <Button
            danger
            icon={<ReloadOutlined />}
            onClick={handleUninstallSelected}
            loading={uninstallingSelected}
            disabled={!currentPath || selectedRowKeys.length === 0}
          >
            {t('npm.uninstallSelected', { count: selectedRowKeys.length })}
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleUpdateAll} disabled={!currentPath}>
            {t('common.updateAll')}
          </Button>
          <Button
            icon={<SecurityScanOutlined />}
            onClick={() => setAuditVisible(true)} disabled={!currentPath}
          >
            {t('common.securityAudit')}
          </Button>
          <Button
            icon={<ApartmentOutlined />}
            onClick={() => setDepTreeVisible(true)} disabled={!currentPath}
          >
            {t('npm.dependencyTree')}
          </Button>
          <Button icon={<WarningOutlined />} onClick={() => setHealthVisible(true)} disabled={!currentPath}>
            {t('common.dependencyDiagnostics')}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={projectLoading} disabled={!currentPath}>
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {!hideToolchainPanel && <ProjectToolchainPanel projectPath={currentPath} />}
      {!currentPath && (
        <Alert
          type="info"
          showIcon
          title={t('common.selectProjectFirst')}
          description={t('npm.selectDirHint')}
          action={<ProjectPathBar compact />}
          style={{ marginBottom: 16 }}
        />
      )}
      {currentPath && projectError && (
        <Alert
          type="error"
          showIcon
          title={t('npm.depsLoadFailed')}
          description={projectError}
          action={<Button size="small" onClick={() => fetchProjectPackages(currentPath, true)}>{t('health.retry')}</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs items={[
        {
          key: 'deps',
          label: t('npm.depsTab'),
          children: (
            <div className={styles.depsContent}>
              <Space style={{ marginBottom: 16 }}>
                <Button icon={<FolderFilled />} onClick={handleOpenPackageJson} disabled={!currentPath}>
                  {t('npm.openPackageJson')}
                </Button>
              </Space>

              <Spin spinning={projectLoading}>
                {!currentPath ? (
                  <Empty description={t('npm.selectDirToStart')} />
                ) : projectError ? (
                  <Empty description={t('npm.depsLoadFailedRetry')} />
                ) : projectPackages.length === 0 ? (
                  <Empty description={t('npm.noDependencies')} />
                ) : (
                  <Table
                    dataSource={projectPackages}
                    columns={columns}
                    rowKey="name"
                    size="small"
                    pagination={pagedPagination(projectPackages, t)}
                    scroll={{ x: 900 }}
                    rowSelection={rowSelection}
                  />
                )}
              </Spin>
            </div>
          )
        },
        {
          key: 'scripts',
          label: t('npm.scriptsTab'),
          children: (
            <div className={styles.scriptsContent}>
              <Space style={{ marginBottom: 16 }}>
                <Button icon={<FolderOpenOutlined />} onClick={handleOpenTerminal}>
                  {t('npm.openTerminal')}
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadScripts(currentPath)}>
                  {t('npm.refreshScripts')}
                </Button>
              </Space>

              {scripts.length === 0 ? (
                <Empty description={t('npm.noScripts')} />
              ) : (
                <div className={styles.scriptsList}>
                  {scripts.map(script => (
                    <Card key={script} className={styles.scriptCard}>
                      <div className={styles.scriptName}>{script}</div>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleRunScript(script)}
                        loading={Boolean(runningScripts[script])}
                      >
                        {t('common.run')}
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        }
      ]} />

      <Modal
        title={t('npm.installPackageTitle')}
        open={installVisible}
        onCancel={() => setInstallVisible(false)}
        onOk={() => installForm.submit()}
        okText={t('npm.install')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: mutating || projectLoading }}
      forceRender
      >
        <Form form={installForm} onFinish={handleInstall} layout="vertical" initialValues={{ dev: false }}>
          <Form.Item name="package" label={t('package.columnName')} rules={[{ required: true, message: t('npm.enterPackageName') }]}>
            <AutoComplete
              options={packageOptions}
              onSearch={searchInstallPackages}
              onPopupScroll={handlePackagePopupScroll}
              popupRender={(menu) => renderPagedPopup(t, menu, packageSearchHasMore, packageSearchLoadingMore, SEARCH_PAGE_SIZE)}
              onChange={() => {
                setInstallVersionMetadata(null)
                setInstallVersionOptions([])
                installForm.setFieldValue('version', undefined)
              }}
              placeholder={t('npm.exampleLodash')}
            />
          </Form.Item>
          <Form.Item label={t('npm.versionOptional')}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="version" noStyle>
                <AutoComplete
                  options={installVersionOptions}
                  placeholder={t('npm.versionPlaceholder')}
                  style={{ width: '100%' }}
                  onPopupScroll={handleVersionPopupScroll}
                  popupRender={(menu) => renderPagedPopup(
                    t,
                    menu,
                    !!installVersionMetadata && versionsForFilter(installVersionMetadata, installVersionFilter).length > installVersionPage * VERSION_PAGE_SIZE,
                    false,
                    VERSION_PAGE_SIZE
                  )}
                />
              </Form.Item>
              <Select
                value={installVersionFilter}
                onChange={handleInstallVersionFilterChange}
                style={{ width: 120 }}
                options={[
                  { value: 'stable', label: t('npm.stable') },
                  { value: 'prerelease', label: t('npm.prerelease') },
                  { value: 'all', label: t('npm.all') }
                ]}
              />
              <Button onClick={loadInstallVersions}>{t('npm.loadVersions')}</Button>
            </Space.Compact>
            {installVersionMetadata && (
              <Space className={styles.installVersionActions} wrap>
                <Tag color="green">{t('npm.stableCount', { count: installVersionMetadata.stable.length })}</Tag>
                <Tag color="gold">{t('npm.prereleaseCount', { count: installVersionMetadata.prerelease.length })}</Tag>
                <Tag>{t('npm.filterShowing', {
                  filter: versionFilterLabel(t, installVersionFilter),
                  count: Math.min(versionsForFilter(installVersionMetadata, installVersionFilter).length, installVersionPage * VERSION_PAGE_SIZE)
                })}</Tag>
              </Space>
            )}
          </Form.Item>
          <Form.Item name="dev" label={t('npm.asDevDependency')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('npm.switchDepType')}
        open={moveDepVisible}
        onCancel={() => setMoveDepVisible(false)}
        onOk={() => moveDepForm.submit()}
        okText={t('npm.switch')}
        cancelText={t('common.cancel')}
      forceRender
      >
        <Form form={moveDepForm} onFinish={handleMoveDep} layout="vertical">
          <Form.Item name="packageName" label={t('package.columnName')}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="from" label={t('npm.currentType')}>
            <Select disabled>
              <Select.Option value="dependencies">{t('package.prodDependency')}</Select.Option>
              <Select.Option value="devDependencies">{t('package.devDependency')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="to" label={t('npm.targetType')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="dependencies">{t('package.prodDependency')}</Select.Option>
              <Select.Option value="devDependencies">{t('package.devDependency')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('npm.switchVersionTitle', { name: selectedPackage?.name ?? '' })}
        open={versionVisible}
        onCancel={() => setVersionVisible(false)}
        footer={null}
        width={680}
      >
        <div className={styles.versionList}>
          <p style={{ marginBottom: 12, color: 'var(--text-secondary, #999)' }}>
            {t('package.currentVersionLabel')} <Tag color="blue">{selectedPackage?.version}</Tag>
          </p>
          <Spin spinning={versions.length === 0 && !versionMetadata}>
            <NpmVersionPicker
              stable={versionMetadata?.stable || []}
              prerelease={versionMetadata?.prerelease || []}
              currentVersion={selectedPackage?.version}
              latestVersion={versionMetadata?.latest || selectedPackage?.latest}
              stablePage={stableVersionPage}
              prereleasePage={prereleaseVersionPage}
              onStablePageChange={setStableVersionPage}
              onPrereleasePageChange={setPrereleaseVersionPage}
              onSelect={handleInstallVersion}
            />
          </Spin>
        </div>
      </Modal>
      
      <Modal
        title={`执行: npm run ${outputScript}`}
        open={scriptOutputVisible}
        onCancel={() => setScriptOutputVisible(false)}
        footer={null}
        width={700}
      >
        <pre className={styles.scriptOutput}>{scriptOutput}</pre>
      </Modal>
      
      <PackageDetailModal
        visible={detailVisible}
        packageName={detailPackage}
        onClose={() => setDetailVisible(false)}
        onInstall={handleInstallFromDetail}
      />
      
      <SecurityAuditModal
        visible={auditVisible}
        projectPath={currentPath}
        onClose={() => setAuditVisible(false)}
      />
      
      <DependencyTreeModal
        visible={depTreeVisible}
        type="project"
        projectPath={currentPath}
        onClose={() => setDepTreeVisible(false)}
      />

      <DependencyHealthModal
        visible={healthVisible}
        manager="npm"
        cwd={currentPath}
        onClose={() => setHealthVisible(false)}
      />
      
      <BatchVersionPreviewModal
        visible={previewVisible}
        packages={pendingUpdates}
        onConfirm={executeUpdate}
        onCancel={() => setPreviewVisible(false)}
      />
    </div>
  )
}

export default ProjectPage

function uniqueByName(packages: any[]): any[] {
  const seen = new Set<string>()
  return packages.filter((pkg) => {
    const key = String(pkg.name || '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildInstallVersionOptions(metadata: NpmVersionMetadata, filter: VersionChannelFilter, page: number) {
  const versions = versionsForFilter(metadata, filter)
  return toVersionOptions(versions, page)
}

function buildPackageOptions(packages: any[], downloads: Record<string, number>, t: LabelTranslator) {
  return packages.map((pkg: any) => ({
    value: pkg.name,
    label: renderPackageOption(t, pkg, downloads[pkg.name] || pkg.downloads || 0)
  }))
}

async function loadSearchDownloads(packages: any[]): Promise<Record<string, number>> {
  const entries = await Promise.all(packages.map(async (pkg) => {
    if (pkg.downloads) return [pkg.name, pkg.downloads] as const
    try {
      const stats = await window.electronAPI.npm.downloadStats(pkg.name)
      return [pkg.name, stats.downloads || 0] as const
    } catch {
      return [pkg.name, 0] as const
    }
  }))
  return Object.fromEntries(entries)
}

function renderPackageOption(t: LabelTranslator, pkg: any, downloads: number): React.ReactNode {
  return (
    <div className={styles.packageOption}>
      <Space size={6} className={styles.packageOptionHeader}>
        <span className={styles.packageOptionName}>{pkg.name}</span>
        {pkg.version && <Tag>{pkg.version}</Tag>}
        {downloads > 0 && (
          <Tag icon={<CloudDownloadOutlined />}>{formatCompactNumber(downloads)}</Tag>
        )}
      </Space>
      <span className={styles.packageOptionDesc}>{cleanPackageSummary(pkg.description) || t('common.noDescription')}</span>
    </div>
  )
}

function versionFilterLabel(t: LabelTranslator, filter: VersionChannelFilter): string {
  if (filter === 'stable') return t('npm.stable')
  if (filter === 'prerelease') return t('npm.prerelease')
  return t('npm.allVersions')
}

function isNearPopupBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 48
}

function renderPagedPopup(t: LabelTranslator, menu: React.ReactElement, hasMore: boolean, loading: boolean, pageSize: number): React.ReactElement {
  return (
    <>
      {menu}
      {(hasMore || loading) && (
        <div className={styles.loadMoreOption}>
          {loading ? t('npm.loadingMore') : t('npm.scrollHint', { count: pageSize })}
        </div>
      )}
    </>
  )
}
