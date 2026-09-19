import { useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useT } from '../../i18n'
import { onUnexpectedError } from './errors'

/**
 * Turns silent background failures into a visible notice. Without this the only
 * symptom of a rejected promise was a button that stopped doing anything.
 */
export function UnexpectedErrorNotifier(): null {
  const t = useT()
  const addNotification = useAppStore((state) => state.addNotification)

  useEffect(() => onUnexpectedError((event) => {
    console.warn(`[renderer] ${event.source}:`, event.message)
    addNotification({
      type: 'warning',
      message: t('app.unexpectedError'),
      description: `${t('app.unexpectedErrorDescription')} ${event.message}`.trim()
    })
  }), [addNotification, t])

  return null
}

export default UnexpectedErrorNotifier
