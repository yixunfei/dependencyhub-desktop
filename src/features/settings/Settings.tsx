import React, { useEffect, useState } from 'react'
import { Descriptions, Button, Input, Divider, Alert, Tabs, Modal, Form, Tag, Spin, Table, Space, Tooltip, Select, Radio, AutoComplete } from 'antd'
import {
  UserOutlined, SettingOutlined, 
  DeleteOutlined, SyncOutlined, FolderOpenOutlined,
  EditOutlined, QuestionCircleOutlined,
  CloudServerOutlined, InfoCircleOutlined,
  LoginOutlined, SafetyCertificateOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { AppLanguage, useSettingsStore } from '../../stores/settingsStore'
import GlobalToolchainPanel from '../../components/Toolchain/GlobalToolchainPanel'
import { useT } from '../../i18n'
import { localizedMessage as message } from '../../utils/localizedFeedback'
import styles from './Settings.module.css'

const SettingsPage: React.FC = () => {
  const [npmConfig, setNpmConfig] = useState<any>({})
  const [currentUser, setCurrentUser] = useState<string>('')
  const [registry, setRegistry] = useState<string>('')
  const [npmInfo, setNpmInfo] = useState<any>({})
  const [cachePath, setCachePath] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [configEditVisible, setConfigEditVisible] = useState(false)
  const [configForm] = Form.useForm()
  const [publishedPackages, setPublishedPackages] = useState<any[]>([])
  const [helpContent, setHelpContent] = useState<string>('')
  const [helpVisible, setHelpVisible] = useState(false)
  const [loginVisible, setLoginVisible] = useState(false)
  const [credentials, setCredentials] = useState<CredentialMetadata[]>([])
  const [credentialStatus, setCredentialStatus] = useState<CredentialVaultStatus | null>(null)
  const [loginForm] = Form.useForm()
  const t = useT()
  const language = useSettingsStore((state) => state.language)
  const updateStrategy = useSettingsStore((state) => state.updateStrategy)
  const conflictStrategy = useSettingsStore((state) => state.conflictStrategy)
  const securitySensitivity = useSettingsStore((state) => state.securitySensitivity)
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  const setUpdateStrategy = useSettingsStore((state) => state.setUpdateStrategy)
  const setConflictStrategy = useSettingsStore((state) => state.setConflictStrategy)
  const setSecuritySensitivity = useSettingsStore((state) => state.setSecuritySensitivity)
  
  const addNotification = useAppStore((state) => state.addNotification)
  const configKeyOptions = [
    { value: 'registry', label: 'registry（npm 镜像源）' },
    { value: 'cache', label: 'cache（缓存目录）' },
    { value: 'prefix', label: 'prefix（全局前缀）' },
    { value: 'userconfig', label: 'userconfig（用户配置文件）' },
    { value: 'init-version', label: 'init-version（初始化版本）' },
    { value: 'init-license', label: 'init-license（初始化许可证）' },
    { value: 'audit-level', label: 'audit-level（审计级别）' }
  ]
  const configValueOptions = [
    { value: 'https://registry.npmjs.org/', label: 'npm 官方' },
    { value: 'https://registry.npmmirror.com', label: 'npmmirror' },
    { value: 'https://registry.yarnpkg.com', label: 'Yarn' },
    { value: 'public', label: 'public' },
    { value: 'restricted', label: 'restricted' }
  ]
  
  useEffect(() => {
    loadConfig()
    loadNpmInfo()
    loadCachePath()
    loadCredentials()
  }, [])

  const loadCredentials = async () => {
    try {
      const [items, status] = await Promise.all([
        window.electronAPI.credentials.list(),
        window.electronAPI.credentials.status()
      ])
      setCredentials(items)
      setCredentialStatus(status)
    } catch {
      setCredentials([])
      setCredentialStatus(null)
    }
  }
  
  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.npm.configList()
      setNpmConfig(config)
      setRegistry(config.registry || 'https://registry.npmjs.org/')
      
      const user = await window.electronAPI.npm.whoami()
      setCurrentUser(user)
      
      if (user) {
        const packages = await window.electronAPI.npm.getPublished(user)
        setPublishedPackages(packages)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
      addNotification({
        type: 'error',
        message: '配置加载失败',
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }
  
  const loadNpmInfo = async () => {
    try {
      const info = await window.electronAPI.system.getNpmInfo()
      setNpmInfo(info)
    } catch (error) {
      console.error('Failed to load npm info:', error)
    }
  }
  
  const loadCachePath = async () => {
    try {
      const path = await window.electronAPI.system.getCachePath()
      setCachePath(path)
    } catch (error) {
      console.error('Failed to load cache path:', error)
    }
  }
  
  const handleSetRegistry = async () => {
    if (!registry.trim()) {
      message.warning(t('settings.enterRegistryUrl'))
      return
    }

    setLoading(true)
    try {
      await window.electronAPI.npm.configSet('registry', registry)
      addNotification({
        type: 'success',
        message: t('settings.settingsSaved'),
        description: t('settings.registrySetTo', { registry })
      })
      await loadConfig()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('settings.settingsFailed'),
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleLogin = async () => {
    setLoginVisible(true)
    loginForm.resetFields()
  }
  
  const handleLoginSubmit = async (values: any) => {
    setLoading(true)
    try {
      const registryKey = getRegistryAuthTokenKey(values.registry || registry)
      if (values.authType === 'token') {
        await window.electronAPI.credentials.save({
          managerId: 'npm',
          service: values.registry || registry || 'https://registry.npmjs.org/',
          account: registryKey,
          label: `npm ${values.registry || registry || 'registry.npmjs.org'}`,
          kind: 'token',
          secret: values.token,
          url: values.registry || registry
        })
        await loadCredentials()
      } else if (values.authType === 'legacy') {
        await window.electronAPI.npm.adduser(values.registry || undefined)
      } else {
        await window.electronAPI.npm.login(values.registry || undefined)
      }
      addNotification({
        type: 'success',
        message: '登录成功'
      })
      setLoginVisible(false)
      await loadConfig()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '登录失败',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const getRegistryAuthTokenKey = (registryUrl: string) => {
    try {
      // Users often omit the scheme (registry.npmmirror.com); without it the
      // token would silently land on the npmjs fallback key and never apply.
      const normalized = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(registryUrl)
        ? registryUrl
        : `https://${registryUrl}`
      const url = new URL(normalized)
      const path = url.pathname.replace(/\/$/, '')
      return `//${url.host}${path ? `${path}` : ''}/:_authToken`
    } catch {
      return '//registry.npmjs.org/:_authToken'
    }
  }
  
  const handleLogout = async () => {
    setLoading(true)
    try {
      await window.electronAPI.npm.logout(registry !== 'https://registry.npmjs.org/' ? registry : undefined)
      setCurrentUser('')
      setPublishedPackages([])
      addNotification({
        type: 'success',
        message: '登出成功'
      })
      await loadConfig()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '登出失败',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleClearCache = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.system.clearCache()
      addNotification({
        type: 'success',
        message: '缓存清理成功',
        description: result
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '缓存清理失败',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleUpdateNpm = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.system.updateNpm()
      addNotification({
        type: 'success',
        message: 'npm 更新成功',
        description: result
      })
      await loadNpmInfo()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: 'npm 更新失败',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleShowHelp = async (command?: string) => {
    setLoading(true)
    try {
      const content = await window.electronAPI.system.npmHelp(command)
      setHelpContent(content)
      setHelpVisible(true)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('settings.helpLoadFailed'),
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleSetCachePath = async () => {
    const newPath = await window.electronAPI.selectDirectory()
    if (newPath) {
      setLoading(true)
      try {
        await window.electronAPI.system.setCachePath(newPath)
        addNotification({
          type: 'success',
          message: '缓存目录已更改',
          description: newPath
        })
        await loadCachePath()
      } catch (error: any) {
        addNotification({
          type: 'error',
          message: '更改缓存目录失败',
          description: error.message
        })
      } finally {
        setLoading(false)
      }
    }
  }
  
  const handleConfigEdit = () => {
    setConfigEditVisible(true)
    configForm.resetFields()
  }
  
  const handleSaveConfig = async (values: any) => {
    setLoading(true)
    try {
      if (values.key && values.value) {
        await window.electronAPI.npm.configSet(values.key, values.value)
        addNotification({
          type: 'success',
          message: '配置已保存'
        })
        await loadConfig()
      }
      setConfigEditVisible(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '保存配置失败',
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleDeleteConfig = async (key: string) => {
    setLoading(true)
    try {
      await window.electronAPI.npm.configDelete(key)
      addNotification({
        type: 'success',
        message: t('settings.configDeleted')
      })
      await loadConfig()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('settings.configDeleteFailed'),
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCredential = async (id: string) => {
    setLoading(true)
    try {
      await window.electronAPI.credentials.delete(id)
      addNotification({
        type: 'success',
        message: t('settings.credentialDeleted')
      })
      await loadCredentials()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('settings.credentialDeleteFailed'),
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleOpenNpmrc = async () => {
    try {
      await window.electronAPI.npm.configEdit()
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '打开配置文件失败',
        description: error.message
      })
    }
  }
  
  const publishedColumns = [
    {
      title: t('package.columnName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: t('common.version'),
      dataIndex: 'version',
      key: 'version'
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: t('settings.columnUpdatedAt'),
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => text ? new Date(text).toLocaleDateString() : '-'
    }
  ]

  const configItems = [
    { key: 'registry', label: 'Registry' },
    { key: 'cache', label: t('settings.configItemCache') },
    { key: 'prefix', label: t('settings.configItemPrefix') },
    { key: 'userconfig', label: t('settings.configItemUserconfig') },
    { key: 'init-version', label: t('settings.configItemInitVersion') },
    { key: 'author', label: t('package.authorLabel') },
    { key: 'email', label: t('settings.configItemEmail') }
  ]
  
  const TabItems = [
    {
      key: 'preferences',
      label: t('settings.preferences'),
      icon: <SettingOutlined />,
      children: (
        <div className={styles.tabContent}>
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t('settings.language')}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Select<AppLanguage>
                  value={language}
                  onChange={(value) => setLanguage(value)}
                  style={{ width: 220 }}
                  options={[
                    { value: 'en-US', label: t('settings.languageEnglish') },
                    { value: 'zh-CN', label: t('settings.languageChinese') }
                  ]}
                />
                <span style={{ color: '#888', fontSize: 12 }}>{t('settings.languageDescription')}</span>
              </Space>
            </Descriptions.Item>
          </Descriptions>
          <Alert
            style={{ marginTop: 16 }}
            title={t('settings.savedHint')}
            type="info"
            showIcon
          />
        </div>
      )
    },
    {
      key: 'update',
      label: t('settings.updateStrategy'),
      icon: <ThunderboltOutlined />,
      children: (
        <div className={styles.tabContent}>
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 16 }}>{t('settings.updateStrategy')}</h4>
            <Radio.Group value={updateStrategy} onChange={(e) => setUpdateStrategy(e.target.value)}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Radio value="recommended">
                  <div>
                    <strong>{t('settings.strategyRecommended')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.strategyRecommendedDesc')}</div>
                  </div>
                </Radio>
                <Radio value="smart">
                  <div>
                    <strong>{t('settings.strategySmart')}</strong>
                    <Space>
                      <Tag color="green">{t('package.preferCompatibility')}</Tag>
                      <Tag color="orange">{t('settings.tagSecurityNext')}</Tag>
                    </Space>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.strategySmartDesc')}</div>
                  </div>
                </Radio>
                <Radio value="security">
                  <div>
                    <strong>{t('settings.strategySecurity')}</strong>
                    <Space>
                      <Tag color="red">{t('package.preferSecurity')}</Tag>
                      <Tag color="orange">{t('settings.tagCompatibilityRisk')}</Tag>
                    </Space>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.strategySecurityDesc')}</div>
                  </div>
                </Radio>
                <Radio value="latest">
                  <div>
                    <strong>{t('settings.strategyLatest')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.strategyLatestDesc')}</div>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </div>

          <Divider />

          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 16 }}>{t('settings.conflictStrategy')}</h4>
            <Radio.Group value={conflictStrategy} onChange={(e) => setConflictStrategy(e.target.value)}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Radio value="prompt">
                  <div>
                    <strong>{t('settings.conflictPrompt')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.conflictPromptDesc')}</div>
                  </div>
                </Radio>
                <Radio value="auto-recommended">
                  <div>
                    <strong>{t('settings.conflictAutoRecommended')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.conflictAutoRecommendedDesc')}</div>
                  </div>
                </Radio>
                <Radio value="auto-security">
                  <div>
                    <strong>{t('settings.conflictAutoSecurity')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.conflictAutoSecurityDesc')}</div>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </div>

          <Divider />

          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 16 }}>{t('settings.sensitivity')}</h4>
            <Radio.Group value={securitySensitivity} onChange={(e) => setSecuritySensitivity(e.target.value)}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Radio value="high">
                  <div>
                    <strong>{t('settings.sensitivityHigh')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.sensitivityHighDesc')}</div>
                  </div>
                </Radio>
                <Radio value="medium">
                  <div>
                    <strong>{t('settings.sensitivityMedium')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.sensitivityMediumDesc')}</div>
                  </div>
                </Radio>
                <Radio value="low">
                  <div>
                    <strong>{t('settings.sensitivityLow')}</strong>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('settings.sensitivityLowDesc')}</div>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </div>

          <Alert
            title={t('settings.tipTitle')}
            description={t('settings.autoSaveNotice')}
            type="info"
            showIcon
          />
        </div>
      )
    },
    {
      key: 'toolchain',
      label: t('toolchain.globalTitle'),
      icon: <SettingOutlined />,
      children: (
        <div className={styles.tabContent}>
          <GlobalToolchainPanel />
        </div>
      )
    },
    {
      key: 'user',
      label: t('settings.tabUserInfo'),
      icon: <UserOutlined />,
      children: (
        <div className={styles.tabContent}>
          {currentUser ? (
            <div className={styles.userInfo}>
              <Alert
                title={t('settings.loggedInAs', { user: currentUser })}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Button danger onClick={handleLogout} loading={loading}>
                {t('settings.logout')}
              </Button>

              <Divider />

              <h4 style={{ marginBottom: 12 }}>{t('settings.publishedPackages')}</h4>
              <Table
                dataSource={publishedPackages}
                columns={publishedColumns}
                rowKey="name"
                size="small"
                pagination={false}
              />
            </div>
          ) : (
            <div className={styles.loginPrompt}>
              <Alert
                title={t('settings.notLoggedIn')}
                description={t('settings.loginHint')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Button type="primary" icon={<LoginOutlined />} onClick={handleLogin}>
                {t('settings.loginNpm')}
              </Button>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'credentials',
      label: t('settings.tabCredentialVault'),
      icon: <SafetyCertificateOutlined />,
      children: (
        <div className={styles.tabContent}>
          <Alert
            type={credentialStatus?.encrypted ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
            title={credentialStatus?.encrypted ? t('settings.secureStorageEnabled') : t('settings.secureStorageUnavailable')}
            description={credentialStatus?.warning || t('settings.credentialVaultHint')}
          />
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<SyncOutlined />} onClick={loadCredentials} loading={loading}>{t('settings.refreshCredentials')}</Button>
          </Space>
          <Table
            dataSource={credentials}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: t('settings.columnEcosystem'),
                dataIndex: 'managerId',
                key: 'managerId',
                width: 100,
                render: (value: string) => <Tag>{value}</Tag>
              },
              {
                title: t('settings.columnService'),
                dataIndex: 'service',
                key: 'service',
                ellipsis: true
              },
              {
                title: t('settings.columnAccount'),
                dataIndex: 'account',
                key: 'account',
                width: 180,
                render: (value: string | undefined) => value || '-'
              },
              {
                title: t('settings.columnPreview'),
                dataIndex: 'secretPreview',
                key: 'secretPreview',
                width: 120
              },
              {
                title: t('settings.columnStorage'),
                key: 'storage',
                width: 150,
                render: (_: unknown, record: CredentialMetadata) => (
                  <Tag color={record.encrypted ? 'green' : 'orange'}>{record.storage}</Tag>
                )
              },
              {
                title: t('settings.columnUpdatedAt'),
                dataIndex: 'updatedAt',
                key: 'updatedAt',
                width: 190,
                render: (value: string) => new Date(value).toLocaleString()
              },
              {
                title: t('common.actions'),
                key: 'action',
                width: 90,
                render: (_: unknown, record: CredentialMetadata) => (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteCredential(record.id)} />
                )
              }
            ]}
          />
        </div>
      )
    },
    {
      key: 'registry',
      label: t('settings.tabRegistry'),
      icon: <CloudServerOutlined />,
      children: (
        <div className={styles.tabContent}>
          <div className={styles.registrySection}>
            <label className={styles.label}>{t('settings.currentRegistry')}</label>
            <Input
              value={registry}
              onChange={(e) => setRegistry(e.target.value)}
              placeholder="https://registry.npmjs.org/"
              className={styles.registryInput}
            />
            <Button type="primary" onClick={handleSetRegistry} loading={loading}>
              {t('settings.setRegistry')}
            </Button>
          </div>

          <Divider />

          <div className={styles.presets}>
            <h4>{t('settings.commonRegistries')}</h4>
            <div className={styles.presetButtons}>
              <Button size="small" onClick={() => setRegistry('https://registry.npmjs.org/')}>
                {t('settings.npmOfficial')}
              </Button>
              <Button size="small" onClick={() => setRegistry('https://registry.npmmirror.com')}>
                {t('settings.taobaoMirror')}
              </Button>
              <Button size="small" onClick={() => setRegistry('https://registry.yarnpkg.com')}>
                Yarn
              </Button>
              <Button size="small" onClick={() => setRegistry('https://mirror.cloudsmith.io')}>
                Cloudsmith
              </Button>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'config',
      label: t('settings.tabConfig'),
      icon: <SettingOutlined />,
      children: (
        <div className={styles.tabContent}>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<EditOutlined />} onClick={handleConfigEdit}>
              {t('settings.addConfig')}
            </Button>
            <Button icon={<FolderOpenOutlined />} onClick={handleOpenNpmrc}>
              {t('settings.openConfigFile')}
            </Button>
          </Space>

          <Table
            dataSource={configItems.filter(item => npmConfig[item.key])}
            columns={[
              {
                title: t('settings.columnConfigKey'),
                dataIndex: 'label',
                key: 'label'
              },
              {
                title: t('settings.columnValue'),
                dataIndex: 'key',
                key: 'value',
                render: (key: string) => npmConfig[key] || '-'
              },
              {
                title: t('common.actions'),
                key: 'action',
                render: (_, record: any) => (
                  <Space>
                    <Tooltip title={t('settings.edit')}>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          configForm.setFieldsValue({ key: record.key, value: npmConfig[record.key] })
                          setConfigEditVisible(true)
                        }}
                      />
                    </Tooltip>
                    <Tooltip title={t('settings.delete')}>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteConfig(record.key)}
                      />
                    </Tooltip>
                  </Space>
                )
              }
            ]}
            rowKey="key"
            size="small"
            pagination={false}
          />
        </div>
      )
    },
    {
      key: 'system',
      label: t('settings.tabSystemInfo'),
      icon: <InfoCircleOutlined />,
      children: (
        <div className={styles.tabContent}>
          {npmInfo.npmError && (
            <Alert
              title={t('settings.npmInfoLoadFailed')}
              description={npmInfo.npmError}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t('settings.npmVersion')}>{npmInfo.npmVersion || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label={t('settings.nodeVersion')}>{npmInfo.nodeVersion || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label={t('settings.electronVersion')}>{npmInfo.electronVersion || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label={t('settings.platform')}>{npmInfo.platform || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label={t('settings.arch')}>{npmInfo.arch || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label={t('settings.configItemCache')}>
              <Space>
                {cachePath}
                <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSetCachePath}>
                  {t('settings.change')}
                </Button>
              </Space>
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Space>
            <Button icon={<DeleteOutlined />} onClick={handleClearCache} loading={loading}>
              {t('settings.clearCache')}
            </Button>
            <Button icon={<SyncOutlined />} onClick={handleUpdateNpm} loading={loading}>
              {t('settings.updateNpm')}
            </Button>
          </Space>
        </div>
      )
    },
    {
      key: 'help',
      label: t('settings.tabHelp'),
      icon: <QuestionCircleOutlined />,
      children: (
        <div className={styles.tabContent}>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button onClick={() => handleShowHelp()}>{t('settings.npmHelp')}</Button>
            <Button onClick={() => handleShowHelp('install')}>{t('settings.npmHelpInstall')}</Button>
            <Button onClick={() => handleShowHelp('publish')}>{t('settings.npmHelpPublish')}</Button>
            <Button onClick={() => handleShowHelp('config')}>{t('settings.npmHelpConfig')}</Button>
            <Button onClick={() => handleShowHelp('run-script')}>{t('settings.npmHelpRunScript')}</Button>
            <Button onClick={() => handleShowHelp('update')}>{t('settings.npmHelpUpdate')}</Button>
          </Space>
        </div>
      )
    }
  ]
  
  return (
    <Spin spinning={loading}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('app.settings')}</h2>
        </div>
        
        <div className={styles.content}>
          <Tabs items={TabItems} />
        </div>
        
        <Modal
          title={t('settings.addOrEditConfig')}
          open={configEditVisible}
          onCancel={() => setConfigEditVisible(false)}
          onOk={() => configForm.submit()}
        forceRender
        >
          <Form form={configForm} onFinish={handleSaveConfig} layout="vertical">
            <Form.Item name="key" label={t('settings.columnConfigKey')} rules={[{ required: true }]}>
              <AutoComplete options={configKeyOptions} placeholder={t('settings.configKeyPlaceholder')} />
            </Form.Item>
            <Form.Item name="value" label={t('settings.columnValue')} rules={[{ required: true }]}>
              <AutoComplete options={configValueOptions} placeholder={t('settings.configValuePlaceholder')} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={t('settings.npmLoginTitle')}
          open={loginVisible}
          onCancel={() => setLoginVisible(false)}
          onOk={() => loginForm.submit()}
        forceRender
        >
          <Form form={loginForm} onFinish={handleLoginSubmit} layout="vertical" initialValues={{ authType: 'interactive' }}>
            <Form.Item name="authType" label={t('settings.authMethod')} rules={[{ required: true }]}>
              <Select>
                <Select.Option value="interactive">
                  <Space><SafetyCertificateOutlined /> {t('settings.authInteractive')}</Space>
                </Select.Option>
                <Select.Option value="token">
                  <Space><LoginOutlined /> {t('settings.authToken')}</Space>
                </Select.Option>
                <Select.Option value="legacy">
                  <Space><UserOutlined /> {t('settings.authLegacy')}</Space>
                </Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="registry" label={t('settings.registryOptional')}>
              <Input placeholder={t('settings.customRegistryPlaceholder')} />
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.authType !== cur.authType}
            >
              {({ getFieldValue }) => {
                const authType = getFieldValue('authType')
                if (authType === 'token') {
                  return (
                    <Form.Item name="token" label={t('settings.accessToken')} rules={[{ required: true }]}>
                      <Input.Password placeholder={t('settings.tokenPlaceholder')} />
                    </Form.Item>
                  )
                }
                return null
              }}
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={t('settings.npmHelp')}
          open={helpVisible}
          onCancel={() => setHelpVisible(false)}
          footer={null}
          width={700}
        >
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{helpContent}</pre>
        </Modal>
      </div>
    </Spin>
  )
}

export default SettingsPage
