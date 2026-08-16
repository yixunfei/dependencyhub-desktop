import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { build } from 'esbuild'

const managerId = parseManager(process.argv.slice(2))
const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-manager-contracts-'))
const outputFile = join(workDir, 'manager-contracts.mjs')
const runner = `
import { MANAGER_DEFINITIONS } from './shared/managerRegistry'
import { MANAGER_OPERATIONS } from './shared/managerWorkspace'
import { createManagerDescriptor } from './electron/managers/capabilities'

const requestedManagerId = ${JSON.stringify(managerId)}
const extended = MANAGER_DEFINITIONS.filter((definition) => !definition.builtIn)
const selected = requestedManagerId
  ? extended.filter((definition) => definition.id === requestedManagerId)
  : extended

assert(extended.length === 54, 'registry contains exactly 54 extended manager definitions')
assert(new Set(extended.map((definition) => definition.id)).size === extended.length, 'extended manager IDs are unique')
assert(!requestedManagerId || selected.length === 1, 'requested manager exists and is extended')

const operations = new Set(MANAGER_OPERATIONS)
for (const definition of selected) {
  const descriptor = createManagerDescriptor(definition)
  assert(descriptor.managerId === definition.id, definition.id + ' descriptor keeps its manager ID')
  assert(descriptor.tools.length > 0, definition.id + ' declares at least one runnable or inspection tool')
  assert(descriptor.capabilities.operations.length > 0, definition.id + ' exposes at least one operation')
  assert(descriptor.capabilities.operations.every((operation) => operations.has(operation)), definition.id + ' operations use the shared contract')
  assert(descriptor.capabilities.platforms.length > 0, definition.id + ' declares a runtime platform boundary')
  assert(definition.manifestFiles.length + definition.lockFiles.length + (definition.detectionFiles?.length || 0) > 0, definition.id + ' declares detection evidence')
}

for (const managerId of ['pnpm', 'yarn', 'bun', 'uv', 'poetry', 'pipenv', 'conda', 'nuget', 'composer', 'bundler']) {
  const definition = extended.find((item) => item.id === managerId)
  assert(definition?.status === 'preview', managerId + ' is promoted to preview')
  assert(definition?.searchable && definition?.healthSupported, managerId + ' declares search and health support')
}

console.log('manager contract verification passed (' + selected.length + ' manager' + (selected.length === 1 ? '' : 's') + ')')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
`

try {
  await build({
    stdin: {
      contents: runner,
      resolveDir: process.cwd(),
      sourcefile: 'manager-contract-verifier.ts',
      loader: 'ts'
    },
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent'
  })
  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(workDir, { recursive: true, force: true })
}

function parseManager(args) {
  if (args.length === 0) return undefined
  if (args.length === 2 && args[0] === '--manager' && args[1]) return args[1]
  throw new Error('Usage: verify-manager-contracts.mjs [--manager <id>]')
}
