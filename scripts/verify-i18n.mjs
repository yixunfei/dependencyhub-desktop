import { readFile, readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/**
 * Source-level guard for the renderer dictionary in `src/i18n.ts`.
 *
 * The dictionaries are hand-maintained object literals, and a missing key is
 * invisible at runtime: `translate()` silently falls back to the English string,
 * so a Chinese-only or English-only key ships as an untranslated label instead of
 * failing a build. TypeScript only catches the reverse direction (a `t()` call
 * with an unknown key), because `TranslationKey` is derived from the English
 * dictionary alone. These checks close that gap.
 */

const DICTIONARIES = ['en-US', 'zh-CN']
const SOURCE = join('src', 'i18n.ts')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

function parseDictionary(source, language) {
  const start = source.indexOf(`'${language}': {`)
  assert(start >= 0, `i18n.ts does not define the ${language} dictionary`)
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

const unknownKeys = new Map()
for (const file of rendererFiles) {
  if (file.endsWith(`${sep}i18n.ts`)) continue
  const contents = await readFile(file, 'utf-8')
  for (const match of contents.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) {
    const key = match[1]
    if (english.has(key)) continue
    const display = relative(process.cwd(), file)
    if (!unknownKeys.has(key)) unknownKeys.set(key, display)
  }
}
assert(
  unknownKeys.size === 0,
  `t() call sites reference undefined keys: ${[...unknownKeys].map(([key, file]) => `${key} (${file})`).join(', ')}`
)

if (failures.length) throw new Error(failures.join('\n'))

console.log(
  `[i18n] ${english.size} keys in en-US and zh-CN, no duplicates, no empty values, all t() call sites resolve`
)
console.log('[i18n] passed')
