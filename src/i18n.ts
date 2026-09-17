import { useMemo } from 'react'
import { useSettingsStore } from './stores/settingsStore'
import type { AppLanguage } from './stores/settingsStore'
import { dictionaries, type TranslationKey } from './i18n/dictionaries'
import { EN_LITERAL_TRANSLATIONS } from './i18n/literals'

export type { TranslationKey }
const sortedLiteralEntries = Object.entries(EN_LITERAL_TRANSLATIONS)
  .sort(([left], [right]) => right.length - left.length)

const hasCjk = (value: string) => /[\u3400-\u9fff]/.test(value)

export type TranslationParams = Record<string, string | number>

/**
 * The subset of `useT()`'s return type a pure helper needs to label a value.
 * Module-scope helpers and non-component code take one of these instead of
 * calling `useT()` themselves.
 */
export type LabelTranslator = (key: TranslationKey, params?: TranslationParams) => string

/**
 * Resolves a key for the active language, falling back to English and finally to
 * the key itself. `params` fills `{name}` placeholders; a placeholder with no
 * matching param is left untouched so a mistake is visible rather than silent.
 */
export function translate(language: AppLanguage, key: TranslationKey, params?: TranslationParams): string {
  const template = dictionaries[language]?.[key] || dictionaries['en-US'][key] || key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name])
  )
}

export function translateText(language: AppLanguage, value?: string | number | null): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  if (language !== 'en-US' || !hasCjk(text)) return text

  const leading = text.match(/^\s*/)?.[0] || ''
  const trailing = text.match(/\s*$/)?.[0] || ''
  const core = text.slice(leading.length, text.length - trailing.length)
  const exact = EN_LITERAL_TRANSLATIONS[core]

  if (exact) return `${leading}${exact}${trailing}`
  if (core.length > 300) return text

  let translated = core
  for (const [source, target] of sortedLiteralEntries) {
    if (translated.includes(source)) {
      translated = translated.split(source).join(target)
    }
  }

  translated = translated
    .replace(/（/g, ' (')
    .replace(/）/g, ')')
    .replace(/，/g, ', ')
    .replace(/、/g, ', ')
    .replace(/。/g, '. ')
    .replace(/：/g, ': ')
    .replace(/；/g, '; ')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/[ \t]+([,.:;!?])/g, '$1')
    .replace(/([,;!?])([^\s)\]}])/g, '$1 $2')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd()

  return `${leading}${translated}${trailing}`
}

export function useT() {
  const language = useSettingsStore((state) => state.language)
  // Memoized on the language so `t` keeps a stable identity between renders.
  // Callers can then list it in a dependency array without the memo re-running
  // on every render, and a language switch still invalidates it.
  return useMemo(
    () => (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
    [language]
  )
}

export function useTextT() {
  const language = useSettingsStore((state) => state.language)
  return useMemo(() => (value?: string | number | null) => translateText(language, value), [language])
}

