import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
export async function createDenoOperationTemplate(request: ManagerOperationRequest) {
  const requirements: string[] = []; const warnings: string[] = []
  const packageName = request.packageName?.trim()
  switch (request.operation) {
    case 'sync': return result(['cache', '--reload'], requirements, warnings, true)
    case 'install':
      if (!packageName) requirements.push('Import specifier is required for Deno install.')
      return result(['add', packageName || ''], requirements, warnings, true)
    case 'remove':
      if (!packageName) requirements.push('Import specifier is required for Deno remove.')
      return result(['remove', packageName || ''], requirements, warnings, true)
    case 'update': return result(['cache', '--reload'], requirements, warnings, true)
    case 'outdated': return result(['outdated'], requirements, warnings, false)
    case 'audit': return result(['lint'], requirements, [...warnings, 'Use deno audit or imported OSV/SARIF evidence for vulnerability review.'], false)
    case 'tree':
    case 'list': return result(['info'], requirements, warnings, false)
    case 'lock': return result(['cache', '--lock=deno.lock', '--lock-write'], requirements, warnings, true)
    default: return result(['info'], requirements, warnings, false)
  }
}
function result(args: string[], requirements: string[], warnings: string[], mutating: boolean) { return { tool: 'deno', args, requirements, warnings, mutating, dryRunSupported: false } }
