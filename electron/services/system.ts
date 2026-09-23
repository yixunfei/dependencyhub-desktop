import { spawn } from 'child_process'
import { app } from 'electron'
import { resolveToolBin } from './toolchain'
import { runLoggedCommand } from './commandRunner'

function run(
  bin: string,
  args: string[] = [],
  cwd?: string,
  timeoutMs = 120_000
): Promise<{ stdout: string; stderr: string }> {
  // log:false keeps system diagnostics (version checks, cache config) out of
  // the workbench command log; runLoggedCommand supplies timeout/signal/operationId.
  // On timeout the process tree is killed and runLoggedCommand throws
  // OperationTimeoutError, so callers never hang on a stuck child.
  return runLoggedCommand(bin, args, {
    cwd,
    log: false,
    maxBuffer: 1024 * 1024 * 10,
    timeoutMs
  })
}

export class SystemService {
  async getNpmInfo(): Promise<any> {
    const info: Record<string, string> = {
      npmVersion: '',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron || app.getVersion()
    }

    try {
      const { stdout } = await run(await resolveToolBin('npm'), ['--version'])
      info.npmVersion = stdout.trim()
    } catch (error: any) {
      info.npmError = readableError(error)
    }

    try {
      const { stdout } = await run('node', ['--version'])
      info.nodeVersion = stdout.trim() || info.nodeVersion
    } catch (error: any) {
      info.nodeError = readableError(error)
    }

    return info
  }

  async getCachePath(): Promise<string> {
    try {
      const { stdout } = await run(await resolveToolBin('npm'), ['config', 'get', 'cache'])
      return stdout.trim()
    } catch (error) {
      return ''
    }
  }

  async setCachePath(newPath: string): Promise<void> {
    await run(await resolveToolBin('npm'), ['config', 'set', 'cache', newPath])
  }

  async clearCache(): Promise<string> {
    const { stdout, stderr } = await run(await resolveToolBin('npm'), ['cache', 'clean', '--force'])
    return stdout || stderr
  }

  async updateNpm(): Promise<string> {
    try {
      const { stdout, stderr } = await run(await resolveToolBin('npm'), ['install', '-g', 'npm@latest'], undefined, 300_000)
      return stdout || stderr
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  async npmHelp(command?: string): Promise<string> {
    try {
      const args = command ? ['help', command] : ['help']
      const { stdout } = await run(await resolveToolBin('npm'), args)
      return stdout
    } catch (error: any) {
      return error.stdout || error.message
    }
  }

  async openTerminal(cwd: string): Promise<void> {
    const platform = process.platform

    if (platform === 'win32') {
      // spawn's cwd already selects the directory. Avoid putting a path in
      // cmd source, where percent expansions can rewrite even quoted text.
      launchDetached('cmd.exe', ['/D', '/K'], { cwd, windowsHide: false })
    } else if (platform === 'darwin') {
      launchDetached('open', ['-a', 'Terminal.app', cwd], { cwd })
    } else if (platform === 'linux') {
      launchDetached('gnome-terminal', [`--working-directory=${cwd}`], { cwd })
    }
  }
}

/**
 * Fire-and-forget process launch. The asynchronous 'error' event (ENOENT /
 * EACCES when the terminal binary is missing) must be consumed or it becomes
 * an uncaughtException that takes the whole main process down.
 */
function launchDetached(bin: string, args: string[], options: { cwd: string; windowsHide?: boolean; verbatim?: boolean }): void {
  try {
    const child = spawn(bin, args, {
      cwd: options.cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: options.windowsHide ?? true,
      windowsVerbatimArguments: options.verbatim ?? false
    })
    child.on('error', (error) => {
      console.warn(`Failed to launch ${bin}:`, error.message)
    })
    child.unref()
  } catch (error) {
    console.warn(`Failed to launch ${bin}:`, error)
  }
}

function readableError(error: any): string {
  const stdout = typeof error?.stdout === 'string' ? error.stdout : ''
  const stderr = typeof error?.stderr === 'string' ? error.stderr : ''
  return (stderr || stdout || error?.message || String(error)).trim()
}
