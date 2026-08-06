import React from 'react'
import { PythonOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['uv', 'poetry', 'pipenv', 'conda'],
  defaultManagerId: 'uv',
  title: 'Python Environment Managers',
  titleIcon: <PythonOutlined />,
  subtitle: 'uv, Poetry, Pipenv, and Conda workspaces with environment inventory, lockfile operations, command plans, backups, and readiness signals.',
  noDetectionMessage: 'No uv/Poetry/Pipenv/Conda files detected yet',
  detectionHint: 'The page can still generate plans. Add pyproject.toml, uv.lock, poetry.lock, Pipfile, or environment.yml for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Sync environment' },
    { value: 'install', label: 'Add package' },
    { value: 'remove', label: 'Remove package' },
    { value: 'update', label: 'Update package' },
    { value: 'outdated', label: 'Check outdated' },
    { value: 'audit', label: 'Audit/check' },
    { value: 'tree', label: 'Dependency graph' },
    { value: 'list', label: 'List packages' },
    { value: 'lock', label: 'Refresh lock' }
  ],
  quickCommands: {
    uv: ['sync', 'tree', 'pip list --outdated', 'lock'],
    poetry: ['install', 'show --tree', 'show --outdated', 'check'],
    pipenv: ['sync', 'graph', 'update --outdated', 'check'],
    conda: ['env update -f environment.yml', 'list', 'env export', 'update -y --all']
  },
  packagePlaceholder: 'fastapi, pytest, numpy',
  versionPlaceholder: 'latest, 1.2.3, >=2.0',
  commandPlaceholder: (managerId) => `${managerId} sync`,
  riskDescription: 'Review the dependency risk diff before running mutating environment commands or publishing packages from this workspace.',
  restoreSuccessMessage: 'Python manager backup restored',
  overviewErrorMessage: 'Failed to load Python manager overview',
  secondaryAction: { label: 'Open pip', route: '/pip' }
}

const PythonEnvironmentManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default PythonEnvironmentManagersPage
