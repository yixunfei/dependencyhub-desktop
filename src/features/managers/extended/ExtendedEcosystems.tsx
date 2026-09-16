import { managerCommands } from './managerCommands'
import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Form, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { CodeOutlined, FolderOpenOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import ProjectPathBar from '../../../components/ProjectPathBar/ProjectPathBar'
import { useAppStore } from '../../../stores/appStore'
import { getManagerDefinition, getPlannedManagerDefinitions, type DependencyManagerId } from '../../../domain/managers/registry'
import { implementationStatusText, managerColor, managerIcon } from '../../../domain/managers/presentation'
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

const OPERATION_OPTIONS: Array<{ value: ManagerOperation; label: string }> = [
  { value: 'sync', label: '同步/安装现有清单' },
  { value: 'install', label: '添加依赖' },
  { value: 'remove', label: '移除依赖' },
  { value: 'update', label: '更新依赖' },
  { value: 'outdated', label: '检查过期' },
  { value: 'audit', label: '审计/校验' },
  { value: 'tree', label: '依赖树' },
  { value: 'list', label: '列出依赖' },
  { value: 'lock', label: '生成/刷新锁文件' }
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
  const currentPath = useAppStore((state) => state.currentPath)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const addNotification = useAppStore((state) => state.addNotification)
  const managers = useMemo(() => getPlannedManagerDefinitions(), [])
  const [detections, setDetections] = useState<ManagerDetection[]>([])
  const [activeManager, setActiveManager] = useState<DependencyManagerId>(managers[0]?.id || 'pnpm')
  const [dependencies, setDependencies] = useState<ManagerDependency[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [commandOutput, setCommandOutput] = useState('')
  const [lastBackup, setLastBackup] = useState<ManagerBackup | null>(null)
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

  useEffect(() => {
    void loadDetections()
  }, [currentPath])

  useEffect(() => {
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

  const chooseDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setCurrentPath(path)
    addNotification({ type: 'info', message: '项目路径已切换', description: path })
  }

  const loadDetections = async () => {
    const path = currentPath
    const token = detectionsCoordinator.begin({ projectPath: path })
    if (!currentPath) {
      setDetections([])
      setDependencies([])
      return
    }

    setLoading(true)
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
          message: '扩展生态检测失败',
          description: error.message
        })
      }
    } finally {
      if (detectionsCoordinator.accepts(token, { projectPath: path })) setLoading(false)
    }
  }

  const loadDependencies = async (managerId = activeManager) => {
    if (!currentPath) return
    const path = currentPath
    const token = dependenciesCoordinator.begin({ projectPath: path, managerId })
    setLoading(true)
    try {
      if (!dependenciesCoordinator.accepts(token, { projectPath: path, managerId })) return
      setDependencies(await window.electronAPI.managers.inventory(path, managerId))
    } catch (error: any) {
      if (dependenciesCoordinator.accepts(token, { projectPath: path, managerId })) {
        addNotification({
          type: 'error',
          message: '读取扩展生态依赖失败',
          description: error.message
        })
        setDependencies([])
      }
    } finally {
      if (dependenciesCoordinator.accepts(token, { projectPath: path, managerId })) setLoading(false)
    }
  }

  const executeCommand = async (commandLine: string) => {
    if (!currentPath || !commandLine.trim()) return
    setRunning(true)
    setCommandOutput('Running...')
    try {
      const result = await managerCommands.runCustom(currentPath, activeManager, commandLine)
      if (result.backup) {
        setLastBackup(result.backup)
      }
      const backupOutput = result.backup
        ? `\n\n[backup] ${result.backup.files.length} files saved to ${result.backup.path}`
        : ''
      setCommandOutput(`$ ${result.command}\n\n${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}${backupOutput}`)
      addNotification({ type: 'success', message: '命令执行完成', description: result.command })
      await loadDependencies(activeManager)
    } catch (error: any) {
      setCommandOutput(error.message || String(error))
      addNotification({ type: 'error', message: '命令执行失败', description: error.message })
    } finally {
      setRunning(false)
    }
  }

  const runCommand = async (values: { commandLine: string }) => {
    await executeCommand(values.commandLine)
  }

  const generateOperationPlan = async () => {
    if (!currentPath) {
      addNotification({ type: 'warning', message: '请先选择项目目录' })
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
          message: '操作计划需要补充信息',
          description: plan.requirements.join('；')
        })
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '生成操作计划失败',
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
        message: '操作计划尚不可执行',
        description: operationPlan.requirements.join('；')
      })
      return
    }

    if (dryRun && !operationPlan.dryRunSupported) {
      addNotification({
        type: 'warning',
        message: '该操作没有可用 dry-run 命令',
        description: '可以先查看备份文件列表，或手动运行只读命令。'
      })
      return
    }

    if (!currentPath) return
    setRunning(true)
    setCommandOutput('Running...')
    try {
      const result = await managerCommands.execute(
        currentPath,
        activeManager,
        operationPlan.request,
        { dryRun }
      )
      if (result.backup) setLastBackup(result.backup)
      const backupOutput = result.backup
        ? `\n\n[backup] ${result.backup.files.length} files saved to ${result.backup.path}`
        : ''
      const dryRunOutput = result.dryRun ? '\n\n[dry-run] no project changes were requested' : ''
      setCommandOutput(`$ ${result.command}\n\n${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}${dryRunOutput}${backupOutput}`)
      addNotification({ type: 'success', message: result.dryRun ? 'dry-run 完成' : '命令执行完成', description: result.command })
      await loadDependencies(activeManager)
    } catch (error: any) {
      setCommandOutput(error.message || String(error))
      addNotification({ type: 'error', message: '命令执行失败', description: error.message })
    } finally {
      setRunning(false)
    }
  }

  const restoreLastBackup = async () => {
    if (!currentPath || !lastBackup) return
    setRestoring(true)
    try {
      const result = await window.electronAPI.managers.restoreBackup(currentPath, lastBackup.path)
      addNotification({
        type: 'success',
        message: '扩展生态备份已恢复',
        description: `${result.restoredCount} 个文件: ${result.restoredFiles.join(', ')}`
      })
      setCommandOutput((prev) => `${prev}\n\n[restore] ${result.restoredFiles.join(', ')}`)
      await loadDependencies(activeManager)
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: '恢复扩展生态备份失败',
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
          <Title level={2} className={styles.title}>扩展生态管理</Title>
          <Paragraph className={styles.subtitle}>
            为尚未拆出专用页面的语言生态提供统一检测、依赖清单和命令执行入口。
          </Paragraph>
        </div>
        <Space wrap>
          <ProjectPathBar compact />
          <Button icon={<FolderOpenOutlined />} onClick={chooseDirectory}>选择目录</Button>
          <Button icon={<ReloadOutlined />} onClick={loadDetections} loading={loading}>重新检测</Button>
        </Space>
      </div>

      <Alert
        type={detectedManagers.length > 0 ? 'success' : 'info'}
        showIcon
        title={detectedManagers.length > 0 ? '已识别扩展生态' : '当前目录未识别到扩展生态'}
        description={
          detectedManagers.length > 0
            ? detectedManagers.map((item) => `${item.name}: ${item.files.join(', ')}`).join('；')
            : '支持 pnpm/Yarn/Bun/Deno、uv/Poetry/Pipenv/Conda、NuGet、Composer、Bundler、SwiftPM、CocoaPods、Helm、Docker 的清单识别。'
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
                  {detected && <Tag color="success">识别</Tag>}
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
                {activeDefinition ? implementationStatusText(activeDefinition.status) : '规划中'}
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
            locale={{ emptyText: <Empty description={currentPath ? '未读取到依赖，或该生态需要先生成清单/锁文件' : '请先选择项目目录'} /> }}
            columns={[
              {
                title: '依赖',
                dataIndex: 'name',
                key: 'name',
                width: 240,
                render: (name: string) => <Text strong>{name}</Text>
              },
              {
                title: '版本/约束',
                dataIndex: 'version',
                key: 'version',
                width: 180,
                render: (version: string) => version ? <Tag>{version}</Tag> : '-'
              },
              {
                title: '类型',
                dataIndex: 'type',
                key: 'type',
                width: 190,
                render: (type: string) => <Tag color="blue">{type}</Tag>
              },
              {
                title: '来源',
                dataIndex: 'source',
                key: 'source',
                ellipsis: true,
                render: (source: string) => source || '-'
              },
              {
                title: '文件',
                dataIndex: 'file',
                key: 'file',
                width: 170,
                render: (file: string) => <Tag>{file}</Tag>
              }
            ]}
          />

          <div className={styles.commandPanel}>
            <div>
              <Text strong>命令运行器</Text>
              <Paragraph className={styles.commandHint}>
                输入参数即可，例如 Composer 使用 <code>install</code>，NuGet 使用 <code>list package</code>。也可以输入完整命令，系统会自动去掉重复的工具名前缀。
              </Paragraph>
            </div>
            <div className={styles.planPanel}>
              <Text strong>标准操作计划</Text>
              <Form
                form={operationForm}
                layout="inline"
                initialValues={{ operation: 'sync' }}
                className={styles.planForm}
              >
                <Form.Item name="operation" className={styles.operationSelect}>
                  <Select options={OPERATION_OPTIONS} />
                </Form.Item>
                <Form.Item name="packageName" className={styles.packageInput}>
                  <Input placeholder="依赖名，可选" />
                </Form.Item>
                <Form.Item name="version" className={styles.versionInput}>
                  <Input placeholder="版本，可选" />
                </Form.Item>
                <Form.Item name="dev" valuePropName="checked" className={styles.devCheckbox}>
                  <Checkbox>开发依赖</Checkbox>
                </Form.Item>
                <Button onClick={generateOperationPlan} loading={planning} disabled={!currentPath}>
                  生成计划
                </Button>
              </Form>
              {operationPlan && (
                <div className={styles.planResult}>
                  <Space size={6} wrap>
                    <Tag color={operationPlan.mutating ? 'orange' : 'green'}>
                      {operationPlan.mutating ? '会改动项目' : '只读操作'}
                    </Tag>
                    <Tag color={operationPlan.dryRunSupported ? 'blue' : 'default'}>
                      {operationPlan.dryRunSupported ? '支持 dry-run' : '无通用 dry-run'}
                    </Tag>
                    <Tag>{operationPlan.tool}</Tag>
                  </Space>
                  <pre className={styles.commandPreview}>{operationPlan.command}</pre>
                  {operationPlan.dryRunCommand && (
                    <pre className={styles.commandPreview}>dry-run: {operationPlan.dryRunCommand}</pre>
                  )}
                  {operationPlan.backupFiles.length > 0 && (
                    <Text type="secondary">
                      执行前将备份 {operationPlan.backupFiles.map((file) => file.file).join('、')}
                    </Text>
                  )}
                  {(operationPlan.requirements.length > 0 || operationPlan.warnings.length > 0) && (
                    <Alert
                      type={operationPlan.requirements.length > 0 ? 'warning' : 'info'}
                      showIcon
                      title={operationPlan.requirements.length > 0 ? '计划需要补充信息' : '计划提示'}
                      description={[...operationPlan.requirements, ...operationPlan.warnings].join('；')}
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
                      执行计划
                    </Button>
                  </Space>
                </div>
              )}
            </div>
            {lastBackup && (
              <Alert
                type="warning"
                showIcon
                title="最近一次可变更命令已创建备份"
                description={
                  <Space direction="vertical" size={6}>
                    <Text>{lastBackup.files.length} 个 manifest/lock/config 文件已保存到 {lastBackup.path}</Text>
                    <Space wrap>
                      <Button size="small" onClick={() => window.electronAPI.system.openFile(lastBackup.path)}>
                        打开备份
                      </Button>
                      <Button size="small" danger onClick={restoreLastBackup} loading={restoring}>
                        恢复备份
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
              <Form.Item name="commandLine" rules={[{ required: true, message: '请输入命令参数' }]} className={styles.commandInput}>
                <Input placeholder="例如: install / outdated / list package / dependency update" />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={running} disabled={!currentPath}>
                运行
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
