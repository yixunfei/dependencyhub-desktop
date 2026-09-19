import { app, safeStorage } from 'electron'
import { join } from 'path'
import {
  CredentialVaultStore,
  createBase64CredentialCipher,
  type CredentialCipher,
  type CredentialStorage
} from './credentialVaultCore'

/**
 * Shared safeStorage-backed cipher. Exported so sibling stores (AI provider API
 * keys) use the same at-rest encryption instead of reinventing it.
 */
export function createElectronCredentialCipher(): CredentialCipher {
  if (!safeStorage.isEncryptionAvailable()) {
    // Product decision: keep saving on Linux hosts without a keyring, but the
    // degraded state must be visible. CredentialMetadata.storage/encrypted
    // already record it per credential; each save also logs a warning so the
    // unencrypted persistence is impossible to miss in the logs.
    const fallback = createBase64CredentialCipher('base64-fallback')
    return {
      ...fallback,
      encrypt(value: string): string {
        console.warn('Credential vault: OS secure storage is unavailable; saving credential with base64 fallback (NOT encrypted).')
        return fallback.encrypt(value)
      }
    }
  }

  return {
    storage: 'electron-safe-storage',
    encrypted: true,
    encrypt(value: string): string {
      return safeStorage.encryptString(value).toString('base64')
    },
    decrypt(value: string, storage: CredentialStorage): string {
      if (storage !== 'electron-safe-storage') {
        return Buffer.from(value, 'base64').toString('utf-8')
      }
      return safeStorage.decryptString(Buffer.from(value, 'base64'))
    },
    status() {
      return {
        available: true,
        encrypted: true,
        storage: 'electron-safe-storage'
      }
    }
  }
}

export const credentialVaultService = new CredentialVaultStore(
  join(app.getPath('userData'), 'credential-vault'),
  createElectronCredentialCipher()
)

export type {
  CredentialFilter,
  CredentialInput,
  CredentialKind,
  CredentialMetadata,
  CredentialResolution,
  CredentialStorage,
  CredentialVaultStatus
} from './credentialVaultCore'
