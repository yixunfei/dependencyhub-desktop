import type { DependencyManagerId } from './registry'

export type NpmWorkspaceScope = 'project' | 'global' | 'publish'

export interface NpmWorkspaceScopeItem {
  key: NpmWorkspaceScope
  title: string
  description: string
  path: string
}

export interface ManagerWorkspaceGroup {
  key: string
  route: string
  label: string
  shortLabel: string
  description: string
  iconManagerId: DependencyManagerId
  managerIds: readonly DependencyManagerId[]
  legacyRoutes?: readonly string[]
  scopeRoutes?: readonly NpmWorkspaceScopeItem[]
}

export const NPM_WORKSPACE_SCOPES: readonly NpmWorkspaceScopeItem[] = [
  {
    key: 'project',
    title: 'Project dependencies',
    description: 'Manage package.json dependencies, scripts, audits, dependency trees, and project installs.',
    path: '/npm/project'
  },
  {
    key: 'global',
    title: 'Global packages',
    description: 'Manage global npm packages, prefix/cache settings, global upgrades, and global audits.',
    path: '/npm/global'
  },
  {
    key: 'publish',
    title: 'Publish workflow',
    description: 'Run pre-publish checks, metadata review, readiness gates, and npm publish operations.',
    path: '/npm/publish'
  }
]

export const MANAGER_WORKSPACE_GROUPS: readonly ManagerWorkspaceGroup[] = [
  {
    key: 'npm',
    route: '/npm',
    label: 'npm / Node.js Workbench',
    shortLabel: 'npm',
    description: 'One npm surface for project, global, and publish workflows instead of separate top-level pages.',
    iconManagerId: 'npm',
    managerIds: ['npm'],
    legacyRoutes: ['/project', '/global', '/publish', '/multi-manager'],
    scopeRoutes: NPM_WORKSPACE_SCOPES
  },
  {
    key: 'node',
    route: '/node',
    label: 'Node+ Package Managers',
    shortLabel: 'Node+',
    description: 'pnpm, Yarn, and Bun project dependency workflows.',
    iconManagerId: 'pnpm',
    managerIds: ['pnpm', 'yarn', 'bun']
  },
  {
    key: 'python',
    route: '/python',
    label: 'Python+ Environments',
    shortLabel: 'Python+',
    description: 'uv, Poetry, Pipenv, and Conda environment dependencies.',
    iconManagerId: 'uv',
    managerIds: ['uv', 'poetry', 'pipenv', 'conda']
  },
  {
    key: 'backend',
    route: '/backend',
    label: 'Backend+ Packages',
    shortLabel: 'Backend+',
    description: '.NET, PHP, and Ruby package-manager workflows.',
    iconManagerId: 'nuget',
    managerIds: ['nuget', 'composer', 'bundler']
  },
  {
    key: 'cloud',
    route: '/cloud',
    label: 'Cloud+ Dependencies',
    shortLabel: 'Cloud+',
    description: 'Docker images, Helm charts, Kubernetes overlays, delivery pipelines, and GitOps source dependencies.',
    iconManagerId: 'docker',
    managerIds: ['docker', 'helm', 'kustomize', 'helmfile', 'skaffold', 'argocd', 'flux']
  },
  {
    key: 'platform',
    route: '/platform',
    label: 'Platform+ Packages',
    shortLabel: 'Platform+',
    description: 'Deno imports, Swift packages, and CocoaPods dependencies.',
    iconManagerId: 'swiftpm',
    managerIds: ['deno', 'swiftpm', 'cocoapods']
  },
  {
    key: 'ai',
    route: '/ai',
    label: 'AI Dependencies',
    shortLabel: 'AI',
    description: 'MCP servers, agent skills, and agent instruction dependencies with pinning, provenance, and lock evidence.',
    iconManagerId: 'mcp',
    managerIds: ['mcp', 'skills', 'ai-agents']
  },
  {
    key: 'polyglot',
    route: '/polyglot',
    label: 'Polyglot+ Packages',
    shortLabel: 'Polyglot+',
    description: 'JVM, BEAM, and Haskell dependency workflows.',
    iconManagerId: 'sbt',
    managerIds: ['sbt', 'leiningen', 'mix', 'rebar3', 'cabal', 'stack']
  },
  {
    key: 'data',
    route: '/data',
    label: 'Data+ Environments',
    shortLabel: 'Data+',
    description: 'R/renv and Julia reproducible research dependencies.',
    iconManagerId: 'renv',
    managerIds: ['renv', 'julia']
  },
  {
    key: 'infra',
    route: '/infra',
    label: 'Infra+ Dependencies',
    shortLabel: 'Infra+',
    description: 'Terraform/OpenTofu providers, modules, and Ansible Galaxy content.',
    iconManagerId: 'terraform',
    managerIds: ['terraform', 'opentofu', 'ansible']
  },
  {
    key: 'automation',
    route: '/automation',
    label: 'Automation+ Dependencies',
    shortLabel: 'Automation+',
    description: 'CI actions, GitLab includes, components, and pre-commit hooks.',
    iconManagerId: 'github-actions',
    managerIds: ['github-actions', 'gitlab-ci', 'pre-commit']
  },
  {
    key: 'build',
    route: '/build',
    label: 'Build+ Systems',
    shortLabel: 'Build+',
    description: 'Bazel, Pants, and Buck build graph dependencies.',
    iconManagerId: 'bazel',
    managerIds: ['bazel', 'pants', 'buck']
  },
  {
    key: 'systems',
    route: '/systems',
    label: 'Systems+ Packages',
    shortLabel: 'Systems+',
    description: 'OCaml, Perl, Lua, Crystal, and Zig dependency manifests.',
    iconManagerId: 'opam',
    managerIds: ['opam', 'cpan', 'luarocks', 'shards', 'zig']
  },
  {
    key: 'runtime',
    route: '/runtime',
    label: 'Runtime+ OS/SDK Tools',
    shortLabel: 'Runtime+',
    description: 'System package baselines, Linux image packages, Nix shells, and runtime version pins for workstations, CI, and release images.',
    iconManagerId: 'homebrew',
    managerIds: ['homebrew', 'chocolatey', 'scoop', 'winget', 'asdf', 'mise', 'sdkman', 'apt', 'dnf', 'apk', 'pacman', 'nix']
  }
]

export function findWorkspaceGroupByPath(pathname: string): ManagerWorkspaceGroup | undefined {
  const normalizedPath = pathname.split(/[?#]/)[0] || '/'
  return MANAGER_WORKSPACE_GROUPS.find((group) => (
    normalizedPath === group.route ||
    normalizedPath.startsWith(`${group.route}/`) ||
    Boolean(group.legacyRoutes?.includes(normalizedPath))
  ))
}

export function managerWorkspaceRouteForManager(managerId: DependencyManagerId): string | undefined {
  return MANAGER_WORKSPACE_GROUPS.find((group) => group.managerIds.includes(managerId))?.route
}
