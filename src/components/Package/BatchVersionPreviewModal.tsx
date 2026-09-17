import React, { useState, useEffect } from 'react'
import { Modal, Table, Checkbox, Space, Tag, Typography, Tooltip } from 'antd'
import { InfoCircleOutlined, SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons'
import { PackageInfo } from '../../stores/packageStore'
import { resolvePackageUpdateTarget, resolveSmartPackageUpdateTarget, useSettingsStore } from '../../stores/settingsStore'
import semver from 'semver'
import { useT } from '../../i18n'

const { Text } = Typography

interface BatchVersionPreviewModalProps {
  visible: boolean
  packages: PackageInfo[]
  onConfirm: (selectedPackages: string[]) => void
  onCancel: () => void
}

interface PreviewPackage extends PackageInfo {
  selected: boolean
  hasConflict?: boolean
  targetVersion: string
  updateType: 'patch' | 'minor' | 'major' | 'unknown'
}

export const BatchVersionPreviewModal: React.FC<BatchVersionPreviewModalProps> = ({
  visible,
  packages,
  onConfirm,
  onCancel
}) => {
  const t = useT()
  const [previewPackages, setPreviewPackages] = useState<PreviewPackage[]>([])
  const updateStrategy = useSettingsStore((state) => state.updateStrategy)
  const conflictStrategy = useSettingsStore((state) => state.conflictStrategy)
  const [analysisErrors, setAnalysisErrors] = useState<string[]>([])

  useEffect(() => {
    if (visible && packages.length > 0) {
      let cancelled = false
      void (async () => {
        const errors: string[] = []
        const preview = await Promise.all(packages.map(async (pkg) => {
          let targetVersion = resolvePackageUpdateTarget(pkg, updateStrategy) || pkg.version
          if (updateStrategy === 'smart') {
            try {
              targetVersion = (await resolveSmartPackageUpdateTarget(pkg, conflictStrategy)).targetVersion
            } catch {
              errors.push(pkg.name)
            }
          }
          return { ...pkg, selected: true, targetVersion, updateType: getUpdateType(pkg.version, targetVersion) }
        }))
        if (cancelled) return
        setAnalysisErrors(errors)
        setPreviewPackages(preview)
      })()
      return () => { cancelled = true }
    }
  }, [visible, packages, updateStrategy, conflictStrategy])

  const getUpdateType = (current: string, latest: string): 'patch' | 'minor' | 'major' | 'unknown' => {
    try {
      const currentVer = semver.parse(current)
      const latestVer = semver.parse(latest)
      
      if (!currentVer || !latestVer) return 'unknown'
      
      if (latestVer.major > currentVer.major) return 'major'
      if (latestVer.minor > currentVer.minor) return 'minor'
      if (latestVer.patch > currentVer.patch) return 'patch'
      
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  const getUpdateTypeIcon = (type: string) => {
    switch (type) {
      case 'patch':
        return <Tag color="green">{t('package.bumpPatch')}</Tag>
      case 'minor':
        return <Tag color="blue">{t('package.bumpMinor')}</Tag>
      case 'major':
        return <Tag color="orange">{t('package.bumpMajor')}</Tag>
      default:
        return <Tag color="default">{t('common.unknown')}</Tag>
    }
  }

  const getStrategyTag = () => {
    switch (updateStrategy) {
      case 'security':
        return <Tag color="red" icon={<SafetyCertificateOutlined />}>{t('package.preferSecurity')}</Tag>
      case 'latest':
        return <Tag color="purple">{t('package.strategyLatest')}</Tag>
      case 'smart':
        return <Tag color="blue">{t('package.strategySmart')}</Tag>
      default:
        return <Tag color="green">{t('package.strategyRecommended')}</Tag>
    }
  }

  const toggleSelect = (packageName: string, checked: boolean) => {
    setPreviewPackages(prev =>
      prev.map(pkg =>
        pkg.name === packageName ? { ...pkg, selected: checked } : pkg
      )
    )
  }

  const toggleSelectAll = (checked: boolean) => {
    setPreviewPackages(prev =>
      prev.map(pkg => ({ ...pkg, selected: checked }))
    )
  }

  const handleConfirm = () => {
    const selected = previewPackages.filter(pkg => pkg.selected).map(pkg => pkg.name)
    onConfirm(selected)
  }

  const selectedCount = previewPackages.filter(pkg => pkg.selected).length

  const columns = [
    {
      title: (
        <Checkbox
          checked={previewPackages.length > 0 && selectedCount === previewPackages.length}
          indeterminate={selectedCount > 0 && selectedCount < previewPackages.length}
          onChange={(e) => toggleSelectAll(e.target.checked)}
        />
      ),
      key: 'select',
      width: 60,
      render: (_: any, record: PreviewPackage) => (
        <Checkbox
          checked={record.selected}
          onChange={(e) => toggleSelect(record.name, e.target.checked)}
        />
      ),
    },
    {
      title: t('package.columnName'),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: PreviewPackage) => (
        <Space>
          <span>{text}</span>
          {record.outdated && (
            <Tooltip title={t('package.updateAvailable')}>
              <WarningOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t('package.columnCurrentVersion'),
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (text: string) => <Tag>v{text}</Tag>,
    },
    {
      title: t('package.columnTargetVersion'),
      key: 'targetVersion',
      width: 100,
      render: (_: any, record: PreviewPackage) => (
        <Tag color={record.targetVersion !== record.version ? 'blue' : 'green'}>
          v{record.targetVersion}
        </Tag>
      ),
    },
    {
      title: t('package.columnUpdateType'),
      key: 'updateType',
      width: 100,
      render: (_: any, record: PreviewPackage) => getUpdateTypeIcon(record.updateType),
    },
    {
      title: t('package.columnStrategy'),
      key: 'strategy',
      width: 110,
      render: () => getStrategyTag(),
    },
    {
      title: t('common.type'),
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (text: string) => (
        <Tag color={text === 'dependencies' ? 'green' : 'orange'}>
          {text === 'dependencies' ? t('package.prodShort') : t('package.devShort')}
        </Tag>
      ),
    },
  ]

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined />
          <span>{t('package.updatePreview')}</span>
          <Tag color="blue">{selectedCount} / {previewPackages.length}</Tag>
        </Space>
      }
      open={visible}
      onOk={handleConfirm}
      onCancel={onCancel}
      okText={t('package.updateSelected', { count: selectedCount })}
      cancelText={t('common.cancel')}
      width={900}
      okButtonProps={{ disabled: selectedCount === 0 }}
    >
      <div style={{ marginBottom: 16 }}>
        {analysisErrors.length > 0 && (
          <Text type="warning">{t('package.analysisFailed', { errors: analysisErrors.join(t('common.enumerationSeparator')) })}</Text>
        )}
        <Text type="secondary">
          {t('package.confirmUpdatesHint')} {updateStrategy === 'security' ? t('package.securityStrategyHint') : ''}
        </Text>
      </div>
      
      <Table
        dataSource={previewPackages}
        columns={columns}
        rowKey="name"
        size="small"
        pagination={false}
        scroll={{ y: 400 }}
      />
    </Modal>
  )
}
