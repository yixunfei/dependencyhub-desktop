// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { runLoggedCommand } from './commandRunner'
import { sendCommandLog } from './commandLogger'
import { acceptsNpmReadExit } from './npmReadResult'

vi.mock('./commandLogger', () => ({
  createLogId: () => 'test', formatCommand: (bin: string) => bin, sendCommandLog: vi.fn()
}))
vi.mock('./operationHistory', () => ({ recordOperationHistory: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('records validated outdated findings as successful despite exit 1', async () => {
  const payload = { npm: { current: '11.20.0', wanted: '12.1.0', latest: '12.1.0' } }
  const script = `process.stdout.write(${JSON.stringify(JSON.stringify(payload))}); process.exitCode = 1`
  const result = await runLoggedCommand(process.execPath, ['-e', script], {
    acceptExitCode: (code, output) => acceptsNpmReadExit('outdated', code, output.stdout)
  })
  expect(JSON.parse(result.stdout)).toEqual(payload)
  expect(vi.mocked(sendCommandLog).mock.calls.at(-1)?.[4]).toBe('success')
})

it.each([1, 2])('keeps real command failures visible with exit %s', async (code) => {
  const payload = JSON.stringify({ error: { code: 'E401' } })
  const script = `process.stdout.write(${JSON.stringify(payload)}); process.exitCode = ${code}`
  await expect(runLoggedCommand(process.execPath, ['-e', script], {
    acceptExitCode: (exitCode, output) => acceptsNpmReadExit('outdated', exitCode, output.stdout)
  })).rejects.toMatchObject({ code })
  expect(vi.mocked(sendCommandLog).mock.calls.at(-1)?.[4]).toBe('error')
})

it('never treats cancellation as a successful diagnostic result', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(runLoggedCommand(process.execPath, ['-e', ''], {
    signal: controller.signal, acceptExitCode: () => true
  })).rejects.toMatchObject({ category: 'cancelled' })
})
