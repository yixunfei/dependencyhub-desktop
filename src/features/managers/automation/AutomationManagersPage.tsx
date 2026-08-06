import React from 'react'
import { DeploymentUnitOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['github-actions', 'gitlab-ci', 'pre-commit'],
  defaultManagerId: 'github-actions',
  title: 'Automation Dependency Managers',
  titleIcon: <DeploymentUnitOutlined />,
  subtitle: 'GitHub Actions, GitLab CI includes, and pre-commit hook dependencies for CI/release automation supply-chain visibility and readiness evidence.',
  noDetectionMessage: 'No workflow, pipeline, or pre-commit dependency files detected yet',
  detectionHint: 'Add .github/workflows/*.yml, .gitlab-ci.yml, or .pre-commit-config.yaml for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'List/check' },
    { value: 'install', label: 'Install hooks' },
    { value: 'remove', label: 'Remove/edit dependency' },
    { value: 'update', label: 'Update pins' },
    { value: 'outdated', label: 'Review outdated' },
    { value: 'audit', label: 'Lint/audit' },
    { value: 'tree', label: 'Dependency inventory' },
    { value: 'list', label: 'List dependencies' },
    { value: 'lock', label: 'Pin review' }
  ],
  quickCommands: {
    'github-actions': ['workflow list', 'workflow view', 'workflow run'],
    'gitlab-ci': ['ci lint', 'pipeline list'],
    'pre-commit': ['run --all-files', 'autoupdate', 'validate-config']
  },
  packagePlaceholder: 'actions/checkout, docker/build-push-action, community hook repo',
  versionPlaceholder: 'v4, v5.1.0, 8f3c1a2',
  commandPlaceholder: (managerId) => {
    if (managerId === 'gitlab-ci') return 'glab ci lint'
    if (managerId === 'pre-commit') return 'pre-commit run --all-files'
    return 'gh workflow list'
  },
  riskDescription: 'Review action pins, reusable workflow includes, hook revisions, token permissions, audit evidence, and CI release gates before changing automation dependencies.',
  restoreSuccessMessage: 'Automation manager backup restored',
  overviewErrorMessage: 'Failed to load automation manager overview',
  secondaryAction: { label: 'Open extended', route: '/extended' },
  maxMetricTools: 2
}

const AutomationManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default AutomationManagersPage
