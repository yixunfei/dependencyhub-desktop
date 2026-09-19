import { build } from 'esbuild'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-python-manager-verifier-'))
const outputFile = join(workDir, 'python-manager-verifier.mjs')
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

async function fixture(prefix) {
  const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-' + prefix + '-'))
  fixtureRoots.push(cwd)
  return cwd
}

async function createUvFixture() {
  const cwd = await fixture('uv')
  await mkdir(join(cwd, 'packages', 'lib'), { recursive: true })
  await mkdir(join(cwd, '.npmDesktopManager', 'backups', 'stale'), { recursive: true })
  await writeFile(join(cwd, 'pyproject.toml'), [
    '[project]',
    'name = "uv-fixture"',
    'version = "1.0.0"',
    'dependencies = ["requests>=2.31", "httpx[http2]==0.28.1; python_version >= \'3.10\'"]',
    '',
    '[project.optional-dependencies]',
    'test = ["pytest>=8"]',
    '',
    '[dependency-groups]',
    'lint = ["ruff>=0.8"]'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'packages', 'lib', 'pyproject.toml'), [
    '[project]',
    'name = "uv-workspace-lib"',
    'version = "1.0.0"',
    'dependencies = ["orjson>=3.10"]'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, '.npmDesktopManager', 'backups', 'stale', 'pyproject.toml'), [
    '[project]',
    'name = "stale-backup"',
    'version = "1.0.0"',
    'dependencies = ["should-not-be-inventoried==1.0.0"]'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'uv.lock'), [
    'version = 1',
    'revision = 1',
    '',
    '[[package]]',
    'name = "requests"',
    'version = "2.32.3"',
    'source = { registry = "https://pypi.org/simple" }',
    'sdist = { url = "https://files.example/requests.tar.gz", hash = "sha256:requests" }',
    'dependencies = [{ name = "urllib3" }]',
    '',
    '[[package]]',
    'name = "httpx"',
    'version = "0.28.1"',
    'source = { registry = "https://pypi.org/simple" }',
    'wheels = [{ url = "https://files.example/httpx.whl", hash = "sha256:httpx" }]',
    '',
    '[[package]]',
    'name = "urllib3"',
    'version = "2.2.3"',
    'source = { registry = "https://pypi.org/simple" }',
    'wheels = [{ url = "https://files.example/urllib3.whl", hash = "sha256:urllib3" }]',
    '',
    '[[package]]',
    'name = "orjson"',
    'version = "3.10.12"',
    'source = { registry = "https://pypi.org/simple" }',
    'wheels = [{ url = "https://files.example/orjson.whl", hash = "sha256:orjson" }]'
  ].join('\n'), 'utf-8')
  return cwd
}

async function createPoetryFixture() {
  const cwd = await fixture('poetry')
  await writeFile(join(cwd, 'pyproject.toml'), [
    '[tool.poetry]',
    'name = "poetry-fixture"',
    'version = "1.0.0"',
    '',
    '[tool.poetry.dependencies]',
    'python = "^3.12"',
    'fastapi = "^0.115"',
    '',
    '[tool.poetry.group.dev.dependencies]',
    'pytest = "^8.3"'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'poetry.lock'), [
    '[[package]]',
    'name = "fastapi"',
    'version = "0.115.6"',
    'category = "main"',
    'optional = false',
    'python-versions = ">=3.8"',
    'files = [{ file = "fastapi.whl", hash = "sha256:fastapi" }]',
    '',
    '[[package]]',
    'name = "starlette"',
    'version = "0.41.3"',
    'category = "main"',
    'optional = false',
    'python-versions = ">=3.8"',
    'files = [{ file = "starlette.whl", hash = "sha256:starlette" }]',
    '',
    '[metadata]',
    'lock-version = "2.1"',
    'content-hash = "fixture-hash"'
  ].join('\n'), 'utf-8')
  return cwd
}

async function createPipenvFixture() {
  const cwd = await fixture('pipenv')
  await writeFile(join(cwd, 'Pipfile'), [
    '[[source]]',
    'name = "pypi"',
    'url = "https://pypi.org/simple"',
    'verify_ssl = true',
    '',
    '[packages]',
    'flask = "==3.1.0"',
    '',
    '[dev-packages]',
    'ruff = "*"'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'Pipfile.lock'), {
    _meta: { hash: { sha256: 'pipfile-fixture' }, requires: { python_version: '3.12' } },
    default: {
      flask: { version: '==3.1.0', hashes: ['sha256:flask'], index: 'pypi' },
      itsdangerous: { version: '==2.2.0', hashes: ['sha256:itsdangerous'] }
    },
    develop: { ruff: { version: '==0.8.4', hashes: ['sha256:ruff'] } }
  })
  return cwd
}

