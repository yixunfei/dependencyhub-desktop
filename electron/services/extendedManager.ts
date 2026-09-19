import { recoverCommandFailure } from './commandRecovery'
import { createHash } from 'crypto'
import { access, mkdir, readFile, readdir, unlink, writeFile } from 'fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'path'
import { writeFileAtomic } from './atomicWrite'
import {
  MANAGER_DEFINITIONS,
  getManagerDefinition,
  getManagerDetectionFiles,
  type DependencyManagerDefinition,
  type DependencyManagerId
} from '../../shared/managerRegistry'
import { runLoggedCommand, type LoggedCommandOptions } from './commandRunner'
import { commandMutatesProjectFiles } from './commandMutates'
import { withProjectMutation } from './projectMutation'
import { splitCommandLine } from './splitCommandLine'
import { resolveToolBin, type ToolName } from './toolchain'
import {
  createNodeOperationTemplate,
  isNodeWorkspaceManager,
  nodeDryRunTemplate
} from '../managers/groups/node/nodeOperations'
import { readNodeManagerInventory } from '../managers/groups/node/nodeInventory'
import {
  backendDryRunTemplate,
  createBackendOperationTemplate
} from '../managers/groups/backend/backendOperations'
import { isBackendWorkspaceManager } from '../managers/groups/backend/backendTypes'
import {
  createPythonOperationTemplate,
  pythonDryRunTemplate
} from '../managers/groups/python/pythonOperations'
import { isPythonWorkspaceManager } from '../managers/groups/python/pythonTypes'
import { readPythonManagerInventory } from '../managers/groups/python/pythonInventory'
import { readBackendManagerInventory } from '../managers/groups/backend/backendInventory'
import { readAiManagerInventory } from '../managers/groups/ai/aiInventory'
import { findWorkspaceFiles } from '../managers/workspaceFiles'
import { existingPatternMatches, wildcardToRegExp } from '../managers/patternFiles'

export interface ExtendedManagerDetection {
  id: DependencyManagerId
  name: string
  language: string
  packageManager: string
  implemented: boolean
  detected: boolean
  files: string[]
  tools: readonly string[]
  route?: string
}

export interface ExtendedDependencyInfo {
  managerId: DependencyManagerId
  name: string
  version?: string
  type: string
  source?: string
  file: string
}

export interface ExtendedManagerCommandResult {
  command: string
  stdout: string
  stderr: string
  backup?: ExtendedManagerBackup
  restore?: { attempted: boolean; restored: boolean; error?: string; conflicts?: ExtendedManagerRestoreConflict[] }
}

export type ExtendedManagerOperation =
  | 'sync'
  | 'install'
  | 'remove'
  | 'update'
  | 'outdated'
  | 'audit'
  | 'tree'
  | 'list'
  | 'lock'

export interface ExtendedManagerOperationRequest {
  operation: ExtendedManagerOperation
  packageName?: string
  version?: string
  dev?: boolean
  options?: Record<string, string | number | boolean>
}

export interface ExtendedManagerOperationPlan {
  managerId: DependencyManagerId
  managerName: string
  operation: ExtendedManagerOperation
  tool: ToolName
  command: string
  args: string[]
  mutating: boolean
  dryRunSupported: boolean
  dryRunCommand?: string
  backupFiles: ExtendedManagerBackupFile[]
  warnings: string[]
  requirements: string[]
  generatedAt: string
}

export interface ExtendedManagerBackupFile {
  file: string
  hash: string
  size: number
  exists: boolean
}

export interface ExtendedManagerBackup {
  id: string
  managerId: DependencyManagerId
  projectPath: string
  createdAt: string
  mutating: boolean
  path: string
  files: ExtendedManagerBackupFile[]
}

export interface ExtendedManagerCommandResult {
  command: string
  stdout: string
  stderr: string
  backup?: ExtendedManagerBackup
  restore?: { attempted: boolean; restored: boolean; error?: string; conflicts?: ExtendedManagerRestoreConflict[] }
}

export interface ExtendedManagerRestoreConflict {
  file: string
  expectedExists: boolean
  actualExists: boolean
  expectedHash: string
  actualHash: string
}

export type ExtendedManagerOperationContext = Pick<LoggedCommandOptions, 'signal' | 'timeoutMs' | 'operationId'>

export interface ExtendedManagerRestoreResult {
  backupPath: string
  restoredCount: number
  restoredFiles: string[]
  conflicts: ExtendedManagerRestoreConflict[]
}

interface ExtendedManagerBackupPayload extends Omit<ExtendedManagerBackup, 'files'> {
  commandLine: string
  files: Array<ExtendedManagerBackupFile & { content: string }>
}

const BACKUP_DIR = '.npmDesktopManager/backups/extended'
/** One backup per mutation is plenty of history; older ones are unreachable anyway. */
const MAX_COMMAND_BACKUPS = 25
const NIX_TOKEN_STOP_WORDS = new Set([
  'inherit',
  'let',
  'in',
  'with',
  'pkgs',
  'rec',
  'true',
  'false',
  'null'
])

export class ExtendedManagerService {
  async detected(cwd: string): Promise<ExtendedManagerDetection[]> {
    return await Promise.all(
      MANAGER_DEFINITIONS.filter((manager) => !manager.builtIn).map(async (manager) => {
        const files = await existingPatternMatches(cwd, getManagerDetectionFiles(manager))
        return {
          id: manager.id,
          name: manager.name,
          language: manager.language,
          packageManager: manager.packageManager,
          implemented: manager.implemented,
          detected: files.length > 0,
          files,
          tools: manager.tools,
          route: manager.route
        }
      })
    )
  }

  async list(cwd: string, managerId: DependencyManagerId): Promise<ExtendedDependencyInfo[]> {
    const manager = getManagerDefinition(managerId)
    if (!manager) {
      throw new Error(`Unknown dependency manager: ${managerId}`)
    }
    if (isNodeWorkspaceManager(managerId)) return await readNodeManagerInventory(cwd, managerId)
    if (isPythonWorkspaceManager(managerId)) return await readPythonManagerInventory(cwd, managerId)
    if (isBackendWorkspaceManager(managerId)) return await readBackendManagerInventory(cwd, managerId)

    switch (managerId) {
      case 'deno':
        return await parseDenoDependencies(cwd)
      case 'renv':
        return await parseRenvDependencies(cwd)
      case 'julia':
        return await parseJuliaDependencies(cwd)
      case 'sbt':
        return await parseSbtDependencies(cwd)
      case 'leiningen':
        return await parseLeiningenDependencies(cwd)
      case 'mix':
        return await parseMixDependencies(cwd)
      case 'rebar3':
        return await parseRebarDependencies(cwd)
      case 'cabal':
        return await parseCabalDependencies(cwd)
      case 'stack':
        return await parseStackDependencies(cwd)
      case 'swiftpm':
        return await parseSwiftPackageDependencies(cwd)
      case 'cocoapods':
        return await parsePodfileDependencies(cwd)
      case 'helm':
        return await parseHelmDependencies(cwd)
      case 'docker':
        return await parseDockerDependencies(cwd)
      case 'kustomize':
        return await parseKustomizeDependencies(cwd)
      case 'helmfile':
        return await parseHelmfileDependencies(cwd)
      case 'skaffold':
        return await parseSkaffoldDependencies(cwd)
      case 'argocd':
        return await parseArgoCdDependencies(cwd)
      case 'flux':
        return await parseFluxDependencies(cwd)
      case 'terraform':
      case 'opentofu':
        return await parseTerraformDependencies(cwd, managerId)
      case 'ansible':
        return await parseAnsibleDependencies(cwd)
      case 'github-actions':
        return await parseGitHubActionsDependencies(cwd)
      case 'gitlab-ci':
        return await parseGitLabCiDependencies(cwd)
      case 'pre-commit':
        return await parsePreCommitDependencies(cwd)
      case 'bazel':
        return await parseBazelDependencies(cwd)
      case 'pants':
        return await parsePantsDependencies(cwd)
      case 'buck':
        return await parseBuckDependencies(cwd)
      case 'opam':
        return await parseOpamDependencies(cwd)
      case 'cpan':
        return await parseCpanDependencies(cwd)
      case 'luarocks':
        return await parseLuaRocksDependencies(cwd)
      case 'shards':
        return await parseShardsDependencies(cwd)
      case 'zig':
        return await parseZigDependencies(cwd)
      case 'homebrew':
        return await parseHomebrewDependencies(cwd)
      case 'chocolatey':
        return await parseChocolateyDependencies(cwd)
      case 'scoop':
        return await parseScoopDependencies(cwd)
      case 'winget':
        return await parseWingetDependencies(cwd)
      case 'asdf':
        return await parseAsdfDependencies(cwd)
      case 'mise':
        return await parseMiseDependencies(cwd)
      case 'sdkman':
        return await parseSdkmanDependencies(cwd)
      case 'apt':
        return await parseSystemPackageLineDependencies(cwd, 'apt', ['apt-packages.txt', 'packages.apt', 'debian-packages.txt'], 'deb-package')
      case 'dnf':
        return await parseSystemPackageLineDependencies(cwd, 'dnf', ['dnf-packages.txt', 'rpm-packages.txt', 'packages.dnf'], 'rpm-package')
      case 'apk':
        return await parseSystemPackageLineDependencies(cwd, 'apk', ['apk-packages.txt', 'packages.apk'], 'apk-package')
      case 'pacman':
        return await parseSystemPackageLineDependencies(cwd, 'pacman', ['pacman-packages.txt', 'packages.pacman'], 'arch-package')
      case 'nix':
        return await parseNixDependencies(cwd)
      default:
        return await parseUnmappedManagerDependencies(cwd, manager)
    }
  }

  async plan(
    cwd: string,
    managerId: DependencyManagerId,
    request: ExtendedManagerOperationRequest
  ): Promise<ExtendedManagerOperationPlan> {
    const manager = getManagerDefinition(managerId)
    if (!manager || manager.tools.length === 0) {
      throw new Error(`No runnable tool is configured for ${managerId}`)
    }

    const tool = primaryRunTool(manager)
    const template = await operationTemplate(cwd, manager.id, request)
    if (template.supported === false) {
      throw new Error(`${manager.id} does not support ${request.operation}`)
    }
    const args = template.args
    const mutating = commandMutatesProjectFiles(args)
    const backupFiles = mutating
      ? await readBackupFilePreview(cwd, manager)
      : []
    const dryRunArgs = mutating ? dryRunTemplate(manager.id, args) : null
    const warnings = [
      ...template.warnings,
      ...(mutating && backupFiles.length === 0
        ? ['No manifest, lock, or config files were found to back up before execution.']
        : []),
      ...(mutating && !dryRunArgs
        ? ['This manager operation does not have a reliable generic dry-run command.']
        : [])
    ]

    return {
      managerId: manager.id,
      managerName: manager.name,
      operation: request.operation,
      tool,
      command: [tool, ...args].join(' '),
      args,
      mutating,
      dryRunSupported: Boolean(dryRunArgs),
      dryRunCommand: dryRunArgs ? [tool, ...dryRunArgs].join(' ') : undefined,
      backupFiles,
      warnings,
      requirements: template.requirements,
      generatedAt: new Date().toISOString()
    }
  }

  async run(
    cwd: string,
    managerId: DependencyManagerId,
    commandLine: string,
    context?: ExtendedManagerOperationContext
  ): Promise<ExtendedManagerCommandResult> {
    const manager = getManagerDefinition(managerId)
    if (!manager || manager.tools.length === 0) {
      throw new Error(`No runnable tool is configured for ${managerId}`)
    }

    const tool = primaryRunTool(manager)
    const args = normalizeArgs(tool, splitCommandLine(commandLine))
    const invoke = () => this.runArgs(cwd, manager, tool, args, commandLine, false, context)
    // Free-form commands (runCustom) mutate the project for install/uninstall-like
    // input and must share the same mutation queue as planned operations.
    if (!commandMutatesProjectFiles(args)) return await invoke()
    return await withProjectMutation(cwd, invoke)
  }

  async executePlanned(
    cwd: string,
    managerId: DependencyManagerId,
    tool: string,
    args: string[],
    dryRun = false,
    context?: ExtendedManagerOperationContext
  ): Promise<ExtendedManagerCommandResult> {
    const manager = getManagerDefinition(managerId)
    if (!manager || manager.tools.length === 0) {
      throw new Error(`No runnable tool is configured for ${managerId}`)
    }
    if (!tool.trim()) throw new Error(`No runnable tool is configured for ${managerId}`)
    const plannedArgs = dryRun ? dryRunTemplate(managerId, args) : args
    if (!plannedArgs) {
      throw new Error(`No reliable dry-run command is available for ${managerId}`)
    }
    const commandLine = [tool, ...plannedArgs].join(' ')
    const run = () => this.runArgs(cwd, manager, tool as ToolName, plannedArgs, commandLine, dryRun, context)
    if (dryRun || !commandMutatesProjectFiles(plannedArgs)) return await run()
    return await withProjectMutation(cwd, run)
  }

