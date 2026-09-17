// Informational companion to scripts/verify-i18n.mjs — not a gate.
//
// The ratchet in verify-i18n.mjs counts hardcoded CJK per file, but that number
// overstates what an English user actually sees, because the app runs a second
// localization mechanism at runtime: translateText() plus the EN_LITERAL_TRANSLATIONS
// map (src/i18n/literals.ts), applied by localizedFeedback to message.* / Modal.* and
// by RuntimeLocalizer to CJK text nodes and placeholder / title / aria-label / alt.
//
// This script splits the remaining backlog into:
//   - CJK in comments (never user-facing)
//   - CJK in regular expressions (matched against localized OS output, not UI copy)
//   - string literals and JSX text the literal map already covers (invisible in English)
//   - string literals and JSX text it does NOT cover (visible Chinese in English)
//   - template literals, which exact matching can never cover (always visible)
//
// Use it to rank the backlog. It parses with the TypeScript AST rather than scanning
// text: a regex-based scanner either treats `=>` as a JSX tag close and swallows the
// rest of the file, or strips comments first and corrupts every string containing `//`.
//
// Every bucket is reconciled against the raw per-file character count that the ratchet
// uses, so a gap in the parser cannot silently under-report the backlog. Both sides take
// the character class from ./cjk-characters.mjs, so they cannot disagree on what counts.
//
// Usage:
//   node scripts/i18n-coverage.mjs                 rank files by user-visible CJK
//   node scripts/i18n-coverage.mjs --top 30        show more rows
//   node scripts/i18n-coverage.mjs --file <path>   list one file's literals, with lines
//
// `--file` is the first step of a localization batch: it is the list of strings that
// actually need a dictionary key, in source order, with the ones the runtime map
// already handles marked so they can be skipped.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { countCjk } from './cjk-characters.mjs'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

const topIndex = process.argv.indexOf('--top')
const TOP = topIndex === -1 ? 15 : Number(process.argv[topIndex + 1])
const fileIndex = process.argv.indexOf('--file')
const ONLY_FILE = fileIndex === -1 ? null : process.argv[fileIndex + 1]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

/** True for `import x from '...'` / `export * from '...'` style specifiers. */
function isModuleSpecifier(node) {
  const parent = node.parent
  if (!parent) return false
  return (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isImportEqualsDeclaration(parent) ||
    (ts.isCallExpression(parent) &&
      parent.expression.kind === ts.SyntaxKind.ImportKeyword)
  )
}

const literalsSource = readFileSync(join(SRC, 'i18n', 'literals.ts'), 'utf8')
const covered = new Set(
  [...literalsSource.matchAll(/^  '((?:[^'\\]|\\.)*)':/gm)].map((m) => m[1].replace(/\\'/g, "'"))
)

/**
 * Split one file's CJK into the buckets above.
 *
 * `entries` records each literal individually so `--file` can print them in source
 * order; the summary mode only needs the totals.
 */
function analyze(file) {
  const key = relative(ROOT, file).split(sep).join('/')
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

  // Comments: collect the leading and trailing comment ranges of every node and
  // dedupe by range. Leading alone misses a comment that follows code on the same
  // line; walking `slice(node.pos, node.getStart())` instead double-counts
  // file-leading trivia, because a first child's `pos` is the file start as well.
  const ranges = new Map()
  const addRanges = (pos) => {
    for (const range of ts.getLeadingCommentRanges(source, pos) || []) {
      ranges.set(`${range.pos}:${range.end}`, range)
    }
    for (const range of ts.getTrailingCommentRanges(source, pos) || []) {
      ranges.set(`${range.pos}:${range.end}`, range)
    }
  }
  addRanges(0)
  const collectRanges = (node) => {
    addRanges(node.pos)
    addRanges(node.end)
    ts.forEachChild(node, collectRanges)
  }
  collectRanges(sourceFile)

  let comments = 0
  for (const range of ranges.values()) comments += countCjk(source.slice(range.pos, range.end))

  let regex = 0
  let cov = 0
  let unc = 0
  let tpl = 0
  const entries = []

  const lineOf = (node) => source.slice(0, node.getStart(sourceFile)).split('\n').length

  const record = (node, text, kind) => {
    const chars = countCjk(text)
    if (!chars) return
    const isCovered = covered.has(text)
    if (isCovered) cov += chars
    else unc += chars
    entries.push({ line: lineOf(node), kind, chars, isCovered, text: text.trim() })
  }

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      record(node, node.text, 'jsx')
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isModuleSpecifier(node)) record(node, node.text, 'string')
    } else if (ts.isRegularExpressionLiteral(node)) {
      const chars = countCjk(node.text)
      regex += chars
      if (chars) entries.push({ line: lineOf(node), kind: 'regex', chars, isCovered: null, text: node.text })
    } else if (ts.isTemplateExpression(node)) {
      // An interpolated template can never be matched exactly by the literal map, so
      // every CJK character in one is user-visible regardless of its contents.
      const text = node.head.text + node.templateSpans.map((span) => span.literal.text).join('')
      const chars = countCjk(text)
      tpl += chars
      if (chars) entries.push({ line: lineOf(node), kind: 'template', chars, isCovered: false, text })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return {
    key,
    fileTotal: countCjk(source),
    comments,
    regex,
    covered: cov,
    uncovered: unc,
    template: tpl,
    entries
  }
}

