import { access, readdir } from 'fs/promises'
import { join } from 'path'

/**
 * Resolves manager manifest, lock, and config patterns against a directory.
 * A pattern may be a plain file name, a nested path, or a single-level wildcard
 * such as `.cursor/rules/*`. The extended manager service and the supply chain
 * share this module so both report identical evidence for the same workspace.
 */
export async function existingPatternMatches(cwd: string, patterns: readonly string[]): Promise<string[]> {
  const rootFiles = await readdirSafe(cwd)
  const matches: string[] = []
  for (const pattern of patterns) {
    const normalizedPattern = pattern.replace(/\\/g, '/')
    if (normalizedPattern.includes('/')) {
      const separator = normalizedPattern.lastIndexOf('/')
      const directory = normalizedPattern.slice(0, separator)
      const filePattern = normalizedPattern.slice(separator + 1)
      const directoryPath = join(cwd, ...directory.split('/'))

      if (filePattern.includes('*')) {
        const regex = wildcardToRegExp(filePattern)
        matches.push(...(await readdirSafe(directoryPath))
          .filter((file) => regex.test(file))
          .map((file) => `${directory}/${file}`))
        continue
      }

      try {
        await access(join(directoryPath, filePattern))
        matches.push(normalizedPattern)
      } catch {
      }
      continue
    }

    if (pattern.includes('*')) {
      const regex = wildcardToRegExp(pattern)
      matches.push(...rootFiles.filter((file) => regex.test(file)))
      continue
    }

    if (rootFiles.includes(pattern)) {
      matches.push(pattern)
    }
  }
  return [...new Set(matches)]
}

export async function readdirSafe(path: string): Promise<string[]> {
  try {
    return await readdir(path)
  } catch {
    return []
  }
}

export function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}
