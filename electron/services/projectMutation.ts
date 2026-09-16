import { AsyncLocalStorage } from 'async_hooks'
import { projectIdentity } from './projectIdentity'

const projectMutationQueues = new Map<string, Promise<unknown>>()
const ownership = new AsyncLocalStorage<ReadonlyMap<string, { active: boolean }>>()

/**
 * Serializes every project mutation on the same project path so that two write
 * operations (for example "update all" running while a single install starts)
 * can never interleave their manifest / lockfile writes.
 */
export async function withProjectMutation<T>(cwd: string, task: () => Promise<T>): Promise<T> {
  const key = projectIdentity(cwd)
  if (ownership.getStore()?.get(key)?.active) return await task()
  const previous = projectMutationQueues.get(key) || Promise.resolve()
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
  const run = previous.then(enter, enter)
  const queued = run.catch(() => undefined)
  projectMutationQueues.set(key, queued)
  try {
    return await run
  } finally {
    if (projectMutationQueues.get(key) === queued) projectMutationQueues.delete(key)
  }
}

export function projectMutationQueueSize(): number {
  return projectMutationQueues.size
}
