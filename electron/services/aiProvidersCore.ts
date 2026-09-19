import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type {
  AiProviderConfig,
  AiProviderInput,
  AiProviderKind,
  AiProviderTestResult,
  AiProvidersStatus
} from '../../shared/aiProviders'
import { AI_PROVIDER_KINDS } from '../../shared/aiProviders'
import type { CredentialCipher, CredentialStorage } from './credentialVaultCore'
import { writeFileAtomic } from './atomicWrite'

const STORE_VERSION = 1

interface StoredAiProvider {
  id: string
  label: string
  kind: AiProviderKind
  baseUrl: string
  defaultModel?: string
  models: string[]
  enabled: boolean
  encryptedApiKey?: string
  keyStorage?: CredentialStorage
  createdAt: string
  updatedAt: string
}

interface StoreFile {
  version: number
  activeId: string | null
  providers: StoredAiProvider[]
}

const DEFAULT_BASE_URLS: Record<AiProviderKind, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  'azure-openai': 'https://your-resource.openai.azure.com/openai/deployments/your-deployment',
  ollama: 'http://localhost:11434',
  'openai-compatible': 'http://localhost:8080/v1',
  custom: ''
}

/**
 * Read-modify-write cycles are serialized exactly like the credential vault:
 * concurrent saves would otherwise read the same snapshot and drop entries.
 */
export class AiProviderStore {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly baseDir: string,
    private readonly cipher: CredentialCipher,
    /** Injectable fetch so tests can fake connectivity without a network. */
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async status(): Promise<AiProvidersStatus> {
    const store = await this.readStore()
    return {
      storage: this.storePath(),
      encrypted: this.cipher.encrypted,
      activeId: store.activeId,
      providerCount: store.providers.length
    }
  }

  async list(): Promise<AiProviderConfig[]> {
    const store = await this.readStore()
    return store.providers
      .slice()
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((provider) => toPublicConfig(provider))
  }

  async activeId(): Promise<string | null> {
    const store = await this.readStore()
    return store.activeId
  }

  async setActive(id: string | null): Promise<string | null> {
    return await this.enqueue(async () => {
      const store = await this.readStore()
      if (id && !store.providers.some((provider) => provider.id === id)) {
        throw new Error(`No AI provider exists with id "${id}".`)
      }
      store.activeId = id
      await this.writeStore(store)
      return id
    })
  }

  async upsert(input: AiProviderInput): Promise<AiProviderConfig> {
    const normalized = normalizeProviderInput(input)
    return await this.enqueue(async () => {
      const store = await this.readStore()
      const now = new Date().toISOString()
      const existingIndex = normalized.id
        ? store.providers.findIndex((provider) => provider.id === normalized.id)
        : -1
      const existing = existingIndex >= 0 ? store.providers[existingIndex] : undefined

      const provider: StoredAiProvider = {
        id: existing?.id || normalized.id || randomUUID(),
        label: normalized.label,
        kind: normalized.kind,
        baseUrl: normalized.baseUrl,
        defaultModel: normalized.defaultModel,
        models: normalized.models,
        enabled: normalized.enabled,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      }

      // A blank/undefined apiKey keeps the stored key; a non-empty value replaces it.
      const apiKey = normalized.apiKey?.trim()
      if (apiKey) {
        provider.encryptedApiKey = this.cipher.encrypt(apiKey)
        provider.keyStorage = this.cipher.storage
      } else if (existing) {
        provider.encryptedApiKey = existing.encryptedApiKey
        provider.keyStorage = existing.keyStorage
      }

      if (existingIndex >= 0) store.providers[existingIndex] = provider
      else store.providers.push(provider)

      // The first provider becomes active automatically so a single-provider
      // setup needs no extra click.
      if (!store.activeId) store.activeId = provider.id

      await this.writeStore(store)
      return toPublicConfig(provider)
    })
  }

  async remove(id: string): Promise<boolean> {
    return await this.enqueue(async () => {
      const store = await this.readStore()
      const next = store.providers.filter((provider) => provider.id !== id)
      if (next.length === store.providers.length) return false
      store.providers = next
      if (store.activeId === id) store.activeId = next[0]?.id || null
      await this.writeStore(store)
      return true
    })
  }

  /** Resolves the stored plaintext key. Main-process only; never crosses IPC. */
  async resolveApiKey(id: string): Promise<string | undefined> {
    const store = await this.readStore()
    const provider = store.providers.find((item) => item.id === id)
    if (!provider?.encryptedApiKey || !provider.keyStorage) return undefined
    return this.cipher.decrypt(provider.encryptedApiKey, provider.keyStorage)
  }

  /**
   * Connectivity test: issues the cheapest read-only request each provider
   * family supports and reports status plus latency. Missing keys are tested
   * too (many local runtimes need no auth), so the result distinguishes
   * auth failures from reachability failures.
   */
  async test(id: string): Promise<AiProviderTestResult> {
    const store = await this.readStore()
    const provider = store.providers.find((item) => item.id === id)
    if (!provider) throw new Error(`No AI provider exists with id "${id}".`)
    return await this.testProvider({
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      apiKey: await this.resolveApiKey(id)
    })
  }