  async execute(
    cwd: string,
    managerId: DependencyManagerId,
    request: ExtendedManagerOperationRequest,
    dryRun = false,
    context?: ExtendedManagerOperationContext
  ): Promise<ExtendedManagerCommandResult> {
    const manager = getManagerDefinition(managerId)
    if (!manager || manager.tools.length === 0) {
      throw new Error(`No runnable tool is configured for ${managerId}`)
    }

    const plan = await this.plan(cwd, managerId, request)
    if (plan.requirements.length > 0) {
      throw new Error(plan.requirements.join('; '))
    }

    const tool = primaryRunTool(manager)
    const args = dryRun ? dryRunTemplate(managerId, plan.args) : plan.args
    if (!args) {
      throw new Error(`No reliable dry-run command is available for ${managerId} ${request.operation}`)
    }

    const commandLine = [tool, ...args].join(' ')
    const run = () => this.runArgs(cwd, manager, tool, args, commandLine, dryRun, context)
    if (dryRun || !commandMutatesProjectFiles(args)) return await run()
    return await withProjectMutation(cwd, run)
  }

  private async runArgs(
    cwd: string,
    manager: DependencyManagerDefinition,
    tool: ToolName,
    args: string[],
    commandLine: string,
    dryRun: boolean,
    context?: ExtendedManagerOperationContext
  ): Promise<ExtendedManagerCommandResult> {
    const bin = await resolveToolBin(tool, cwd)
    const backup = dryRun ? undefined : await createCommandBackup(cwd, manager, commandLine, args)
    try {
      const result = await runLoggedCommand(bin, args, {
        cwd,
        displayBin: tool,
        signal: context?.signal,
        timeoutMs: context?.timeoutMs,
        operationId: context?.operationId
      })

      return {
        command: [tool, ...args].join(' '),
        stdout: result.stdout,
        stderr: result.stderr,
        backup,
        restore: { attempted: false, restored: false }
      }
    } catch (error: unknown) {
      return await recoverCommandFailure(error, backup, (path) => this.restoreBackup(cwd, path))
    }
  }

  async executeWithMutation(
    cwd: string,
    managerId: DependencyManagerId,
    args: string[],
    mutate: () => Promise<void>,
    dryRun = false,
    context?: ExtendedManagerOperationContext
  ): Promise<ExtendedManagerCommandResult> {
    if (dryRun) return await this.executeWithMutationUnlocked(cwd, managerId, args, mutate, true, context)
    return await withProjectMutation(cwd, () => this.executeWithMutationUnlocked(cwd, managerId, args, mutate, false, context))
  }

  private async executeWithMutationUnlocked(
    cwd: string,
    managerId: DependencyManagerId,
    args: string[],
    mutate: () => Promise<void>,
    dryRun = false,
    context?: ExtendedManagerOperationContext
  ): Promise<ExtendedManagerCommandResult> {
    const manager = getManagerDefinition(managerId)
    if (!manager) throw new Error(`Unknown dependency manager: ${managerId}`)
    const tool = primaryRunTool(manager)
    const commandLine = [tool, ...args].join(' ')
    if (dryRun) {
      return { command: commandLine, stdout: 'dry-run: manifest was not changed', stderr: '', backup: undefined }
    }
    const backup = await createCommandBackup(cwd, manager, commandLine, args)
    try {
      await mutate()
      const bin = await resolveToolBin(tool, cwd)
      const result = await runLoggedCommand(bin, args, {
        cwd,
        displayBin: tool,
        signal: context?.signal,
        timeoutMs: context?.timeoutMs,
        operationId: context?.operationId
      })
      return { command: commandLine, stdout: result.stdout, stderr: result.stderr, backup, restore: { attempted: false, restored: false } }
    } catch (error: unknown) {
      return await recoverCommandFailure(error, backup, (path) => this.restoreBackup(cwd, path))
    }
  }
  async restoreBackup(cwd: string, backupPath: string, expectedState?: Record<string, { exists: boolean; hash: string }>): Promise<ExtendedManagerRestoreResult> {
    const resolvedBackupPath = resolveBackupPath(cwd, backupPath)
    const payload = parseJson<ExtendedManagerBackupPayload | null>(await readText(resolvedBackupPath), null)
    if (!payload || !Array.isArray(payload.files)) {
      throw new Error('Invalid extended manager backup file')
    }

    if (resolve(payload.projectPath) !== resolve(cwd)) {
      throw new Error('Backup belongs to a different project path')
    }

    const restoredFiles: string[] = []
    const conflicts: ExtendedManagerRestoreConflict[] = []
    for (const file of payload.files) {
      const targetPath = resolve(cwd, file.file)
      if (!isInside(cwd, targetPath)) {
        throw new Error(`Backup contains an unsafe file path: ${file.file}`)
      }
      let actualExists = false
      let actualHash = sha256('')
      try {
        await access(targetPath)
        actualExists = true
        actualHash = sha256(await readText(targetPath))
      } catch { }
      if (expectedState?.[file.file] && (expectedState[file.file].exists !== actualExists || (actualExists && expectedState[file.file].hash !== actualHash))) {
        conflicts.push({ file: file.file, expectedExists: expectedState[file.file].exists, actualExists, expectedHash: expectedState[file.file].hash, actualHash })
        continue
      }

      await mkdir(dirname(targetPath), { recursive: true })
      if (file.exists) {
        // Restoring user manifests must be as atomic as backing them up.
        await writeFileAtomic(targetPath, file.content)
      } else {
        try { await unlink(targetPath) } catch { }
      }
      restoredFiles.push(file.file)
    }

    return {
      backupPath: resolvedBackupPath,
      restoredCount: restoredFiles.length,
      restoredFiles,
      conflicts
    }
  }
}

interface OperationTemplate {
  args: string[]
  requirements: string[]
  warnings: string[]
  supported?: boolean
}

