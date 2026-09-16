import React from 'react'
import { MobileOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['deno', 'swiftpm', 'cocoapods'],
  defaultManagerId: 'deno',
  title: 'Platform Package Managers',
  titleIcon: <MobileOutlined />,
  subtitle: 'Deno, Swift Package Manager, and CocoaPods workspace for runtime imports, Apple platform packages, pod dependencies, lockfile hygiene, and readiness signals.',
  noDetectionMessage: 'No Deno/SwiftPM/CocoaPods files detected yet',
  detectionHint: 'The page can still generate plans. Add deno.json, deno.lock, Package.swift, Package.resolved, Podfile, or Podfile.lock for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Resolve/cache' },
    { value: 'install', label: 'Add package declaration' },
    { value: 'remove', label: 'Remove package declaration' },
    { value: 'update', label: 'Update package' },
    { value: 'outdated', label: 'Review dependency pins' },
    { value: 'tree', label: 'Dependency tree' },
    { value: 'list', label: 'List packages' },
    { value: 'lock', label: 'Refresh lock' }
  ],
  quickCommands: {
    deno: ['info', 'cache --reload', 'task', 'lint'],
    swiftpm: ['package show-dependencies', 'package update', 'package resolve'],
    cocoapods: ['install', 'outdated', 'list', 'repo update']
  },
  packagePlaceholder: 'npm:@std/assert, Alamofire, AFNetworking',
  versionPlaceholder: '1.2.3, from: 5.8.0, ~> 4.0',
  commandPlaceholder: (managerId) => `${managerId} info`,
  riskDescription: 'Review the dependency risk diff before changing platform runtime imports, Swift packages, or pod dependencies.',
  restoreSuccessMessage: 'Platform manager backup restored',
  overviewErrorMessage: 'Failed to load platform manager overview',
  secondaryAction: { label: 'Open extended', route: '/extended' }
}

const PlatformManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default PlatformManagersPage
