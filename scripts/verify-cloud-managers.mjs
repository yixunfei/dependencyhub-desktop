import { build } from 'esbuild'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-cloud-manager-verifier-'))
const outputFile = join(workDir, 'cloud-manager-verifier.mjs')
const runner = String.raw`
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ManagerWorkspaceService } from './electron/services/managerWorkspace'
const roots = []
const checks = []
const assert = (condition, message) => { if (!condition) throw new Error(message); checks.push(message) }
const fixture = async () => { const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-helm-')); roots.push(cwd); return cwd }
const main = async () => {
  const cwd = await fixture()
  await writeFile(join(cwd, 'Chart.yaml'), [
    'apiVersion: v2', 'name: demo', 'version: 0.1.0', 'dependencies:',
    '  - name: nginx', '    version: 1.2.3', '    repository: https://charts.example.test/stable',
    '  - name: local', '    version: 0.2.0', '    repository: http://charts.example.test/local'
  ].join('\n'))
  await writeFile(join(cwd, 'Chart.lock'), [
    'dependencies:', '  - name: nginx', '    version: 1.2.3', '    repository: https://charts.example.test/stable',
    '  - name: transitive', '    version: 2.0.0', '    repository: https://charts.example.test/stable',
    'digest: sha256:fixture', 'generated: 2026-09-15T00:00:00Z'
  ].join('\n'))
  const service = new ManagerWorkspaceService()
  const descriptor = service.descriptors().find((item) => item.managerId === 'helm')
  assert(descriptor?.status === 'preview', 'Helm uses the preview adapter')
  assert(descriptor?.capabilities.health === true, 'Helm exposes health capability')
  assert(!descriptor?.capabilities.operations.includes('install'), 'Helm does not expose unsafe manifest mutation as install')
  const inventory = await service.inventory(cwd, 'helm')
  assert(inventory.some((item) => item.name === 'nginx' && item.direct && item.resolvedVersion === '1.2.3'), 'Helm merges Chart.yaml with Chart.lock')
  assert(inventory.some((item) => item.name === 'transitive' && !item.direct && item.integrity === 'sha256:fixture'), 'Helm preserves transitive lock entries and digest')
  const updatePlan = await service.plan(cwd, 'helm', { operation: 'update' })
  assert(updatePlan.command === 'helm dependency update', 'Helm update uses the real dependency update command')
  const auditPlan = await service.plan(cwd, 'helm', { operation: 'audit' })
  assert(auditPlan.command === 'helm lint', 'Helm audit maps to helm lint')
  assert(auditPlan.dryRunSupported === false, 'Helm lint remains an explicit audit command, not a mutation dry-run')
  const health = await service.health(cwd, 'helm')
  assert(health.findings.some((item) => item.id.includes('insecure')), 'Helm health reports insecure repositories')
  const missing = await fixture()
  await writeFile(join(missing, 'Chart.yaml'), ['apiVersion: v2', 'name: missing', 'version: 0.1.0'].join(String.fromCharCode(10)))
  const missingHealth = await service.health(missing, 'helm')
  assert(missingHealth.findings.some((item) => item.id === 'helm-lock-missing'), 'Helm health reports missing Chart.lock')
  console.log('cloud manager verification passed (' + checks.length + ' checks)')
}
try { await main() } finally { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))}
`
try {
  await build({ stdin: { contents: runner, resolveDir: process.cwd(), sourcefile: 'cloud-manager-verifier.ts', loader: 'ts' }, outfile: outputFile, bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'silent', banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" }, plugins: [{ name: 'cloud-manager-stubs', setup(api) { api.onResolve({ filter: /^\.\/(toolchain|commandRunner)$/ }, (args) => args.importer.endsWith('extendedManager.ts') ? { path: args.path, namespace: 'cloud-stub' } : undefined); api.onLoad({ filter: /.*/, namespace: 'cloud-stub' }, (args) => args.path === './toolchain' ? { loader: 'ts', contents: "export type ToolName = string; export async function resolveToolBin(tool: string) { return tool; }" } : { loader: 'ts', contents: "export async function runLoggedCommand() { return { stdout: '', stderr: '' }; }" }) } }] })
  await import(pathToFileURL(outputFile).href)
} finally { await rm(workDir, { recursive: true, force: true }) }
