import { app, dialog, type BrowserWindow } from 'electron'
import { appendFile, mkdir, stat, rename } from 'fs/promises'
import { dirname, join } from 'path'

/**
 * Last-resort net for anything that escaped its own try/catch.
 *
 * Before this existed a single unexpected rejection — a badly behaved stream,
 * a package manager writing to a closed pipe — tore down the main process and
 * closed every window, losing whatever install was running and any unsaved
 * view state. The goal here is not to pretend the error did not happen: it is
 * logged with enough detail to diagnose, surfaced in the UI, and only escalated
 * to a blocking dialog when the app has clearly become unreliable.
 */
const MAX_CRASH_LOG_BYTES = 512 * 1024
const ESCALATION_THRESHOLD = 5
const NOTIFY_THROTTLE_MS = 10_000

interface GuardState {
  count: number
  firstAt: number
  lastNotifyAt: number
  notified: boolean
}

const state: GuardState = { count: 0, firstAt: 0, lastNotifyAt: 0, notified: false }

export interface ProcessGuardOptions {
  getWindow: () => BrowserWindow | null
}

export interface UnexpectedErrorPayload {
  kind: 'uncaughtException' | 'unhandledRejection'
  message: string
  name?: string
  stack?: string
  count: number
}

export function formatUnexpectedError(payload: UnexpectedErrorPayload): string {
  const time = new Date().toISOString()
  return [
    `[${time}] ${payload.kind} (#${payload.count})`,
    payload.name ? `name: ${payload.name}` : '',
    `message: ${payload.message}`,
    payload.stack || ''
  ].filter(Boolean).join('\n')
}

export function installProcessGuards({ getWindow }: ProcessGuardOptions): void {
  const onError = (kind: UnexpectedErrorPayload['kind'], reason: unknown) => {
    const now = Date.now()
    if (state.count === 0 || now - state.firstAt > 60_000) {
      state.count = 0
      state.firstAt = now
    }
    state.count += 1

    const error = reason instanceof Error ? reason : new Error(String(reason))
    const payload: UnexpectedErrorPayload = {
      kind,
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 12).join('\n'),
      count: state.count
    }
    console.error(`[process-guard] ${formatUnexpectedError(payload)}`)
    void persistCrashLog(formatUnexpectedError(payload))

    const window = getWindow()
    if (window && !window.isDestroyed() && now - state.lastNotifyAt > NOTIFY_THROTTLE_MS) {
      state.lastNotifyAt = now
      window.webContents.send('app:unexpected-error', payload)
    }

    // Repeated failures mean the app is no longer able to do useful work;
    // telling the user is better than limping along with broken panels.
    if (state.count >= ESCALATION_THRESHOLD && !state.notified) {
      state.notified = true
      void escalate(state.count)
    }
  }

  process.on('uncaughtException', (error) => onError('uncaughtException', error))
  process.on('unhandledRejection', (reason) => onError('unhandledRejection', reason))
}

async function escalate(count: number): Promise<void> {
  try {
    await dialog.showMessageBox({
      type: 'error',
      buttons: ['Continue', 'Relaunch'],
      defaultId: 0,
      title: 'Unexpected errors',
      message: `The app hit ${count} unexpected errors. Relaunching usually restores normal operation.`,
      detail: 'Recent operations may not have finished. Check the command log before continuing.'
    }).then((result) => {
      if (result.response === 1) {
        app.relaunch()
        app.exit(0)
      }
    })
  } catch {
    // A dialog failure must never become another unhandled rejection.
  }
}

async function persistCrashLog(entry: string): Promise<void> {
  try {
    const path = join(app.getPath('userData'), 'logs', 'crash.log')
    await mkdir(dirname(path), { recursive: true })
    const size = await stat(path).then((result) => result.size).catch(() => 0)
    if (size > MAX_CRASH_LOG_BYTES) {
      await rename(path, `${path}.1`).catch(() => undefined)
    }
    await appendFile(path, `${entry}\n\n`, 'utf-8')
  } catch {
    // Logging is best effort; never throw from inside an error handler.
  }
}

/** Test hook so suites can start from a clean escalation state. */
export function resetProcessGuardState(): void {
  state.count = 0
  state.firstAt = 0
  state.lastNotifyAt = 0
  state.notified = false
}
