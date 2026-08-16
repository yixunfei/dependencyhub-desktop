import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import { findWorkspaceFiles } from '../../workspaceFiles'
import type { BackendWorkspaceManagerId } from './backendTypes'

export interface BackendOperationTemplate {
  args: string[]
  requirements: string[]
  warnings: string[]
}

export async function createBackendOperationTemplate(
  cwd: string,
  managerId: BackendWorkspaceManagerId,
  request: ManagerOperationRequest
): Promise<BackendOperationTemplate> {
  const requirements: string[] = []
  const warnings: string[] = []
  if ((request.operation === 'install' || request.operation === 'remove') && !request.packageName?.trim()) {
    requirements.push('Package name is required for this operation.')
  }
  if (managerId === 'nuget') return await nugetOperation(cwd, request, requirements, warnings)
  if (managerId === 'composer') return composerOperation(request, requirements, warnings)
  return bundlerOperation(request, requirements, warnings)
}

export function backendDryRunTemplate(
  managerId: BackendWorkspaceManagerId,
  args: string[]
): string[] | null {
  if (managerId !== 'composer' || args.length === 0) return null
  if (!['require', 'remove', 'update', 'install'].includes(args[0])) return null
  return args.includes('--dry-run') ? [...args] : [...args, '--dry-run']
}

async function nugetOperation(
  cwd: string,
  request: ManagerOperationRequest,
  requirements: string[],
  warnings: string[]
): Promise<BackendOperationTemplate> {
  if (request.operation === 'install' || request.operation === 'update') {
    if (!request.packageName?.trim()) requirements.push('Package name is required for NuGet package updates.')
    const project = await selectDotnetProject(cwd, request, requirements)
    return result([
      'add',
      ...(project ? [project] : []),
      'package',
      request.packageName || '',
      ...(request.version ? ['--version', request.version] : []),
      ...(request.options?.prerelease === true ? ['--prerelease'] : [])
    ], requirements, warnings)
  }
  if (request.operation === 'remove') {
    const project = await selectDotnetProject(cwd, request, requirements)
    return result(['remove', ...(project ? [project] : []), 'package', request.packageName || ''], requirements, warnings)
  }
  if (request.operation === 'outdated') return result(['list', 'package', '--outdated', '--include-transitive'], requirements, warnings)
  if (request.operation === 'audit') return result(['list', 'package', '--vulnerable', '--include-transitive'], requirements, warnings)
  if (request.operation === 'tree' || request.operation === 'list') return result(['list', 'package', '--include-transitive'], requirements, warnings)
  if (request.operation === 'lock') return result(['restore', '--use-lock-file'], requirements, warnings)
  return result(['restore', ...(request.options?.lockedMode === true ? ['--locked-mode'] : [])], requirements, warnings)
}

async function selectDotnetProject(
  cwd: string,
  request: ManagerOperationRequest,
  requirements: string[]
): Promise<string | undefined> {
  const projects = await findWorkspaceFiles(cwd, (name) => /\.(?:cs|fs|vb)proj$/i.test(name))
  const requested = typeof request.options?.projectFile === 'string'
    ? request.options.projectFile.replace(/\\/g, '/')
    : undefined
  if (requested && projects.includes(requested)) return requested.includes('/') ? requested : undefined
  if (requested) requirements.push(`Project file was not found: ${requested}`)
  if (projects.length === 1) return projects[0].includes('/') ? projects[0] : undefined
  if (projects.length === 0) requirements.push('No .csproj, .fsproj, or .vbproj file was found.')
  if (projects.length > 1 && !requested) requirements.push('Multiple .NET projects were found; select options.projectFile.')
  return requested
}

function composerOperation(
  request: ManagerOperationRequest,
  requirements: string[],
  warnings: string[]
): BackendOperationTemplate {
  if (request.operation === 'install') return result(['require', composerSpec(request), ...(request.dev ? ['--dev'] : [])], requirements, warnings)
  if (request.operation === 'remove') return result(['remove', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') return result(['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
  if (request.operation === 'outdated') return result(['outdated', '--direct'], requirements, warnings)
  if (request.operation === 'audit') return result(['audit', '--locked'], requirements, warnings)
  if (request.operation === 'tree') return result(['show', '--tree'], requirements, warnings)
  if (request.operation === 'list') return result(['show', '--locked'], requirements, warnings)
  if (request.operation === 'lock') return result(['update', '--lock'], requirements, warnings)
  return result(['install'], requirements, warnings)
}

function bundlerOperation(
  request: ManagerOperationRequest,
  requirements: string[],
  warnings: string[]
): BackendOperationTemplate {
  if (request.operation === 'install') {
    return result([
      'add',
      request.packageName || '',
      ...(request.version ? ['--version', request.version] : []),
      ...(request.dev ? ['--group', 'development'] : [])
    ], requirements, warnings)
  }
  if (request.operation === 'remove') return result(['remove', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') return result(['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
  if (request.operation === 'outdated') return result(['outdated'], requirements, warnings)
  if (request.operation === 'audit') {
    return result(['audit', 'check'], requirements, [...warnings, 'The bundler-audit executable or Bundler audit plugin must be installed.'])
  }
  if (request.operation === 'tree' || request.operation === 'list') return result(['list'], requirements, warnings)
  if (request.operation === 'lock') return result(['lock'], requirements, warnings)
  return result(['install'], requirements, warnings)
}

function composerSpec(request: ManagerOperationRequest): string {
  const name = request.packageName?.trim() || ''
  const version = request.version?.trim()
  if (!version || version === '*' || version.toLowerCase() === 'latest') return name
  return `${name}:${version}`
}

function result(args: string[], requirements: string[], warnings: string[]): BackendOperationTemplate {
  return { args: args.filter(Boolean), requirements, warnings }
}
