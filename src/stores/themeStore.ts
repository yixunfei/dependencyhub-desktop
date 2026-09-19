import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'dark' | 'light'
export type ResolvedThemeMode = 'dark' | 'light'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set((state) => ({ mode: state.mode === 'dark' ? 'light' : 'dark' }))
    }),
    {
      name: 'theme-storage',
      merge: (persisted, current) => {
        const persistedMode = (persisted as Partial<ThemeState> | undefined)?.mode
        // A corrupted or foreign persisted value must not reach the theme
        // resolver (same guard as the other persisted stores).
        return {
          ...current,
          mode: persistedMode === 'system' || persistedMode === 'dark' || persistedMode === 'light' ? persistedMode : current.mode
        }
      }
    }
  )
)
