import React from 'react'
import { Alert, Button, Card, Form, Input, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import { CloudUploadOutlined } from '@ant-design/icons'
import { useT } from '../../../../../i18n'
import type { CredentialOption, PublishFormValues } from './publishTypes'
import styles from './Publish.module.css'

export interface PublishConfigCardProps {
  form: FormInstance<PublishFormValues>
  loading: boolean
  credentialOptions: CredentialOption[]
  onPublish: (values: PublishFormValues) => void
  onReloadCredentials: () => void | Promise<void>
}

/**
 * Publish configuration form: target tag, version, access level, registry,
 * credential vault selection, one-time token, and the readiness gate override.
 * Only rendered when the readiness check passed and edit mode is off.
 */
const PublishConfigCard: React.FC<PublishConfigCardProps> = ({
  form,
  loading,
  credentialOptions,
  onPublish,
  onReloadCredentials
}) => {
  const t = useT()
  return (
    <Card title={t('npm.publish.configTitle')} className={styles.publishCard}>
      <Form
        form={form}
        onFinish={onPublish}
        layout="vertical"
        initialValues={{ tag: 'latest', access: 'public', overrideReadinessGate: false }}
      >
        <Form.Item name="tag" label={t('npm.publish.tagLabel')}>
          <Select>
            <Select.Option value="latest">latest</Select.Option>
            <Select.Option value="next">next</Select.Option>
            <Select.Option value="beta">beta</Select.Option>
            <Select.Option value="alpha">alpha</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="version"
          label={t('npm.publish.versionLabel')}
          rules={[{ required: true, message: t('npm.publish.versionInputRequired') }]}
          extra={t('npm.publish.versionWriteHint')}
        >
          <Input placeholder={t('npm.publish.versionExample')} />
        </Form.Item>

        <Form.Item name="access" label={t('npm.publish.accessLabel')}>
          <Select>
            <Select.Option value="public">{t('npm.publish.accessPublic')}</Select.Option>
            <Select.Option value="restricted">{t('npm.publish.accessRestricted')}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="registry" label={t('npm.publish.registryOptional')}>
          <Input placeholder={t('npm.publish.registryExample')} />
        </Form.Item>

        <Form.Item name="credentialId" label={t('npm.publish.credentialVault')}>
          <Select
            allowClear
            options={credentialOptions}
            placeholder={t('npm.publish.credentialPlaceholder')}
            onOpenChange={(open) => {
              if (open) onReloadCredentials()
            }}
          />
        </Form.Item>

        <Form.Item name="token" label={t('npm.publish.oneTimeToken')}>
          <Input.Password placeholder={t('npm.publish.tokenPlaceholder')} />
        </Form.Item>

        <Form.Item name="saveCredential" valuePropName="checked">
          <Switch checkedChildren={t('npm.publish.saveToVault')} unCheckedChildren={t('npm.publish.doNotSave')} />
        </Form.Item>

        <Alert
          type="warning"
          showIcon
          title={t('npm.publish.gateAlertTitle')}
          description={t('npm.publish.gateAlertDescription')}
          style={{ marginBottom: 16 }}
        />

        <Form.Item name="overrideReadinessGate" valuePropName="checked">
          <Switch checkedChildren={t('npm.publish.overrideGateOn')} unCheckedChildren={t('npm.publish.overrideGateOff')} />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<CloudUploadOutlined />}
            loading={loading}
            size="large"
            block
          >
            {t('npm.publish.submit')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default PublishConfigCard