async function operationTemplate(
  cwd: string,
  managerId: DependencyManagerId,
  request: ExtendedManagerOperationRequest
): Promise<OperationTemplate> {
  const requirements: string[] = []
  const warnings: string[] = []

  const requirePackage = () => {
    if (!request.packageName?.trim()) {
      requirements.push('Package name is required for this operation.')
    }
  }

  const unsupported = (_fallback: string[], warning: string): OperationTemplate => ({
    args: [],
    requirements: [warning],
    warnings: [warning],
    supported: false
  })

  if (isNodeWorkspaceManager(managerId)) {
    return await createNodeOperationTemplate(cwd, managerId, request)
  }
  if (isPythonWorkspaceManager(managerId)) {
    return await createPythonOperationTemplate(cwd, managerId, request)
  }
  if (isBackendWorkspaceManager(managerId)) {
    return await createBackendOperationTemplate(cwd, managerId, request)
  }
  const packageSpec = dependencySpec(managerId, request.packageName, request.version)

  switch (managerId) {
    case 'deno':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['add', packageSpec], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['remove', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'update' || request.operation === 'sync') return { args: ['cache', '--reload'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['info'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['cache', '--lock=deno.lock'], requirements, warnings }
      return unsupported(['info'], 'Deno has limited generic package-manager operations; review imports and tasks before running.')
    case 'renv':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['-e', `renv::install("${packageSpec}")`], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['-e', `renv::remove("${request.packageName || ''}")`], requirements, warnings }
      }
      if (request.operation === 'update') return { args: ['-e', request.packageName ? `renv::update("${request.packageName}")` : 'renv::update()'], requirements, warnings }
      if (request.operation === 'outdated' || request.operation === 'sync') return { args: ['-e', 'renv::status()'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['-e', 'renv::dependencies()'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['-e', 'renv::snapshot()'], requirements, warnings }
      if (request.operation === 'audit') return unsupported(['-e', 'renv::status()'], 'renv does not provide a universal vulnerability audit; import OSV or scanner JSON into audit evidence.')
      return { args: ['-e', 'renv::restore()'], requirements, warnings }
    case 'julia':
      if (request.operation === 'install') {
        requirePackage()
        return {
          args: ['--project=.', '-e', request.version ? `using Pkg; Pkg.add(name="${request.packageName || ''}", version="${request.version}")` : `using Pkg; Pkg.add("${request.packageName || ''}")`],
          requirements,
          warnings
        }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['--project=.', '-e', `using Pkg; Pkg.rm("${request.packageName || ''}")`], requirements, warnings }
      }
      if (request.operation === 'update') return { args: ['--project=.', '-e', request.packageName ? `using Pkg; Pkg.update("${request.packageName}")` : 'using Pkg; Pkg.update()'], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['--project=.', '-e', 'using Pkg; Pkg.status(; outdated=true)'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['--project=.', '-e', 'using Pkg; Pkg.status()'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['--project=.', '-e', 'using Pkg; Pkg.resolve()'], requirements, warnings }
      if (request.operation === 'audit') return unsupported(['--project=.', '-e', 'using Pkg; Pkg.status()'], 'Julia Pkg has no universal vulnerability audit; import OSV or scanner JSON into audit evidence.')
      return { args: ['--project=.', '-e', 'using Pkg; Pkg.instantiate()'], requirements, warnings }
    case 'sbt':
      if (request.operation === 'update' || request.operation === 'sync') return { args: ['update'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['dependencyTree'], requirements, warnings: [...warnings, 'dependencyTree requires sbt-dependency-graph or compatible built-in task support.'] }
      if (request.operation === 'outdated') return { args: ['dependencyUpdates'], requirements, warnings: [...warnings, 'dependencyUpdates requires sbt-updates or a similar plugin.'] }
      if (request.operation === 'audit') return unsupported(['dependencyCheck'], 'sbt vulnerability checks require an audit plugin such as sbt-dependency-check.')
      if (request.operation === 'lock') return unsupported(['update'], 'sbt lockfile workflows vary by plugin; review dependency-lock.sbt or coursier lock output.')
      return unsupported(['update'], 'sbt add/remove requires editing build.sbt in this generic adapter.')
    case 'leiningen':
      if (request.operation === 'sync' || request.operation === 'install') return { args: ['deps'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['deps', ':tree'], requirements, warnings }
      if (request.operation === 'outdated') return unsupported(['ancient'], 'Leiningen outdated checks require the lein-ancient plugin.')
      if (request.operation === 'audit') return unsupported(['nvd', 'check'], 'Clojure vulnerability checks require nvd-clojure or a similar plugin.')
      return unsupported(['deps'], 'Leiningen add/remove/update requires editing project.clj in this generic adapter.')
    case 'mix':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['hex.search', request.packageName || ''], requirements, warnings: [...warnings, 'Mix dependency add requires editing mix.exs; this command searches Hex only.'] }
      }
      if (request.operation === 'sync') return { args: ['deps.get'], requirements, warnings }
      if (request.operation === 'update') return { args: ['deps.update', ...(request.packageName ? [request.packageName] : ['--all'])], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['hex.outdated'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['deps.tree'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['hex.audit'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['deps.get'], requirements, warnings }
      return unsupported(['deps.get'], 'Mix add/remove requires editing mix.exs in this generic adapter.')
    case 'rebar3':
      if (request.operation === 'sync' || request.operation === 'install') return { args: ['get-deps'], requirements, warnings }
      if (request.operation === 'update') return { args: ['upgrade', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['tree'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['lock'], requirements, warnings }
      return unsupported(['tree'], 'rebar3 add/remove/audit workflows require editing rebar.config or adding plugins in this generic adapter.')
    case 'cabal':
      if (request.operation === 'sync' || request.operation === 'install') return { args: ['build', 'all', '--dry-run'], requirements, warnings }
      if (request.operation === 'update') return { args: ['update'], requirements, warnings }
      if (request.operation === 'outdated') return unsupported(['outdated'], 'cabal outdated requires the cabal-outdated helper to be installed.')
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['v2-freeze', '--dry-run'], requirements, warnings: [...warnings, 'Cabal has no universal dependency tree command; this previews the install plan.'] }
      if (request.operation === 'lock') return { args: ['freeze'], requirements, warnings }
      return unsupported(['build', 'all', '--dry-run'], 'Cabal add/remove requires editing .cabal or cabal.project files in this generic adapter.')
    case 'stack':
      if (request.operation === 'sync' || request.operation === 'install') return { args: ['build', '--dry-run'], requirements, warnings }
      if (request.operation === 'update') return { args: ['update'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['ls', 'dependencies'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['build', '--dry-run'], requirements, warnings }
      return unsupported(['ls', 'dependencies'], 'Stack add/remove requires editing package.yaml, .cabal, or stack.yaml in this generic adapter.')
    case 'swiftpm':
      if (request.operation === 'update') return { args: ['package', 'update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['package', 'show-dependencies'], requirements, warnings }
      if (request.operation === 'lock' || request.operation === 'sync') return { args: ['package', 'resolve'], requirements, warnings }
      return unsupported(['package', 'show-dependencies'], 'SwiftPM package add/remove requires editing Package.swift in this generic adapter.')
    case 'cocoapods':
      if (request.operation === 'update') return { args: ['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['outdated'], requirements, warnings }
      if (request.operation === 'list' || request.operation === 'tree') return { args: ['list'], requirements, warnings }
      if (request.operation === 'lock' || request.operation === 'sync') return { args: ['install'], requirements, warnings }
      return unsupported(['install'], 'CocoaPods add/remove requires editing Podfile in this generic adapter.')
    case 'helm':
      if (request.operation === 'install' || request.operation === 'remove') return { args: ['dependency', 'update'], requirements, warnings: [...warnings, 'Helm dependency declarations are managed in Chart.yaml; review the manifest change before refreshing Chart.lock.'] }
      if (request.operation === 'update' || request.operation === 'sync') return { args: ['dependency', 'update'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['dependency', 'build'], requirements, warnings }
      if (request.operation === 'list' || request.operation === 'tree') return { args: ['dependency', 'list'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['lint'], requirements, warnings }
      return { args: ['dependency', 'list'], requirements, warnings }
    case 'docker':
      if (request.operation === 'audit') return { args: ['scout', 'cves'], requirements, warnings: [...warnings, 'Docker Scout must be available and enabled for vulnerability scanning.'] }
      if (request.operation === 'list' || request.operation === 'tree') return { args: ['image', 'ls'], requirements, warnings }
      if (request.operation === 'sync') return { args: ['compose', 'config'], requirements, warnings }
      return unsupported(['compose', 'config'], 'Docker image changes require editing Dockerfile or compose files in this generic adapter.')
    case 'kustomize':
      if (request.operation === 'sync' || request.operation === 'audit' || request.operation === 'tree' || request.operation === 'list') return { args: ['build', '.'], requirements, warnings }
      if (request.operation === 'update') {
        requirePackage()
        return {
          args: ['edit', 'set', 'image', request.version ? `${request.packageName || ''}=${request.packageName || ''}:${request.version}` : request.packageName || ''],
          requirements,
          warnings: [...warnings, 'Kustomize image updates mutate kustomization.yaml; review the rendered diff before committing.']
        }
      }
      return unsupported(['build', '.'], 'Kustomize add/remove/lock workflows require editing kustomization files in this generic adapter.')
    case 'helmfile':
      if (request.operation === 'sync') return { args: ['template'], requirements, warnings }
      if (request.operation === 'update' || request.operation === 'lock') return { args: ['deps'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['lint'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list' || request.operation === 'outdated') return { args: ['list'], requirements, warnings }
      return unsupported(['template'], 'Helmfile release add/remove/install operations should be reviewed through helmfile diff and environment policy before applying.')
    case 'skaffold':
      if (request.operation === 'sync' || request.operation === 'tree' || request.operation === 'list') return { args: ['render'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['diagnose'], requirements, warnings }
      return unsupported(['render'], 'Skaffold build/deploy and artifact changes require profile-aware review in this generic adapter.')
    case 'argocd':
      if (request.operation === 'sync' || request.operation === 'audit') return request.packageName
        ? { args: ['app', 'diff', request.packageName], requirements, warnings }
        : unsupported(['app', 'list'], 'Provide an application name to generate an Argo CD app diff command.')
      if (request.operation === 'tree') {
        requirePackage()
        return { args: ['app', 'get', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'list' || request.operation === 'outdated') return { args: ['app', 'list'], requirements, warnings }
      return unsupported(['app', 'list'], 'Argo CD source changes require editing Application manifests or Git revisions in this generic adapter.')
    case 'flux':
      if (request.operation === 'sync' || request.operation === 'audit') return { args: ['check'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list' || request.operation === 'outdated') return { args: ['get', 'all'], requirements, warnings }
      if (request.operation === 'update') return request.packageName
        ? { args: ['reconcile', 'source', 'git', request.packageName], requirements, warnings: [...warnings, 'Flux reconcile mutates cluster state rather than repository files; use only after reviewing source revisions.'] }
        : unsupported(['get', 'sources', 'git'], 'Provide a Flux source name to generate a reconcile command.')
      return unsupported(['get', 'all'], 'Flux source, HelmRelease, and Kustomization changes require editing GitOps manifests in this generic adapter.')
    case 'terraform':
    case 'opentofu':
      if (request.operation === 'sync' || request.operation === 'install') return { args: ['init'], requirements, warnings }
      if (request.operation === 'update') return { args: ['init', '-upgrade'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['providers'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['providers', 'lock'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['validate'], requirements, warnings: [...warnings, 'Use tfsec, Checkov, Terrascan, or imported SARIF/OSV evidence for vulnerability and policy scans.'] }
      if (request.operation === 'outdated') return unsupported(['providers'], 'Terraform/OpenTofu do not expose a universal outdated command; review required_providers constraints and lockfile versions.')
      return unsupported(['providers'], 'Terraform/OpenTofu provider and module add/remove operations require editing .tf files in this generic adapter.')
    case 'ansible':
      if (request.operation === 'sync' || request.operation === 'install') return { args: ['collection', 'install', '-r', 'requirements.yml'], requirements, warnings }
      if (request.operation === 'update') return { args: ['collection', 'install', '-r', 'requirements.yml', '--upgrade'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list' || request.operation === 'outdated') return { args: ['collection', 'list'], requirements, warnings }
      if (request.operation === 'audit') return unsupported(['collection', 'list'], 'Use ansible-lint or imported SARIF/OSV evidence for collection and role policy scans.')
      if (request.operation === 'lock') return unsupported(['collection', 'list'], 'Ansible Galaxy does not provide a standard lockfile; keep reviewed requirements files and CI evidence.')
      return unsupported(['collection', 'list'], 'Ansible role/collection add/remove operations require editing requirements.yml in this generic adapter.')
    case 'github-actions':
      if (request.operation === 'sync' || request.operation === 'list' || request.operation === 'tree') return { args: ['workflow', 'list'], requirements, warnings }
      if (request.operation === 'audit') return unsupported(['workflow', 'list'], 'Use action pinning policy, Scorecard, zizmor, or imported SARIF/OSV evidence for workflow audits.')
      if (request.operation === 'update' || request.operation === 'outdated') return unsupported(['workflow', 'list'], 'GitHub Action updates require editing workflow YAML and reviewing token permissions.')
      return unsupported(['workflow', 'list'], 'GitHub Actions dependencies are declared in workflow YAML; edit workflow files for add/remove/lock changes.')
    case 'gitlab-ci':
      if (request.operation === 'sync' || request.operation === 'audit') return { args: ['ci', 'lint'], requirements, warnings }
      if (request.operation === 'list' || request.operation === 'tree' || request.operation === 'outdated') return { args: ['pipeline', 'list'], requirements, warnings }
      return unsupported(['ci', 'lint'], 'GitLab CI includes and components require editing .gitlab-ci.yml in this generic adapter.')
    case 'pre-commit':
      if (request.operation === 'sync' || request.operation === 'audit') return { args: ['run', '--all-files'], requirements, warnings }
      if (request.operation === 'update' || request.operation === 'outdated') return { args: ['autoupdate'], requirements, warnings }
      if (request.operation === 'install') return { args: ['install'], requirements, warnings }
      if (request.operation === 'list' || request.operation === 'tree') return { args: ['validate-config'], requirements, warnings }
      return unsupported(['validate-config'], 'pre-commit hook add/remove operations require editing .pre-commit-config.yaml in this generic adapter.')
    case 'bazel':
      if (request.operation === 'sync' || request.operation === 'list' || request.operation === 'tree') return { args: ['mod', 'graph'], requirements, warnings }
      if (request.operation === 'lock' || request.operation === 'update') return { args: ['mod', 'tidy'], requirements, warnings }
      if (request.operation === 'audit') return unsupported(['query', '//...'], 'Use bazel mod graph, dependency-review policy, or imported SARIF/OSV evidence for Bazel ruleset audits.')
      return unsupported(['mod', 'graph'], 'Bazel external dependencies are declared in MODULE.bazel, WORKSPACE, or repository rules; edit those files for add/remove changes.')
    case 'pants':
      if (request.operation === 'sync' || request.operation === 'tree' || request.operation === 'list') return { args: ['dependencies', '::'], requirements, warnings }
      if (request.operation === 'lock' || request.operation === 'update') return { args: ['generate-lockfiles'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['lint', '::'], requirements, warnings: [...warnings, 'Pants lint validates targets; import pip-audit/OSV/SARIF evidence for dependency vulnerability scans.'] }
      return unsupported(['dependencies', '::'], 'Pants dependency add/remove operations require editing pants.toml, BUILD files, or underlying requirement manifests.')
    case 'buck':
      if (request.operation === 'sync' || request.operation === 'tree' || request.operation === 'list') return { args: ['query', '//...'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['audit', 'dependencies', '//...'], requirements, warnings: [...warnings, 'Buck audit support depends on the installed Buck2 version and cell configuration.'] }
      return unsupported(['query', '//...'], 'Buck external dependencies are declared in BUCK files or cell configuration; edit those files for add/remove/update changes.')
    case 'opam':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', '-y', packageSpec || '.'], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['remove', '-y', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'update') return { args: ['update'], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['list', '--outdated'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['list', '--installed'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['lock'], requirements, warnings: [...warnings, 'opam lock requires the opam-lock plugin in some environments.'] }
      if (request.operation === 'audit') return unsupported(['list', '--outdated'], 'Use opam health checks, OSV evidence, or distro scanner evidence for vulnerability audits.')
      return { args: ['install', '-y', '.', '--deps-only'], requirements, warnings }
    case 'cpan':
      if (request.operation === 'install') {
        requirePackage()
        return { args: [packageSpec], requirements, warnings }
      }
      if (request.operation === 'sync') return { args: ['--installdeps', '.'], requirements, warnings }
      if (request.operation === 'update') return { args: ['--installdeps', '.', '--reinstall'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return unsupported(['--info', request.packageName || 'cpanfile'], 'cpanm has no universal project dependency tree; review cpanfile and cpanfile.snapshot.')
      if (request.operation === 'audit') return unsupported(['--installdeps', '.'], 'Import CPAN audit, OSV, or scanner evidence into the Health Center audit evidence workflow.')
      if (request.operation === 'lock') return unsupported(['--installdeps', '.'], 'Use Carton to refresh cpanfile.snapshot when available.')
      return unsupported(['--installdeps', '.'], 'CPAN remove/outdated workflows require editing cpanfile or using project-specific tooling.')
    case 'luarocks':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', request.packageName || '', ...(request.version ? [request.version] : [])], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['remove', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'sync') return { args: ['make'], requirements, warnings }
      if (request.operation === 'update') return { args: ['install', '--deps-only', '.'], requirements, warnings: [...warnings, 'LuaRocks update behavior depends on the active rockspec and tree.'] }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['list'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['lint', '*.rockspec'], requirements, warnings }
      if (request.operation === 'lock') return unsupported(['make'], 'LuaRocks lockfile support depends on external lock tooling; review luarocks.lock when present.')
      return { args: ['make'], requirements, warnings }
    case 'shards':
      if (request.operation === 'sync' || request.operation === 'install') return { args: ['install'], requirements, warnings }
      if (request.operation === 'update') return { args: ['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['list'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['lock'], requirements, warnings }
      return unsupported(['list'], 'Crystal Shards add/remove/audit/outdated workflows require editing shard.yml or adding scanner evidence.')
    case 'zig':
      if (request.operation === 'sync' || request.operation === 'tree' || request.operation === 'list') return { args: ['build', '--summary', 'all'], requirements, warnings }
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['fetch', '--save', packageSpec], requirements, warnings: [...warnings, 'Zig fetch expects a package URL or path rather than a registry package name.'] }
      }
      if (request.operation === 'lock' || request.operation === 'update') return { args: ['build'], requirements, warnings }
      return unsupported(['build'], 'Zig package remove/audit/outdated workflows require editing build.zig.zon or importing scanner evidence.')
    case 'homebrew':
      if (request.operation === 'install') {
        requirePackage()
        return {
          args: ['install', request.packageName || ''],
          requirements,
          warnings: request.version ? [...warnings, 'Homebrew formula versions are encoded in formula names such as node@22; generic --version install is not supported.'] : warnings
        }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['uninstall', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'sync') return { args: ['bundle', 'install', '--file', 'Brewfile'], requirements, warnings }
      if (request.operation === 'update') return { args: ['upgrade', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['outdated'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['bundle', 'list', '--file', 'Brewfile'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['doctor'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['bundle', 'dump', '--force', '--file', 'Brewfile'], requirements, warnings }
      return { args: ['bundle', 'check', '--file', 'Brewfile'], requirements, warnings }
    case 'chocolatey':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', request.packageName || '', '-y', ...(request.version ? ['--version', request.version] : [])], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['uninstall', request.packageName || '', '-y'], requirements, warnings }
      }
      if (request.operation === 'update') return { args: ['upgrade', request.packageName || 'all', '-y'], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['outdated'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['list', '--local-only'], requirements, warnings }
      if (request.operation === 'sync') return unsupported(['install', 'packages.config', '-y'], 'Chocolatey packages.config restores may require running from an elevated shell or approved internal feed.')
      if (request.operation === 'audit') return unsupported(['list', '--local-only'], 'Use Chocolatey licensed audit reports, internal feed evidence, or imported scanner evidence for vulnerability checks.')
      return unsupported(['list', '--local-only'], 'Chocolatey lock/export workflows depend on enterprise tooling or checked-in packages.config files.')
    case 'scoop':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', request.version ? `${request.packageName || ''}@${request.version}` : request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['uninstall', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'sync') return { args: ['import', 'scoopfile.json'], requirements, warnings: [...warnings, 'Scoop import expects a compatible export JSON generated by scoop export.'] }
      if (request.operation === 'update') return { args: ['update', request.packageName || '*'], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['status'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['list'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['checkup'], requirements, warnings }
      return unsupported(['export'], 'Scoop export formats vary; keep reviewed scoopfile.json manifests for reproducible bootstraps.')
    case 'winget':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', '--id', request.packageName || '', '-e', ...(request.version ? ['--version', request.version] : [])], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['uninstall', '--id', request.packageName || '', '-e'], requirements, warnings }
      }
      if (request.operation === 'sync') return { args: ['import', '-i', 'winget-export.json'], requirements, warnings }
      if (request.operation === 'update' || request.operation === 'outdated') return { args: ['upgrade', ...(request.packageName ? ['--id', request.packageName, '-e'] : [])], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['list'], requirements, warnings }
      if (request.operation === 'lock') return { args: ['export', '-o', 'winget-export.json'], requirements, warnings }
      return unsupported(['list'], 'winget vulnerability audit evidence should come from enterprise inventory or imported scanner reports.')
    case 'asdf':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', request.packageName || '', request.version || 'latest'], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['uninstall', request.packageName || '', request.version || ''], requirements, warnings }
      }
      if (request.operation === 'sync' || request.operation === 'lock') return { args: ['install'], requirements, warnings }
      if (request.operation === 'update' || request.operation === 'outdated') return { args: ['latest', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['current'], requirements, warnings }
      return unsupported(['plugin', 'list'], 'asdf vulnerability audits require runtime-specific scanners and imported evidence.')
    case 'mise':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['use', `${request.packageName || ''}@${request.version || 'latest'}`], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return unsupported(['unuse', request.packageName || ''], 'mise removal support depends on the installed mise version; editing mise.toml may be required.')
      }
      if (request.operation === 'sync' || request.operation === 'lock') return { args: ['install'], requirements, warnings }
      if (request.operation === 'update') return { args: ['upgrade', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['outdated'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['ls'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['doctor'], requirements, warnings }
      return { args: ['install'], requirements, warnings }
    case 'sdkman':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', request.packageName || '', request.version || ''], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['uninstall', request.packageName || '', request.version || ''], requirements, warnings }
      }
      if (request.operation === 'sync' || request.operation === 'lock') return { args: ['env', 'install'], requirements, warnings }
      if (request.operation === 'update' || request.operation === 'outdated') return { args: ['upgrade'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['current'], requirements, warnings }
      return unsupported(['current'], 'SDKMAN vulnerability audits require runtime-specific scanners and imported evidence.')
    case 'apt':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['install', '-y', packageSpec], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['remove', '-y', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'update') return { args: ['upgrade', '-y', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['-s', 'upgrade'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return unsupported(['--just-print', 'install', request.packageName || ''], 'Use apt list --installed or dpkg-query for a full installed-package inventory.')
      if (request.operation === 'audit') return { args: ['check'], requirements, warnings: [...warnings, 'APT check validates package consistency; import distro CVE scanner evidence for vulnerability review.'] }
      if (request.operation === 'lock') return unsupported(['--just-print', 'upgrade'], 'APT does not provide a standard lockfile; keep reviewed apt-packages.txt baselines or image build evidence.')
      return { args: ['update'], requirements, warnings }
    case 'dnf':
      if (request.operation === 'install') {
        requirePackage()
        return {
          args: ['install', '-y', packageSpec],
          requirements,
          warnings: request.version ? [...warnings, 'DNF version pins may require full NEVRA package names in some repositories.'] : warnings
        }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['remove', '-y', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'update') return { args: ['upgrade', '-y', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['check-update'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['list', 'installed'], requirements, warnings }
      if (request.operation === 'audit') return unsupported(['updateinfo', 'list', 'security'], 'DNF security advisory support depends on repository metadata and distro configuration.')
      if (request.operation === 'lock') return unsupported(['repoquery', '--installed'], 'DNF package locks are distro-specific; export reviewed rpm package baselines or image evidence.')
      return { args: ['makecache'], requirements, warnings }
    case 'apk':
      if (request.operation === 'install') {
        requirePackage()
        return { args: ['add', packageSpec], requirements, warnings }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['del', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'update') return { args: ['upgrade', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['version', '-l', '<'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['info'], requirements, warnings }
      if (request.operation === 'audit') return { args: ['audit'], requirements, warnings: [...warnings, 'apk audit requires a local database and only reports package integrity issues; import distro CVE scanner evidence for vulnerabilities.'] }
      if (request.operation === 'lock') return unsupported(['info'], 'apk has no portable lockfile export; keep reviewed packages.apk baselines or image build evidence.')
      return { args: ['update'], requirements, warnings }
    case 'pacman':
      if (request.operation === 'install') {
        requirePackage()
        return {
          args: ['-S', '--needed', '--noconfirm', request.packageName || ''],
          requirements,
          warnings: request.version ? [...warnings, 'pacman repository installs do not support a portable generic version flag; use pinned repositories or package archive URLs when needed.'] : warnings
        }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['-R', '--noconfirm', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'update' || request.operation === 'sync') return { args: ['-Syu', '--noconfirm'], requirements, warnings }
      if (request.operation === 'outdated') return { args: ['-Qu'], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['-Q'], requirements, warnings }
      if (request.operation === 'audit') return unsupported(['-Q'], 'pacman vulnerability review requires arch-audit or imported distro scanner evidence.')
      if (request.operation === 'lock') return unsupported(['-Qqe'], 'pacman has no portable lockfile; export reviewed pacman-packages.txt baselines or image evidence.')
      return { args: ['-Sy'], requirements, warnings }
    case 'nix':
      if (request.operation === 'install') {
        requirePackage()
        const target = (request.packageName || '').includes('#') ? request.packageName || '' : `nixpkgs#${request.packageName || ''}`
        return {
          args: ['profile', 'install', target],
          requirements,
          warnings: request.version ? [...warnings, 'Nix package versions should be pinned through flake inputs or overlays rather than a generic install version flag.'] : warnings
        }
      }
      if (request.operation === 'remove') {
        requirePackage()
        return { args: ['profile', 'remove', request.packageName || ''], requirements, warnings }
      }
      if (request.operation === 'sync') return { args: ['develop'], requirements, warnings }
      if (request.operation === 'update' || request.operation === 'lock') return { args: ['flake', 'update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings }
      if (request.operation === 'tree' || request.operation === 'list') return { args: ['flake', 'show'], requirements, warnings }
      if (request.operation === 'outdated') return unsupported(['flake', 'metadata'], 'Nix outdated review depends on flake input comparison or external update tools such as nix-update.')
      if (request.operation === 'audit') return unsupported(['flake', 'metadata'], 'Nix vulnerability evidence should come from nixpkgs security notices, OSV, or imported scanner reports.')
      return { args: ['develop'], requirements, warnings }
    default:
      return { args: ['--version'], requirements, warnings: [...warnings, 'No operation template exists for this manager yet.'] }
  }
}

function dryRunTemplate(managerId: DependencyManagerId, args: string[]): string[] | null {
  if (args.length === 0) return null

  if (isNodeWorkspaceManager(managerId)) return nodeDryRunTemplate(managerId, args)
  if (isPythonWorkspaceManager(managerId)) return pythonDryRunTemplate(managerId, args)
  if (isBackendWorkspaceManager(managerId)) return backendDryRunTemplate(managerId, args)
  if (managerId === 'apt' && ['install', 'remove', 'upgrade'].includes(args[0])) return ['--simulate', ...args]
  if (managerId === 'dnf' && ['install', 'remove', 'upgrade'].includes(args[0])) return [...args, '--assumeno']
  if (managerId === 'pacman' && args[0] === '-S') return [...args, '--print']
  if (managerId === 'helm' && args[0] === 'lint') return args
  if (managerId === 'docker' && args.join(' ') === 'compose config') return args

  return null
}

function dependencySpec(managerId: DependencyManagerId, packageName?: string, version?: string): string {
  const cleanName = packageName?.trim()
  if (!cleanName) return ''
  const cleanVersion = version?.trim()
  if (!cleanVersion) return cleanName

  if (managerId === 'opam' && !isFloatingVersion(cleanVersion)) {
    return /^[0-9][A-Za-z0-9.+~-]*$/.test(cleanVersion) ? `${cleanName}.${cleanVersion}` : cleanName
  }

  if ((managerId === 'apt' || managerId === 'apk') && !isFloatingVersion(cleanVersion)) {
    return `${cleanName}=${cleanVersion}`
  }

  if (managerId === 'dnf' && !isFloatingVersion(cleanVersion)) {
    return `${cleanName}-${cleanVersion}`
  }

  if (managerId === 'pacman' || managerId === 'nix') {
    return cleanName
  }

  if (managerId === 'cpan' || managerId === 'zig') {
    return cleanName
  }

  return `${cleanName}@${cleanVersion}`
}

function isFloatingVersion(version: string): boolean {
  return version === '*' || version.toLowerCase() === 'latest'
}

async function readBackupFilePreview(
  cwd: string,
  manager: DependencyManagerDefinition
): Promise<ExtendedManagerBackupFile[]> {
  const files = await backupPatternMatches(cwd, [
    ...manager.manifestFiles,
    ...manager.lockFiles,
    ...(manager.configFiles || [])
  ])

  return await Promise.all(files.map(async (file) => {
    const content = await readText(join(cwd, file))
      return {
        file,
        hash: sha256(content),
        size: Buffer.byteLength(content, 'utf-8'),
        exists: true
      }
  }))
}

function primaryRunTool(manager: DependencyManagerDefinition): ToolName {
  if (manager.id === 'bundler') return 'bundle'
  if (manager.id === 'cocoapods') return 'pod'
  return manager.tools[0] as ToolName
}

async function createCommandBackup(
  cwd: string,
  manager: DependencyManagerDefinition,
  commandLine: string,
  args: string[]
): Promise<ExtendedManagerBackup | undefined> {
  if (!commandMutatesProjectFiles(args)) return undefined

  const files = await backupPatternMatches(cwd, [
    ...manager.manifestFiles,
    ...manager.lockFiles,
    ...(manager.configFiles || [])
  ])
  // Raw manifest/lock/config entries are kept so restore can also remove files that appear
  // during the command; glob patterns are not concrete files and must not enter the backup.
  const concretePatterns = (patterns: readonly string[]) => patterns.filter((pattern) => !/[*?[\]{}]/.test(pattern))
  const candidates = [...new Set([
    ...files,
    ...concretePatterns(manager.lockFiles),
    ...concretePatterns(manager.manifestFiles),
    ...concretePatterns(manager.configFiles || [])
  ])]

  const backedUpFiles = await Promise.all(candidates.map(async (file) => {
    const filePath = join(cwd, file)
    try {
      await access(filePath)
    } catch (error: any) {
      if (error?.code === 'ENOENT') return { file, hash: sha256(''), size: 0, exists: false, content: '' }
      throw error
    }
    // Once access confirms existence, a read failure must abort the backup rather
    // than silently turning a real manifest into an empty file on restore.
    const content = await readText(filePath)
    return { file, hash: sha256(content), size: Buffer.byteLength(content, 'utf-8'), exists: true, content }
  }))

  const id = `${manager.id}-${timestampId()}`
  const path = join(cwd, BACKUP_DIR, `${id}.json`)
  const payload: ExtendedManagerBackupPayload = {
    id,
    managerId: manager.id,
    projectPath: cwd,
    createdAt: new Date().toISOString(),
    mutating: true,
    path,
    commandLine,
    files: backedUpFiles
  }

  await mkdir(dirname(path), { recursive: true })
  // Same guarantee as the snapshot store: the fallback must be readable even if
  // the process died while writing it.
  await writeFileAtomic(path, JSON.stringify(payload, null, 2))
  await pruneCommandBackups(cwd)

  return {
    ...payload,
    files: backedUpFiles.map(({ content: _content, ...file }) => file)
  }
}

/** Command backups accumulate one per mutation and nothing ever removed them. */
async function pruneCommandBackups(cwd: string): Promise<void> {
  const dir = join(cwd, BACKUP_DIR)
  const files = await readdir(dir).catch(() => [] as string[])
  if (files.length <= MAX_COMMAND_BACKUPS) return

  const stale = files
    .filter((file) => file.endsWith('.json'))
    .sort()
    .reverse()
    .slice(MAX_COMMAND_BACKUPS)

  await Promise.all(stale.map((file) => unlink(join(dir, file)).catch(() => undefined)))
}

function resolveBackupPath(cwd: string, backupPath: string): string {
  const backupRoot = resolve(cwd, BACKUP_DIR)
  const candidate = isAbsolute(backupPath) ? resolve(backupPath) : resolve(cwd, backupPath)
  if (!isInside(backupRoot, candidate)) {
    throw new Error('Backup path is outside the managed backup directory')
  }
  return candidate
}

function isInside(base: string, target: string): boolean {
  const relation = relative(resolve(base), resolve(target))
  return relation === '' || (!!relation && !relation.startsWith('..') && !isAbsolute(relation))
}

async function parseDenoDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = await firstExisting(cwd, ['deno.json', 'deno.jsonc'])
  if (!file) return []
  const json = parseJson<Record<string, any>>(stripJsonComments(await readText(join(cwd, file))), {})
  return objectEntries(json.imports).map(([name, value]) => ({
    managerId: 'deno',
    name,
    version: inferVersionFromSpecifier(String(value)),
    type: 'imports',
    source: String(value),
    file
  }))
}

async function parseRenvDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const deps: ExtendedDependencyInfo[] = []
  const lockFile = 'renv.lock'
  const lock = await readJson(join(cwd, lockFile))
  for (const [name, value] of objectEntries(lock?.Packages)) {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    deps.push({
      managerId: 'renv' as const,
      name: String(record.Package || name),
      version: record.Version ? String(record.Version) : undefined,
      type: 'renv.lock',
      source: record.Source ? String(record.Source) : undefined,
      file: lockFile
    })
  }

  const descriptionFile = 'DESCRIPTION'
  const description = await readText(join(cwd, descriptionFile))
  if (description) {
    for (const [name, version] of parseRDescriptionDependencies(description)) {
      deps.push({
        managerId: 'renv' as const,
        name,
        version,
        type: 'DESCRIPTION',
        file: descriptionFile
      })
    }
  }

  return uniqueDependencies(deps)
}

async function parseJuliaDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const deps: ExtendedDependencyInfo[] = []
  const projectFile = 'Project.toml'
  const project = await readText(join(cwd, projectFile))
  const compat = new Map(parseTomlKeyValues(sectionContent(project, 'compat')))
  for (const [name, uuid] of parseTomlKeyValues(sectionContent(project, 'deps'))) {
    deps.push({
      managerId: 'julia' as const,
      name,
      version: compat.get(name),
      type: 'Project.toml',
      source: uuid,
      file: projectFile
    })
  }

  const manifestFile = 'Manifest.toml'
  const manifest = await readText(join(cwd, manifestFile))
  for (const match of matches(manifest, /^\s*\[\[deps\.([^\]]+)\]\]([\s\S]*?)(?=^\s*\[\[deps\.|(?![\s\S]))/gm)) {
    const name = match[1].trim()
    const values = new Map(parseTomlKeyValues(match[2]))
    deps.push({
      managerId: 'julia' as const,
      name,
      version: values.get('version'),
      type: 'Manifest.toml',
      source: values.get('uuid'),
      file: manifestFile
    })
  }

  return uniqueDependencies(deps)
}

async function parseSbtDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['build.sbt', 'project/plugins.sbt'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...matches(content, /"([^"]+)"\s*%%?\s*"([^"]+)"\s*%\s*"([^"]+)"/g)
      .map((match) => ({
        managerId: 'sbt' as const,
        name: `${match[1]}:${match[2]}`,
        version: match[3],
        type: file.includes('plugins') ? 'plugin' : 'libraryDependency',
        file
      })))
  }

  return uniqueDependencies(deps)
}

async function parseLeiningenDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = 'project.clj'
  const content = await readText(join(cwd, file))
  return matches(content, /\[([A-Za-z0-9_.!$%&*+\-/:<=>?]+)\s+"([^"]+)"[^\]]*\]/g)
    .filter((match) => !['defproject', 'leiningen-core'].includes(match[1]))
    .map((match) => ({
      managerId: 'leiningen' as const,
      name: match[1],
      version: match[2],
      type: 'dependency',
      file
    }))
}

async function parseMixDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = 'mix.exs'
  const content = await readText(join(cwd, file))
  return matches(content, /\{\s*:([A-Za-z0-9_]+)\s*,\s*"([^"]+)"(?:\s*,\s*\[([^\]]*)\])?\s*\}/g)
    .map((match) => ({
      managerId: 'mix' as const,
      name: match[1],
      version: match[2],
      type: match[3]?.includes('only: :dev') || match[3]?.includes('only: [:dev') ? 'dev-dependency' : 'dependency',
      file
    }))
}

async function parseRebarDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = 'rebar.config'
  const content = await readText(join(cwd, file))
  return matches(content, /\{\s*([a-zA-Z0-9_]+)\s*,\s*"([^"]+)"(?:\s*,\s*\{[^}]+\})?\s*\}/g)
    .filter((match) => !['deps', 'plugins', 'erl_opts'].includes(match[1]))
    .map((match) => ({
      managerId: 'rebar3' as const,
      name: match[1],
      version: match[2],
      type: 'dependency',
      file
    }))
}

async function parseCabalDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['*.cabal'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...parseCabalBuildDepends(content).map(([name, version]) => ({
      managerId: 'cabal' as const,
      name,
      version,
      type: 'build-depends',
      file
    })))
  }

  return uniqueDependencies(deps)
}

async function parseStackDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const deps: ExtendedDependencyInfo[] = []
  const stackYaml = await readText(join(cwd, 'stack.yaml'))
  if (stackYaml) {
    deps.push(...readYamlList(stackYaml, 'extra-deps').map((item) => {
      const [name, version] = splitHaskellPackageSpec(item)
      return {
        managerId: 'stack' as const,
        name,
        version,
        type: 'extra-deps',
        file: 'stack.yaml'
      }
    }))
  }

  const packageYaml = await readText(join(cwd, 'package.yaml'))
  if (packageYaml) {
    deps.push(...readYamlList(packageYaml, 'dependencies').map((item) => {
      const [name, version] = splitHaskellPackageSpec(item)
      return {
        managerId: 'stack' as const,
        name,
        version,
        type: 'dependencies',
        file: 'package.yaml'
      }
    }))
  }

  return uniqueDependencies(deps)
}

async function parseSwiftPackageDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = 'Package.swift'
  const content = await readText(join(cwd, file))
  return matches(content, /\.package\s*\(([\s\S]*?)\)/g)
    .map((match) => {
      const block = match[1]
      const url = block.match(/\burl:\s*["']([^"']+)["']/)?.[1]
      const name = block.match(/\bname:\s*["']([^"']+)["']/)?.[1] || (url ? packageNameFromUrl(url) : '')
      const version = block.match(/\b(?:from|exact|upToNextMajor|upToNextMinor):\s*["']([^"']+)["']/)?.[1]
      return {
        managerId: 'swiftpm' as const,
        name,
        version,
        type: 'package',
        source: url,
        file
      }
    })
    .filter((item) => item.name)
}

async function parsePodfileDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = 'Podfile'
  const content = await readText(join(cwd, file))
  return matches(content, /^\s*pod\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/gm)
    .map((match) => ({ managerId: 'cocoapods' as const, name: match[1], version: match[2], type: 'pod', file }))
}

async function parseHelmDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = 'Chart.yaml'
  const content = await readText(join(cwd, file))
  const block = sectionAfterKey(content, 'dependencies')
  return matches(block, /-\s*name:\s*([^\n]+)(?:[\s\S]*?version:\s*([^\n]+))?(?:[\s\S]*?repository:\s*([^\n]+))?/g)
    .map((match) => ({
      managerId: 'helm' as const,
      name: cleanYamlScalar(match[1]),
      version: cleanYamlScalar(match[2]),
      type: 'chart',
      source: cleanYamlScalar(match[3]),
      file
    }))
}

async function parseDockerDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['Dockerfile', 'docker-compose.yml', 'compose.yaml'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...matches(content, /^\s*FROM\s+([^\s]+)(?:\s+AS\s+\S+)?/gim).map((match) => {
      const [name, version] = splitImageReference(match[1])
      return { managerId: 'docker' as const, name, version, type: 'base-image', file }
    }))
    deps.push(...matches(content, /^\s*image:\s*([^\s#]+)/gim).map((match) => {
      const [name, version] = splitImageReference(match[1])
      return { managerId: 'docker' as const, name, version, type: 'compose-image', file }
    }))
  }

  return uniqueDependencies(deps)
}

async function parseKustomizeDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['kustomization.yaml', 'kustomization.yml', 'Kustomization'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const key of ['resources', 'bases', 'components']) {
      deps.push(...readYamlList(content, key).map((value) => {
        const [name, version] = splitGitOpsReference(value)
        return {
          managerId: 'kustomize' as const,
          name,
          version,
          type: key,
          source: value,
          file
        }
      }))
    }

    for (const image of parseYamlObjectList(content, 'images')) {
      const name = image.newName || image.name
      if (!name) continue
      deps.push({
        managerId: 'kustomize' as const,
        name,
        version: image.newTag || image.digest,
        type: 'image',
        source: image.name,
        file
      })
    }

    for (const chart of parseYamlObjectList(content, 'helmCharts')) {
      if (!chart.name) continue
      deps.push({
        managerId: 'kustomize' as const,
        name: chart.name,
        version: chart.version,
        type: 'helmChart',
        source: chart.repo,
        file
      })
    }
  }

  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseHelmfileDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['helmfile.yaml', 'helmfile.yml'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const repo of parseYamlObjectList(content, 'repositories')) {
      if (!repo.name) continue
      deps.push({
        managerId: 'helmfile' as const,
        name: repo.name,
        type: 'repository',
        source: repo.url,
        file
      })
    }
    for (const release of parseYamlObjectList(content, 'releases')) {
      const name = release.chart || release.name
      if (!name) continue
      deps.push({
        managerId: 'helmfile' as const,
        name,
        version: release.version,
        type: 'release',
        source: release.name,
        file
      })
    }
  }

  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseSkaffoldDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['skaffold.yaml', 'skaffold.yml'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const artifact of parseYamlObjectList(content, 'artifacts')) {
      if (!artifact.image) continue
      const [name, version] = splitImageReference(artifact.image)
      deps.push({
        managerId: 'skaffold' as const,
        name,
        version,
        type: 'artifact-image',
        file
      })
    }
    for (const match of matches(content, /^\s*(?:remoteChart|chartPath|chartName)\s*:\s*(.+)$/gm)) {
      const [name, version] = splitGitOpsReference(cleanYamlScalar(match[1]))
      deps.push({
        managerId: 'skaffold' as const,
        name,
        version,
        type: 'deploy-chart',
        file
      })
    }
  }

  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseArgoCdDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['argocd-application.yaml', 'argocd-application.yml', '.argocd/*.yaml', '.argocd/*.yml', 'applications/*.yaml', 'applications/*.yml'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const doc of yamlDocuments(content)) {
      if (!/\bkind:\s*(Application|ApplicationSet)\b/i.test(doc)) continue
      const repoUrl = yamlScalar(doc, 'repoURL')
      const targetRevision = yamlScalar(doc, 'targetRevision')
      const chart = yamlScalar(doc, 'chart')
      const path = yamlScalar(doc, 'path')
      const name = chart || packageNameFromUrl(repoUrl || '') || path
      if (!name) continue
      deps.push({
        managerId: 'argocd' as const,
        name,
        version: targetRevision,
        type: chart ? 'helm-source' : 'git-source',
        source: repoUrl,
        file
      })
    }
  }

  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseFluxDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['flux-kustomization.yaml', 'flux-kustomization.yml', 'flux-helmrelease.yaml', 'flux-helmrelease.yml', 'flux-system/*.yaml', 'flux-system/*.yml'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const doc of yamlDocuments(content)) {
      const kind = yamlScalar(doc, 'kind')
      if (!kind) continue
      if (kind === 'GitRepository' || kind === 'OCIRepository' || kind === 'HelmRepository') {
        const name = yamlScalar(doc, 'name')
        const url = yamlScalar(doc, 'url')
        const version = yamlScalar(doc, 'tag') || yamlScalar(doc, 'branch') || yamlScalar(doc, 'semver') || yamlScalar(doc, 'digest')
        deps.push({
          managerId: 'flux' as const,
          name: name || packageNameFromUrl(url || ''),
          version,
          type: kind,
          source: url,
          file
        })
      } else if (kind === 'HelmRelease') {
        const chart = yamlScalar(doc, 'chart')
        deps.push({
          managerId: 'flux' as const,
          name: chart || yamlScalar(doc, 'name') || '',
          version: yamlScalar(doc, 'version'),
          type: 'HelmRelease',
          source: yamlScalar(doc, 'sourceRef'),
          file
        })
      } else if (kind === 'Kustomization') {
        const path = yamlScalar(doc, 'path')
        deps.push({
          managerId: 'flux' as const,
          name: path || yamlScalar(doc, 'name') || '',
          version: yamlScalar(doc, 'name'),
          type: 'Kustomization',
          source: yamlScalar(doc, 'sourceRef'),
          file
        })
      }
    }
  }

  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseTerraformDependencies(cwd: string, managerId: DependencyManagerId): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['*.tf'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...matches(content, /([A-Za-z0-9_-]+)\s*=\s*\{[\s\S]*?source\s*=\s*"([^"]+)"[\s\S]*?version\s*=\s*"([^"]+)"/g)
      .map((match) => ({
        managerId,
        name: normalizeTerraformSource(match[2]),
        version: match[3],
        type: 'required_provider',
        source: match[1],
        file
      })))
    deps.push(...matches(content, /module\s+"([^"]+)"\s*\{([\s\S]*?)\}/g)
      .map<ExtendedDependencyInfo | null>((match) => {
        const source = match[2].match(/\bsource\s*=\s*"([^"]+)"/)?.[1]
        if (!source) return null
        return {
          managerId,
          name: normalizeTerraformSource(source),
          version: match[2].match(/\bversion\s*=\s*"([^"]+)"/)?.[1],
          type: 'module',
          source: match[1],
          file
        }
      })
      .filter((dep): dep is ExtendedDependencyInfo => Boolean(dep)))
  }

  const lockFile = '.terraform.lock.hcl'
  const lock = await readText(join(cwd, lockFile))
  deps.push(...matches(lock, /provider\s+"([^"]+)"\s*\{([\s\S]*?)\}/g)
    .map((match) => ({
      managerId,
      name: normalizeTerraformSource(match[1]),
      version: match[2].match(/\bversion\s*=\s*"([^"]+)"/)?.[1],
      type: 'provider-lock',
      source: match[1],
      file: lockFile
    })))

  return uniqueDependencies(deps)
}

async function parseAnsibleDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['requirements.yml', 'requirements.yaml', 'collections/requirements.yml', 'roles/requirements.yml'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...parseAnsibleRequirementSection(content, 'collections', file))
    deps.push(...parseAnsibleRequirementSection(content, 'roles', file))
    if (!/^\s*(collections|roles)\s*:/m.test(content)) {
      deps.push(...parseAnsibleRequirementItems(content, 'requirement', file))
    }
  }

  return uniqueDependencies(deps)
}

async function parseGitHubActionsDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['.github/workflows/*.yml', '.github/workflows/*.yaml'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...matches(content, /^\s*(?:-\s*)?uses:\s*['"]?([^'"\s#]+)['"]?/gm).map((match) => {
      const [name, version] = splitAutomationRef(match[1])
      return {
        managerId: 'github-actions' as const,
        name,
        version,
        type: name.startsWith('./') ? 'local-workflow' : 'action',
        file
      }
    }))
  }

  return uniqueDependencies(deps)
}

async function parseGitLabCiDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = await firstExisting(cwd, ['.gitlab-ci.yml', '.gitlab-ci.yaml'])
  if (!file) return []
  const content = await readText(join(cwd, file))
  const deps: ExtendedDependencyInfo[] = []
  let currentProject: { name: string; version?: string; type: string } | null = null

  const pushProject = () => {
    if (!currentProject) return
    deps.push({
      managerId: 'gitlab-ci' as const,
      name: currentProject.name,
      version: currentProject.version,
      type: currentProject.type,
      file
    })
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const project = line.match(/^(?:-\s*)?project:\s*['"]?([^'"]+)['"]?$/)
    if (project) {
      pushProject()
      currentProject = { name: project[1].trim(), type: 'project-include' }
      continue
    }

    const ref = line.match(/^ref:\s*['"]?([^'"]+)['"]?$/)
    if (ref && currentProject) {
      currentProject.version = ref[1].trim()
      continue
    }

    const include = line.match(/^(?:-\s*)?(template|remote|component):\s*['"]?([^'"]+)['"]?$/)
    if (include) {
      pushProject()
      currentProject = null
      const [name, version] = splitAutomationRef(include[2].trim())
      deps.push({
        managerId: 'gitlab-ci' as const,
        name,
        version,
        type: `${include[1]}-include`,
        file
      })
    }
  }

  pushProject()
  return uniqueDependencies(deps)
}

async function parsePreCommitDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = await firstExisting(cwd, ['.pre-commit-config.yaml', '.pre-commit-config.yml'])
  if (!file) return []
  const content = await readText(join(cwd, file))
  const deps: ExtendedDependencyInfo[] = []
  let currentRepo = ''
  let currentRev: string | undefined

  const pushCurrent = () => {
    if (!currentRepo || currentRepo === 'local') return
    const [name, version] = splitAutomationRef(currentRepo.includes('@') ? currentRepo : `${currentRepo}${currentRev ? `@${currentRev}` : ''}`)
    deps.push({
      managerId: 'pre-commit' as const,
      name,
      version,
      type: 'repo',
      file
    })
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const repo = line.match(/^-\s*repo:\s*['"]?([^'"]+)['"]?$/)
    if (repo) {
      pushCurrent()
      currentRepo = repo[1].trim()
      currentRev = undefined
      continue
    }
    const rev = line.match(/^rev:\s*['"]?([^'"]+)['"]?$/)
    if (rev) currentRev = rev[1].trim()
  }
  pushCurrent()

  return uniqueDependencies(deps)
}

async function parseBazelDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['MODULE.bazel', 'WORKSPACE', 'WORKSPACE.bazel', 'BUILD', 'BUILD.bazel'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))

    deps.push(...matches(content, /bazel_dep\s*\(([\s\S]*?)\)/g).map<ExtendedDependencyInfo | null>((match) => {
      const block = match[1]
      const name = stringAttribute(block, 'name')
      if (!name) return null
      return {
        managerId: 'bazel' as const,
        name,
        version: stringAttribute(block, 'version'),
        type: 'bazel-module',
        source: stringAttribute(block, 'repo_name'),
        file
      }
    }).filter((dep): dep is ExtendedDependencyInfo => Boolean(dep)))

    deps.push(...matches(content, /(archive_override|git_override|single_version_override|multiple_version_override)\s*\(([\s\S]*?)\)/g).map<ExtendedDependencyInfo | null>((match) => {
      const block = match[2]
      const name = stringAttribute(block, 'module_name') || stringAttribute(block, 'name')
      if (!name) return null
      return {
        managerId: 'bazel' as const,
        name,
        version: stringAttribute(block, 'version') || stringAttribute(block, 'commit') || stringAttribute(block, 'tag'),
        type: match[1],
        source: firstStringAttribute(block, ['urls', 'remote', 'patches']),
        file
      }
    }).filter((dep): dep is ExtendedDependencyInfo => Boolean(dep)))

    deps.push(...parseMavenArtifactsFromBlocks(content, /maven_install\s*\(([\s\S]*?)\)/g, 'bazel', 'maven-artifact', file))

    deps.push(...matches(content, /(http_archive|git_repository|new_git_repository)\s*\(([\s\S]*?)\)/g).map<ExtendedDependencyInfo | null>((match) => {
      const block = match[2]
      const name = stringAttribute(block, 'name')
      if (!name) return null
      const source = firstStringAttribute(block, ['urls', 'remote'])
      return {
        managerId: 'bazel' as const,
        name,
        version: stringAttribute(block, 'tag') || stringAttribute(block, 'commit') || inferVersionFromSource(source),
        type: match[1],
        source,
        file
      }
    }).filter((dep): dep is ExtendedDependencyInfo => Boolean(dep)))
  }

  return uniqueDependencies(deps)
}

async function parsePantsDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const deps: ExtendedDependencyInfo[] = []
  const pantsToml = await readText(join(cwd, 'pants.toml'))
  if (pantsToml) {
    const pantsVersion = extractTomlString(pantsToml, 'pants_version')
    if (pantsVersion) {
      deps.push({
        managerId: 'pants' as const,
        name: 'pantsbuild.pants',
        version: pantsVersion,
        type: 'tool-version',
        file: 'pants.toml'
      })
    }

    deps.push(...parseTomlStringArray(pantsToml, 'backend_packages').map((name) => ({
      managerId: 'pants' as const,
      name,
      type: 'backend-package',
      file: 'pants.toml'
    })))

    deps.push(...parseTomlStringArray(pantsToml, 'plugins').map((value) => {
      const [name, version] = splitPythonRequirement(value)
      return {
        managerId: 'pants' as const,
        name,
        version,
        type: 'plugin',
        file: 'pants.toml'
      }
    }))

    for (const [name, lockfile] of parseTomlKeyValues(sectionContent(pantsToml, 'python.resolves'))) {
      deps.push({
        managerId: 'pants' as const,
        name,
        version: undefined,
        type: 'resolve-lockfile',
        source: lockfile,
        file: 'pants.toml'
      })
    }
  }

  const buildFiles = await existingPatternMatches(cwd, ['BUILD', 'BUILD.pants'])
  for (const file of buildFiles) {
    const content = await readText(join(cwd, file))
    deps.push(...matches(content, /python_requirement\s*\(([\s\S]*?)\)/g).flatMap((match) => {
      const block = match[1]
      const explicit = parseTomlArray(block, 'requirements')
      const values = explicit.length > 0
        ? explicit
        : [stringAttribute(block, 'name') || ''].filter(Boolean)
      return values.map((value) => {
        const [name, version] = splitPythonRequirement(value)
        return {
          managerId: 'pants' as const,
          name,
          version,
          type: 'python-requirement',
          file
        }
      })
    }))

    deps.push(...matches(content, /python_requirements\s*\(([\s\S]*?)\)/g).map((match) => ({
      managerId: 'pants' as const,
      name: stringAttribute(match[1], 'source') || 'requirements.txt',
      type: 'requirements-source',
      file
    })))
  }

  return uniqueDependencies(deps)
}

async function parseBuckDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const deps: ExtendedDependencyInfo[] = []
  const buckConfig = await readText(join(cwd, '.buckconfig'))
  if (buckConfig) {
    for (const [name, source] of [
      ...parseTomlKeyValues(sectionContent(buckConfig, 'cells')),
      ...parseTomlKeyValues(sectionContent(buckConfig, 'repositories'))
    ]) {
      deps.push({
        managerId: 'buck' as const,
        name,
        type: 'cell',
        source,
        file: '.buckconfig'
      })
    }
  }

  const files = await existingPatternMatches(cwd, ['BUCK', 'BUCK.v2'])
  for (const file of files) {
    const content = await readText(join(cwd, file))

    deps.push(...matches(content, /(maven_jar|prebuilt_jar)\s*\(([\s\S]*?)\)/g).map<ExtendedDependencyInfo | null>((match) => {
      const block = match[2]
      const coordinate = stringAttribute(block, 'id') || stringAttribute(block, 'binary_jar') || ''
      const [name, version] = splitMavenCoordinate(coordinate)
      if (!name) return null
      return {
        managerId: 'buck' as const,
        name,
        version,
        type: match[1],
        source: stringAttribute(block, 'name'),
        file
      }
    }).filter((dep): dep is ExtendedDependencyInfo => Boolean(dep)))

    deps.push(...matches(content, /(http_archive|remote_file)\s*\(([\s\S]*?)\)/g).map<ExtendedDependencyInfo | null>((match) => {
      const block = match[2]
      const name = stringAttribute(block, 'name')
      if (!name) return null
      const source = firstStringAttribute(block, ['urls', 'url'])
      return {
        managerId: 'buck' as const,
        name,
        version: stringAttribute(block, 'version') || inferVersionFromSource(stringAttribute(block, 'strip_prefix') || source),
        type: match[1],
        source,
        file
      }
    }).filter((dep): dep is ExtendedDependencyInfo => Boolean(dep)))
  }

  return uniqueDependencies(deps)
}

async function parseOpamDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['*.opam', 'dune-project'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    const content = await readText(join(cwd, file))
    if (file.endsWith('.opam')) {
      for (const block of matches(content, /\b(depends|depopts)\s*:\s*\[([\s\S]*?)\]/g)) {
        deps.push(...matches(block[2], /"([^"]+)"\s*(?:\{([^}]+)\})?/g).map((match) => ({
          managerId: 'opam' as const,
          name: match[1],
          version: normalizeOpamConstraint(match[2]),
          type: block[1],
          file
        })))
      }
    }

    if (file === 'dune-project') {
      deps.push(...matches(content, /\((depends|depopts)\s+([\s\S]*?)\)/g).flatMap((block) => (
        matches(block[2], /([A-Za-z0-9_.+-]+)(?:\s+\(([^)]+)\))?/g).map((match) => ({
          managerId: 'opam' as const,
          name: match[1],
          version: normalizeOpamConstraint(match[2]),
          type: `dune-${block[1]}`,
          file
        }))
      )))
    }
  }

  return uniqueDependencies(deps.filter((dep) => dep.name && dep.name !== 'ocaml'))
}

async function parseCpanDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['cpanfile'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...matches(content, /\b(requires|test_requires|configure_requires|build_requires|recommends|suggests)\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/g).map((match) => ({
      managerId: 'cpan' as const,
      name: match[2],
      version: match[3],
      type: match[1],
      file
    })))
  }
  return uniqueDependencies(deps)
}

async function parseLuaRocksDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['*.rockspec'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const block of matches(content, /\b(dependencies|build_dependencies|test_dependencies)\s*=\s*\{([\s\S]*?)\}/g)) {
      deps.push(...matches(block[2], /["']([^"']+)["']/g).map((match) => {
        const [name, version] = splitPackageConstraint(match[1])
        return {
          managerId: 'luarocks' as const,
          name,
          version,
          type: block[1],
          file
        }
      }))
    }
  }
  return uniqueDependencies(deps.filter((dep) => dep.name.toLowerCase() !== 'lua'))
}

async function parseShardsDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const file = await firstExisting(cwd, ['shard.yml'])
  if (!file) return []
  const content = await readText(join(cwd, file))
  const deps: ExtendedDependencyInfo[] = []
  let section = ''
  let current: ExtendedDependencyInfo | null = null

  const pushCurrent = () => {
    if (current?.name) deps.push(current)
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const sectionMatch = rawLine.match(/^([A-Za-z_]+):\s*$/)
    if (sectionMatch) {
      pushCurrent()
      current = null
      section = sectionMatch[1]
      continue
    }
    if (section !== 'dependencies' && section !== 'development_dependencies') continue

    const depMatch = rawLine.match(/^\s{2}([A-Za-z0-9_.-]+):\s*$/)
    if (depMatch) {
      pushCurrent()
      current = {
        managerId: 'shards' as const,
        name: depMatch[1],
        type: section,
        file
      }
      continue
    }

    const attrMatch = rawLine.match(/^\s{4}(version|tag|branch|github|git):\s*(.+)$/)
    if (attrMatch && current) {
      const value = cleanYamlScalar(attrMatch[2])
      if (attrMatch[1] === 'version' || attrMatch[1] === 'tag' || attrMatch[1] === 'branch') current.version = value
      if (attrMatch[1] === 'github' || attrMatch[1] === 'git') current.source = value
    }
  }
  pushCurrent()
  return uniqueDependencies(deps)
}

async function parseZigDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['build.zig.zon', 'build.zig'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    if (file === 'build.zig.zon') {
      deps.push(...parseZigZonDependencyBlocks(content, file))
    }

    if (file === 'build.zig') {
      deps.push(...matches(content, /\.dependency\s*\(\s*"([^"]+)"/g).map((match) => ({
        managerId: 'zig' as const,
        name: match[1],
        type: 'build-dependency',
        file
      })))
    }
  }
  return uniqueDependencies(deps.filter((dep) => dep.name !== 'dependencies' && dep.name !== 'paths'))
}

