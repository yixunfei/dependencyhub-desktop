import { spawn } from 'child_process'
import { createLogId, formatCommand, sendCommandLog } from './commandLogger'
import { CommandOutputDecoder, commandEnv } from './encoding'
import { recordOperationHistory } from './operationHistory'

export interface LoggedCommandResult {
  stdout: string
  stderr: string
}

export interface LoggedCommandOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  displayBin?: string
  maxBuffer?: number
  timeoutMs?: number
  signal?: AbortSignal
  operationId?: string
  log?: boolean
}

export interface ShellFreeCommand {
  bin: string
  args: string[]
}

export function resolveShellFreeCommand(bin: string, args: string[]): ShellFreeCommand {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin)) {
    return {
      bin: 'cmd.exe',
      args: ['/d', '/s', '/c', formatCmdCommand(bin, args)]
    }
  }

  return { bin, args }
}

export function runLoggedCommand(
  bin: string,
  args: string[],
  options: LoggedCommandOptions = {}
): Promise<LoggedCommandResult> {
  const {
    cwd,
    env,
    displayBin = bin,
    maxBuffer = 1024 * 1024 * 10,
    timeoutMs,
    signal,
    operationId,
    log = true
  } = options
  const logId = createLogId()
  const command = formatCommand(displayBin, args)
  const startedAt = new Date()
  const stdoutDecoder = new CommandOutputDecoder()
  const stderrDecoder = new CommandOutputDecoder()
  let stdout = ''
  let stderr = ''
  let settled = false
  let lastEmitAt = 0
  let pendingEmit: NodeJS.Timeout | null = null

  const emit = (status: 'running' | 'success' | 'error') => {
    if (!log) return
    lastEmitAt = Date.now()
    sendCommandLog(logId, command, stdout, stderr, status)
  }

  const scheduleEmit = () => {
    if (!log) return
    const now = Date.now()
    if (now - lastEmitAt > 100) {
      emit('running')
      return
    }
    if (!pendingEmit) {
      pendingEmit = setTimeout(() => {
        pendingEmit = null
        emit('running')
      }, 100)
    }
  }

  emit('running')

  const recordHistory = async (status: 'success' | 'error', error?: string, code?: number | string | null) => {
    if (!cwd) return
    const finishedAt = new Date()
    await recordOperationHistory({
      id: logId,
      command,
      cwd,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      stdout,
      stderr,
      error: error || (code === undefined || code === 0 || code === null ? undefined : `Command exited with code ${code}`)
    })
  }

  return new Promise((resolve, reject) => {
    const spawnCommand = resolveShellFreeCommand(bin, args)
    const child = spawn(spawnCommand.bin, spawnCommand.args, {
      cwd: cwd || process.cwd(),
      env: commandEnv(env),
      shell: false,
      windowsHide: true
    })
    let timeout: NodeJS.Timeout | undefined
    const fail = (error: Error & { stdout?: string; stderr?: string; code?: number | string }) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', abort)
      if (pendingEmit) clearTimeout(pendingEmit)
      error.stdout = stdout
      error.stderr = stderr
      emit('error')
      void recordHistory('error', error.message, error.code)
      reject(error)
    }
    const abort = () => { child.kill(); fail(new Error(`Operation ${operationId || logId} was cancelled`)) }
    if (signal) {
      if (signal.aborted) abort()
      else signal.addEventListener('abort', abort, { once: true })
    }
    if (timeoutMs !== undefined && timeoutMs > 0) timeout = setTimeout(() => { child.kill(); fail(new Error(`Operation ${operationId || logId} timed out after ${timeoutMs} ms`)) }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = stdoutDecoder.write(chunk)
      if (stdout.length + stderr.length > maxBuffer) {
        child.kill()
        fail(new Error(`Command output exceeded ${Math.round(maxBuffer / 1024 / 1024)}MB`))
        return
      }
      scheduleEmit()
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = stderrDecoder.write(chunk)
      if (stdout.length + stderr.length > maxBuffer) {
        child.kill()
        fail(new Error(`Command output exceeded ${Math.round(maxBuffer / 1024 / 1024)}MB`))
        return
      }
      scheduleEmit()
    })

    child.on('error', (error: Error & { code?: string }) => {
      fail(error)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', abort)
      if (pendingEmit) clearTimeout(pendingEmit)

      if (code === 0) {
        emit('success')
        void recordHistory('success')
        resolve({ stdout, stderr })
        return
      }

      const error = new Error(stderr || `Command exited with code ${code}`) as Error & {
        stdout?: string
        stderr?: string
        code?: number | null
      }
      error.stdout = stdout
      error.stderr = stderr
      error.code = code
      emit('error')
      void recordHistory('error', error.message, code)
      reject(error)
    })
  })
}

function formatCmdCommand(bin: string, args: string[]): string {
  return [bin, ...args].map(formatCmdArg).join(' ')
}

function formatCmdArg(arg: string): string {
  if (arg.length === 0) return '""'

  const safe = arg.replace(/[\r\n]/g, '')
  const escaped = safe
    .replace(/\^/g, '^^')
    .replace(/"/g, '\\"')
    .replace(/[&|<>()]/g, '^$&')

  return /\s|["&|<>()^]/.test(safe) ? `"${escaped}"` : escaped
}
