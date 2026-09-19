// Locale dictionaries split by language. scripts/verify-i18n.mjs guards key parity,
// duplicate keys, empty values, and placeholder parity between en-US and zh-CN.
import { enUS } from './dictionaries/en-US'
import { zhCN } from './dictionaries/zh-CN'

export const dictionaries = {
  'en-US': enUS,
  'zh-CN': zhCN
} as const

export type TranslationKey = keyof typeof dictionaries['en-US']
