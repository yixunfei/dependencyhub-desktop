import type {
  DependencyManagerDefinition,
  DependencyManagerId,
  ManagerCapability
} from '../../shared/managerRegistry'
import type {
  ManagerCapabilityProfile,
  ManagerDescriptor,
  ManagerIntegrationKind,
  ManagerOperation,
  ManagerRuntimePlatform
} from '../../shared/managerWorkspace'

const ALL_PLATFORMS: ManagerRuntimePlatform[] = ['win32', 'darwin', 'linux']

const AUTOMATION_MANAGERS = new Set<DependencyManagerId>([
  'github-actions',
  'gitlab-ci',
  'pre-commit'
])

const BUILD_MANAGERS = new Set<DependencyManagerId>(['bazel', 'pants', 'buck'])

const DECLARATIVE_MANAGERS = new Set<DependencyManagerId>([
  'docker',
  'helm',
  'kustomize',
  'helmfile',
  'skaffold',
  'argocd',
  'flux',
  'terraform',
  'opentofu',
  'ansible',
  'mcp',
  'skills',
  'ai-agents'
])

const RUNTIME_MANAGERS = new Set<DependencyManagerId>([
  'homebrew',
  'chocolatey',
  'scoop',
  'winget',
  'asdf',
  'mise',
  'sdkman',
  'apt',
  'dnf',
  'apk',
  'pacman',
  'nix'
])

const NATIVE_DRY_RUN_MANAGERS = new Set<DependencyManagerId>([
  'pnpm',
  'poetry',
  'pipenv',
  'conda',
  'composer',
  'helm',
  'docker',
  'apt',
  'dnf',
  'pacman'
])

const ELEVATED_MANAGERS = new Set<DependencyManagerId>([
  'chocolatey',
  'winget',
  'apt',
  'dnf',
  'apk',
  'pacman'
])

const PLATFORM_OVERRIDES: Partial<Record<DependencyManagerId, ManagerRuntimePlatform[]>> = {
  cocoapods: ['darwin'],
  homebrew: ['darwin', 'linux'],
  chocolatey: ['win32'],
  scoop: ['win32'],
  winget: ['win32'],
  sdkman: ['darwin', 'linux'],
  apt: ['linux'],
  dnf: ['linux'],
  apk: ['linux'],
  pacman: ['linux'],
  nix: ['darwin', 'linux']
}

export function createManagerDescriptor(definition: DependencyManagerDefinition): ManagerDescriptor {
  return {
    managerId: definition.id,
    name: definition.name,
    language: definition.language,
    ecosystem: definition.ecosystem,
    packageManager: definition.packageManager,
    status: definition.status,
    route: definition.route,
    tools: [...definition.tools],
    capabilities: capabilityProfile(definition)
  }
}

function capabilityProfile(definition: DependencyManagerDefinition): ManagerCapabilityProfile {
  const operations = operationsFromCapabilities(definition.capabilities)
  return {
    kind: integrationKind(definition.id),
    operations,
    search: definition.searchable,
    health: definition.healthSupported,
    customCommands: true,
    nativeDryRun: NATIVE_DRY_RUN_MANAGERS.has(definition.id),
    networkAccess: definition.searchable || operations.some((operation) => (
      operation === 'install' || operation === 'update' || operation === 'sync'
    )),
    requiresElevation: ELEVATED_MANAGERS.has(definition.id),
    platforms: [...(PLATFORM_OVERRIDES[definition.id] || ALL_PLATFORMS)]
  }
}

function integrationKind(managerId: DependencyManagerId): ManagerIntegrationKind {
  if (AUTOMATION_MANAGERS.has(managerId)) return 'automation'
  if (BUILD_MANAGERS.has(managerId)) return 'build'
  if (DECLARATIVE_MANAGERS.has(managerId)) return 'declarative'
  if (RUNTIME_MANAGERS.has(managerId)) return 'runtime'
  return 'package'
}

function operationsFromCapabilities(capabilities: readonly ManagerCapability[]): ManagerOperation[] {
  const operations = new Set<ManagerOperation>(['list'])
  if (hasAny(capabilities, 'install', 'lockfile')) operations.add('sync')
  if (capabilities.includes('install')) operations.add('install')
  if (capabilities.includes('uninstall')) operations.add('remove')
  if (hasAny(capabilities, 'update', 'batch-update', 'version-switch')) {
    operations.add('update')
    operations.add('outdated')
  }
  if (hasAny(capabilities, 'audit', 'health', 'container-scan')) operations.add('audit')
  if (capabilities.includes('dependency-tree')) operations.add('tree')
  if (capabilities.includes('lockfile')) operations.add('lock')
  return [...operations]
}

function hasAny(
  capabilities: readonly ManagerCapability[],
  ...expected: ManagerCapability[]
): boolean {
  return expected.some((capability) => capabilities.includes(capability))
}
