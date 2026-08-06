import React from 'react'
import { ToolOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['bazel', 'pants', 'buck'],
  defaultManagerId: 'bazel',
  title: 'Build System Dependency Managers',
  titleIcon: <ToolOutlined />,
  subtitle: 'Bazel modules, Pants resolves/plugins, and Buck external artifacts for hermetic build dependency inventory, lock review, and release evidence.',
  noDetectionMessage: 'No Bazel, Pants, or Buck build dependency files detected yet',
  detectionHint: 'Add MODULE.bazel, WORKSPACE, pants.toml, .buckconfig, or BUCK.v2 for build-system dependency governance.',
  operationOptions: [
    { value: 'sync', label: 'Sync/check' },
    { value: 'install', label: 'Add/edit dependency' },
    { value: 'remove', label: 'Remove/edit dependency' },
    { value: 'update', label: 'Update locks' },
    { value: 'outdated', label: 'Review outdated' },
    { value: 'audit', label: 'Audit/lint' },
    { value: 'tree', label: 'Dependency graph' },
    { value: 'list', label: 'List dependencies' },
    { value: 'lock', label: 'Refresh locks' }
  ],
  quickCommands: {
    bazel: ['mod graph', 'mod tidy', 'query //...'],
    pants: ['dependencies ::', 'generate-lockfiles', 'lint ::'],
    buck: ['query //...', 'audit dependencies //...', 'targets //...']
  },
  packagePlaceholder: 'rules_jvm_external, pants plugin, com.google.guava:guava',
  versionPlaceholder: '6.3, 2.22.0, 33.0.0-jre',
  commandPlaceholder: (managerId) => {
    if (managerId === 'pants') return 'pants dependencies ::'
    if (managerId === 'buck') return 'buck2 query //...'
    return 'bazel mod graph'
  },
  typeColumnTitle: 'Declaration',
  riskDescription: 'Review build rulesets, external repositories, generated lockfiles, remote execution settings, cache trust, and release evidence before changing build-system dependencies.',
  restoreSuccessMessage: 'Build-system manager backup restored',
  overviewErrorMessage: 'Failed to load build-system manager overview',
  secondaryAction: { label: 'Open extended', route: '/extended' },
  showDevOption: false,
  maxMetricTools: 1
}

const BuildSystemsManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default BuildSystemsManagersPage
