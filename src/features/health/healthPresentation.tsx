import { Space, Tag, Tooltip } from 'antd'
import React from 'react'
import { WorkflowSectionHeader } from './components'
import type { HealthWorkflowSectionId } from './workflows'


export const REPORT_ARTIFACT_CATEGORY_OPTIONS: Array<{ value: 'all' | ReportArtifactCategory; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'release', label: 'Release' },
  { value: 'risk', label: 'Risk' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'automation', label: 'Automation' },
  { value: 'policy', label: 'Policy' },
  { value: 'security', label: 'Security' },
  { value: 'reproducibility', label: 'Reproducibility' },
  { value: 'operations', label: 'Operations' },
  { value: 'other', label: 'Other' }
]

export const REPORT_ARTIFACT_FORMAT_OPTIONS: Array<{ value: 'all' | ReportArtifactFormat; label: string }> = [
  { value: 'all', label: 'All formats' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'text', label: 'Text' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'codeowners', label: 'CODEOWNERS' },
  { value: 'sbom', label: 'SBOM' },
  { value: 'unknown', label: 'Unknown' }
]

export function snapshotSourceLabel(source: SupplyChainSnapshotSource | undefined): string {
  if (source === 'mutation') return '变更'
  if (source === 'restore') return '恢复'
  return '手动'
}

export function readinessStatusLabel(status: ReadinessGateStatus): string {
  if (status === 'ready') return 'Ready'
  if (status === 'blocked') return 'Blocked'
  return 'Warning'
}

