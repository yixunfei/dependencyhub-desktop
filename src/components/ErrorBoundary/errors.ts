/**
 * Renderer-side safety net.
 *
 * A rejected promise with no `.catch` used to fail silently: the command simply
 * never finished and nothing in the UI explained why. Everything unexpected
 * lands here instead, where it is logged once and surfaced as a notice.
 */
export type UnexpectedListener = (event: UnexpectedErrorEvent) => void

export interface UnexpectedErrorEvent {
  source: 'uncaughtException' | 'unhandledRejection' | 'render'
  message: string
  stack?: string
}

const listeners = new Set<UnexpectedListener>()
/** Browser quirks that are noisy but harmless; they never reach the user. */
const SUPPRESSED = /ResizeObserver loop completed with undelivered observations/i

export function onUnexpectedError(listener: UnexpectedListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function reportUnexpectedError(event: UnexpectedErrorEvent): void {
  if (SUPPRESSED.test(event.message)) return
  for (const listener of listeners) listener(event)
}

export function rememberRendererError(error: Error): void {
  reportUnexpectedError({ source: 'render', message: error.message, stack: error.stack })
}

/** Called once at startup: keeps indigestible failures visible instead of silent. */
export function installRendererGuards(): void {
  window.addEventListener('error', (event) => {
    reportUnexpectedError({
      source: 'uncaughtException',
      message: event.message || String(event.error || 'Unknown error')
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    reportUnexpectedError({ source: 'unhandledRejection', message: reason.message, stack: reason.stack })
  })
}
