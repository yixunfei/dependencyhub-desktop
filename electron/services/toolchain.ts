import { app, shell } from 'electron'
import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { runLoggedCommand } from './commandRunner'
import { toolchainLimiter } from './concurrency'

export const TOOL_NAMES = [
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'pip',
  'uv',
  'poetry',
  'pipenv',
  'conda',
  'rscript',
  'julia',
  'maven',
  'gradle',
  'sbt',
  'lein',
  'cargo',
  'go',
  'flutter',
  'dotnet',
  'composer',
  'ruby',
  'bundle',
  'mix',
  'rebar3',
  'cabal',
  'stack',
  'swift',
  'pod',
  'helm',
  'docker',
  'kustomize',
  'helmfile',
  'skaffold',
  'argocd',
  'flux',
  'terraform',
  'tofu',
  'ansible-galaxy',
  'gh',
  'glab',
  'pre-commit',
  'bazel',
  'pants',
  'buck2',
  'opam',
  'cpanm',
  'luarocks',
  'shards',
  'zig',
  'brew',
  'choco',
  'scoop',
  'winget',
  'asdf',
  'mise',
  'sdk',
  'apt-get',
  'dnf',
  'apk',
  'pacman',
  'nix',
  'cmake',
  'vcpkg',
  'conan'
] as const
export type ToolName = typeof TOOL_NAMES[number]

export type ToolchainConfig = Partial<Record<ToolName, string>>

export interface ToolStatus {
  tool: ToolName
  available: boolean
  version: string
  configuredPath?: string
  downloadUrl: string
  message?: string
}

const DEFAULT_DOWNLOADS: Record<ToolName, string> = {
  npm: 'https://nodejs.org/en/download',
  pnpm: 'https://pnpm.io/installation',
  yarn: 'https://yarnpkg.com/getting-started/install',
  bun: 'https://bun.sh/docs/installation',
  deno: 'https://docs.deno.com/runtime/getting_started/installation/',
  pip: 'https://www.python.org/downloads/',
  uv: 'https://docs.astral.sh/uv/getting-started/installation/',
  poetry: 'https://python-poetry.org/docs/#installation',
  pipenv: 'https://pipenv.pypa.io/en/latest/installation.html',
  conda: 'https://docs.conda.io/projects/conda/en/latest/user-guide/install/index.html',
  rscript: 'https://cran.r-project.org/',
  julia: 'https://julialang.org/downloads/',
  maven: 'https://maven.apache.org/download.cgi',
  gradle: 'https://gradle.org/install/',
  sbt: 'https://www.scala-sbt.org/download/',
  lein: 'https://leiningen.org/',
  cargo: 'https://www.rust-lang.org/tools/install',
  go: 'https://go.dev/dl/',
  flutter: 'https://docs.flutter.dev/get-started/install',
  dotnet: 'https://dotnet.microsoft.com/download',
  composer: 'https://getcomposer.org/download/',
  ruby: 'https://www.ruby-lang.org/en/downloads/',
  bundle: 'https://bundler.io/',
  mix: 'https://elixir-lang.org/install.html',
  rebar3: 'https://www.rebar3.org/docs/getting-started/',
  cabal: 'https://www.haskell.org/cabal/',
  stack: 'https://docs.haskellstack.org/en/stable/install_and_upgrade/',
  swift: 'https://www.swift.org/install/',
  pod: 'https://guides.cocoapods.org/using/getting-started.html',
  helm: 'https://helm.sh/docs/intro/install/',
  docker: 'https://docs.docker.com/get-docker/',
  kustomize: 'https://kubectl.docs.kubernetes.io/installation/kustomize/',
  helmfile: 'https://helmfile.readthedocs.io/en/latest/#installation',
  skaffold: 'https://skaffold.dev/docs/install/',
  argocd: 'https://argo-cd.readthedocs.io/en/stable/cli_installation/',
  flux: 'https://fluxcd.io/flux/installation/',
  terraform: 'https://developer.hashicorp.com/terraform/install',
  tofu: 'https://opentofu.org/docs/intro/install/',
  'ansible-galaxy': 'https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html',
  gh: 'https://cli.github.com/',
  glab: 'https://gitlab.com/gitlab-org/cli',
  'pre-commit': 'https://pre-commit.com/#install',
  bazel: 'https://bazel.build/install',
  pants: 'https://www.pantsbuild.org/stable/docs/getting-started/installing-pants',
  buck2: 'https://buck2.build/docs/getting_started/',
  opam: 'https://opam.ocaml.org/doc/Install.html',
  cpanm: 'https://metacpan.org/pod/App::cpanminus',
  luarocks: 'https://luarocks.org/#quick-start',
  shards: 'https://crystal-lang.org/install/',
  zig: 'https://ziglang.org/download/',
  brew: 'https://brew.sh/',
  choco: 'https://chocolatey.org/install',
  scoop: 'https://scoop.sh/',
  winget: 'https://learn.microsoft.com/windows/package-manager/winget/',
  asdf: 'https://asdf-vm.com/guide/getting-started.html',
  mise: 'https://mise.jdx.dev/getting-started.html',
  sdk: 'https://sdkman.io/install/',
  'apt-get': 'https://wiki.debian.org/Apt',
  dnf: 'https://docs.fedoraproject.org/en-US/quick-docs/dnf/',
  apk: 'https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper',
  pacman: 'https://wiki.archlinux.org/title/Pacman',
  nix: 'https://nixos.org/download/',
  cmake: 'https://cmake.org/download/',
  vcpkg: 'https://learn.microsoft.com/vcpkg/get_started/get-started',
  conan: 'https://conan.io/downloads'
}

