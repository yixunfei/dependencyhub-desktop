import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined, FolderOpenOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { TOOL_LABELS, TOOL_ORDER, TOOL_PLACEHOLDERS } from '../../domain/toolchains/metadata'
import { useT } from '../../i18n'

const { Text } = Typography

const emptyPaths = Object.fromEntries(TOOL_ORDER.map((tool) => [tool, ''])) as Record<ToolName, string>

function pathsFromStatuses(statuses: ToolStatus[]): Record<ToolName, string> {
  return {
    ...emptyPaths,
    ...Object.fromEntries(statuses.map((item) => [item.tool, item.configuredPath || '']))
  } as Record<ToolName, string>
}

const GlobalToolchainPanel: React.FC = () => {
  const t = useT()
  const [statuses, setStatuses] = useState<ToolStatus[]>([])
  const [paths, setPaths] = useState<Record<ToolName, string>>(emptyPaths)
  const [loading, setLoading] = useState(false)

  const statusMap = useMemo(() => {
    return Object.fromEntries(statuses.map((status) => [status.tool, status])) as Record<ToolName, ToolStatus>
  }, [statuses])

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.system.checkTools()
      setStatuses(result)
      setPaths(pathsFromStatuses(result))
    } finally {
      setLoading(false)
    }
  }

  const savePath = async (tool: ToolName, explicitPath?: string) => {
    setLoading(true)
    try {
      const result = await window.electronAPI.system.setToolPath(tool, explicitPath ?? paths[tool] ?? '')
      setStatuses(result)
      setPaths(pathsFromStatuses(result))
    } finally {
      setLoading(false)
    }
  }

  const chooseDirectory = async (tool: ToolName) => {
    const directory = await window.electronAPI.selectDirectory()
    if (!directory) return
    setPaths((prev) => ({ ...prev, [tool]: directory }))
    await savePath(tool, directory)
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={16}>
      <Alert
        type="info"
        showIcon
        title={t('toolchain.globalTitle')}
        description={t('toolchain.globalDescription')} />
      <Table
        dataSource={TOOL_ORDER.map((tool) => ({ tool }))}
        rowKey="tool"
        size="small"
        pagination={false}
        scroll={{ x: 1040 }}
        columns={[
          {
            title: t('common.tool'),
            dataIndex: 'tool',
            key: 'tool',
            width: 140,
            render: (tool: ToolName) => TOOL_LABELS[tool]
          },
          {
            title: t('toolchain.globalDefaultPath'),
            key: 'path',
            width: 380,
            render: (_: any, record: { tool: ToolName }) => (
              <Input
                value={paths[record.tool]}
                onChange={(event) => setPaths((prev) => ({ ...prev, [record.tool]: event.target.value }))}
                placeholder={TOOL_PLACEHOLDERS[record.tool]}
              />
            )
          },
          {
            title: t('common.currentVersion'),
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
            width: 330,
            render: (_: any, record: { tool: ToolName }) => (
              <Space>
                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => chooseDirectory(record.tool)} loading={loading}>
                  {t('common.select')}
                </Button>
                <Button size="small" icon={<SaveOutlined />} onClick={() => savePath(record.tool)} loading={loading}>
                  {t('common.save')}
                </Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => savePath(record.tool, '')} loading={loading}>
                  {t('common.clear')}
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => window.electronAPI.system.openToolDownload(record.tool)}>
                  {t('common.download')}
                </Button>
              </Space>
            )
          }
        ]}
      />
      <Text type="secondary">{t('toolchain.pathHint')}</Text>
      <Button icon={<ReloadOutlined />} onClick={loadTools} loading={loading}>{t('toolchain.redetect')}</Button>
    </Space>
  )
}

export default GlobalToolchainPanel
