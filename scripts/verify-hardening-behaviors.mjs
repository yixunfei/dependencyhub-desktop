import { build } from 'esbuild'
import { chmod, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-hardening-verifier-'))
const outputFile = join(workDir, 'hardening-verifier.mjs')
const roots = []

const runner = String.raw`
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { withProjectMutation, projectMutationQueueSize } from './electron/services/projectMutation'
import { runProjectOperation } from './electron/services/projectGuard'
import {
  attachOperationFailure,
  beginOperation,
  cancelProjectOperations,
  classifyOperationFailure,
  listActiveOperations,
  requestOperationCancel,
  runWithOperationContext
} from './electron/services/operationContext'
import { resolveShellFreeCommand, runLoggedCommand } from './electron/services/commandRunner'
import { createBase64CredentialCipher, CredentialVaultStore } from './electron/services/credentialVaultCore'
import { isAllowedExternalUrl } from './electron/services/externalUrl'
import { fileWatcher } from './electron/services/watcher'

const checks = []
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
const roots = []
const fixture = async (name) => { const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-hardening-' + name + '-')); roots.push(cwd); return cwd }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// S1.1 — two writes on the same project must not interleave manifest writes.
async function testConcurrentWritesAreSerialized() {
  const cwd = await fixture('concurrent')
  const file = join(cwd, 'package.json')
  await writeFile(file, '{"dependencies":{}}')
  const events = []
  const writer = (label) => withProjectMutation(cwd, async () => {
    events.push(label + ':start')
    const manifest = JSON.parse(await readFile(file, 'utf8'))
    await wait(40)
    manifest.dependencies = { ...manifest.dependencies, [label]: '1.0.0' }
    await writeFile(file, JSON.stringify(manifest))
    events.push(label + ':end')
  })
  const staleRead = withProjectMutation(cwd, async () => {
    events.push('read:start')
    await wait(40)
    events.push('read:end')
  })
  await Promise.all([writer('alpha'), writer('beta'), staleRead])
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  assert(manifest.dependencies.alpha === '1.0.0' && manifest.dependencies.beta === '1.0.0', 'S1.1 concurrent writes on one project both survive (no lost update)')
  assert(events.indexOf('alpha:end') < events.indexOf('beta:start'), 'S1.1 the second write starts only after the first finished')
  assert(projectMutationQueueSize() === 0, 'S1.1 the per-project queue is released once idle')
}

async function testQueuedWriteRunsAfterFailure() {
  const cwd = await fixture('queue-failure')
  const order = []
  const failing = withProjectMutation(cwd, async () => { order.push('failing'); throw new Error('boom') }).catch(() => order.push('failed'))
  await failing
  await withProjectMutation(cwd, async () => { order.push('after') })
  assert(order.join(',') === 'failing,failed,after', 'S1.1 a failed write releases the queue for the next write')
}

// S1.2 — user cancellation and timeout reach the failing process.
async function testCancellationStructuredFailure() {
  const { context, finish } = beginOperation({ operationId: 'cancel-fixture', timeoutMs: 10000 })
  const pending = runWithOperationContext(context, () => runLoggedCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { cwd: process.cwd() }))
    .then(() => 'resolved', (error) => error)
  await wait(150)
  assert(requestOperationCancel('cancel-fixture'), 'S1.2 the renderer can cancel a running operation by id')
  const error = await pending
  finish()
  const failure = classifyOperationFailure(error, 'cancel-fixture')
  assert(failure.category === 'cancelled', 'S1.2 cancellation reports the cancelled category')
  assert(failure.operationId === 'cancel-fixture', 'S1.2 the structured failure keeps the operation id')
  assert(failure.retryable === true, 'S1.2 cancellation is marked retryable')
  assert(requestOperationCancel('missing-operation') === false, 'S1.2 cancelling an unknown operation is a no-op')
}

async function testTimeoutStructuredFailure() {
  const { context, finish } = beginOperation({ operationId: 'timeout-fixture', timeoutMs: 400 })
  const error = await runWithOperationContext(context, () => runLoggedCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { cwd: process.cwd() }))
    .then(() => null, (value) => value)
  finish()
  assert(error, 'S1.2 a command that exceeds its timeout rejects')
  const failure = classifyOperationFailure(error, 'timeout-fixture')
  assert(failure.category === 'timeout', 'S1.2 the timeout category is reported to the caller')
  assert(failure.retryable === true, 'S1.2 a timeout is marked retryable')
}

async function testOperationContextIsInherited() {
  const { context, finish } = beginOperation({ operationId: 'inherit-fixture', timeoutMs: null })
  const seen = await runWithOperationContext(context, async () => (await import('./electron/services/operationContext')).currentOperationId())
  finish()
  assert(seen === 'inherit-fixture', 'S1.2 nested commands inherit the ambient operation id')
}

async function testCancelProjectOperations() {
  const cwd = await fixture('cancel-project')
  const first = beginOperation({ operationId: 'project-fixture-a', projectPath: cwd, timeoutMs: null })
  const second = beginOperation({ operationId: 'project-fixture-b', projectPath: cwd, timeoutMs: null })
  const other = beginOperation({ operationId: 'project-fixture-other', projectPath: cwd + '-other', timeoutMs: null })
  assert(listActiveOperations().length >= 3, 'S1.2 active operations are listed for the UI')
  assert(cancelProjectOperations(cwd) === 2, 'S1.2 cancelling a project stops every operation bound to it')
  assert(second.context.signal.aborted && first.context.signal.aborted, 'S1.2 project cancellation aborts the matching signals')
  assert(!other.context.signal.aborted, 'S1.2 project cancellation leaves other projects alone')
  first.finish(); second.finish(); other.finish()
}

// S1.3 — non-zero exits and output limits are distinguishable.
async function testExitCodeStructuredFailure() {
  const error = await runLoggedCommand(process.execPath, ['-e', 'process.stderr.write("bad flag"); process.exit(3)'], { cwd: process.cwd() })
    .then(() => null, (value) => value)
  assert(error, 'S1.3 a non-zero exit rejects')
  const failure = classifyOperationFailure(error, 'exit-fixture')
  assert(failure.category === 'exit-code', 'S1.3 a non-zero exit reports the exit-code category')
  assert(failure.exitCode === 3, 'S1.3 the exit code is preserved in the structured failure')
}

async function testOutputLimitStructuredFailure() {
  const error = await runLoggedCommand(
    process.execPath,
    ['-e', 'process.stdout.write("x".repeat(200000))'],
    { cwd: process.cwd(), maxBuffer: 1024 }
  ).then(() => null, (value) => value)
  assert(error, 'S1.3 exceeding the output limit rejects')
  const failure = classifyOperationFailure(error, 'output-fixture')
  assert(failure.category === 'output-limit', 'S1.3 exceeding maxBuffer reports the output-limit category')
}

// The shared guard used by every mutating IPC handler.
async function testProjectGuardSerializesAndSnapshots() {
  const cwd = await fixture('guard')
  const events = []
  const dependencies = guardDependencies(events)
  await Promise.all([
    runProjectOperation(dependencies, cwd, 'guard a', async () => { events.push('a:run'); await wait(30) }),
    runProjectOperation(dependencies, cwd, 'guard b', async () => { events.push('b:run'); await wait(30) })
  ])
  assert(events.join(',') === 'a:snapshot,a:run,b:snapshot,b:run', 'S1.1 the IPC guard snapshots then serializes both writes')
  events.length = 0
  await runProjectOperation(dependencies, cwd, 'guard dry-run', async () => { events.push('dry:run') }, { serialize: false })
  assert(events.join(',') === 'dry:snapshot,dry:run', 'S1.1 an unserialized guard run still snapshots and runs')
  let captured
  try {
    await runProjectOperation(dependencies, cwd, 'guard failure', async () => { throw new Error('guard failure') })
  } catch (error) { captured = error }
  assert(captured?.failure?.category === 'unknown', 'S1.3 the guard attaches a structured failure to every rejection')
  assert(captured?.failure?.operationId === 'guard failure', 'S1.3 the attached failure carries the operation id')
}

function guardDependencies(events) {
  return {
    beginOperation: (input) => {
      const { context, finish } = beginOperation({ ...input, operationId: input.label, timeoutMs: null })
      return { context, finish }
    },
    runWithOperationContext,
    withProjectMutation,
    snapshot: async (cwd, label) => { events.push(label.startsWith('guard a') ? 'a:snapshot' : label.startsWith('guard b') ? 'b:snapshot' : 'dry:snapshot') },
    attachFailure: attachOperationFailure
  }
}

// S4 — protocol whitelist for shell.openExternal.
function testExternalUrlGuard() {
  const allowed = ['https://www.npmjs.com/package/react', 'http://localhost:5173/', 'mailto:security@example.com']
  for (const url of allowed) assert(isAllowedExternalUrl(url), 'S4 allows ' + url)
  const blocked = ['javascript:alert(1)', 'file:///C:/Windows/System32/cmd.exe', 'vbscript:msgbox(1)', 'data:text/html,<script>1</script>', '', '   ', 'not a url', 42, null, undefined]
  for (const url of blocked) assert(!isAllowedExternalUrl(url), 'S4 rejects ' + String(url))
}

// S3 — the watcher must see plain writes, atomic replaces, and lockfile-only edits.
async function testWatcherCoversManifestAndLockfiles() {
  const events = []
  const cwd = await fixture('watch')
  await writeFile(join(cwd, 'package.json'), '{"dependencies":{}}')
  await writeFile(join(cwd, 'package-lock.json'), '{"lockfileVersion":3}')
  await fileWatcher.watchProject(cwd, (change) => events.push(change.file))
  await wait(120)

  // A failed assertion must not leak the fs.watch handle: an open watcher
  // keeps the event loop alive and turns the failure into a runner timeout.
  try {
    await writeFile(join(cwd, 'package.json'), '{"dependencies":{"a":"1.0.0"}}')
    await waitForEvent(events, 'package.json')
    assert(events.includes('package.json'), 'S3 an external editor write to package.json triggers a refresh')

    events.length = 0
    await writeFile(join(cwd, 'package.json.tmp'), '{"dependencies":{"b":"2.0.0"}}')
    await rename(join(cwd, 'package.json.tmp'), join(cwd, 'package.json'))
    await waitForEvent(events, 'package.json')
    assert(events.includes('package.json'), 'S3 an atomic replace of package.json triggers a refresh')

    events.length = 0
    await writeFile(join(cwd, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}')
    await waitForEvent(events, 'package-lock.json')
    assert(events.includes('package-lock.json'), 'S3 a package-lock.json change alone triggers a refresh')

    events.length = 0
    await writeFile(join(cwd, 'README.md'), 'not a manifest')
    await wait(700)
    assert(events.length === 0, 'S3 unrelated files do not trigger a refresh')

    events.length = 0
    await writeFile(join(cwd, 'package.json'), '{"dependencies":{"c":"3.0.0"}}')
    await rename(join(cwd, 'package-lock.json'), join(cwd, 'package-lock.json.bak'))
    await writeFile(join(cwd, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"c":{}}}')
    await waitForEvent(events, 'package.json')
    await wait(400)
    const distinct = new Set(events)
    assert(events.length > 0 && distinct.size <= 2 && events.length <= 4, 'S3 rapid multi-file edits are debounced into few notifications')
  } finally {
    fileWatcher.unwatchAll()
  }
  assert(fileWatcher.watchedProjects().length === 0, 'S3 watchers are released when the project changes')
}

// S2 — a failed report must be distinguishable from an empty report.
async function testReportFailureVisibility() {
  const { collectReportFailures, createReportStatus, loadReport, recordReportFailure, recordReportSuccess } = await import('./src/features/health/reportStatus')
  let status = createReportStatus({}, ['supplyChain', 'license', 'audit'], 'loading')
  assert(status.supplyChain.status === 'loading', 'S2 every report block starts in an explicit loading state')

  const mark = (key, state, error) => {
    status = state === 'ready' ? recordReportSuccess(status, key) : recordReportFailure(status, key, error)
  }
  const okResult = await loadReport('supplyChain', async () => ({ componentCount: 3 }), mark)
  assert(okResult.ok === true && okResult.value.componentCount === 3, 'S2 a successful report keeps its payload')
  assert(status.supplyChain.status === 'ready', 'S2 a successful report is marked ready')

  const failed = await loadReport('license', async () => { throw new Error('registry unreachable') }, mark)
  assert(failed.ok === false, 'S2 a failed report does not resolve with a value')
  assert(status.license.status === 'error', 'S2 a failed report is marked error, not empty')
  assert(status.license.message === 'registry unreachable', 'S2 the failure keeps the backend message')

  const failures = collectReportFailures(status, { supplyChain: 'Supply chain', license: 'License', audit: 'Audit' })
  assert(failures.length === 1 && failures[0].label === 'License', 'S2 only the failing block is reported as failed')
  assert(!failures.some((item) => item.key === 'supplyChain'), 'S2 a healthy block is not listed as failed')
  assert(!('value' in failed) || failed.value === undefined, 'S2 a failed report carries no value payload the caller could render as empty data')
}

// B2 — cmd.exe quoting keeps metacharacters literal and % expansion impossible.
function testCmdArgumentQuoting() {
  const wrapped = resolveShellFreeCommand('npm.cmd', ['run', 't', '--', '--grep', 'a&b'])
  if (process.platform !== 'win32') {
    assert(wrapped.bin === 'npm.cmd', 'B2 non-Windows commands do not invoke cmd.exe')
    assert(wrapped.args.at(-1) === 'a&b', 'B2 non-Windows argv remains literal without shell escaping')
    return
  }
  const command = wrapped.args[3]
  assert(wrapped.bin === 'cmd.exe', 'B2 .cmd entrypoints are wrapped through cmd.exe')
  assert(wrapped.windowsVerbatimArguments === true, 'B2 the cmd.exe wrapper declares verbatim argv passing')
  assert(command.startsWith('"') && command.endsWith('"'), 'B2 the payload carries the outer quotes cmd /S strips (got ' + command + ')')
  assert(command.includes('"a&b"'), 'B2 an argument with & stays quoted and literal (got ' + command + ')')
  assert(!command.includes('^&'), 'B2 no ^ is injected inside quoted arguments (cmd does not parse ^ there)')
  const percent = resolveShellFreeCommand('npm.cmd', ['view', 'pkg@1%2B0']).args[3]
  assert(percent.includes('"pkg@1"^%"2B0"'), 'B2 % is emitted as ^% between quoted segments so cmd cannot expand it (got ' + percent + ')')
}

// B2 at the spawn layer: without windowsVerbatimArguments libuv re-quotes the
// /c payload per MSVCRT rules (inner " becomes \"), and cmd.exe — which does
// not treat backslash as an escape — executes the mangled line, so nothing
// formatCmdArg quoted would survive. Spawns cmd.exe for real on Windows.
async function testCmdSpawnPassesArgumentsIntact() {
  if (process.platform !== 'win32') return
  const { spawn } = await import('node:child_process')
  const dir = await fixture('cmdspawn')
  const shim = join(dir, 'tool.cmd')
  await writeFile(shim, '@echo off\r\nnode -e "process.stdout.write(JSON.stringify(process.argv.slice(1)))" %*\r\n')
  const { bin, args, windowsVerbatimArguments } = resolveShellFreeCommand(shim, ['a&b c', '100%done'])
  assert(windowsVerbatimArguments === true, 'B2 a .cmd shim uses verbatim argv passing')
  let out = ''
  // Mirrors CommandProcess.start(): the wrapper must be spawned verbatim or
  // libuv re-quotes the payload and cmd.exe executes a mangled line (the
  // failure mode below proves the guard is load-bearing).
  const child = spawn(bin, args, { cwd: dir, windowsHide: true, shell: false, windowsVerbatimArguments: true })
  child.stdout.on('data', (chunk) => { out += String(chunk) })
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (exitCode) => resolve(exitCode))
  })
  const rendered = out.trim().split(/\r?\n/).join(' | ')
  assert(code === 0, 'B2 the cmd.exe wrapped shim exits cleanly (got ' + code + ')')
  assert(out.includes('"a&b c"'), 'B2 a quoted argument containing & and spaces reaches the child intact (got ' + rendered + ')')
  assert(out.includes('"100%done"'), 'B2 % travels as a literal character without cmd expansion (got ' + rendered + ')')
}

// B3 — concurrent vault operations serialize and never lose credentials or leak staging files.
async function testVaultConcurrencyAndStagingFiles() {
  const cwd = await fixture('vault')
  const store = new CredentialVaultStore(cwd, createBase64CredentialCipher())
  const saved = await Promise.all(Array.from({ length: 24 }, (_, index) =>
    store.save({ managerId: 'npm', service: 'registry-' + index, secret: 'secret-' + index })))
  const ids = saved.map((credential) => credential.id)
  assert(new Set(ids).size === 24, 'B3 concurrent saves produce distinct credentials')
  const listed = await store.list()
  assert(listed.length === 24, 'B3 concurrent read-modify-write does not lose a credential')
  await Promise.all([...ids.map((id) => store.resolve(id)),
    store.save({ managerId: 'npm', service: 'registry-late', secret: 'late' })])
  await Promise.all([store.delete(ids[0]), store.save({ managerId: 'npm', service: 'registry-extra', secret: 'extra' })])
  const after = await store.list()
  assert(after.length === 25 && !after.some((credential) => credential.id === ids[0]),
    'B3 interleaved resolve/save/delete keep the vault consistent')
  const files = await readdir(cwd)
  assert(!files.some((file) => file.endsWith('.tmp')), 'B3 staging files are unique per write and never left behind')
}

async function waitForEvent(events, file) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (events.includes(file)) return
    await wait(50)
  }
}

try {
  await testConcurrentWritesAreSerialized()
  await testQueuedWriteRunsAfterFailure()
  await testCancellationStructuredFailure()
  await testTimeoutStructuredFailure()
  await testOperationContextIsInherited()
  await testCancelProjectOperations()
  await testExitCodeStructuredFailure()
  await testOutputLimitStructuredFailure()
  await testProjectGuardSerializesAndSnapshots()
  testExternalUrlGuard()
  await testWatcherCoversManifestAndLockfiles()
  await testReportFailureVisibility()
  testCmdArgumentQuoting()
  await testCmdSpawnPassesArgumentsIntact()
  await testVaultConcurrencyAndStagingFiles()
  console.log('Hardening behavior verification passed (' + checks.length + ' checks)')
} finally {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
}
`

const commandLoggerStub = `
export function createLogId() { return 'log-fixture' }
export function formatCommand(bin, args) { return [bin, ...args].join(' ') }
export function sendCommandLog() {}
export function setCommandLogWindow() {}
`
const operationHistoryStub = `export async function recordOperationHistory() {}`
const encodingStub = `
export class CommandOutputDecoder { write(chunk) { return chunk.toString('utf8') } }
export function commandEnv(env) { return { ...process.env, ...(env || {}) } }
`
const toolchainStub = `export async function resolveToolBin(tool) { return tool } export function getToolDisplayName(tool) { return tool }`

try {
  await build({
    stdin: { contents: runner, resolveDir: process.cwd(), sourcefile: 'hardening-verifier.ts', loader: 'ts' },
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    plugins: [{
      name: 'hardening-stubs',
      setup(api) {
        const stubs = {
          './commandLogger': commandLoggerStub,
          './operationHistory': operationHistoryStub,
          './encoding': encodingStub,
          './toolchain': toolchainStub
        }
        api.onResolve({ filter: /^\.\/(commandLogger|operationHistory|encoding|toolchain)$/ }, (args) => ({ path: args.path, namespace: 'hardening-stub' }))
        api.onLoad({ filter: /.*/, namespace: 'hardening-stub' }, (args) => ({ loader: 'js', contents: stubs[args.path] }))
      }
    }]
  })
  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(workDir, { recursive: true, force: true })
}
