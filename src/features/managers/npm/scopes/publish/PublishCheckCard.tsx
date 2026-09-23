import React from 'react'
import { Alert, Button, Card, Descriptions, Form, Input, Space, Switch, Tag } from 'antd'
import type { FormInstance } from 'antd'
import { EditOutlined, SaveOutlined, WarningOutlined } from '@ant-design/icons'
import { useT } from '../../../../../i18n'
import type { PublishCheckResult, PublishFormValues } from './publishTypes'
import styles from './Publish.module.css'

/**
 * Renders one findings group (errors or warnings) as a tag list. Returns null
 * when the group is empty so callers do not need their own length guards.
 */
const FindingsBlock: React.FC<{
  className: string
  icon?: React.ReactNode
  title: string
  findings: string[]
  color: 'error' | 'warning'
}> = ({ className, icon, title, findings, color }) => {
  if (findings.length === 0) return null
  return (
    <div className={className}>
      <h4>{icon} {title}</h4>
      {findings.map((finding, index) => (
        <Tag key={index} color={color}>{finding}</Tag>
      ))}
    </div>
  )
}

/** Editable form over the package.json summary fields (edit mode). */
const PackageEditForm: React.FC<{ form: FormInstance<PublishFormValues> }> = ({ form }) => {
  const t = useT()
  return (
    <Form form={form} layout="vertical">
      <Form.Item name="name" label={t('npm.publish.fieldName')} rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="version" label={t('npm.publish.fieldVersion')} rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label={t('npm.publish.fieldDescription')}>
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item name="license" label={t('npm.publish.fieldLicense')}>
        <Input />
      </Form.Item>
      <Form.Item name="author" label={t('npm.publish.fieldAuthor')}>
        <Input />
      </Form.Item>
      <Form.Item name="homepage" label={t('npm.publish.fieldHomepage')}>
        <Input />
      </Form.Item>
      <Form.Item name="repository" label={t('npm.publish.fieldRepository')}>
        <Input />
      </Form.Item>
    </Form>
  )
}

/** Read-only descriptions plus error and warning findings (view mode). */
const PackageReadonlyView: React.FC<{ checkResult: PublishCheckResult }> = ({ checkResult }) => {
  const t = useT()
  const info = checkResult.packageInfo
  return (
    <>
      {info && (
        <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t('npm.publish.fieldName')}>{info.name}</Descriptions.Item>
          <Descriptions.Item label={t('npm.publish.fieldVersion')}>{info.version}</Descriptions.Item>
          <Descriptions.Item label={t('npm.publish.fieldDescription')}>{info.description || t('npm.publish.none')}</Descriptions.Item>
          <Descriptions.Item label={t('npm.publish.fieldLicense')}>{info.license || t('npm.publish.none')}</Descriptions.Item>
          <Descriptions.Item label={t('npm.publish.mainEntry')}>{info.main || 'index.js'}</Descriptions.Item>
        </Descriptions>
      )}
      <FindingsBlock
        className={styles.errorList}
        icon={<WarningOutlined />}
        title={t('npm.publish.errorCount', { count: checkResult.errors.length })}
        findings={checkResult.errors}
        color="error"
      />
      <FindingsBlock
        className={styles.warningList}
        title={t('npm.publish.warningCount', { count: checkResult.warnings.length })}
        findings={checkResult.warnings}
        color="warning"
      />
    </>
  )
}

export interface PublishCheckCardProps {
  form: FormInstance<PublishFormValues>
  checkResult: PublishCheckResult
  editMode: boolean
  onEditModeChange: (editMode: boolean) => void
  saveLoading: boolean
  onSave: () => void
}

/**
 * Readiness check card: pass/fail banner plus the package summary, either as
 * an editable form (edit mode) or as read-only descriptions with error and
 * warning findings.
 */
const PublishCheckCard: React.FC<PublishCheckCardProps> = ({
  form,
  checkResult,
  editMode,
  onEditModeChange,
  saveLoading,
  onSave
}) => {
  const t = useT()
  return (
    <Card
      title={
        <Space>
          <span>{t('npm.publish.checkResultTitle')}</span>
          {checkResult.packageInfo && (
            <Switch
              checked={editMode}
              onChange={onEditModeChange}
              checkedChildren={<EditOutlined />}
              unCheckedChildren={t('npm.publish.viewMode')}
            />
          )}
        </Space>
      }
      className={styles.checkCard}
      extra={editMode && (
        <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saveLoading}>
          {t('npm.publish.save')}
        </Button>
      )}
    >
      {checkResult.canPublish ? (
        <Alert
          title={t('npm.publish.checkPassed')}
          description={t('npm.publish.checkPassedDescription')}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          title={t('npm.publish.checkFailedTitle')}
          description={t('npm.publish.checkFailedDescription')}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {editMode ? <PackageEditForm form={form} /> : <PackageReadonlyView checkResult={checkResult} />}
    </Card>
  )
}

export default PublishCheckCard
