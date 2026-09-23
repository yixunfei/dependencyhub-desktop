// @vitest-environment node
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it } from 'vitest'
import { planSwiftPMManifestMutation } from './swiftpmManifestEditor'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function installInto(content: string) {
  const cwd = await mkdtemp(join(tmpdir(), 'swift-edit-'))
  directories.push(cwd)
  await writeFile(join(cwd, 'Package.swift'), content)
  return (await planSwiftPMManifestMutation(cwd, {
    operation: 'install', packageName: 'New', version: '1.0.0',
    options: { source: 'https://example.com/New.git' }
  })).after
}

it('inserts package dependencies after name/products and before targets', async () => {
  const after = await installInto('let package = Package(name: "Demo", products: [], targets: [.target(name: "Demo", dependencies: [])])')
  expect(after.indexOf('dependencies:')).toBeGreaterThan(after.indexOf('products:'))
  expect(after.indexOf('dependencies:')).toBeLessThan(after.indexOf('targets:'))
  expect(after).toContain('.target(name: "Demo", dependencies: [])')
})

it('appends dependencies to a manifest without targets in valid argument order', async () => {
  const after = await installInto('let package = Package(name: "Demo")')
  expect(after).toMatch(/name: "Demo",\s+dependencies:/)
})

it('ignores commented declarations and keeps array commas outside line comments', async () => {
  const after = await installInto('// Package(dependencies: [])\nlet package = Package(name: "Demo", dependencies: [\n.package(url: "https://example.com/Old.git", from: "1.0.0") // keep ) ]\n])')
  expect(after).toContain('from: "1.0.0"), // keep ) ]')
  expect(after.startsWith('// Package(dependencies: [])')).toBe(true)
})
