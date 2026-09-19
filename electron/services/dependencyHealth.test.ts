// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  shell: { openPath: vi.fn(), openExternal: vi.fn() }
}))

const { runLoggedCommand, resolveToolBin } = vi.hoisted(() => ({
  runLoggedCommand: vi.fn(),
  resolveToolBin: vi.fn(async (tool: string) => tool)
}))

vi.mock('./commandRunner', () => ({ runLoggedCommand }))
vi.mock('./toolchain', () => ({
  resolveToolBin,
  getToolchainConfig: vi.fn(async () => ({})),
  getToolDisplayName: (tool: string) => tool,
  TOOL_NAMES: []
}))

import { DependencyHealthService } from './dependencyHealth'

const directories: string[] = []
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'dh-health-test-'))
  directories.push(directory)
  await writeFile(join(directory, 'package.json'), JSON.stringify({
    name: 'fixture',
    version: '1.0.0',
    dependencies: { absent: '1.0.0' }
  }))
  return directory
}

const npmListOutput = JSON.stringify({
  name: 'fixture',
  dependencies: { absent: { version: '1.0.0' } },
  problems: ['missing: absent@1.0.0, required by fixture@1.0.0']
})

beforeEach(() => {
  runLoggedCommand.mockReset()
  runLoggedCommand.mockImplementation(async (_bin: string, args: string[]) => ({
    stdout: args[0] === 'ls' ? npmListOutput : 'ok',
    stderr: ''
  }))
})

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('dependency health fix allowlist', () => {
  it('rejects a renderer-supplied action that was never produced by a scan', async () => {
    const service = new DependencyHealthService()
    await expect(service.applyFix(await fixture(), {
      id: 'forged',
      label: 'Run anything',
      kind: 'command',
      command: { tool: 'npm', args: ['run', 'evil'] }
    })).rejects.toThrow(/latest dependency health scan/)
    expect(runLoggedCommand).not.toHaveBeenCalled()
  })

  it('executes the scanned command even when the renderer tampers with the args', async () => {
    const cwd = await fixture()
    const service = new DependencyHealthService()
    const scan = await service.scan('npm', cwd)
    const action = scan.issues
      .flatMap((issue) => issue.actions)
      .find((item) => item.kind === 'command' && item.command)
    expect(action).toBeDefined()
    const canonicalArgs = [...action!.command!.args]

    runLoggedCommand.mockClear()
    await service.applyFix(cwd, {
      ...action!,
      command: { tool: 'npm', args: ['run', 'evil'] }
    })

    const executed = runLoggedCommand.mock.calls.map((call) => call[1] as string[])
    expect(executed).toContainEqual(canonicalArgs)
    expect(executed.flat()).not.toContain('evil')
  })

  it('rejects fixes for a project that has not been scanned', async () => {
    const service = new DependencyHealthService()
    await service.scan('npm', await fixture())
    await expect(service.applyFix(await fixture(), {
      id: 'npm-install',
      label: 'Run npm install',
      kind: 'command',
      command: { tool: 'npm', args: ['install', '--legacy-peer-deps'] }
    })).rejects.toThrow(/latest dependency health scan/)
  })
})
