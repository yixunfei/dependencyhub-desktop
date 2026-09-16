import { CommandProcess } from './commandProcess'
import { createLogId, formatCommand, sendCommandLog } from './commandLogger'
import { recordOperationHistory } from './operationHistory'
import {
  classifyOperationFailure,
  currentOperationContext,
  type OperationFailure
} from './operationContext'

export interface LoggedCommandResult {
  stdout: string
  stderr: string
}

export type CommandFailure = Error & {
  stdout?: string
  stderr?: string
  code?: number | string | null
  failure?: OperationFailure
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

export async function runLoggedCommand(
  bin: string,
  args: string[],
  options: LoggedCommandOptions = {}
): Promise<LoggedCommandResult> {
  const ambient = currentOperationContext()
  const logId = createLogId()
  const command = formatCommand(options.displayBin || bin, args)
  const startedAt = new Date()
  let pendingEmit: NodeJS.Timeout | undefined
  const emit = (status: 'running' | 'success' | 'error') => {
    if (status !== 'running' && pendingEmit) {
      clearTimeout(pendingEmit)
      pendingEmit = undefined
    }
    if (options.log !== false) sendCommandLog(logId, command, processRun.output.stdout, processRun.output.stderr, status)
  }
  const scheduleEmit = () => {
    if (pendingEmit || options.log === false) return
    pendingEmit = setTimeout(() => { pendingEmit = undefined; emit('running') }, 100)
  }
  const processRun = new CommandProcess(resolveShellFreeCommand(bin, args), {
    ...options,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    timeoutMs: options.timeoutMs ?? ambient?.timeoutMs,
    signal: options.signal ?? ambient?.signal,
    operationId: options.operationId ?? ambient?.operationId ?? logId
  }, scheduleEmit)
  const recordHistory = async (status: 'success' | 'error', error?: string) => {
    if (!options.cwd) return
    const finishedAt = new Date()
    try {
      await recordOperationHistory({
        id: logId, command, cwd: options.cwd, status,
        startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(), ...processRun.output, error
      })
    } catch (historyError) {
      console.warn('Unable to record command history:', historyError)
    }
  }
  emit('running')
  try {
    const result = await processRun.run()
    emit('success')
    await recordHistory('success')
    return result
  } catch (cause) {
    const error = (cause instanceof Error ? cause : new Error(String(cause))) as CommandFailure
    Object.assign(error, processRun.output)
    error.failure = classifyOperationFailure(error, options.operationId ?? ambient?.operationId ?? logId)
    emit('error')
    await recordHistory('error', error.message)
    throw error
  } finally {
    if (pendingEmit) clearTimeout(pendingEmit)
  }
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
