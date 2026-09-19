import { CommandProcess } from './commandProcess'
import { commandLimiter } from './concurrency'
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

/**
 * Commands launched outside any operation context (plain read IPC handlers)
 * previously had no timeout at all: a hung child (slow network mount, dead
 * lock, first-time plugin download) kept the renderer request pending forever
 * with no way to cancel it. The ambient context remains authoritative — an
 * ambient context with timeoutMs undefined (explicit null disable) stays
 * unlimited.
 */
const AMBIENTLESS_COMMAND_TIMEOUT_MS = 3 * 60 * 1000

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
  /**
   * Windows cmd.exe wrappers must be spawned with windowsVerbatimArguments:
   * libuv would otherwise re-quote the /c payload per MSVCRT rules (inner "
   * becomes \"), and cmd.exe does not treat backslash as an escape character,
   * so formatCmdArg's quoting would never survive to the child process.
   */
  windowsVerbatimArguments?: boolean
}

export function resolveShellFreeCommand(bin: string, args: string[]): ShellFreeCommand {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin)) {
    // Mirror node's own shell:true implementation: wrap the whole command line
    // in one extra pair of quotes and pass the argv verbatim. cmd.exe /S then
    // strips the outer quotes and executes the payload exactly as formatted.
    return {
      bin: 'cmd.exe',
      args: ['/d', '/s', '/c', `"${formatCmdCommand(bin, args)}"`],
      windowsVerbatimArguments: true
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
    timeoutMs: options.timeoutMs ?? (ambient ? ambient.timeoutMs : AMBIENTLESS_COMMAND_TIMEOUT_MS),
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
    // Command spawning shares one budget so a burst of explorer reads cannot
    // push an in-flight install into swap; nested calls are detected by the
    // limiter itself and never queue against their own parent.
    const result = await commandLimiter.run(() => processRun.run())
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

  if (/[\r\n]/.test(arg)) {
    // Stripping newlines silently changed the argument's meaning. Callers pass
    // package names, versions and flags that never contain line breaks, so a
    // newline here indicates a caller bug and must fail loudly.
    throw new Error('Command arguments must not contain line breaks')
  }

  if (!/[\s"&|<>()^%]/.test(arg)) return arg

  // cmd.exe does not treat backslash as an escape character, so an embedded "
  // flips the quoting state and lets the rest of the argument escape the quotes.
  // Arguments are package names, versions and paths, which can never contain a
  // quote on Windows, so this indicates a caller bug and must fail loudly.
  if (arg.includes('"')) {
    throw new Error('Command arguments must not contain double quotes')
  }

  // cmd.exe does not interpret ^ inside double quotes, so quoted content must
  // stay ^-free. %VAR% expands even inside quotes, so each % is emitted as ^%
  // in a short unquoted gap between quoted segments: "abc"^%"def" -> abc%def.
  return `"${arg.replace(/%/g, '"^%"')}"`
}
