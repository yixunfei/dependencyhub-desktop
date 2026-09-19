import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { randomUUID } from 'crypto'
import type { DependencyManagerId } from '../../shared/managerRegistry'

const VAULT_FILE = 'credential-vault.json'
const VAULT_VERSION = 1

export type CredentialKind = 'token' | 'password' | 'username-password' | 'api-key' | 'other'
export type CredentialStorage = 'electron-safe-storage' | 'base64-fallback' | 'test-adapter'

export interface CredentialCipher {
  storage: CredentialStorage
  encrypted: boolean
  encrypt(value: string): string
  decrypt(value: string, storage: CredentialStorage): string
  status(): CredentialVaultStatus
}

export interface CredentialVaultStatus {
  available: boolean
  encrypted: boolean
  storage: CredentialStorage
  warning?: string
}

export interface CredentialInput {
  id?: string
  managerId: DependencyManagerId
  service: string
  account?: string
  label?: string
  kind?: CredentialKind
  secret: string
  url?: string
  notes?: string
}

export interface CredentialFilter {
  managerId?: DependencyManagerId
  service?: string
}

export interface CredentialMetadata {
  id: string
  managerId: DependencyManagerId
  service: string
  account?: string
  label: string
  kind: CredentialKind
  url?: string
  notes?: string
  secretPreview: string
  storage: CredentialStorage
  encrypted: boolean
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export interface CredentialResolution {
  metadata: CredentialMetadata
  secret: string
}

interface StoredCredential extends CredentialMetadata {
  encryptedSecret: string
}

interface VaultFile {
  version: number
  credentials: StoredCredential[]
}

export class CredentialVaultStore {
  /**
   * All read-modify-write cycles must run inside this queue: concurrent
   * save/delete/resolve would otherwise read the same snapshot and the last
   * writer wins, silently dropping the other operation's credential.
   */
  private vaultQueue: Promise<unknown> = Promise.resolve()

  private enqueueVaultOperation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.vaultQueue.then(operation, operation)
    this.vaultQueue = next.catch(() => undefined)
    return next
  }

  constructor(
    private readonly baseDir: string,
    private readonly cipher: CredentialCipher
  ) {}

  status(): CredentialVaultStatus {
    return this.cipher.status()
  }

  async list(filter: CredentialFilter = {}): Promise<CredentialMetadata[]> {
    const vault = await this.readVault()
    return vault.credentials
      .filter((credential) => matchesFilter(credential, filter))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map(toMetadata)
  }

  async save(input: CredentialInput): Promise<CredentialMetadata> {
    return await this.enqueueVaultOperation(async () => {
      const normalized = normalizeCredentialInput(input)
      const vault = await this.readVault()
      const now = new Date().toISOString()
      const existingIndex = normalized.id
        ? vault.credentials.findIndex((credential) => credential.id === normalized.id)
        : -1
      const existing = existingIndex >= 0 ? vault.credentials[existingIndex] : undefined
      const encryptedSecret = this.cipher.encrypt(normalized.secret)
      const storage = this.cipher.storage
      const encrypted = this.cipher.encrypted
      const credential: StoredCredential = {
        id: existing?.id || normalized.id || randomUUID(),
        managerId: normalized.managerId,
        service: normalized.service,
        account: normalized.account,
        label: normalized.label || buildCredentialLabel(normalized),
        kind: normalized.kind || 'token',
        url: normalized.url,
        notes: normalized.notes,
        secretPreview: previewSecret(normalized.secret),
        storage,
        encrypted,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        lastUsedAt: existing?.lastUsedAt,
        encryptedSecret
      }

      if (existingIndex >= 0) {
        vault.credentials[existingIndex] = credential
      } else {
        vault.credentials.push(credential)
      }

      await this.writeVault(vault)
      return toMetadata(credential)
    })
  }

  async delete(id: string): Promise<boolean> {
    if (!id.trim()) return false
    return await this.enqueueVaultOperation(async () => {
      const vault = await this.readVault()
      const nextCredentials = vault.credentials.filter((credential) => credential.id !== id)
      if (nextCredentials.length === vault.credentials.length) return false
      await this.writeVault({ ...vault, credentials: nextCredentials })
      return true
    })
  }

  async resolve(id: string): Promise<CredentialResolution> {
    const vault = await this.readVault()
    const credential = vault.credentials.find((item) => item.id === id)
    if (!credential) throw new Error('Credential not found')
    const secret = this.cipher.decrypt(credential.encryptedSecret, credential.storage)
    await this.touch(id)
    return {
      metadata: toMetadata(credential),
      secret
    }
  }

  async findByService(managerId: DependencyManagerId, service: string): Promise<CredentialMetadata | null> {
    const credentials = await this.list({ managerId, service })
    return credentials[0] || null
  }

  async resolveByService(managerId: DependencyManagerId, service: string): Promise<CredentialResolution | null> {
    const credential = await this.findByService(managerId, service)
    return credential ? this.resolve(credential.id) : null
  }

  private async touch(id: string): Promise<void> {
    await this.enqueueVaultOperation(async () => {
      const vault = await this.readVault()
      const credential = vault.credentials.find((item) => item.id === id)
      if (!credential) return
      credential.lastUsedAt = new Date().toISOString()
      await this.writeVault(vault)
    })
  }

