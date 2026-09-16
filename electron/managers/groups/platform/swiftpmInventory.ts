import { join } from 'path'
import type { ManagerDependency } from '../../../../shared/managerWorkspace'
import { parseJsonDocument, asRecord, asArray, asString, readTextIfExists } from '../../structuredData'

export interface SwiftPackageManifestDependency {
  name: string
  source: string
  requirement?: string
  file: 'Package.swift'
}

export async function readSwiftPackageManifest(cwd: string): Promise<SwiftPackageManifestDependency[]> {
  const content = await readTextIfExists(join(cwd, 'Package.swift'))
  if (!content) return []
  const results: SwiftPackageManifestDependency[] = []
  const pattern = /\.package\s*\(([^)]*)\)/gms
  for (const match of content.matchAll(pattern)) {
    const block = match[1]
    const url = block.match(/\burl\s*:\s*["']([^"']+)["']/)?.[1] || block.match(/\.package\s*\(\s*["']([^"']+)["']/)?.[1]
    if (!url) continue
    const source = url.trim()
    const explicitName = block.match(/\bname\s*:\s*["']([^"']+)["']/)?.[1]
    const name = explicitName || source.replace(/\/?\.git\s*$/, '').split('/').pop() || ''
    if (!name) continue
    const requirement = block.match(/\b(from|exact|upToNextMajor|upToNextMinor|branch|revision)\s*:\s*["']([^"']+)["']/)
    results.push({ name, source, requirement: requirement ? `${requirement[1]} ${requirement[2]}` : undefined, file: 'Package.swift' })
  }
  return results
}

export async function readSwiftPackageInventory(cwd: string): Promise<ManagerDependency[]> {
  const [manifest, lock] = await Promise.all([readSwiftPackageManifest(cwd), readSwiftPackageLock(cwd)])
  const lockByName = new Map(lock.map((item) => [item.name.toLowerCase(), item]))
  const direct = manifest.map((item) => {
    const pin = lockByName.get(item.name.toLowerCase())
    return {
      managerId: 'swiftpm', name: item.name, version: item.requirement,
      requestedVersion: item.requirement, resolvedVersion: pin?.resolvedVersion,
      type: 'package', source: item.source, file: item.file, direct: true,
      integrity: pin?.integrity,
      metadata: { lockFile: pin?.file || null, pinState: pin?.metadata?.pinState || null }
    } satisfies ManagerDependency
  })
  const transitive = lock.filter((item) => !manifest.some((entry) => entry.name.toLowerCase() === item.name.toLowerCase()))
  return [...direct, ...transitive]
}
export async function readSwiftPackageLock(cwd: string): Promise<ManagerDependency[]> {
  const file = 'Package.resolved'
  const content = await readTextIfExists(join(cwd, file))
  if (!content) return []
  const document = parseJsonDocument(content, file)
  const root = asRecord(document)
  const pinsValue = root?.pins || asRecord(root?.object)?.pins
  return asArray(pinsValue).flatMap((pin): ManagerDependency[] => {
    const item = asRecord(pin)
    const state = asRecord(item?.state)
    const identity = asString(item?.identity) || inferIdentity(asString(item?.location))
    if (!identity) return []
    const version = asString(state?.version)
    const revision = asString(state?.revision)
    const branch = asString(state?.branch)
    return [{
      managerId: 'swiftpm', name: identity, version: version || branch || revision,
      resolvedVersion: version, type: 'package', source: asString(item?.location), file,
      direct: false, integrity: asString(item?.checksum),
      metadata: { identity, revision: revision || null, branch: branch || null, pinState: version ? 'version' : branch ? 'branch' : 'revision' }
    }]
  })
}


function inferIdentity(location?: string): string {
  return location?.replace(/\/?\.git\s*$/, '').split('/').pop() || ''
}
