const MAX_RESPONSE_BYTES = 5 * 1024 * 1024

export interface FetchJsonOptions {
  accept?: string
  timeoutMs?: number
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions | number = {}): Promise<T> {
  const normalizedOptions = typeof options === 'number' ? { timeoutMs: options } : options
  const timeoutMs = normalizedOptions.timeoutMs ?? 10_000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: {
        accept: normalizedOptions.accept || 'application/json',
        'user-agent': 'DependencyHub-Desktop'
      },
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`Registry request failed with HTTP ${response.status}`)
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > MAX_RESPONSE_BYTES) throw new Error('Registry response is too large')
    const body = await response.text()
    if (Buffer.byteLength(body, 'utf-8') > MAX_RESPONSE_BYTES) {
      throw new Error('Registry response is too large')
    }
    return JSON.parse(body) as T
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error(`Registry request timed out after ${timeoutMs}ms`)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