  private async readVault(): Promise<VaultFile> {
    const path = this.vaultPath()
    let content: string
    try {
      content = await readFile(path, 'utf-8')
    } catch (error) {
      // Only a genuinely missing vault means "empty". A transient read failure
      // (EACCES/EBUSY/EPERM) must never be treated as an empty vault: save()
      // would then rewrite the file with just the new credential and silently
      // destroy every stored secret.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyVault()
      throw new Error(`Unable to read the credential vault at ${path}: ${(error as Error).message}`)
    }

    let parsed: VaultFile
    try {
      // Strip a possible UTF-8 BOM before parsing so an externally edited file
      // is not misreported as corrupt.
      parsed = JSON.parse(content.replace(/^\uFEFF/, '')) as VaultFile
    } catch (cause) {
      throw new Error(`The credential vault at ${path} is corrupted and cannot be parsed: ${(cause as Error).message}`)
    }

    if (!Array.isArray(parsed?.credentials)) {
      throw new Error(`The credential vault at ${path} has an unexpected structure; refusing to overwrite it.`)
    }

    const credentials: StoredCredential[] = []
    for (const entry of parsed.credentials) {
      const repaired = repairStoredCredential(entry)
      if (repaired) credentials.push(repaired)
    }

    return {
      version: parsed.version || VAULT_VERSION,
      credentials
    }
  }

  private async writeVault(vault: VaultFile): Promise<void> {
    const path = this.vaultPath()
    await mkdir(dirname(path), { recursive: true })
    // A unique staging file per write keeps concurrent or crashed writers from
    // corrupting each other's snapshot; a fixed `${path}.tmp` does not.
    const tmpPath = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(tmpPath, JSON.stringify({
        version: VAULT_VERSION,
        credentials: vault.credentials
      }, null, 2), 'utf-8')
      await rename(tmpPath, path)
    } catch (error) {
      // The staging file must not survive a failed write, whether the writeFile
      // or the rename failed — leaked `<uuid>.tmp` files accumulate forever.
      // Never unlink the live vault to "make room" for the rename: if the
      // retry also fails, the previous vault contents must stay intact.
      await unlink(tmpPath).catch(() => undefined)
      throw error
    }
  }

  private vaultPath(): string {
    return join(resolve(this.baseDir), VAULT_FILE)
  }
}

export function createBase64CredentialCipher(storage: CredentialStorage = 'test-adapter'): CredentialCipher {
  return {
    storage,
    encrypted: false,
    encrypt(value: string) {
      return Buffer.from(value, 'utf-8').toString('base64')
    },
    decrypt(value: string) {
      return Buffer.from(value, 'base64').toString('utf-8')
    },
    status() {
      return {
        available: true,
        encrypted: false,
        storage,
        warning: storage === 'base64-fallback' ? 'OS secure storage is unavailable; values are only encoded.' : undefined
      }
    }
  }
}

function emptyVault(): VaultFile {
  return {
    version: VAULT_VERSION,
    credentials: []
  }
}

function normalizeCredentialInput(input: CredentialInput): CredentialInput {
  const managerId = input.managerId
  const service = input.service?.trim()
  const secret = input.secret || ''
  if (!managerId) throw new Error('Credential manager is required')
  if (!service) throw new Error('Credential service is required')
  if (!secret) throw new Error('Credential secret is required')
  return {
    ...input,
    service,
    account: input.account?.trim() || undefined,
    label: input.label?.trim() || undefined,
    url: input.url?.trim() || undefined,
    notes: input.notes?.trim() || undefined
  }
}

function buildCredentialLabel(input: CredentialInput): string {
  return [
    input.managerId,
    input.service,
    input.account
  ].filter(Boolean).join(' / ')
}

function previewSecret(secret: string): string {
  if (!secret) return ''
  if (secret.length <= 4) return '****'
  return `****${secret.slice(-4)}`
}

function matchesFilter(credential: StoredCredential, filter: CredentialFilter): boolean {
  if (filter.managerId && credential.managerId !== filter.managerId) return false
  if (filter.service && credential.service !== filter.service) return false
  return true
}

function toMetadata(credential: StoredCredential): CredentialMetadata {
  const { encryptedSecret, ...metadata } = credential
  return metadata
}

const VALID_CREDENTIAL_KINDS: ReadonlySet<string> = new Set(['token', 'password', 'username-password', 'api-key', 'other'])
const VALID_CREDENTIAL_STORAGE: ReadonlySet<string> = new Set(['electron-safe-storage', 'base64-fallback', 'test-adapter'])

/**
 * Entries missing cosmetic metadata used to be silently dropped on read, and
 * the next save/delete/touch then wrote the filtered list back — permanently
 * deleting a recoverable credential. Any entry that still carries its id and
 * encrypted secret is repaired with defaults instead; only entries without
 * the encrypted payload (they could never be resolved) are dropped.
 */
function repairStoredCredential(value: unknown): StoredCredential | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<StoredCredential>
  if (!entry.id || !entry.encryptedSecret) return null
  const now = new Date().toISOString()
  return {
    id: entry.id,
    managerId: (entry.managerId || 'npm') as StoredCredential['managerId'],
    service: entry.service || 'unknown',
    account: entry.account,
    label: entry.label || entry.service || entry.id,
    kind: (VALID_CREDENTIAL_KINDS.has(entry.kind || '') ? entry.kind : 'other') as StoredCredential['kind'],
    url: entry.url,
    notes: entry.notes,
    secretPreview: entry.secretPreview || '****',
    storage: (VALID_CREDENTIAL_STORAGE.has(entry.storage || '') ? entry.storage : 'base64-fallback') as StoredCredential['storage'],
    encrypted: Boolean(entry.encrypted),
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || entry.createdAt || now,
    lastUsedAt: entry.lastUsedAt,
    encryptedSecret: entry.encryptedSecret
  }
}
