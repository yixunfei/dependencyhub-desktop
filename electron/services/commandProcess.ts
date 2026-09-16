import { spawn, type ChildProcess } from 'child_process'
import { CommandOutputDecoder, commandEnv } from './encoding'
import { OperationCancelledError, OperationTimeoutError } from './operationContext'
import { terminateProcessTree } from './processTree'
import type { CommandFailure, LoggedCommandOptions, LoggedCommandResult, ShellFreeCommand } from './commandRunner'

type ProcessOptions = LoggedCommandOptions & { maxBuffer: number; operationId: string }

/** Owns process lifetime and bounded output; logging and history belong to the caller. */
export class CommandProcess {
  private child?: ChildProcess
  private timeout?: NodeJS.Timeout
  private stopping?: Promise<void>
  private stopError?: CommandFailure
  private outputBytes = 0
  private readonly stdoutDecoder = new CommandOutputDecoder()
  private readonly stderrDecoder = new CommandOutputDecoder()
  readonly output: LoggedCommandResult = { stdout: '', stderr: '' }

  constructor(
    private readonly command: ShellFreeCommand,
    private readonly options: ProcessOptions,
    private readonly onOutput: () => void
  ) {}

  async run(): Promise<LoggedCommandResult> {
    if (this.options.signal?.aborted) throw new OperationCancelledError(this.options.operationId)
    try {
      return await this.start()
    } finally {
      if (this.timeout) clearTimeout(this.timeout)
      this.options.signal?.removeEventListener('abort', this.abort)
    }
  }

  private start(): Promise<LoggedCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command.bin, this.command.args, {
        cwd: this.options.cwd || process.cwd(),
        env: commandEnv(this.options.env),
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32'
      })
      this.child = child
      child.stdout?.on('data', (chunk: Buffer) => this.consume('stdout', chunk))
      child.stderr?.on('data', (chunk: Buffer) => this.consume('stderr', chunk))
      child.once('error', reject)
      child.once('close', (code, signal) => {
        void this.complete(code, signal).then(resolve, reject)
      })
      this.options.signal?.addEventListener('abort', this.abort, { once: true })
      if (this.options.timeoutMs && this.options.timeoutMs > 0) {
        this.timeout = setTimeout(() => {
          this.stop(new OperationTimeoutError(this.options.operationId, this.options.timeoutMs!))
        }, this.options.timeoutMs)
      }
    })
  }

  private readonly abort = () => this.stop(new OperationCancelledError(this.options.operationId))

  private stop(error: CommandFailure): void {
    if (this.stopError || !this.child) return
    this.stopError = error
    this.stopping = terminateProcessTree(this.child).catch((terminationError: unknown) => {
      this.stopError = Object.assign(new Error(`${error.message}; ${String(terminationError)}`), {
        category: 'unknown', retryable: false, processTreeStopped: false
      })
      this.child?.kill('SIGKILL')
    })
  }

  private consume(stream: 'stdout' | 'stderr', chunk: Buffer): void {
    if (this.stopError) return
    this.outputBytes += chunk.byteLength
    if (this.outputBytes > this.options.maxBuffer) {
      this.stop(Object.assign(new Error(`Command output exceeded ${this.options.maxBuffer} bytes`), {
        code: 'output-limit'
      }))
      return
    }
    const decoder = stream === 'stdout' ? this.stdoutDecoder : this.stderrDecoder
    this.output[stream] = decoder.write(chunk)
    this.onOutput()
  }

  private async complete(code: number | null, signal: NodeJS.Signals | null): Promise<LoggedCommandResult> {
    await this.stopping
    if (this.stopError) throw this.stopError
    if (code !== 0) {
      throw Object.assign(new Error(this.output.stderr || `Command exited with ${signal || `code ${code}`}`), {
        code: code ?? signal
      })
    }
    return this.output
  }
}
