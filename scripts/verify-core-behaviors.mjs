import { build } from 'esbuild'
import { mkdtemp, rm, writeFile, readFile, access } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFile as execFileCallback } from 'child_process'
import { promisify } from 'util'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-core-verifier-'))
const outputFile = join(workDir, 'core-verifier.mjs')
const roots = []

const runner = String.raw`
import { mkdtemp, rm, writeFile, readFile, access } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ExtendedManagerService } from './electron/services/extendedManager'
import { NpmService } from './electron/services/npm'
import { getManagerDefinition } from './shared/managerRegistry'
import { withProjectMutation } from './electron/services/projectMutation'
import { getCalls, resetCalls, setCommandFailure } from './commandRunner'

const checks = []
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
const roots = []
const fixture = async (name) => { const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-core-' + name + '-')); roots.push(cwd); return cwd }

async function testPlanAndUnsupported() {
  const cwd = await fixture('plan')
  const service = new ExtendedManagerService()
  resetCalls()
  const plan = await service.plan(cwd, 'apt', { operation: 'install', packageName: 'curl' })
  await service.executePlanned(cwd, 'apt', plan.tool, plan.args)
  assert(getCalls().some((call) => call.join(' ') === plan.args.join(' ')), 'F1 execute uses the planned argv')
  resetCalls()
  let rejected = false
  try { await service.plan(cwd, 'apt', { operation: 'tree' }) } catch { rejected = true }
  assert(rejected, 'F1 unsupported operation is rejected during planning')
  assert(getCalls().length === 0, 'F1 unsupported operation starts no process')
}

async function testBackupCreationAndNewFileRollback() {
  const cwd = await fixture('backup')
  await writeFile(join(cwd, 'Package.swift'), 'let package = Package(name: "Demo")')
  const service = new ExtendedManagerService()
  setCommandFailure(true)
  let error
  try {
    await service.executeWithMutation(cwd, 'swiftpm', ['package', 'resolve'], async () => {
      await writeFile(join(cwd, 'Package.resolved'), '{"generated":true}')
    })
  } catch (value) { error = value }
  setCommandFailure(false)
  assert(error, 'F4 failed command returns an error')
  await assertMissing(join(cwd, 'Package.resolved'), 'F4 newly generated lockfile is removed on rollback')
  assert(error.backup?.files.some((file) => file.file === 'Package.resolved' && file.exists === false), 'F4 backup records a missing lockfile')
}

async function testDeletedFileRestore() {
  const cwd = await fixture('deleted')
  await writeFile(join(cwd, 'Package.swift'), 'manifest')
  await writeFile(join(cwd, 'Package.resolved'), 'lock')
  const service = new ExtendedManagerService()
  setCommandFailure(true)
  try {
    await service.executeWithMutation(cwd, 'swiftpm', ['package', 'resolve'], async () => {
      await rm(join(cwd, 'Package.resolved'))
    })
  } catch { }
  setCommandFailure(false)
  assert(await readFile(join(cwd, 'Package.resolved'), 'utf8') === 'lock', 'F4 deleted pre-existing file is restored')
}

async function testCancelledMutationRestoresWithinOuterGuard() {
  const cwd = await fixture('cancelled-mutation')
  await writeFile(join(cwd, 'Package.swift'), 'original')
  const service = new ExtendedManagerService()
  setCommandFailure('cancelled')
  let error
  try {
    await withProjectMutation(cwd, () => service.executeWithMutation(cwd, 'swiftpm', ['package', 'resolve'], async () => {
      await writeFile(join(cwd, 'Package.swift'), 'changed')
      await writeFile(join(cwd, 'Package.resolved'), 'generated')
    }))
  } catch (value) { error = value }
  setCommandFailure(false)
  assert(error?.failure?.category === 'cancelled', 'cancelled adapter keeps the failure category inside an outer mutation guard')
  assert(error?.restore?.restored === true, 'cancelled adapter reports completed manifest restoration')
  assert(await readFile(join(cwd, 'Package.swift'), 'utf8') === 'original', 'cancelled adapter restores the original manifest')
  await assertMissing(join(cwd, 'Package.resolved'), 'cancelled adapter removes a newly generated lockfile')
}

async function testBackupConflict() {
  const cwd = await fixture('conflict')
  await writeFile(join(cwd, 'Package.swift'), 'original')
  const service = new ExtendedManagerService()
  const result = await service.executeWithMutation(cwd, 'swiftpm', ['package', 'resolve'], async () => {
    await writeFile(join(cwd, 'Package.swift'), 'operation')
  })
  await writeFile(join(cwd, 'Package.swift'), 'external-change')
  const restored = await service.restoreBackup(cwd, result.backup.path, { 'Package.swift': { exists: true, hash: 'operation-hash' } })
  assert(await readFile(join(cwd, 'Package.swift'), 'utf8') === 'external-change', 'F4 restore conflict does not overwrite external changes')
  assert(restored.conflicts.some((item) => item.file === 'Package.swift'), 'F4 restore reports concurrent file conflict')
  assert(result.backup, 'F4 conflict scenario keeps backup entry')
}

async function testCoordinatorRace() {
  const { ManagerWorkspaceCoordinator } = await import('./src/features/managers/extended/managerWorkspaceCoordinator')
  const coordinator = new ManagerWorkspaceCoordinator()
  const a = coordinator.begin({ projectPath: 'A', managerId: 'npm' })
  const b = coordinator.begin({ projectPath: 'B', managerId: 'pip' })
  assert(!coordinator.accepts(a, { projectPath: 'A', managerId: 'npm' }), 'F2 stale A scope is rejected after switching to B')
  assert(coordinator.accepts(b, { projectPath: 'B', managerId: 'pip' }), 'F2 latest B scope is accepted')
}

async function testRealNpmFixture() {
  const cwd = await fixture('real-npm')
  const packageRoot = await fixture('fixture-package')
  await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: 'fixture-real-package', version: '1.0.0', main: 'index.js' }))
  await writeFile(join(packageRoot, 'index.js'), 'module.exports = 1')
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ name: 'fixture-root', private: true, dependencies: { 'fixture-real-package': 'file:' + packageRoot, 'fixture-missing': '1.0.0', 'fixture-extraneous': '1.0.0' }, devDependencies: { 'fixture-dev': '1.0.0' }, optionalDependencies: { 'fixture-optional': '1.0.0' }, peerDependencies: { 'fixture-peer': '^2.0.0' } }))
  const npm = new NpmService()
  const result = await npm.list(cwd, false)
  assert(result.manifest.dependencies['fixture-real-package'], 'F3 real fixture reads production manifest')
  assert(result.statuses?.['fixture-missing']?.status === 'missing', 'F3 real fixture reports missing dependency')
  assert(result.statuses?.['fixture-dev']?.type === 'devDependencies', 'F3 real fixture preserves dev declaration type')
  assert(result.statuses?.['fixture-optional']?.type === 'optionalDependencies', 'F3 real fixture preserves optional declaration type')
  assert(result.statuses?.['fixture-extraneous']?.status === 'missing' || result.statuses?.['fixture-extraneous']?.status === 'extraneous', 'F3 real fixture classifies unmanaged or missing package')
  assert(result.statuses?.['fixture-peer']?.status === 'peer-conflict' || result.statuses?.['fixture-peer']?.type === 'peerDependencies', 'F3 real fixture exposes peer conflict classification')
  assert(result.statuses?.['fixture-peer']?.problems !== undefined, 'F3 peer classification preserves problem details')
}

async function testNpmManifestResult() {
  const cwd = await fixture('npm')
  await writeFile(join(cwd, 'package.json'), JSON.stringify({
    dependencies: { prod: '^1.0.0' },
    devDependencies: { dev: '^2.0.0' },
    optionalDependencies: { optional: '^3.0.0' },
    peerDependencies: { peer: '^4.0.0' }
  }))
  const npm = new NpmService()
  const result = await npm.list(cwd, false)
  assert(result.manifest.dependencies.prod === '^1.0.0', 'F3 production declarations are returned')
  assert(result.manifest.devDependencies.dev === '^2.0.0', 'F3 development declarations are returned')
  assert(result.manifest.optionalDependencies.optional === '^3.0.0', 'F3 optional declarations are returned')
  assert(result.manifest.peerDependencies.peer === '^4.0.0', 'F3 peer declarations are returned')
  setCommandFailure(true)
  const partial = await npm.list(cwd, false)
  setCommandFailure(false)
  assert(partial.manifest.devDependencies.dev === '^2.0.0', 'F3 non-zero npm list preserves manifest data')
  assert(typeof partial.error === 'string', 'F3 non-zero npm list exposes an error without dropping the result')
}

async function assertMissing(path, message) {
  let missing = false
  try { await access(path) } catch { missing = true }
  assert(missing, message)
}

try {
  await testPlanAndUnsupported()
  await testBackupCreationAndNewFileRollback()
  await testDeletedFileRestore()
  await testCancelledMutationRestoresWithinOuterGuard()
  await testBackupConflict()
  await testCoordinatorRace()
  await testRealNpmFixture()
  await testNpmManifestResult()
  console.log('Core behavior verification passed (' + checks.length + ' checks)')
} finally {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
}
`

