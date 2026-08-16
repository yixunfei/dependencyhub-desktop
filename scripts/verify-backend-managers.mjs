import { build } from 'esbuild'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-backend-manager-verifier-'))
const outputFile = join(workDir, 'backend-manager-verifier.mjs')
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

async function createNugetFixture() {
  const cwd = await fixture('nuget')
  await mkdir(join(cwd, 'src', 'App'), { recursive: true })
  await writeFile(join(cwd, 'Directory.Packages.props'), [
    '<Project>',
    '  <ItemGroup>',
    '    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />',
    '  </ItemGroup>',
    '</Project>'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'src', 'App', 'App.csproj'), [
    '<Project Sdk="Microsoft.NET.Sdk">',
    '  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>',
    '  <ItemGroup>',
    '    <PackageReference Include="Newtonsoft.Json" />',
    '  </ItemGroup>',
    '</Project>'
  ].join('\n'), 'utf-8')
  await writeJson(join(cwd, 'src', 'App', 'packages.lock.json'), {
    version: 1,
    dependencies: {
      'net8.0': {
        'Newtonsoft.Json': { type: 'Direct', requested: '[13.0.3, )', resolved: '13.0.3', contentHash: 'sha512-newtonsoft' },
        'Microsoft.Bcl.AsyncInterfaces': { type: 'Transitive', resolved: '8.0.0', contentHash: 'sha512-bcl' }
      }
    }
  })
  return cwd
}

async function createComposerFixture() {
  const cwd = await fixture('composer')
  await writeJson(join(cwd, 'composer.json'), {
    require: { php: '^8.3', 'monolog/monolog': '^3.0' },
    'require-dev': { 'phpunit/phpunit': '^11.0' }
  })
  await writeJson(join(cwd, 'composer.lock'), {
    'content-hash': 'composer-fixture',
    packages: [
      { name: 'monolog/monolog', version: '3.8.1', license: ['MIT'], dist: { url: 'https://dist.example/monolog.zip', shasum: 'monolog-sha' }, require: { 'psr/log': '^2 || ^3' } },
      { name: 'psr/log', version: '3.0.2', license: ['MIT'], dist: { url: 'https://dist.example/psr-log.zip', shasum: 'psr-sha' } }
    ],
    'packages-dev': [
      { name: 'phpunit/phpunit', version: '11.5.1', license: ['BSD-3-Clause'], dist: { url: 'https://dist.example/phpunit.zip', shasum: 'phpunit-sha' } }
    ]
  })
  return cwd
}

async function createBundlerFixture() {
  const cwd = await fixture('bundler')
  await writeFile(join(cwd, 'Gemfile'), [
    'source "https://rubygems.org"',
    'gem "rack", "~> 3.0"',
    'group :development do',
    '  gem "rspec", "~> 3.13"',
    'end'
  ].join('\n'), 'utf-8')
  await writeFile(join(cwd, 'Gemfile.lock'), [
    'GEM',
    '  remote: https://rubygems.org/',
    '  specs:',
    '    rack (3.0.8)',
    '    rspec (3.13.0)',
    '',
    'PLATFORMS',
    '  ruby',
    '',
    'DEPENDENCIES',
    '  rack (~> 3.0)',
    '  rspec (~> 3.13)',
    '',
    'CHECKSUMS',
    '  rack (3.0.8) sha256=rack',
    '  rspec (3.13.0) sha256=rspec',
    '',
    'BUNDLED WITH',
    '   2.6.2'
  ].join('\n'), 'utf-8')
  return cwd
}

