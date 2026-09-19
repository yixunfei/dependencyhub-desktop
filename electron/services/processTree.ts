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
    await waitForExit(child)
    return
  }
  await new Promise<void>((resolve, reject) => {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    })
    killer.once('error', reject)
    killer.once('close', (code) => {
      if (code !== 0 && child.exitCode === null && child.signalCode === null) {
        reject(new Error(`Unable to terminate process tree ${child.pid} (taskkill ${code})`))
        return
      }
      void waitForExit(child).then(resolve, reject)
    })
  })
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for process ${child.pid ?? 'unknown'} to exit`))
    }, 5000)
    const onClose = () => {
      cleanup()
      resolve()
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      child.removeListener('close', onClose)
      child.removeListener('error', onError)
    }
    child.once('close', onClose)
    child.once('error', onError)
  })
}
