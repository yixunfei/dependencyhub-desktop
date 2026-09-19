import { rename, unlink, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'

/**
 * Replace a user-visible file atomically: a crash or power loss between the
 * write and the rename leaves the previous contents intact instead of a
 * truncated manifest. The unique staging name also keeps concurrent writers
 * from clobbering each other's snapshot.
 */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.${randomUUID()}.tmp`
  await writeFile(tmpPath, content, 'utf-8')
  try {
    await rename(tmpPath, path)
  } catch (error) {
    // Never unlink the live file to "make room" for the rename: if the retry
    // also fails, the previous contents must stay intact.
    await unlink(tmpPath).catch(() => undefined)
    throw error
  }
}
