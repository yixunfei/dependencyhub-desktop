import { BrowserWindow } from 'electron'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { createLogId } from './commandLogger'
import { commandEnv, decodeCommandChunk } from './encoding'
import { terminateProcessTree } from './processTree'

interface TerminalSession {
  id: string
  cwd: string
  child: ChildProcessWithoutNullStreams
}

let terminalWindow: BrowserWindow | null = null

export function setTerminalWindow(window: BrowserWindow | null) {
  terminalWindow = window
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>()

  create(cwd?: string): { id: string; cwd: string; shell: string } {
    const id = createLogId()
    const workingDirectory = this.resolveCwd(cwd)
    const shell = this.getShell()
    const child = spawn(shell.bin, shell.args, {
      cwd: workingDirectory,
      env: commandEnv({ TERM: process.env.TERM || 'xterm-256color' }),
      shell: false,
      windowsHide: true,
      // POSIX: become a process-group leader so kill() can terminate the shell
      // together with every long-running child it spawned.
      detached: process.platform !== 'win32'
    })

    const session: TerminalSession = { id, cwd: workingDirectory, child }
    this.sessions.set(id, session)

    // A destroyed stdin (shell already exited but 'close' not yet delivered)
    // must not surface as an uncaughtException and take down the main process.
    child.stdin.on('error', () => undefined)

    child.stdout.on('data', (chunk) => {
      this.send('terminal:data', { id, data: decodeCommandChunk(chunk), stream: 'stdout' })
    })

    child.stderr.on('data', (chunk) => {
      this.send('terminal:data', { id, data: decodeCommandChunk(chunk), stream: 'stderr' })
    })

    child.on('error', (error) => {
      this.send('terminal:data', { id, data: `${error.message}\n`, stream: 'stderr' })
      // spawn ENOENT (missing shell / blocked by security software) may never
      // be followed by 'close'; drop the dead session so the table cannot
      // accumulate and write() reports a deterministic error.
      if (this.sessions.get(id) === session) {
        this.sessions.delete(id)
        this.send('terminal:exit', { id, code: null })
      }
    })

    child.on('close', (code) => {
      this.sessions.delete(id)
      this.send('terminal:exit', { id, code })
    })

    return { id, cwd: workingDirectory, shell: shell.label }
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session || session.child.killed) {
      throw new Error('Terminal session is not available')
    }
    const stdin = session.child.stdin
    if (stdin.destroyed || stdin.writableEnded) {
      throw new Error('Terminal session is not available')
    }
    stdin.write(data, () => {
      // Swallow late write errors (e.g. stream destroyed between check and write).
    })
  }

  async kill(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    try {
      // Killing only the shell leaves `npm run dev` / `vite` grandchildren
      // holding ports and files; terminate the whole tree instead.
      await terminateProcessTree(session.child)
    } catch (error) {
      console.warn('Failed to terminate terminal process tree:', error)
      try {
        session.child.kill('SIGKILL')
      } catch {
        // Already gone.
      }
    }
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) {
      void this.kill(id).catch(() => undefined)
    }
  }

  private resolveCwd(cwd?: string): string {
    if (cwd && existsSync(cwd)) {
      return cwd
    }
    return homedir()
  }

  private getShell(): { bin: string; args: string[]; label: string } {
    if (process.platform === 'win32') {
      return {
        bin: 'powershell.exe',
        args: [
          '-NoLogo',
          '-NoExit',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          '$utf8 = New-Object System.Text.UTF8Encoding $false; [Console]::InputEncoding = $utf8; [Console]::OutputEncoding = $utf8; $OutputEncoding = $utf8; chcp 65001 > $null'
        ],
        label: 'PowerShell'
      }
    }

    const shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
    return {
      bin: shell,
      args: ['-l'],
      label: shell.split('/').pop() || shell
    }
  }

  private send(channel: string, payload: any): void {
    try {
      if (terminalWindow && !terminalWindow.isDestroyed()) {
        terminalWindow.webContents.send(channel, payload)
      }
    } catch {
    }
  }
}
