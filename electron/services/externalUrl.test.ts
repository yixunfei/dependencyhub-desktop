// @vitest-environment node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isAllowedAppNavigation } from './externalUrl'

describe('application navigation boundary', () => {
  const entry = resolve('dist/index.html')
  it('allows application hash routes but rejects unrelated local documents', () => {
    expect(isAllowedAppNavigation(`${pathToFileURL(entry)}#/health`, entry, false)).toBe(true)
    expect(isAllowedAppNavigation(String(pathToFileURL(resolve('other.html'))), entry, false)).toBe(false)
    expect(isAllowedAppNavigation('https://example.com', entry, false)).toBe(false)
  })
  it('compares the exact development origin instead of a URL prefix', () => {
    expect(isAllowedAppNavigation('http://localhost:5173/health', entry, true)).toBe(true)
    for (const url of ['http://localhost:51730', 'http://localhost:5173@evil.example', 'file:///other.html', 'invalid']) {
      expect(isAllowedAppNavigation(url, entry, true)).toBe(false)
    }
  })
})
