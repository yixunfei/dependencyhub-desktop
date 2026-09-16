import { spawn, type ChildProcess } from 'child_process'

/** Resolve only after tree termination, before releasing a mutation lock or restoring files. */
export async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
    return
  }
  await new Promise<void>((resolve, reject) => {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    })
    killer.once('error', reject)
    killer.once('close', (code) => {
      if (code === 0 || child.exitCode !== null || child.signalCode !== null) resolve()
      else reject(new Error(`Unable to terminate process tree ${child.pid} (taskkill ${code})`))
    })
  })
}
