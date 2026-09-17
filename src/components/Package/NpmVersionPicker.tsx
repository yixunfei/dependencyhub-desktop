import React from 'react'
import { Button, Empty, Space, Tag, Tooltip } from 'antd'
import { CheckCircleOutlined, ExperimentOutlined } from '@ant-design/icons'
import {
  channelLabel,
  formatShortDate,
  hasMoreVersions,
  VERSION_PAGE_SIZE,
  visibleVersions
} from '../../utils/npmVersions'
import { useT } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'
import styles from './NpmVersionPicker.module.css'

interface NpmVersionPickerProps {
  stable: NpmVersionInfo[]
  prerelease: NpmVersionInfo[]
  currentVersion?: string
  latestVersion?: string
  stablePage: number
  prereleasePage: number
  onStablePageChange: (page: number) => void
  onPrereleasePageChange: (page: number) => void
  onSelect: (version: string) => void
}

export const NpmVersionPicker: React.FC<NpmVersionPickerProps> = ({
  stable,
  prerelease,
  currentVersion,
  latestVersion,
  stablePage,
  prereleasePage,
  onStablePageChange,
  onPrereleasePageChange,
  onSelect
}) => {
  const t = useT()
  if (stable.length === 0 && prerelease.length === 0) {
    return <Empty description={t('package.noVersionInfo')} />
  }

  return (
    <div className={styles.container}>
      <VersionSection
        title={t('package.stableVersions')}
        hint={t('package.stableHint')}
        icon={<CheckCircleOutlined />}
        color="green"
        items={stable}
        page={stablePage}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        onPageChange={onStablePageChange}
        onSelect={onSelect}
      />
      <VersionSection
        title={t('package.prereleaseVersions')}
        hint={t('package.prereleaseHint')}
        icon={<ExperimentOutlined />}
        color="gold"
        items={prerelease}
        page={prereleasePage}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        onPageChange={onPrereleasePageChange}
        onSelect={onSelect}
      />
    </div>
  )
}

interface VersionSectionProps {
  title: string
  hint: string
  icon: React.ReactNode
  color: string
  items: NpmVersionInfo[]
  page: number
  currentVersion?: string
  latestVersion?: string
  onPageChange: (page: number) => void
  onSelect: (version: string) => void
}

const VersionSection: React.FC<VersionSectionProps> = ({
  title,
  hint,
  icon,
  color,
  items,
  page,
  currentVersion,
  latestVersion,
  onPageChange,
  onSelect
}) => {
  const t = useT()
  const language = useSettingsStore((state) => state.language)
  const visible = visibleVersions(items, page)
  const hasMore = hasMoreVersions(items, page)

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <Tag color={color} icon={icon}>{title}</Tag>
          <span className={styles.emptySection}>{t('package.versionCount', { count: items.length })}</span>
        </div>
      </div>
      <p className={styles.sectionHint}>{hint}</p>
      {items.length === 0 ? (
        <span className={styles.emptySection}>{t('package.noVersions')}</span>
      ) : (
        <>
          <div className={styles.versions}>
            {visible.map((item) => (
              <Tooltip
                key={item.version}
                title={[
                  item.tags?.length ? `dist-tag: ${item.tags.join(', ')}` : '',
                  item.date ? t('package.publishedAt', { date: formatShortDate(item.date, language) }) : '',
                  item.prerelease ? t('package.channel', { channel: channelLabel(item.channel, t) }) : ''
                ].filter(Boolean).join(t('common.detailSeparator'))}
              >
                <Tag
                  className={styles.versionTag}
                  color={resolveVersionColor(item, currentVersion, latestVersion)}
                  onClick={() => onSelect(item.version)}
                >
                  <Space size={4}>
                    <span>{item.version}</span>
                    {item.version === latestVersion && <span>latest</span>}
                    {item.tags?.filter((tag) => tag !== 'latest').slice(0, 2).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </Space>
                </Tag>
              </Tooltip>
            ))}
          </div>
          {hasMore && (
            <Button className={styles.loadMore} onClick={() => onPageChange(page + 1)}>
              {t('package.loadMore', { count: VERSION_PAGE_SIZE })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function resolveVersionColor(item: NpmVersionInfo, currentVersion?: string, latestVersion?: string): string {
  if (item.version === currentVersion) return 'blue'
  if (item.version === latestVersion) return 'green'
  if (item.prerelease) return 'gold'
  return 'default'
}
