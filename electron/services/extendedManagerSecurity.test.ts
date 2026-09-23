// @vitest-environment node
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, it, vi } from 'vitest'
import { ExtendedManagerService } from './extendedManager'

vi.mock('./toolchain', () => ({ resolveToolBin: async (tool: string) => tool }))
vi.mock('./commandRunner', () => ({ runLoggedCommand: vi.fn() }))

it('escapes user input in actual R and Julia operation plans', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'interpreter-plan-'))
  try {
    const service = new ExtendedManagerService()
    const r = await service.plan(cwd, 'renv', { operation: 'install', packageName: 'x"); system("injected")' })
    expect(r.args.join(' ')).toContain('x\\"); system(\\"injected\\")')
    const julia = await service.plan(cwd, 'julia', { operation: 'install', packageName: '$(run(`injected`))', version: '1.0.0' })
    expect(julia.args.join(' ')).toContain('\\$(run(`injected`))')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
