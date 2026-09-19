import { readdir, stat, unlink } from 'fs/promises'
import { join, resolve } from 'path'

/**
 * Shared retention helper for the directories the app writes into the user's
 * repository (snapshots, command backups).
 *
 * Both used to grow forever: every mutation stores a full copy of the manifests,
 * so after a few weeks `.npmDesktopManager/` quietly held hundreds of megabytes
 * next to the user's source. Callers now declare how much history is worth
 * keeping and the oldest files past that budget are removed.
 */
export interface RetentionPolicy {
  /** Newest files to always keep, regardless of total size. */
  maxFiles: number
  /** Hard ceiling for the whole directory; oldest files go first. */
  maxBytes: number
  /** Never deleted — normally the file that was just written. */
  keepPath?: string
}

export async function pruneDirectory(
  directory: string,
  extension: '.json',
  policy: RetentionPolicy
): Promise<number> {
  const files = await readdir(directory).catch(() => [] as string[])
  const candidates = files.filter((file) => file.endsWith(extension)).sort().reverse()
  if (candidates.length === 0) return 0

  const entries = await Promise.all(candidates.map(async (file) => {
    const size = await stat(join(directory, file)).then((result) => result.size).catch(() => 0)
    return { file, size }
  }))

  let total = entries.reduce((sum, entry) => sum + entry.size, 0)
  const keepPath = policy.keepPath ? resolve(policy.keepPath) : undefined
  let removed = 0

  for (const [index, entry] of entries.entries()) {
    if (index < policy.maxFiles && total <= policy.maxBytes) break
    const entryPath = join(directory, entry.file)
    if (keepPath && resolve(entryPath) === keepPath) continue
    await unlink(entryPath).catch(() => undefined)
    total -= entry.size
    removed += 1
  }
  return removed
}