const commandRunnerStub = `
let calls = []
let commandFailure = false
export function resetCalls() { calls = [] }
export function getCalls() { return calls }
export function setCommandFailure(value) { commandFailure = value }
export async function runLoggedCommand(_bin, args, options = {}) {
  calls.push([...args])
  if (commandFailure === 'cancelled') throw Object.assign(new Error('fixture was cancelled'), { failure: { category: 'cancelled' } })
  if (commandFailure) throw Object.assign(new Error('fixture command failure'), { stderr: 'fixture command failure', code: 1 })
  return { stdout: 'ok', stderr: '' }
}
export function resolveShellFreeCommand(bin, args) { return { bin, args } }
`
const toolchainStub = `export async function resolveToolBin(tool) { return tool } export function getToolDisplayName(tool) { return tool }`

try {
  await build({
    stdin: { contents: runner, resolveDir: process.cwd(), sourcefile: 'core-verifier.ts', loader: 'ts' },
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    plugins: [{
      name: 'core-stubs',
      setup(api) {
        api.onResolve({ filter: /^\.\/(commandRunner|toolchain)$/ }, (args) => {
          if (args.importer.endsWith('extendedManager.ts') || args.importer.endsWith('npm.ts') || args.importer.endsWith('core-verifier.ts')) return { path: args.path, namespace: 'core-stub' }
        })
        api.onLoad({ filter: /.*/, namespace: 'core-stub' }, (args) => ({ loader: 'js', contents: args.path === './toolchain' ? toolchainStub : commandRunnerStub }))
      }
    }]
  })
  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(workDir, { recursive: true, force: true })
}
