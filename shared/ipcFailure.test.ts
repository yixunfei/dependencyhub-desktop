// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { captureIpcFailure, unwrapIpcResult } from './ipcFailure'

describe('IPC failure transport', () => {
  it('keeps cancellation and recovery evidence after a structured-clone round trip', async () => {
    const error = Object.assign(new Error('cancelled'), {
      failure: { category: 'cancelled', operationId: 'op-1', retryable: true },
      backup: { path: '/project/backup.json', files: [] },
      restore: { attempted: true, restored: true },
      stdout: 'partial output', code: 3
    })
    const payload = structuredClone(await captureIpcFailure(() => { throw error }))
    try {
      unwrapIpcResult(payload)
      expect.fail('Expected a renderer-side rejection')
    } catch (received) {
      expect(received).toBeInstanceOf(Error)
      expect(received).toMatchObject(error)
    }
  })

  it('preserves successful values and handles non-Error rejections', async () => {
    expect(unwrapIpcResult(await captureIpcFailure(() => ({ status: 'ok' })))).toEqual({ status: 'ok' })
    const payload = await captureIpcFailure(() => { throw 'backend unavailable' })
    expect(() => unwrapIpcResult(payload)).toThrow('backend unavailable')
  })

  it('does not misread business data that mimics the marker key', async () => {
    // Registry payloads and user package.json files travel through the same
    // channels; a marker-shaped object without a usable error must stay data.
    const markerOnly = { __dhIpcFailureV1: true, name: 'package' }
    expect(unwrapIpcResult(markerOnly)).toEqual(markerOnly)

    const malformed = { __dhIpcFailureV1: true, error: {} }
    expect(unwrapIpcResult(malformed)).toEqual(malformed)

    const legacyKey = { __dependencyHubFailure: true, error: { message: 'old protocol' } }
    expect(unwrapIpcResult(legacyKey)).toEqual(legacyKey)
  })
})
