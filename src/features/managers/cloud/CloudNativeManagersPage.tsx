import React from 'react'
import { CloudServerOutlined } from '@ant-design/icons'
import ExtendedManagerWorkspace, { type ExtendedManagerWorkspaceConfig } from '../extended/ExtendedManagerWorkspace'

const config: ExtendedManagerWorkspaceConfig = {
  managerIds: ['docker', 'helm', 'kustomize', 'helmfile', 'skaffold', 'argocd', 'flux'],
  defaultManagerId: 'docker',
  title: 'Cloud Native Dependencies',
  titleIcon: <CloudServerOutlined />,
  subtitle: 'Docker, Helm, Kustomize, Helmfile, Skaffold, Argo CD, and Flux workspace for deployment dependency inventory, configuration validation, vulnerability checks, backups, and release readiness signals.',
  noDetectionMessage: 'No cloud-native dependency files detected yet',
  detectionHint: 'The page can still generate plans. Add Dockerfile, compose YAML, Chart.yaml, kustomization.yaml, helmfile.yaml, skaffold.yaml, Argo CD Application YAML, or Flux manifests for stronger detection.',
  operationOptions: [
    { value: 'sync', label: 'Validate config' },
    { value: 'update', label: 'Update deps' },
    { value: 'audit', label: 'Audit/lint' },
    { value: 'tree', label: 'Dependency tree' },
    { value: 'list', label: 'List images/deps' },
    { value: 'lock', label: 'Build lock' }
  ],
  quickCommands: {
    docker: ['compose config', 'image ls', 'scout cves', 'build .'],
    helm: ['dependency list', 'dependency update', 'dependency build', 'lint .'],
    kustomize: ['build .', 'cfg tree .', 'edit set image app=image:tag'],
    helmfile: ['list', 'deps', 'diff', 'template'],
    skaffold: ['render', 'diagnose', 'build --dry-run'],
    argocd: ['app list', 'app diff app-name', 'app get app-name'],
    flux: ['check', 'get all', 'diff kustomization app']
  },
  packageLabel: 'Target',
  packagePlaceholder: 'chart, image, overlay, Git source, or app name',
  versionPlaceholder: '1.2.3, tag, digest, chart version, Git ref',
  commandPlaceholder: (managerId) => `${managerId} compose config`,
  typeColumnTitle: 'Type',
  dependencyEmptyDescription: 'No cloud-native deployment dependencies parsed for this manager',
  riskDescription: 'Review the dependency risk diff before changing chart dependencies, base images, overlays, GitOps sources, or deploy artifacts.',
  restoreSuccessMessage: 'Cloud manager backup restored',
  overviewErrorMessage: 'Failed to load cloud-native overview',
  secondaryAction: { label: 'Open health', route: '/health' },
  showDevOption: false
}

const CloudNativeManagersPage: React.FC = () => <ExtendedManagerWorkspace config={config} />

export default CloudNativeManagersPage
