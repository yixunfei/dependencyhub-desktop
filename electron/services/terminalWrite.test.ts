// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {} }))

type Listener = (payload?: unknown) => void

function createFakeStream() {
  const listeners: Record<string, Listener[]> = {}
  return {
    destroyed: false,
    writableEnded: false,
    write: vi.fn((_data: string, callback?: (error?: Error | null) => void) => {
      callback?.(null)
      return true
    }),
    on(event: string, listener: Listener) {
      listeners[event] = listeners[event] || []
      listeners[event].push(listener)
      return this
    },
    emit(event: string, payload?: unknown) {
      for (const listener of listeners[event] || []) listener(payload)
    },
    hasListener(event: string) {
      return (listeners[event] || []).length > 0
    }
  }
}

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('child_process', () => ({ spawn }))

import { TerminalService } from './terminal'

function createFakeChild() {
  return {
    stdin: createFakeStream(),
    stdout: createFakeStream(),
    stderr: createFakeStream(),
    killed: false,
    on: vi.fn(),
    kill: vi.fn()
  }
}

describe('terminal write safety', () => {
  it('swallows stdin stream errors instead of crashing on an unhandled event', () => {
    const child = createFakeChild()
    spawn.mockReturnValue(child)
    const service = new TerminalService()
    const session = service.create()

    // Before the fix a stdin 'error' had no listener, so Node re-threw it as an
    // uncaughtException and took the main process down.
    expect(child.stdin.hasListener('error')).toBe(true)
    expect(() => child.stdin.emit('error', new Error('ERR_STREAM_DESTROYED'))).not.toThrow()
    service.killAll()
  })

  it('rejects writes once the stdin stream is destroyed', () => {
    const child = createFakeChild()
    spawn.mockReturnValue(child)
    const service = new TerminalService()
    const session = service.create()

    child.stdin.destroyed = true
    expect(() => service.write(session.id, 'echo late\r\n'))
      .toThrow('Terminal session is not available')

    child.stdin.destroyed = false
    child.stdin.writableEnded = true
    expect(() => service.write(session.id, 'echo late\r\n'))
      .toThrow('Terminal session is not available')
    service.killAll()
  })

  it('writes through to a healthy stream', () => {
    const child = createFakeChild()
    spawn.mockReturnValue(child)
    const service = new TerminalService()
    const session = service.create()

    service.write(session.id, 'echo hi\r\n')
    expect(child.stdin.write).toHaveBeenCalledWith('echo hi\r\n', expect.any(Function))
    service.killAll()
  })
})
