// One-off: split src/i18n/dictionaries.ts into per-locale files.
const fs = require('fs')
const path = require('path')

const root = __dirname
const sourcePath = path.join(root, 'src', 'i18n', 'dictionaries.ts')
const outDir = path.join(root, 'src', 'i18n', 'dictionaries')
const source = fs.readFileSync(sourcePath, 'utf-8')
const lines = source.split('\n')

const enIdx = lines.findIndex((l) => l.trim() === "'en-US': {")
const zhIdx = lines.findIndex((l) => l.trim() === "'zh-CN': {")
if (enIdx < 0 || zhIdx < 0 || zhIdx < enIdx) throw new Error('dictionary markers not found')

function extractBody(startIdx, endIdx, closing) {
  // body = entry lines between the opening marker and its closing line
  const body = lines.slice(startIdx + 1, endIdx)
  while (body.length && body[body.length - 1].trim() === '') body.pop()
  const last = body[body.length - 1]
  if (last.trim() !== closing) throw new Error(`unexpected closing: ${JSON.stringify(last)}`)
  body.pop()
  while (body.length && body[body.length - 1].trim() === '') body.pop()
  return body.map((l) => (l.startsWith('  ') ? l.slice(2) : l))
}

const enBody = extractBody(enIdx, zhIdx, '},')
const zhTail = lines.slice(zhIdx + 1)
const zhClose = zhTail.findIndex((l) => l === '  }')
if (zhClose < 0) throw new Error('zh-CN closing not found')
const zhBody = zhTail.slice(0, zhClose).map((l) => (l.startsWith('  ') ? l.slice(2) : l))

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(
  path.join(outDir, 'en-US.ts'),
  `export const enUS = {\n${enBody.join('\n')}\n} as const\n`,
  'utf-8'
)
fs.writeFileSync(
  path.join(outDir, 'zh-CN.ts'),
  `export const zhCN = {\n${zhBody.join('\n')}\n} as const\n`,
  'utf-8'
)
fs.writeFileSync(
  sourcePath,
  [
    '// Locale dictionaries split by language. scripts/verify-i18n.mjs guards key parity,',
    '// duplicate keys, empty values, and placeholder parity between en-US and zh-CN.',
    "import { enUS } from './dictionaries/en-US'",
    "import { zhCN } from './dictionaries/zh-CN'",
    '',
    'export const dictionaries = {',
    "  'en-US': enUS,",
    "  'zh-CN': zhCN",
    '} as const',
    '',
    "export type TranslationKey = keyof typeof dictionaries['en-US']",
    ''
  ].join('\n'),
  'utf-8'
)
console.log(`en keys: ${enBody.length}, zh lines: ${zhBody.length}`)