function parseZigZonDependencyBlocks(content: string, file: string): ExtendedDependencyInfo[] {
  const deps: ExtendedDependencyInfo[] = []
  for (const match of matches(content, /\.([A-Za-z0-9_.$-]+)\s*=\s*\.?\{/g)) {
    const name = match[1]
    if (name === 'dependencies' || name === 'paths') continue

    const openBraceIndex = content.indexOf('{', match.index)
    const closeBraceIndex = findMatchingBrace(content, openBraceIndex)
    if (openBraceIndex < 0 || closeBraceIndex < 0) continue

    const block = content.slice(openBraceIndex + 1, closeBraceIndex)
    const source = stringAttribute(block, 'url') || stringAttribute(block, 'path')
    const version = stringAttribute(block, 'version') || stringAttribute(block, 'hash')?.slice(0, 12)
    if (!source && !version) continue

    deps.push({
      managerId: 'zig' as const,
      name,
      version,
      type: 'zon-dependency',
      source,
      file
    })
  }
  return deps
}

function findMatchingBrace(content: string, openBraceIndex: number): number {
  if (openBraceIndex < 0) return -1
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = openBraceIndex; index < content.length; index++) {
    const char = content[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

async function parseHomebrewDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['Brewfile'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const match of matches(content, /^\s*(brew|cask|tap|mas|vscode)\s+["']([^"']+)["']([^\r\n]*)/gm)) {
      deps.push({
        managerId: 'homebrew' as const,
        name: match[2],
        version: match[3]?.match(/\bversion:\s*["']([^"']+)["']/)?.[1],
        type: match[1],
        file
      })
    }
  }
  return uniqueDependencies(deps)
}

async function parseChocolateyDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['packages.config', 'chocolatey.config'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    deps.push(...matches(content, /<package\b([^>]*)\/?>/gi).map((match) => ({
      managerId: 'chocolatey' as const,
      name: xmlAttribute(match[1], 'id') || '',
      version: xmlAttribute(match[1], 'version'),
      type: 'package',
      source: xmlAttribute(match[1], 'source'),
      file
    })))
  }
  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseScoopDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['scoopfile.json', 'scoopfile'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    if (file.endsWith('.json')) {
      const manifest = await readJson(join(cwd, file))
      for (const app of normalizeManifestArray(manifest?.apps || manifest?.Apps || manifest?.packages || manifest?.Packages)) {
        deps.push({
          managerId: 'scoop' as const,
          name: app.name,
          version: app.version,
          type: 'app',
          source: app.source,
          file
        })
      }
      for (const bucket of normalizeManifestArray(manifest?.buckets || manifest?.Buckets)) {
        deps.push({
          managerId: 'scoop' as const,
          name: bucket.name,
          version: bucket.version,
          type: 'bucket',
          source: bucket.source,
          file
        })
      }
      continue
    }

    const content = await readText(join(cwd, file))
    for (const line of content.split(/\r?\n/)) {
      const clean = line.replace(/#.*/, '').trim()
      if (!clean) continue
      const [name, version] = splitScoopPackageSpec(clean)
      deps.push({
        managerId: 'scoop' as const,
        name,
        version,
        type: 'app',
        file
      })
    }
  }
  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseWingetDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['winget-export.json', 'winget-packages.json'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const manifest = await readJson(join(cwd, file))
    const sources = Array.isArray(manifest?.Sources) ? manifest.Sources : Array.isArray(manifest?.sources) ? manifest.sources : [{ Packages: manifest?.Packages || manifest?.packages }]
    for (const source of sources) {
      const packages = Array.isArray(source?.Packages) ? source.Packages : Array.isArray(source?.packages) ? source.packages : []
      for (const item of packages) {
        const name = String(item?.PackageIdentifier || item?.packageIdentifier || item?.Id || item?.id || '').trim()
        if (!name) continue
        deps.push({
          managerId: 'winget' as const,
          name,
          version: item?.Version || item?.version,
          type: 'package',
          source: source?.SourceDetails?.Name || source?.Name || source?.name,
          file
        })
      }
    }
  }
  return uniqueDependencies(deps)
}

async function parseAsdfDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['.tool-versions'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const rawLine of content.split(/\r?\n/)) {
      const clean = rawLine.replace(/#.*/, '').trim()
      if (!clean) continue
      const [name, ...versions] = clean.split(/\s+/)
      deps.push({
        managerId: 'asdf' as const,
        name,
        version: versions.join(', ') || undefined,
        type: 'runtime-version',
        file
      })
    }
  }
  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseMiseDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['mise.toml', '.mise.toml'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const [name, value] of parseTomlKeyValues(sectionContent(content, 'tools'))) {
      deps.push({
        managerId: 'mise' as const,
        name,
        version: normalizeMiseToolVersion(value),
        type: 'runtime-version',
        file
      })
    }
  }
  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseSdkmanDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['.sdkmanrc'])
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const rawLine of content.split(/\r?\n/)) {
      const clean = rawLine.replace(/#.*/, '').trim()
      if (!clean || clean.startsWith('sdkman_')) continue
      const [name, ...rest] = clean.split('=')
      deps.push({
        managerId: 'sdkman' as const,
        name: name.trim(),
        version: rest.join('=').trim() || undefined,
        type: 'candidate',
        file
      })
    }
  }
  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseSystemPackageLineDependencies(
  cwd: string,
  managerId: DependencyManagerId,
  patterns: readonly string[],
  type: string
): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, patterns)
  const deps: ExtendedDependencyInfo[] = []
  for (const file of files) {
    const content = await readText(join(cwd, file))
    for (const rawLine of content.split(/\r?\n/)) {
      const clean = rawLine.replace(/#.*/, '').trim()
      if (!clean) continue
      const [name, version] = splitSystemPackageSpec(clean)
      deps.push({
        managerId,
        name,
        version,
        type,
        file
      })
    }
  }
  return uniqueDependencies(deps.filter((dep) => dep.name))
}

