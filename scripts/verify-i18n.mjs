import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/**
 * Source-level guard for renderer localization.
 *
 * Part 1 checks the dictionary in `src/i18n/dictionaries.ts`. The dictionaries are hand
 * maintained object literals, and a missing key is invisible at runtime:
 * `translate()` silently falls back to the English string, so a Chinese-only or
 * English-only key ships as an untranslated label instead of failing a build.
 * TypeScript only catches the reverse direction (a `t()` call with an unknown
 * key), because `TranslationKey` is derived from the English dictionary alone.
 *
 * Part 2 is a ratchet over hardcoded CJK characters in `src/**`. The app defaults
 * to English, but a large amount of UI copy is still written as literal Chinese,
 * so an English install shows Chinese labels. That backlog is too large to clear
 * in one change, so it is frozen here and may only shrink: no file may exceed its
 * recorded count, and no new file may introduce hardcoded CJK. Run
 * `node scripts/verify-i18n.mjs --update` after translating to tighten the
 * baseline; it refuses to raise an existing value or to add a new entry.
 *
 * The ratchet covers product copy only: `src/i18n/**` holds the dictionaries and
 * the literal fallback map, and `*.test.tsx` pins localized strings that must be
 * present for the assertion to mean anything. Neither is untranslated copy.
 */

const DICTIONARIES = ['en-US', 'zh-CN']
const SOURCE = join('src', 'i18n', 'dictionaries.ts')
// The i18n modules legitimately hold Chinese source text (the zh-CN dictionary and the
// literal fallback map), so the ratchet below skips the whole directory.
const I18N_DIR = 'src/i18n'
const BASELINE = join('scripts', 'i18n-cjk-baseline.json')
const CJK_CHARACTERS = /[\u4e00-\u9fff]/g
const update = process.argv.includes('--update')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

function parseDictionary(source, language) {
  const start = source.indexOf(`'${language}': {`)
  assert(start >= 0, `${SOURCE} does not define the ${language} dictionary`)
  if (start < 0) return { entries: new Map(), duplicates: [] }

  const end = source.indexOf('\n  }', start)
  assert(end > start, `the ${language} dictionary is not terminated as expected`)
  if (end <= start) return { entries: new Map(), duplicates: [] }

  const entries = new Map()
  const duplicates = []
  for (const line of source.slice(start, end).split('\n')) {
    const match = /^ {4}'([^']+)': (.*?),?$/.exec(line)
    if (!match) continue
    const [, key, value] = match
    if (entries.has(key)) duplicates.push(key)
    entries.set(key, value)
  }
  return { entries, duplicates }
}

const source = await readFile(SOURCE, 'utf-8')
const parsed = new Map(DICTIONARIES.map((language) => [language, parseDictionary(source, language)]))

for (const [language, { entries, duplicates }] of parsed) {
  assert(entries.size > 0, `the ${language} dictionary is empty`)
  assert(
    duplicates.length === 0,
    `${language} declares duplicate keys that silently override each other: ${duplicates.join(', ')}`
  )
  const empty = [...entries].filter(([, value]) => /^(''|""|``)$/.test(value.trim())).map(([key]) => key)
  assert(empty.length === 0, `${language} has keys with empty translations: ${empty.join(', ')}`)
}

const english = parsed.get('en-US').entries
const chinese = parsed.get('zh-CN').entries
const missingInChinese = [...english.keys()].filter((key) => !chinese.has(key))
const missingInEnglish = [...chinese.keys()].filter((key) => !english.has(key))

assert(
  missingInChinese.length === 0,
  `keys present in en-US but missing from zh-CN (they render in English): ${missingInChinese.join(', ')}`
)
assert(
  missingInEnglish.length === 0,
  `keys present in zh-CN but missing from en-US (zh-CN is not the fallback, so these can never resolve): ${missingInEnglish.join(', ')}`
)

// `{name}` placeholders must line up. A key that interpolates in one language and
// not the other either renders a literal `{name}` or silently drops the value.
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',')
const placeholderDrift = [...english]
  .filter(([key, value]) => chinese.has(key) && placeholders(value) !== placeholders(chinese.get(key)))
  .map(([key, value]) => `${key}: en-US {${placeholders(value)}} vs zh-CN {${placeholders(chinese.get(key))}}`)
