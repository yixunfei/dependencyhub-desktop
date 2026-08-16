import { readdir } from 'fs/promises'
import { join, relative, resolve } from 'path'

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.npmdesktopmanager',
  '.svn',
  '.tox',
  '.venv',
  '.yarn',
  'bin',
  'build',
  'coverage',
  'dist',
  'dist-electron',
  'node_modules',
  'obj',
  'out',
  'target',
  'vendor',
  'venv'
])

interface WorkspaceFileEntry {
  fileName: string
  relativePath: string
}

const activeScans = new Map<string, Promise<WorkspaceFileEntry[]>>()

export interface WorkspaceFileSearchOptions {
  maxDepth?: number
  ignoredDirectories?: readonly string[]
}

export async function findWorkspaceFiles(
  cwd: string,
  matches: (fileName: string, relativePath: string) => boolean,
  options: WorkspaceFileSearchOptions = {}
): Promise<string[]> {
  const root = resolve(cwd)
  const ignored = new Set([
    ...DEFAULT_IGNORED_DIRECTORIES,
    ...(options.ignoredDirectories || []).map((item) => item.toLowerCase())
  ])
  const entries = await scanWorkspaceFiles(root, options.maxDepth ?? 8, ignored)
  return entries
    .filter((entry) => matches(entry.fileName, entry.relativePath))
    .map((entry) => entry.relativePath)
}

async function scanWorkspaceFiles(
  root: string,
  maxDepth: number,
  ignored: ReadonlySet<string>
): Promise<WorkspaceFileEntry[]> {
  const key = [root, maxDepth, [...ignored].sort().join('\u0000')].join('\u0001')
  const active = activeScans.get(key)
  if (active) return await active

  const scan = (async () => {
    const files: WorkspaceFileEntry[] = []
    await visit(root, root, 0, maxDepth, ignored, files)
    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  })()
  activeScans.set(key, scan)
  try {
    return await scan
  } finally {
    if (activeScans.get(key) === scan) activeScans.delete(key)
  }
}

async function visit(
  root: string,
  directory: string,
  depth: number,
  maxDepth: number,
  ignored: ReadonlySet<string>,
  output: WorkspaceFileEntry[]
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const absolutePath = join(directory, entry.name)
    const relativePath = relative(root, absolutePath).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if (depth < maxDepth && !ignored.has(entry.name.toLowerCase())) {
        await visit(root, absolutePath, depth + 1, maxDepth, ignored, output)
      }
      continue
    }
    if (entry.isFile()) output.push({ fileName: entry.name, relativePath })
  }
}
