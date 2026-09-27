// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NpmService, classifyNpmDependencies } from './npm'
import { runLoggedCommand } from './commandRunner'
import { acceptsNpmReadExit } from './npmReadResult'

vi.mock('electron', () => ({}))
vi.mock('./commandLogger', () => ({ setCommandLogWindow: vi.fn() }))
vi.mock('./toolchain', () => ({ resolveToolBin: vi.fn(async () => 'configured-npm') }))
vi.mock('./commandRunner', () => ({ runLoggedCommand: vi.fn() }))

const service = new NpmService()
const run = vi.mocked(runLoggedCommand)
const roots: string[] = []
beforeEach(() => { run.mockReset() })
afterEach(async () => { await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))) })

it('accepts only documented npm finding output and exit codes', () => {
  const findings = JSON.stringify({ npm: { current: '11.20.0', wanted: '12.1.0', latest: '12.1.0' } })
  expect(acceptsNpmReadExit('outdated', 1, findings)).toBe(true)
  expect(acceptsNpmReadExit('outdated', 2, findings)).toBe(false)
  expect(acceptsNpmReadExit('outdated', 1, JSON.stringify({ error: { code: 'E401' } }))).toBe(false)
  expect(acceptsNpmReadExit('outdated', 1, 'broken')).toBe(false)
  expect(acceptsNpmReadExit('list', 1, JSON.stringify({ dependencies: {}, error: { code: 'ELSPROBLEMS' } }))).toBe(true)
  expect(acceptsNpmReadExit('list', 1, JSON.stringify({ dependencies: {}, error: { code: 'ENOENT' } }))).toBe(false)
  expect(acceptsNpmReadExit('audit', 1, JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: {} } }))).toBe(true)
  expect(acceptsNpmReadExit('audit', 1, JSON.stringify({ error: { code: 'EAUDITNOLOCK' } }))).toBe(false)
})

it('wires the read policy to global outdated', async () => {
  const stdout = JSON.stringify({ npm: { wanted: '12.1.0', latest: '12.1.0' } })
  run.mockResolvedValue({ stdout, stderr: '' })
  await expect(service.globalOutdated()).resolves.toHaveProperty('npm.latest', '12.1.0')
  const options = run.mock.calls[0][2]!
  expect(options.acceptExitCode?.(1, { stdout, stderr: '' })).toBe(true)
})

it.each(['outdated', 'globalOutdated', 'audit', 'list', 'getProjectDependencyTree', 'getGlobalDependencyTree'] as const)(
  '%s propagates network failures instead of an empty success', async (method) => {
    const error = Object.assign(new Error('network unavailable'), { code: 'ENOTFOUND', failure: { category: 'network' } })
    run.mockRejectedValue(error)
    const call = method === 'list' ? service.list('project', false)
      : method === 'getGlobalDependencyTree' ? service.getGlobalDependencyTree() : service[method]('project')
    await expect(call).rejects.toBe(error)
  }
)

it('rejects malformed successful JSON', async () => {
  run.mockResolvedValue({ stdout: 'not-json', stderr: '' })
  await expect(service.globalOutdated()).rejects.toThrow()
})

it.each([
  ['whoami', () => service.whoami()],
  ['scripts', () => service.getScripts('project')],
  ['package info', () => service.getPackageInfo('pkg')],
  ['dependency tree', () => service.getDependencyTree('pkg')]
] as const)('%s propagates command failures instead of returning empty data', async (_label, operation) => {
  const error = Object.assign(new Error('registry unavailable'), { code: 'ENOTFOUND' })
  run.mockRejectedValue(error)
  await expect(operation()).rejects.toBe(error)
})

it('does not claim that a failed audit fix succeeded', async () => {
  const error = Object.assign(new Error('EACCES'), { code: 1, stdout: 'partial output', stderr: 'permission denied' })
  run.mockRejectedValue(error)
  await expect(service.auditFix('project')).rejects.toBe(error)
})

it('rejects unsupported global audits without launching npm', async () => {
  await expect(service.globalAudit()).rejects.toMatchObject({ code: 'EAUDITGLOBAL' })
  expect(run).not.toHaveBeenCalled()
})

it('checks the configured runtime before npm self-install and refuses incompatible releases', async () => {
  run.mockImplementation(async (_bin, args) => {
    if (args[0] === 'view') return { stdout: JSON.stringify({ version: '12.1.0', engines: { node: '^22.22.2 || ^24.15.0 || >=26.0.0' } }), stderr: '' }
    if (args[0] === 'version') return { stdout: JSON.stringify({ node: '22.17.0', npm: '11.20.0' }), stderr: '' }
    throw new Error('Installation must not run')
  })
  await expect(service.installVersion({ packageName: 'npm', version: '12.1.0', global: true }))
    .rejects.toMatchObject({ code: 'EBADENGINE', message: expect.stringContaining('22.17.0') })
  expect(run.mock.calls.every(([, args]) => args[0] !== 'install')).toBe(true)
})

it('installs a compatible npm release outside the project toolchain', async () => {
  run.mockImplementation(async (_bin, args) => {
    if (args[0] === 'view') return { stdout: JSON.stringify({ version: '11.20.0', engines: { node: '>=22.0.0' } }), stderr: '' }
    if (args[0] === 'version') return { stdout: JSON.stringify({ node: '22.17.0', npm: '11.20.0' }), stderr: '' }
    return { stdout: 'installed', stderr: '' }
  })
  await expect(service.install({ packageName: 'npm', version: '11.20.0', global: true, cwd: 'wrong-project' })).resolves.toBe('installed')
  expect(run.mock.calls.at(-1)?.[1]).toContain('npm@11.20.0')
  expect(run.mock.calls.every(([, , options]) => !options?.cwd)).toBe(true)
})

it('classifies direct dependencies without overwriting them with nested versions', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'npm-direct-deps-'))
  roots.push(cwd)
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ dependencies: { x: '2.0.0', missing: '1.0.0' } }))
  run.mockResolvedValue({ stdout: JSON.stringify({ dependencies: { x: { version: '2.0.0', dependencies: { x: { version: '1.0.0' } } } } }), stderr: '' })
  const result = await service.list(cwd, false)
  expect(result.statuses.x.version).toBe('2.0.0')
  expect(result.statuses.missing.status).toBe('missing')
})

it('recognizes npm missing dependency placeholder objects', () => {
  expect(classifyNpmDependencies({ dependencies: { x: '*' } }, { x: { missing: true } }).x.status).toBe('missing')
})
