import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Form, Input, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd'
import {
  BranchesOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ProjectPathBar from '../../../components/ProjectPathBar/ProjectPathBar'
import { useAppStore } from '../../../stores/appStore'
import { getManagerDefinition, type DependencyManagerId } from '../../../domain/managers/registry'
import { managerColor, managerIcon } from '../../../domain/managers/presentation'
import type {
  ManagerBackup,
  ManagerCommandResult,
  ManagerDependency,
  ManagerDetection,
  ManagerOperation,
  ManagerOperationPlan
} from '@shared/managerWorkspace'
import ManagerDiagnosticsPanel from './ManagerDiagnosticsPanel'
import { ManagerWorkspaceCoordinator } from './managerWorkspaceCoordinator'
import styles from './ExtendedManagerWorkspace.module.css'

const { Paragraph, Text, Title } = Typography

type OperationFormValues = {
  operation: ManagerOperation
  packageName?: string
  version?: string
  dev?: boolean
}

export interface ExtendedManagerWorkspaceConfig {
  managerIds: DependencyManagerId[]
  defaultManagerId: DependencyManagerId
  title: string
  titleIcon?: React.ReactNode
  subtitle: string
  noDetectionMessage: string
  detectionHint: string
  operationOptions: Array<{ value: ManagerOperation; label: string }>
  quickCommands: Partial<Record<DependencyManagerId, string[]>>
  packageLabel?: string
  packagePlaceholder?: string
  versionPlaceholder?: string
  commandPlaceholder?: string | ((managerId: DependencyManagerId) => string)
  typeColumnTitle?: string
  dependencyEmptyDescription?: string
  riskDescription: string
  restoreSuccessMessage: string
  overviewErrorMessage: string
  secondaryAction?: {
    label: string
    route: string
  }
  showDevOption?: boolean
  detectedFileLimit?: number
  maxMetricTools?: number
}

interface ExtendedManagerWorkspaceProps {
  config: ExtendedManagerWorkspaceConfig
}

const ExtendedManagerWorkspace: React.FC<ExtendedManagerWorkspaceProps> = ({ config }) => {
  const navigate = useNavigate()
  const currentPath = useAppStore((state) => state.currentPath)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const addNotification = useAppStore((state) => state.addNotification)

  const [activeManager, setActiveManager] = useState<DependencyManagerId>(config.defaultManagerId)
  const [detections, setDetections] = useState<ManagerDetection[]>([])
  const [dependencies, setDependencies] = useState<ManagerDependency[]>([])
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([])
  const [operationPlan, setOperationPlan] = useState<ManagerOperationPlan | null>(null)
  const [lastBackup, setLastBackup] = useState<ManagerBackup | null>(null)
  const [commandOutput, setCommandOutput] = useState('')
  const [readinessReport, setReadinessReport] = useState<ReadinessGateReport | null>(null)
  const [dependencyDiff, setDependencyDiff] = useState<DependencyComponentDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [operationForm] = Form.useForm<OperationFormValues>()
  const [commandForm] = Form.useForm<{ commandLine: string }>()
  // Overview and inventory requests track staleness independently; sharing a single
  // coordinator would let an inventory load discard a concurrent overview response.
  const overviewCoordinator = React.useMemo(() => new ManagerWorkspaceCoordinator(), [])
  const inventoryCoordinator = React.useMemo(() => new ManagerWorkspaceCoordinator(), [])
  const currentPathRef = React.useRef(currentPath)
  useEffect(() => { currentPathRef.current = currentPath }, [currentPath])

  const definitions = useMemo(() => config.managerIds.map((id) => getManagerDefinition(id)!).filter(Boolean), [config.managerIds])
  const activeDefinition = getManagerDefinition(activeManager)
  const detectionMap = useMemo(() => new Map(detections.map((item) => [item.id, item])), [detections])
  const activeDetection = detectionMap.get(activeManager)
  const toolStatusMap = useMemo(() => new Map(toolStatuses.map((tool) => [tool.tool, tool])), [toolStatuses])
  const detectedManagers = useMemo(() => config.managerIds.filter((id) => detectionMap.get(id)?.detected), [config.managerIds, detectionMap])
  const highRiskCount = dependencyDiff
    ? dependencyDiff.summary.criticalRisk + dependencyDiff.summary.highRisk
    : readinessReport?.summary.dependencyHighRiskCount || 0
  const detectedFileLimit = config.detectedFileLimit ?? 3
  const maxMetricTools = config.maxMetricTools ?? 1
  const showDevOption = config.showDevOption ?? true
  const searchSupported = activeDetection?.capabilities.search ?? activeDefinition?.searchable ?? false
  const healthSupported = activeDetection?.capabilities.health ?? activeDefinition?.healthSupported ?? false

  useEffect(() => {
    void loadOverview()
  }, [currentPath])

  useEffect(() => {
    if (!currentPath) {
      inventoryCoordinator.invalidate()
      setDependencies([])
      setOperationPlan(null)
      return
    }
    inventoryCoordinator.invalidate()
    setOperationPlan(null)
    void loadDependencies(activeManager)
  }, [activeManager, currentPath])

  const chooseDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setCurrentPath(path)
    addNotification({ type: 'info', message: 'Project path changed', description: path })
  }

  const isWorkspaceManager = (id: DependencyManagerId): boolean => config.managerIds.includes(id)

  const loadOverview = async () => {
    const path = currentPath
    const token = overviewCoordinator.begin({ projectPath: path })
    setLoading(true)
    try {
      if (!currentPath) {
        setDetections([])
        setDependencies([])
        setReadinessReport(null)
        setDependencyDiff(null)
        setToolStatuses(await window.electronAPI.system.checkTools())
        return
      }

      const [detected, tools, readiness, diff] = await Promise.all([
        window.electronAPI.managers.detected(currentPath),
        window.electronAPI.project.toolchain.check(currentPath),
        window.electronAPI.readiness.report(currentPath).catch(() => null),
        window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(currentPath).catch(() => null)
      ])
      if (overviewCoordinator.accepts(token, { projectPath: path })) {
        setDetections(detected.filter((item) => isWorkspaceManager(item.id)))
        setToolStatuses(tools)
        setReadinessReport(readiness)
        setDependencyDiff(diff)
        const firstDetected = detected.find((item) => isWorkspaceManager(item.id) && item.detected)
        if (firstDetected) setActiveManager(firstDetected.id)
      }
    } catch (error: any) {
      if (overviewCoordinator.accepts(token, { projectPath: path })) addNotification({ type: 'error', message: config.overviewErrorMessage, description: error.message })
    } finally {
      if (overviewCoordinator.accepts(token, { projectPath: path })) setLoading(false)
    }
  }

  const loadDependencies = async (managerId: DependencyManagerId = activeManager) => {
    if (!currentPath) return
    const path = currentPath
    const token = inventoryCoordinator.begin({ projectPath: path, managerId })
    setLoading(true)
    try {
      if (!inventoryCoordinator.accepts(token, { projectPath: path, managerId })) return
      setDependencies(await window.electronAPI.managers.inventory(path, managerId))
    } catch (error: any) {
      if (inventoryCoordinator.accepts(token, { projectPath: path, managerId })) {
        setDependencies([])
        addNotification({ type: 'error', message: `Failed to read ${managerId} dependencies`, description: error.message })
      }
    } finally {
      if (inventoryCoordinator.accepts(token, { projectPath: path, managerId })) setLoading(false)
    }
  }

  const generateOperationPlan = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
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
      commandForm.setFieldValue('commandLine', plan.command)
      if (plan.requirements.length > 0) {
        addNotification({ type: 'warning', message: 'Operation plan needs more input', description: plan.requirements.join('; ') })
      }
    } catch (error: any) {
      addNotification({ type: 'error', message: 'Failed to generate operation plan', description: error.message })
    } finally {
      setPlanning(false)
    }
  }

  const executeAndRefresh = async (operation: () => Promise<ManagerCommandResult>) => {
    if (!currentPath) return
    const operationPath = currentPath
    setRunning(true)
    setCommandOutput('Running...')
    try {
      const result = await operation()
      if (result.backup) setLastBackup(result.backup)
      setCommandOutput([
        `$ ${result.command}`,
        '',
        result.stdout,
        result.stderr,
        result.dryRun ? '[dry-run] no project changes were requested' : '',
        result.backup ? `[backup] ${result.backup.files.length} files saved to ${result.backup.path}` : ''
      ].filter(Boolean).join('\n'))
      addNotification({ type: 'success', message: result.dryRun ? 'Dry-run completed' : 'Command completed', description: result.command })
      // Apply the refresh only while the project the command targeted is still active.
      const applyIfSameProject = (apply: () => void) => {
        if (currentPathRef.current === operationPath) apply()
      }
      await Promise.all([
        loadDependencies(activeManager),
        window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(operationPath).then((value) => applyIfSameProject(() => setDependencyDiff(value))).catch(() => null),
        window.electronAPI.readiness.report(operationPath).then((value) => applyIfSameProject(() => setReadinessReport(value))).catch(() => null)
      ])
    } catch (error: any) {
      const backup = error?.backup as ManagerBackup | undefined
      if (backup) setLastBackup(backup)
      setCommandOutput(error.message || String(error))
      addNotification({ type: 'error', message: 'Command failed', description: error.message })
    } finally {
      setRunning(false)
    }
  }

  const executeCommand = async (commandLine?: string) => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: 'Select a project directory first' })
      return
    }

    const command = (commandLine || commandForm.getFieldValue('commandLine') || '').trim()
    if (!command) return
    await executeAndRefresh(() => window.electronAPI.managers.runCustom(currentPath, activeManager, command))
  }

  const executeOperationPlan = async (dryRun = false) => {
    if (!operationPlan) return
    if (operationPlan.requirements.length > 0) {
      addNotification({ type: 'warning', message: 'Operation plan is incomplete', description: operationPlan.requirements.join('; ') })
      return
    }

    if (dryRun && !operationPlan.dryRunSupported) {
      addNotification({ type: 'warning', message: 'No dry-run command is available for this operation' })
      return
    }
    if (!currentPath) return
    await executeAndRefresh(() => window.electronAPI.managers.execute(
      currentPath,
      activeManager,
      operationPlan.request,
      { dryRun, plan: operationPlan }
    ))
  }

  const restoreLastBackup = async () => {
    if (!currentPath || !lastBackup) return
    setRestoring(true)
    try {
      const result = await window.electronAPI.managers.restoreBackup(currentPath, lastBackup.path)
      setCommandOutput((prev) => `${prev}\n\n[restore] ${result.restoredFiles.join(', ')}`)
      addNotification({ type: 'success', message: config.restoreSuccessMessage, description: `${result.restoredCount} files restored` })
      await loadDependencies(activeManager)
    } catch (error: any) {
      addNotification({ type: 'error', message: 'Failed to restore backup', description: error.message })
    } finally {
      setRestoring(false)
    }
  }

  const availableOperationOptions = useMemo(() => {
    const supported = activeDetection?.capabilities.operations
    return supported
      ? config.operationOptions.filter((option) => supported.includes(option.value))
      : config.operationOptions
  }, [activeDetection?.capabilities.operations, config.operationOptions])

  useEffect(() => {
    const first = availableOperationOptions[0]?.value
    if (!first) return
    const current = operationForm.getFieldValue('operation')
    if (!availableOperationOptions.some((option) => option.value === current)) {
      operationForm.setFieldValue('operation', first)
    }
  }, [availableOperationOptions, operationForm])

  const managerSegments = definitions.map((manager) => ({
    value: manager.id,
    label: (
      <Space size={6}>
        {managerIcon(manager.id)}
        <span>{manager.shortName}</span>
        {detectionMap.get(manager.id)?.detected && <Tag color="green">detected</Tag>}
      </Space>
    )
  }))

  const commandPlaceholder = typeof config.commandPlaceholder === 'function'
    ? config.commandPlaceholder(activeManager)
    : config.commandPlaceholder || `${activeManager} install`

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>
            {config.titleIcon}
            <span>{config.title}</span>
          </Title>
          <Paragraph className={styles.subtitle}>{config.subtitle}</Paragraph>
        </div>
        <Space wrap>
          <ProjectPathBar compact />
          <Button icon={<FolderOpenOutlined />} onClick={chooseDirectory}>Select folder</Button>
          <Button icon={<ReloadOutlined />} onClick={loadOverview} loading={loading}>Reload</Button>
          {config.secondaryAction && (
            <Button onClick={() => navigate(config.secondaryAction!.route)}>{config.secondaryAction.label}</Button>
          )}
        </Space>
      </div>

      <Alert
        type={detectedManagers.length > 0 ? 'success' : 'info'}
        showIcon
        message={detectedManagers.length > 0 ? `Detected ${detectedManagers.join(', ')}` : config.noDetectionMessage}
        description={detectedManagers.length > 0
          ? config.managerIds.map((id) => {
              const detected = detectionMap.get(id)
              return detected?.detected ? `${id}: ${detected.files.join(', ')}` : ''
            }).filter(Boolean).join('; ')
          : config.detectionHint
        }
      />

      <div className={styles.metrics}>
        {config.managerIds.map((id) => {
          const definition = getManagerDefinition(id)!
          const detected = detectionMap.get(id)
          return (
            <div key={id} className={styles.metric}>
              <Space size={6}>
                {managerIcon(id)}
                <Text strong>{definition.shortName}</Text>
              </Space>
              <Tag color={detected?.detected ? 'green' : 'default'}>{detected?.detected ? 'detected' : 'not detected'}</Tag>
              <Tag color={detected?.status === 'preview' || definition.status === 'preview' ? 'processing' : 'default'}>
                {detected?.status || definition.status}
              </Tag>
              <Space size={4} wrap>
                {definition.tools.slice(0, maxMetricTools).map((tool) => {
                  const toolStatus = toolStatusMap.get(tool as ToolName)
                  return (
                    <Tooltip key={tool} title={toolStatus?.version || toolStatus?.message || 'not checked'}>
                      <Tag color={toolStatus?.available ? 'green' : 'red'}>{tool}</Tag>
                    </Tooltip>
                  )
                })}
              </Space>
            </div>
          )
        })}
        <div className={styles.metric}>
          <Space size={6}><SafetyCertificateOutlined /><Text strong>Readiness</Text></Space>
          <Tag color={readinessReport?.status === 'blocked' ? 'red' : readinessReport?.status === 'warning' ? 'orange' : 'green'}>
            {readinessReport ? `${readinessReport.status} ${readinessReport.score}/100` : 'not checked'}
          </Tag>
          <Text type="secondary">{readinessReport?.summary.dependencyHighRiskCount || 0} high-risk diff</Text>
        </div>
      </div>

      <div className={styles.workspace}>
        <section className={styles.panel}>
          <div className={styles.managerHeader}>
            <Segmented
              value={activeManager}
              options={managerSegments}
              onChange={(value) => setActiveManager(value as DependencyManagerId)}
            />
            <Space wrap>
              <Tag color={managerColor(activeManager)}>{activeDefinition?.packageManager}</Tag>
              <Tag color={activeDetection?.status === 'preview' || activeDefinition?.status === 'preview' ? 'processing' : 'default'}>
                {activeDetection?.status || activeDefinition?.status}
              </Tag>
              {activeDetection?.detected && activeDetection.files.slice(0, detectedFileLimit).map((file) => <Tag key={file}>{file}</Tag>)}
              {activeDefinition?.productionTools.slice(0, 3).map((tool) => <Tag key={tool}>{tool}</Tag>)}
            </Space>
          </div>

          {highRiskCount > 0 && (
            <Alert
              type="warning"
              showIcon
              message="Readiness gate has high-risk dependency changes"
              description={config.riskDescription}
            />
          )}

          <Table
            dataSource={dependencies}
            rowKey={(record) => `${record.managerId}:${record.file}:${record.type}:${record.name}:${record.version || ''}`}
            size="small"
            scroll={{ x: 780 }}
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description={currentPath ? (config.dependencyEmptyDescription || 'No dependencies parsed for this manager') : 'Select a project directory first'} /> }}
            columns={[
              {
                title: 'Dependency',
                dataIndex: 'name',
                key: 'name',
                width: 240,
                render: (name: string) => <Text strong>{name}</Text>
              },
              {
                title: 'Version',
                dataIndex: 'version',
                key: 'version',
                width: 150,
                render: (version: string) => version ? <Tag>{version}</Tag> : '-'
              },
              {
                title: config.typeColumnTitle || 'Scope',
                dataIndex: 'type',
                key: 'type',
                width: 210,
                render: (type: string) => <Tag color="blue">{type}</Tag>
              },
              {
                title: 'File',
                dataIndex: 'file',
                key: 'file',
                width: 180,
                render: (file: string) => <Tag>{file}</Tag>
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                ellipsis: true,
                render: (source: string) => source || '-'
              }
            ]}
          />
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <BranchesOutlined />
            <Text strong>Operation plan</Text>
          </div>
          <Form form={operationForm} layout="vertical" initialValues={{ operation: 'sync', dev: false }}>
            <div className={styles.planGrid}>
              <Form.Item name="operation" label="Operation">
                <Segmented options={availableOperationOptions} />
              </Form.Item>
              <Form.Item name="packageName" label={config.packageLabel || 'Package'}>
                <Input placeholder={config.packagePlaceholder || 'package name'} />
              </Form.Item>
              <Form.Item name="version" label="Version">
                <Input placeholder={config.versionPlaceholder || 'latest, 1.2.3'} />
              </Form.Item>
              {showDevOption && (
                <Form.Item name="dev" valuePropName="checked" label="Scope">
                  <Checkbox>Development dependency</Checkbox>
                </Form.Item>
              )}
            </div>
            <Space wrap>
              <Button onClick={generateOperationPlan} loading={planning} disabled={!currentPath}>Generate plan</Button>
              {operationPlan && (
                <>
                  <Button onClick={() => executeOperationPlan(true)} disabled={!operationPlan.dryRunSupported || operationPlan.requirements.length > 0} loading={running}>Dry-run</Button>
                  <Button type="primary" danger={operationPlan.mutating} onClick={() => executeOperationPlan(false)} disabled={operationPlan.requirements.length > 0} loading={running}>
                    Execute plan
                  </Button>
                </>
              )}
            </Space>
          </Form>

          {operationPlan && (
            <div className={styles.planResult}>
              <Space wrap>
                <Tag color={operationPlan.mutating ? 'orange' : 'green'}>{operationPlan.mutating ? 'mutating' : 'read-only'}</Tag>
                <Tag color={operationPlan.dryRunSupported ? 'blue' : 'default'}>{operationPlan.dryRunSupported ? 'dry-run available' : 'no generic dry-run'}</Tag>
                <Tag>{operationPlan.tool}</Tag>
              </Space>
              <pre className={styles.commandPreview}>{operationPlan.command}</pre>
              {operationPlan.dryRunCommand && <pre className={styles.commandPreview}>dry-run: {operationPlan.dryRunCommand}</pre>}
              {operationPlan.backupFiles.length > 0 && (
                <Text type="secondary">Backup preview: {operationPlan.backupFiles.map((file) => file.file).join(', ')}</Text>
              )}
              {(operationPlan.requirements.length > 0 || operationPlan.warnings.length > 0) && (
                <Alert
                  type={operationPlan.requirements.length > 0 ? 'warning' : 'info'}
                  showIcon
                  message={operationPlan.requirements.length > 0 ? 'Plan needs input' : 'Plan notes'}
                  description={[...operationPlan.requirements, ...operationPlan.warnings].join('; ')}
                />
              )}
            </div>
          )}

          <div className={styles.quickCommands}>
            <Text strong>Quick commands</Text>
            <Space wrap>
              {(config.quickCommands[activeManager] || []).map((command) => (
                <Button key={command} size="small" onClick={() => executeCommand(command)} loading={running}>
                  {activeManager} {command}
                </Button>
              ))}
            </Space>
          </div>

          <Form form={commandForm} layout="vertical" onFinish={(values) => executeCommand(values.commandLine)}>
            <Form.Item name="commandLine" label="Custom command">
              <Input placeholder={commandPlaceholder} />
            </Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={running} disabled={!currentPath}>
                Run command
              </Button>
              {lastBackup && (
                <>
                  <Button icon={<ExportOutlined />} onClick={() => window.electronAPI.system.openFile(lastBackup.path)}>Open backup</Button>
                  <Button danger icon={<RollbackOutlined />} onClick={restoreLastBackup} loading={restoring}>Restore backup</Button>
                </>
              )}
            </Space>
          </Form>

          {commandOutput && <pre className={styles.output}>{commandOutput}</pre>}
        </section>
      </div>
      <ManagerDiagnosticsPanel
        managerId={activeManager}
        currentPath={currentPath || undefined}
        searchSupported={searchSupported}
        healthSupported={healthSupported}
      />
    </div>
  )
}

export default ExtendedManagerWorkspace
