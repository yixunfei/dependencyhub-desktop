import React from 'react'
import { CloudServerOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['terraform', 'opentofu', 'ansible'],
  defaultManagerId: 'terraform',
  title: 'Infrastructure Dependency Managers',
  titleIcon: <CloudServerOutlined />,
  subtitle: 'Terraform, OpenTofu, and Ansible Galaxy workspace for provider, module, collection, and role dependencies with lockfile hygiene and release readiness signals.',
  noDetectionMessage: 'No Terraform/OpenTofu or Ansible dependency files detected yet',
  detectionHint: 'Add .tf files, .terraform.lock.hcl, requirements.yml, collections/requirements.yml, roles/requirements.yml, or ansible.cfg for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Init/install' },
    { value: 'install', label: 'Install dependencies' },
    { value: 'remove', label: 'Remove/edit dependency' },
    { value: 'update', label: 'Upgrade dependencies' },
    { value: 'outdated', label: 'Review outdated' },
    { value: 'audit', label: 'Validate/audit' },
    { value: 'tree', label: 'Dependency tree' },
    { value: 'list', label: 'List dependencies' },
    { value: 'lock', label: 'Lock providers' }
  ],
  quickCommands: {
    terraform: ['init', 'init -upgrade', 'providers', 'validate'],
    opentofu: ['init', 'init -upgrade', 'providers', 'validate'],
    ansible: ['collection install -r requirements.yml', 'collection list', 'collection install -r requirements.yml --upgrade']
  },
  packagePlaceholder: 'hashicorp/aws, terraform-aws-modules/vpc/aws, community.general',
  versionPlaceholder: '~> 5.0, 5.8.1, 8.6.0',
  commandPlaceholder: (managerId) => {
    if (managerId === 'opentofu') return 'tofu init'
    if (managerId === 'ansible') return 'ansible-galaxy collection list'
    return 'terraform init'
  },
  riskDescription: 'Review dependency risk, provider locks, IaC scanner evidence, registry reachability, and approval gates before changing infrastructure dependencies.',
  restoreSuccessMessage: 'Infrastructure manager backup restored',
  overviewErrorMessage: 'Failed to load infrastructure manager overview',
  secondaryAction: { label: 'Open extended', route: '/extended' },
  maxMetricTools: 2
}

const InfrastructureManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default InfrastructureManagersPage
