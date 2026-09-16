import type { ManagerOperationRequest } from '../../../../shared/managerWorkspace'

export interface SwiftPMOperationTemplate { args: string[]; requirements: string[]; warnings: string[] }

export async function createSwiftPMOperationTemplate(_cwd: string, request: ManagerOperationRequest): Promise<SwiftPMOperationTemplate> {
  const requirements: string[] = []
  const warnings: string[] = []
  if ((request.operation === 'install' || request.operation === 'remove') && !request.packageName?.trim()) requirements.push('Package name is required for this operation.')
  switch (request.operation) {
    case 'sync': return result(['package', 'resolve'], requirements, warnings)
    case 'install': return result(['package', 'resolve'], requirements, [...warnings, 'SwiftPM add requires editing Package.swift; resolve refreshes Package.resolved after the manifest change.'])
    case 'remove': return result(['package', 'resolve'], requirements, [...warnings, 'SwiftPM remove requires editing Package.swift; resolve refreshes Package.resolved after the manifest change.'])
    case 'update': return result(['package', 'update', ...(request.packageName ? [request.packageName] : [])], requirements, warnings)
    case 'outdated': return result(['package', 'show-dependencies'], requirements, [...warnings, 'SwiftPM has no universal outdated command; review package constraints and resolved pins.'])
    case 'audit': return result(['package', 'show-dependencies'], requirements, [...warnings, 'SwiftPM has no built-in vulnerability audit; use an external scanner or imported evidence.'])
    case 'tree':
    case 'list': return result(['package', 'show-dependencies'], requirements, warnings)
    case 'lock': return result(['package', 'resolve'], requirements, warnings)
    default: return result(['package', 'show-dependencies'], requirements, warnings)
  }
}

function result(args: string[], requirements: string[], warnings: string[]): SwiftPMOperationTemplate { return { args, requirements, warnings } }
