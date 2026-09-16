import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import type { InfraManagerId } from './infraInventory'
export async function createInfraOperationTemplate(_cwd: string, managerId: InfraManagerId, request: ManagerOperationRequest) {
  const requirements: string[] = []; const warnings: string[] = []; const tool = managerId
  switch (request.operation) {
    case 'sync': return result(tool, ['init'], requirements, warnings, true)
    case 'install': return result(tool, ['init'], requirements, [...warnings, 'Terraform installs declared providers/modules during init; edit .tf files before adding dependencies.'], true)
    case 'update': return result(tool, ['init', '-upgrade'], requirements, warnings, true)
    case 'tree':
    case 'list': return result(tool, ['providers'], requirements, warnings, false)
    case 'lock': return result(tool, ['providers', 'lock'], requirements, warnings, true)
    case 'audit': return result(tool, ['validate'], requirements, [...warnings, 'Use tfsec, Checkov, Terrascan, or imported evidence for vulnerability and policy scanning.'], false)
    case 'outdated': return result(tool, ['providers'], requirements, [...warnings, 'Terraform does not provide a universal outdated command; review provider constraints and lock versions.'], false)
    case 'remove': requirements.push('Provider/module removal requires an explicit .tf manifest edit.'); return result(tool, ['providers'], requirements, warnings, false)
    default: return result(tool, ['validate'], requirements, warnings, false)
  }
}
function result(tool: string, args: string[], requirements: string[], warnings: string[], mutating: boolean) { return { tool, args, requirements, warnings, mutating, dryRunSupported: false } }
