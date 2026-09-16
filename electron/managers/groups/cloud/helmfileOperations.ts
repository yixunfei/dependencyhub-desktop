import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
export async function createHelmfileOperationTemplate(_cwd: string, request: ManagerOperationRequest) {
  const requirements: string[] = []; const warnings: string[] = []
  switch (request.operation) {
    case 'sync': return result(['sync'], requirements, [...warnings, 'helmfile sync changes cluster state; review diff first.'], true)
    case 'install': return result(['apply'], requirements, [...warnings, 'helmfile apply changes cluster state; review diff first.'], true)
    case 'remove': requirements.push('Helmfile release removal requires an explicit manifest edit.'); return result(['list'], requirements, warnings, false)
    case 'update': return result(['deps'], requirements, warnings, true)
    case 'outdated': return result(['list'], requirements, [...warnings, 'Helmfile has no universal outdated command; review chart versions.'], false)
    case 'audit': return result(['lint'], requirements, warnings, false)
    case 'tree':
    case 'list': return result(['list'], requirements, warnings, false)
    case 'lock': return result(['deps'], requirements, warnings, true)
    default: return result(['template'], requirements, warnings, false)
  }
}
function result(args: string[], requirements: string[], warnings: string[], mutating: boolean) { return { tool: 'helmfile', args, requirements, warnings, mutating, dryRunSupported: args[0] === 'diff' } }
