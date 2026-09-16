// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { recoverCommandFailure } from './commandRecovery'

it('does not restore while process tree termination is uncertain', async () => {
  const restore = vi.fn()
  await expect(recoverCommandFailure(
    Object.assign(new Error('termination failed'), { processTreeStopped: false }),
    { path: 'backup' }, restore
  )).rejects.toMatchObject({ restore: { attempted: false, restored: false } })
  expect(restore).not.toHaveBeenCalled()
})

it('keeps the original command failure and backup when restoration conflicts', async () => {
  const error = Object.assign(new Error('command failed'), { failure: { category: 'exit-code' } })
  await expect(recoverCommandFailure(error, { path: 'backup' }, async () => ({ conflicts: [{ file: 'manifest' }] })))
    .rejects.toMatchObject({
      message: 'command failed', backup: { path: 'backup' },
      restore: { attempted: true, restored: false, error: expect.stringContaining('manifest') }
    })
})
