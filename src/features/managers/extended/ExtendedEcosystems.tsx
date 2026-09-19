import { managerCommands } from './managerCommands'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Form, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { CodeOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import ProjectPathBar from '../../../components/ProjectPathBar/ProjectPathBar'
import { useAppStore } from '../../../stores/appStore'
import { getManagerDefinition, getPlannedManagerDefinitions, type DependencyManagerId } from '../../../domain/managers/registry'
import { implementationStatusText, managerColor, managerIcon } from '../../../domain/managers/presentation'
import { useT, type TranslationKey } from '../../../i18n'
import type {
  ManagerBackup,
  ManagerDependency,
  ManagerDetection,
  ManagerOperation,
  ManagerOperationPlan
} from '@shared/managerWorkspace'
import styles from './ExtendedEcosystems.module.css'
import { ManagerWorkspaceCoordinator } from './managerWorkspaceCoordinator'

const { Paragraph, Text, Title } = Typography

type OperationFormValues = {
  operation: ManagerOperation
  packageName?: string
  version?: string
  dev?: boolean
}

// Module scope cannot call useT(), so the label stays a key and is resolved at render.
const OPERATION_OPTIONS: Array<{ value: ManagerOperation; labelKey: TranslationKey }> = [
  { value: 'sync', labelKey: 'extended.opSync' },
  { value: 'install', labelKey: 'common.addDependency' },
  { value: 'remove', labelKey: 'extended.opRemove' },
  { value: 'update', labelKey: 'extended.opUpdate' },
  { value: 'outdated', labelKey: 'extended.opOutdated' },
  { value: 'audit', labelKey: 'extended.opAudit' },
  { value: 'tree', labelKey: 'package.tabDependencyTree' },
  { value: 'list', labelKey: 'extended.opList' },
  { value: 'lock', labelKey: 'extended.opLock' }
]

const COMMAND_SUGGESTIONS: Partial<Record<DependencyManagerId, string[]>> = {
  pnpm: ['install', 'outdated', 'audit'],
  yarn: ['install', 'outdated', 'audit'],
  bun: ['install', 'outdated'],
  deno: ['info', 'task'],
  uv: ['sync', 'tree'],
  poetry: ['install', 'show --tree', 'check'],
  pipenv: ['install', 'graph', 'check'],
  conda: ['env export', 'list'],
  nuget: ['list package', 'restore'],
  composer: ['install', 'outdated', 'audit'],
  bundler: ['install', 'outdated', 'audit'],
  swiftpm: ['package show-dependencies', 'package update'],
  cocoapods: ['install', 'outdated'],
  helm: ['dependency list', 'dependency update'],
  docker: ['compose config', 'image ls']
}

const ExtendedEcosystemsPage: React.FC = () => {
  const t = useT()
  const currentPath = useAppStore((state) => state.currentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const managers = useMemo(() => getPlannedManagerDefinitions(), [])
  const [detections, setDetections] = useState<ManagerDetection[]>([])
  const [activeManager, setActiveManager] = useState<DependencyManagerId>(managers[0]?.id || 'pnpm')
  const [dependencies, setDependencies] = useState<ManagerDependency[]>([])
  // Split loading flags: the two loads run concurrently and finish at different
  // times, so one shared flag would clear while the other request is still in flight.
  const [detectionsLoading, setDetectionsLoading] = useState(false)
  const [dependenciesLoading, setDependenciesLoading] = useState(false)
  const loading = detectionsLoading || dependenciesLoading
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [commandOutput, setCommandOutput] = useState('')
  const [lastBackup, setLastBackup] = useState<ManagerBackup | null>(null)
  // Project path the backup was produced in; restore must not run it in another project.
  const lastBackupPathRef = useRef('')
  const [operationPlan, setOperationPlan] = useState<ManagerOperationPlan | null>(null)
  const [commandForm] = Form.useForm<{ commandLine: string }>()
  const [operationForm] = Form.useForm<OperationFormValues>()
  // Detections and dependencies load concurrently and must not discard each other's responses.
  const detectionsCoordinator = React.useMemo(() => new ManagerWorkspaceCoordinator(), [])
  const dependenciesCoordinator = React.useMemo(() => new ManagerWorkspaceCoordinator(), [])

  const activeDefinition = getManagerDefinition(activeManager)
  const detectedMap = useMemo(() => new Map(detections.map((item) => [item.id, item])), [detections])
  const activeDetection = detectedMap.get(activeManager)
  const detectedManagers = useMemo(() => detections.filter((item) => item.detected), [detections])
  const operationOptions = useMemo(
    () => OPERATION_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t]
  )

  useEffect(() => {
    lastBackupPathRef.current = ''
    setLastBackup(null)
    void loadDetections()
  }, [currentPath])

  useEffect(() => {
    lastBackupPathRef.current = ''
    setLastBackup(null)
    if (!currentPath) {
      dependenciesCoordinator.invalidate()
      setDependencies([])
      setOperationPlan(null)
      return
    }
    dependenciesCoordinator.invalidate()
    void loadDependencies(activeManager)
    setOperationPlan(null)
  }, [activeManager, currentPath])

  const loadDetections = async () => {
    const path = currentPath
    const token = detectionsCoordinator.begin({ projectPath: path })
    if (!currentPath) {
      setDetections([])
      setDependencies([])
      return
    }

    setDetectionsLoading(true)
    try {
      const result = await window.electronAPI.managers.detected(path)
      if (detectionsCoordinator.accepts(token, { projectPath: path })) {
        setDetections(result)
        const firstDetected = result.find((item) => item.detected)
        if (firstDetected) {
          setActiveManager(firstDetected.id)
        }
      }
    } catch (error: any) {
      if (detectionsCoordinator.accepts(token, { projectPath: path })) {
        addNotification({
          type: 'error',
          message: t('extended.detectFailed'),
          description: error.message
        })
      }
    } finally {
      if (detectionsCoordinator.accepts(token, { projectPath: path })) setDetectionsLoading(false)
    }
  }

  const loadDependencies = async (managerId = activeManager) => {
    if (!currentPath) return
    const path = currentPath
    const token = dependenciesCoordinator.begin({ projectPath: path, managerId })
    setDependenciesLoading(true)
    try {
      const inventory = await window.electronAPI.managers.inventory(path, managerId)
      if (!dependenciesCoordinator.accepts(token, { projectPath: path, managerId })) return
      setDependencies(inventory)
    } catch (error: any) {
      if (dependenciesCoordinator.accepts(token, { projectPath: path, managerId })) {
        addNotification({
          type: 'error',
          message: t('extended.inventoryFailed'),
          description: error.message
        })
        setDependencies([])
      }
    } finally {
      if (dependenciesCoordinator.accepts(token, { projectPath: path, managerId })) setDependenciesLoading(false)
    }
  }

  // A backup is only valid inside the project it was produced in; recording the
  // path together with the backup keeps restore from crossing projects.
  const recordBackup = (backup: ManagerBackup) => {
    lastBackupPathRef.current = currentPath
    setLastBackup(backup)
  }

  const executeCommand = async (commandLine: string) => {
    if (!currentPath || !commandLine.trim()) return
    setRunning(true)
    setCommandOutput(t('common.running'))
    try {
      const result = await managerCommands.runCustom(currentPath, activeManager, commandLine)
      if (result.backup) {
        recordBackup(result.backup)
      }
      const backupOutput = result.backup
        ? `\n\n[backup] ${result.backup.files.length} files saved to ${result.backup.path}`
        : ''
      setCommandOutput(`$ ${result.command}\n\n${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}${backupOutput}`)
      addNotification({ type: 'success', message: t('extended.commandSucceeded'), description: result.command })
      await loadDependencies(activeManager)
    } catch (error: any) {
      setCommandOutput(error.message || String(error))
      addNotification({ type: 'error', message: t('extended.commandFailed'), description: error.message })
    } finally {
      setRunning(false)
    }
  }

  const runCommand = async (values: { commandLine: string }) => {
    await executeCommand(values.commandLine)
  }

  const generateOperationPlan = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
      return
    }

    const values = operationForm.getFieldsValue()
    setPlanning(true)
    try {
      const plan = await window.electronAPI.managers.plan(currentPath, activeManager, {
        operation: values.operation || 'sync',
        packageName: values.packageName,
        version: values.version,
        dev: values.dev
      })
      setOperationPlan(plan)
      if (plan.requirements.length > 0) {
        addNotification({
          type: 'warning',
          message: t('extended.planNeedsInfo'),
          description: plan.requirements.join(t('common.detailSeparator'))
        })
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('extended.planFailed'),
        description: error.message
      })
    } finally {
      setPlanning(false)
    }
  }

  const executeOperationPlan = async (dryRun = false) => {
    if (!operationPlan) return
    if (operationPlan.requirements.length > 0) {
      addNotification({
        type: 'warning',
        message: t('extended.planNotRunnable'),
        description: operationPlan.requirements.join(t('common.detailSeparator'))
      })
      return
    }

    if (dryRun && !operationPlan.dryRunSupported) {
      addNotification({
        type: 'warning',
        message: t('extended.dryRunUnsupported'),
        description: t('extended.dryRunUnsupportedHint')
      })
      return
    }

    if (!currentPath) return
    setRunning(true)
    setCommandOutput(t('common.running'))
    try {
      const result = await managerCommands.execute(
        currentPath,
        activeManager,
        operationPlan.request,
        { dryRun }
      )
      if (result.backup) recordBackup(result.backup)
      const backupOutput = result.backup
        ? `\n\n[backup] ${result.backup.files.length} files saved to ${result.backup.path}`
        : ''
      const dryRunOutput = result.dryRun ? '\n\n[dry-run] no project changes were requested' : ''
      setCommandOutput(`$ ${result.command}\n\n${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}${dryRunOutput}${backupOutput}`)
      addNotification({ type: 'success', message: result.dryRun ? t('extended.dryRunComplete') : t('extended.commandSucceeded'), description: result.command })
      await loadDependencies(activeManager)
    } catch (error: any) {
      setCommandOutput(error.message || String(error))
      addNotification({ type: 'error', message: t('extended.commandFailed'), description: error.message })
    } finally {
      setRunning(false)
    }
  }

  const restoreLastBackup = async () => {
    if (!currentPath || !lastBackup) return
    if (lastBackupPathRef.current !== currentPath) {
      addNotification({
        type: 'error',
        message: t('extended.restoreFailed'),
        description: t('extended.backupPathMismatch')
      })
      return
    }
    setRestoring(true)
    try {
      const result = await window.electronAPI.managers.restoreBackup(currentPath, lastBackup.path)
      addNotification({
        type: 'success',
        message: t('extended.backupRestored'),
        description: t('extended.backupRestoredDescription', {
          count: result.restoredCount,
          files: result.restoredFiles.join(t('common.enumerationSeparator'))
        })
      })
      setCommandOutput((prev) => `${prev}\n\n[restore] ${result.restoredFiles.join(', ')}`)
      await loadDependencies(activeManager)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: t('extended.restoreFailed'),
        description: error.message
      })
    } finally {
      setRestoring(false)
    }
  }

  const managerOptions = managers.map((manager) => ({
    value: manager.id,
    label: `${manager.shortName} - ${manager.language}`
  }))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>{t('extended.title')}</Title>
          <Paragraph className={styles.subtitle}>{t('extended.subtitle')}</Paragraph>
        </div>
        <Space wrap>
          <ProjectPathBar compact />
          <Button icon={<ReloadOutlined />} onClick={loadDetections} loading={loading}>{t('toolchain.redetect')}</Button>
        </Space>
      </div>

      <Alert
        type={detectedManagers.length > 0 ? 'success' : 'info'}
        showIcon
        title={detectedManagers.length > 0 ? t('extended.detectedTitle') : t('extended.notDetectedTitle')}
        description={
          detectedManagers.length > 0
            ? detectedManagers.map((item) => `${item.name}: ${item.files.join(', ')}`).join(t('common.detailSeparator'))
            : t('extended.supportedHint')
        }
      />

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <Select
            value={activeManager}
            options={managerOptions}
            onChange={setActiveManager}
            style={{ width: '100%' }}
          />
          <div className={styles.managerList}>
            {managers.map((manager) => {
              const detected = detectedMap.get(manager.id)?.detected
              return (
                <button
                  key={manager.id}
                  className={`${styles.managerButton} ${activeManager === manager.id ? styles.active : ''}`}
                  onClick={() => setActiveManager(manager.id)}
                >
                  <span className={styles.managerIcon}>{managerIcon(manager.id)}</span>
                  <span className={styles.managerMeta}>
                    <span>{manager.shortName}</span>
                    <small>{manager.language}</small>
                  </span>
                  {detected && <Tag color="success">{t('extended.tagDetected')}</Tag>}
                </button>
              )
            })}
          </div>
        </aside>

        <main className={styles.content}>
          <div className={styles.managerHeader}>
            <Space size={10} wrap>
              <span className={styles.headerIcon}>{activeDefinition ? managerIcon(activeDefinition.id) : <CodeOutlined />}</span>
              <Title level={3} className={styles.managerTitle}>{activeDefinition?.name || activeManager}</Title>
              <Tag color={activeDefinition ? managerColor(activeDefinition.id) : 'default'}>
                {activeDefinition ? implementationStatusText(activeDefinition.status, t) : t('status.planned')}
              </Tag>
              {activeDetection?.detected && <Tag color="success">{activeDetection.files.join(', ')}</Tag>}
            </Space>
            <Text type="secondary">{activeDefinition?.productionTools.join(' / ')}</Text>
          </div>

          <Table
            dataSource={dependencies}
            rowKey={(record) => `${record.managerId}:${record.file}:${record.type}:${record.name}:${record.version || ''}`}
            size="small"
            loading={loading}
            pagination={{ pageSize: 12 }}
            locale={{ emptyText: <Empty description={currentPath ? t('extended.emptyDependencies') : t('common.selectProjectFirst')} /> }}
            columns={[
              {
                title: t('common.dependencies'),
                dataIndex: 'name',
                key: 'name',
                width: 240,
                render: (name: string) => <Text strong>{name}</Text>
              },
              {
                title: t('extended.columnVersionConstraint'),
                dataIndex: 'version',
                key: 'version',
                width: 180,
                render: (version: string) => version ? <Tag>{version}</Tag> : '-'
              },
              {
                title: t('common.type'),
                dataIndex: 'type',
                key: 'type',
                width: 190,
                render: (type: string) => <Tag color="blue">{type}</Tag>
              },
              {
                title: t('common.source'),
                dataIndex: 'source',
                key: 'source',
                ellipsis: true,
                render: (source: string) => source || '-'
              },
              {
                title: t('common.file'),
                dataIndex: 'file',
                key: 'file',
                width: 170,
                render: (file: string) => <Tag>{file}</Tag>
              }
            ]}
          />

          <div className={styles.commandPanel}>
            <div>
              <Text strong>{t('extended.commandRunner')}</Text>
              <Paragraph className={styles.commandHint}>
                {t('extended.commandHint')}
              </Paragraph>
            </div>
            <div className={styles.planPanel}>
              <Text strong>{t('extended.planTitle')}</Text>
              <Form
                form={operationForm}
                layout="inline"
                initialValues={{ operation: 'sync' }}
                className={styles.planForm}
              >
                <Form.Item name="operation" className={styles.operationSelect}>
                  <Select options={operationOptions} />
                </Form.Item>
                <Form.Item name="packageName" className={styles.packageInput}>
                  <Input placeholder={t('extended.packageNameOptional')} />
                </Form.Item>
                <Form.Item name="version" className={styles.versionInput}>
                  <Input placeholder={t('extended.versionOptional')} />
                </Form.Item>
                <Form.Item name="dev" valuePropName="checked" className={styles.devCheckbox}>
                  <Checkbox>{t('package.devDependency')}</Checkbox>
                </Form.Item>
                <Button onClick={generateOperationPlan} loading={planning} disabled={!currentPath}>
                  {t('extended.generatePlan')}
                </Button>
              </Form>
              {operationPlan && (
                <div className={styles.planResult}>
                  <Space size={6} wrap>
                    <Tag color={operationPlan.mutating ? 'orange' : 'green'}>
                      {operationPlan.mutating ? t('extended.mutating') : t('extended.readOnly')}
                    </Tag>
                    <Tag color={operationPlan.dryRunSupported ? 'blue' : 'default'}>
                      {operationPlan.dryRunSupported ? t('extended.dryRunSupportedTag') : t('extended.noDryRunTag')}
                    </Tag>
                    <Tag>{operationPlan.tool}</Tag>
                  </Space>
                  <pre className={styles.commandPreview}>{operationPlan.command}</pre>
                  {operationPlan.dryRunCommand && (
                    <pre className={styles.commandPreview}>dry-run: {operationPlan.dryRunCommand}</pre>
                  )}
                  {operationPlan.backupFiles.length > 0 && (
                    <Text type="secondary">
                      {t('extended.backupBeforeRun', {
                        files: operationPlan.backupFiles.map((file) => file.file).join(t('common.enumerationSeparator'))
                      })}
                    </Text>
                  )}
                  {(operationPlan.requirements.length > 0 || operationPlan.warnings.length > 0) && (
                    <Alert
                      type={operationPlan.requirements.length > 0 ? 'warning' : 'info'}
                      showIcon
                      title={operationPlan.requirements.length > 0 ? t('extended.planNeedsInfo') : t('extended.planHint')}
                      description={[...operationPlan.requirements, ...operationPlan.warnings].join(t('common.detailSeparator'))}
                    />
                  )}
                  <Space wrap>
                    <Button
                      onClick={() => executeOperationPlan(true)}
                      disabled={!operationPlan.dryRunSupported || operationPlan.requirements.length > 0}
                      loading={running}
                    >
                      Dry-run
                    </Button>
                    <Button
                      type="primary"
                      danger={operationPlan.mutating}
                      onClick={() => executeOperationPlan(false)}
                      disabled={operationPlan.requirements.length > 0}
                      loading={running}
                    >
                      {t('extended.executePlan')}
                    </Button>
                  </Space>
                </div>
              )}
            </div>
            {lastBackup && (
              <Alert
                type="warning"
                showIcon
                title={t('extended.backupCreated')}
                description={
                  <Space direction="vertical" size={6}>
                    <Text>{t('extended.backupFilesSaved', { count: lastBackup.files.length, path: lastBackup.path })}</Text>
                    <Space wrap>
                      <Button size="small" onClick={() => window.electronAPI.system.openFile(lastBackup.path)}>
                        {t('extended.openBackup')}
                      </Button>
                      <Button size="small" danger onClick={restoreLastBackup} loading={restoring}>
                        {t('extended.restoreBackup')}
                      </Button>
                    </Space>
                  </Space>
                }
              />
            )}
            <Space size={6} wrap>
              {(COMMAND_SUGGESTIONS[activeManager] || []).map((command) => (
                <Button key={command} size="small" onClick={() => commandForm.setFieldValue('commandLine', command)}>
                  {command}
                </Button>
              ))}
            </Space>
            <Form form={commandForm} layout="inline" onFinish={runCommand} className={styles.commandForm}>
              <Form.Item name="commandLine" rules={[{ required: true, message: t('extended.commandRequired') }]} className={styles.commandInput}>
                <Input placeholder={t('extended.commandPlaceholder')} />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={running} disabled={!currentPath}>
                {t('common.run')}
              </Button>
            </Form>
            {commandOutput && <pre className={styles.output}>{commandOutput}</pre>}
          </div>
        </main>
      </div>
    </div>
  )
}

export default ExtendedEcosystemsPage
