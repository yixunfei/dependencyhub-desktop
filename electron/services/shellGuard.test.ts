// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { assertSafeShellTarget } from './shellGuard'

describe('assertSafeShellTarget', () => {
  it('rejects executable files and allows regular documents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dh-shell-guard-'))
    try {
      const exe = join(dir, 'payload.exe')
      const text = join(dir, 'report.txt')
      const nested = join(dir, 'folder')
      await writeFile(exe, '')
      await writeFile(text, 'report')
      await writeFile(nested, '')

      await expect(assertSafeShellTarget(exe)).rejects.toThrow(/executable/i)
      await expect(assertSafeShellTarget(text)).resolves.toBeUndefined()
      await expect(assertSafeShellTarget('')).rejects.toThrow(/non-empty/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it.runIf(process.platform === 'win32')('does not let trailing dots/spaces bypass the extension check', async () => {
    // Windows strips trailing dots and spaces when resolving a path, so
    // `payload.exe.` / `payload.exe ` must be normalized before the check.
    const dir = await mkdtemp(join(tmpdir(), 'dh-shell-guard-'))
    try {
      const exe = join(dir, 'payload.exe')
      await writeFile(exe, '')
      await expect(assertSafeShellTarget(`${exe}.`)).rejects.toThrow(/executable/i)
      await expect(assertSafeShellTarget(`${exe} `)).rejects.toThrow(/executable/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
