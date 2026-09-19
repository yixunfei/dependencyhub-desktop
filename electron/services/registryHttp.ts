import https from 'https'
import http from 'http'

/**
 * Shared HTTP client for registry lookups (npm/cargo/go/maven/gradle/flutter/pip).
 *
 * A bare https.get with no timeout leaves the promise pending forever when a
 * server accepts the connection but never answers (half-open TCP, stalled
 * proxy), and the caller has no operation context to cancel it. It also misses
 * the 'error' event on the response stream: a connection reset mid-body would
 * surface as an uncaughtException and crash the main process. Both are handled
 * here once so every registry consumer gets the same guarantees.
 */

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_ERROR_BODY_CHARS = 500

/**
 * Connection reuse matters more than it looks: a search page issues dozens of
 * registry calls, and without keep-alive each one pays another full TLS
 * handshake against the same host.
 */
const agents = {
  http: new http.Agent({ keepAlive: true, maxSockets: 8, scheduling: 'lifo' }),
  https: new https.Agent({ keepAlive: true, maxSockets: 8, scheduling: 'lifo' })
}

export interface RegistryRequestOptions {
  /** Socket inactivity limit; the request is destroyed when exceeded. */
  timeoutMs?: number
  headers?: Record<string, string>
}

function requestText(
  url: string,
  method: 'GET' | 'POST',
  options: RegistryRequestOptions & { body?: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isPlainHttp = url.startsWith('http://')
    const transport = isPlainHttp ? http : https
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const request = transport.request(url, {
      method,
      agent: isPlainHttp ? agents.http : agents.https,
      headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) }
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const statusCode = response.statusCode || 0
        if (statusCode >= 400) {
          // Keep the status code on the error: callers can only tell the user
          // to log in (401) or fix a proxy (407) if the code survives here.
          const detail = text.trim().slice(0, MAX_ERROR_BODY_CHARS)
          reject(Object.assign(
            new Error(detail ? `HTTP ${statusCode}: ${detail}` : `HTTP ${statusCode}`),
            { code: 'REGISTRY_HTTP_STATUS', statusCode }
          ))
          return
        }
        resolve(text)
      })
      response.on('error', reject)
    })
    request.setTimeout(timeoutMs, () => {
      request.destroy(Object.assign(
        new Error(`Registry request timed out after ${timeoutMs} ms`), { code: 'REGISTRY_TIMEOUT' }
      ))
    })
    request.on('error', reject)
    if (options.body !== undefined) {
      request.write(options.body)
    }
    request.end()
  })
}

const USER_AGENT = 'DependencyHub-Desktop'

export function registryHttpGet(url: string, options: RegistryRequestOptions = {}): Promise<string> {
  return requestText(url, 'GET', options)
}

export function registryHttpPostJson(url: string, payload: unknown, options: RegistryRequestOptions = {}): Promise<string> {
  const body = JSON.stringify(payload)
  return requestText(url, 'POST', {
    ...options,
    body,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(body)),
      ...(options.headers || {})
    }
  })
}
