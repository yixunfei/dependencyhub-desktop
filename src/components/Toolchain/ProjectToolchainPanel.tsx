import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Input, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined, FolderOpenOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { TOOL_LABELS, TOOL_ORDER, TOOL_PLACEHOLDERS } from '../../domain/toolchains/metadata'
import { useT } from '../../i18n'
import { useAppStore } from '../../stores/appStore'

const { Text } = Typography

const emptyPaths = Object.fromEntries(TOOL_ORDER.map((tool) => [tool, ''])) as Record<ToolName, string>

function pathsFromConfig(config: ToolchainConfig): Record<ToolName, string> {
  return {
    ...emptyPaths,
    ...Object.fromEntries(TOOL_ORDER.map((tool) => [tool, config[tool] || '']))
  } as Record<ToolName, string>
}

interface ProjectToolchainPanelProps {
  projectPath: string
  compact?: boolean
}

const ProjectToolchainPanel: React.FC<ProjectToolchainPanelProps> = ({ projectPath, compact = false }) => {
  const t = useT()
  const addNotification = useAppStore((state) => state.addNotification)
  const [statuses, setStatuses] = useState<ToolStatus[]>([])
  const [paths, setPaths] = useState<Record<ToolName, string>>(emptyPaths)
  const [loading, setLoading] = useState(false)
  // Toolchain checks take seconds; switching projects must not let project
  // A's late response overwrite project B's panel.
  const loadEpochRef = useRef(0)

  const statusMap = useMemo(() => {
    return Object.fromEntries(statuses.map((status) => [status.tool, status])) as Record<ToolName, ToolStatus>
  }, [statuses])

  useEffect(() => {
    if (projectPath) {
      loadProjectToolchain()
    }
  }, [projectPath])

  const loadProjectToolchain = async () => {
    if (!projectPath) return
    const epoch = ++loadEpochRef.current
    setLoading(true)
    try {
      const [config, result] = await Promise.all([
        window.electronAPI.project.toolchain.get(projectPath),
        window.electronAPI.project.toolchain.check(projectPath)
      ])
      if (epoch !== loadEpochRef.current) return
      setPaths(pathsFromConfig(config))
      setStatuses(result)
    } catch (error) {
      if (epoch !== loadEpochRef.current) return
      // A silent failure here would leave stale/empty version columns and the
      // user would not know the toolchain check never ran.
      addNotification({
        type: 'error',
        message: t('toolchain.loadFailed'),
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      if (epoch === loadEpochRef.current) setLoading(false)
    }
  }

  const chooseDirectory = async (tool: ToolName) => {
    try {
      const directory = await window.electronAPI.selectDirectory()
      if (!directory) return
      setPaths((prev) => ({ ...prev, [tool]: directory }))
      await savePath(tool, directory)
    } catch (error) {
      addNotification({
        type: 'error',
        message: t('toolchain.saveFailed'),
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const savePath = async (tool: ToolName, explicitPath?: string) => {
    if (!projectPath) return
    setLoading(true)
    try {
      await window.electronAPI.project.toolchain.set(projectPath, tool, explicitPath ?? paths[tool] ?? '')
      await loadProjectToolchain()
    } catch (error) {
      addNotification({
        type: 'error',
        message: t('toolchain.saveFailed'),
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  const clearPath = async (tool: ToolName) => {
    if (!projectPath) return
    setLoading(true)
    try {
      await window.electronAPI.project.toolchain.clear(projectPath, tool)
      await loadProjectToolchain()
    } catch (error) {
      addNotification({
        type: 'error',
        message: t('toolchain.saveFailed'),
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  if (!projectPath) {
    return (
      <Alert
        type="info"
        showIcon
        title={t('toolchain.projectSelectHint')}
      />
    )
  }

  return (
    <Card
      size="small"
      title={t('toolchain.projectTitle')}
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadProjectToolchain} loading={loading}>{t('toolchain.detect')}</Button>}
      style={{ marginBottom: compact ? 12 : 16 }}
    >
      <Text type="secondary">{t('toolchain.projectOverrideHint')}</Text>
      <Table
        style={{ marginTop: 12 }}
        dataSource={TOOL_ORDER.map((tool) => ({ tool }))}
        rowKey="tool"
        size="small"
        pagination={false}
        scroll={{ x: 980 }}
        columns={[
          {
            title: t('common.tool'),
            dataIndex: 'tool',
            key: 'tool',
            width: 130,
            render: (tool: ToolName) => TOOL_LABELS[tool]
          },
          {
            title: t('toolchain.projectBoundPath'),
            key: 'path',
            width: 360,
            render: (_: any, record: { tool: ToolName }) => (
              <Input
                value={paths[record.tool]}
                onChange={(event) => setPaths((prev) => ({ ...prev, [record.tool]: event.target.value }))}
                placeholder={TOOL_PLACEHOLDERS[record.tool]}
              />
            )
          },
          {
            title: t('toolchain.effectiveVersion'),
            key: 'status',
            width: 260,
            render: (_: any, record: { tool: ToolName }) => {
              const status = statusMap[record.tool]
              if (!status) return '-'
              return status.available ? (
                <Tooltip title={status.configuredPath || t('common.systemPath')}>
                  <Tag color="green" style={{ maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }}>
                    {status.version || t('common.available')}
                  </Tag>
                </Tooltip>
              ) : (
                <Tooltip title={status.message}>
                  <Tag color="red">{t('common.unavailable')}</Tag>
                </Tooltip>
              )
            }
          },
          {
            title: t('common.actions'),
            key: 'action',
            width: 250,
            render: (_: any, record: { tool: ToolName }) => (
              <Space>
                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => chooseDirectory(record.tool)} loading={loading}>
                  {t('common.select')}
                </Button>
                <Button size="small" icon={<SaveOutlined />} onClick={() => savePath(record.tool)} loading={loading}>
                  {t('common.save')}
                </Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => clearPath(record.tool)} loading={loading}>
                  {t('common.clear')}
                </Button>
              </Space>
            )
          }
        ]}
      />
    </Card>
  )
}

export default ProjectToolchainPanel
