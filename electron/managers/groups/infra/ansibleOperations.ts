import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
export async function createAnsibleOperationTemplate(request: ManagerOperationRequest) {
  const requirements: string[] = []; const warnings: string[] = []
  const file = 'requirements.yml'
  switch (request.operation) {
    case 'sync':
    case 'install': return result(['collection', 'install', '-r', file], requirements, warnings, true)
    case 'update': return result(['collection', 'install', '-r', file, '--upgrade'], requirements, warnings, true)
    case 'tree':
    case 'list':
    case 'outdated': return result(['collection', 'list'], requirements, warnings, false)
    case 'audit': return result(['collection', 'list'], requirements, ['Use ansible-lint and imported SARIF/OSV evidence for policy scans.'], false)
    case 'lock': requirements.push('Ansible Galaxy has no standard lockfile; review requirements files and installation evidence.'); return result(['collection', 'list'], requirements, warnings, false)
    default: requirements.push('Role/collection manifest editing requires explicit review.'); return result(['collection', 'list'], requirements, warnings, false)
  }
}
function result(args: string[], requirements: string[], warnings: string[], mutating: boolean) { return { tool: 'ansible-galaxy', args, requirements, warnings, mutating, dryRunSupported: false } }
