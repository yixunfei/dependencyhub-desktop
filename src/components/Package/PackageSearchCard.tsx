import React from 'react'
import { Card, Tag, Button, Space, Tooltip } from 'antd'
import {
  DownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { SearchResult } from '../../stores/searchStore'
import { useT } from '../../i18n'
import styles from './PackageSearchCard.module.css'

interface PackageSearchCardProps {
  pkg: SearchResult
  onInstall: (name: string) => void
  onView: (name: string) => void
}

export const PackageSearchCard: React.FC<PackageSearchCardProps> = ({
  pkg,
  onInstall,
  onView
}) => {
  const t = useT()
  return (
    <Card className={styles.card} hoverable>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.name}>{pkg.name}</h3>
          <Tag color="blue">{pkg.version}</Tag>
        </div>
        <Space>
          <Tooltip title={t('package.viewDetail')}>
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => onView(pkg.name)}
            />
          </Tooltip>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => onInstall(pkg.name)}
          >
            {t('package.install')}
          </Button>
        </Space>
      </div>
      
      <p className={styles.description}>
        {pkg.description || t('common.noDescription')}
      </p>
      
      <div className={styles.meta}>
        {pkg.author && (
          <span className={styles.metaItem}>
            {t('package.author', { name: typeof pkg.author === 'string' ? pkg.author : (pkg.author as any).name || t('common.unknown') })}
          </span>
        )}
        {pkg.date && (
          <span className={styles.metaItem}>
            {t('package.updated', { date: new Date(pkg.date).toLocaleDateString() })}
          </span>
        )}
        {pkg.keywords && pkg.keywords.length > 0 && (
          <div className={styles.keywords}>
            {pkg.keywords.slice(0, 5).map((keyword, index) => (
              <Tag key={index} className={styles.keyword}>
                {keyword}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}