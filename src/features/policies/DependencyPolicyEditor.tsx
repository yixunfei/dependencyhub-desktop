import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Divider, Form, Input, InputNumber, Modal, Select, Space, Switch, Typography } from 'antd'
import { getManagerDefinition, MANAGER_DEFINITIONS, type DependencyManagerId } from '../../domain/managers/registry'
import { useT } from '../../i18n'

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
  const t = useT()
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
      title={t('policy.editorTitle')}
      open={open}
      onCancel={onClose}
      onOk={savePolicy}
      confirmLoading={saving}
      okText={t('policy.save')}
      cancelText={t('common.cancel')}
      width={920}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title={t('policy.writesToProject')}
          description={policyPath || (projectPath ? `${projectPath}\\.npmDesktopManager\\dependency-policy.json` : t('health.selectProjectFirst'))}
        />
        {managerOverlap.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title={t('policy.managerOverlap')}
            description={managerOverlap.map((manager) => getManagerDefinition(manager)?.shortName || manager).join(t('common.enumerationSeparator'))}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_FORM_VALUES}
          disabled={loading || !projectPath}
        >
          <Space size={24} wrap>
            <Form.Item name="requirePinnedVersions" valuePropName="checked" label={t('policy.requirePinned')}>
              <Switch />
            </Form.Item>
            <Form.Item name="disallowPrerelease" valuePropName="checked" label={t('policy.disallowPrerelease')}>
              <Switch />
            </Form.Item>
            <Form.Item name="requireKnownLicenses" valuePropName="checked" label={t('policy.requireKnownLicenses')}>
              <Switch />
            </Form.Item>
            <Form.Item name="maxComponents" label={t('policy.maxComponents')}>
              <InputNumber min={1} precision={0} placeholder={t('common.unlimited')} />
            </Form.Item>
          </Space>

          <Form.Item name="allowedManagers" label={t('policy.allowedManagers')}>
            <Select
              mode="multiple"
              allowClear
              options={managerOptions}
              placeholder={t('policy.allowedManagersHint')}
            />
          </Form.Item>

          <Form.Item name="blockedManagers" label={t('policy.blockedManagers')}>
            <Select
              mode="multiple"
              allowClear
              options={managerOptions}
              placeholder={t('policy.blockedManagersHint')}
            />
          </Form.Item>

          <Form.Item name="blockedPackages" label={t('policy.blockedPackages')}>
            <Select
              mode="tags"
              tokenSeparators={[',', '\n', ' ']}
              placeholder={t('policy.blockedPackagesHint')}
            />
          </Form.Item>

          <Form.Item name="allowedLicenses" label={t('policy.allowedLicenses')}>
            <Select
              mode="tags"
              allowClear
              tokenSeparators={[',', '\n', ' ']}
              options={LICENSE_PRESETS.map((license) => ({ value: license, label: license }))}
              placeholder={t('policy.allowedLicensesHint')}
            />
          </Form.Item>

          <Form.Item name="blockedLicenses" label={t('policy.blockedLicenses')}>
            <Select
              mode="tags"
              allowClear
              tokenSeparators={[',', '\n', ' ']}
              options={LICENSE_PRESETS.map((license) => ({ value: license, label: license }))}
              placeholder={t('policy.blockedLicensesHint')}
            />
          </Form.Item>

          <Divider />
          <Form.List name="packageRules">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space align="center" wrap>
                  <Text strong>{t('policy.packageRules')}</Text>
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
                    {t('policy.addRule')}
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
                        <Form.Item name={[field.name, 'id']} label={t('policy.ruleId')} rules={[{ required: true }]}>
                          <Input placeholder="frontend-critical" style={{ width: 180 }} />
                        </Form.Item>
                        <Form.Item name={[field.name, 'severity']} label={t('common.severity')}>
                          <Select
                            style={{ width: 140 }}
                            options={['critical', 'high', 'medium', 'low', 'info'].map((severity) => ({
                              value: severity,
                              label: severity
                            }))}
                          />
                        </Form.Item>
                        <Form.Item name={[field.name, 'managers']} label={t('common.managers')}>
                          <Select
                            mode="multiple"
                            allowClear
                            style={{ minWidth: 220 }}
                            options={managerOptions}
                            placeholder={t('policy.allManagers')}
                          />
                        </Form.Item>
                        <Button danger size="small" onClick={() => remove(field.name)}>
                          {t('common.remove')}
                        </Button>
                      </Space>
                      <Form.Item name={[field.name, 'description']} label={t('common.description')}>
                        <Input placeholder={t('policy.descriptionHint')} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'packagePatterns']} label={t('policy.packagePatterns')} rules={[{ required: true }]}>
                        <Select
                          mode="tags"
                          tokenSeparators={[',', '\n', ' ']}
                          placeholder="@company/*, react*, com.acme:*"
                        />
                      </Form.Item>
                      <Space size={24} wrap>
                        <Form.Item name={[field.name, 'blocked']} valuePropName="checked" label={t('policy.blockMatches')}>
                          <Switch />
                        </Form.Item>
                        <Form.Item name={[field.name, 'requirePinnedVersions']} valuePropName="checked" label={t('policy.requirePinnedShort')}>
                          <Switch />
                        </Form.Item>
                        <Form.Item name={[field.name, 'disallowPrerelease']} valuePropName="checked" label={t('policy.noPrereleaseShort')}>
                          <Switch />
                        </Form.Item>
                        <Form.Item name={[field.name, 'requireKnownLicenses']} valuePropName="checked" label={t('policy.knownLicenseShort')}>
                          <Switch />
                        </Form.Item>
                      </Space>
                      <Space size={12} wrap style={{ width: '100%' }}>
                        <Form.Item name={[field.name, 'allowedLicenses']} label={t('policy.allowedLicenses')}>
                          <Select
                            mode="tags"
                            allowClear
                            tokenSeparators={[',', '\n', ' ']}
                            options={LICENSE_PRESETS.map((license) => ({ value: license, label: license }))}
                            style={{ minWidth: 280 }}
                          />
                        </Form.Item>
                        <Form.Item name={[field.name, 'blockedLicenses']} label={t('policy.blockedLicenses')}>
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

          <Text type="secondary">{t('policy.editorFooterHint')}</Text>
        </Form>
      </Space>
    </Modal>
  )
}

export default DependencyPolicyEditor
