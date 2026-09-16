import { readFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

/** Legacy surface checks follow actual local imports so modularizing a page does not hide its UI. */
export async function readFeatureSource(entry) {
  const root = dirname(resolve(entry))
  const visited = new Set()
  const parts = []
  const visit = async (file) => {
    if (visited.has(file)) return
    visited.add(file)
    const source = await readFile(file, 'utf8')
    parts.push(source)
    const imports = [...source.matchAll(/\b(?:from|import)\s*['"](\.[^'"]+)['"]/g)]
    for (const [, specifier] of imports) {
      const target = resolve(dirname(file), specifier)
      if (!target.startsWith(root + sep)) continue
      const candidate = await resolveSource(target)
      if (candidate) await visit(candidate)
    }
  }
  await visit(resolve(entry))
  return parts.join('\n')
}

async function resolveSource(target) {
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = target + suffix
    try {
      await readFile(candidate, 'utf8')
      return candidate
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
    }
  }
  return undefined
}
