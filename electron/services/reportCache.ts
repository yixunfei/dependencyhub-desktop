/**
 * Process-wide cache for expensive project reports.
 *
 * HealthCenter mounts roughly forty panels at once and several independent
 * services each ask `WorkspaceDiscoveryService` for the same directory tree, so
 * without this layer a single page load walks the same projectsix to ten times.
 * Two guarantees make it safe to share results across callers:
 *
 * - Requests for the same key coalesce onto one in-flight promise, so concurrent
 *   panels pay for one computation instead of N.
 * - Failures are never cached, so a transient network error during a scan cannot
 *   pin a project to a broken state until the TTL expires.
 *
 * Mutations must call `invalidateReports(root)`; otherwise a panel would happily
 * render the dependency tree from before the user's `install`.
 */
interface CacheEntry {
  at: number
  value: unknown
}

export interface ReportCacheOptions {
  /** How long a value may be reused, in milliseconds. */
  ttlMs?: number
}

const DEFAULT_TTL_MS = 30_000
/** Bounds resident memory: reports embed whole manifests for large projects. */
const MAX_ENTRIES = 256

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

function touch(key: string, value: unknown): void {
  cache.delete(key)
  cache.set(key, { at: Date.now(), value })
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

export async function cachedReport<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T

  const pending = inflight.get(key)
  if (pending) return await pending as T

  const task = load()
    .then((value) => {
      touch(key, value)
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, task)
  return await task
}

/**
 * Drop everything belonging to a project (or a service) after a write. Keys are
 * `${service}:${resolvedPath}`, so the project root is always a safe prefix.
 */
export function invalidateReports(prefix?: string): number {
  if (!prefix) {
    const dropped = cache.size
    cache.clear()
    return dropped
  }
  let dropped = 0
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
      dropped += 1
    }
  }
  return dropped
}

/** Test helper: report how much is currently memoised. */
export function reportCacheStats(): { cached: number; inflight: number } {
  return { cached: cache.size, inflight: inflight.size }
}

export const DEFAULT_REPORT_TTL_MS = DEFAULT_TTL_MS
