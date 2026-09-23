import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { App } from 'antd'
import { useEffect, useRef } from 'react'
import { translateText } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'

export const NotificationContainer: React.FC = () => {
  const notifications = useAppStore((state) => state.notifications)
  const language = useSettingsStore((state) => state.language)
  const { notification } = App.useApp()
  // Ids already pushed to antd. Opening every stored notification on each
  // store change replayed the whole history: antd restarts the duration
  // timer on same-key updates, so old notifications lingered far past their
  // store-side removal and language switches re-popped everything.
  const shownIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const shown = shownIdsRef.current
    for (const n of notifications) {
      if (shown.has(n.id)) continue
      shown.add(n.id)
      notification[n.type]({
        title: translateText(language, n.message),
        description: n.description ? translateText(language, n.description) : undefined,
        duration: 4,
        key: n.id,
        onClose: () => {
          shownIdsRef.current.delete(n.id)
          useAppStore.getState().removeNotification(n.id)
        }
      })
    }
    // Drop ids the store already removed so the set cannot grow unbounded.
    const live = new Set(notifications.map((n) => n.id))
    for (const id of shown) {
      if (!live.has(id)) shown.delete(id)
    }
  }, [language, notification, notifications])

  return null
}