const DEFAULT_BINS: Record<ToolName, string> = {
  npm: process.platform === 'win32' ? 'npm.cmd' : 'npm',
  pnpm: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  yarn: process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
  bun: process.platform === 'win32' ? 'bun.exe' : 'bun',
  deno: process.platform === 'win32' ? 'deno.exe' : 'deno',
  pip: process.platform === 'win32' ? 'pip.exe' : 'pip',
  uv: process.platform === 'win32' ? 'uv.exe' : 'uv',
  poetry: process.platform === 'win32' ? 'poetry.exe' : 'poetry',
  pipenv: process.platform === 'win32' ? 'pipenv.exe' : 'pipenv',
  conda: process.platform === 'win32' ? 'conda.exe' : 'conda',
  rscript: process.platform === 'win32' ? 'Rscript.exe' : 'Rscript',
  julia: process.platform === 'win32' ? 'julia.exe' : 'julia',
  maven: process.platform === 'win32' ? 'mvn.cmd' : 'mvn',
  gradle: process.platform === 'win32' ? 'gradle.bat' : 'gradle',
  sbt: process.platform === 'win32' ? 'sbt.bat' : 'sbt',
  lein: process.platform === 'win32' ? 'lein.bat' : 'lein',
  cargo: process.platform === 'win32' ? 'cargo.exe' : 'cargo',
  go: process.platform === 'win32' ? 'go.exe' : 'go',
  flutter: process.platform === 'win32' ? 'flutter.bat' : 'flutter',
  dotnet: process.platform === 'win32' ? 'dotnet.exe' : 'dotnet',
  composer: process.platform === 'win32' ? 'composer.bat' : 'composer',
  ruby: process.platform === 'win32' ? 'ruby.exe' : 'ruby',
  bundle: process.platform === 'win32' ? 'bundle.bat' : 'bundle',
  mix: process.platform === 'win32' ? 'mix.bat' : 'mix',
  rebar3: process.platform === 'win32' ? 'rebar3.cmd' : 'rebar3',
  cabal: process.platform === 'win32' ? 'cabal.exe' : 'cabal',
  stack: process.platform === 'win32' ? 'stack.exe' : 'stack',
  swift: process.platform === 'win32' ? 'swift.exe' : 'swift',
  pod: process.platform === 'win32' ? 'pod.bat' : 'pod',
  helm: process.platform === 'win32' ? 'helm.exe' : 'helm',
  docker: process.platform === 'win32' ? 'docker.exe' : 'docker',
  kustomize: process.platform === 'win32' ? 'kustomize.exe' : 'kustomize',
  helmfile: process.platform === 'win32' ? 'helmfile.exe' : 'helmfile',
  skaffold: process.platform === 'win32' ? 'skaffold.exe' : 'skaffold',
  argocd: process.platform === 'win32' ? 'argocd.exe' : 'argocd',
  flux: process.platform === 'win32' ? 'flux.exe' : 'flux',
  terraform: process.platform === 'win32' ? 'terraform.exe' : 'terraform',
  tofu: process.platform === 'win32' ? 'tofu.exe' : 'tofu',
  'ansible-galaxy': process.platform === 'win32' ? 'ansible-galaxy.exe' : 'ansible-galaxy',
  gh: process.platform === 'win32' ? 'gh.exe' : 'gh',
  glab: process.platform === 'win32' ? 'glab.exe' : 'glab',
  'pre-commit': process.platform === 'win32' ? 'pre-commit.exe' : 'pre-commit',
  bazel: process.platform === 'win32' ? 'bazel.exe' : 'bazel',
  pants: process.platform === 'win32' ? 'pants.exe' : 'pants',
  buck2: process.platform === 'win32' ? 'buck2.exe' : 'buck2',
  opam: process.platform === 'win32' ? 'opam.exe' : 'opam',
  cpanm: process.platform === 'win32' ? 'cpanm.bat' : 'cpanm',
  luarocks: process.platform === 'win32' ? 'luarocks.bat' : 'luarocks',
  shards: process.platform === 'win32' ? 'shards.exe' : 'shards',
  zig: process.platform === 'win32' ? 'zig.exe' : 'zig',
  brew: 'brew',
  choco: process.platform === 'win32' ? 'choco.exe' : 'choco',
  scoop: process.platform === 'win32' ? 'scoop.cmd' : 'scoop',
  winget: process.platform === 'win32' ? 'winget.exe' : 'winget',
  asdf: process.platform === 'win32' ? 'asdf.exe' : 'asdf',
  mise: process.platform === 'win32' ? 'mise.exe' : 'mise',
  sdk: process.platform === 'win32' ? 'sdk.bat' : 'sdk',
  'apt-get': 'apt-get',
  dnf: process.platform === 'win32' ? 'dnf.exe' : 'dnf',
  apk: process.platform === 'win32' ? 'apk.exe' : 'apk',
  pacman: process.platform === 'win32' ? 'pacman.exe' : 'pacman',
  nix: process.platform === 'win32' ? 'nix.exe' : 'nix',
  cmake: process.platform === 'win32' ? 'cmake.exe' : 'cmake',
  vcpkg: process.platform === 'win32' ? 'vcpkg.exe' : 'vcpkg',
  conan: process.platform === 'win32' ? 'conan.exe' : 'conan'
}

