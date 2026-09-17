export type ImplementedPackageManagerId =
  | 'npm'
  | 'pip'
  | 'maven'
  | 'cargo'
  | 'gradle'
  | 'go'
  | 'flutter'
  | 'native'

export type FuturePackageManagerId =
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'deno'
  | 'uv'
  | 'poetry'
  | 'pipenv'
  | 'conda'
  | 'renv'
  | 'julia'
  | 'nuget'
  | 'composer'
  | 'bundler'
  | 'sbt'
  | 'leiningen'
  | 'mix'
  | 'rebar3'
  | 'cabal'
  | 'stack'
  | 'swiftpm'
  | 'cocoapods'
  | 'helm'
  | 'docker'
  | 'kustomize'
  | 'helmfile'
  | 'skaffold'
  | 'argocd'
  | 'flux'
  | 'terraform'
  | 'opentofu'
  | 'ansible'
  | 'github-actions'
  | 'gitlab-ci'
  | 'pre-commit'
  | 'bazel'
  | 'pants'
  | 'buck'
  | 'opam'
  | 'cpan'
  | 'luarocks'
  | 'shards'
  | 'zig'
  | 'homebrew'
  | 'chocolatey'
  | 'scoop'
  | 'winget'
  | 'asdf'
  | 'mise'
  | 'sdkman'
  | 'apt'
  | 'dnf'
  | 'apk'
  | 'pacman'
  | 'nix'
  | 'mcp'
  | 'skills'
  | 'ai-agents'

export type DependencyManagerId = ImplementedPackageManagerId | FuturePackageManagerId
export type ManagerImplementationStatus = 'stable' | 'preview' | 'planned'
export type ManagerScope = 'project' | 'environment' | 'global' | 'repository' | 'publish'

export type ManagerCapability =
  | 'search'
  | 'install'
  | 'uninstall'
  | 'update'
  | 'batch-update'
  | 'version-switch'
  | 'dependency-tree'
  | 'health'
  | 'audit'
  | 'publish'
  | 'scripts'
  | 'tasks'
  | 'toolchain'
  | 'registry-config'
  | 'cache'
  | 'lockfile'
  | 'assets'
  | 'build'
  | 'sbom'
  | 'license-policy'
  | 'container-scan'

export interface ManagerCapabilityDeclaration {
  /** Capabilities planned for the manager, regardless of implementation status. */
  target: readonly ManagerCapability[]
  /** Capabilities actually exposed by a registered adapter / dedicated page. */
  implemented: readonly ManagerCapability[]
}
export interface DependencyManagerDefinition {
  id: DependencyManagerId
  name: string
  shortName: string
  language: string
  ecosystem: string
  packageManager: string
  category: string
  tools: readonly string[]
  manifestFiles: readonly string[]
  lockFiles: readonly string[]
  configFiles?: readonly string[]
  detectionFiles?: readonly string[]
  capabilities: readonly ManagerCapability[]
  scopes: readonly ManagerScope[]
  scenarios: readonly string[]
  productionTools: readonly string[]
  route?: string
  builtIn: boolean
  implemented: boolean
  status: ManagerImplementationStatus
  searchable: boolean
  healthSupported: boolean
  /** One source of truth for desired versus delivered capability facts. */
  capabilityDeclaration?: ManagerCapabilityDeclaration
}
