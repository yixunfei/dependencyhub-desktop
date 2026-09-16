import { readFile, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import { readSwiftPackageManifest } from './swiftpmInventory'

export interface SwiftPMManifestMutation { before: string; after: string; changed: boolean }

export async function planSwiftPMManifestMutation(cwd: string, request: ManagerOperationRequest): Promise<SwiftPMManifestMutation> {
  const path = join(cwd, 'Package.swift')
  const before = await readFile(path, 'utf-8')
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
    const range = dependencyArrayRange(before)
    if (!range) throw new Error('Package.swift dependencies must contain a static array for safe editing.')
    const insertion = `${before.slice(0, range.end)}${range.end > range.start && !/\n\s*$/.test(before.slice(range.start, range.end)) ? ',' : ''}\n    ${entry}${before.slice(range.end)}`
    return { before, after: insertion, changed: true }
  }
  const matches = [...before.matchAll(/\.package\s*\(([^)]*)\)/gms)].filter((match) => {
    const block = match[1]
    const source = block.match(/\burl\s*:\s*["']([^"']+)["']/)?.[1] || block.match(/^\s*["']([^"']+)["']/)?.[1]
    const name = block.match(/\bname\s*:\s*["']([^"']+)["']/)?.[1] || source?.replace(/\/?\.git$/, '').split('/').pop()
    return name?.toLowerCase() === packageName.toLowerCase()
  })
  if (matches.length !== 1) throw new Error(matches.length === 0 ? `Swift package ${packageName} was not found in Package.swift` : `Swift package ${packageName} has multiple declarations`)
  const match = matches[0]
  const lineStart = before.lastIndexOf('\n', match.index) + 1
  const lineEnd = before.indexOf('\n', match.index + match[0].length)
  const end = lineEnd < 0 ? before.length : lineEnd
  const after = before.slice(0, lineStart) + before.slice(end + (lineEnd < 0 ? 0 : 1))
  return { before, after, changed: true }
}

export async function atomicallyWriteSwiftManifest(cwd: string, content: string): Promise<void> {
  const path = join(cwd, 'Package.swift')
  const temp = `${path}.npmDesktopManager.tmp-${process.pid}`
  await writeFile(temp, content, 'utf-8')
  try { await rename(temp, path) } catch (error) { await rename(temp, path).catch(() => undefined); throw error }
}

function dependencyArrayRange(content: string): { start: number; end: number } | null {
  const marker = /\bdependencies\s*:\s*\[/m.exec(content)
  if (!marker) return null
  const start = marker.index + marker[0].length
  let depth = 1
  for (let index = start; index < content.length; index += 1) {
    if (content[index] === '[') depth += 1
    if (content[index] === ']') { depth -= 1; if (depth === 0) return { start, end: index } }
  }
  return null
}

function escapeSwift(value: string): string { return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') }
