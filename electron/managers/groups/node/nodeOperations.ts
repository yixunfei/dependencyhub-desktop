import { readFile } from 'fs/promises'
import { join } from 'path'
import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import type { NodeWorkspaceManagerId } from './nodeLockParsers'

export interface NodeOperationTemplate {
  args: string[]
  requirements: string[]
  warnings: string[]
}

type YarnDialect = 'classic' | 'modern'

export function isNodeWorkspaceManager(value: string): value is NodeWorkspaceManagerId {
  return value === 'pnpm' || value === 'yarn' || value === 'bun'
}

export async function createNodeOperationTemplate(
  cwd: string,
  managerId: NodeWorkspaceManagerId,
  request: ManagerOperationRequest
): Promise<NodeOperationTemplate> {
  const packageSpec = nodeDependencySpec(request.packageName, request.version)
  const requirements: string[] = []
  const warnings: string[] = []
  if ((request.operation === 'install' || request.operation === 'remove') && !request.packageName?.trim()) {
    requirements.push('Package name is required for this operation.')
  }

  if (managerId === 'pnpm') return pnpmOperation(request, packageSpec, requirements, warnings)
  if (managerId === 'bun') return bunOperation(request, packageSpec, requirements, warnings)
  return yarnOperation(await detectYarnDialect(cwd), request, packageSpec, requirements, warnings)
}

export function nodeDryRunTemplate(
  managerId: NodeWorkspaceManagerId,
  args: string[]
): string[] | null {
  if (managerId !== 'pnpm' || args.length === 0) return null
  if (!['add', 'remove', 'update', 'install'].includes(args[0])) return null
  return args.includes('--dry-run') ? [...args] : [...args, '--dry-run']
}

function pnpmOperation(
  request: ManagerOperationRequest,
  packageSpec: string,
  requirements: string[],
  warnings: string[]
): NodeOperationTemplate {
  if (request.operation === 'install') return result(['add', packageSpec, ...(request.dev ? ['-D'] : [])], requirements, warnings)
  if (request.operation === 'remove') return result(['remove', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') return result(['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
  if (request.operation === 'outdated') return result(['outdated'], requirements, warnings)
  if (request.operation === 'audit') return result(['audit'], requirements, warnings)
  if (request.operation === 'tree') return result(['list', '--depth', 'Infinity'], requirements, warnings)
  if (request.operation === 'list') return result(['list', '--depth', '0'], requirements, warnings)
  if (request.operation === 'lock') return result(['install', '--lockfile-only'], requirements, warnings)
  return result(['install'], requirements, warnings)
}

function bunOperation(
  request: ManagerOperationRequest,
  packageSpec: string,
  requirements: string[],
  warnings: string[]
): NodeOperationTemplate {
  if (request.operation === 'install') return result(['add', packageSpec, ...(request.dev ? ['-d'] : [])], requirements, warnings)
  if (request.operation === 'remove') return result(['remove', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') return result(['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
  if (request.operation === 'outdated') return result(['outdated'], requirements, warnings)
  if (request.operation === 'audit') {
    return result(['audit'], requirements, [...warnings, 'Bun audit requires a Bun release that provides the audit command.'])
  }
  if (request.operation === 'tree' || request.operation === 'list') return result(['pm', 'ls'], requirements, warnings)
  return result(['install'], requirements, warnings)
}

function yarnOperation(
  dialect: YarnDialect,
  request: ManagerOperationRequest,
  packageSpec: string,
  requirements: string[],
  warnings: string[]
): NodeOperationTemplate {
  if (request.operation === 'install') return result(['add', packageSpec, ...(request.dev ? ['-D'] : [])], requirements, warnings)
  if (request.operation === 'remove') return result(['remove', request.packageName || ''], requirements, warnings)
  if (request.operation === 'update') {
    return result([dialect === 'classic' ? 'upgrade' : 'up', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
  }
  if (request.operation === 'audit') return result(dialect === 'classic' ? ['audit'] : ['npm', 'audit'], requirements, warnings)
  if (request.operation === 'tree' || request.operation === 'list') {
    return result(dialect === 'classic' ? ['list'] : ['info', '--all', '--recursive'], requirements, warnings)
  }
  if (request.operation === 'lock') {
    return dialect === 'classic'
      ? result(['install', '--ignore-scripts'], requirements, [...warnings, 'Yarn Classic refreshes the lockfile through install.'])
      : result(['install', '--mode=update-lockfile'], requirements, warnings)
  }
  if (request.operation === 'outdated') {
    if (dialect === 'classic') return result(['outdated'], requirements, warnings)
    if (!request.packageName?.trim()) requirements.push('Package name is required for a non-interactive Yarn modern version check.')
    return result(['npm', 'info', request.packageName || '', '--fields', 'version'], requirements, warnings)
  }
  return result(['install'], requirements, warnings)
}

async function detectYarnDialect(cwd: string): Promise<YarnDialect> {
  const manifest = await readFile(join(cwd, 'package.json'), 'utf-8').catch(() => '')
  if (manifest) {
    try {
      const packageManager = String(JSON.parse(manifest)?.packageManager || '')
      const version = packageManager.match(/^yarn@(\d+)/i)?.[1]
      if (version) return Number(version) === 1 ? 'classic' : 'modern'
    } catch {
    }
  }
  if (await readFile(join(cwd, '.yarnrc.yml'), 'utf-8').catch(() => '')) return 'modern'
  const lock = await readFile(join(cwd, 'yarn.lock'), 'utf-8').catch(() => '')
  return /^__metadata:\s*$/m.test(lock) ? 'modern' : 'classic'
}

function nodeDependencySpec(packageName?: string, version?: string): string {
  const name = packageName?.trim() || ''
  const selectedVersion = version?.trim()
  if (!name || !selectedVersion || selectedVersion === '*' || selectedVersion.toLowerCase() === 'latest') return name
  return `${name}@${selectedVersion}`
}

function result(args: string[], requirements: string[], warnings: string[]): NodeOperationTemplate {
  return { args: args.filter(Boolean), requirements, warnings }
}
