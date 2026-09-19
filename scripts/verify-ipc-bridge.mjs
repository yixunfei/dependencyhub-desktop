import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const directory = await mkdtemp(join(tmpdir(), 'dependencyhub-ipc-'))
const main = join(directory, 'main.cjs')
const preload = join(directory, 'preload.cjs')
const page = join(directory, 'index.html')
await writeFile(page, '<html><body>IPC verification</body></html>', 'utf-8')

const fixture = `
const { app, BrowserWindow } = require('electron')
const { handleIpc } = require('./electron/ipcHandler')
app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))})
app.disableHardwareAcceleration()
// Restricted environments (containers/CI sandboxes) may block Chromium's GPU and
// network-service subprocesses; these switches keep the fixture loadable there.
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
handleIpc('manager:execute', async () => {
  throw Object.assign(new Error('Fixture cancelled'), {
    failure: { category: 'cancelled', operationId: 'ipc-fixture', retryable: true },
    backup: { path: 'fixture-backup.json', files: [] },
    restore: { attempted: true, restored: true },
    stdout: 'partial output'
  })
})
handleIpc('open-external', async () => { throw new Error('Fixture invalid URL') })
handleIpc('operation:list-active', async () => [{ operationId: 'ipc-fixture' }])
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: {
    preload: ${JSON.stringify(preload)}, contextIsolation: true, sandbox: true, nodeIntegration: false
  } })
  try {
    await window.loadFile(${JSON.stringify(page)})
    const result = await window.webContents.executeJavaScript(
      '(' + (async function () {
        const failed = await window.electronAPI.managers.execute('fixture', 'npm', { operation: 'sync' })
        const active = await window.electronAPI.operations.listActive()
        let message = ''
        try { await window.electronAPI.openExternal('invalid:fixture') } catch (error) { message = error.message }
        return { failed, active, message }
      }).toString() + ')()'
    )
    if (result.failed.__dhIpcFailureV1 !== true
      || result.failed.error.failure.category !== 'cancelled'
      || result.failed.error.failure.operationId !== 'ipc-fixture'
      || result.failed.error.backup.path !== 'fixture-backup.json'
      || !result.failed.error.restore.restored
      || result.failed.error.stdout !== 'partial output'
      || result.active[0].operationId !== 'ipc-fixture'
      || !result.message.includes('Fixture invalid URL')) throw new Error(JSON.stringify(result))
    console.log('Electron IPC verification passed: isolated preload preserves failure, backup, restore, and success data')
    window.destroy()
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
}).catch((error) => { console.error(error); app.exit(1) })
`

try {
  await build({
    entryPoints: ['electron/preload.ts'], outfile: preload, bundle: true,
    platform: 'node', format: 'cjs', external: ['electron'], logLevel: 'silent'
  })
  await build({
    stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'ts' },
    outfile: main, bundle: true, platform: 'node', format: 'cjs', external: ['electron'], logLevel: 'silent'
  })
  await new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(require('electron'), [main], { env, windowsHide: true, stdio: 'inherit' })
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('Electron IPC verification timed out'))
    }, 30_000)
    child.once('error', (error) => { clearTimeout(timeout); reject(error) })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve()
      else reject(new Error(`Electron IPC verification exited with ${code}`))
    })
  })
} finally {
  // On the timeout path the Electron process tree may still be releasing file
  // handles; a cleanup failure must not replace the real error (e.g. report a
  // timeout as a delete failure).
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch((cleanupError) => {
    console.warn(`IPC verification: failed to clean ${directory}: ${cleanupError.message}`)
  })
}
