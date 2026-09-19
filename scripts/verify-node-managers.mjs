import { build } from 'esbuild'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-node-manager-verifier-'))
const outputFile = join(workDir, 'node-manager-verifier.mjs')
const runner = String.raw`
import { createServer } from 'http'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ManagerWorkspaceService } from './electron/services/managerWorkspace'

const fixtureRoots = []
const checks = []

function assert(condition, message) {
  if (!condition) throw new Error(message)
  checks.push(message)
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf-8')
}

async function createPnpmFixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-pnpm-'))
  fixtureRoots.push(cwd)
  await mkdir(join(cwd, 'apps', 'web'), { recursive: true })
  await writeJson(join(cwd, 'package.json'), {
    name: 'pnpm-root',
    version: '1.0.0',
    packageManager: 'pnpm@11.0.0',
    workspaces: ['apps/*'],
    dependencies: { react: '^19.0.0' }
  })
  await writeJson(join(cwd, 'apps', 'web', 'package.json'), {
    name: '@fixture/web',
    version: '1.0.0',
    dependencies: { lodash: '^4.17.0' }
  })
  await writeFile(join(cwd, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n", 'utf-8')
  await writeFile(join(cwd, 'pnpm-lock.yaml'), [
    "lockfileVersion: '9.0'",
    'packages:',
    '  react@19.2.0:',
    '    resolution: {integrity: sha512-react}',
    '  react@18.3.1:',
    '    resolution: {integrity: sha512-react-old}',
    '  lodash@4.17.21:',
    '    resolution: {integrity: sha512-lodash}',
    '  kleur@4.1.5:',
    '    resolution: {integrity: sha512-kleur}'
  ].join('\n'), 'utf-8')
  return cwd
}

async function createYarnFixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-yarn-'))
  fixtureRoots.push(cwd)
  await writeJson(join(cwd, 'package.json'), {
    name: 'yarn-app',
    version: '1.0.0',
    packageManager: 'yarn@4.6.0',
    dependencies: { lodash: '^4.17.0' }
  })
  await writeFile(join(cwd, '.yarnrc.yml'), 'nodeLinker: node-modules\n', 'utf-8')
  await writeFile(join(cwd, 'yarn.lock'), [
    '__metadata:',
    '  version: 8',
    '  cacheKey: 10c0',
    '',
    '"lodash@npm:^4.17.0":',
    '  version: 4.17.21',
    '  resolution: "lodash@npm:4.17.21"',
    '  checksum: 10c0/test'
  ].join('\n'), 'utf-8')
  return cwd
}

async function createBunFixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-bun-'))
  fixtureRoots.push(cwd)
  await writeJson(join(cwd, 'package.json'), {
    name: 'bun-app',
    version: '1.0.0',
    packageManager: 'bun@1.2.0',
    dependencies: { zod: '^3.24.0' }
  })
  await writeFile(join(cwd, 'bun.lock'), [
    '{',
    '  "lockfileVersion": 1,',
    '  "packages": {',
    '    "zod": ["zod@3.24.2", "", {}],',
    '    "tiny-invariant": ["tiny-invariant@1.3.3", "", {}],',
    '  },',
    '}'
  ].join('\n'), 'utf-8')
  return cwd
}

async function withRegistryServer(run) {
  let requestUrl = ''
  const server = createServer((request, response) => {
    requestUrl = request.url || ''
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({
      objects: [{
        package: {
          name: '@scope/example',
          version: '2.1.0',
          description: 'fixture package',
          links: { npm: 'https://www.npmjs.com/package/@scope/example' },
          publisher: { username: 'fixture' },
          date: '2026-01-01T00:00:00.000Z'
        },
        score: { final: 0.9 }
      }]
    }))
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  try {
    const address = server.address()
    await run('http://127.0.0.1:' + address.port, () => requestUrl)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function verifyWorkspace(service, pnpmRoot, yarnRoot, bunRoot) {
  const descriptors = new Map(service.descriptors().map((descriptor) => [descriptor.managerId, descriptor]))
  for (const managerId of ['pnpm', 'yarn', 'bun']) {
    const descriptor = descriptors.get(managerId)
    assert(descriptor?.status === 'preview', managerId + ' uses the preview adapter')
    assert(descriptor?.capabilities.search && descriptor?.capabilities.health, managerId + ' exposes search and health capabilities')
  }

  const pnpm = await service.inventory(pnpmRoot, 'pnpm')
  assert(pnpm.some((item) => item.name === 'react' && item.resolvedVersion === '19.2.0' && item.file === 'package.json'), 'pnpm resolves root manifest dependencies from pnpm-lock.yaml')
  assert(pnpm.some((item) => item.name === 'lodash' && item.resolvedVersion === '4.17.21' && item.file === 'apps/web/package.json'), 'pnpm inventories package.json workspace dependencies')
  assert(pnpm.some((item) => item.name === 'kleur' && item.type === 'transitive-lock'), 'pnpm inventories transitive lockfile dependencies')

  const yarn = await service.inventory(yarnRoot, 'yarn')
  assert(yarn.some((item) => item.name === 'lodash' && item.resolvedVersion === '4.17.21'), 'Yarn parses modern yarn.lock resolutions')
  const yarnUpdate = await service.plan(yarnRoot, 'yarn', { operation: 'update', packageName: 'lodash' })
  assert(yarnUpdate.command === 'yarn up lodash', 'Yarn modern projects use the up command')
  const yarnOutdated = await service.plan(yarnRoot, 'yarn', { operation: 'outdated' })
  assert(yarnOutdated.requirements.length === 1, 'Yarn modern bulk outdated checks require an explicit package')

  const bun = await service.inventory(bunRoot, 'bun')
  assert(bun.some((item) => item.name === 'zod' && item.resolvedVersion === '3.24.2'), 'Bun parses direct text lockfile resolutions')
  assert(bun.some((item) => item.name === 'tiny-invariant' && item.type === 'transitive-lock'), 'Bun parses transitive text lockfile dependencies')

  const pnpmPlan = await service.plan(pnpmRoot, 'pnpm', { operation: 'install', packageName: 'vitest', version: '3.0.0', dev: true })
  assert(pnpmPlan.command === 'pnpm add vitest@3.0.0 -D', 'pnpm builds version-aware add plans')
  assert(pnpmPlan.dryRunCommand === 'pnpm add vitest@3.0.0 -D --dry-run', 'pnpm exposes its native dry-run plan')
  assert(pnpmPlan.backupFiles.some((item) => item.file === 'pnpm-lock.yaml'), 'pnpm previews lockfile backups before mutation')

  const health = await service.health(pnpmRoot, 'pnpm')
  assert(health.findings.some((item) => item.id === 'version-conflict:react'), 'pnpm health reports conflicting locked dependency versions')
  const mismatch = await service.health(pnpmRoot, 'yarn')
  assert(mismatch.findings.some((item) => item.id === 'package-manager-mismatch'), 'Node health reports package manager declaration mismatches')
  assert(mismatch.findings.some((item) => item.id === 'competing-lockfiles'), 'Node health reports competing lockfiles')
}

async function verifySearch(service, cwd) {
  await withRegistryServer(async (registry, requestedUrl) => {
    await writeFile(join(cwd, '.npmrc'), '@scope:registry=' + registry + '/\n', 'utf-8')
    const results = await service.search(cwd, 'pnpm', { text: '@scope/example', limit: 7 })
    assert(results[0]?.name === '@scope/example' && results[0]?.version === '2.1.0', 'Node registry search maps package metadata')
    assert(requestedUrl().includes('text=%40scope%2Fexample') && requestedUrl().includes('size=7'), 'Node registry search encodes query and limit')
  })

  let nodeCredentialsRejected = false
  try {
    await service.search(cwd, 'pnpm', { text: 'test', registry: 'https://user:secret@example.test' })
  } catch (error) {
    nodeCredentialsRejected = /embedded credentials/i.test(error?.message || '')
  }
  assert(nodeCredentialsRejected, 'Registry URLs reject embedded credentials before searching')
}

async function main() {
  const service = new ManagerWorkspaceService()
  const pnpmRoot = await createPnpmFixture()
  const yarnRoot = await createYarnFixture()
  const bunRoot = await createBunFixture()
  try {
    await verifyWorkspace(service, pnpmRoot, yarnRoot, bunRoot)
    await verifySearch(service, pnpmRoot)
    console.log('node manager verification passed (' + checks.length + ' checks)')
  } finally {
    await Promise.all(fixtureRoots.map((root) => rm(root, { recursive: true, force: true })))
  }
}

await main()
`

try {
  await build({
    stdin: {
      contents: runner,
      resolveDir: process.cwd(),
      sourcefile: 'node-manager-verifier.ts',
      loader: 'ts'
    },
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
    },
    plugins: [
      {
        name: 'node-manager-verifier-stubs',
        setup(buildApi) {
          buildApi.onResolve({ filter: /^\.\/(toolchain|commandRunner)$/ }, (args) => {
            if (!args.importer.endsWith('extendedManager.ts')) return undefined
            return { path: args.path, namespace: 'node-manager-verifier-stub' }
          })
          buildApi.onLoad({ filter: /.*/, namespace: 'node-manager-verifier-stub' }, (args) => {
            if (args.path === './toolchain') {
              return {
                loader: 'ts',
                contents: "export type ToolName = string; export async function resolveToolBin(tool: string) { return tool; }"
              }
            }
            return {
              loader: 'ts',
              contents: "export async function runLoggedCommand() { return { stdout: '', stderr: '' }; }"
            }
          })
        }
      }
    ]
  })
  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(workDir, { recursive: true, force: true })
}
