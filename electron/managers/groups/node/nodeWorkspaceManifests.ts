import { readFile } from 'fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import { findWorkspaceFiles } from '../../workspaceFiles'

export interface NodeWorkspaceManifest {
  absolutePath: string
  file: string
  name?: string
  version?: string
  data: Record<string, unknown>
}

const MAX_WORKSPACE_DEPTH = 8

export async function readNodeWorkspaceManifests(
  cwd: string,
  managerId: 'pnpm' | 'yarn' | 'bun'
): Promise<NodeWorkspaceManifest[]> {
  const root = resolve(cwd)
  const rootManifest = await readManifest(root, root)
  if (!rootManifest) return []

  const patterns = [
    ...packageWorkspacePatterns(rootManifest.data),
    ...(managerId === 'pnpm' ? await pnpmWorkspacePatterns(root) : [])
  ]
  if (patterns.length === 0) return [rootManifest]

  const manifestFiles = await findWorkspaceFiles(
    root,
    (fileName) => fileName === 'package.json',
    { maxDepth: MAX_WORKSPACE_DEPTH }
  )
  const directories = manifestFiles.map((file) => dirname(join(root, ...file.split('/'))))
  const workspaceDirectories = expandWorkspacePatterns(root, patterns, directories)
  const workspaceManifests = await Promise.all(
    workspaceDirectories.map((directory) => readManifest(root, directory))
  )

  return [rootManifest, ...workspaceManifests.filter((item): item is NodeWorkspaceManifest => Boolean(item))]
    .filter(uniqueManifest)
    .sort((left, right) => left.file.localeCompare(right.file))
}

async function readManifest(root: string, directory: string): Promise<NodeWorkspaceManifest | null> {
  const absolutePath = join(directory, 'package.json')
  const content = await readFile(absolutePath, 'utf-8').catch(() => '')
  if (!content) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error: any) {
    throw new Error(`Invalid JSON in ${absolutePath}: ${error.message}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected a JSON object in ${absolutePath}`)
  }

  const data = parsed as Record<string, unknown>
  return {
    absolutePath,
    file: toPosix(relative(root, absolutePath)) || 'package.json',
    name: stringValue(data.name),
    version: stringValue(data.version),
    data
  }
}

function packageWorkspacePatterns(manifest: Record<string, unknown>): string[] {
  const workspaces = manifest.workspaces
  if (Array.isArray(workspaces)) return stringArray(workspaces)
  if (!workspaces || typeof workspaces !== 'object') return []
  return stringArray((workspaces as Record<string, unknown>).packages)
}

async function pnpmWorkspacePatterns(root: string): Promise<string[]> {
  const content = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf-8').catch(() => '')
  if (!content) return []

  const lines = content.split(/\r?\n/)
  const start = lines.findIndex((line) => /^\s*packages\s*:\s*(?:#.*)?$/.test(line))
  if (start < 0) return []
  const baseIndent = lines[start].match(/^\s*/)?.[0].length || 0
  const patterns: string[] = []

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim() || /^\s*#/.test(line)) continue
    const indent = line.match(/^\s*/)?.[0].length || 0
    if (indent <= baseIndent && !/^\s*-/.test(line)) break
    const value = line.match(/^\s*-\s*(['"]?)(.*?)\1\s*(?:#.*)?$/)?.[2]?.trim()
    if (value) patterns.push(value)
  }
  return patterns
}

function expandWorkspacePatterns(root: string, patterns: string[], directories: string[]): string[] {
  const cleanPatterns = patterns.map(cleanPattern).filter(Boolean)
  const includes = cleanPatterns.filter((pattern) => !pattern.startsWith('!'))
  const excludes = cleanPatterns.filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => globToRegExp(pattern.slice(1)))
  const matches = new Set<string>()

  for (const pattern of includes) {
    if (!hasGlob(pattern)) {
      const target = resolve(root, pattern)
      if (isInside(root, target)) matches.add(target)
      continue
    }
    const matcher = globToRegExp(pattern)
    for (const directory of directories) {
      const relativePath = toPosix(relative(root, directory))
      if (!relativePath || relativePath === '.') continue
      if (matcher.test(relativePath) && !excludes.some((exclude) => exclude.test(relativePath))) {
        matches.add(directory)
      }
    }
  }

  return [...matches].filter((directory) => {
    const relativePath = toPosix(relative(root, directory))
    return !excludes.some((exclude) => exclude.test(relativePath))
  })
}

function globToRegExp(pattern: string): RegExp {
  const normalized = toPosix(pattern).replace(/\/+$/g, '')
  let output = '^'
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (char === '*' && normalized[index + 1] === '*') {
      output += '.*'
      index += 1
    } else if (char === '*') {
      output += '[^/]*'
    } else if (char === '?') {
      output += '[^/]'
    } else {
      output += escapeRegExp(char)
    }
  }
  return new RegExp(`${output}$`, 'i')
}

function cleanPattern(pattern: string): string {
  return toPosix(pattern.trim()).replace(/^\.\//, '').replace(/\/+$/, '')
}

function hasGlob(pattern: string): boolean {
  return /[*?]/.test(pattern)
}

function isInside(base: string, target: string): boolean {
  const relation = relative(resolve(base), resolve(target))
  return relation === '' || (!!relation && !relation.startsWith('..') && !isAbsolute(relation))
}

function uniqueManifest(item: NodeWorkspaceManifest, index: number, items: NodeWorkspaceManifest[]): boolean {
  return items.findIndex((candidate) => candidate.absolutePath === item.absolutePath) === index
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
