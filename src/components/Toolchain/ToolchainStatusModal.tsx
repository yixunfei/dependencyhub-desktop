import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Modal, Space, Table, Tag, Tooltip } from 'antd'
import { DownloadOutlined, FolderOpenOutlined, ReloadOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons'
import { STARTUP_REQUIRED_TOOLS, TOOL_LABELS, TOOL_PLACEHOLDERS } from '../../domain/toolchains/metadata'
import { useT } from '../../i18n'

const ToolchainStatusModal: React.FC = () => {
  const t = useT()
  const [statuses, setStatuses] = useState<ToolStatus[]>([])
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkTools()
  }, [])

  const unavailable = useMemo(
    () => statuses.filter((item) => STARTUP_REQUIRED_TOOLS.includes(item.tool) && !item.available),
    [statuses]
  )
  const unavailableLabels = unavailable.map((item) => TOOL_LABELS[item.tool]).join(t('common.enumerationSeparator'))

  const checkTools = async () => {
    if (!window.electronAPI?.system?.checkTools) return
    setLoading(true)
    try {
      const result = await window.electronAPI.system.checkTools()
      setStatuses(result)
      setPaths(Object.fromEntries(result.map((item) => [item.tool, item.configuredPath || ''])))
      setVisible(result.some((item) => STARTUP_REQUIRED_TOOLS.includes(item.tool) && !item.available))
    } finally {
      setLoading(false)
    }
  }

  const savePath = async (tool: ToolName) => {
    setLoading(true)
    try {
      const result = await window.electronAPI.system.setToolPath(tool, paths[tool] || '')
      setStatuses(result)
      setVisible(result.some((item) => STARTUP_REQUIRED_TOOLS.includes(item.tool) && !item.available))
    } finally {
      setLoading(false)
    }
  }

  const chooseDirectory = async (tool: ToolName) => {
    const directory = await window.electronAPI.selectDirectory()
    if (!directory) return
    setPaths((prev) => ({ ...prev, [tool]: directory }))
    setLoading(true)
    try {
      const result = await window.electronAPI.system.setToolPath(tool, directory)
      setStatuses(result)
      setVisible(result.some((item) => STARTUP_REQUIRED_TOOLS.includes(item.tool) && !item.available))
    } finally {
      setLoading(false)
    }
  }

  if (statuses.length === 0) return null

  return (
    <Modal
      title={<Space><SettingOutlined />{t('toolchain.baseCommandTitle')}</Space>}
      open={visible && unavailable.length > 0}
      onCancel={() => setVisible(false)}
      footer={
        <Space>
          <Button onClick={() => setVisible(false)}>{t('toolchain.later')}</Button>
          <Button icon={<ReloadOutlined />} onClick={checkTools} loading={loading}>{t('toolchain.redetect')}</Button>
        </Space>
      }
      width={840}
    >
      <Alert
        type="warning"
        showIcon
        title={t('toolchain.unavailableDetected', { tools: unavailableLabels })}
        description={t('toolchain.unavailableDescription')}
        style={{ marginBottom: 16 }}
      />
      <Table
        dataSource={unavailable}
        rowKey="tool"
        size="small"
        pagination={false}
        columns={[
          {
            title: t('common.tool'),
            dataIndex: 'tool',
            key: 'tool',
            width: 130,
            render: (tool: ToolName) => TOOL_LABELS[tool]
          },
          {
            title: t('common.status'),
            key: 'status',
            width: 130,
            render: (_: any, record: ToolStatus) => (
              record.available
                ? <Tag color="green">{record.version || t('common.available')}</Tag>
                : <Tooltip title={record.message}><Tag color="red">{t('common.unavailable')}</Tag></Tooltip>
            )
          },
          {
            title: t('toolchain.commandDirectory'),
            key: 'path',
            render: (_: any, record: ToolStatus) => (
              <Input
                value={paths[record.tool] || ''}
                onChange={(event) => setPaths((prev) => ({ ...prev, [record.tool]: event.target.value }))}
                placeholder={TOOL_PLACEHOLDERS[record.tool] || 'Example: executable directory or binary path'}
              />
            )
          },
          {
            title: t('common.actions'),
            key: 'action',
            width: 260,
            render: (_: any, record: ToolStatus) => (
              <Space>
                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => chooseDirectory(record.tool)} loading={loading}>
                  {t('toolchain.selectDirectory')}
                </Button>
                <Button size="small" icon={<SaveOutlined />} onClick={() => savePath(record.tool)} loading={loading}>
                  {t('common.save')}
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => window.electronAPI.system.openToolDownload(record.tool)}>
                  {t('common.download')}
                </Button>
              </Space>
            )
          }
        ]}
      />
    </Modal>
  )
}

export default ToolchainStatusModal
