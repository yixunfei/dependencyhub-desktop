import { existsSync, statSync } from 'fs'
import { spawn } from 'child_process'
import { resolve } from 'path'

function resolveDefaultAppPath() {
  if (process.platform === 'win32') {
    return resolve('release', 'win-unpacked', 'DependencyHub Desktop.exe')
  }
  if (process.platform === 'darwin') {
    // electron-builder appends an architecture suffix unless the build uses
    // the default arch; Apple Silicon therefore lands in `mac-arm64`.
    const candidates = [
      resolve('release', 'mac-arm64', 'DependencyHub Desktop.app', 'Contents', 'MacOS', 'DependencyHub Desktop'),
      resolve('release', 'mac', 'DependencyHub Desktop.app', 'Contents', 'MacOS', 'DependencyHub Desktop'),
      resolve('release', 'mac-universal', 'DependencyHub Desktop.app', 'Contents', 'MacOS', 'DependencyHub Desktop')
    ]
    return candidates.find((candidate) => existsSync(candidate)) || candidates[1]
  }
  return resolve('release', 'linux-unpacked', 'dependencyhub-desktop')
}

const appPath = process.argv[2] || resolveDefaultAppPath()
if (!existsSync(appPath)) {
  console.error(JSON.stringify({ evidence: 'packaged-gui', status: 'blocked', reason: 'packaged executable not found', path: appPath }))
  process.exit(2)
}
if (statSync(appPath).size === 0) {
  console.error(JSON.stringify({ evidence: 'packaged-gui', status: 'blocked', reason: 'packaged executable is empty', path: appPath }))
  process.exit(2)
}

// A live process alone proves nothing: a white-screen startup (renderer crash,
// failed load) would still keep the process alive. Probe Chromium's DevTools
// endpoint instead and require an actual page target to appear.
const port = 9223 + (process.pid % 500)
const flags = ['--remote-debugging-port=' + port, '--no-sandbox', '--disable-gpu']
const child = spawn(appPath, flags, { stdio: 'ignore', detached: false, windowsHide: true })

function report(status, extra = {}) {
  const payload = { evidence: 'packaged-gui', status, path: appPath, ...extra }
  if (status === 'passed') console.log(JSON.stringify(payload))
  else console.error(JSON.stringify(payload))
}

function finish(status, code, extra = {}) {
  try { child.kill() } catch { /* already gone */ }
  report(status, extra)
  process.exit(code)
}

const deadline = Date.now() + 30_000
async function probeOnce() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) })
    if (!response.ok) return false
    const targets = await response.json()
    // A page target alone also exists for a white-screen/blank load, so require
    // it to be the packaged renderer document (a missing dist/index.html keeps
    // the window on about:blank).
    return Array.isArray(targets) && targets.some((target) => (
      target.type === 'page' && typeof target.url === 'string' && /index\.html/i.test(target.url)
    ))
  } catch {
    return false
  }
}

child.once('error', (error) => finish('blocked', 1, { reason: error.message }))
child.once('exit', (code) => finish('blocked', 1, { reason: 'process exited before page target appeared', exitCode: code }))

while (Date.now() < deadline) {
  if (await probeOnce()) finish('passed', 0, { startupObserved: true, probe: 'cdp-page-target' })
  await new Promise((resolveSleep) => setTimeout(resolveSleep, 500))
}
finish('blocked', 1, { reason: 'no CDP page target within 30s (renderer likely failed to start)' })
