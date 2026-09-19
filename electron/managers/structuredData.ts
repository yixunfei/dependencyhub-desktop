import { readFile } from 'fs/promises'
import { XMLParser } from 'fast-xml-parser'
import { parse as parseTomlValue } from 'smol-toml'
import { parse as parseYamlValue } from 'yaml'

export type UnknownRecord = Record<string, unknown>

const xmlParser = new XMLParser({
  allowBooleanAttributes: true,
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: false,
  trimValues: true
})

export async function readTextIfExists(path: string): Promise<string | undefined> {
  try {
    const content = await readFile(path, 'utf-8')
    // Editors on Windows (Notepad/PowerShell redirection) emit a UTF-8 BOM that
    // breaks JSON.parse and smol-toml on the first character.
    return content.replace(/^\uFEFF/, '')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export function parseJsonDocument(content: string, file: string): unknown {
  return parseDocument(file, () => JSON.parse(content) as unknown)
}

export function parseTomlDocument(content: string, file: string): unknown {
  return parseDocument(file, () => parseTomlValue(content) as unknown)
}

export function parseYamlDocument(content: string, file: string): unknown {
  return parseDocument(file, () => parseYamlValue(content) as unknown)
}

export function parseXmlDocument(content: string, file: string): unknown {
  return parseDocument(file, () => xmlParser.parse(content) as unknown)
}

export function asRecord(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as UnknownRecord
}

export function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const record = asRecord(value)
  return record ? asString(record['#text']) : undefined
}

export function stringArray(value: unknown): string[] {
  return asArray(value).flatMap((item) => {
    const parsed = asString(item)?.trim()
    return parsed ? [parsed] : []
  })
}

export function recordEntries(value: unknown): Array<[string, unknown]> {
  const record = asRecord(value)
  return record ? Object.entries(record) : []
}

export function getRecord(value: unknown, ...path: string[]): UnknownRecord | undefined {
  let current: unknown = value
  for (const key of path) {
    current = asRecord(current)?.[key]
    if (current === undefined) return undefined
  }
  return asRecord(current)
}

function parseDocument(file: string, parser: () => unknown): unknown {
  try {
    return parser()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot parse ${file}: ${message}`)
  }
}
