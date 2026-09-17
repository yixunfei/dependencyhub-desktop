import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { CJK_CHARACTERS, CJK_CLASS_ID } from './cjk-characters.mjs'

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
 *
 * What counts as CJK is defined in `cjk-characters.mjs`, shared with the coverage
 * report so the two cannot disagree. It covers Chinese punctuation as well as
 * ideographs: the earlier `[\u4e00-\u9fff]` class missed 210 occurrences of `，、。（）；？：`
 * and `“”`, so a file whose only remaining Chinese was `；` scored zero and dropped
 * out of the ratchet while still showing Chinese to an English user.
 */

const DICTIONARIES = ['en-US', 'zh-CN']
const SOURCE = join('src', 'i18n', 'dictionaries.ts')
// The i18n modules legitimately hold Chinese source text (the zh-CN dictionary and the
// literal fallback map), so the ratchet below skips the whole directory.
const I18N_DIR = 'src/i18n'
const BASELINE = join('scripts', 'i18n-cjk-baseline.json')
const update = process.argv.includes('--update')
const rebaseline = process.argv.includes('--rebaseline')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

/**
 * Report and stop. Throwing would print a stack trace and bury the message, which is
 * the part a reader needs.
 */
function bail(message) {
  console.error(message)
  console.error('[i18n] failed')
  process.exit(1)
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
/** Persist the baseline with the character class that produced it. */
function serializeBaseline(previous, files, generatedAt) {
  return JSON.stringify(
    { note: previous.note, characterClass: CJK_CLASS_ID, generatedAt, files },
    null,
    2
  )
}

const recorded = baseline.files || {}
const totalOf = (files) => Object.values(files).reduce((sum, value) => sum + value, 0)

// A baseline is only meaningful against the character class that produced it. Changing
// the class invalidates every recorded count at once, so say that plainly instead of
// reporting fifteen files as "grew" when nobody edited them. A missing field is the same
// situation: the baseline predates the field, so its class is unknown.
if (!rebaseline && baseline.characterClass !== CJK_CLASS_ID) {
  bail(
    `${toKey(BASELINE)} was generated with character class ` +
      `${baseline.characterClass ?? '(unrecorded, predates the field)'}, ` +
      `but the current class is ${CJK_CLASS_ID}.\n` +
      'The recorded counts are not comparable. Run `node scripts/verify-i18n.mjs --rebaseline` ' +
      'to recompute them from the current source and review the printed delta.'
  )
}

if (rebaseline) {
  const next = {}
  for (const [file, count] of [...current].sort(([a], [b]) => a.localeCompare(b))) next[file] = count

  // Print the delta so a rebaseline is reviewable rather than a silent rewrite. A real
  // class change moves many files by a few characters each; a suspicious one shows up as
  // a large jump on files that were not being translated.
  const delta = []
  for (const file of [...new Set([...Object.keys(recorded), ...Object.keys(next)])].sort()) {
    const before = recorded[file] ?? 0
    const after = next[file] ?? 0
    if (before !== after) delta.push(`  ${after > before ? '+' : ''}${after - before}  ${before} -> ${after}  ${file}`)
  }
  console.log(`[i18n] rebaselining against character class ${CJK_CLASS_ID}`)
  console.log(delta.length ? delta.join('\n') : '  (no per-file change)')
  console.log(
    `[i18n] total ${totalOf(recorded)} -> ${totalOf(next)} across ${Object.keys(recorded).length} -> ${Object.keys(next).length} files`
  )

  await writeFile(BASELINE, `${serializeBaseline(baseline, next, new Date().toISOString().slice(0, 10))}\n`, 'utf-8')
  console.log('[i18n] passed')
  process.exit(0)
}

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
  if (raised.length) bail(`refusing to raise recorded CJK counts:\n${raised.join('\n')}`)
  if (introduced.length) bail(`refusing to record new hardcoded CJK:\n${introduced.join('\n')}`)
  await writeFile(BASELINE, `${serializeBaseline(baseline, next, baseline.generatedAt)}\n`, 'utf-8')
  const total = totalOf(next)
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

const remaining = totalOf(Object.fromEntries(current))
const cleared = Object.keys(recorded).filter((file) => !current.has(file)).length

if (failures.length) bail(failures.join('\n'))

console.log(
  `[i18n] ${english.size} keys in en-US and zh-CN, no duplicates, no empty values, all t() call sites resolve`
)
console.log(
  `[i18n] hardcoded CJK: ${remaining} characters across ${current.size} files (baseline ${Object.keys(recorded).length}, ${cleared} cleared)`
)
if (cleared > 0) console.log('[i18n] run `node scripts/verify-i18n.mjs --update` to lock in the reduction')
console.log('[i18n] passed')
