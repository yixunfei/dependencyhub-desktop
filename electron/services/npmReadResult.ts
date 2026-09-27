export type NpmReadKind = 'outdated' | 'list' | 'audit'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseNpmJson(stdout: string): unknown {
  return JSON.parse(stdout.replace(/^﻿/, ''))
}

/** npm uses exit 1 for findings as well as failures; the JSON distinguishes them. */
export function isNpmReadResult(value: unknown, kind: NpmReadKind): boolean {
  if (!isRecord(value)) return false
  if (value.error && !(kind === 'list' && isRecord(value.error) && value.error.code === 'ELSPROBLEMS')) {
    return false
  }
  if (kind === 'outdated') {
    return Object.values(value).every((entry) => {
      const entries = Array.isArray(entry) ? entry : [entry]
      return entries.length > 0 && entries.every((item) => isRecord(item)
        && typeof item.wanted === 'string' && typeof item.latest === 'string')
    })
  }
  if (kind === 'audit') {
    return isRecord(value.vulnerabilities) && isRecord(value.metadata)
      && isRecord(value.metadata.vulnerabilities)
  }
  return isRecord(value.dependencies) || typeof value.name === 'string'
    || (Array.isArray(value.problems) && value.problems.length > 0)
}

export function acceptsNpmReadExit(kind: NpmReadKind, code: number, stdout: string): boolean {
  if (code !== 1) return false
  try {
    return isNpmReadResult(parseNpmJson(stdout), kind)
  } catch {
    return false
  }
}

export function requireNpmReadResult(stdout: string, kind: NpmReadKind): Record<string, unknown> {
  const value = parseNpmJson(stdout)
  if (!isNpmReadResult(value, kind)) throw new Error(`npm ${kind} returned an invalid result`)
  return value as Record<string, unknown>
}
