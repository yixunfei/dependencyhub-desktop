import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useT } from '../i18n'

const SCAN_TTL = 5 * 60 * 1000
const lastScanAt = new Map<string, number>()

export function useDependencyHealthReminder(
  manager: DependencyHealthManager,
  cwd: string,
  enabled: boolean
) {
  const addNotification = useAppStore((state) => state.addNotification)
  const t = useT()

  useEffect(() => {
    if (!enabled || !cwd) return

    const key = `${manager}:${cwd}`
    const previous = lastScanAt.get(key) || 0
    if (Date.now() - previous < SCAN_TTL) return
    lastScanAt.set(key, Date.now())

    let cancelled = false
    window.electronAPI.dependencyHealth.scan(manager, cwd)
      .then((result) => {
        if (cancelled) return
        const important = result.summary.critical + result.summary.high + result.summary.medium
        if (important <= 0) return
        addNotification({
          type: 'warning',
          message: t('health.reminderTitle', { manager }),
          description: t('health.reminderDescription', { count: important })
        })
      })
      .catch(() => {
      })

    return () => {
      cancelled = true
    }
  }, [manager, cwd, enabled, addNotification, t])
}
