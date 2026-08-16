import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import { findWorkspaceFiles } from '../../workspaceFiles'
import type { PythonWorkspaceManagerId } from './pythonTypes'

export interface PythonOperationTemplate {
  args: string[]
  requirements: string[]
  warnings: string[]
}

export async function createPythonOperationTemplate(
  cwd: string,
  managerId: PythonWorkspaceManagerId,
  request: ManagerOperationRequest
): Promise<PythonOperationTemplate> {
  const requirements: string[] = []
  const warnings: string[] = []
  if ((request.operation === 'install' || request.operation === 'remove') && !request.packageName?.trim()) {
    requirements.push('Package name is required for this operation.')
  }
  if (managerId === 'uv') return uvOperation(request, requirements, warnings)
  if (managerId === 'poetry') return poetryOperation(request, requirements, warnings)
  if (managerId === 'pipenv') return pipenvOperation(request, requirements, warnings)
  return await condaOperation(cwd, request, requirements, warnings)
}

export function pythonDryRunTemplate(
  managerId: PythonWorkspaceManagerId,
  args: string[]
): string[] | null {
  if (args.length === 0 || args.includes('--dry-run')) return args.includes('--dry-run') ? [...args] : null
  if (managerId === 'poetry' && ['add', 'remove', 'update', 'install'].includes(args[0])) {
    return [...args, '--dry-run']
  }
  if (managerId === 'pipenv' && ['install', 'uninstall', 'update'].includes(args[0])) {
    return [...args, '--dry-run']
  }
  if (managerId === 'conda' && ['install', 'remove', 'update'].includes(args[0])) {
    return [...args, '--dry-run']
  }
  return null
}

function uvOperation(
  request: ManagerOperationRequest,
  requirements: string[],
  warnings: string[]
): PythonOperationTemplate {
  if (request.operation === 'install') return result(['add', pythonSpec('uv', request), ...(request.dev ? ['--dev'] : [])], requirements, warnings)
  if (request.operation === 'remove') return result(['remove', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') {
    return result(['lock', ...(request.packageName ? ['--upgrade-package', request.packageName] : ['--upgrade'])], requirements, warnings)
  }
  if (request.operation === 'outdated') return result(['pip', 'list', '--outdated'], requirements, warnings)
  if (request.operation === 'audit') {
    return result(['pip', 'check'], requirements, [...warnings, 'uv pip check validates installed compatibility; use pip-audit or imported OSV evidence for vulnerability scanning.'])
  }
  if (request.operation === 'tree') return result(['tree'], requirements, warnings)
  if (request.operation === 'list') return result(['pip', 'list'], requirements, warnings)
  if (request.operation === 'lock') return result(['lock'], requirements, warnings)
  return result(['sync'], requirements, warnings)
}

function poetryOperation(
  request: ManagerOperationRequest,
  requirements: string[],
  warnings: string[]
): PythonOperationTemplate {
  if (request.operation === 'install') return result(['add', pythonSpec('poetry', request), ...(request.dev ? ['--group', 'dev'] : [])], requirements, warnings)
  if (request.operation === 'remove') return result(['remove', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') return result(['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
  if (request.operation === 'outdated') return result(['show', '--outdated'], requirements, warnings)
  if (request.operation === 'audit') {
    return result(['check'], requirements, [...warnings, 'poetry check validates project metadata; use poetry-plugin-audit, pip-audit, or imported OSV evidence for vulnerabilities.'])
  }
  if (request.operation === 'tree') return result(['show', '--tree'], requirements, warnings)
  if (request.operation === 'list') return result(['show'], requirements, warnings)
  if (request.operation === 'lock') return result(['lock'], requirements, warnings)
  return result(['install', '--sync'], requirements, warnings)
}

function pipenvOperation(
  request: ManagerOperationRequest,
  requirements: string[],
  warnings: string[]
): PythonOperationTemplate {
  if (request.operation === 'install') return result(['install', pythonSpec('pipenv', request), ...(request.dev ? ['--dev'] : [])], requirements, warnings)
  if (request.operation === 'remove') return result(['uninstall', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') return result(['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
  if (request.operation === 'outdated') return result(['update', '--outdated'], requirements, warnings)
  if (request.operation === 'audit') return result(['check'], requirements, warnings)
  if (request.operation === 'tree') return result(['graph'], requirements, warnings)
  if (request.operation === 'list') return result(['run', 'pip', 'list'], requirements, warnings)
  if (request.operation === 'lock') return result(['lock'], requirements, warnings)
  return result(['sync'], requirements, warnings)
}

async function condaOperation(
  cwd: string,
  request: ManagerOperationRequest,
  requirements: string[],
  warnings: string[]
): Promise<PythonOperationTemplate> {
  if (request.operation === 'install') return result(['install', '-y', pythonSpec('conda', request)], requirements, warnings)
  if (request.operation === 'remove') return result(['remove', '-y', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') return result(['update', '-y', ...(request.packageName ? [request.packageName] : ['--all'])], requirements, warnings)
  if (request.operation === 'outdated') return result(['update', '--all', '--dry-run'], requirements, warnings)
  if (request.operation === 'audit') {
    return result(['list'], requirements, [...warnings, 'Conda has no universal vulnerability audit command; import conda-audit, Grype, Trivy, or OSV evidence.'])
  }
  if (request.operation === 'tree' || request.operation === 'list') return result(['list'], requirements, warnings)
  if (request.operation === 'lock') {
    return result(['env', 'export'], requirements, [...warnings, 'This exports the resolved environment to stdout; install conda-lock to generate a multi-platform lock file.'])
  }
  const environmentFile = await selectEnvironmentFile(cwd, request, requirements)
  return result(['env', 'update', '--file', environmentFile, '--prune'], requirements, warnings)
}

async function selectEnvironmentFile(
  cwd: string,
  request: ManagerOperationRequest,
  requirements: string[]
): Promise<string> {
  const files = await findWorkspaceFiles(
    cwd,
    (name) => name === 'environment.yml' || name === 'environment.yaml',
    { maxDepth: 5 }
  )
  const selected = typeof request.options?.environmentFile === 'string'
    ? request.options.environmentFile.replace(/\\/g, '/')
    : undefined
  if (selected && files.includes(selected)) return selected
  const rootFile = files.find((file) => !file.includes('/'))
  if (rootFile) return rootFile
  if (files.length === 1) return files[0]
  if (selected) requirements.push(`Environment file was not found: ${selected}`)
  else if (files.length > 1) requirements.push('Multiple Conda environment files were found; select options.environmentFile.')
  else requirements.push('No environment.yml or environment.yaml file was found.')
  return selected || 'environment.yml'
}

function pythonSpec(
  managerId: PythonWorkspaceManagerId,
  request: ManagerOperationRequest
): string {
  const name = request.packageName?.trim() || ''
  const version = request.version?.trim()
  if (!version || version === '*' || version.toLowerCase() === 'latest') return name
  if (managerId === 'poetry') return `${name}@${version}`
  if (managerId === 'conda') return `${name}${/^[=<>!]/.test(version) ? version : `=${version}`}`
  return `${name}${/^(===|==|~=|!=|<=|>=|<|>|@)/.test(version) ? version : `==${version}`}`
}

function result(args: string[], requirements: string[], warnings: string[]): PythonOperationTemplate {
  return { args: args.filter(Boolean), requirements, warnings }
}