async function withRegistryServer(run) {
  const requests = []
  const server = createServer((request, response) => {
    const url = request.url || ''
    requests.push(url)
    response.setHeader('content-type', 'application/json')
    if (url.startsWith('/v3/index.json')) {
      response.end(JSON.stringify({ resources: [{ '@id': 'http://' + request.headers.host + '/query', '@type': ['SearchQueryService/3.5.0'] }] }))
      return
    }
    if (url.startsWith('/query')) {
      response.end(JSON.stringify({ data: [{ id: 'Serilog', version: '4.2.0', description: 'Logging', totalDownloads: 1000, verified: true, authors: ['Serilog'] }] }))
      return
    }
    if (url.startsWith('/search.json')) {
      response.end(JSON.stringify({ results: [{ name: 'monolog/monolog', description: 'Logging', url: 'https://packagist.org/packages/monolog/monolog', repository: 'https://github.com/Seldaek/monolog', downloads: 1000 }] }))
      return
    }
    response.end(JSON.stringify([{ name: 'rack', version: '3.1.8', info: 'Ruby webserver interface', gem_uri: 'https://rubygems.org/gems/rack', homepage_uri: 'https://github.com/rack/rack', licenses: ['MIT'], downloads: 1000 }]))
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
  for (const managerId of ['nuget', 'composer', 'bundler']) {
    const descriptor = descriptors.get(managerId)
    assert(descriptor?.status === 'preview', managerId + ' uses the preview adapter')
    assert(descriptor?.capabilities.search && descriptor?.capabilities.health, managerId + ' exposes search and health')
  }

  const nuget = await service.inventory(roots.nuget, 'nuget')
  assert(nuget.some((item) => item.name === 'Newtonsoft.Json' && item.resolvedVersion === '13.0.3' && item.direct), 'NuGet merges central package versions with nested project locks')
  assert(nuget.some((item) => item.name === 'Microsoft.Bcl.AsyncInterfaces' && !item.direct), 'NuGet inventories transitive target-framework lock entries')

  const composer = await service.inventory(roots.composer, 'composer')
  assert(composer.some((item) => item.name === 'monolog/monolog' && item.resolvedVersion === '3.8.1'), 'Composer merges composer.json with composer.lock')
  assert(composer.some((item) => item.name === 'psr/log' && !item.direct), 'Composer inventories transitive lock packages')
  assert(composer.some((item) => item.name === 'php' && item.scope === 'platform'), 'Composer preserves platform requirements')

  const bundler = await service.inventory(roots.bundler, 'bundler')
  assert(bundler.some((item) => item.name === 'rack' && item.resolvedVersion === '3.0.8'), 'Bundler merges Gemfile constraints with Gemfile.lock')
  assert(bundler.some((item) => item.name === 'rspec' && item.scope === 'development'), 'Bundler preserves Gemfile dependency groups')
  assert(bundler.some((item) => item.name === 'rack' && item.integrity === 'sha256=rack'), 'Bundler parses lockfile checksums')

  const nugetPlan = await service.plan(roots.nuget, 'nuget', { operation: 'install', packageName: 'Serilog', version: '3.1.1' })
  assert(nugetPlan.command === 'dotnet add src/App/App.csproj package Serilog --version 3.1.1', 'NuGet targets the only nested project for package adds')
  assert(nugetPlan.backupFiles.some((item) => item.file === 'src/App/App.csproj') && nugetPlan.backupFiles.some((item) => item.file === 'src/App/packages.lock.json'), 'NuGet plans back up nested project and lock files')
  await mkdir(join(roots.nuget, 'src', 'Worker'), { recursive: true })
  await writeFile(join(roots.nuget, 'src', 'Worker', 'Worker.csproj'), '<Project Sdk="Microsoft.NET.Sdk" />', 'utf-8')
  const ambiguousNugetPlan = await service.plan(roots.nuget, 'nuget', { operation: 'install', packageName: 'Serilog' })
  assert(ambiguousNugetPlan.requirements.some((item) => item.includes('Multiple .NET projects')), 'NuGet blocks ambiguous multi-project package changes')
  const selectedNugetPlan = await service.plan(roots.nuget, 'nuget', { operation: 'remove', packageName: 'Serilog', options: { projectFile: 'src/Worker/Worker.csproj' } })
  assert(selectedNugetPlan.command === 'dotnet remove src/Worker/Worker.csproj package Serilog', 'NuGet honors an explicit project selection')
  const composerPlan = await service.plan(roots.composer, 'composer', { operation: 'install', packageName: 'symfony/console', version: '^7.2', dev: true })
  assert(composerPlan.command === 'composer require symfony/console:^7.2 --dev', 'Composer builds version-aware development require plans')
  assert(composerPlan.dryRunCommand?.endsWith('--dry-run'), 'Composer exposes native dry-run plans')
  const bundlerPlan = await service.plan(roots.bundler, 'bundler', { operation: 'audit' })
  assert(bundlerPlan.command === 'bundle audit check', 'Bundler builds audit plugin command plans')
}

async function verifySearchAndHealth(service, roots) {
  await withRegistryServer(async (registry, requests) => {
    const nuget = await service.search(roots.nuget, 'nuget', { text: 'Serilog', registry: registry + '/v3/index.json' })
    assert(nuget[0]?.name === 'Serilog' && nuget[0]?.version === '4.2.0', 'NuGet search maps V3 query results')
    const composer = await service.search(roots.composer, 'composer', { text: 'monolog', registry })
    assert(composer[0]?.name === 'monolog/monolog', 'Packagist search maps package results')
    const bundler = await service.search(roots.bundler, 'bundler', { text: 'rack', registry })
    assert(bundler[0]?.name === 'rack' && bundler[0]?.version === '3.1.8', 'RubyGems search maps gem results')
    assert(requests.some((url) => url.startsWith('/query?') && url.includes('q=Serilog')), 'NuGet search encodes query parameters')
    assert(requests.some((url) => url.startsWith('/v3/index.json')), 'NuGet search discovers SearchQueryService from a V3 index')
    assert(requests.some((url) => url.startsWith('/search.json?') && url.includes('q=monolog')), 'Packagist search encodes query parameters')
    assert(requests.some((url) => url.startsWith('/api/v1/search.json?') && url.includes('query=rack')), 'RubyGems search encodes query parameters')
  })
  await service.search(roots.composer, 'composer', { text: 'test', registry: 'https://user:secret@example.test' })
    .then(() => assert(false, 'registry credentials are rejected'))
    .catch((error) => assert(error.message.includes('credentials'), 'Backend registry URLs reject embedded credentials'))

  const nugetHealth = await service.health(roots.nuget, 'nuget')
  assert(!nugetHealth.findings.some((item) => item.id.startsWith('nuget-content-hash-missing')), 'NuGet health accepts content-hashed lock entries')
  assert(!nugetHealth.findings.some((item) => item.id === 'lockfile-missing'), 'NuGet health recognizes nested project lockfiles')
  const composerHealth = await service.health(roots.composer, 'composer')
  assert(!composerHealth.findings.some((item) => item.id === 'composer-content-hash-missing'), 'Composer health accepts a content-hashed lockfile')
  const bundlerHealth = await service.health(roots.bundler, 'bundler')
  assert(!bundlerHealth.findings.some((item) => item.id.startsWith('bundler-version-missing')), 'Bundler health accepts a pinned Bundler version')
  assert(!bundlerHealth.findings.some((item) => item.id.startsWith('bundler-checksum-missing')), 'Bundler health accepts complete lockfile checksums')
}

async function main() {
  const service = new ManagerWorkspaceService()
  const roots = {
    nuget: await createNugetFixture(),
    composer: await createComposerFixture(),
    bundler: await createBundlerFixture()
  }
  try {
    await verifyInventoryAndPlans(service, roots)
    await verifySearchAndHealth(service, roots)
    console.log('backend manager verification passed (' + checks.length + ' checks)')
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
      sourcefile: 'backend-manager-verifier.ts',
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
        name: 'backend-manager-verifier-stubs',
        setup(buildApi) {
          buildApi.onResolve({ filter: /^\.\/(toolchain|commandRunner)$/ }, (args) => {
            if (!args.importer.endsWith('extendedManager.ts')) return undefined
            return { path: args.path, namespace: 'backend-manager-verifier-stub' }
          })
          buildApi.onLoad({ filter: /.*/, namespace: 'backend-manager-verifier-stub' }, (args) => {
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
