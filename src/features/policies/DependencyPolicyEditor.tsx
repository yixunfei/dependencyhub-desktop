import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Divider, Form, Input, InputNumber, Modal, Select, Space, Switch, Typography } from 'antd'
import { getManagerDefinition, MANAGER_DEFINITIONS, type DependencyManagerId } from '../../domain/managers/registry'

const { Text } = Typography

interface DependencyPolicyEditorProps {
  open: boolean
  projectPath?: string
  onClose: () => void
  onSaved?: (result: DependencyPolicyFile) => void
}

type PolicyFormValues = Omit<DependencyPolicy, 'maxComponents'> & {
  maxComponents?: number | null
}

const LICENSE_PRESETS = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'LGPL-2.1',
  'LGPL-3.0',
  'GPL-2.0',
  'GPL-3.0',
  'AGPL-3.0',
  'UNLICENSED'
]

const DEFAULT_FORM_VALUES: PolicyFormValues = {
  requirePinnedVersions: true,
  disallowPrerelease: true,
  requireKnownLicenses: false,
  blockedManagers: [],
  blockedPackages: [],
  blockedLicenses: [],
  allowedLicenses: [],
  allowedManagers: [],
  packageRules: [],
  maxComponents: null
}

const DependencyPolicyEditor: React.FC<DependencyPolicyEditorProps> = ({
  open,
  projectPath,
  onClose,
  onSaved
}) => {
  const [form] = Form.useForm<PolicyFormValues>()
  const [policyPath, setPolicyPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const managerOptions = useMemo(() => {
    return MANAGER_DEFINITIONS.map((manager) => ({
      value: manager.id,
      label: `${manager.shortName} - ${manager.language}`
    }))
  }, [])

  useEffect(() => {
    if (!open || !projectPath) return
    void loadPolicy(projectPath)
  }, [open, projectPath])

  const loadPolicy = async (path: string) => {
    setLoading(true)
    try {
      const result = await window.electronAPI.supplyChain.getPolicy(path)
      setPolicyPath(result.path)
      form.setFieldsValue({
        ...DEFAULT_FORM_VALUES,
        ...result.policy,
        maxComponents: result.policy.maxComponents ?? null
      })
    } finally {
      setLoading(false)
    }
  }

  const savePolicy = async () => {
    if (!projectPath) return
    const values = await form.validateFields()
    const policy: DependencyPolicy = {
      requirePinnedVersions: Boolean(values.requirePinnedVersions),
      disallowPrerelease: Boolean(values.disallowPrerelease),
      requireKnownLicenses: Boolean(values.requireKnownLicenses),
      blockedManagers: values.blockedManagers || [],
      blockedPackages: values.blockedPackages || [],
      blockedLicenses: values.blockedLicenses || [],
      allowedLicenses: values.allowedLicenses || [],
      allowedManagers: values.allowedManagers || [],
      packageRules: values.packageRules || [],
      maxComponents: values.maxComponents || undefined
    }

    setSaving(true)
    try {
      const result = await window.electronAPI.supplyChain.savePolicy(projectPath, policy)
      setPolicyPath(result.path)
      onSaved?.(result)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const allowedManagers = Form.useWatch('allowedManagers', form) || []
  const blockedManagers = Form.useWatch('blockedManagers', form) || []
  const managerOverlap = allowedManagers.filter((manager: DependencyManagerId) => blockedManagers.includes(manager))

  return (
    <Modal
      title="依赖策略编辑器"
      open={open}
      onCancel={onClose}
      onOk={savePolicy}
      confirmLoading={saving}
      okText="保存策略"
      cancelText="取消"
      width={920}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="策略会写入项目目录"
          description={policyPath || (projectPath ? `${projectPath}\\.npmDesktopManager\\dependency-policy.json` : '请先选择项目目录')}
        />
        {managerOverlap.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="允许和阻止的管理器存在重叠"
            description={managerOverlap.map((manager) => getManagerDefinition(manager)?.shortName || manager).join('、')}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_FORM_VALUES}
          disabled={loading || !projectPath}
        >
          <Space size={24} wrap>
            <Form.Item name="requirePinnedVersions" valuePropName="checked" label="要求固定版本">
              <Switch />
            </Form.Item>
            <Form.Item name="disallowPrerelease" valuePropName="checked" label="禁止预发布版本">
              <Switch />
            </Form.Item>
            <Form.Item name="requireKnownLicenses" valuePropName="checked" label="要求已知许可证">
              <Switch />
            </Form.Item>
            <Form.Item name="maxComponents" label="组件数量上限">
              <InputNumber min={1} precision={0} placeholder="不限" />
            </Form.Item>
          </Space>

          <Form.Item name="allowedManagers" label="允许的管理器">
            <Select
              mode="multiple"
              allowClear
              options={managerOptions}
              placeholder="留空表示不限制"
            />
          </Form.Item>

          <Form.Item name="blockedManagers" label="阻止的管理器">
            <Select
              mode="multiple"
              allowClear
              options={managerOptions}
              placeholder="选择不允许出现在项目中的生态"
            />
          </Form.Item>

          <Form.Item name="blockedPackages" label="阻止的包名">
            <Select
              mode="tags"
              tokenSeparators={[',', '\n', ' ']}
              placeholder="例如 left-pad、log4j-core"
            />
          </Form.Item>

          <Form.Item name="allowedLicenses" label="允许的许可证">
            <Select
              mode="tags"
              allowClear
              tokenSeparators={[',', '\n', ' ']}
              options={LICENSE_PRESETS.map((license) => ({ value: license, label: license }))}
              placeholder="留空表示不限制许可证白名单"
            />
          </Form.Item>

          <Form.Item name="blockedLicenses" label="阻止的许可证">
            <Select
              mode="tags"
              allowClear
              tokenSeparators={[',', '\n', ' ']}
              options={LICENSE_PRESETS.map((license) => ({ value: license, label: license }))}
              placeholder="例如 GPL-3.0、AGPL-3.0、UNLICENSED"
            />
          </Form.Item>

          <Divider />
          <Form.List name="packageRules">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space align="center" wrap>
                  <Text strong>Package family rules</Text>
                  <Button
                    size="small"
                    onClick={() => add({
                      id: `package-rule-${fields.length + 1}`,
                      packagePatterns: [],
                      managers: [],
                      severity: 'high',
                      blocked: false,
                      requirePinnedVersions: false,
                      disallowPrerelease: false,
                      requireKnownLicenses: false,
                      allowedLicenses: [],
                      blockedLicenses: []
                    })}
                  >
                    Add rule
                  </Button>
                </Space>
                {fields.map((field) => (
                  <div
                    key={field.key}
                    style={{
                      border: '1px solid var(--border-color, #3c3c3c)',
                      borderRadius: 8,
                      padding: 12
                    }}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap align="start" style={{ width: '100%' }}>
                        <Form.Item name={[field.name, 'id']} label="Rule ID" rules={[{ required: true }]}>
                          <Input placeholder="frontend-critical" style={{ width: 180 }} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'severity']} label="Severity">
                          <Select
                            style={{ width: 140 }}
                            options={['critical', 'high', 'medium', 'low', 'info'].map((severity) => ({
                              value: severity,
                              label: severity
                            }))}
                          />
                        </Form.Item>
                        <Form.Item name={[field.name, 'managers']} label="Managers">
                          <Select
                            mode="multiple"
                            allowClear
                            style={{ minWidth: 220 }}
                            options={managerOptions}
                            placeholder="All managers"
                          />
                        </Form.Item>
                        <Button danger size="small" onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      </Space>
                      <Form.Item name={[field.name, 'description']} label="Description">
                        <Input placeholder="Critical UI/runtime dependencies" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'packagePatterns']} label="Package patterns" rules={[{ required: true }]}>
                        <Select
                          mode="tags"
                          tokenSeparators={[',', '\n', ' ']}
                          placeholder="@company/*, react*, com.acme:*"
                        />
                      </Form.Item>
                      <Space size={24} wrap>
                        <Form.Item name={[field.name, 'blocked']} valuePropName="checked" label="Block matches">
                          <Switch />
                        </Form.Item>
                        <Form.Item name={[field.name, 'requirePinnedVersions']} valuePropName="checked" label="Require pinned">
                          <Switch />
                        </Form.Item>
                        <Form.Item name={[field.name, 'disallowPrerelease']} valuePropName="checked" label="No prerelease">
                          <Switch />
                        </Form.Item>
                        <Form.Item name={[field.name, 'requireKnownLicenses']} valuePropName="checked" label="Known license">
                          <Switch />
                        </Form.Item>
                      </Space>
                      <Space size={12} wrap style={{ width: '100%' }}>
                        <Form.Item name={[field.name, 'allowedLicenses']} label="Allowed licenses">
                          <Select
                            mode="tags"
                            allowClear
                            tokenSeparators={[',', '\n', ' ']}
                            options={LICENSE_PRESETS.map((license) => ({ value: license, label: license }))}
                            style={{ minWidth: 280 }}
                          />
                        </Form.Item>
                        <Form.Item name={[field.name, 'blockedLicenses']} label="Blocked licenses">
                          <Select
                            mode="tags"
                            allowClear
                            tokenSeparators={[',', '\n', ' ']}
                            options={LICENSE_PRESETS.map((license) => ({ value: license, label: license }))}
                            style={{ minWidth: 280 }}
                          />
                        </Form.Item>
                      </Space>
                    </Space>
                  </div>
                ))}
              </Space>
            )}
          </Form.List>

          <Text type="secondary">
            保存后可立即在健康中心运行策略检查；未知许可证数量来自当前供应链报告和锁文件解析结果。
          </Text>
        </Form>
      </Space>
    </Modal>
  )
}

export default DependencyPolicyEditor
