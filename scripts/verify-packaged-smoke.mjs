import { existsSync, statSync } from 'fs'
import { spawn } from 'child_process'
import { resolve } from 'path'

const defaultAppPath = process.platform === 'win32'
  ? resolve('release', 'win-unpacked', 'DependencyHub Desktop.exe')
  : process.platform === 'darwin'
    ? resolve('release', 'mac', 'DependencyHub Desktop.app', 'Contents', 'MacOS', 'DependencyHub Desktop')
    : resolve('release', 'linux-unpacked', 'dependencyhub-desktop')
const appPath = process.argv[2] || defaultAppPath
if (!existsSync(appPath)) {
  console.error(JSON.stringify({ evidence: 'packaged-gui', status: 'blocked', reason: 'packaged executable not found', path: appPath }))
  process.exit(2)
}
if (statSync(appPath).size === 0) {
  console.error(JSON.stringify({ evidence: 'packaged-gui', status: 'blocked', reason: 'packaged executable is empty', path: appPath }))
  process.exit(2)
}
const child = spawn(appPath, [], { stdio: 'ignore', detached: false, windowsHide: true })
const timer = setTimeout(() => { child.kill(); console.log(JSON.stringify({ evidence: 'packaged-gui', status: 'passed', path: appPath, startupObserved: true })); process.exit(0) }, 5000)
child.once('error', (error) => { clearTimeout(timer); console.error(JSON.stringify({ evidence: 'packaged-gui', status: 'blocked', reason: error.message, path: appPath })); process.exit(1) })
child.once('exit', (code) => { clearTimeout(timer); if (code === 0) { console.log(JSON.stringify({ evidence: 'packaged-gui', status: 'passed', path: appPath, startupObserved: true })) } else { console.error(JSON.stringify({ evidence: 'packaged-gui', status: 'blocked', reason: 'process exited before startup probe', code, path: appPath })); process.exit(1) } })
