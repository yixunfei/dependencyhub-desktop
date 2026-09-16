import { readFile } from 'fs/promises'
import { join } from 'path'
import YAML from 'yaml'
import type { HelmDependencyRecord } from './cloudTypes'

export async function readHelmManifest(cwd: string): Promise<HelmDependencyRecord[]> {
  const file = 'Chart.yaml'
  let value: unknown
  try {
    value = YAML.parse(await readFile(join(cwd, file), 'utf-8'))
  } catch (error: any) {
    if (error?.code === 'ENOENT') return []
    throw new Error(`Unable to parse ${file}: ${error?.message || String(error)}`)
  }
  if (!value || typeof value !== 'object') throw new Error(`${file} must contain a YAML object`)
  const chart = value as Record<string, unknown>
  if (typeof chart.apiVersion !== 'string' || typeof chart.name !== 'string') {
    throw new Error(`${file} must declare apiVersion and name`)
  }
  const dependencies = Array.isArray(chart.dependencies) ? chart.dependencies : []
  return dependencies.flatMap((entry): HelmDependencyRecord[] => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    if (typeof item.name !== 'string' || !item.name.trim()) return []
    return [{
      name: item.name.trim(),
      version: typeof item.version === 'string' ? item.version.trim() : undefined,
      repository: typeof item.repository === 'string' ? item.repository.trim() : undefined,
      condition: typeof item.condition === 'string' ? item.condition.trim() : undefined,
      alias: typeof item.alias === 'string' ? item.alias.trim() : undefined,
      file,
      direct: true
    }]
  })
}
