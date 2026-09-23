import { isUtf8 } from 'node:buffer'
import { readFile } from 'fs/promises'

/**
 * Lock/manifest files that are binary on disk. Reading them as utf-8 replaces
 * invalid byte sequences with U+FFFD, so any snapshot/backup taken through a
 * text path would corrupt the file irreversibly on restore.
 */
const BINARY_MANIFEST_NAMES = new Set(['bun.lockb'])

export interface ManifestContent {
  /** File contents: utf-8 text, or base64 when the file is binary. */
  content: string
  encoding?: 'base64'
  /** Size in bytes on disk. */
  bytes: number
}

/**
 * Reads a manifest/lock file losslessly. Binary detection uses the known-name
 * list plus a NUL-byte heuristic so future binary lockfiles are caught too.
 */
export async function readManifestContent(path: string): Promise<ManifestContent> {
  const buffer = await readFile(path)
  const name = path.split(/[\\/]/).pop()?.toLowerCase() || ''
  if (BINARY_MANIFEST_NAMES.has(name) || buffer.includes(0) || !isUtf8(buffer)) {
    return { content: buffer.toString('base64'), encoding: 'base64', bytes: buffer.length }
  }
  return { content: buffer.toString('utf-8'), bytes: buffer.length }
}

/** Decodes a stored ManifestContent back to writable form. */
export function manifestContentToWritable(stored: { content: string; encoding?: 'base64' }): string | Buffer {
  return stored.encoding === 'base64' ? Buffer.from(stored.content, 'base64') : stored.content
}
