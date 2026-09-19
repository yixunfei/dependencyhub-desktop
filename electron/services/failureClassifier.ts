import type {
  ManagerFailureCategory,
  OperationFailureEvidence,
  OperationFailureReason
} from '../../shared/managerWorkspace'

/**
 * Translates opaque package-manager output into a cause the user can act on.
 *
 * Every ecosystem reports failure differently, but from the user's point of
 * view there are only a handful of things that go wrong: the network is broken,
 * the credentials expired, the tool is missing, the registry URL is wrong. The
 * categories below let the UI say which of those happened instead of dumping a
 * raw stack trace, and `retryable` stops offering "try again" for failures that
 * simply cannot succeed until something else changes.
 */
export type OperationFailureCategory = ManagerFailureCategory

export type FailureEvidence = OperationFailureEvidence
export type FailureReason = OperationFailureReason

export type FailureClassification = {
  category: OperationFailureCategory
  retryable: boolean
  reason?: FailureReason
  evidence?: FailureEvidence
}

interface FailureRule {
  category: OperationFailureCategory
  retryable: boolean
  reasonKey: string
  patterns: RegExp[]
  evidence?: (text: string, match: RegExpMatchArray) => FailureEvidence
}

/**
 * Order matters: later rules only see output earlier rules did not claim. In
 * particular filesystem permission errors mention "denied" too, so they are
 * checked before `auth`, and proxy failures before generic 40x handling.
 */
const RULES: FailureRule[] = [
  {
    // Before the network rule: TLS problems arrive wrapped in the same
    // "request to ... failed" sentence, and calling a rejected certificate a
    // connectivity problem sends users to check a network that works fine.
    category: 'certificate',
    retryable: false,
    reasonKey: 'failure.certificate',
    patterns: [
      /self[- ]signed certificate/i, /UNABLE_TO_VERIFY_LEAF_SIGNATURE/,
      /SELF_SIGNED_CERT_IN_CHAIN/, /DEPTH_ZERO_SELF_SIGNED_CERT/,
      /CERT_HAS_EXPIRED/, /CERT_UNTRUSTED/, /UNABLE_TO_GET_ISSUER_CERT/i,
      /unable to verify the first certificate/i, /unable to get local issuer certificate/i,
      /certificate chain/i, /certificate has expired/i, /wrong signature type/i
    ],
    evidence: (text) => ({ host: extractHost(text) })
  },
  {
    category: 'network',
    retryable: true,
    reasonKey: 'failure.network',
    patterns: [
      /EAI_AGAIN/, /EAI_FAIL/, /ENOTFOUND/, /ETIMEDOUT/, /ECONNREFUSED/, /ECONNRESET/,
      /EHOSTUNREACH/, /ENETUNREACH/, /EPROTO/, /EPIPE/, /getaddrinfo/,
      /socket hang up/i, /network is unreachable/i, /network request to/i,
      /request to [^\s]+ failed/i, /failed to connect to/i, /connection timed out/i,
      /network timeout/i, /network error/i, /offline/i, /no internet/i,
      /unable to (?:reach|access) (?:the )?registry/i, /ECONNABORTED/
    ],
    evidence: (text) => ({ host: extractHost(text), errorCode: extractErrorCode(text) })
  },
  {
    category: 'proxy',
    retryable: false,
    reasonKey: 'failure.proxy',
    patterns: [
      /407\b/, /proxy authentication/i, /tunneling socket/i, /ETUNNEL/,
      /unable to tunnel/i, /proxy request/i, /HTTPS?_?PROXY/i
    ]
  },
  {
    category: 'permission',
    retryable: false,
    reasonKey: 'failure.permission',
    patterns: [
      /EACCES/, /EPERM/, /EROFS/, /permission denied/i, /access is denied/i,
      /operation not permitted/i, /read-only file system/i, /EINVALIDPERMS/i,
      /teleport.*locked/i
    ],
    evidence: (text) => ({ errorCode: extractErrorCode(text), endpoint: extractPath(text) })
  },
  {
    category: 'toolchain-missing',
    retryable: false,
    reasonKey: 'failure.toolchainMissing',
    patterns: [
      /command not found/i, /commandNotFound/i, /spawn .* ENOENT/, /ENOENT: no such file or directory, spawn/i,
      /not recognized as (?:an )?internal or external command/i,
      /is not recognized/i, /no such file or directory, (?:open|access) '(?:[^']*[\\/])?([^'\\/]+)'/i,
      /No module named '([\w.]+)'/i, /cannot find module '([\w.]+)'/i,
      /(?:deno|cargo|go|mvn|gradle|bundle|composer|swift|terraform|helm|bazel) is not installed/i
    ],
    evidence: (text) => ({ tool: extractTool(text), errorCode: extractErrorCode(text) })
  },
  {
    category: 'auth',
    retryable: false,
    reasonKey: 'failure.auth',
    patterns: [
      /\b401\b/, /\b403\b/, /unauthorized/i, /unauthenticated/i, /ENEEDAUTH/,
      /authentication (?:required|failed)/i, /invalid credentials/i,
      /credential(?:s)? (?:are )?(?:invalid|expired)/i, /not authorized/i,
      /forbidden/i, /login (?:is )?required/i, /must (?:be )?logged in/i,
      /npm ERR! code E401/, /unable to authenticate/i
    ],
    evidence: (text) => ({
      host: extractHost(text),
      statusCode: extractStatusCode(text),
      errorCode: extractErrorCode(text)
    })
  },
  {
    category: 'registry',
    retryable: false,
    reasonKey: 'failure.registry',
    patterns: [
      /404 Not Found/i, /ENEPMANIFEST/, /no matching version/i,
      /not found in (?:the )?(?:upstream|remote|registry)/i,
      /does not have (?:a|the) package/i, /no such package/i,
      /package (?:'[^']+'|\S+) (?:could not be|was not) found/i,
      /couldn'?t find (?:package|manifest)/i, /repository (?:not|does not) exist/i,
      /registry (?:returned|responded) 404/i
    ],
    evidence: (text) => ({
      host: extractHost(text),
      endpoint: extractHost(text) ? extractEndpoint(text) : undefined,
      statusCode: extractStatusCode(text)
    })
  },
  {
    category: 'conflict',
    retryable: false,
    reasonKey: 'failure.conflict',
    patterns: [
      /ERESOLVE/, /peer dep/i, /conflicting/i, /already exists/i, /EEXIST/,
      /version (?:conflict|mismatch)/i, /lock file/i, /EINTEGRITY/
    ]
  }
]