async function parseNixDependencies(cwd: string): Promise<ExtendedDependencyInfo[]> {
  const files = await existingPatternMatches(cwd, ['flake.nix', 'flake.lock', 'shell.nix', 'default.nix'])
  const deps: ExtendedDependencyInfo[] = []

  for (const file of files) {
    if (file === 'flake.lock') {
      const lock = await readJson(join(cwd, file))
      for (const [name, value] of objectEntries(lock?.nodes)) {
        if (name === 'root' || !value || typeof value !== 'object') continue
        const locked = (value as Record<string, any>).locked
        if (!locked || typeof locked !== 'object') continue
        const source = nixLockedSource(locked)
        deps.push({
          managerId: 'nix' as const,
          name,
          version: stringValue(locked.rev || locked.ref || locked.lastModified),
          type: 'flake-lock',
          source,
          file
        })
      }
      continue
    }

    const content = await readText(join(cwd, file))
    for (const match of matches(content, /^\s*([A-Za-z0-9_.-]+)\.url\s*=\s*["']([^"']+)["']/gm)) {
      deps.push({
        managerId: 'nix' as const,
        name: match[1],
        version: inferNixInputVersion(match[2]),
        type: 'flake-input',
        source: match[2],
        file
      })
    }

    for (const packageName of parseNixPackageReferences(content)) {
      deps.push({
        managerId: 'nix' as const,
        name: packageName,
        type: 'package',
        file
      })
    }
  }

  return uniqueDependencies(deps.filter((dep) => dep.name))
}

