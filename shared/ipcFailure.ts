/** Electron only forwards Error.message for rejected invoke handlers. Send plain data instead. */
export interface IpcFailureEnvelope {
  __dependencyHubFailure: true
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

export async function captureIpcFailure<T>(task: () => T | Promise<T>): Promise<T | IpcFailureEnvelope> {
  try {
    return await task()
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    const details = error as Error & Partial<IpcFailureEnvelope['error']>
    return {
      __dependencyHubFailure: true,
      error: {
        name: error.name, message: error.message,
        failure: details.failure, backup: details.backup, restore: details.restore,
        code: details.code, stdout: details.stdout, stderr: details.stderr
      }
    }
  }
}

export function unwrapIpcResult<T>(result: T | IpcFailureEnvelope): T {
  if (result && typeof result === 'object' && '__dependencyHubFailure' in result
    && result.__dependencyHubFailure === true) {
    const { error } = result as unknown as IpcFailureEnvelope
    throw Object.assign(new Error(error.message), error)
  }
  return result as T
}
