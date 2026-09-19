/**
 * LLM provider management contract, shared between the main process
 * (AiProviderStore) and the renderer (AI providers page).
 *
 * API keys are never returned across the IPC boundary: the store keeps them
 * encrypted at rest and only exposes a masked preview plus a configured flag.
 */

/** Provider families the connection tester knows how to speak to. */
export type AiProviderKind =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure-openai'
  | 'ollama'
  | 'openai-compatible'
  | 'custom'

export const AI_PROVIDER_KINDS: readonly AiProviderKind[] = [
  'openai',
  'anthropic',
  'google',
  'azure-openai',
  'ollama',
  'openai-compatible',
  'custom'
]

/** Input accepted by `ai:providers:upsert`. A blank `apiKey` leaves the stored key unchanged. */
export interface AiProviderInput {
  id?: string
  label: string
  kind: AiProviderKind
  baseUrl: string
  defaultModel?: string
  models?: string[]
  enabled?: boolean
  apiKey?: string
}

/** Masked provider configuration returned to the renderer. */
export interface AiProviderConfig {
  id: string
  label: string
  kind: AiProviderKind
  baseUrl: string
  defaultModel?: string
  models: string[]
  enabled: boolean
  apiKeyConfigured: boolean
  apiKeyPreview: string | null
  createdAt: string
  updatedAt: string
}

export interface AiProviderTestResult {
  ok: boolean
  endpoint: string
  status: number | null
  latencyMs: number
  detail: string
}

export interface AiProvidersStatus {
  storage: string
  encrypted: boolean
  activeId: string | null
  providerCount: number
}
