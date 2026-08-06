import React from 'react'
import { CodeOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['nuget', 'composer', 'bundler'],
  defaultManagerId: 'nuget',
  title: 'Backend Package Managers',
  titleIcon: <CodeOutlined />,
  subtitle: 'NuGet, Composer, and Bundler workspace for backend dependencies, lockfile hygiene, vulnerability checks, package restore, backups, and release readiness signals.',
  noDetectionMessage: 'No NuGet/Composer/Bundler files detected yet',
  detectionHint: 'The page can still generate plans. Add a .csproj, Directory.Packages.props, composer.json, Gemfile, or gemspec for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Restore/install' },
    { value: 'install', label: 'Add package' },
    { value: 'remove', label: 'Remove package' },
    { value: 'update', label: 'Update package' },
    { value: 'outdated', label: 'Check outdated' },
    { value: 'audit', label: 'Audit/vulnerable' },
    { value: 'tree', label: 'Dependency tree' },
    { value: 'list', label: 'List packages' },
    { value: 'lock', label: 'Refresh lock' }
  ],
  quickCommands: {
    nuget: ['restore', 'list package', 'list package --outdated', 'list package --vulnerable'],
    composer: ['install', 'outdated', 'audit', 'show -t'],
    bundler: ['install', 'outdated', 'list', 'audit']
  },
  packagePlaceholder: 'Newtonsoft.Json, monolog/monolog, rack',
  versionPlaceholder: '13.0.3, ^3.0, >=2.0',
  commandPlaceholder: (managerId) => `${managerId} restore`,
  riskDescription: 'Review the dependency risk diff before running mutating backend package-manager commands or publishing packages from this workspace.',
  restoreSuccessMessage: 'Backend manager backup restored',
  overviewErrorMessage: 'Failed to load backend manager overview',
  secondaryAction: { label: 'Open extended', route: '/extended' },
  maxMetricTools: 2
}

const BackendPackageManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default BackendPackageManagersPage