export async function getToolchainConfig(projectPath?: string): Promise<ToolchainConfig> {
  const globalConfig = await readToolchainConfig(configPath())
  if (!projectPath) {
    return globalConfig
  }

  const projectConfig = await readToolchainConfig(projectConfigPath(projectPath))
  return { ...globalConfig, ...projectConfig }
}

export async function getProjectToolchainConfig(projectPath: string): Promise<ToolchainConfig> {
  return await readToolchainConfig(projectConfigPath(projectPath))
}

export async function setToolPath(tool: ToolName, toolPath: string, projectPath?: string): Promise<ToolchainConfig> {
  const targetPath = projectPath ? projectConfigPath(projectPath) : configPath()
  const config = await readToolchainConfig(targetPath)
  const value = toolPath.trim()
  if (value) {
    config[tool] = value
  } else {
    delete config[tool]
  }

  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, JSON.stringify(config, null, 2), 'utf-8')
  return config
}

export async function clearToolPath(tool: ToolName, projectPath?: string): Promise<ToolchainConfig> {
  return await setToolPath(tool, '', projectPath)
}

export async function resolveToolBin(tool: ToolName, projectPath?: string): Promise<string> {
  const config = await getToolchainConfig(projectPath)
  const configuredPath = config[tool]
  if (!configuredPath) return DEFAULT_BINS[tool]

  if (await isDirectory(configuredPath)) {
    return await firstExisting(directoryBinCandidates(tool, configuredPath), join(configuredPath, DEFAULT_BINS[tool]))
  }

  return configuredPath
}

export async function checkTool(tool: ToolName, projectPath?: string): Promise<ToolStatus> {
  const config = await getToolchainConfig(projectPath)
  const configuredPath = config[tool]
  const candidates = await getCheckCandidates(tool, configuredPath)

  let lastError: any
  for (const candidate of candidates) {
    try {
      if (candidate.configured) {
        await accessIfConfigured(configuredPath)
      }
      const { stdout, stderr } = await runLoggedCommand(candidate.bin, candidate.args, {
        log: false,
        maxBuffer: 1024 * 1024,
        displayBin: tool === 'maven' ? 'mvn' : tool
      })
      return {
        tool,
        available: true,
        version: (stdout || stderr).split(/\r?\n/)[0]?.trim() || 'available',
        configuredPath,
        downloadUrl: DEFAULT_DOWNLOADS[tool]
      }
    } catch (error: any) {
      lastError = error
    }
  }

  return {
    tool,
    available: false,
    version: '',
    configuredPath,
    downloadUrl: DEFAULT_DOWNLOADS[tool],
    message: lastError?.message || `${tool} is not available`
  }
}

