import { OperationCancelledError, type OperationContext } from './operationContext'

export interface ProjectGuardOptions {
  timeoutMs?: number | null
  operationId?: string
  kind?: 'mutation' | 'read'
  /** Set to false for dry-runs and for callers that already hold the queue. */
  serialize?: boolean
}

export interface ProjectGuardDependencies {
  beginOperation: (input: { operationId?: string; projectPath?: string; label?: string; timeoutMs?: number | null; kind?: 'mutation' | 'read' }) => { context: OperationContext; finish: () => void }
  runWithOperationContext: <T>(context: OperationContext, task: () => Promise<T> | T) => Promise<T>
  withProjectMutation: <T>(cwd: string, task: () => Promise<T>) => Promise<T>
  snapshot?: (cwd: string, label: string) => Promise<void>
  attachFailure: (error: unknown, operationId?: string) => unknown
}

/**
 * The single write-path guard: every mutating IPC handler funnels through here so
 * the dependency snapshot, the per-project serialization and the operation
 * context (id / timeout / abort signal) are identical for all ecosystems instead
 * of each handler inventing its own ordering.
 */
export async function runProjectOperation<T>(
  dependencies: ProjectGuardDependencies,
  cwd: string | undefined,
  label: string,
  operation: (context: OperationContext) => Promise<T>,
  options: ProjectGuardOptions = {}
): Promise<T> {
  const { context, finish } = dependencies.beginOperation({
    operationId: options.operationId,
    projectPath: cwd,
    label,
    timeoutMs: options.timeoutMs,
    kind: options.kind || 'mutation'
  })
  try {
    const run = async () => {
      if (context.signal.aborted) throw new OperationCancelledError(context.operationId, label)
      if (dependencies.snapshot && cwd && options.kind !== 'read') await dependencies.snapshot(cwd, label)
      if (context.signal.aborted) throw new OperationCancelledError(context.operationId, label)
      return await dependencies.runWithOperationContext(context, () => operation(context))
    }
    if (!cwd || options.serialize === false) return await run()
    return await waitForProjectTurn(dependencies, cwd, context, run)
  } catch (error) {
    throw dependencies.attachFailure(error, context.operationId)
  } finally {
    finish()
  }
}

/** Cancel a queued request promptly, but wait for running work to stop before rejecting. */
function waitForProjectTurn<T>(
  dependencies: ProjectGuardDependencies,
  cwd: string,
  context: OperationContext,
  run: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new OperationCancelledError(context.operationId, context.label))
    context.signal.addEventListener('abort', cancel, { once: true })
    if (context.signal.aborted) cancel()
    void dependencies.withProjectMutation(cwd, async () => {
      context.signal.removeEventListener('abort', cancel)
      return await run()
    }).then(resolve, reject).finally(() => context.signal.removeEventListener('abort', cancel))
  })
}
