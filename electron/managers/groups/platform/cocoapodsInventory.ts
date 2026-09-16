import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { asRecord, asString, parseYamlDocument, readTextIfExists } from '../../structuredData'

export async function readCocoaPodsInventory(cwd: string): Promise<ManagerDependency[]> {
  const manifest = await readTextIfExists(join(cwd, 'Podfile')) || ''
  const lock = await readTextIfExists(join(cwd, 'Podfile.lock')) || ''
  const direct: ManagerDependency[] = []
  for (const match of manifest.matchAll(/^\s*pod\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/gm)) {
    direct.push({ managerId: 'cocoapods', name: match[1], version: match[2], requestedVersion: match[2], type: 'pod', file: 'Podfile', direct: true })
  }
  const locked = parseLock(lock)
  const byName = new Map(locked.map((item) => [item.name.toLowerCase(), item]))
  return [...direct.map((item) => { const pin = byName.get(item.name.toLowerCase()); return pin ? { ...item, resolvedVersion: pin.resolvedVersion, integrity: pin.integrity } : item }), ...locked.filter((item) => !direct.some((directItem) => directItem.name.toLowerCase() === item.name.toLowerCase()))]
}

function parseLock(content: string): ManagerDependency[] {
  if (!content.trim()) return []
  const root = parseYamlDocument(content, 'Podfile.lock') as Record<string, unknown> || {}
  const pods = Array.isArray(root.PODS) ? root.PODS : []
  return pods.flatMap((entry) => {
    if (typeof entry === 'string') { const match = entry.match(/^([^ (]+)\s*\(([^)]+)\)/); return match ? [{ managerId: 'cocoapods' as const, name: match[1], version: match[2], resolvedVersion: match[2], type: 'pod-lock', file: 'Podfile.lock', direct: false }] : [] }
    const record = asRecord(entry); const name = asString(record?.name); if (!name) return []
    return [{ managerId: 'cocoapods' as const, name, version: asString(record?.version), resolvedVersion: asString(record?.version), type: 'pod-lock', file: 'Podfile.lock', direct: false }]
  })
}
