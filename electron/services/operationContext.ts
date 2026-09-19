import { randomUUID } from 'crypto'
import { projectIdentity } from './projectIdentity'
import { AsyncLocalStorage } from 'async_hooks'
import {
  classifyFailureText,
  type FailureClassification,
  type FailureEvidence,
  type FailureReason,
  type OperationFailureCategory
} from './failureClassifier'

export type { OperationFailureCategory, FailureClassification, FailureEvidence, FailureReason }

/** Failure shape every operation rejects with, so the renderer can offer 重试 / 回滚 / 查看日志. */
export interface OperationFailure {
  category: OperationFailureCategory
  operationId: string
  message: string
  retryable: boolean
  /** Why it failed, as a translatable key plus evidence instead of raw stderr. */
  reason?: FailureReason
  evidence?: FailureEvidence
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
  // Disabling the timeout is legitimate for a long read, but a mutation without
  // one could hold the project queue forever if its child never exits, so it
  // keeps the generous mutation default instead of running unbounded.
  const timeoutMs = input.timeoutMs === null
    ? (input.kind === 'read' ? undefined : DEFAULT_TIMEOUT_MS.mutation)
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
/** Bounded so scanning garbage output cannot dominate a failure report. */
const MAX_CLASSIFY_TEXT = 8000

export function classifyOperationFailure(
  error: unknown,
  fallbackOperationId = 'unknown'
): OperationFailure {
  const value = (error || {}) as Partial<OperationFailure> & {
    code?: number | string | null
    failure?: OperationFailure
    backup?: { path?: string }
    stdout?: string
    stderr?: string
  }
  if (value.failure) return { ...value.failure, backupPath: value.backup?.path || value.failure.backupPath }
  const message = typeof value.message === 'string' && value.message.trim() ? value.message : String(error ?? 'Operation failed')
  const category = lifecycleCategory(value.category, message, value.code)
  const exitCode = typeof value.code === 'number' || typeof value.code === 'string' ? value.code : undefined

  // "exit-code" and "unknown" are what the user sees before this step: they say
  // that something stopped, never what went wrong. Anything more meaningful is
  // buried in stderr, so read it before deciding what to tell them.
  const classification = (category === 'exit-code' || category === 'unknown')
    ? classifyFailureText(failureText(message, value))
    : undefined

  return {
    category: classification?.category ?? category,
    operationId: typeof value.operationId === 'string' && value.operationId ? value.operationId : fallbackOperationId,
    message,
    retryable: value.retryable ?? classification?.retryable ?? (category !== 'unknown' || exitCode === undefined),
    reason: classification?.reason,
    evidence: classification?.evidence,
    exitCode,
    backupPath: value.backupPath || value.backup?.path
  }
}

/** Keeps a stray `category` field from turning into an unrenderable value downstream. */
const KNOWN_CATEGORIES = new Set<OperationFailureCategory>([
  'cancelled', 'timeout', 'output-limit', 'exit-code', 'unknown',
  'network', 'certificate', 'proxy', 'permission', 'toolchain-missing', 'auth', 'registry', 'conflict'
])

function lifecycleCategory(
  explicit: string | undefined,
  message: string,
  code?: number | string | null
): OperationFailureCategory {
  if (explicit && KNOWN_CATEGORIES.has(explicit as OperationFailureCategory)) return explicit as OperationFailureCategory
  if (CANCEL_MESSAGE.test(message)) return 'cancelled'
  if (TIMEOUT_MESSAGE.test(message)) return 'timeout'
  if (OUTPUT_MESSAGE.test(message)) return 'output-limit'
  return code !== undefined && code !== null && code !== 0 ? 'exit-code' : 'unknown'
}

function failureText(message: string, value: { stdout?: string; stderr?: string }): string {
  const parts = [message, value.stderr, value.stdout].filter((part): part is string =>
    typeof part === 'string' && part.trim().length > 0)
  // stderr is what package managers use to explain themselves; stdout rarely
  // matters, so it only gets a small share of the bounded window.
  return parts.map((part, index) => (index === 2 ? part.slice(-2000) : part))
    .join('\n')
    .slice(0, MAX_CLASSIFY_TEXT)
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
