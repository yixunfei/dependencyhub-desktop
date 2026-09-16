import { pathToFileURL } from 'node:url'

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** Only the application document or the exact development origin may retain the IPC bridge. */
export function isAllowedAppNavigation(value: string, entryFile: string, development: boolean): boolean {
  try {
    const target = new URL(value)
    if (development) return target.origin === 'http://localhost:5173'
    const entry = pathToFileURL(entryFile)
    return target.protocol === entry.protocol && target.host === entry.host && target.pathname === entry.pathname
  } catch {
    return false
  }
}

/**
 * Only a curated set of external URL protocols may leave the app shell; anything
 * else (file:, javascript:, custom schemes) is rejected before shell.openExternal.
 */
export function isAllowedExternalUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  return EXTERNAL_PROTOCOLS.has(parsed.protocol)
}
