import { AsyncLocalStorage } from 'async_hooks'
import { projectIdentity } from './projectIdentity'

const projectMutationQueues = new Map<string, Promise<unknown>>()
const queueDepth = new Map<string, number>()
const ownership = new AsyncLocalStorage<ReadonlyMap<string, { active: boolean }>>()

/** Beyond this the queue is no longer useful: reject rather than pile up unseen work. */
const MAX_QUEUE_DEPTH = 20
/**
 * The chain below only moves when the previous task settles. An operation whose
 * own timeout is disabled — or a process stuck waiting on a network mount —
 * used to wedge the project forever, leaving every later install silently
 * pending. The wait itself is now bounded so the UI can say "still busy".
 */
const QUEUE_WAIT_TIMEOUT_MS = 60_000

/**
 * Serializes every project mutation on the same project path so that two write
 * operations (for example "update all" running while a single install starts)
 * can never interleave their manifest / lockfile writes.
 */
export async function withProjectMutation<T>(cwd: string, task: () => Promise<T>): Promise<T> {
  const key = projectIdentity(cwd)
  if (ownership.getStore()?.get(key)?.active) return await task()

  const previous = projectMutationQueues.get(key) || Promise.resolve()
  const depth = (queueDepth.get(key) || 0) + 1
  if (depth > MAX_QUEUE_DEPTH) {
    throw Object.assign(
      new Error(`Project busy: ${MAX_QUEUE_DEPTH} operations are already queued for ${cwd}`),
      { category: 'timeout', retryable: true }
    )
  }
  queueDepth.set(key, depth)

  const enter = async () => {
    const lease = { active: true }
    const held = new Map(ownership.getStore())
    held.set(key, lease)
    try {
      return await ownership.run(held, task)
    } finally {
      lease.active = false
    }
  }

  const run = awaitQueuedTurn(previous, enter)
  const queued = run.catch(() => undefined)
  projectMutationQueues.set(key, queued)
  try {
    return await run
  } finally {
    const remaining = (queueDepth.get(key) || 1) - 1
    if (remaining > 0) {
      queueDepth.set(key, remaining)
    } else {
      queueDepth.delete(key)
    }
    if (projectMutationQueues.get(key) === queued) projectMutationQueues.delete(key)
  }
}

function awaitQueuedTurn<T>(previous: Promise<unknown>, task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(Object.assign(
        new Error(`Timed out after ${QUEUE_WAIT_TIMEOUT_MS} ms waiting for the previous project operation`),
        { category: 'timeout', retryable: true }
      ))
    }, QUEUE_WAIT_TIMEOUT_MS)

    const chain = previous.then(task, task)
    chain.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export function projectMutationQueueSize(): number {
  return projectMutationQueues.size
}

/** Depth of the wait queue for one project; used by diagnostics. */
export function projectMutationDepth(cwd: string): number {
  return queueDepth.get(projectIdentity(cwd)) || 0
}
