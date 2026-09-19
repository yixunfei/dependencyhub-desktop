import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PackageInfo } from './packageStore'

export type UpdateStrategy = 'recommended' | 'smart' | 'security' | 'latest'
export type ConflictStrategy = 'prompt' | 'auto-recommended' | 'auto-security'
export type SecuritySensitivity = 'high' | 'medium' | 'low'
export type AppLanguage = 'zh-CN' | 'en-US'
export type LanguageSource = 'default' | 'installer' | 'startup' | 'settings'

interface SettingsState {
  language: AppLanguage
  languageInitialized: boolean
  languageSource: LanguageSource
  updateStrategy: UpdateStrategy
  conflictStrategy: ConflictStrategy
  securitySensitivity: SecuritySensitivity
  setLanguage: (language: AppLanguage, source?: LanguageSource) => void
  initializeLanguage: (language: AppLanguage, source: LanguageSource) => void
  setUpdateStrategy: (strategy: UpdateStrategy) => void
  setConflictStrategy: (strategy: ConflictStrategy) => void
  setSecuritySensitivity: (sensitivity: SecuritySensitivity) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en-US',
      languageInitialized: false,
      languageSource: 'default',
      updateStrategy: 'recommended',
      conflictStrategy: 'prompt',
      securitySensitivity: 'medium',
      setLanguage: (language, source = 'settings') => set({
        language,
        languageInitialized: true,
        languageSource: source
      }),
      initializeLanguage: (language, source) => set({
        language,
        languageInitialized: true,
        languageSource: source
      }),
      setUpdateStrategy: (updateStrategy) => set({ updateStrategy }),
      setConflictStrategy: (conflictStrategy) => set({ conflictStrategy }),
      setSecuritySensitivity: (securitySensitivity) => set({ securitySensitivity })
    }),
    {
      name: 'settings-storage',
      merge: (persisted, current) => {
        const persistedState = (persisted || {}) as Partial<SettingsState>
        const isLanguage = (value: unknown): value is AppLanguage => value === 'zh-CN' || value === 'en-US'
        const isSource = (value: unknown): value is LanguageSource =>
          value === 'default' || value === 'installer' || value === 'startup' || value === 'settings'
        const isUpdateStrategy = (value: unknown): value is UpdateStrategy =>
          value === 'recommended' || value === 'smart' || value === 'security' || value === 'latest'
        const isConflictStrategy = (value: unknown): value is ConflictStrategy =>
          value === 'prompt' || value === 'auto-recommended' || value === 'auto-security'
        const isSensitivity = (value: unknown): value is SecuritySensitivity =>
          value === 'high' || value === 'medium' || value === 'low'
        const hadLanguagePreference = isLanguage(persistedState.language)

        // Enum fields are whitelisted: a corrupted or older persisted value
        // (e.g. language: "fr") must fall back to the current default instead
        // of reaching the UI controls and the derived language-source logic.
        return {
          ...current,
          language: isLanguage(persistedState.language) ? persistedState.language : current.language,
          languageInitialized: persistedState.languageInitialized ?? hadLanguagePreference,
          languageSource: isSource(persistedState.languageSource)
            ? persistedState.languageSource
            : (hadLanguagePreference ? 'settings' : current.languageSource),
          updateStrategy: isUpdateStrategy(persistedState.updateStrategy) ? persistedState.updateStrategy : current.updateStrategy,
          conflictStrategy: isConflictStrategy(persistedState.conflictStrategy) ? persistedState.conflictStrategy : current.conflictStrategy,
          securitySensitivity: isSensitivity(persistedState.securitySensitivity) ? persistedState.securitySensitivity : current.securitySensitivity
        }
      }
    }
  )
)

export async function resolveSmartPackageUpdateTarget(
  pkg: PackageInfo,
  conflictStrategy: ConflictStrategy = 'prompt'
): Promise<{ targetVersion: string; analysis: SmartUpdateAnalysis | null }> {
  const metadata = await window.electronAPI.npm.getVersionMetadata(pkg.name)
  const analysis = await window.electronAPI.npm.smartAnalyze({
    packageName: pkg.name,
    currentVersion: pkg.version,
    allVersions: metadata.versions.map((item: NpmVersionInfo) => item.version),
    wantedVersion: pkg.wanted,
    latestVersion: pkg.latest || metadata.latest
  })
  const targetVersion = conflictStrategy === 'auto-security' && analysis.safe
    ? analysis.safe
    : analysis.recommended || analysis.latest || pkg.version
  return { targetVersion, analysis }
}

export function resolvePackageUpdateTarget(pkg: PackageInfo, strategy: UpdateStrategy): string | undefined {
  if (strategy === 'latest' || strategy === 'security') {
    return pkg.latest || pkg.wanted || pkg.version
  }

  return pkg.wanted || pkg.latest || pkg.version

}
