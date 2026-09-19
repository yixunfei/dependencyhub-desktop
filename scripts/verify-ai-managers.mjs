import { build } from 'esbuild'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const workDir = await mkdtemp(join(tmpdir(), 'dependencyhub-ai-verifier-'))
const outputFile = join(workDir, 'ai-verifier.mjs')

const runner = String.raw`
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ManagerWorkspaceService } from './electron/services/managerWorkspace'
import { SupplyChainService } from './electron/services/supplyChain'
import { WorkspaceDiscoveryService } from './electron/services/workspaceDiscovery'
import { ExtendedManagerService } from './electron/services/extendedManager'
import { LockfileDriftService } from './electron/services/lockfileDrift'

const roots = []
const checks = []
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
const fixture = async () => { const cwd = await mkdtemp(join(tmpdir(), 'dependencyhub-ai-')); roots.push(cwd); return cwd }
const exists = async (path) => { try { await readFile(path, 'utf-8'); return true } catch { return false } }
const read = async (path) => await readFile(path, 'utf-8')

const main = async () => {
  const service = new ManagerWorkspaceService()

  // --- descriptors -------------------------------------------------------
  for (const id of ['mcp', 'skills', 'ai-agents', 'a2a']) {
    const descriptor = service.descriptors().find((item) => item.managerId === id)
    assert(descriptor && descriptor.status === 'preview', id + ' is served by a preview adapter')
    assert(descriptor.capabilities.health === true, id + ' exposes health capability')
    assert(descriptor.capabilities.search === (id === 'mcp'), id + ' exposes search only when a registry exists')
    assert(descriptor.capabilities.customCommands === false, id + ' rejects arbitrary shell commands')
    assert(descriptor.capabilities.operations.join(',') === 'sync,install,remove,audit,tree,list,lock', id + ' exposes the local AI operation set')
  }
  assert(service.diagnostics().length === 0, 'AI adapters match their registry declarations')

  // --- MCP inventory and health -----------------------------------------
  const mcp = await fixture()
  await writeFile(join(mcp, '.mcp.json'), JSON.stringify({
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@1.2.3'] },
      git: { command: 'uvx', args: ['mcp-server-git'] },
      remote: { type: 'sse', url: 'http://tools.example.test/sse' },
      leaky: { command: 'npx', args: ['-y', 'leaky-server@1.0.0'], env: { API_TOKEN: 'sk-live-1234567890' } },
      broken: { description: 'no command or url' },
      local: { command: 'node', args: ['./server.js'] }
    }
  }, null, 2))

  const inventory = await service.inventory(mcp, 'mcp')
  assert(inventory.length === 6, 'MCP inventory lists every declared server')
  assert(inventory.find((item) => item.name === 'filesystem')?.version === '1.2.3', 'MCP inventory reads the pinned npx version')
  assert(inventory.find((item) => item.name === 'filesystem')?.metadata.pinned === true, 'MCP inventory marks a pinned server')
  assert(inventory.find((item) => item.name === 'git')?.metadata.pinned === false, 'MCP inventory marks an unpinned uvx server')
  assert(inventory.find((item) => item.name === 'remote')?.type === 'sse', 'MCP inventory keeps the remote transport')
  assert(inventory.find((item) => item.name === 'broken')?.status === 'invalid', 'MCP inventory flags an incomplete server definition')
  assert(inventory.find((item) => item.name === 'local')?.status === 'installed', 'MCP inventory accepts a local script server')

  const mcpHealth = await service.health(mcp, 'mcp')
  assert(mcpHealth.findings.some((item) => item.id === 'mcp-unpinned:git'), 'MCP health reports unpinned servers')
  assert(!mcpHealth.findings.some((item) => item.id === 'mcp-unpinned:local'), 'MCP health does not ask a local script server to pin a registry version')
  assert(mcpHealth.findings.some((item) => item.id === 'mcp-insecure:remote'), 'MCP health reports insecure HTTP endpoints')
  assert(mcpHealth.findings.some((item) => item.id === 'mcp-secret:leaky:API_TOKEN'), 'MCP health reports literal credentials')
  assert(mcpHealth.findings.some((item) => item.id === 'mcp-invalid:broken'), 'MCP health reports incomplete definitions')
  assert(mcpHealth.findings.some((item) => item.id === 'lockfile-missing'), 'MCP health reports missing lock evidence')
  assert(mcpHealth.status === 'error', 'MCP health escalates to error when blocking findings exist')

  for (const [operation, command] of [['sync', 'mcp sync'], ['list', 'mcp list'], ['tree', 'mcp tree'], ['audit', 'mcp audit'], ['lock', 'mcp lock']]) {
    const plan = await service.plan(mcp, 'mcp', { operation })
    assert(plan.command === command, 'MCP ' + operation + ' plans ' + command)
  }
  const missingInstall = await service.plan(mcp, 'mcp', { operation: 'install' })
  assert(missingInstall.requirements.length === 1 && missingInstall.mutating, 'MCP install without a package spec requires input')
  const installPlan = await service.plan(mcp, 'mcp', { operation: 'install', packageName: '@modelcontextprotocol/server-memory', version: '0.6.3' })
  assert(installPlan.mutating && installPlan.dryRunSupported && installPlan.requirements.length === 0, 'MCP install with a pinned package spec plans a reversible mutation')

  // --- MCP lock evidence -------------------------------------------------
  const dryLock = await service.execute(mcp, 'mcp', { operation: 'lock' }, { dryRun: true })
  assert(dryLock.dryRun === true && !(await exists(join(mcp, 'mcp-lock.json'))), 'MCP lock dry-run writes nothing')
  const locked = await service.execute(mcp, 'mcp', { operation: 'lock' })
  const lockDocument = JSON.parse(await read(join(mcp, 'mcp-lock.json')))
  assert(lockDocument.servers.length === 6 && lockDocument.servers.every((entry) => typeof entry.hash === 'string' && entry.hash.length === 64), 'MCP lock records a hash per server')
  assert(Boolean(locked.backup && locked.backup.files.some((file) => file.file === 'mcp-lock.json')), 'MCP lock keeps a restorable backup')
  const lockedInventory = await service.inventory(mcp, 'mcp')
  assert(lockedInventory.find((item) => item.name === 'filesystem')?.integrity === lockDocument.servers.find((entry) => entry.name === 'filesystem').hash, 'MCP inventory merges lock integrity')

  // --- MCP install / remove / restore ------------------------------------
  const installed = await service.execute(mcp, 'mcp', { operation: 'install', packageName: '@modelcontextprotocol/server-memory', version: '0.6.3' })
  const installedDocument = JSON.parse(await read(join(mcp, '.mcp.json')))
  assert(installedDocument.mcpServers['server-memory'].args.join(' ') === '-y @modelcontextprotocol/server-memory@0.6.3', 'MCP install writes a pinned stdio entry')
  assert(Boolean(installed.backup), 'MCP install keeps a restorable backup')
  const afterInstall = await service.inventory(mcp, 'mcp')
  assert(afterInstall.some((item) => item.name === 'server-memory'), 'MCP install is visible in the inventory')

  const removed = await service.execute(mcp, 'mcp', { operation: 'remove', packageName: 'server-memory' })
  const removedDocument = JSON.parse(await read(join(mcp, '.mcp.json')))
  assert(!('server-memory' in removedDocument.mcpServers), 'MCP remove deletes the server definition')
  assert(Boolean(removed.backup), 'MCP remove keeps a restorable backup')
  const restored = await service.restoreBackup(mcp, removed.backup.path)
  assert(restored.restoredCount > 0 && JSON.parse(await read(join(mcp, '.mcp.json'))).mcpServers['server-memory'], 'MCP backup restore brings the removed server back')

  const missingRemove = await service.plan(mcp, 'mcp', { operation: 'remove', packageName: 'does-not-exist' })
  assert(missingRemove.requirements.length === 0 && missingRemove.mutating, 'MCP remove plans without requiring extra input')

  // --- MCP registry search -------------------------------------------------
  const mcpSearch = await service.search(mcp, 'mcp', { text: 'filesystem', limit: 10 })
  assert(mcpSearch.some((item) => item.name === '@modelcontextprotocol/server-filesystem'), 'MCP search finds the reference filesystem server in the curated catalog')
  assert(mcpSearch.every((item) => item.managerId === 'mcp'), 'MCP search results carry the mcp manager id')
  let mcpSearchRejected = false
  try { await service.search(mcp, 'skills', { text: 'anything' }) } catch { mcpSearchRejected = true }
  assert(mcpSearchRejected, 'AI managers without a registry reject package search')

  // --- MCP failure rollback ---------------------------------------------
  // The atomic writer stages under a unique name, so the write is blocked by
  // putting a directory at the destination path: every platform rejects a
  // file-over-directory rename, and the original state must stay untouched.
  const blocked = await fixture()
  await writeFile(join(blocked, '.mcp.json'), JSON.stringify({ mcpServers: { keep: { command: 'npx', args: ['-y', 'keep@1.0.0'] } } }, null, 2))
  await mkdir(join(blocked, 'mcp-lock.json'), { recursive: true })
  let failure = null
  try {
    await service.execute(blocked, 'mcp', { operation: 'lock' })
  } catch (error) {
    failure = error
  }
  assert(failure !== null, 'MCP lock surfaces a write failure instead of reporting success')
  assert(failure.restore?.restored === true, 'MCP lock restores the previous state after a failure')
  let destinationStillBlocked = false
  try { destinationStillBlocked = (await stat(join(blocked, 'mcp-lock.json'))).isDirectory() } catch { }
  assert(destinationStillBlocked, 'MCP lock failure leaves the original destination state intact')

  // --- skills ------------------------------------------------------------
  const skills = await fixture()
  await mkdir(join(skills, '.workbuddy-ai', 'skills', 'code-review', 'scripts'), { recursive: true })
  await writeFile(join(skills, '.workbuddy-ai', 'skills', 'code-review', 'SKILL.md'), [
    '---',
    'name: code-review',
    'description: Review a change set for defects before merge.',
    'version: 2.1.0',
    'allowed-tools: Read, Grep',
    '---',
    '',
    'Follow the review checklist.'
  ].join('\n'))
  await mkdir(join(skills, 'skills', 'draft'), { recursive: true })
  await writeFile(join(skills, 'skills', 'draft', 'SKILL.md'), '# Draft skill without frontmatter\n')

  const skillInventory = await service.inventory(skills, 'skills')
  assert(skillInventory.some((item) => item.name === 'code-review' && item.version === '2.1.0' && item.status === 'installed'), 'skills inventory parses SKILL.md frontmatter')
  assert(skillInventory.some((item) => item.name === 'draft' && item.status === 'invalid'), 'skills inventory flags a SKILL.md without frontmatter')
  assert(skillInventory.find((item) => item.name === 'code-review')?.metadata.hasScripts === true, 'skills inventory records the scripts directory')

  const skillsHealth = await service.health(skills, 'skills')
  assert(skillsHealth.findings.some((item) => item.id.startsWith('skills-frontmatter-missing:')), 'skills health reports missing frontmatter')
  assert(skillsHealth.findings.some((item) => item.id === 'skills-description-missing:skills/draft/SKILL.md'), 'skills health reports a missing description')
  assert(skillsHealth.findings.some((item) => item.id === 'skills-lock-missing-entry:code-review' || item.id === 'lockfile-missing'), 'skills health reports missing lock evidence')

  const declared = await service.execute(skills, 'skills', { operation: 'install', packageName: 'code-review' })
  const skillsManifest = JSON.parse(await read(join(skills, 'skills.json')))
  assert(skillsManifest.skills[0].name === 'code-review' && skillsManifest.skills[0].source === '.workbuddy-ai/skills/code-review', 'skills install declares the skill with its default source')
  assert(Boolean(declared.backup && declared.backup.files[0].file === 'skills.json'), 'skills install backs up the declaration manifest')
  await service.execute(skills, 'skills', { operation: 'lock' })
  const skillsLock = JSON.parse(await read(join(skills, 'skills.lock.json')))
  assert(skillsLock.skills.length === 2 && skillsLock.skills.every((entry) => entry.hash.length === 64), 'skills lock records every local skill hash')
  const driftHealth = await service.health(skills, 'skills')
  assert(!driftHealth.findings.some((item) => item.id.startsWith('skills-lock-drift:')), 'skills health is clean immediately after locking')
  await service.execute(skills, 'skills', { operation: 'remove', packageName: 'code-review' })
  assert(JSON.parse(await read(join(skills, 'skills.json'))).skills.length === 0, 'skills remove deletes the declaration only')

  const duplicate = await fixture()
  await mkdir(join(duplicate, '.claude', 'skills', 'lint'), { recursive: true })
  await writeFile(join(duplicate, '.claude', 'skills', 'lint', 'SKILL.md'), '---\nname: lint\ndescription: Lint rules.\n---\n')
  await mkdir(join(duplicate, 'skills', 'lint'), { recursive: true })
  await writeFile(join(duplicate, 'skills', 'lint', 'SKILL.md'), '---\nname: lint\ndescription: Lint rules.\n---\n')
  const duplicateHealth = await service.health(duplicate, 'skills')
  assert(duplicateHealth.findings.some((item) => item.id === 'skills-duplicate:lint'), 'skills health reports duplicate skill names')

  // --- agent rules and prompts ------------------------------------------
  const agents = await fixture()
  await writeFile(join(agents, 'AGENTS.md'), '# Project agent instructions\n\nAlways run the type check.\n')
  await mkdir(join(agents, '.cursor', 'rules'), { recursive: true })
  await writeFile(join(agents, '.cursor', 'rules', 'style.mdc'), '---\nname: style\ndescription: House style rules.\ntools: Read\n---\n\nPrefer explicit types.\n')
  await writeFile(join(agents, 'CLAUDE.md'), '')

  const agentInventory = await service.inventory(agents, 'ai-agents')
  assert(agentInventory.some((item) => item.name === 'AGENTS' && item.type === 'instructions'), 'agents inventory classifies instruction files')
  assert(agentInventory.some((item) => item.name === 'style' && item.type === 'rule'), 'agents inventory reads rule frontmatter')
  const instructionEntry = agentInventory.find((item) => item.name === 'AGENTS')
  assert(instructionEntry?.metadata.versionSource === 'content-hash' && instructionEntry.version.length === 12, 'agents inventory gives unversioned instruction files a content-addressed version')
  const agentsHealth = await service.health(agents, 'ai-agents')
  assert(agentsHealth.findings.some((item) => item.id === 'agents-empty:CLAUDE.md'), 'agents health reports an empty context file')
  assert(!agentsHealth.findings.some((item) => item.id.startsWith('agents-frontmatter-missing:')), 'agents health accepts a rule with frontmatter')

  const agentDeclared = await service.execute(agents, 'ai-agents', { operation: 'install', packageName: 'style' })
  const agentsManifest = JSON.parse(await read(join(agents, 'agents.json')))
  assert(agentsManifest.agents[0].name === 'style' && agentsManifest.agents[0].source === '.workbuddy-ai/agents/style.md', 'agents install declares the dependency')
  assert(Boolean(agentDeclared.backup), 'agents install backs up the declaration manifest')
  const agentsLockResult = await service.execute(agents, 'ai-agents', { operation: 'lock' })
  assert(JSON.parse(await read(join(agents, 'agents.lock.json'))).agents.length === 3, 'agents lock records every instruction file')
  assert(Boolean(agentsLockResult.backup), 'agents lock keeps a restorable backup')
  const agentsAudit = await service.execute(agents, 'ai-agents', { operation: 'audit' })
  assert(agentsAudit.stdout.includes('ai-agents audit'), 'agents audit returns local findings as command output')

  // --- A2A agent endpoints -------------------------------------------------
  const a2a = await fixture()
  await mkdir(join(a2a, '.well-known'), { recursive: true })
  await writeFile(join(a2a, '.well-known', 'agent-card.json'), JSON.stringify({
    name: 'code-reviewer',
    description: 'Reviews pull requests and reports findings.',
    protocolVersion: '0.3.0',
    url: 'https://agents.example.test/a2a',
    securitySchemes: ['oauth2'],
    skills: [{ id: 'review-pr' }]
  }, null, 2))
  await writeFile(join(a2a, 'a2a.config.json'), JSON.stringify({
    agents: [
      { name: 'translator', url: 'https://translate.example.test', protocolVersion: '0.3.0' },
      { name: 'local-dev-agent', url: 'http://localhost:9101' },
      { name: 'no-url-agent' }
    ]
  }, null, 2))

  const a2aInventory = await service.inventory(a2a, 'a2a')
  assert(a2aInventory.some((item) => item.name === 'code-reviewer' && item.status === 'installed' && item.type === 'agent-card'), 'A2A inventory reads the served agent card')
  assert(a2aInventory.find((item) => item.name === 'code-reviewer')?.metadata.authSchemes === 'oauth2', 'A2A inventory records security schemes')
  assert(a2aInventory.some((item) => item.name === 'translator' && item.type === 'config'), 'A2A inventory reads client-configured endpoints')
  assert(a2aInventory.find((item) => item.name === 'no-url-agent')?.status === 'invalid', 'A2A inventory flags an endpoint without a url')

  const a2aHealth = await service.health(a2a, 'a2a')
  assert(a2aHealth.findings.some((item) => item.id === 'a2a-insecure:local-dev-agent' && item.severity === 'warning'), 'A2A health downgrades loopback HTTP to a warning')
  assert(a2aHealth.findings.some((item) => item.id === 'a2a-invalid:no-url-agent'), 'A2A health reports endpoint definitions without a url')
  assert(a2aHealth.findings.some((item) => item.id === 'a2a-lock-missing-entry:code-reviewer'), 'A2A health reports missing lock evidence')

  const a2aInstall = await service.execute(a2a, 'a2a', { operation: 'install', packageName: 'https://search.example.test/agent-card.json' })
  const a2aManifest = JSON.parse(await read(join(a2a, 'a2a.json')))
  assert(a2aManifest.agents[0].name === 'search.example.test' && a2aManifest.agents[0].source.startsWith('https://'), 'A2A install derives a name from the endpoint URL')
  assert(Boolean(a2aInstall.backup), 'A2A install keeps a restorable backup')

  const a2aLockResult = await service.execute(a2a, 'a2a', { operation: 'lock' })
  const a2aLock = JSON.parse(await read(join(a2a, 'a2a-lock.json')))
  assert(a2aLock.agents.length >= 3 && a2aLock.agents.every((entry) => entry.hash.length === 64), 'A2A lock records hash evidence for every endpoint')
  assert(Boolean(a2aLockResult.backup), 'A2A lock keeps a restorable backup')

  const a2aRemove = await service.execute(a2a, 'a2a', { operation: 'remove', packageName: a2aManifest.agents[0].name })
  assert(JSON.parse(await read(join(a2a, 'a2a.json'))).agents.length === 0, 'A2A remove deletes the endpoint declaration')
  assert(Boolean(a2aRemove.backup), 'A2A remove keeps a restorable backup')

  const a2aCardOnly = await fixture()
  await writeFile(join(a2aCardOnly, 'a2a.json'), JSON.stringify({ version: 1, agents: [{ name: 'ghost', source: 'https://ghost.example.test' }] }, null, 2))
  const a2aMissing = await service.inventory(a2aCardOnly, 'a2a')
  assert(a2aMissing.some((item) => item.name === 'ghost' && item.status === 'missing'), 'A2A inventory reports declared-but-undiscovered endpoints as missing')

  // --- governance integration -------------------------------------------
  const integration = await fixture()
  await writeFile(join(integration, '.mcp.json'), JSON.stringify({
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@1.2.3'] },
      remote: { type: 'sse', url: 'https://tools.example.test/sse' }
    }
  }, null, 2))
  await mkdir(join(integration, 'skills', 'pdf'), { recursive: true })
  await writeFile(join(integration, 'skills', 'pdf', 'SKILL.md'), '---\nname: pdf\ndescription: pdf tooling\nversion: 1.0.0\n---\n\nUse pdf.\n')
  await writeFile(join(integration, 'AGENTS.md'), '# Instructions\n\nBe helpful.\n')

  // Nested AI-only manifest directories must exist before the first discovery
  // report: the scanner caches directory listings, so dirs created between two
  // report() calls stay invisible to the second call.
  await mkdir(join(integration, 'ai-only'), { recursive: true })
  await writeFile(join(integration, 'ai-only', '.mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))
  await mkdir(join(integration, 'py-with-ai'), { recursive: true })
  await writeFile(join(integration, 'py-with-ai', 'pyproject.toml'), '[project]\nname = "demo"\n')
  await writeFile(join(integration, 'py-with-ai', '.mcp.json'), JSON.stringify({ mcpServers: {} }, null, 2))

  // The legacy extended-manager service backs the SBOM, so it must not fall
  // back to listing the manifest file itself as if it were a dependency.
  const legacy = new ExtendedManagerService()
  const legacyMcp = await legacy.list(integration, 'mcp')
  assert(legacyMcp.some((item) => item.name === 'filesystem') && !legacyMcp.some((item) => item.name === '.mcp.json'), 'extended manager list resolves real MCP servers instead of the manifest file')
  const legacySkills = await legacy.list(integration, 'skills')
  assert(legacySkills.some((item) => item.name === 'pdf'), 'extended manager list resolves skills for legacy consumers')
  const legacyAgents = await legacy.list(integration, 'ai-agents')
  assert(legacyAgents.some((item) => item.name === 'AGENTS'), 'extended manager list resolves agent instruction files for legacy consumers')

  const supplyChain = new SupplyChainService()
  const report = await supplyChain.report(integration)
  const aiComponents = report.components.filter((item) => ['mcp', 'skills', 'ai-agents'].includes(item.managerId))
  assert(aiComponents.some((item) => item.managerId === 'mcp' && item.name === 'filesystem' && item.version === '1.2.3'), 'supply chain inventory includes pinned MCP servers')
  assert(!report.components.some((item) => item.name.endsWith('.mcp.json')), 'supply chain inventory never reports a manifest file as a dependency')
  assert(aiComponents.some((item) => item.managerId === 'skills' && item.name === 'pdf'), 'supply chain inventory includes agent skills')
  assert(aiComponents.some((item) => item.managerId === 'ai-agents' && item.name === 'AGENTS'), 'supply chain inventory includes agent instruction files')
  assert(aiComponents.every((item) => typeof item.packageUrl === 'string' && item.packageUrl.startsWith('pkg:generic/')), 'every AI component carries a package URL for SBOM export')
  for (const manager of ['mcp', 'skills', 'ai-agents']) {
    const entry = report.managers.find((item) => item.id === manager)
    assert(entry?.detected === true && entry.componentCount > 0, manager + ' is detected by the supply chain report with components')
  }

  const bom = JSON.parse(await read((await supplyChain.exportCycloneDx(integration)).path))
  const bomAi = bom.components.filter((component) => ['mcp', 'skills', 'ai-agents'].includes(
    component.properties?.find((property) => property.name === 'dependency.manager')?.value
  ))
  assert(bomAi.length === aiComponents.length, 'CycloneDX export carries every AI component')
  assert(bomAi.every((component) => typeof component.purl === 'string' && component.purl.length > 0), 'CycloneDX export keeps AI package URLs')

  const discovery = new WorkspaceDiscoveryService()
  const rootWorkspace = (await discovery.report(integration)).workspaces.find((item) => item.kind === 'root')
  assert(['mcp', 'skills', 'ai-agents'].every((id) => rootWorkspace.managerIds.includes(id)), 'workspace discovery detects all three AI managers')
  assert(rootWorkspace.manifestFiles.includes('.mcp.json'), 'workspace discovery records the MCP manifest')

  const nested = (await discovery.report(integration)).workspaces
  const aiOnly = nested.find((item) => item.relativePath === 'ai-only')
  assert(aiOnly?.kind === 'ai-project' && aiOnly.managerIds.join(',') === 'mcp', 'an AI-only manifest directory is reported as ai-project with the exact detected manager')
  const pythonWithAi = nested.find((item) => item.relativePath === 'py-with-ai')
  assert(pythonWithAi?.kind === 'python-package' && pythonWithAi.managerIds.includes('mcp'), 'a language manifest keeps its ecosystem kind while still detecting AI managers')

  // AI managers join the existing governance reports instead of being invisible.
  const drift = await new LockfileDriftService().report(integration)
  const driftAi = drift.workspaces.flatMap((item) => item.findings).filter((finding) => ['mcp', 'skills', 'ai-agents'].includes(finding.managerId))
  assert(driftAi.some((finding) => finding.managerId === 'mcp' && finding.kind === 'missing-lockfile'), 'lockfile drift report flags MCP servers declared without lock evidence')
  assert(driftAi.every((finding) => finding.severity === 'warning'), 'AI lockfile findings are warnings because the ecosystems are preview-stage')

  // --- unsupported surfaces ---------------------------------------------
  let customRejected = false
  try { await service.runCustom(mcp, 'mcp', 'npx -y anything') } catch { customRejected = true }
  assert(customRejected, 'AI managers reject arbitrary custom commands')
  let unsupportedRejected = false
  try { await service.plan(mcp, 'mcp', { operation: 'outdated' }) } catch { unsupportedRejected = true }
  assert(unsupportedRejected, 'AI managers reject operations outside their declared set')

  console.log('AI dependency verification passed (' + checks.length + ' checks)')
}

try { await main() } finally { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))) }
`

try {
  await build({
    stdin: { contents: runner, resolveDir: process.cwd(), sourcefile: 'ai-verifier.ts', loader: 'ts' },
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    plugins: [{
      name: 'ai-stubs',
      setup(api) {
        api.onResolve({ filter: /^\.\/(toolchain|commandRunner)$/ }, (args) => (
          args.importer.endsWith('extendedManager.ts') ? { path: args.path, namespace: 'ai-stub' } : undefined
        ))
        api.onLoad({ filter: /.*/, namespace: 'ai-stub' }, (args) => (
          args.path === './toolchain'
            ? { loader: 'ts', contents: 'export type ToolName=string; export async function resolveToolBin(tool:string){return tool;}' }
            : { loader: 'js', contents: "export async function runLoggedCommand(){return {stdout:'',stderr:''}}" }
        ))
      }
    }]
  })
  await import(pathToFileURL(outputFile).href)
} finally {
  await rm(workDir, { recursive: true, force: true })
}