export async function checkTools(projectPath?: string): Promise<ToolStatus[]> {
  // Sixty-six tools every executed as separate processes saturated smaller
  // machines and starved the command the user was actually waiting for.
  return toolchainLimiter.runAll(TOOL_NAMES, (tool) => checkTool(tool, projectPath))
}

export async function openToolDownload(tool: ToolName): Promise<void> {
  await shell.openExternal(DEFAULT_DOWNLOADS[tool])
}

function configPath(): string {
  return join(app.getPath('userData'), 'toolchain.json')
}

function projectConfigPath(projectPath: string): string {
  return join(projectPath, '.npmDesktopManager', 'toolchain.json')
}

async function readToolchainConfig(path: string): Promise<ToolchainConfig> {
  try {
    return JSON.parse(await readFile(path, 'utf-8'))
  } catch {
    return {}
  }
}

async function accessIfConfigured(toolPath?: string): Promise<void> {
  if (toolPath) {
    await access(toolPath)
  }
}

async function getCheckCandidates(tool: ToolName, configuredPath?: string): Promise<Array<{ bin: string; args: string[]; configured?: boolean }>> {
  if (configuredPath) {
    if (await isDirectory(configuredPath)) {
      if (tool === 'pip') {
        return [
          { bin: join(configuredPath, 'python.exe'), args: ['-m', 'pip', '--version'], configured: true },
          { bin: join(configuredPath, 'python'), args: ['-m', 'pip', '--version'], configured: true },
          { bin: join(configuredPath, 'Scripts', 'pip.exe'), args: ['--version'], configured: true },
          { bin: join(configuredPath, 'bin', 'pip'), args: ['--version'], configured: true },
          { bin: join(configuredPath, DEFAULT_BINS.pip), args: ['--version'], configured: true }
        ]
      }
      if (tool === 'maven') {
        return directoryBinCandidates(tool, configuredPath).map((bin) => ({ bin, args: versionArgs(tool), configured: true }))
      }
      return directoryBinCandidates(tool, configuredPath).map((bin) => ({ bin, args: versionArgs(tool), configured: true }))
    }

    return [{ bin: configuredPath, args: versionArgs(tool), configured: true }]
  }

  if (tool === 'pip') {
    return process.platform === 'win32'
      ? [
          { bin: 'python.exe', args: ['-m', 'pip', '--version'] },
          { bin: 'py.exe', args: ['-m', 'pip', '--version'] },
          { bin: 'pip.exe', args: ['--version'] }
        ]
      : [
          { bin: 'python3', args: ['-m', 'pip', '--version'] },
          { bin: 'python', args: ['-m', 'pip', '--version'] },
          { bin: 'pip3', args: ['--version'] },
          { bin: 'pip', args: ['--version'] }
        ]
  }

  return [{ bin: DEFAULT_BINS[tool], args: versionArgs(tool) }]
}

function directoryBinCandidates(tool: ToolName, directory: string): string[] {
  if (tool === 'npm') {
    return [join(directory, DEFAULT_BINS[tool])]
  }

  if (tool === 'pip') {
    return [
      join(directory, DEFAULT_BINS[tool]),
      join(directory, 'Scripts', DEFAULT_BINS[tool]),
      join(directory, 'bin', DEFAULT_BINS[tool])
    ]
  }

  if (tool === 'vcpkg') {
    return [
      join(directory, DEFAULT_BINS[tool]),
      join(directory, 'bin', DEFAULT_BINS[tool])
    ]
  }

  return [
    join(directory, DEFAULT_BINS[tool]),
    join(directory, 'bin', DEFAULT_BINS[tool]),
    join(directory, 'Scripts', DEFAULT_BINS[tool])
  ]
}

function versionArgs(tool: ToolName): string[] {
  if (tool === 'maven' || tool === 'gradle') return ['-version']
  if (tool === 'go' || tool === 'flutter' || tool === 'cmake' || tool === 'conan') return ['--version']
  if (tool === 'vcpkg') return ['version']
  return ['--version']
}

async function firstExisting(paths: string[], fallback: string): Promise<string> {
  for (const path of paths) {
    try {
      await access(path)
      return path
    } catch {
    }
  }
  return fallback
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}
