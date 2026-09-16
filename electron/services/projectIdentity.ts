import { realpathSync } from 'fs'
import { resolve } from 'path'

/** Use one identity for queues and cancellation, including directory aliases. */
export function projectIdentity(cwd: string): string {
  let path = resolve(cwd)
  try {
    path = realpathSync.native(path)
  } catch {
    // A project can be removed while an operation is still queued.
  }
  return process.platform === 'win32' ? path.toLowerCase() : path
}
