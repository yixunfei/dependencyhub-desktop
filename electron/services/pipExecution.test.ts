// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PipService } from './pip'
import { runLoggedCommand } from './commandRunner'
import { getToolchainConfig } from './toolchain'

vi.mock('electron', () => ({}))
vi.mock('./commandRunner', () => ({ runLoggedCommand: vi.fn() }))
vi.mock('./toolchain', () => ({ getToolchainConfig: vi.fn() }))
const run = vi.mocked(runLoggedCommand)
const config = vi.mocked(getToolchainConfig)
const service = new PipService()
const roots: string[] = []
beforeEach(() => { run.mockReset(); config.mockReset(); config.mockResolvedValue({}) })
afterEach(async () => { await Promise.all(roots.splice(0).map((p) => rm(p, { recursive: true, force: true }))) })

it.each(['cancelled', 'timeout', 'permission', 'conflict'])('does not retry a %s failure against another Python executable', async (category) => {
  const cwd = await mkdtemp(join(tmpdir(), 'pip-scope-'))
  roots.push(cwd)
  config.mockResolvedValue({ pip: cwd })
  const error = Object.assign(new Error('install failed'), { code: 1, failure: { category }, processTreeStopped: false })
  run.mockRejectedValue(error)
  await expect(service.install({ packageName: 'example', cwd })).rejects.toBe(error)
  expect(run).toHaveBeenCalledTimes(1)
})

it('only tries the next executable when Python cannot start or lacks pip', async () => {
  run.mockRejectedValueOnce(Object.assign(new Error('No module named pip'), { code: 1 }))
  run.mockResolvedValueOnce({ stdout: '[]', stderr: '' })
  await expect(service.list()).resolves.toEqual([])
  expect(run).toHaveBeenCalledTimes(2)
})

it('resolves auxiliary tools beside configured pip instead of running pip with their arguments', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'pip-aux-'))
  roots.push(cwd)
  const configured = join(cwd, 'Scripts', 'pip.exe')
  config.mockResolvedValue({ pip: configured })
  run.mockResolvedValue({ stdout: '[]', stderr: '' })
  await service.dependencyTree(cwd)
  expect(run.mock.calls[0][0]).not.toBe(configured)
  expect(basename(run.mock.calls[0][0])).toContain('pipdeptree')
})

it('does not classify a missing package as a missing Python tool', async () => {
  const error = Object.assign(new Error('Package not found'), { code: 1 })
  run.mockRejectedValue(error)
  await expect(service.install({ packageName: 'does-not-exist' })).rejects.toBe(error)
  expect(run).toHaveBeenCalledTimes(1)
})