function normalizeManifestArray(value: unknown): Array<{ name: string; version?: string; source?: string }> {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string') {
      const [name, version] = splitScoopPackageSpec(item)
      return { name, version }
    }
    if (!item || typeof item !== 'object') return { name: '' }
    const record = item as Record<string, unknown>
    return {
      name: String(record.Name || record.name || record.App || record.app || record.PackageIdentifier || record.packageIdentifier || '').trim(),
      version: stringValue(record.Version || record.version),
      source: stringValue(record.Source || record.source || record.Bucket || record.bucket)
    }
  }).filter((item) => item.name)
}

function splitScoopPackageSpec(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim())
  const atVersion = clean.match(/^([^@\s]+)@(.+)$/)
  if (atVersion) return [atVersion[1], atVersion[2]]
  return splitPackageConstraint(clean)
}

function normalizeMiseToolVersion(value: string): string | undefined {
  const objectVersion = value.match(/\bversion\s*=\s*["']([^"']+)["']/)
  if (objectVersion) return objectVersion[1]
  const arrayVersions = matches(value, /["']([^"']+)["']/g).map((match) => match[1])
  if (arrayVersions.length > 0) return arrayVersions.join(', ')
  return stripQuotes(value.trim()) || undefined
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

async function parseUnmappedManagerDependencies(cwd: string, manager: DependencyManagerDefinition): Promise<ExtendedDependencyInfo[]> {
  const aiInventory = await readAiManagerInventory(cwd, manager.id)
  if (aiInventory) return aiInventory
  const files = await existingPatternMatches(cwd, manager.manifestFiles)
  return files.map((file) => ({
    managerId: manager.id,
    name: file,
    type: 'manifest',
    file
  }))
}

function splitPythonRequirement(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim()).replace(/,$/, '')
  const match = clean.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(.*)$/)
  if (!match) return [clean, undefined]
  const version = match[2]?.trim()
  if (!version) return [match[1], undefined]
  const exact = version.match(/^={2,3}\s*(.+)$/)
  return [match[1], exact ? exact[1].trim() : version]
}