/**
 * Returns undefined when nothing is recognised: the caller then falls back to
 * the exit-code contract rather than guessing a cause.
 */
export function classifyFailureText(text: string): FailureClassification | undefined {
  if (!text) return undefined
  for (const rule of RULES) {
    const match = rule.patterns.reduce<RegExpMatchArray | null>((found, pattern) => found || text.match(pattern), null)
    if (!match) continue
    const evidence = rule.evidence?.(text, match)
    return {
      category: rule.category,
      retryable: rule.retryable,
      reason: { key: rule.reasonKey, params: buildParams(text, match, evidence) },
      evidence
    }
  }
  return undefined
}

function buildParams(text: string, match: RegExpMatchArray, evidence?: FailureEvidence): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (evidence?.host) params.host = evidence.host
  if (evidence?.tool) params.tool = evidence.tool
  if (evidence?.statusCode) params.statusCode = evidence.statusCode
  if (evidence?.errorCode) params.errorCode = evidence.errorCode
  const named = match.find((group, index) => index > 0 && typeof group === 'string' && group.length > 0)
  if (named && !params.tool) params.detail = named
  if (Object.keys(params).length === 0) params.detail = summariseLine(text)
  return params
}

function summariseLine(text: string): string {
  return text.trim().split(/\r?\n/).find((line) => line.trim().length > 0)?.trim().slice(0, 160) || ''
}

function extractHost(text: string): string | undefined {
  const fromRequest = text.match(/request to (https?:\/\/[^\s'"]+)/i)?.[1]
  const fromUrl = text.match(/https?:\/\/([^\s'")\]]+)/i)?.[1]
  const raw = fromRequest || fromUrl
  if (!raw) return undefined
  return raw.replace(/[.,;]+$/, '')
}

function extractEndpoint(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s'")\]]+/i)?.[0]?.replace(/[.,;]+$/, '')
}

function extractStatusCode(text: string): number | undefined {
  // Package managers prefix their own codes (`npm ERR! code E401`), so the
  // leading letter has to be allowed or the status is missed entirely.
  const status = text.match(/\bE?(401|403|407|404|409|500|502|503|504)\b/)?.[1]
  return status ? Number(status) : undefined
}

function extractErrorCode(text: string): string | undefined {
  return text.match(/\b(EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EAI_FAIL|ENEEDAUTH|EPERM|EACCES|EROFS|EEXIST|EINTEGRITY|ENEPMANIFEST|ERESOLVE|ETUNNEL)\b/)?.[1]
}

function extractTool(text: string): string | undefined {
  const patterns = [
    /spawn '([\w.-]+)'/i,
    /spawn ([\w.-]+) ENOENT/i,
    /command not found: ([\w.-]+)/i,
    /No module named '([\w.-]+)'/i,
    /([\w.-]+) is not recognized/i,
    /(?:cannot find|could not find) module '([\w.-]+)'/i
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]
    if (match) return match
  }
  return undefined
}

function extractPath(text: string): string | undefined {
  return text.match(/(?:\/[\w.-]+){2,}/)?.[0]
}
