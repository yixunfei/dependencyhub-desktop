import { AsyncLocalStorage } from 'async_hooks'
import { cpus } from 'os'

/**
 * Bound the number of concurrent async jobs so a single user action cannot
 * saturate the machine: spawning every tool probe or registry probe at once
 * turns a one-second scan into a multi-second stall on large projects.
 *
 * The limiter is reentrancy-safe. `runLoggedCommand` is the single spawn point
 * for the whole app, so a workflow that already holds a permit can legitimately
 * reach it again (for example a mutation that first probes the toolchain).
 * Without the marker storage below that nested call would queue behind the very
 * task holding the permit and deadlock once every slot is busy.
 */
export interface Limiter {
  run<T>(task: () => Promise<T>): Promise<T>
  /** Maps a batch through the same budget, preserving input order. */
  runAll<T, R>(items: readonly T[], task: (item: T, index: number) => Promise<R>): Promise<R[]>
  readonly pending: number
  readonly size: number
}

const heldMarker = new AsyncLocalStorage<boolean>()

export function createLimiter(maxConcurrency: number): Limiter {
  let active = 0
  const waiting: Array<() => void> = []

  const release = () => {
    active -= 1
    waiting.shift()?.()
  }

  const acquire = () => new Promise<void>((resolve) => {
    if (active < maxConcurrency) {
      active += 1
      resolve()
      return
    }
    waiting.push(() => {
      active += 1
      resolve()
    })
  })

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      if (heldMarker.getStore() === true) return task()
      return heldMarker.run(true, async () => {
        await acquire()
        try {
          return await task()
        } finally {
          release()
        }
      })
    },
    runAll<T, R>(items: readonly T[], task: (item: T, index: number) => Promise<R>): Promise<R[]> {
      return Promise.all(items.map((item, index) => this.run(() => task(item, index))))
    },
    get pending() {
      return waiting.length
    },
    get size() {
      return maxConcurrency
    }
  }
}

/** Once a machine is busy, spawning another hundred processes only adds noise. */
export function defaultConcurrency(floor = 4, factor = 2, ceiling = 12): number {
  return Math.min(ceiling, Math.max(floor, (cpus().length || floor) * factor))
}

/**
 * Every subprocess launched through `runLoggedCommand` shares this budget, so
 * read-only explorer activity can never starve an in-flight install.
 */
export const commandLimiter = createLimiter(defaultConcurrency())

/** Toolchain probes are version checks; six at a time already saturates disk. */
export const toolchainLimiter = createLimiter(6)

/** Registry probes are network bound and mostly waiting; eight keeps pipelines full. */
export const httpLimiter = createLimiter(8)

/** Filesystem reads are cheap individually but can be issued thousands of times. */
export const fsLimiter = createLimiter(16)
