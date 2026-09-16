import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import type { CloudWorkspaceManagerId } from './cloudTypes'

export interface CloudOperationTemplate { args: string[]; requirements: string[]; warnings: string[] }

export async function createCloudOperationTemplate(
  _cwd: string,
  managerId: CloudWorkspaceManagerId,
  request: ManagerOperationRequest
): Promise<CloudOperationTemplate> {
  if (managerId !== 'helm') throw new Error(`Unsupported cloud manager: ${managerId}`)
  const requirements: string[] = []
  const warnings: string[] = []
  if ((request.operation === 'install' || request.operation === 'remove') && !request.packageName?.trim()) {
    requirements.push('Chart name is required for this operation.')
  }
  switch (request.operation) {
    case 'sync': return result(['dependency', 'update'], requirements, warnings)
    case 'install': return result(['dependency', 'update'], requirements, [...warnings, 'Helm resolves declared Chart.yaml dependencies; add the dependency to Chart.yaml before syncing.'])
    case 'remove': return result(['dependency', 'update'], requirements, [...warnings, 'Helm does not remove Chart.yaml declarations through the CLI; remove the declaration, then refresh dependencies.'])
    case 'update': return result(['dependency', 'update', ...(request.packageName ? ['--skip-refresh'] : [])], requirements, warnings)
    case 'outdated': return result(['dependency', 'list'], requirements, warnings)
    case 'audit': return result(['lint', '.'], requirements, warnings)
    case 'tree':
    case 'list': return result(['dependency', 'list'], requirements, warnings)
    case 'lock': return result(['dependency', 'build'], requirements, warnings)
    default: return result(['dependency', 'list'], requirements, warnings)
  }
}

export function cloudDryRunTemplate(args: string[]): string[] | null {
  return args[0] === 'lint' ? [...args] : null
}

function result(args: string[], requirements: string[], warnings: string[]): CloudOperationTemplate {
  return { args, requirements, warnings }
}
