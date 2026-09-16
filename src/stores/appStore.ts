import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  currentPath: string
  recentPaths: string[]
  setCurrentPath: (path: string) => void
  clearRecentPaths: () => void
  loading: boolean
  setLoading: (loading: boolean) => void
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  initCurrentPath: () => Promise<void>
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
}

const rememberPath = (path: string, paths: string[]) => {
  const normalized = path.trim()
  return normalized ? [normalized, ...paths.filter((item) => item !== normalized)].slice(0, 8) : paths
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPath: '',
      recentPaths: [],
      setCurrentPath: (path) => set((state) => ({
        currentPath: path.trim(),
        recentPaths: rememberPath(path, state.recentPaths)
      })),
      clearRecentPaths: () => set({ recentPaths: [] }),
      loading: false,
      setLoading: (loading) => set({ loading }),
      notifications: [],
      addNotification: (notification) => {
        const id = `${Date.now()}-${Math.random()}`
        set((state) => ({ notifications: [...state.notifications, { ...notification, id }] }))
        setTimeout(() => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })), 4000)
      },
      removeNotification: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
      initCurrentPath: async () => {
        try {
          if (!window.electronAPI) return
          const path = await window.electronAPI.getDefaultPath()
          if (path) {
            set((state) => state.currentPath
              ? state
              : { currentPath: path, recentPaths: rememberPath(path, state.recentPaths) })
          }
        } catch (error) {
          console.error('Failed to get default path:', error)
        }
      }
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({ currentPath: state.currentPath, recentPaths: state.recentPaths })
    }
  )
)
