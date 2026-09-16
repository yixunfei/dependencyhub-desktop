import { build } from 'esbuild'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-swiftpm-verifier-'))
const outputFile = join(workDir, 'swiftpm-verifier.mjs')
const resolveStub = `const { readFile, writeFile } = await import('fs/promises')
const { join } = await import('path')
let failResolve = false
export function setFailResolve(value) { failResolve = value }
export async function runLoggedCommand(_bin, args, options = {}) {
  if (args.join(' ') !== 'package resolve') return { stdout: '', stderr: '' }
  if (failResolve) {
    await writeFile(join(options.cwd, 'Package.resolved'), JSON.stringify({ version: 2, pins: [{ identity: 'partial', location: 'https://example/partial.git', state: { version: '0.0.1' } }] }))
    const error = new Error('fixture resolve failure')
    error.stderr = 'fixture resolve failure'
    error.code = 1
    throw error
  }
  const manifest = await readFile(join(options.cwd, 'Package.swift'), 'utf-8')
  const pins = []
  if (manifest.includes('NewPackage.git')) pins.push({ identity: 'newpackage', location: 'https://github.com/example/NewPackage.git', state: { revision: 'new', version: '1.0.0' } })
  if (manifest.includes('SwiftLint.git')) pins.push({ identity: 'swiftlint', location: 'https://github.com/realm/SwiftLint.git', state: { revision: 'def', version: '0.54.0' } })
  await writeFile(join(options.cwd, 'Package.resolved'), JSON.stringify({ version: 2, pins }, null, 2))
  return { stdout: 'resolved', stderr: '' }
}`
const runner = String.raw`
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ManagerWorkspaceService } from './electron/services/managerWorkspace'
import { setFailResolve } from './commandRunner'
const roots = []
const checks = []
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
const fixture = async () => { const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-swiftpm-')); roots.push(cwd); return cwd }
const main = async () => {
  const cwd = await fixture()
  await writeFile(join(cwd, 'Package.swift'), ['// swift-tools-version: 5.9', 'import PackageDescription', 'let package = Package(name: "Demo", dependencies: [', '  .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),', '  .package(name: "SwiftLint", url: "https://github.com/realm/SwiftLint.git", exact: "0.54.0")', '])'].join(String.fromCharCode(10)))
  await writeFile(join(cwd, 'Package.resolved'), JSON.stringify({ version: 2, pins: [{ identity: 'alamofire', location: 'https://github.com/Alamofire/Alamofire.git', state: { revision: 'abc', version: '5.9.0' } }, { identity: 'swiftlint', location: 'https://github.com/realm/SwiftLint.git', state: { revision: 'def', version: '0.54.0' } }] }, null, 2))
  const service = new ManagerWorkspaceService()
  const descriptor = service.descriptors().find((item) => item.managerId === 'swiftpm')
  assert(descriptor?.status === 'preview', 'SwiftPM uses the preview adapter')
  assert(descriptor?.capabilities.health === true, 'SwiftPM exposes health capability')
  const originalManifest = await readFile(join(cwd, 'Package.swift'), 'utf-8')
  const originalLock = await readFile(join(cwd, 'Package.resolved'), 'utf-8')
  const request = { operation: 'install', packageName: 'NewPackage', version: '1.0.0', options: { source: 'https://github.com/example/NewPackage.git' } }
  const result = await service.execute(cwd, 'swiftpm', request)
  assert((await readFile(join(cwd, 'Package.swift'), 'utf-8')).includes('NewPackage.git'), 'SwiftPM install edits Package.swift')
  assert((await readFile(join(cwd, 'Package.resolved'), 'utf-8')).includes('NewPackage'), 'SwiftPM resolve refreshes Package.resolved')
  assert(result.backup?.files.some((item) => item.file === 'Package.resolved'), 'SwiftPM install backs up Package.resolved')
  await service.restoreBackup(cwd, result.backup.path)
  assert((await readFile(join(cwd, 'Package.swift'), 'utf-8')) === originalManifest, 'SwiftPM restore restores Package.swift')
  assert((await readFile(join(cwd, 'Package.resolved'), 'utf-8')) === originalLock, 'SwiftPM restore restores Package.resolved')
  const dryManifest = await readFile(join(cwd, 'Package.swift'), 'utf-8')
  const dryLock = await readFile(join(cwd, 'Package.resolved'), 'utf-8')
  const dry = await service.execute(cwd, 'swiftpm', request, { dryRun: true })
  assert(dry.dryRun === true && !dry.backup, 'SwiftPM dry-run does not write or backup')
  assert((await readFile(join(cwd, 'Package.swift'), 'utf-8')) === dryManifest && (await readFile(join(cwd, 'Package.resolved'), 'utf-8')) === dryLock, 'SwiftPM dry-run leaves files unchanged')
  setFailResolve(true)
  let failed = false
  try { await service.execute(cwd, 'swiftpm', request) } catch (error) { failed = true; assert(error.message === 'fixture resolve failure', 'SwiftPM resolve failure is surfaced') }
  setFailResolve(false)
  assert(failed, 'SwiftPM failed resolve rejects')
  assert((await readFile(join(cwd, 'Package.swift'), 'utf-8')) === originalManifest, 'Failed resolve restores Package.swift')
  assert((await readFile(join(cwd, 'Package.resolved'), 'utf-8')) === originalLock, 'Failed resolve restores Package.resolved')
  const remove = await service.execute(cwd, 'swiftpm', { operation: 'remove', packageName: 'Alamofire' })
  assert(!(await readFile(join(cwd, 'Package.swift'), 'utf-8')).includes('Alamofire.git'), 'SwiftPM remove edits Package.swift')
  assert(!(await readFile(join(cwd, 'Package.resolved'), 'utf-8')).includes('Alamofire'), 'SwiftPM remove refreshes Package.resolved')
  assert(remove.backup?.files.some((item) => item.file === 'Package.resolved'), 'SwiftPM remove backs up Package.resolved')
  const missing = await fixture()
  await writeFile(join(missing, 'Package.swift'), ['// swift-tools-version: 5.9', 'import PackageDescription', 'let package = Package(name: "Missing")'].join(String.fromCharCode(10)))
  const missingHealth = await service.health(missing, 'swiftpm')
  assert(missingHealth.findings.some((item) => item.id === 'swiftpm-lock-missing'), 'SwiftPM health reports missing Package.resolved')
  console.log('SwiftPM manager verification passed (' + checks.length + ' checks)')
}
try { await main() } finally { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))}
`
try {
  await build({ stdin: { contents: runner, resolveDir: process.cwd(), sourcefile: 'swiftpm-verifier.ts', loader: 'ts' }, outfile: outputFile, bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'silent', banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" }, plugins: [{ name: 'swiftpm-stubs', setup(api) { api.onResolve({ filter: /^\.\/(toolchain|commandRunner)$/ }, (args) => args.importer.endsWith('extendedManager.ts') || args.importer.endsWith('swiftpm-verifier.ts') ? { path: args.path, namespace: 'swiftpm-stub' } : undefined); api.onLoad({ filter: /.*/, namespace: 'swiftpm-stub' }, (args) => args.path === './toolchain' ? { loader: 'ts', contents: "export type ToolName = string; export async function resolveToolBin(tool: string) { return tool; }" } : { loader: 'js', contents: resolveStub }) } }] })
  await import(pathToFileURL(outputFile).href)
} finally { await rm(workDir, { recursive: true, force: true }) }