export function readinessStatusColor(status: ReadinessGateStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

export function releaseRiskStatusColor(status: ReleaseRiskProfileStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

export function offlineCacheStatusColor(status: OfflineCacheReadinessStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

export function releaseRiskSeverityColor(severity: ReleaseRiskSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  return 'default'
}

export function ciWarningColor(severity: CiIntegrationWarningSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

export function automationWarningColor(severity: DependencyAutomationWarningSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

export function credentialRotationSeverityColor(severity: CredentialRotationSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

export function automationDecisionColor(decision: AutomationSafetyDecision): string {
  if (decision === 'auto-merge') return 'green'
  if (decision === 'blocked') return 'red'
  return 'orange'
}

export function automationSafetySeverityColor(severity: AutomationSafetyFindingSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

export function dependencyOwnershipSeverityColor(severity: DependencyOwnershipFindingSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

export function upgradePriorityColor(priority: DependencyUpgradeLanePriority): string {
  if (priority === 'immediate') return 'red'
  if (priority === 'urgent') return 'orange'
  if (priority === 'scheduled') return 'blue'
  return 'default'
}

export function rollbackPriorityColor(priority: DependencyRollbackPlanPriority): string {
  if (priority === 'required') return 'red'
  if (priority === 'recommended') return 'orange'
  return 'blue'
}

export function dependencyImpactSeverityColor(severity: DependencyImpactSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  return 'default'
}

export function approvalCheckStatusColor(status: DependencyChangeApprovalCheckStatus): string {
  if (status === 'passed') return 'green'
  if (status === 'blocked') return 'red'
  if (status === 'warning') return 'orange'
  return 'blue'
}

export function changeWindowStatusColor(status: DependencyChangeWindowStatus): string {
  if (status === 'scheduled') return 'green'
  if (status === 'blocked' || status === 'frozen') return 'red'
  return 'orange'
}

export function freezeReasonColor(reason: DependencyChangeFreezeReason): string {
  if (reason === 'approval-blocked' || reason === 'trust-policy-blocked' || reason === 'rollback-blocked') return 'red'
  if (reason === 'missing-owner' || reason === 'active-exception' || reason === 'critical-impact') return 'orange'
  return 'blue'
}

export function executionRecordStatusColor(status: DependencyChangeExecutionRecordStatus): string {
  if (status === 'completed') return 'green'
  if (status === 'failed' || status === 'blocked') return 'red'
  if (status === 'pending' || status === 'unscheduled') return 'orange'
  return 'default'
}

export function executionVerificationStatusColor(status: DependencyChangeExecutionVerificationStatus): string {
  if (status === 'passed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'missing') return 'orange'
  return 'blue'
}

export function policyAsCodeSeverityColor(severity: PolicyAsCodeFindingSeverity): string {
  if (severity === 'blocked') return 'red'
  if (severity === 'warning') return 'orange'
  return 'blue'
}

export function reportArtifactCategoryColor(category: ReportArtifactCategory): string {
  if (category === 'release') return 'purple'
  if (category === 'risk' || category === 'security') return 'red'
  if (category === 'policy') return 'orange'
  if (category === 'workspace') return 'cyan'
  if (category === 'automation') return 'geekblue'
  if (category === 'reproducibility') return 'blue'
  if (category === 'inventory') return 'green'
  if (category === 'evidence') return 'gold'
  if (category === 'operations') return 'volcano'
  return 'default'
}

export function reportArtifactFormatColor(format: ReportArtifactFormat): string {
  if (format === 'html') return 'purple'
  if (format === 'json' || format === 'sbom') return 'blue'
  if (format === 'markdown') return 'green'
  if (format === 'yaml') return 'geekblue'
  if (format === 'calendar') return 'cyan'
  if (format === 'codeowners') return 'orange'
  return 'default'
}

export function formatArtifactBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function readinessCheckColor(status: ReadinessGateCheckStatus): string {
  if (status === 'passed') return 'green'
  if (status === 'blocked') return 'red'
  if (status === 'warning') return 'orange'
  return 'blue'
}

export function readinessSeverityColor(severity: ReadinessGateSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  return 'default'
}

export function ciEvidenceStatusColor(status: CiEvidenceStatus): string {
  if (status === 'success') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'cancelled') return 'orange'
  return 'default'
}

export function auditEvidenceSeverityColor(severity: AuditEvidenceSeverity): string {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'orange'
  if (severity === 'low') return 'blue'
  if (severity === 'info') return 'green'
  return 'default'
}

export function vulnerabilityRemediationPriorityColor(priority: VulnerabilityRemediationPriority): string {
  if (priority === 'immediate') return 'red'
  if (priority === 'urgent') return 'orange'
  if (priority === 'scheduled') return 'blue'
  return 'default'
}

export function releaseApprovalColor(decision: ReleaseApprovalDecision): string {
  if (decision === 'approved') return 'green'
  if (decision === 'rejected') return 'red'
  return 'orange'
}

export function registryStatusColor(status: RegistryReachabilityStatus | 'not checked'): string {
  if (status === 'reachable') return 'green'
  if (status === 'unreachable') return 'red'
  if (status === 'unknown') return 'orange'
  return 'default'
}

export function licenseComplianceStatusColor(status: LicenseComplianceStatus): string {
  if (status === 'blocked') return 'red'
  if (status === 'not-allowed' || status === 'unknown') return 'orange'
  if (status === 'allowed') return 'green'
  return 'default'
}

export function workspaceGovernanceStatusColor(status: WorkspaceGovernanceStatus): string {
  if (status === 'ready') return 'green'
  if (status === 'blocked') return 'red'
  return 'orange'
}

export function workspacePolicySourceColor(source: WorkspacePolicySource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

export function workspaceReadinessPolicySourceColor(source: WorkspaceReadinessPolicySource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

export function workspaceSnapshotSourceColor(source: WorkspaceSnapshotSource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

export function workspaceCiEvidenceSourceColor(source: WorkspaceCiEvidenceSource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

export function workspaceReleaseApprovalSourceColor(source: WorkspaceReleaseApprovalSource): string {
  if (source === 'workspace') return 'green'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

export function workspaceReleaseExceptionSourceColor(source: WorkspaceReleaseExceptionSource): string {
  if (source === 'workspace') return 'orange'
  if (source === 'inherited-root') return 'blue'
  return 'default'
}

export function dependencyRiskColor(risk: DependencyRiskLevel): string {
  if (risk === 'critical' || risk === 'high') return 'red'
  if (risk === 'medium') return 'orange'
  if (risk === 'low') return 'blue'
  return 'default'
}

export function dependencyChangeColor(kind: DependencyChangeKind): string {
  if (kind === 'added') return 'green'
  if (kind === 'removed') return 'red'
  if (kind === 'updated') return 'orange'
  return 'default'
}

export function snapshotSourceColor(source: SupplyChainSnapshotSource | undefined): string {
  if (source === 'mutation') return 'orange'
  if (source === 'restore') return 'purple'
  return 'blue'
}

export function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '-'
  if (durationMs < 1000) return `${durationMs} ms`
  return `${(durationMs / 1000).toFixed(1)} s`
}

export function operationKindLabel(kind: OperationHistoryOperationKind | undefined): string {
  const labels: Record<OperationHistoryOperationKind, string> = {
    install: '安装',
    uninstall: '移除',
    update: '更新',
    sync: '同步',
    audit: '审计',
    tree: '依赖树',
    list: '列表',
    search: '搜索',
    outdated: '过期检查',
    publish: '发布',
    config: '配置',
    cache: '缓存',
    build: '构建',
    test: '测试',
    run: '运行',
    clean: '清理',
    lock: '锁定',
    login: '凭据',
    toolchain: '工具链',
    restore: '恢复',
    info: '信息',
    unknown: '未知'
  }
  return labels[kind || 'unknown']
}

export function operationKindColor(kind: OperationHistoryOperationKind | undefined): string {
  if (kind === 'publish' || kind === 'login') return 'red'
  if (kind === 'install' || kind === 'uninstall' || kind === 'update' || kind === 'sync' || kind === 'lock') return 'orange'
  if (kind === 'audit' || kind === 'tree' || kind === 'outdated') return 'blue'
  if (kind === 'build' || kind === 'run' || kind === 'clean') return 'purple'
  return 'default'
}

export function renderScanStatus(scan: DependencyHealthScanResult | { error: string } | undefined) {
  if (!scan) return <Tag>未扫描</Tag>
  if ('error' in scan) return <Tooltip title={scan.error}><Tag color="red">扫描失败</Tag></Tooltip>

  const total = scan.summary.total
  if (total === 0) return <Tag color="green">无问题</Tag>

  return (
    <Space size={4} wrap>
      <Tag color="red">高危 {scan.summary.critical + scan.summary.high}</Tag>
      <Tag color="orange">中 {scan.summary.medium}</Tag>
      <Tag>总计 {total}</Tag>
    </Space>
  )
}

export const renderWorkflowSection = (id: HealthWorkflowSectionId, icon: React.ReactNode, title: string, meta: React.ReactNode) => (
  <WorkflowSectionHeader id={id} icon={icon} title={title} meta={meta} />
)
