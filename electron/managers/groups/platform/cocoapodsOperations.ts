import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'
export async function createCocoaPodsOperationTemplate(request: ManagerOperationRequest) {
  const requirements: string[] = []; const warnings: string[] = []
  if (['install', 'remove'].includes(request.operation)) requirements.push('CocoaPods manifest edits require reviewing Podfile changes before running pod install.')
  switch (request.operation) {
    case 'sync': return result(['install'], requirements, warnings, true)
    case 'install': return result(['install'], requirements, warnings, true)
    case 'remove': return result(['install'], requirements, warnings, true)
    case 'update': return result(['update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings, true)
    case 'outdated': return result(['outdated'], requirements, warnings, false)
    case 'audit': return result(['check'], requirements, [...warnings, 'Use pod outdated and external vulnerability evidence for security review.'], false)
    case 'tree':
    case 'list': return result(['list'], requirements, warnings, false)
    case 'lock': return result(['install'], requirements, warnings, true)
    default: return result(['list'], requirements, warnings, false)
  }
}
function result(args: string[], requirements: string[], warnings: string[], mutating: boolean) { return { tool: 'pod', args, requirements, warnings, mutating, dryRunSupported: false } }
