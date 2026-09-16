export type ReportStatus = 'idle' | 'loading' | 'ready' | 'error'
export type ReportStatusListener = (key: string, status: 'ready' | 'error', error?: unknown) => void

export interface ReportStatusEntry {
  status: ReportStatus
  message?: string
  updatedAt?: number
}

export interface ReportFailure {
  key: string
  label: string
  message: string
}

export function createReportStatus(
  previous: Record<string, ReportStatusEntry>,
  keys: string[],
  status: ReportStatus
): Record<string, ReportStatusEntry> {
  const next = { ...previous }
  for (const key of keys) next[key] = { status, updatedAt: Date.now() }
  return next
}

export function recordReportSuccess(
  previous: Record<string, ReportStatusEntry>,
  key: string
): Record<string, ReportStatusEntry> {
  return { ...previous, [key]: { status: 'ready', updatedAt: Date.now() } }
}

export function recordReportFailure(
  previous: Record<string, ReportStatusEntry>,
  key: string,
  error: unknown
): Record<string, ReportStatusEntry> {
  return {
    ...previous,
    [key]: { status: 'error', message: describeReportError(error), updatedAt: Date.now() }
  }
}

export function describeReportError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'Unknown report error'
}

/**
 * Runs a report loader and reports its outcome without throwing, so a single
 * failing backend call cannot be mistaken for an empty result. The caller keeps
 * the previous value on failure instead of silently blanking the block.
 */
export async function loadReport<T>(
  key: string,
  loader: () => Promise<T>,
  onStatus: (key: string, status: 'ready' | 'error', error?: unknown) => void
): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    const value = await loader()
    onStatus(key, 'ready')
    return { ok: true, value }
  } catch (error) {
    onStatus(key, 'error', error)
    return { ok: false }
  }
}

export function collectReportFailures(
  status: Record<string, ReportStatusEntry>,
  labels: Record<string, string>
): ReportFailure[] {
  return Object.entries(status)
    .filter(([, entry]) => entry.status === 'error')
    .map(([key, entry]) => ({
      key,
      label: labels[key] || key,
      message: entry.message || 'Unknown report error'
    }))
}

export function reportStatusTag(entry: ReportStatusEntry | undefined): 'error' | 'ready' | 'loading' {
  if (!entry || entry.status === 'idle' || entry.status === 'loading') return 'loading'
  if (entry.status === 'error') return 'error'
  return 'ready'
}
