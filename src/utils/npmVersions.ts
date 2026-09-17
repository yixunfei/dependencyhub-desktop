import type { TranslationKey, TranslationParams } from '../i18n'

export const VERSION_PAGE_SIZE = 10

/** The subset of `useT()`'s return type a pure helper needs to label a value. */
export type LabelTranslator = (key: TranslationKey, params?: TranslationParams) => string

export type VersionChannelFilter = 'stable' | 'prerelease' | 'all'

export interface VersionGroup {
  stable: NpmVersionInfo[]
  prerelease: NpmVersionInfo[]
}

export function splitVersionStrings(versions: string[]): VersionGroup {
  const items = versions.map((version) => ({
    version,
    date: '',
    tags: [],
    prerelease: isPrereleaseVersion(version),
    channel: isPrereleaseVersion(version) ? resolvePrereleaseChannel(version, []) : 'stable'
  }))

  return {
    stable: items.filter((item) => !item.prerelease),
    prerelease: items.filter((item) => item.prerelease)
  }
}

export function visibleVersions(items: NpmVersionInfo[], page: number): NpmVersionInfo[] {
  if (page <= 0) return []
  return items.slice(0, Math.max(page, 1) * VERSION_PAGE_SIZE)
}

export function hasMoreVersions(items: NpmVersionInfo[], page: number): boolean {
  return visibleVersions(items, page).length < items.length
}

export function toVersionOptions(items: NpmVersionInfo[], page = 1, t?: LabelTranslator): Array<{ value: string; label: string }> {
  return visibleVersions(items, page).map((item) => ({
    value: item.version,
    label: formatVersionOption(item, t)
  }))
}

export function versionsForFilter(metadata: NpmVersionMetadata, filter: VersionChannelFilter): NpmVersionInfo[] {
  if (filter === 'stable') return metadata.stable
  if (filter === 'prerelease') return metadata.prerelease
  return metadata.versions
}

/**
 * Builds a compact version label such as `1.2.3 [latest] [alpha]`. `t` is only
 * needed for the generic prerelease sentinel; without it the raw channel token
 * is used, which is what the literal npm dist-tags render as anyway.
 */
export function formatVersionOption(item: NpmVersionInfo, t?: LabelTranslator): string {
  const parts = [item.version]
  if (item.tags?.length) parts.push(`[${item.tags.join(', ')}]`)
  if (item.prerelease) parts.push(`[${channelLabel(item.channel, t)}]`)
  if (item.date) parts.push(formatShortDate(item.date))
  return parts.join(' ')
}

export function formatShortDate(date?: string, locale?: string): string {
  if (!date) return ''
  const timestamp = Date.parse(date)
  if (!Number.isFinite(timestamp)) return ''
  return new Date(timestamp).toLocaleDateString(locale)
}

export function channelLabel(channel: string | undefined, t?: LabelTranslator): string {
  switch ((channel || '').toLowerCase()) {
    case 'alpha':
      return 'alpha'
    case 'beta':
      return 'beta'
    case 'rc':
      return 'RC'
    case 'next':
      return 'next'
    case 'canary':
      return 'canary'
    case 'experimental':
      return 'experimental'
    case 'preview':
      return 'preview'
    case 'nightly':
      return 'nightly'
    case 'snapshot':
      return 'snapshot'
    case 'dev':
      return 'dev'
    default:
      return t ? t('versions.channelPrerelease') : 'prerelease'
  }
}

export function isPrereleaseVersion(version: string): boolean {
  return version.includes('-') || /\b(alpha|beta|rc|next|canary|experimental|preview|pre|dev|nightly|snapshot)\b/i.test(version)
}

function resolvePrereleaseChannel(version: string, tags: string[]): string {
  const text = [version, ...tags].join(' ').toLowerCase()
  const channels = ['alpha', 'beta', 'rc', 'next', 'canary', 'experimental', 'preview', 'nightly', 'snapshot', 'dev']
  return channels.find((channel) => text.includes(channel)) || 'prerelease'
}
