import { readFile } from 'fs/promises'
import { writeFileAtomic } from '../../../services/atomicWrite'
import { join } from 'path'
import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import { maskSwiftTrivia } from './swiftSyntax'
import { readSwiftPackageManifest } from './swiftpmInventory'

export interface SwiftPMManifestMutation { before: string; after: string; changed: boolean }

export async function planSwiftPMManifestMutation(cwd: string, request: ManagerOperationRequest): Promise<SwiftPMManifestMutation> {
  const path = join(cwd, 'Package.swift')
  const before = await readFile(path, 'utf-8')
  // Nested block comments and raw/multiline strings require a full Swift
  // parser. Refuse these uncommon forms rather than risk rewriting code.
  if (/"""|#+"|\/\*(?:(?!\*\/)[\s\S])*\/\*/.test(before)) {
    throw new Error('This Swift manifest uses syntax that requires manual dependency editing.')
  }
  const packageName = request.packageName?.trim()
  if (!packageName) throw new Error('Package name is required for this operation.')
  if (request.operation === 'install') {
    if (!request.options || typeof request.options.source !== 'string' || !request.options.source.trim()) {
      throw new Error('A Swift package source URL is required in options.source.')
    }
    if ((await readSwiftPackageManifest(cwd)).some((item) => item.name.toLowerCase() === packageName.toLowerCase())) {
      throw new Error(`Swift package ${packageName} is already declared in Package.swift`)
    }
    const source = request.options.source.trim()
    const version = request.version?.trim()
    const requirement = version ? `from: "${escapeSwift(version)}"` : 'from: "0.0.0"'
    const entry = `.package(url: "${escapeSwift(source)}", ${requirement})`
    const range = packageDependenciesArrayRange(before)
    if (!range) {
      // Swift requires labeled arguments in declaration order: dependencies
      // belongs after products and before targets (never before name).
      const packageCall = /\bPackage\s*\(/.exec(maskSwiftTrivia(before))
      if (!packageCall) throw new Error('Package.swift does not contain a Package(...) declaration for safe editing.')
      const open = packageCall.index + packageCall[0].length - 1
      const close = matchingParen(before, open)
      if (close < 0) throw new Error('Package.swift has an unbalanced Package declaration.')
      const following = ['targets', 'swiftLanguageVersions', 'swiftLanguageModes', 'cLanguageStandard', 'cxxLanguageStandard']
        .map((name) => findPackageArgument(before, name)).filter((position): position is number => position !== null)
      const target = following.length ? Math.min(...following) : null
      const insertAt = target ?? close
      const rawPrefix = before.slice(0, insertAt)
      const syntaxPrefix = maskSwiftTrivia(rawPrefix)
      const prefixEnd = syntaxPrefix.trimEnd().length
      const needsSeparator = target === null && !/,\s*$/.test(syntaxPrefix)
      const prefix = needsSeparator ? `${rawPrefix.slice(0, prefixEnd)},${rawPrefix.slice(prefixEnd)}` : rawPrefix
      const suffix = target === null ? '' : ','
      const after = `${prefix}\n    dependencies: [\n      ${entry}\n    ]${suffix}\n    ${before.slice(insertAt)}`
      return { before, after, changed: true }
    }
    const body = before.slice(range.start, range.end)
    const syntaxBody = maskSwiftTrivia(body)
    const hasElements = syntaxBody.trim().length > 0
    const needsComma = hasElements && !/,\s*$/.test(syntaxBody)
    const bodyEnd = range.start + syntaxBody.trimEnd().length
    const separated = needsComma ? `${before.slice(0, bodyEnd)},${before.slice(bodyEnd, range.end)}` : before.slice(0, range.end)
    const insertion = `${separated}\n    ${entry}\n${before.slice(range.end)}`
    return { before, after: insertion, changed: true }
  }
  const declarations = findPackageDeclarations(before)
  const matches = declarations.filter((declaration) => {
    const block = declaration.text
    const source = block.match(/\burl\s*:\s*["']([^"']+)["']/)?.[1] || block.match(/^\s*\(\s*["']([^"']+)["']/)?.[1]
    const name = block.match(/\bname\s*:\s*["']([^"']+)["']/)?.[1] || source?.replace(/\/?\.git$/, '').split('/').pop()
    return name?.toLowerCase() === packageName.toLowerCase()
  })
  if (matches.length !== 1) throw new Error(matches.length === 0 ? `Swift package ${packageName} was not found in Package.swift` : `Swift package ${packageName} has multiple declarations`)
  const declaration = matches[0]
  return { before, after: removeDeclaration(before, declaration), changed: true }
}

export async function atomicallyWriteSwiftManifest(cwd: string, content: string): Promise<void> {
  await writeFileAtomic(join(cwd, 'Package.swift'), content)
}

interface PackageDeclaration { start: number; end: number; text: string }

/**
 * Locates every `.package(...)` call with bracket- and string-aware scanning.
 * A plain regex truncates at the first `)` which breaks on nested arguments
 * such as `.upToNextMajor(from: "1.0")`.
 */
function findPackageDeclarations(content: string): PackageDeclaration[] {
  const declarations: PackageDeclaration[] = []
  const syntax = maskSwiftTrivia(content)
  const range = packageDependenciesArrayRange(content)
  if (!range) return declarations
  const pattern = /\.package\s*\(/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(syntax))) {
    if (match.index < range.start || match.index >= range.end) continue
    const openParen = match.index + match[0].length - 1
    const closeParen = matchingParen(content, openParen)
    if (closeParen < 0) continue
    declarations.push({ start: match.index, end: closeParen + 1, text: content.slice(match.index, closeParen + 1) })
    pattern.lastIndex = closeParen + 1
  }
  return declarations
}

/** Index of the `)` closing the `(` at `openParen`, skipping string literals. -1 when unbalanced. */
function matchingParen(content: string, openParen: number): number {
  content = maskSwiftTrivia(content)
  let depth = 0
  let inString = false
  for (let index = openParen; index < content.length; index += 1) {
    const char = content[index]
    if (inString) {
      if (char === '\\') index += 1
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') { inString = true; continue }
    if (char === '(') depth += 1
    if (char === ')') { depth -= 1; if (depth === 0) return index }
  }
  return -1
}

/**
 * Finds the *package-level* `dependencies: [...]` array inside the
 * `Package(...)` call. Scanning paren depth distinguishes it from
 * `.target(name: ..., dependencies: [...])`, which used to receive
 * `.package(url:...)` insertions and produce a manifest that no longer
 * compiles.
 */
function packageDependenciesArrayRange(content: string): { start: number; end: number } | null {
  const argument = findPackageArgument(content, 'dependencies')
  if (argument === null) return null
  const match = /^dependencies\s*:\s*\[/.exec(content.slice(argument))
  if (!match) throw new Error('Computed Swift dependencies cannot be edited safely.')
  return arrayRange(content, argument + match[0].length - 1)
}

function findPackageArgument(content: string, argument: string): number | null {
  content = maskSwiftTrivia(content)
  const packageCall = /\bPackage\s*\(/.exec(content)
  if (!packageCall) return null
  let depth = 1
  let inString = false
  for (let index = packageCall.index + packageCall[0].length; index < content.length; index += 1) {
    const char = content[index]
    if (inString) {
      if (char === '\\') index += 1
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') { inString = true; continue }
    if (char === '(') { depth += 1; continue }
    if (char === ')') {
      depth -= 1
      if (depth === 0) return null
      continue
    }
    if (depth !== 1) continue
    if (!content.startsWith(argument, index)) continue
    const before = index === 0 ? ' ' : content[index - 1]
    if (/[A-Za-z0-9_.]/.test(before)) continue
    let cursor = index + argument.length
    while (cursor < content.length && /\s/.test(content[cursor])) cursor += 1
    if (content[cursor] !== ':') continue
    return index
  }
  return null
}

/** `{ start, end }` of the bracket body for the `[` at `openBracket`. */
function arrayRange(content: string, openBracket: number): { start: number; end: number } | null {
  content = maskSwiftTrivia(content)
  let depth = 1
  let inString = false
  for (let index = openBracket + 1; index < content.length; index += 1) {
    const char = content[index]
    if (inString) {
      if (char === '\\') index += 1
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') { inString = true; continue }
    if (char === '[') depth += 1
    if (char === ']') { depth -= 1; if (depth === 0) return { start: openBracket + 1, end: index } }
  }
  return null
}

/**
 * Removes a declaration together with its separating comma. Deleting only the
 * matched line used to leave a trailing comma before `]` (rejected by
 * toolchains before Swift 6.1), orphan continuation lines of multi-line
 * declarations, or destroy sibling elements sharing one line.
 */
function removeDeclaration(content: string, declaration: PackageDeclaration): string {
  const lineStart = content.lastIndexOf('\n', declaration.start) + 1
  const newlineAfter = content.indexOf('\n', declaration.end)
  const lineEnd = newlineAfter < 0 ? content.length : newlineAfter
  const beforeOnLine = content.slice(lineStart, declaration.start)
  const afterOnLine = content.slice(declaration.end, lineEnd)
  const ownsWholeLines = /^\s*$/.test(beforeOnLine) && /^[ \t]*,?\s*$/.test(afterOnLine)

  if (!ownsWholeLines) {
    // Inline array element: remove the call plus one adjacent comma only.
    const following = content.slice(declaration.end).match(/^[ \t]*,/)
    if (following) return content.slice(0, declaration.start) + content.slice(declaration.end + following[0].length)
    const preceding = content.slice(0, declaration.start).match(/,[ \t]*$/)
    if (preceding) return content.slice(0, declaration.start - preceding[0].length) + content.slice(declaration.end)
    return content.slice(0, declaration.start) + content.slice(declaration.end)
  }

  const removeEnd = newlineAfter < 0 ? content.length : newlineAfter + 1
  const nextSignificant = content.slice(removeEnd).match(/^\s*(\S)/)
  let cutStart = lineStart
  if (nextSignificant?.[1] === ']') {
    // Last element of the array: the previous line's trailing comma goes too.
    const trailingComma = content.slice(0, lineStart).match(/,[ \t]*$/)
    if (trailingComma) cutStart = lineStart - trailingComma[0].length
  }
  return content.slice(0, cutStart) + content.slice(removeEnd)
}

function escapeSwift(value: string): string { return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') }
