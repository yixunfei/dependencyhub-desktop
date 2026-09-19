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
    const transport = url.startsWith('http://') ? http : https
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const request = transport.request(url, {
      method,
      headers: options.headers
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if ((response.statusCode || 0) >= 400) {
          reject(new Error(text || `HTTP ${response.statusCode}`))
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
