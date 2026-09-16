interface RecoverableCommandError extends Error {
  processTreeStopped?: boolean
}

/** Restore only declared project files, after the command runner has stopped the process tree. */
export async function recoverCommandFailure<Backup extends { path: string }>(
  cause: unknown,
  backup: Backup | undefined,
  restore: (path: string) => Promise<{ conflicts: Array<{ file: string }> }>
): Promise<never> {
  const error = (cause instanceof Error ? cause : new Error(String(cause))) as RecoverableCommandError
  if (!backup || error.processTreeStopped === false) {
    throw Object.assign(error, {
      backup,
      restore: {
        attempted: false, restored: false,
        error: error.processTreeStopped === false ? 'Process tree termination failed; automatic restoration was skipped.' : undefined
      }
    })
  }
  let recovery: { attempted: boolean; restored: boolean; error?: string }
  try {
    const result = await restore(backup.path)
    if (result.conflicts.length) throw new Error(`Backup restore conflicted on: ${result.conflicts.map(({ file }) => file).join(', ')}`)
    recovery = { attempted: true, restored: true }
  } catch (restoreError) {
    recovery = { attempted: true, restored: false, error: String(restoreError) }
  }
  throw Object.assign(error, { backup, restore: recovery })
}
