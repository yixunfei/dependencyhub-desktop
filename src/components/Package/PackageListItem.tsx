import React from 'react'
import { Tag, Button, Space, Popconfirm, Tooltip } from 'antd'
import {
  DeleteOutlined,
  SyncOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { PackageInfo } from '../../stores/packageStore'
import { useT } from '../../i18n'
import styles from './PackageListItem.module.css'

interface PackageListItemProps {
  pkg: PackageInfo
  onUpdate: (name: string) => void
  onUninstall: (name: string) => void
  showType?: boolean
}

/**
 * Memoised because this renders once per dependency: without it any parent state
 * change (filter term, selection, pending install) re-rendered every row.
 */
export const PackageListItem: React.FC<PackageListItemProps> = React.memo(({
  pkg,
  onUpdate,
  onUninstall,
  showType = false
}) => {
  const t = useT()
  return (
    <div className={styles.item}>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{pkg.name}</span>
          {pkg.outdated && (
            <Tooltip title={t('package.updateAvailable')}>
              <WarningOutlined className={styles.warning} />
            </Tooltip>
          )}
          {showType && pkg.type && (
            <Tag color={pkg.type === 'dependencies' ? 'green' : 'orange'}>
              {pkg.type === 'dependencies' ? t('package.prodDependency') : t('package.devDependency')}
            </Tag>
          )}
        </div>
        <div className={styles.versionRow}>
          <span className={styles.version}>{t('package.currentVersionShort', { version: pkg.version })}</span>
          {pkg.latest && pkg.latest !== pkg.version && (
            <span className={styles.latest}>{t('package.latestVersionShort', { version: pkg.latest })}</span>
          )}
        </div>
      </div>
      
      <Space className={styles.actions}>
        {pkg.outdated && (
          <Tooltip title={t('package.updateToLatest')}>
            <Button
              type="default"
              size="small"
              icon={<SyncOutlined />}
              onClick={() => onUpdate(pkg.name)}
            >
              {t('common.update')}
            </Button>
          </Tooltip>
        )}
        <Popconfirm
          title={t('package.confirmUninstall')}
          onConfirm={() => onUninstall(pkg.name)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
          >
            {t('package.uninstall')}
          </Button>
        </Popconfirm>
      </Space>
    </div>
  )
})