  async testProvider(input: { kind: AiProviderKind; baseUrl: string; apiKey?: string }): Promise<AiProviderTestResult> {
    const base = input.baseUrl.replace(/\/+$/, '')
    const endpoint = probeEndpoint(input.kind, base)
    const headers = probeHeaders(input.kind, input.apiKey)
    const startedAt = Date.now()
    try {
      const response = await this.fetchImpl(endpoint, {
        headers,
        signal: AbortSignal.timeout(8000)
      })
      const latencyMs = Date.now() - startedAt
      const ok = response.status < 400
      return {
        ok,
        endpoint,
        status: response.status,
        latencyMs,
        detail: ok
          ? `Endpoint responded ${response.status} in ${latencyMs}ms`
          : authRejected(response.status)
            ? 'The endpoint rejected the configured API key (401/403).'
            : `The endpoint responded ${response.status} ${response.statusText || ''}`.trim()
      }
    } catch (error) {
      return {
        ok: false,
        endpoint,
        status: null,
        latencyMs: Date.now() - startedAt,
        detail: `Unable to reach the endpoint: ${(error as Error).message}`
      }
    }
  }

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation)
    this.queue = next.catch(() => undefined)
    return next
  }

  private storePath(): string {
    return join(this.baseDir, 'ai-providers.json')
  }

  private async readStore(): Promise<StoreFile> {
    let content: string
    try {
      content = await readFile(this.storePath(), 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: STORE_VERSION, activeId: null, providers: [] }
      throw new Error(`Unable to read the AI provider store at ${this.storePath()}: ${(error as Error).message}`)
    }
    let parsed: StoreFile
    try {
      parsed = JSON.parse(content.replace(/^\uFEFF/, '')) as StoreFile
    } catch (cause) {
      throw new Error(`The AI provider store at ${this.storePath()} is corrupted and cannot be parsed: ${(cause as Error).message}`)
    }
    if (!Array.isArray(parsed?.providers)) {
      throw new Error('The AI provider store has an unexpected structure; refusing to overwrite it.')
    }
    return {
      version: parsed.version || STORE_VERSION,
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
      providers: parsed.providers
    }
  }

  private async writeStore(store: StoreFile): Promise<void> {
    await writeFileAtomic(this.storePath(), `${JSON.stringify(store, null, 2)}\n`)
  }
}

function toPublicConfig(provider: StoredAiProvider): AiProviderConfig {
  return {
    id: provider.id,
    label: provider.label,
    kind: provider.kind,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    models: [...provider.models],
    enabled: provider.enabled,
    apiKeyConfigured: Boolean(provider.encryptedApiKey),
    apiKeyPreview: provider.encryptedApiKey ? previewKey(provider.encryptedApiKey) : null,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
  }
}

interface NormalizedProviderInput {
  id?: string
  label: string
  kind: AiProviderKind
  baseUrl: string
  defaultModel?: string
  models: string[]
  enabled: boolean
  apiKey?: string
}

function normalizeProviderInput(input: AiProviderInput): NormalizedProviderInput {
  const kind: AiProviderKind = AI_PROVIDER_KINDS.includes(input.kind) ? input.kind : 'openai-compatible'
  const label = input.label?.trim()
  if (!label) throw new Error('A provider label is required.')
  const baseUrl = (input.baseUrl?.trim() || DEFAULT_BASE_URLS[kind]).replace(/\/+$/, '')
  if (!baseUrl) throw new Error('A base URL is required for this provider kind.')
  return {
    ...input,
    id: input.id?.trim() || undefined,
    kind,
    label,
    baseUrl,
    defaultModel: input.defaultModel?.trim() || undefined,
    models: (input.models || []).map((model) => model.trim()).filter(Boolean),
    enabled: input.enabled !== false
  }
}

function previewKey(encryptedKey: string): string {
  // The preview masks the ciphertext, which never reveals the plaintext key but
  // still lets the UI show a stable fingerprint per stored key.
  const digest = Buffer.from(encryptedKey, 'base64').toString('hex')
  return digest.length >= 8 ? `${digest.slice(0, 4)}…${digest.slice(-4)}` : '••••'
}

function probeEndpoint(kind: AiProviderKind, base: string): string {
  switch (kind) {
    case 'anthropic': return `${base}/v1/models`
    case 'google': return `${base}/v1beta/models`
    case 'ollama': return `${base}/api/tags`
    case 'azure-openai': return `${base}/models?api-version=2024-02-01`
    default: return `${base}/models`
  }
}

function probeHeaders(kind: AiProviderKind, apiKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (!apiKey) return headers
  switch (kind) {
    case 'anthropic':
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
      break
    case 'google':
      headers['x-goog-api-key'] = apiKey
      break
    case 'ollama':
      break
    default:
      headers.authorization = `Bearer ${apiKey}`
  }
  return headers
}

function authRejected(status: number): boolean {
  return status === 401 || status === 403
}
