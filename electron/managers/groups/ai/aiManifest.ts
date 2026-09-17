import { join } from 'path'
import { asArray, asRecord, asString, readTextIfExists } from '../../structuredData'
import { parseJsonWithComments, writeFileAtomically } from './aiTypes'

/** One declared AI dependency inside a DependencyHub-managed manifest. */
export interface DeclaredAiEntry {
  name: string
  source: string
  version?: string
  type?: string
}

export interface DeclaredAiManifest {
  entries: DeclaredAiEntry[]
  /** Original document so unrelated keys survive a rewrite. */
  raw: Record<string, unknown>
}

/**
 * Reads a DependencyHub-managed AI dependency manifest (`skills.json`, `agents.json`).
 * A malformed document is reported instead of being silently treated as empty.
 */
export async function readDeclaredManifest(cwd: string, file: string, section: string): Promise<DeclaredAiManifest> {
  const text = await readTextIfExists(join(cwd, file))
  if (text === undefined || !text.trim()) return { entries: [], raw: {} }
  let root: unknown
  try {
    root = parseJsonWithComments(text)
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`)
  }
  const raw = asRecord(root) || {}
  const entries = asArray(raw[section]).flatMap((item) => {
    const record = asRecord(item)
    const name = asString(record?.name)?.trim()
    if (!name) return []
    return [{
      name,
      source: asString(record?.source)?.trim() || '',
      version: asString(record?.version)?.trim() || undefined,
      type: asString(record?.type)?.trim() || undefined
    }]
  })
  return { entries, raw }
}

export async function writeDeclaredManifest(
  cwd: string,
  file: string,
  section: string,
  raw: Record<string, unknown>,
  entries: readonly DeclaredAiEntry[]
): Promise<void> {
  const document = {
    ...raw,
    version: typeof raw.version === 'number' ? raw.version : 1,
    [section]: entries.map((entry) => ({
      name: entry.name,
      source: entry.source,
      ...(entry.version ? { version: entry.version } : {}),
      ...(entry.type ? { type: entry.type } : {})
    }))
  }
  await writeFileAtomically(join(cwd, file), `${JSON.stringify(document, null, 2)}\n`)
}

export async function readDeclaredEntries(cwd: string, file: string, section: string): Promise<DeclaredAiEntry[]> {
  try {
    return (await readDeclaredManifest(cwd, file, section)).entries
  } catch {
    return []
  }
}
