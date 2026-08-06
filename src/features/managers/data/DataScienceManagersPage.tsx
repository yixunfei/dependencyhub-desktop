import React from 'react'
import { ExperimentOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['renv', 'julia'],
  defaultManagerId: 'renv',
  title: 'Data Package Managers',
  titleIcon: <ExperimentOutlined />,
  subtitle: 'R/renv and Julia Pkg workspace for reproducible research environments, lockfile hygiene, toolchains, backups, and release readiness signals.',
  noDetectionMessage: 'No R/renv or Julia Pkg files detected yet',
  detectionHint: 'Add renv.lock, DESCRIPTION, Project.toml, or Manifest.toml for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Restore/instantiate' },
    { value: 'install', label: 'Add package' },
    { value: 'remove', label: 'Remove package' },
    { value: 'update', label: 'Update dependencies' },
    { value: 'outdated', label: 'Check outdated/status' },
    { value: 'audit', label: 'Audit/check' },
    { value: 'tree', label: 'Dependency status' },
    { value: 'list', label: 'List dependencies' },
    { value: 'lock', label: 'Snapshot/resolve lock' }
  ],
  quickCommands: {
    renv: ['-e renv::status()', '-e renv::restore()', '-e renv::snapshot()'],
    julia: ['--project=. -e "using Pkg; Pkg.status()"', '--project=. -e "using Pkg; Pkg.instantiate()"', '--project=. -e "using Pkg; Pkg.resolve()"']
  },
  packagePlaceholder: 'dplyr, ggplot2, DataFrames, CSV',
  versionPlaceholder: '>= 1.1.0, 1.6.1',
  commandPlaceholder: (managerId) => managerId === 'julia' ? 'julia --project=. -e "using Pkg; Pkg.status()"' : 'Rscript -e renv::status()',
  riskDescription: 'Review dependency risk, lockfile drift, runtime pinning, and audit evidence before restoring or updating research and data-science environments.',
  restoreSuccessMessage: 'Data manager backup restored',
  overviewErrorMessage: 'Failed to load data manager overview',
  secondaryAction: { label: 'Open extended', route: '/extended' },
  maxMetricTools: 2
}

const DataScienceManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default DataScienceManagersPage
