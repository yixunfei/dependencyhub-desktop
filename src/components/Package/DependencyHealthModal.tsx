import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Modal, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd'
import { CopyOutlined, FileTextOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { useT, type TranslationKey } from '../../i18n'

const { Paragraph, Text } = Typography

interface DependencyHealthModalProps {
  visible: boolean
  manager: DependencyHealthManager
  cwd: string
  onClose: () => void
  onScanned?: (result: DependencyHealthScanResult) => void
}

const severityColor: Record<DependencyHealthSeverity, string> = {
  critical: 'red',
  high: 'red',
  medium: 'orange',
  low: 'blue',
  info: 'default'
}

// Issue type -> dictionary key; module scope cannot call `useT`, so resolve at render time.
const typeLabelKeys: Record<DependencyHealthIssueType, TranslationKey> = {
  cycle: 'health.typeCycle',
  'version-conflict': 'health.typeVersionConflict',
  'peer-conflict': 'health.typePeerConflict',
  missing: 'health.typeMissing',
  invalid: 'health.typeInvalid',
  extraneous: 'health.typeExtraneous',
  outdated: 'health.typeOutdated',
  tooling: 'health.typeTooling',
  'native-linkage': 'health.typeNativeLinkage',
  unmanaged: 'health.typeUnmanaged',
  configuration: 'health.typeConfiguration'
}

export const DependencyHealthModal: React.FC<DependencyHealthModalProps> = ({
  visible,
  manager,
  cwd,
  onClose,
  onScanned
}) => {
  const t = useT()
  const addNotification = useAppStore((state) => state.addNotification)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DependencyHealthScanResult | null>(null)
  const [actionRunning, setActionRunning] = useState('')
  const [outputVisible, setOutputVisible] = useState(false)
  const [outputTitle, setOutputTitle] = useState('')
  const [output, setOutput] = useState('')

  const scan = async () => {
    if (!cwd) return
    setLoading(true)
    try {
      const nextResult = await window.electronAPI.dependencyHealth.scan(manager, cwd)
      setResult(nextResult)
      onScanned?.(nextResult)
      addNotification({
        type: nextResult.summary.total > 0 ? 'warning' : 'success',
        message: nextResult.summary.total > 0 ? t('health.scanComplete') : t('health.noIssuesFound'),
        description: nextResult.summary.total > 0 ? t('health.issuesFound', { manager, count: nextResult.summary.total }) : manager
      })
    } catch (error: any) {
      addNotification({ type: 'error', message: t('health.scanFailed'), description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      void scan()
    }
  }, [visible, manager, cwd])

  const summaryText = useMemo(() => {
    if (!result) return ''
    const { summary } = result
    if (summary.total === 0) return t('health.noIssuesSummary')
    return [
      t('health.totalCount', { count: summary.total }),
      summary.critical ? `Critical ${summary.critical}` : '',
      summary.high ? `High ${summary.high}` : '',
      summary.medium ? `Medium ${summary.medium}` : '',
      summary.low ? `Low ${summary.low}` : ''
    ].filter(Boolean).join(' / ')
  }, [result, t])

  const runAction = async (issue: DependencyHealthIssue, action: DependencyHealthAction) => {
    if (action.kind === 'copy') {
      await navigator.clipboard.writeText(action.payload || issue.suggestion)
      addNotification({ type: 'success', message: t('health.fixCopied'), description: issue.dependency || issue.title })
      return
    }

    if (action.kind === 'openFile' && action.target) {
      await window.electronAPI.system.openFile(action.target)
      return
    }

    if (action.kind !== 'command' && action.kind !== 'api') {
      addNotification({ type: 'info', message: t('health.applyManually'), description: issue.suggestion })
      return
    }

    const actionKey = `${issue.id}:${action.id}`
    setActionRunning(actionKey)
    try {
      const actionOutput = await window.electronAPI.dependencyHealth.fix(cwd, action)
      setOutputTitle(action.label)
      setOutput(actionOutput || t('health.actionComplete'))
      setOutputVisible(true)
      addNotification({ type: 'success', message: t('health.actionDone'), description: action.label })
      await scan()
    } catch (error: any) {
      addNotification({ type: 'error', message: t('health.actionFailed'), description: error.message })
    } finally {
      setActionRunning('')
    }
  }

  const columns = [
    {
      title: t('common.severity'),
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: DependencyHealthSeverity) => <Tag color={severityColor[severity]}>{severity.toUpperCase()}</Tag>
    },
    {
      title: t('common.type'),
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type: DependencyHealthIssueType) => <Tag>{typeLabelKeys[type] ? t(typeLabelKeys[type]) : type}</Tag>
    },
    {
      title: t('health.columnDependency'),
      dataIndex: 'dependency',
      key: 'dependency',
      width: 220,
      ellipsis: true,
      render: (text: string) => text ? <Text code>{text}</Text> : '-'
    },
    {
      title: t('health.columnDescription'),
      key: 'description',
      render: (_: unknown, issue: DependencyHealthIssue) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <strong>{issue.title}</strong>
          <Text type="secondary">{issue.description}</Text>
          <Text>{issue.suggestion}</Text>
          {issue.paths?.length ? (
            <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
              {issue.paths.join('\n')}
            </Paragraph>
          ) : null}
        </Space>
      )
    },
    {
      title: t('health.columnActions'),
      key: 'actions',
      width: 230,
      render: (_: unknown, issue: DependencyHealthIssue) => (
        <Space wrap size={6}>
          {issue.actions.slice(0, 3).map((action) => {
            const key = `${issue.id}:${action.id}`
            const icon = action.kind === 'copy'
              ? <CopyOutlined />
              : action.kind === 'openFile'
                ? <FileTextOutlined />
                : <PlayCircleOutlined />
            return (
              <Tooltip key={action.id} title={action.description || action.payload || action.target || action.label}>
                <Button
                  size="small"
                  icon={icon}
                  loading={actionRunning === key}
                  onClick={() => runAction(issue, action)}
                >
                  {action.label}
                </Button>
              </Tooltip>
            )
          })}
        </Space>
      )
    }
  ]

  return (
    <>
      <Modal
        title={t('health.modalTitle', { manager })}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={1120}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type={result?.summary.total ? 'warning' : 'info'}
            showIcon
            message={summaryText || t('health.checkingTree')}
            description={t('health.description')}
            action={<Button icon={<ReloadOutlined />} onClick={scan} loading={loading}>{t('health.rescan')}</Button>} />
          <Spin spinning={loading}>
            {!result || result.issues.length === 0 ? (
              <Empty description={loading ? t('health.scanning') : t('health.noNotices')} />
            ) : (
              <Table
                dataSource={result.issues}
                columns={columns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 8 }}
                scroll={{ x: 1040 }}
              />
            )}
          </Spin>
        </Space>
      </Modal>

      <Modal
        title={outputTitle}
        open={outputVisible}
        onCancel={() => setOutputVisible(false)}
        footer={null}
        width={900}
      >
        <pre style={{
          maxHeight: 520,
          overflow: 'auto',
          margin: 0,
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-tertiary, #1e1e1e)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {output}
        </pre>
      </Modal>
    </>
  )
}
