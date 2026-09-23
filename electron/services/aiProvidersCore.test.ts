// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { AiProviderStore } from './aiProvidersCore'
import type { CredentialCipher } from './credentialVaultCore'

const cipher: CredentialCipher = {
  storage: 'test-adapter', encrypted: true,
  encrypt: (value) => value, decrypt: (value) => value,
  status: () => ({ storage: 'test-adapter', encrypted: true, available: true })
}

it('probes Azure resource models with api-key and refuses credential redirects', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }))
  const store = new AiProviderStore('/unused', cipher, fetchImpl)
  const result = await store.testProvider({ kind: 'azure-openai',
    baseUrl: 'https://example.openai.azure.com/openai/deployments/demo', apiKey: 'test-secret' })
  expect(result.ok).toBe(true)
  expect(fetchImpl).toHaveBeenCalledWith('https://example.openai.azure.com/openai/models?api-version=2024-10-21',
    expect.objectContaining({ redirect: 'error', headers: { accept: 'application/json', 'api-key': 'test-secret' } }))
})
