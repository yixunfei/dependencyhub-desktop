import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import {
  ApiOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import type { AiProviderConfig, AiProviderInput, AiProviderKind, AiProviderTestResult } from '@shared/aiProviders'
import { useAppStore } from '../../stores/appStore'

const PROVIDER_KIND_OPTIONS: Array<{ value: AiProviderKind; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openai-compatible', label: 'OpenAI-compatible' },
  { value: 'custom', label: 'Custom' }
]

const KIND_COLORS: Record<AiProviderKind, string> = {
  openai: 'green',
  anthropic: 'orange',
  google: 'blue',
  'azure-openai': 'geekblue',
  ollama: 'purple',
  'openai-compatible': 'cyan',
  custom: 'default'
}

interface AiProvidersPageProps {
  /** Anchor target so the MCP registry search panel can be skipped in narrow hosts. */
  initialMode?: 'providers' | 'search'
}

const AiProvidersPage: React.FC<AiProvidersPageProps> = ({ initialMode = 'providers' }) => {
  const addNotification = useAppStore((state) => state.addNotification)
  const [providers, setProviders] = useState<AiProviderConfig[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [encrypted, setEncrypted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<AiProviderTestResult | null>(null)
  const [form] = Form.useForm()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [list, active, status] = await Promise.all([
        window.electronAPI.ai.listProviders(),
        window.electronAPI.ai.getActiveProvider(),
        window.electronAPI.ai.providersStatus()
      ])
      setProviders(list)
      setActiveId(active)
      setEncrypted(status.encrypted)
    } catch (error) {
      addNotification({ type: 'error', message: 'Failed to load AI providers', description: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }, [addNotification])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openEditor = (provider?: AiProviderConfig) => {
    setTestResult(null)
    form.resetFields()
    if (provider) {
      form.setFieldsValue({
        label: provider.label,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        defaultModel: provider.defaultModel,
        models: provider.models.join(', '),
        enabled: provider.enabled
      })
    } else {
      form.setFieldsValue({ kind: 'openai', enabled: true })
    }
    form.setFieldValue('id', provider?.id)
    setEditorOpen(true)
  }

  const submitEditor = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const input: AiProviderInput = {
        id: values.id,
        label: values.label,
        kind: values.kind,
        baseUrl: values.baseUrl,
        defaultModel: values.defaultModel,
        models: typeof values.models === 'string' && values.models.trim()
          ? values.models.split(',').map((model: string) => model.trim()).filter(Boolean)
          : [],
        enabled: values.enabled !== false,
        // Only send a key when the user typed one; blank keeps the stored key.
        apiKey: values.apiKey?.trim() || undefined
      }
      const saved = await window.electronAPI.ai.upsertProvider(input)
      setEditorOpen(false)
      addNotification({
        type: 'success',
        message: values.id ? 'AI provider updated' : 'AI provider added',
        description: `${saved.label} (${saved.kind})`
      })
      await refresh()
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return
      addNotification({ type: 'error', message: 'Failed to save AI provider', description: (error as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const removeProvider = async (provider: AiProviderConfig) => {
    try {
      await window.electronAPI.ai.removeProvider(provider.id)
      addNotification({ type: 'success', message: 'AI provider removed', description: provider.label })
      await refresh()
    } catch (error) {
      addNotification({ type: 'error', message: 'Failed to remove AI provider', description: (error as Error).message })
    }
  }

  const activate = async (provider: AiProviderConfig) => {
    try {
      const next = await window.electronAPI.ai.setActiveProvider(provider.id)
      setActiveId(next)
      addNotification({ type: 'success', message: 'Active AI provider set', description: provider.label })
    } catch (error) {
      addNotification({ type: 'error', message: 'Failed to set the active provider', description: (error as Error).message })
    }
  }

  const testProvider = async (provider: AiProviderConfig) => {
    setTestingId(provider.id)
    setTestResult(null)
    try {
      const result = await window.electronAPI.ai.testProvider(provider.id)
      setTestResult(result)
    } catch (error) {
      addNotification({ type: 'error', message: 'Connection test failed', description: (error as Error).message })
    } finally {
      setTestingId(null)
    }
  }

  const columns = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (_text: string, provider: AiProviderConfig) => (
        <Space>
          <ApiOutlined />
          <Typography.Text strong>{provider.label}</Typography.Text>
          {provider.id === activeId && <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag>}
          {!provider.enabled && <Tag>Disabled</Tag>}
        </Space>
      )
    },
    {
      title: 'Kind',
      dataIndex: 'kind',
      key: 'kind',
      render: (kind: AiProviderKind) => <Tag color={KIND_COLORS[kind]}>{kind}</Tag>
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true
    },
    {
      title: 'Default model',
      dataIndex: 'defaultModel',
      key: 'defaultModel',
      render: (model?: string) => model || <Typography.Text type="secondary">-</Typography.Text>
    },
    {
      title: 'API key',
      key: 'apiKey',
      render: (_text: unknown, provider: AiProviderConfig) => provider.apiKeyConfigured
        ? <Tooltip title={`Stored encrypted (preview ${provider.apiKeyPreview})`}><Tag color="green">Configured</Tag></Tooltip>
        : <Tag color="warning">Not configured</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      render: (_text: unknown, provider: AiProviderConfig) => (
        <Space size="small">
          <Tooltip title="Test connection">
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={testingId === provider.id}
              onClick={() => void testProvider(provider)}
            />
          </Tooltip>
          {provider.id !== activeId && (
            <Tooltip title="Set as active">
              <Button size="small" icon={<CheckCircleOutlined />} onClick={() => void activate(provider)} />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(provider)} />
          </Tooltip>
          <Popconfirm
            title="Remove this provider?"
            description="The stored API key is deleted with it."
            onConfirm={() => void removeProvider(provider)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space>
          <ExperimentOutlined style={{ fontSize: 22 }} />
          <Typography.Title level={3} style={{ margin: 0 }}>AI Providers</Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            Add provider
          </Button>
        </Space>

        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Manage the model providers the AI modules talk to. Provider API keys are stored encrypted at rest and are
          never returned to the UI — only a masked fingerprint is shown. The active provider is used as the default
          target for AI-powered features.
        </Typography.Paragraph>

        {!encrypted && (
          <Alert
            type="warning"
            showIcon
            message="OS secure storage is unavailable"
            description="API keys are stored with a base64 fallback (NOT encrypted). Configure a system keyring to enable encryption."
          />
        )}

        {testResult && (
          <Alert
            type={testResult.ok ? 'success' : 'error'}
            showIcon
            message={testResult.ok ? `Endpoint reachable (${testResult.latencyMs}ms)` : 'Connection test failed'}
            description={`${testResult.endpoint} — ${testResult.detail}`}
            closable
            onClose={() => setTestResult(null)}
          />
        )}

        <Table
          rowKey="id"
          columns={columns}
          dataSource={providers}
          loading={loading}
          pagination={false}
          locale={{ emptyText: initialMode === 'search' ? 'No provider configured yet.' : 'No AI provider configured yet. Add one to get started.' }}
        />
      </Space>

      <Modal
        title={form.getFieldValue('id') ? 'Edit AI provider' : 'Add AI provider'}
        open={editorOpen}
        onOk={() => void submitEditor()}
        confirmLoading={saving}
        onCancel={() => setEditorOpen(false)}
        destroyOnHidden
        width={560}
      >
        {saving && <Spin />}
        <Form form={form} layout="vertical">
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Form.Item
            name="label"
            label="Label"
            rules={[{ required: true, message: 'A label is required.' }]}
          >
            <Input placeholder="Production OpenAI" />
          </Form.Item>
          <Form.Item name="kind" label="Provider kind" rules={[{ required: true }]}>
            <Select options={PROVIDER_KIND_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="baseUrl"
            label="Base URL"
            tooltip="Leave blank to use the default endpoint for the selected provider kind."
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="defaultModel" label="Default model">
            <Input placeholder="gpt-4o-mini / claude-sonnet-4 / gemini-2.0-flash" />
          </Form.Item>
          <Form.Item name="models" label="Models" tooltip="Comma-separated list of models offered by this provider.">
            <Input placeholder="gpt-4o-mini, gpt-4.1, o3-mini" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API key"
            tooltip="Leave blank when editing to keep the stored key. Keys are encrypted before being written to disk."
          >
            <Input.Password placeholder="sk-..." autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AiProvidersPage
