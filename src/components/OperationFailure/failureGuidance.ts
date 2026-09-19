import { dictionaries, type TranslationKey } from '../../i18n/dictionaries'
import type { LabelTranslator } from '../../i18n'
import type { ManagerFailureCategory, ManagerOperationFailure } from '@shared/managerWorkspace'

/**
 * Maps a classified failure onto something a person can act on.
 *
 * The main process already knows *why* a command failed (network, expired
 * credentials, a missing tool…). This module turns that into a title, an
 * explanation sentence, and the few remedies that actually apply — so the UI
 * stops dumping raw stderr at users who then have to guess their next move.
 */
export type FailureActionKind =
  | 'openCommandLog'
  | 'openRegistrySettings'
  | 'openLogin'
  | 'openToolchain'
  | 'openConfigFile'
  | 'configureProxy'

export interface FailureAction {
  kind: FailureActionKind
  labelKey: TranslationKey
}

export interface FailureGuidance {
  category: ManagerFailureCategory
  titleKey: TranslationKey
  /** The detailed "what to do" sentence; falls back to a generic reason. */
  reasonKey: TranslationKey
  params: Record<string, string | number>
  tone: 'error' | 'warning' | 'info'
  actions: FailureAction[]
}

/** Remedies worth offering per cause; every row is something the user can do. */
const ACTIONS_BY_CATEGORY: Record<ManagerFailureCategory, FailureActionKind[]> = {
  network: ['configureProxy', 'openRegistrySettings', 'openCommandLog'],
  certificate: ['openRegistrySettings', 'openCommandLog'],
  proxy: ['configureProxy', 'openRegistrySettings'],
  permission: ['openCommandLog'],
  'toolchain-missing': ['openToolchain', 'openCommandLog'],
  auth: ['openLogin', 'openRegistrySettings', 'openCommandLog'],
  registry: ['openRegistrySettings', 'openConfigFile', 'openCommandLog'],
  conflict: ['openCommandLog'],
  timeout: ['openCommandLog'],
  cancelled: [],
  'output-limit': ['openCommandLog'],
  'exit-code': ['openCommandLog'],
  unknown: ['openCommandLog']
}

const TONES: Record<ManagerFailureCategory, FailureGuidance['tone']> = {
  network: 'error',
  certificate: 'error',
  proxy: 'error',
  permission: 'error',
  'toolchain-missing': 'error',
  auth: 'error',
  registry: 'error',
  conflict: 'warning',
  timeout: 'warning',
  cancelled: 'info',
  'output-limit': 'warning',
  'exit-code': 'error',
  unknown: 'error'
}

/** Substitutes when the classifier could not extract the entity involved. */
const PARAM_FALLBACKS: Record<string, string> = {
  host: 'the registry',
  tool: 'the required tool',
  detail: 'the requested change',
  statusCode: '',
  errorCode: '',
  count: '',
  script: '',
  id: '',
  name: '',
  version: '',
  file: '',
  path: '',
  message: ''
}

function isTranslationKey(key: string): key is TranslationKey {
  return Object.prototype.hasOwnProperty.call(dictionaries['en-US'], key)
}

/**
 * A reason key arriving from the main process is plain string: it was produced
 * by a version of the classifier that may be newer or older than this bundle,
 * so it is validated before being used as a lookup.
 */
function resolveReasonKey(key: string | undefined, category: ManagerFailureCategory): TranslationKey {
  if (key && isTranslationKey(key)) return key
  const derived = `failure.${category}` as TranslationKey
  return isTranslationKey(derived) ? derived : 'failure.unknown'
}

function buildParams(failure: ManagerOperationFailure): Record<string, string | number> {
  const params = { ...(failure.reason?.params || {}) }
  if (!params.detail && failure.exitCode !== undefined) params.detail = `code ${failure.exitCode}`
  for (const [name, fallback] of Object.entries(PARAM_FALLBACKS)) {
    if (params[name] === undefined || params[name] === '') params[name] = fallback
  }
  return params
}

export function failureGuidance(failure: ManagerOperationFailure | undefined): FailureGuidance {
  if (!failure) {
    return {
      category: 'unknown',
      titleKey: 'failure.title.unknown',
      reasonKey: 'failure.unknown',
      params: {},
      tone: 'error',
      actions: []
    }
  }

  const category = failure.category || 'unknown'
  const params = buildParams(failure)
  return {
    category,
    titleKey: resolveReasonKey(`failure.title.${category}`, category),
    reasonKey: resolveReasonKey(failure.reason?.key, category),
    params,
    tone: TONES[category] || 'error',
    actions: (ACTIONS_BY_CATEGORY[category] || []).map((kind) => ({
      kind,
      labelKey: `failure.action.${kind}` as TranslationKey
    }))
  }
}

export interface FailureText {
  title: string
  reason: string
  hint?: string
}

export function describeFailure(t: LabelTranslator, failure: ManagerOperationFailure | undefined): FailureText {
  const guidance = failureGuidance(failure)
  const hintKey: TranslationKey = failure?.retryable ? 'failure.retryHint' : 'failure.noRetryHint'
  return {
    title: t(guidance.titleKey, guidance.params),
    reason: t(guidance.reasonKey, guidance.params),
    hint: failure ? t(hintKey) : undefined
  }
}
