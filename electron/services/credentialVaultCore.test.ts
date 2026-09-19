// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { createBase64CredentialCipher, CredentialVaultStore } from './credentialVaultCore'

describe('CredentialVaultStore failure containment', () => {
  it('treats only a missing vault as empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dh-vault-'))
    try {
      const store = new CredentialVaultStore(dir, createBase64CredentialCipher())
      await expect(store.list()).resolves.toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite a corrupted vault instead of reporting an empty one', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dh-vault-'))
    try {
      const vaultPath = join(dir, 'credential-vault.json')
      const corrupted = '{ this is not valid json'
      await writeFile(vaultPath, corrupted, 'utf-8')
      const store = new CredentialVaultStore(dir, createBase64CredentialCipher())

      await expect(store.list()).rejects.toThrow(/corrupted/i)
      await expect(store.save({ managerId: 'npm', service: 'registry', secret: 'secret' }))
        .rejects.toThrow(/corrupted/i)
      // The original bytes must survive: a fail-open read followed by a save
      // would have replaced every stored credential with just this one.
      expect(await readFile(vaultPath, 'utf-8')).toBe(corrupted)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('round-trips credentials when the vault is healthy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dh-vault-'))
    try {
      const store = new CredentialVaultStore(dir, createBase64CredentialCipher())
      await store.save({ managerId: 'npm', service: 'registry', secret: 'first' })
      await store.save({ managerId: 'npm', service: 'registry-two', secret: 'second' })
      const listed = await store.list()
      expect(listed).toHaveLength(2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
