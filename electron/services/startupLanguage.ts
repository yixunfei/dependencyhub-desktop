import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Chooses the language shown before any user preference exists.
 *
 * The installer can stamp the language it was run in, so a Chinese installer
 * starts Chinese without asking; otherwise the app asks once on first launch.
 * Portable builds are detected too, because they cannot write next to the
 * executable and therefore follow different rules elsewhere.
 */
export type AppLanguage = 'zh-CN' | 'en-US'

export interface StartupLanguageInfo {
  language: AppLanguage
  source: 'installer' | 'default'
  shouldPrompt: boolean
  isPackaged: boolean
  isPortable: boolean
}

export function getStartupLanguageInfo(): StartupLanguageInfo {
  const installerLanguage = readInstallerLanguage()
  const isPortable = Boolean(
    process.env.PORTABLE_EXECUTABLE_DIR ||
    process.env.PORTABLE_EXECUTABLE_FILE ||
    process.env.PORTABLE_EXECUTABLE_APP_FILENAME
  )

  return installerLanguage
    ? {
        language: installerLanguage,
        source: 'installer',
        shouldPrompt: false,
        isPackaged: app.isPackaged,
        isPortable
      }
    : {
        language: 'en-US',
        source: 'default',
        shouldPrompt: true,
        isPackaged: app.isPackaged,
        isPortable
      }
}

function readInstallerLanguage(): AppLanguage | null {
  const candidates = [
    join(process.resourcesPath || '', 'default-language.json'),
    join(__dirname, '../default-language.json'),
    join(__dirname, '../../default-language.json')
  ]

  for (const filePath of candidates) {
    try {
      if (!existsSync(filePath)) continue

      const data = JSON.parse(readFileSync(filePath, 'utf8')) as { language?: string }
      if (data.language === 'zh-CN') return 'zh-CN'
      if (data.language === 'en-US') return 'en-US'
    } catch {
      // A malformed stamp file is not worth surfacing; fall through to prompts.
    }
  }

  return null
}
