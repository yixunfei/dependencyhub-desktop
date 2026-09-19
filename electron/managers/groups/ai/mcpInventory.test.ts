// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mcpServerBinding, mcpServerMap, withServerMap } from './mcpInventory'

describe('MCP server map binding', () => {
  it('detects each supported shape and reports its key path', () => {
    expect(mcpServerBinding({ mcpServers: { a: 1 } })).toMatchObject({ keyPath: ['mcpServers'] })
    expect(mcpServerBinding({ servers: { a: 1 } })).toMatchObject({ keyPath: ['servers'] })
    expect(mcpServerBinding({ mcp: { servers: { a: 1 } } })).toMatchObject({ keyPath: ['mcp', 'servers'] })
    expect(mcpServerBinding({})).toMatchObject({ keyPath: ['mcpServers'] })
  })

  it('writes back in place instead of adding a duplicate mcpServers key', () => {
    const source = { servers: { a: 1 }, other: true }
    const next = withServerMap(source, mcpServerBinding(source).keyPath, { b: 2 })
    expect(next).toEqual({ servers: { b: 2 }, other: true })
    expect('mcpServers' in next).toBe(false)
  })

  it('updates nested mcp.servers in place', () => {
    const source = { mcp: { servers: { a: 1 }, extra: 2 } }
    const next = withServerMap(source, mcpServerBinding(source).keyPath, {})
    expect(next).toEqual({ mcp: { servers: {}, extra: 2 } })
  })

  it('keeps mcpServerMap as the read-only view', () => {
    expect(mcpServerMap({ servers: { a: 1 } })).toEqual({ a: 1 })
    expect(mcpServerMap({ mcpServers: { b: 2 } })).toEqual({ b: 2 })
  })
})