if (ONLY_FILE) {
  const target = ONLY_FILE.split(sep).join('/')
  const result = analyze(ONLY_FILE)
  const visible = result.uncovered + result.template
  console.log(`${result.key}  —  ${result.fileTotal} CJK chars, ${visible} user-visible`)
  console.log()
  console.log('  line  kind      status     chars  text')
  for (const entry of result.entries.sort((a, b) => a.line - b.line)) {
    const status =
      entry.kind === 'regex' ? 'n/a' : entry.isCovered ? 'covered' : 'TO TRANSLATE'
    const text = entry.text.length > 72 ? `${entry.text.slice(0, 69)}...` : entry.text
    console.log(
      `  ${String(entry.line).padStart(4)}  ${entry.kind.padEnd(8)}  ${status.padEnd(12)}` +
        ` ${String(entry.chars).padStart(5)}  ${JSON.stringify(text)}`
    )
  }
  console.log()
  console.log(
    `  ${result.uncovered} uncovered + ${result.template} template = ${visible} to translate` +
      ` (${result.covered} already handled by the runtime map, ${result.comments} in comments)`
  )
  process.exit(0)
}

const rows = []
let commentChars = 0
let regexChars = 0
let coveredChars = 0
let uncoveredChars = 0
let templateChars = 0
let fileChars = 0

for (const file of walk(SRC)) {
  const key = relative(ROOT, file).split(sep).join('/')
  if (key === 'src/i18n.ts' || key.startsWith('src/i18n/')) continue
  // The ratchet skips test files, because a test that asserts localized copy has to
  // contain that copy. Mirroring it here keeps the totals comparable.
  if (/\.test\.tsx?$/.test(key)) continue
  if (!statSync(file).isFile()) continue

  const result = analyze(file)
  const accounted =
    result.comments + result.regex + result.covered + result.uncovered + result.template
  if (accounted !== result.fileTotal) {
    console.error(
      `reconcile mismatch in ${key}: file ${result.fileTotal} vs accounted ${accounted}` +
        ` (comments ${result.comments}, regex ${result.regex}, covered ${result.covered},` +
        ` uncovered ${result.uncovered}, template ${result.template})`
    )
    process.exitCode = 1
  }

  fileChars += result.fileTotal
  commentChars += result.comments
  regexChars += result.regex
  coveredChars += result.covered
  uncoveredChars += result.uncovered
  templateChars += result.template

  if (result.covered + result.uncovered + result.template > 0) {
    rows.push({
      file: key,
      covered: result.covered,
      uncovered: result.uncovered,
      template: result.template
    })
  }
}

console.log('Remaining hardcoded CJK (excluding src/i18n):')
console.log('  in comments (never user-facing)                 :', commentChars)
console.log('  in regular expressions (matched against OS text) :', regexChars)
console.log('  in literals, already translated at runtime      :', coveredChars)
console.log('  in literals, NOT covered — English shows Chinese:', uncoveredChars)
console.log('  in template literals (never map-matchable)      :', templateChars)
console.log('  total                                           :', fileChars)
console.log()
console.log(`Top ${TOP} files by user-visible (uncovered + template) CJK:`)
for (const row of rows
  .sort((a, b) => b.uncovered + b.template - (a.uncovered + a.template))
  .slice(0, TOP)) {
  console.log(
    `  ${String(row.uncovered + row.template).padStart(5)} visible |` +
      ` ${String(row.uncovered).padStart(5)} uncovered |` +
      ` ${String(row.template).padStart(4)} template |` +
      ` ${String(row.covered).padStart(5)} covered | ${row.file}`
  )
}
