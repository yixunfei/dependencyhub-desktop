// @vitest-environment node
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, it } from 'vitest'
import { readManifestContent, manifestContentToWritable } from './manifestContent'

it('round-trips binary lockfiles and non-UTF8 manifests without corrupting bytes', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'manifest-bytes-'))
  try {
    for (const name of ['bun.lockb', 'requirements.txt']) {
      const input = Buffer.from([0xff, 0xfe, 0x61, 0x80])
      await writeFile(join(cwd, name), input)
      const stored = await readManifestContent(join(cwd, name))
      expect(stored.encoding).toBe('base64')
      expect(manifestContentToWritable(stored)).toEqual(input)
    }
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
