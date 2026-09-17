import React, { useState } from 'react'
import { Modal, Card, Space, Tag, Typography, Alert, Radio } from 'antd'
import { SafetyOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { useT } from '../../i18n'

const { Text } = Typography

interface PackageConflictModalProps {
  visible: boolean
  packageName: string
  currentVersion: string
  recommendedVersion: string
  safeVersion: string
  onSelect: (version: string | 'skip') => void
  onCancel: () => void
}

export const PackageConflictModal: React.FC<PackageConflictModalProps> = ({
  visible,
  packageName,
  currentVersion,
  recommendedVersion,
  safeVersion,
  onSelect,
  onCancel
}) => {
  const t = useT()
  const [selectedOption, setSelectedOption] = useState<string>('recommended')

  const handleConfirm = () => {
    if (selectedOption === 'skip') {
      onSelect('skip')
    } else if (selectedOption === 'recommended') {
      onSelect(recommendedVersion)
    } else {
      onSelect(safeVersion)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          <span>{t('package.versionConflict')}</span>
        </Space>
      }
      open={visible}
      onOk={handleConfirm}
      onCancel={onCancel}
      okText={t('package.confirmSelection')}
      cancelText={t('common.cancel')}
      width={700}
    >
      <Alert
        title={t('package.conflictTitle')}
        description={
          <span>
            {t('package.conflictIntroPrefix')} <Text strong>{packageName}</Text> {t('package.conflictIntroSuffix')}
            {t('package.conflictPrompt')}
          </span>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">{t('package.currentVersionLabel')}</Text>
        <Tag style={{ marginLeft: 8 }}>v{currentVersion}</Tag>
      </div>

      <Radio.Group
        value={selectedOption}
        onChange={(e) => setSelectedOption(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Radio value="recommended" style={{ width: '100%' }}>
            <Card size="small" style={{ marginLeft: 8, borderColor: selectedOption === 'recommended' ? '#1890ff' : undefined }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <div>
                  <div>
                    <Text strong>{t('package.recommendedVersion')}</Text>
                    <Tag color="green" style={{ marginLeft: 8 }}>{t('package.preferCompatibility')}</Tag>
                  </div>
                  <Text type="secondary">v{recommendedVersion}</Text>
                </div>
              </Space>
            </Card>
          </Radio>

          <Radio value="safe" style={{ width: '100%' }}>
            <Card size="small" style={{ marginLeft: 8, borderColor: selectedOption === 'safe' ? '#faad14' : undefined }}>
              <Space>
                <SafetyOutlined style={{ color: '#faad14', fontSize: 20 }} />
                <div>
                  <div>
                    <Text strong>{t('package.securityVersion')}</Text>
                    <Tag color="orange" style={{ marginLeft: 8 }}>{t('package.preferSecurity')}</Tag>
                    <Tag color="red" style={{ marginLeft: 8 }}>{t('package.hasSecurityFix')}</Tag>
                  </div>
                  <Text type="secondary">v{safeVersion}</Text>
                </div>
              </Space>
            </Card>
          </Radio>

          <Radio value="skip" style={{ width: '100%' }}>
            <Card size="small" style={{ marginLeft: 8, borderColor: selectedOption === 'skip' ? '#d9d9d9' : undefined }}>
              <Space>
                <div style={{ width: 20 }}></div>
                <div>
                  <div><Text strong>{t('package.skipPackage')}</Text></div>
                  <Text type="secondary">{t('package.skipPackageHint')}</Text>
                </div>
              </Space>
            </Card>
          </Radio>
        </Space>
      </Radio.Group>
    </Modal>
  )
}