async function createCondaFixture() {
  const cwd = await fixture('conda')
  await writeFile(join(cwd, 'environment.yml'), [
    'name: conda-fixture',
    'channels:',
    '  - conda-forge',
    'dependencies:',
    '  - python=3.12',
    '  - numpy=2.1.3',
    '  - scipy>=1.13',
    '  - pandas==2.2',
    '  - conda-forge::libblas=3.9=31_h641d27c_mkl',
    '  - pip:',
    '      - httpx==0.28.1'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'conda-lock.yml'), [
    'version: 1',
    'package:',
    '  - name: python',
    '    version: 3.12.8',
    '    manager: conda',
    '    platform: win-64',
    '    url: https://conda.example/python.tar.bz2',
    '    hash: { sha256: python-hash }',
    '  - name: numpy',
    '    version: 2.1.3',
    '    manager: conda',
    '    platform: win-64',
    '    url: https://conda.example/numpy.tar.bz2',
    '    hash: { sha256: numpy-hash }',
    '  - name: httpx',
    '    version: 0.28.1',
    '    manager: pip',
    '    platform: win-64',
    '    url: https://files.example/httpx.whl',
    '    hash: { sha256: httpx-hash }'
  ].join('\n'), 'utf-8')
  return cwd
}

async function withRegistryServer(run) {
  const requests = []
  const server = createServer((request, response) => {
    requests.push(request.url || '')
    response.setHeader('content-type', 'application/json')
    if ((request.url || '').startsWith('/pypi/httpx/json')) {
      response.end(JSON.stringify({
        info: { name: 'httpx', version: '0.28.1', summary: 'HTTP client', package_url: 'https://pypi.org/project/httpx', license_expression: 'BSD-3-Clause' },
        releases: { '0.28.1': [] },
        urls: [{ upload_time_iso_8601: '2026-01-01T00:00:00Z' }]
      }))
      return
    }
    response.end(JSON.stringify([{ name: 'numpy', full_name: 'conda-forge/numpy', latest_version: '2.1.3', summary: 'Array computing', owner: 'conda-forge', ndownloads: 100 }]))
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  try {
    const address = server.address()
    await run('http://127.0.0.1:' + address.port, requests)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function verifyInventoryAndPlans(service, roots) {
  const descriptors = new Map(service.descriptors().map((descriptor) => [descriptor.managerId, descriptor]))
  for (const managerId of ['uv', 'poetry', 'pipenv', 'conda']) {
    const descriptor = descriptors.get(managerId)
    assert(descriptor?.status === 'preview', managerId + ' uses the preview adapter')
    assert(descriptor?.capabilities.search && descriptor?.capabilities.health, managerId + ' exposes search and health')
  }

  const uv = await service.inventory(roots.uv, 'uv')
  assert(uv.some((item) => item.name === 'requests' && item.resolvedVersion === '2.32.3' && item.direct), 'uv merges PEP 621 requirements with uv.lock')
  assert(uv.some((item) => item.name === 'urllib3' && !item.direct), 'uv inventories transitive lock packages')
  assert(uv.some((item) => item.name === 'ruff' && item.scope === 'lint'), 'uv inventories PEP 735 dependency groups')
  assert(uv.some((item) => item.name === 'orjson' && item.file === 'packages/lib/pyproject.toml' && item.resolvedVersion === '3.10.12'), 'uv inventories nested workspace pyprojects')
  assert(!uv.some((item) => item.name === 'should-not-be-inventoried'), 'workspace inventory ignores generated DependencyHub backup directories')

  const poetry = await service.inventory(roots.poetry, 'poetry')
  assert(poetry.some((item) => item.name === 'fastapi' && item.resolvedVersion === '0.115.6'), 'Poetry merges grouped pyproject dependencies with poetry.lock')
  assert(poetry.some((item) => item.name === 'starlette' && !item.direct), 'Poetry inventories transitive lock packages')

  const pipenv = await service.inventory(roots.pipenv, 'pipenv')
  assert(pipenv.some((item) => item.name === 'flask' && item.resolvedVersion === '3.1.0'), 'Pipenv merges Pipfile with Pipfile.lock')
  assert(pipenv.some((item) => item.name === 'itsdangerous' && !item.direct), 'Pipenv inventories transitive lock packages')

  const conda = await service.inventory(roots.conda, 'conda')
  assert(conda.some((item) => item.name === 'numpy' && item.resolvedVersion === '2.1.3'), 'Conda merges environment.yml with conda-lock')
  assert(conda.some((item) => item.name === 'httpx' && item.scope === 'pip'), 'Conda inventories nested pip dependencies')
  assert(conda.some((item) => item.name === 'scipy' && item.requestedVersion === '>=1.13'), 'Conda preserves comparison version constraints')
  assert(conda.some((item) => item.name === 'pandas' && item.requestedVersion === '==2.2'), 'Conda preserves double-equals version constraints')
  assert(conda.some((item) => item.name === 'libblas' && item.requestedVersion === '3.9' && item.metadata?.build === '31_h641d27c_mkl' && item.source === 'conda-forge'), 'Conda separates channel, exact version, and build selectors')

  const uvPlan = await service.plan(roots.uv, 'uv', { operation: 'install', packageName: 'httpx', version: '0.28.1', dev: true })
  assert(uvPlan.command === 'uv add httpx==0.28.1 --dev', 'uv builds version-aware development add plans')
  assert(uvPlan.backupFiles.some((item) => item.file === 'packages/lib/pyproject.toml'), 'uv plans back up nested workspace manifests')
  assert(!uvPlan.backupFiles.some((item) => item.file.includes('.npmDesktopManager')), 'operation plans exclude generated DependencyHub files from backup previews')
  const poetryPlan = await service.plan(roots.poetry, 'poetry', { operation: 'update', packageName: 'fastapi' })
  assert(poetryPlan.dryRunCommand === 'poetry update fastapi --dry-run', 'Poetry exposes a native dry-run update plan')
  const condaPlan = await service.plan(roots.conda, 'conda', { operation: 'outdated' })
  assert(condaPlan.command === 'conda update --all --dry-run' && !condaPlan.mutating, 'Conda outdated uses a non-mutating update preview')
}

async function verifySearchAndHealth(service, roots) {
  await withRegistryServer(async (registry, requests) => {
    const pypi = await service.search(roots.uv, 'uv', { text: 'httpx', registry })
    assert(pypi[0]?.name === 'httpx' && pypi[0]?.version === '0.28.1', 'PyPI package metadata maps to shared search results')
    const conda = await service.search(roots.conda, 'conda', { text: 'numpy', registry, limit: 5 })
    assert(conda[0]?.name === 'numpy' && conda[0]?.version === '2.1.3', 'Anaconda search maps package metadata')
    assert(requests.some((url) => url.includes('/pypi/httpx/json')), 'PyPI search uses the package JSON endpoint')
    assert(requests.some((url) => url.includes('/search?') && url.includes('q=numpy')), 'Conda search encodes the query')
  })
  let pythonCredentialsRejected = false
  try {
    await service.search(roots.uv, 'uv', { text: 'httpx', registry: 'https://user:secret@example.test' })
  } catch (error) {
    pythonCredentialsRejected = /embedded credentials/i.test(error?.message || '')
  }
  assert(pythonCredentialsRejected, 'Python registry URLs reject embedded credentials before searching')

  const poetryHealth = await service.health(roots.poetry, 'poetry')
  assert(!poetryHealth.findings.some((item) => item.id.startsWith('poetry-content-hash-missing')), 'Poetry health accepts a content-hashed lockfile')
  const pipenvHealth = await service.health(roots.pipenv, 'pipenv')
  assert(!pipenvHealth.findings.some((item) => item.id.startsWith('pipenv-lock-hash-missing')), 'Pipenv health accepts a manifest-hashed lockfile')
}

async function main() {
  const service = new ManagerWorkspaceService()
  const roots = {
    uv: await createUvFixture(),
    poetry: await createPoetryFixture(),
    pipenv: await createPipenvFixture(),
    conda: await createCondaFixture()
  }
  try {
    await verifyInventoryAndPlans(service, roots)
    await verifySearchAndHealth(service, roots)
    console.log('python manager verification passed (' + checks.length + ' checks)')
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
      sourcefile: 'python-manager-verifier.ts',
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
        name: 'python-manager-verifier-stubs',
        setup(buildApi) {
          buildApi.onResolve({ filter: /^\.\/(toolchain|commandRunner)$/ }, (args) => {
            if (!args.importer.endsWith('extendedManager.ts')) return undefined
            return { path: args.path, namespace: 'python-manager-verifier-stub' }
          })
          buildApi.onLoad({ filter: /.*/, namespace: 'python-manager-verifier-stub' }, (args) => {
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
