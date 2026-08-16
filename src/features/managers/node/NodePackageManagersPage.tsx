import React from 'react'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['pnpm', 'yarn', 'bun'],
  defaultManagerId: 'pnpm',
  title: 'Modern Node Managers',
  subtitle: 'Dedicated workspace for pnpm, Yarn, and Bun with dependency inventory, command plans, dry-run hints, backups, and readiness risk signals.',
  noDetectionMessage: 'No pnpm/Yarn/Bun lockfile detected yet',
  detectionHint: 'The page still works as a planner. Add package.json plus pnpm-lock.yaml, yarn.lock, bun.lock, or bun.lockb for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Sync install' },
    { value: 'install', label: 'Add package' },
    { value: 'remove', label: 'Remove package' },
    { value: 'update', label: 'Update package' },
    { value: 'outdated', label: 'Check outdated' },
    { value: 'audit', label: 'Audit' },
    { value: 'tree', label: 'Dependency tree' },
    { value: 'lock', label: 'Refresh lockfile' }
  ],
  quickCommands: {
    pnpm: ['install', 'outdated', 'audit', 'list --depth 0'],
    yarn: ['install', '--version'],
    bun: ['install', 'outdated', 'pm ls', 'audit']
  },
  packagePlaceholder: 'react, vite, @scope/pkg',
  versionPlaceholder: 'latest, 1.2.3, ^2.0.0',
  commandPlaceholder: (managerId) => managerId === 'yarn'
    ? 'yarn install --immutable'
    : `${managerId} install --frozen-lockfile`,
  riskDescription: 'Review the dependency risk diff before running mutating package-manager commands or publishing this workspace.',
  restoreSuccessMessage: 'Node manager backup restored',
  overviewErrorMessage: 'Failed to load Node manager overview',
  detectedFileLimit: 2
}

const NodePackageManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default NodePackageManagersPage
