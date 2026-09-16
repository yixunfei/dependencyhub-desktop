import { randomUUID } from 'crypto'
import { projectIdentity } from './projectIdentity'
import { AsyncLocalStorage } from 'async_hooks'

export type OperationFailureCategory =
  | 'cancelled'
  | 'timeout'
  | 'exit-code'
  | 'output-limit'
  | 'unknown'

/** Failure shape every operation rejects with, so the renderer can offer 重试 / 回滚 / 查看日志. */
export interface OperationFailure {
  category: OperationFailureCategory
  operationId: string
  message: string
  retryable: boolean
  exitCode?: number | string | null
  backupPath?: string
}

export interface OperationContext {
  operationId: string
  timeoutMs?: number
  label?: string
  signal: AbortSignal
}

export class OperationCancelledError extends Error {
  readonly category: OperationFailureCategory = 'cancelled'
  readonly retryable = true
  constructor(operationId: string, label?: string) {
    super(`Operation ${label || operationId} was cancelled`)
    this.name = 'OperationCancelledError'
  }
}

export class OperationTimeoutError extends Error {
  readonly category: OperationFailureCategory = 'timeout'
  readonly retryable = true
  constructor(operationId: string, timeoutMs: number, label?: string) {
    super(`Operation ${label || operationId} timed out after ${timeoutMs} ms`)
    this.name = 'OperationTimeoutError'
  }
}

interface ActiveOperation {
  operationId: string
  label?: string
  controller: AbortController
  projectPath?: string
}

const activeOperations = new Map<string, ActiveOperation>()
const DEFAULT_TIMEOUT_MS: Record<string, number> = {
  // Mutating commands can legitimately run for a long time; the timeout only
  // protects against a process that never returns.
  mutation: 20 * 60 * 1000,
  read: 3 * 60 * 1000
}

export interface OperationContextInput {
  operationId?: string
  projectPath?: string
  label?: string
  timeoutMs?: number | null
  kind?: 'mutation' | 'read'
}

export interface BeginOperationResult {
  context: OperationContext
  finish: () => void
}

export function beginOperation(input: OperationContextInput = {}): BeginOperationResult {
  const operationId = input.operationId?.trim() || randomUUID()
  if (activeOperations.has(operationId)) throw new Error(`Operation already active: ${operationId}`)
  const timeoutMs = input.timeoutMs === null
    ? undefined
    : input.timeoutMs ?? DEFAULT_TIMEOUT_MS[input.kind || 'mutation']
  const controller = new AbortController()
  activeOperations.set(operationId, {
    operationId,
    label: input.label,
    controller,
    projectPath: input.projectPath
  })
  return {
    context: { operationId, timeoutMs, label: input.label, signal: controller.signal },
    finish: () => { activeOperations.delete(operationId) }
  }
}

export function requestOperationCancel(operationId: string): boolean {
  const active = activeOperations.get(operationId.trim())
  if (!active) return false
  active.controller.abort()
  return true
}

export function cancelProjectOperations(projectPath: string): number {
  const key = projectIdentity(projectPath)
  let cancelled = 0
  for (const active of activeOperations.values()) {
    if (active.projectPath && projectIdentity(active.projectPath) === key) {
      active.controller.abort()
      cancelled += 1
    }
  }
  return cancelled
}

export function listActiveOperations(): Array<{ operationId: string; label?: string; projectPath?: string }> {
  return [...activeOperations.values()].map(({ operationId, label, projectPath }) => ({ operationId, label, projectPath }))
}

/** Only for tests: aborts everything and clears the registry. */
export function resetOperations(): void {
  for (const active of activeOperations.values()) active.controller.abort()
  activeOperations.clear()
  storage.disable()
}

const storage = new AsyncLocalStorage<OperationContext>()

/**
 * Runs `task` with the operation context visible to every nested command, so a
 * handler does not have to thread signal/timeout through each service call.
 */
export function runWithOperationContext<T>(context: OperationContext, task: () => Promise<T> | T): Promise<T> {
  return storage.run(context, async () => await task())
}

export function currentOperationContext(): OperationContext | undefined {
  return storage.getStore()
}

export function currentOperationId(): string | undefined {
  return storage.getStore()?.operationId
}

/** Attaches the structured failure contract to an error and returns it. */
export function attachOperationFailure(error: unknown, operationId?: string): Error & { failure: OperationFailure } {
  const target = (error instanceof Error ? error : new Error(String(error))) as Error & { failure?: OperationFailure }
  target.failure = classifyOperationFailure(target, operationId || currentOperationId() || 'unknown')
  return target as Error & { failure: OperationFailure }
}

const CANCEL_MESSAGE = /was cancelled/i
const TIMEOUT_MESSAGE = /timed out after/i
const OUTPUT_MESSAGE = /output exceeded/i

export function classifyOperationFailure(
  error: unknown,
  fallbackOperationId = 'unknown'
): OperationFailure {
  const value = (error || {}) as Partial<OperationFailure> & {
    code?: number | string | null
    failure?: OperationFailure
    backup?: { path?: string }
  }
  if (value.failure) return { ...value.failure, backupPath: value.backup?.path || value.failure.backupPath }
  const message = typeof value.message === 'string' && value.message.trim() ? value.message : String(error ?? 'Operation failed')
  const explicit = value.category
  const category: OperationFailureCategory = explicit === 'cancelled' || explicit === 'timeout' || explicit === 'exit-code' || explicit === 'output-limit' || explicit === 'unknown'
    ? explicit
    : CANCEL_MESSAGE.test(message)
      ? 'cancelled'
      : TIMEOUT_MESSAGE.test(message)
        ? 'timeout'
        : OUTPUT_MESSAGE.test(message)
          ? 'output-limit'
          : value.code !== undefined && value.code !== null && value.code !== 0
            ? 'exit-code'
            : 'unknown'
  const exitCode = typeof value.code === 'number' || typeof value.code === 'string' ? value.code : undefined
  return {
    category,
    operationId: typeof value.operationId === 'string' && value.operationId ? value.operationId : fallbackOperationId,
    message,
    retryable: value.retryable ?? (category !== 'unknown' || exitCode === undefined),
    exitCode,
    backupPath: value.backupPath || value.backup?.path
  }
}

/** Attaches a structured `failure` field to any rejected operation result. */
export async function withOperationFailure<T>(task: () => Promise<T>, operationId: string): Promise<T> {
  try {
    return await task()
  } catch (error) {
    const source = (error instanceof Error ? error : new Error(String(error))) as Error & { failure?: OperationFailure }
    source.failure = classifyOperationFailure(source, operationId)
    throw source
  }
}
