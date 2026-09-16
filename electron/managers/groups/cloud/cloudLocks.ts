import { readFile } from 'fs/promises'
import { join } from 'path'
import YAML from 'yaml'
import type { HelmDependencyRecord } from './cloudTypes'

export async function readHelmLock(cwd: string): Promise<HelmDependencyRecord[]> {
  const file = 'Chart.lock'
  let value: unknown
  try {
    value = YAML.parse(await readFile(join(cwd, file), 'utf-8'))
  } catch (error: any) {
    if (error?.code === 'ENOENT') return []
    throw new Error(`Unable to parse ${file}: ${error?.message || String(error)}`)
  }
  if (!value || typeof value !== 'object') throw new Error(`${file} must contain a YAML object`)
  const lock = value as Record<string, unknown>
  const dependencies = Array.isArray(lock.dependencies) ? lock.dependencies : []
  return dependencies.flatMap((entry): HelmDependencyRecord[] => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    if (typeof item.name !== 'string' || !item.name.trim()) return []
    return [{
      name: item.name.trim(),
      version: typeof item.version === 'string' ? item.version.trim() : undefined,
      repository: typeof item.repository === 'string' ? item.repository.trim() : undefined,
      file,
      direct: false,
      digest: typeof lock.digest === 'string' ? lock.digest : undefined,
      generated: typeof lock.generated === 'string' ? lock.generated : undefined
    }]
  })
}