function splitMavenCoordinate(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim()).replace(/^mvn:/, '')
  if (!clean) return ['', undefined]
  const parts = clean.split(':').map((item) => item.trim()).filter(Boolean)
  if (parts.length >= 3) return [`${parts[0]}:${parts[1]}`, parts[parts.length - 1]]
  if (parts.length >= 2) return [`${parts[0]}:${parts[1]}`, undefined]
  return [clean, undefined]
}

function parseMavenArtifactsFromBlocks(
  content: string,
  blockRegex: RegExp,
  managerId: DependencyManagerId,
  type: string,
  file: string
): ExtendedDependencyInfo[] {
  return matches(content, blockRegex).flatMap((match) => (
    parseTomlArray(match[1], 'artifacts').map((coordinate) => {
      const [name, version] = splitMavenCoordinate(coordinate)
      return {
        managerId,
        name,
        version,
        type,
        file
      }
    }).filter((dep) => dep.name)
  ))
}

function stringAttribute(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1]?.trim()
}

function firstStringAttribute(block: string, names: string[]): string | undefined {
  for (const name of names) {
    const value = stringAttribute(block, name) || parseTomlArray(block, name)[0]
    if (value) return value
  }
  return undefined
}

function extractTomlString(content: string, key: string): string | undefined {
  return content.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*["']([^"']+)["']`, 'im'))?.[1]?.trim()
}

function parseTomlStringArray(content: string, key: string): string[] {
  return parseTomlArray(content, key)
}

function inferVersionFromSource(value?: string): string | undefined {
  if (!value) return undefined
  const fileName = value.split(/[/?#]/).filter(Boolean).pop() || value
  const clean = fileName
    .replace(/\.(tar\.gz|tar\.bz2|tar\.xz|tgz|zip|jar)$/i, '')
    .replace(/\.git$/i, '')
  return clean.match(/(?:^|[-_])v?(\d+(?:\.\d+)+(?:[-+][A-Za-z0-9.]+)?)/)?.[1]
}

function parseRDescriptionDependencies(content: string): Array<[string, string | undefined]> {
  const fields = new Map<string, string>()
  let currentKey = ''
  for (const line of content.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9_.-]*):\s*(.*)$/)
    if (field) {
      currentKey = field[1]
      fields.set(currentKey, field[2])
      continue
    }
    if (currentKey && /^\s+/.test(line)) {
      fields.set(currentKey, `${fields.get(currentKey) || ''} ${line.trim()}`)
    }
  }

  const deps: Array<[string, string | undefined]> = []
  for (const key of ['Depends', 'Imports', 'Suggests', 'LinkingTo']) {
    const value = fields.get(key)
    if (!value) continue
    for (const raw of value.split(',')) {
      const item = raw.trim()
      if (!item || item.toLowerCase() === 'r') continue
      const match = item.match(/^([A-Za-z0-9_.-]+)(?:\s*\(([^)]+)\))?/)
      if (match) deps.push([match[1], match[2]?.trim()])
    }
  }
  return deps
}

function splitHaskellPackageSpec(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim()).replace(/,$/, '')
  const hyphenVersion = clean.match(/^([A-Za-z0-9_.-]+)-(\d[\w.+-]*)$/)
  if (hyphenVersion) return [hyphenVersion[1], hyphenVersion[2]]
  const constraint = clean.match(/^([A-Za-z0-9_.-]+)\s+(.+)$/)
  if (constraint) return [constraint[1], constraint[2].trim()]
  return [clean, undefined]
}

function normalizeOpamConstraint(value?: string): string | undefined {
  if (!value) return undefined
  return value
    .replace(/\s+/g, ' ')
    .replace(/^&\s*/, '')
    .replace(/["{}]/g, '')
    .trim() || undefined
}

function splitPackageConstraint(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim()).replace(/,$/, '')
  const match = clean.match(/^([A-Za-z0-9_.:+/-]+)\s*(.*)$/)
  return [match?.[1] || clean, match?.[2]?.trim() || undefined]
}

function splitSystemPackageSpec(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim()).replace(/,$/, '')
  const operator = clean.match(/^([A-Za-z0-9_.:+-]+)\s*(==|=|>=|<=|>|<)\s*(.+)$/)
  if (operator) {
    return [operator[1], operator[2] === '=' || operator[2] === '==' ? operator[3].trim() : `${operator[2]} ${operator[3].trim()}`]
  }

  const hyphenVersion = !/\s/.test(clean) ? clean.match(/^(.+)-([0-9][A-Za-z0-9.+:~_-]*)$/) : null
  if (hyphenVersion) return [hyphenVersion[1], hyphenVersion[2]]

  const [name, ...rest] = clean.split(/\s+/)
  return [name, rest.join(' ').trim() || undefined]
}

function parseNixPackageReferences(content: string): string[] {
  const withoutComments = content.split(/\r?\n/).map(stripInlineComment).join('\n')
  const refs = new Set<string>()

  for (const match of matches(withoutComments, /(?:with\s+pkgs;\s*)?\[([\s\S]*?)\]/g)) {
    for (const rawToken of match[1].split(/\s+/)) {
      const token = rawToken.replace(/[;,()[\]{}]/g, '').trim()
      if (!token || token.includes('=') || token.includes('"') || token.includes("'")) continue
      const packageMatch = token.match(/^(?:pkgs\.|legacyPackages\.[A-Za-z0-9_-]+\.|[A-Za-z0-9_+-]+Packages\.)?([A-Za-z0-9_+.-]+)$/)
      if (!packageMatch) continue
      const name = packageMatch[1]
      if (NIX_TOKEN_STOP_WORDS.has(name) || name.startsWith('.')) continue
      refs.add(name)
    }
  }

  return [...refs]
}

function inferNixInputVersion(value: string): string | undefined {
  const clean = value.trim()
  const slashParts = clean.split('/').filter(Boolean)
  const ref = slashParts[slashParts.length - 1]
  if (ref && !ref.includes(':') && !ref.includes('.git')) return ref
  const queryRef = clean.match(/[?&]ref=([^&]+)/)
  return queryRef?.[1]
}

function nixLockedSource(locked: Record<string, any>): string | undefined {
  if (locked.owner && locked.repo) return `${locked.type || 'github'}:${locked.owner}/${locked.repo}`
  if (locked.url) return String(locked.url)
  if (locked.path) return String(locked.path)
  if (locked.type) return String(locked.type)
  return undefined
}

function parseCabalBuildDepends(content: string): Array<[string, string | undefined]> {
  const deps: Array<[string, string | undefined]> = []
  const lines = content.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(/^\s*build-depends\s*:\s*(.*)$/i)
    if (!match) continue

    const block: string[] = [match[1]]
    for (const next of lines.slice(index + 1)) {
      if (/^\s+[^\s].*/.test(next) && !/^\s*\w[\w-]*\s*:/.test(next)) {
        block.push(next.trim())
        index += 1
        continue
      }
      break
    }

    for (const part of block.join(' ').split(',')) {
      const value = part.trim()
      if (!value) continue
      deps.push(splitHaskellPackageSpec(value))
    }
  }
  return deps.filter(([name]) => name.toLowerCase() !== 'base')
}

function splitImageReference(value: string): [string, string | undefined] {
  const digestIndex = value.indexOf('@')
  if (digestIndex >= 0) return [value.slice(0, digestIndex), value.slice(digestIndex + 1)]

  const slashIndex = value.lastIndexOf('/')
  const tagIndex = value.lastIndexOf(':')
  if (tagIndex > slashIndex) return [value.slice(0, tagIndex), value.slice(tagIndex + 1)]
  return [value, undefined]
}

function normalizeTerraformSource(value: string): string {
  return value
    .replace(/^registry\.terraform\.io\//, '')
    .replace(/^registry\.opentofu\.org\//, '')
    .replace(/^github\.com\//, '')
    .replace(/^git::/, '')
    .replace(/\.git$/i, '')
}

function splitAutomationRef(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim()).replace(/,$/, '')
  if (!clean) return [clean, undefined]
  if (clean.startsWith('docker://')) return splitImageReference(clean.replace(/^docker:\/\//, ''))
  const atIndex = clean.lastIndexOf('@')
  if (atIndex > 0) return [clean.slice(0, atIndex), clean.slice(atIndex + 1)]
  return [clean, undefined]
}

function splitGitOpsReference(value: string): [string, string | undefined] {
  const clean = stripQuotes(value.trim()).replace(/,$/, '')
  if (!clean) return [clean, undefined]
  const queryRef = clean.match(/[?&](?:ref|version)=([^&]+)/)
  const withoutQuery = clean.replace(/[?&](?:ref|version)=[^&]+/, '')
  const atIndex = withoutQuery.lastIndexOf('@')
  if (atIndex > 0 && !withoutQuery.slice(atIndex + 1).includes('/')) {
    return [withoutQuery.slice(0, atIndex), withoutQuery.slice(atIndex + 1)]
  }
  return [withoutQuery, queryRef?.[1]]
}

function parseAnsibleRequirementSection(content: string, section: string, file: string): ExtendedDependencyInfo[] {
  const block = sectionAfterKey(content, section)
  return parseAnsibleRequirementItems(block, section, file)
}

function parseAnsibleRequirementItems(content: string, type: string, file: string): ExtendedDependencyInfo[] {
  const deps: ExtendedDependencyInfo[] = []
  let current: { name?: string; version?: string; source?: string } | null = null

  const pushCurrent = () => {
    if (!current?.name) return
    deps.push({
      managerId: 'ansible',
      name: current.name,
      version: current.version,
      type,
      source: current.source,
      file
    })
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const item = line.match(/^-\s*(.+)$/)
    if (item) {
      pushCurrent()
      current = {}
      const inlineName = item[1].match(/^(?:name|src):\s*(.+)$/)
      if (inlineName) current.name = cleanYamlScalar(inlineName[1])
      else if (!item[1].includes(':')) current.name = cleanYamlScalar(item[1])
      continue
    }

    const property = line.match(/^(name|src|version):\s*(.+)$/)
    if (!property) continue
    if (!current) current = {}
    if (property[1] === 'version') current.version = cleanYamlScalar(property[2])
    else if (property[1] === 'src') {
      current.source = cleanYamlScalar(property[2])
      if (!current.name) current.name = packageNameFromUrl(current.source)
    } else {
      current.name = cleanYamlScalar(property[2])
    }
  }

  pushCurrent()
  return deps
}

function inferVersionFromSpecifier(value: string): string | undefined {
  const npmMatch = value.match(/npm:[^@]+@(.+)$/)
  if (npmMatch) return npmMatch[1]
  const atMatch = value.match(/@([^/@]+)$/)
  return atMatch?.[1]
}

function packageNameFromUrl(value: string): string {
  return value.replace(/\.git$/i, '').split('/').filter(Boolean).pop() || value
}

function parseTomlArray(content: string, key: string): string[] {
  const match = content.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm'))
  if (!match) return []
  return matches(match[1], /["']([^"']+)["']/g).map((item) => item[1])
}

function parseTomlKeyValues(content: string): Array<[string, string]> {
  return content
    .split(/\r?\n/)
    .map((line) => stripInlineComment(line).trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const [rawName, ...rawValue] = line.split('=')
      return [stripQuotes(rawName.trim()), normalizeTomlValue(rawValue.join('=').trim())] as [string, string]
    })
}

function stripInlineComment(line: string): string {
  let quote: string | null = null
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\' && quote) { escaped = true; continue }
    if (char === '"' || char === "'") { quote = quote === char ? null : quote || char; continue }
    if (char === '#' && !quote) return line.slice(0, index)
  }
  return line
}

function sectionContent(content: string, section: string): string {
  const sectionPattern = new RegExp(`^\\s*\\[${escapeRegExp(section)}\\]\\s*$`, 'm')
  const match = sectionPattern.exec(content)
  if (!match) return ''
  const rest = content.slice(match.index + match[0].length)
  const nextSection = rest.search(/^\s*\[[^\]]+\]\s*$/m)
  return nextSection >= 0 ? rest.slice(0, nextSection) : rest
}

function sectionAfterKey(content: string, key: string): string {
  const lines = content.split(/\r?\n/)
  const start = lines.findIndex((line) => new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`).test(line))
  if (start < 0) return ''
  const result: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && !line.startsWith('-')) break
    result.push(line)
  }
  return result.join('\n')
}

