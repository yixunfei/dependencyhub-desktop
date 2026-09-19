/**
 * Electron only forwards Error.message for rejected invoke handlers. Send plain
 * data instead. The marker key is versioned so arbitrary registry/package data
 * returned by channels like `npm:view` can never collide with a failure
 * envelope and be misread as an error.
 */
export interface IpcFailureEnvelope {
  __dhIpcFailureV1: true
  error: {
    name: string
    message: string
    failure?: unknown
    backup?: unknown
    restore?: unknown
    code?: unknown
    stdout?: string
    stderr?: string
  }
}

/** Depth cap keeps pathological structures bounded; beyond it the value is only described. */
const MAX_CLONE_DEPTH = 8

export async function captureIpcFailure<T>(task: () => T | Promise<T>): Promise<T | IpcFailureEnvelope> {
  try {
    return await task()
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    const details = error as Error & Partial<IpcFailureEnvelope['error']>
    return {
      __dhIpcFailureV1: true,
      error: {
        name: error.name, message: error.message,
        failure: cloneIpcSafe(details.failure), backup: cloneIpcSafe(details.backup), restore: cloneIpcSafe(details.restore),
        code: cloneIpcSafe(details.code), stdout: details.stdout, stderr: details.stderr
      }
    }
  }
}

function cloneIpcSafe(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    // Functions and symbols cannot survive the structured clone across IPC.
    return typeof value === 'function' || typeof value === 'symbol' ? undefined : value
  }
  if (depth >= MAX_CLONE_DEPTH) return `[unserializable: ${Object.prototype.toString.call(value)}]`
  if (Array.isArray(value)) return value.map((item) => cloneIpcSafe(item, depth + 1))
  const source = value as Record<string, unknown>
  // Plain objects, Dates, Maps, Sets and class instances that JSON.stringify
  // handles all keep their data; anything cyclic or exotic falls back to a
  // short representation so the error message itself is never lost.
  try {
    return JSON.parse(JSON.stringify(source, (_key, item) => (
      typeof item === 'function' || typeof item === 'symbol' ? undefined : item
    )))
  } catch {
    return `[unserializable: ${String(value)}]`
  }
}

export function unwrapIpcResult<T>(result: T | IpcFailureEnvelope): T {
  const candidate = result as Partial<IpcFailureEnvelope> | null | undefined
  if (candidate && typeof candidate === 'object'
    && candidate.__dhIpcFailureV1 === true
    && candidate.error && typeof candidate.error.message === 'string') {
    const { error } = candidate as IpcFailureEnvelope
    throw Object.assign(new Error(error.message), error)
  }
  return result as T
}