assert(
  placeholderDrift.length === 0,
  `placeholder mismatch between dictionaries: ${placeholderDrift.join('; ')}`
)

// Every literal `t('...')` / `useT()` call site must resolve. TypeScript already
// enforces this through `TranslationKey`, but the type is derived from the English
// dictionary at compile time, so this also guards against a call site added while
// the dictionaries are mid-edit.
const rendererFiles = []
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (/\.tsx?$/.test(entry.name)) rendererFiles.push(path)
  }
}
await collect('src')

const toKey = (file) => file.split(sep).join('/')

const unknownKeys = new Map()
for (const file of rendererFiles) {
  if (toKey(file) === toKey(SOURCE)) continue
  const contents = await readFile(file, 'utf-8')
  for (const match of contents.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) {
    const key = match[1]
    if (english.has(key)) continue
    if (!unknownKeys.has(key)) unknownKeys.set(key, relative(process.cwd(), file))
  }
}
assert(
  unknownKeys.size === 0,
  `t() call sites reference undefined keys: ${[...unknownKeys].map(([key, file]) => `${key} (${file})`).join(', ')}`
)

// --- hardcoded CJK ratchet ------------------------------------------------
const current = new Map()
for (const file of rendererFiles) {
  const key = toKey(file)
  if (key === toKey(SOURCE) || key === toKey(join('src', 'i18n.ts')) || key.startsWith(`${I18N_DIR}/`)) continue
  // Tests are excluded. A test that pins a localized string has to contain that
  // string, so counting it as untranslated copy is a category error: this ratchet
  // measures product copy. Asserting the real Chinese is what makes such a test
  // worth having, so the exclusion is deliberate rather than a loophole.
  if (/\.test\.tsx?$/.test(key)) continue
  const count = (await readFile(file, 'utf-8')).match(CJK_CHARACTERS)?.length || 0
  if (count > 0) current.set(key, count)
}

let baseline = { files: {} }
try {
  baseline = JSON.parse(await readFile(BASELINE, 'utf-8'))
} catch {
  assert(false, `${toKey(BASELINE)} is missing or unreadable; run \`node scripts/verify-i18n.mjs --update\``)
}
const recorded = baseline.files || {}

if (update) {
  const raised = []
  const introduced = []
  const next = {}
  for (const [file, count] of [...current].sort(([a], [b]) => a.localeCompare(b))) {
    const previous = recorded[file]
    if (previous === undefined) introduced.push(`${file} (${count})`)
    else if (count > previous) raised.push(`${file}: ${previous} -> ${count}`)
    next[file] = previous === undefined ? count : Math.min(previous, count)
  }
  if (raised.length) throw new Error(`refusing to raise recorded CJK counts:\n${raised.join('\n')}`)
  if (introduced.length) throw new Error(`refusing to record new hardcoded CJK:\n${introduced.join('\n')}`)
  await writeFile(
    BASELINE,
    `${JSON.stringify({ note: baseline.note, generatedAt: baseline.generatedAt, files: next }, null, 2)}\n`,
    'utf-8'
  )
  const total = Object.values(next).reduce((sum, value) => sum + value, 0)
  console.log(`[i18n] baseline tightened: ${Object.keys(next).length} files, ${total} hardcoded CJK characters remain`)
  console.log('[i18n] passed')
  process.exit(0)
}

for (const [file, count] of current) {
  const previous = recorded[file]
  if (previous === undefined) {
    failures.push(`${file} introduces ${count} hardcoded CJK characters; use the dictionary instead`)
  } else if (count > previous) {
    failures.push(`${file}: hardcoded CJK grew from ${previous} to ${count}`)
  }
}

const remaining = [...current.values()].reduce((sum, value) => sum + value, 0)
const cleared = Object.keys(recorded).filter((file) => !current.has(file)).length

if (failures.length) throw new Error(failures.join('\n'))

console.log(
  `[i18n] ${english.size} keys in en-US and zh-CN, no duplicates, no empty values, all t() call sites resolve`
)
console.log(
  `[i18n] hardcoded CJK: ${remaining} characters across ${current.size} files (baseline ${Object.keys(recorded).length}, ${cleared} cleared)`
)
if (cleared > 0) console.log('[i18n] run `node scripts/verify-i18n.mjs --update` to lock in the reduction')
console.log('[i18n] passed')
