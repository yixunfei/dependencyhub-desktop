import React, { useEffect, useState } from 'react'
import { AutoComplete, Button, Descriptions, Empty, Spin, Modal, Form, Select, Tag, Dropdown, Space, Tooltip, Table } from 'antd'
import { ReloadOutlined, PlusOutlined, SwapOutlined, FolderFilled, SyncOutlined, CheckCircleOutlined, WarningOutlined, HistoryOutlined, ApartmentOutlined, InfoCircleOutlined, SecurityScanOutlined, FolderOpenOutlined, CloudDownloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../../../stores/appStore'
import { usePackageStore, PackageInfo } from '../../../../../stores/packageStore'
import { resolvePackageUpdateTarget, resolveSmartPackageUpdateTarget, useSettingsStore } from '../../../../../stores/settingsStore'
import { DependencyTreeModal } from '../../../../../components/Package/DependencyTreeModal'
import { PackageDetailModal } from '../../../../../components/Package/PackageDetailModal'
import { BatchVersionPreviewModal } from '../../../../../components/Package/BatchVersionPreviewModal'
import { SecurityAuditModal } from '../../../../../components/Package/SecurityAuditModal'
import { NpmVersionPicker } from '../../../../../components/Package/NpmVersionPicker'
import { localizedModal } from '../../../../../utils/localizedFeedback'
import { useT, type LabelTranslator } from '../../../../../i18n'
import { VERSION_PAGE_SIZE, VersionChannelFilter, toVersionOptions, versionsForFilter } from '../../../../../utils/npmVersions'
import { cleanPackageSummary, formatCompactNumber } from '../../../../../utils/npmDisplay'
import { pagedPagination } from '../../../../../utils/tablePagination'
import styles from './Global.module.css'

const SEARCH_PAGE_SIZE = 10

// Monotonic request id for the "switch version" dialog: opening A then B must
// not let A's slower reply populate B's version list.
let versionDialogRequestId = 0

// Monotonic request id so a stale paged-search response cannot overwrite a
// newer one when the user types quickly in the install autocomplete.
let packageOptionsRequestId = 0

// Install-modal version loads: a stale reply for a replaced package name must
// not auto-fill the wrong version into the form.
let installVersionsRequestId = 0

const GlobalPage: React.FC = () => {
  const [installVisible, setInstallVisible] = useState(false)
  const [versionVisible, setVersionVisible] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(null)
  const [versions, setVersions] = useState<string[]>([])
  const [versionMetadata, setVersionMetadata] = useState<NpmVersionMetadata | null>(null)
  const [stableVersionPage, setStableVersionPage] = useState(1)
  const [prereleaseVersionPage, setPrereleaseVersionPage] = useState(1)
  const [installForm] = Form.useForm()
  const [checkingAll, setCheckingAll] = useState(false)
  const [depTreeVisible, setDepTreeVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailPackage, setDetailPackage] = useState<string>('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [updatingSelected, setUpdatingSelected] = useState(false)
  const [uninstallingSelected, setUninstallingSelected] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<PackageInfo[]>([])
  const [auditVisible, setAuditVisible] = useState(false)
  const [packageOptions, setPackageOptions] = useState<Array<{ value: string; label: React.ReactNode }>>([])
  const [packageSearchQuery, setPackageSearchQuery] = useState('')
  const [packageSearchPage, setPackageSearchPage] = useState(1)
  const [packageSearchHasMore, setPackageSearchHasMore] = useState(false)
  const [packageSearchLoadingMore, setPackageSearchLoadingMore] = useState(false)
  const [installVersionOptions, setInstallVersionOptions] = useState<Array<{ value: string; label: React.ReactNode }>>([])
  const [installVersionMetadata, setInstallVersionMetadata] = useState<NpmVersionMetadata | null>(null)
  const [installVersionFilter, setInstallVersionFilter] = useState<VersionChannelFilter>('stable')
  const [installVersionPage, setInstallVersionPage] = useState(1)
  const [globalPrefix, setGlobalPrefix] = useState('')
  const [cachePath, setCachePath] = useState('')
  
  const addNotification = useAppStore((state) => state.addNotification)
  const t = useT()
  const updateStrategy = useSettingsStore((state) => state.updateStrategy)
  const conflictStrategy = useSettingsStore((state) => state.conflictStrategy)
  const globalPackages = usePackageStore((state) => state.globalPackages)
  const globalLoading = usePackageStore((state) => state.globalLoading)
  const mutating = usePackageStore((state) => state.mutating)
  const fetchGlobalPackages = usePackageStore((state) => state.fetchGlobalPackages)
  const installPackage = usePackageStore((state) => state.installPackage)
  const uninstallPackage = usePackageStore((state) => state.uninstallPackage)
  const installSpecificVersion = usePackageStore((state) => state.installSpecificVersion)
  
  useEffect(() => {
    // fetchGlobalPackages rethrows on failure; without this catch the mount
    // would leave an unhandled rejection and render "no global dependencies".
    fetchGlobalPackages().catch((error: any) => {
      addNotification({
        type: 'error',
        message: t('npm.refreshFailed'),
        description: error?.message
      })
    })
    void loadGlobalMeta()
  }, [])

  const loadGlobalMeta = async () => {
    try {
      const [prefix, cache] = await Promise.all([
        window.electronAPI.npm.configGet('prefix'),
        window.electronAPI.system.getCachePath()
      ])
      setGlobalPrefix(prefix)
      setCachePath(cache)
    } catch {
      setGlobalPrefix('')
      setCachePath('')
    }
  }
  
  const handleRefresh = async () => {
    try {
      await fetchGlobalPackages()
      await loadGlobalMeta()
    } catch (error: any) {
      // fetchGlobalPackages rethrows on failure; surface it instead of a false success.
      addNotification({
        type: 'error',
        message: t('npm.refreshFailed'),
        description: error.message
      })
      return
    }
    addNotification({
      type: 'success',
      message: t('npm.refreshSucceeded')
    })
  }

  const handleCheckAllOutdated = async () => {
    setCheckingAll(true)
    try {
      // Bypass the 5-minute cache: this entry must show fresh outdated info.
      await fetchGlobalPackages(true)
      addNotification({
        type: 'success',
        message: t('npm.checkComplete')
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('npm.checkFailed'),
        description: error.message
      })
    } finally {
      setCheckingAll(false)
    }
  }
   
  const handleUninstall = async (packageName: string) => {
    try {
      await uninstallPackage({
        packageName,
        global: true
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
        global: true,
        version: values.version
      })
      addNotification({
        type: 'success',
        message: '安装成功',
        description: `${values.package} 已成功安装到全局`
      })
      setInstallVisible(false)
      installForm.resetFields()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '安装失败',
        description: error.message
      })
    }
  }

  const searchInstallPackages = async (query: string) => {
    if (!query.trim()) {
      // Invalidate in-flight searches so stale replies cannot repopulate the
      // cleared suggestion list.
      packageOptionsRequestId += 1
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
        message: '获取版本列表失败',
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
        global: true
      })
      addNotification({
        type: 'success',
        message: '版本切换成功',
        description: `${selectedPackage.name}@${version} 已安装`
      })
      setVersionVisible(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '版本切换失败',
        description: error.message
      })
    }
  }
  
  const handleOpenPackagePath = async (packageName: string) => {
    try {
      const path = `${globalPrefix || await window.electronAPI.npm.configGet('prefix')}/node_modules/${packageName}`
      await window.electronAPI.system.openPath(path)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('npm.openPathFailed'),
        description: error.message
      })
    }
  }
  
  const handleUpdate = async (packageName: string) => {
    const pkg = globalPackages.find(p => p.name === packageName)
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
            global: true,
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
      await fetchGlobalPackages(true)
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

  const handleUpdateSelected = async () => {
    if (selectedRowKeys.length === 0) {
      addNotification({
        type: 'warning',
        message: '请先选择要更新的包'
      })
      return
    }

    const packagesToUpdate = globalPackages.filter(pkg => 
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

  const handleUpdateAll = async () => {
    const outdatedPackages = globalPackages.filter(pkg => pkg.outdated)
    
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
                global: true
              })
              successCount++
            } catch {
              failCount++
            }
          }

          addNotification({
            type: successCount > 0 ? 'success' : 'error',
            message: t('npm.batchUninstallComplete'),
            description: t('npm.batchResult', { succeeded: successCount, failed: failCount })
          })

          setSelectedRowKeys([])
          await fetchGlobalPackages(true)
        } catch (error: any) {
          addNotification({
            type: 'error',
            message: t('npm.batchUninstallFailed'),
            description: error.message
          })
        } finally {
          setUninstallingSelected(false)
        }
      }
    })
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
      width: 200,
      render: (text: string, record: PackageInfo) => (
        <Space>
          <span className={styles.pkgName}>{text}</span>
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
      title: t('common.currentVersion'),
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (text: string) => <Tag>v{text}</Tag>
    },
    {
      title: t('npm.columnLatestVersion'),
      dataIndex: 'latest',
      key: 'latest',
      width: 120,
      render: (text: string, record: PackageInfo) =>
        text ? (
          <Space>
            <Tag color={text !== record.version ? 'blue' : 'green'}>
              v{text}
            </Tag>
            {text !== record.version && (
              <Tooltip title={t('npm.viewChangelog')}>
                <Button
                  size="small"
                  type="link"
                  icon={<HistoryOutlined />}
                  onClick={() => handleViewChangelog(record.name)}
                />
              </Tooltip>
            )}
          </Space>
        ) : '-'
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 150,
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
              { key: 'open', label: t('npm.openFilePath'), icon: <FolderFilled /> },
              { key: 'changelog', label: t('npm.viewChangelog'), icon: <HistoryOutlined /> },
              { key: 'uninstall', label: t('package.uninstall'), icon: <ReloadOutlined />, danger: true }
            ],
            onClick: ({ key }) => {
              if (key === 'detail') {
                setDetailPackage(record.name)
                setDetailVisible(true)
              } else if (key === 'version') {
                handleShowVersions(record)
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
        <h2 className={styles.title}>{t('npm.globalDependenciesTitle')}</h2>
        <div className={styles.actions}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setInstallVisible(true)}>
            {t('npm.installGlobalPackage')}
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={handleCheckAllOutdated} loading={checkingAll}>
            {t('npm.checkUpdates')}
          </Button>
          <Button
            icon={<SyncOutlined />}
            onClick={handleUpdateSelected}
            loading={updatingSelected}
            disabled={selectedRowKeys.length === 0}
            type={selectedRowKeys.length > 0 ? 'primary' : 'default'}
          >
            {t('package.updateSelected', { count: selectedRowKeys.length })}
          </Button>
          <Button
            danger
            icon={<ReloadOutlined />}
            onClick={handleUninstallSelected}
            loading={uninstallingSelected}
            disabled={selectedRowKeys.length === 0}
          >
            {t('npm.uninstallSelected', { count: selectedRowKeys.length })}
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleUpdateAll}>
            {t('common.updateAll')}
          </Button>
          <Button
            icon={<ApartmentOutlined />}
            onClick={() => setDepTreeVisible(true)}
          >
            {t('npm.dependencyTree')}
          </Button>
          <Button icon={<SecurityScanOutlined />} onClick={() => setAuditVisible(true)}>
            {t('common.securityAudit')}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={globalLoading}>
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('npm.globalPrefix')}>
          <Space>
            <span>{globalPrefix || '-'}</span>
            {globalPrefix && (
              <Button size="small" icon={<FolderOpenOutlined />} onClick={() => window.electronAPI.system.openPath(globalPrefix)}>
                {t('common.open')}
              </Button>
            )}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label={t('npm.cachePath')}>
          <Space>
            <span>{cachePath || '-'}</span>
            {cachePath && (
              <Button size="small" icon={<FolderOpenOutlined />} onClick={() => window.electronAPI.system.openPath(cachePath)}>
                {t('common.open')}
              </Button>
            )}
          </Space>
        </Descriptions.Item>
      </Descriptions>

      <div className={styles.content}>
        <Spin spinning={globalLoading}>
          {globalPackages.length === 0 ? (
            <Empty description={t('npm.noGlobalDependencies')} />
          ) : (
            <Table
              dataSource={globalPackages}
              columns={columns}
              rowKey="name"
              size="small"
              pagination={pagedPagination(globalPackages, t)}
              rowSelection={rowSelection}
            />
          )}
        </Spin>
      </div>

      <Modal
        title={t('npm.installGlobalPackage')}
        open={installVisible}
        onCancel={() => setInstallVisible(false)}
        onOk={() => installForm.submit()}
        okText={t('npm.install')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: mutating || globalLoading }}
      forceRender
      >
        <Form form={installForm} onFinish={handleInstall} layout="vertical">
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
              placeholder={t('npm.exampleTypescript')}
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
          <p style={{ marginBottom: 12, color: '#999' }}>
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
      
      <DependencyTreeModal
        visible={depTreeVisible}
        type="global"
        onClose={() => setDepTreeVisible(false)}
      />
      
      <PackageDetailModal
        visible={detailVisible}
        packageName={detailPackage}
        onClose={() => setDetailVisible(false)}
      />
      
      <BatchVersionPreviewModal
        visible={previewVisible}
        packages={pendingUpdates}
        onConfirm={executeUpdate}
        onCancel={() => setPreviewVisible(false)}
      />

      <SecurityAuditModal
        visible={auditVisible}
        scope="global"
        onClose={() => setAuditVisible(false)}
      />
    </div>
  )
}

export default GlobalPage

function uniqueByName(packages: PackageInfo[]): PackageInfo[] {
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

// Search results optionally carry download stats that stored PackageInfo lacks.
type SearchPackage = PackageInfo & { downloads?: number }

function buildPackageOptions(packages: SearchPackage[], downloads: Record<string, number>, t: LabelTranslator) {
  return packages.map((pkg) => ({
    value: pkg.name,
    label: renderPackageOption(t, pkg, downloads[pkg.name] || pkg.downloads || 0)
  }))
}

async function loadSearchDownloads(packages: SearchPackage[]): Promise<Record<string, number>> {
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
