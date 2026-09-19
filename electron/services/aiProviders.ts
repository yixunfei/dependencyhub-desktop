import { app } from 'electron'
import { join } from 'path'
import { AiProviderStore } from './aiProvidersCore'
import { createElectronCredentialCipher } from './credentialVault'

/**
 * LLM provider configuration store. Provider metadata lives in
 * `userData/ai-providers.json`; API keys are encrypted at rest with the same
 * safeStorage-backed cipher the credential vault uses.
 */
export const aiProviderStore = new AiProviderStore(
  app.getPath('userData'),
  createElectronCredentialCipher()
)

export type {
  AiProviderConfig,
  AiProviderInput,
  AiProviderKind,
  AiProviderTestResult,
  AiProvidersStatus
} from '../../shared/aiProviders'
