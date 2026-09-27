// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checkTool } from './toolchain'
import { runLoggedCommand } from './commandRunner'

const config = vi.hoisted(() => ({ root: '' }))
vi.mock('electron', () => ({ app: { getPath: () => config.root }, shell: {} }))
vi.mock('./commandRunner', () => ({ runLoggedCommand: vi.fn() }))
beforeEach(async () => {
  config.root = await mkdtemp(join(tmpdir(), 'toolchain-test-'))
  vi.mocked(runLoggedCommand).mockReset().mockResolvedValue({ stdout: '1.0.0', stderr: '' })
})
afterEach(async () => { await rm(config.root, { recursive: true, force: true }) })

it.each([['go', ['version']], ['helm', ['version', '--short']], ['gradle', ['--version']]] as const)(
  'uses the actual %s version command and project directory', async (tool, args) => {
    expect((await checkTool(tool, config.root)).available).toBe(true)
    expect(runLoggedCommand).toHaveBeenCalledWith(expect.any(String), args, expect.objectContaining({ cwd: config.root }))
  }
)

it('checks pip through a configured Python executable', async () => {
  const python = join(config.root, process.platform === 'win32' ? 'python.exe' : 'python')
  await writeFile(python, '')
  await writeFile(join(config.root, 'toolchain.json'), JSON.stringify({ pip: python }))
  await checkTool('pip')
  expect(runLoggedCommand).toHaveBeenCalledWith(python, ['--version'], expect.any(Object))
})
