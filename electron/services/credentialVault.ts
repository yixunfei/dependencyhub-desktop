import { app, safeStorage } from 'electron'
import { join } from 'path'
import {
  CredentialVaultStore,
  createBase64CredentialCipher,
  type CredentialCipher,
  type CredentialStorage
} from './credentialVaultCore'

function createElectronCredentialCipher(): CredentialCipher {
  if (!safeStorage.isEncryptionAvailable()) {
    return createBase64CredentialCipher('base64-fallback')
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