function readYamlList(content: string, key: string): string[] {
  const block = sectionAfterKey(content, key)
  return block
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*(.+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(cleanYamlScalar)
    .filter(Boolean)
}

function parseYamlObjectList(content: string, key: string): Array<Record<string, string>> {
  const block = sectionAfterKey(content, key)
  const items: Array<Record<string, string>> = []
  let current: Record<string, string> | null = null

  const pushCurrent = () => {
    if (current && Object.keys(current).length > 0) items.push(current)
  }

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const item = line.match(/^-\s*(.*)$/)
    if (item) {
      pushCurrent()
      current = {}
      const inlineProperty = item[1].match(/^([A-Za-z0-9_.-]+):\s*(.+)$/)
      if (inlineProperty) current[inlineProperty[1]] = cleanYamlScalar(inlineProperty[2])
      else if (item[1]) current.name = cleanYamlScalar(item[1])
      continue
    }

    const property = line.match(/^([A-Za-z0-9_.-]+):\s*(.+)$/)
    if (property) {
      if (!current) current = {}
      current[property[1]] = cleanYamlScalar(property[2])
    }
  }

  pushCurrent()
  return items
}

function yamlDocuments(content: string): string[] {
  return content.split(/^---\s*$/m).map((doc) => doc.trim()).filter(Boolean)
}

function yamlScalar(content: string, key: string): string | undefined {
  return cleanYamlScalar(content.match(new RegExp(`^[ \\t]*${escapeRegExp(key)}[ \\t]*:[ \\t]*(.+)$`, 'm'))?.[1])
}

function cleanYamlScalar(value?: string): string {
  return stripQuotes((value || '').trim())
}

function xmlAttribute(attrs: string | undefined, name: string): string | undefined {
  const match = (attrs || '').match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1]
}

function normalizeTomlValue(value: string): string {
  if (value === '*') return value
  if (value.startsWith('{')) return value
  return stripQuotes(value)
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

// Character-level scan so `//` inside string values (URLs, scopes) survives;
// the previous regex truncated every `//` outside `://` and broke JSON parsing.
function stripJsonComments(value: string): string {
  let result = ''
  let index = 0
  while (index < value.length) {
    const char = value[index]
    if (char === '"') {
      const end = endOfJsonString(value, index)
      result += value.slice(index, end)
      index = end
      continue
    }
    if (char === '/' && value[index + 1] === '/') {
      // Line comment: strip to (not including) the newline so line structure stays.
      index += 2
      while (index < value.length && value[index] !== '\n') index += 1
      continue
    }
    if (char === '/' && value[index + 1] === '*') {
      const end = value.indexOf('*/', index + 2)
      index = end < 0 ? value.length : end + 2
      continue
    }
    result += char
    index += 1
  }
  return result
}

function endOfJsonString(value: string, start: number): number {
  let index = start + 1
  while (index < value.length) {
    if (value[index] === '\\') {
      index += 2
      continue
    }
    if (value[index] === '"') return index + 1
    index += 1
  }
  return value.length
}

function normalizeArgs(tool: string, args: string[]): string[] {
  if (args[0]?.toLowerCase() === tool.toLowerCase()) return args.slice(1)
  if (tool === 'maven' && args[0]?.toLowerCase() === 'mvn') return args.slice(1)
  if (tool === 'bundle' && args[0]?.toLowerCase() === 'bundler') return args.slice(1)
  if (tool === 'pod' && args[0]?.toLowerCase() === 'cocoapods') return args.slice(1)
  if (tool === 'buck2' && args[0]?.toLowerCase() === 'buck') return args.slice(1)
  return args
}

function objectEntries(value: unknown): Array<[string, unknown]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>)
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function readJson(path: string): Promise<any> {
  return parseJson(await readText(path), null)
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8')
  } catch (error: any) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }
}

async function firstExisting(cwd: string, files: string[]): Promise<string | null> {
  for (const file of files) {
    try {
      await access(join(cwd, file))
      return file
    } catch {
    }
  }
  return null
}

async function backupPatternMatches(cwd: string, patterns: readonly string[]): Promise<string[]> {
  const matchers = patterns.map((pattern) => {
    const normalized = pattern.replace(/\\/g, '/')
    return {
      nested: normalized.includes('/'),
      expression: wildcardToRegExp(normalized)
    }
  })
  return await findWorkspaceFiles(cwd, (fileName, relativePath) => (
    matchers.some(({ nested, expression }) => expression.test(nested ? relativePath : fileName))
  ), { maxDepth: 8, ignoredDirectories: ['.npmDesktopManager'] })
}

function matches(content: string, regex: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    results.push(match)
  }
  return results
}

function uniqueDependencies(items: ExtendedDependencyInfo[]): ExtendedDependencyInfo[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.managerId}:${item.file}:${item.type}:${item.name}:${item.version || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function timestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
