import React, { useEffect, useState } from 'react'
import { Alert, Divider, Form, InputNumber, Modal, Space, Switch, Typography } from 'antd'

const { Text } = Typography

interface ReadinessPolicyEditorProps {
  open: boolean
  projectPath?: string
  onClose: () => void
  onSaved?: (result: ReadinessPolicyFile) => void
}

type ReadinessPolicyFormValues = Partial<ReadinessPolicy>

const DEFAULT_FORM_VALUES: ReadinessPolicy = {
  recentOperationDays: 14,
  snapshotStaleDays: 7,
  blockOnMissingSnapshots: false,
  blockOnStaleSnapshots: false,
  blockOnMissingTools: true,
  blockOnFailedMutatingOperations: false,
  maxHighRiskDependencyChanges: 0,
  maxMediumRiskDependencyChanges: 0,
  maxHighSeverityPolicyViolations: 0,
  maxPolicyWarnings: 0,
  maxPolicyViolations: 1000,
  maxRecentFailedPublishOperations: 0,
  maxRecentFailedMutatingOperations: 0,
  ciEvidenceMaxAgeDays: 7,
  blockOnMissingCiEvidence: false,
  blockOnStaleCiEvidence: false,
  blockOnFailedCiEvidence: true,
  auditEvidenceMaxAgeDays: 7,
  blockOnMissingAuditEvidence: false,
  blockOnStaleAuditEvidence: false,
  maxCriticalAuditFindings: 0,
  maxHighAuditFindings: 0,
  maxMediumAuditFindings: 0,
  blockOnCriticalAuditFindings: false,
  blockOnHighAuditFindings: false,
  requiredReleaseApprovals: 0,
  releaseApprovalMaxAgeDays: 14,
  blockOnMissingReleaseApprovals: false,
  blockOnRejectedReleaseApproval: true,
  registryReachabilityTimeoutMs: 3000,
  blockOnMissingRegistryEndpoints: false,
  blockOnUnreachableRegistries: true,
  blockOnInsecureRegistries: false,
  maxUnreachableRegistries: 0,
  maxLockfileDriftWarnings: 0,
  blockOnLockfileDrift: false,
  maxRuntimePinningWarnings: 0,
  blockOnRuntimePinning: false,
  blockOnFloatingContainerTags: false,
  maxFloatingDeploymentRefs: 0,
  blockOnFloatingDeploymentRefs: false,
  maxMissingDeploymentBaselines: 0,
  blockOnMissingDeploymentBaselines: false,
  maxMissingCredentialEndpoints: 0,
  blockOnMissingCredentialEndpoints: false,
  blockOnInsecureCredentialUsage: false,
  maxWeakCredentialMatches: 0,
  blockOnWeakCredentialMatches: false,
  maxUnusedCredentials: 1000,
  blockOnUnusedCredentials: false,
  minimumScore: 0,
  blockBelowMinimumScore: false
}

const ReadinessPolicyEditor: React.FC<ReadinessPolicyEditorProps> = ({
  open,
  projectPath,
  onClose,
  onSaved
}) => {
  const [form] = Form.useForm<ReadinessPolicyFormValues>()
  const [policyPath, setPolicyPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    form.setFieldsValue(DEFAULT_FORM_VALUES)
    setError('')
    if (projectPath) {
      void loadPolicy(projectPath)
    }
  }, [form, open, projectPath])

  const loadPolicy = async (path: string) => {
    setLoading(true)
    try {
      const result = await window.electronAPI.readiness.getPolicy(path)
      setPolicyPath(result.path)
      form.setFieldsValue({
        ...DEFAULT_FORM_VALUES,
        ...result.policy
      })
    } catch (error: any) {
      setError(error?.message || String(error))
    } finally {
      setLoading(false)
    }
  }

  const savePolicy = async () => {
    if (!projectPath) return
    const values = await form.validateFields()
    const policy: ReadinessPolicy = {
      recentOperationDays: integerValue(values.recentOperationDays, DEFAULT_FORM_VALUES.recentOperationDays),
      snapshotStaleDays: integerValue(values.snapshotStaleDays, DEFAULT_FORM_VALUES.snapshotStaleDays),
      blockOnMissingSnapshots: Boolean(values.blockOnMissingSnapshots),
      blockOnStaleSnapshots: Boolean(values.blockOnStaleSnapshots),
      blockOnMissingTools: Boolean(values.blockOnMissingTools),
      blockOnFailedMutatingOperations: Boolean(values.blockOnFailedMutatingOperations),
      maxHighRiskDependencyChanges: integerValue(values.maxHighRiskDependencyChanges, DEFAULT_FORM_VALUES.maxHighRiskDependencyChanges),
      maxMediumRiskDependencyChanges: integerValue(values.maxMediumRiskDependencyChanges, DEFAULT_FORM_VALUES.maxMediumRiskDependencyChanges),
      maxHighSeverityPolicyViolations: integerValue(
        values.maxHighSeverityPolicyViolations,
        DEFAULT_FORM_VALUES.maxHighSeverityPolicyViolations
      ),
      maxPolicyWarnings: integerValue(values.maxPolicyWarnings, DEFAULT_FORM_VALUES.maxPolicyWarnings),
      maxPolicyViolations: integerValue(values.maxPolicyViolations, DEFAULT_FORM_VALUES.maxPolicyViolations),
      maxRecentFailedPublishOperations: integerValue(
        values.maxRecentFailedPublishOperations,
        DEFAULT_FORM_VALUES.maxRecentFailedPublishOperations
      ),
      maxRecentFailedMutatingOperations: integerValue(
        values.maxRecentFailedMutatingOperations,
        DEFAULT_FORM_VALUES.maxRecentFailedMutatingOperations
      ),
      ciEvidenceMaxAgeDays: integerValue(values.ciEvidenceMaxAgeDays, DEFAULT_FORM_VALUES.ciEvidenceMaxAgeDays),
      blockOnMissingCiEvidence: Boolean(values.blockOnMissingCiEvidence),
      blockOnStaleCiEvidence: Boolean(values.blockOnStaleCiEvidence),
      blockOnFailedCiEvidence: Boolean(values.blockOnFailedCiEvidence),
      auditEvidenceMaxAgeDays: integerValue(values.auditEvidenceMaxAgeDays, DEFAULT_FORM_VALUES.auditEvidenceMaxAgeDays),
      blockOnMissingAuditEvidence: Boolean(values.blockOnMissingAuditEvidence),
      blockOnStaleAuditEvidence: Boolean(values.blockOnStaleAuditEvidence),
      maxCriticalAuditFindings: integerValue(values.maxCriticalAuditFindings, DEFAULT_FORM_VALUES.maxCriticalAuditFindings),
      maxHighAuditFindings: integerValue(values.maxHighAuditFindings, DEFAULT_FORM_VALUES.maxHighAuditFindings),
      maxMediumAuditFindings: integerValue(values.maxMediumAuditFindings, DEFAULT_FORM_VALUES.maxMediumAuditFindings),
      blockOnCriticalAuditFindings: Boolean(values.blockOnCriticalAuditFindings),
      blockOnHighAuditFindings: Boolean(values.blockOnHighAuditFindings),
      requiredReleaseApprovals: integerValue(values.requiredReleaseApprovals, DEFAULT_FORM_VALUES.requiredReleaseApprovals),
      releaseApprovalMaxAgeDays: integerValue(values.releaseApprovalMaxAgeDays, DEFAULT_FORM_VALUES.releaseApprovalMaxAgeDays),
      blockOnMissingReleaseApprovals: Boolean(values.blockOnMissingReleaseApprovals),
      blockOnRejectedReleaseApproval: Boolean(values.blockOnRejectedReleaseApproval),
      registryReachabilityTimeoutMs: integerValue(values.registryReachabilityTimeoutMs, DEFAULT_FORM_VALUES.registryReachabilityTimeoutMs),
      blockOnMissingRegistryEndpoints: Boolean(values.blockOnMissingRegistryEndpoints),
      blockOnUnreachableRegistries: Boolean(values.blockOnUnreachableRegistries),
      blockOnInsecureRegistries: Boolean(values.blockOnInsecureRegistries),
      maxUnreachableRegistries: integerValue(values.maxUnreachableRegistries, DEFAULT_FORM_VALUES.maxUnreachableRegistries),
      maxLockfileDriftWarnings: integerValue(values.maxLockfileDriftWarnings, DEFAULT_FORM_VALUES.maxLockfileDriftWarnings),
      blockOnLockfileDrift: Boolean(values.blockOnLockfileDrift),
      maxRuntimePinningWarnings: integerValue(values.maxRuntimePinningWarnings, DEFAULT_FORM_VALUES.maxRuntimePinningWarnings),
      blockOnRuntimePinning: Boolean(values.blockOnRuntimePinning),
      blockOnFloatingContainerTags: Boolean(values.blockOnFloatingContainerTags),
      maxFloatingDeploymentRefs: integerValue(values.maxFloatingDeploymentRefs, DEFAULT_FORM_VALUES.maxFloatingDeploymentRefs),
      blockOnFloatingDeploymentRefs: Boolean(values.blockOnFloatingDeploymentRefs),
      maxMissingDeploymentBaselines: integerValue(
        values.maxMissingDeploymentBaselines,
        DEFAULT_FORM_VALUES.maxMissingDeploymentBaselines
      ),
      blockOnMissingDeploymentBaselines: Boolean(values.blockOnMissingDeploymentBaselines),
      maxMissingCredentialEndpoints: integerValue(values.maxMissingCredentialEndpoints, DEFAULT_FORM_VALUES.maxMissingCredentialEndpoints),
      blockOnMissingCredentialEndpoints: Boolean(values.blockOnMissingCredentialEndpoints),
      blockOnInsecureCredentialUsage: Boolean(values.blockOnInsecureCredentialUsage),
      maxWeakCredentialMatches: integerValue(values.maxWeakCredentialMatches, DEFAULT_FORM_VALUES.maxWeakCredentialMatches),
      blockOnWeakCredentialMatches: Boolean(values.blockOnWeakCredentialMatches),
      maxUnusedCredentials: integerValue(values.maxUnusedCredentials, DEFAULT_FORM_VALUES.maxUnusedCredentials),
      blockOnUnusedCredentials: Boolean(values.blockOnUnusedCredentials),
      minimumScore: integerValue(values.minimumScore, DEFAULT_FORM_VALUES.minimumScore),
      blockBelowMinimumScore: Boolean(values.blockBelowMinimumScore)
    }

    setSaving(true)
    setError('')
    try {
      const result = await window.electronAPI.readiness.savePolicy(projectPath, policy)
      setPolicyPath(result.path)
      onSaved?.(result)
      onClose()
    } catch (error: any) {
      setError(error?.message || String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Readiness gate policy"
      open={open}
      onCancel={onClose}
      onOk={savePolicy}
      confirmLoading={saving}
      okText="Save policy"
      cancelText="Cancel"
      width={840}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type={error ? 'warning' : 'info'}
          showIcon
          title={error ? 'Policy could not be loaded or saved' : 'Project-level release gate thresholds'}
          description={error || policyPath || (projectPath ? `${projectPath}\\.npmDesktopManager\\readiness-policy.json` : 'Select a project directory first.')}
        />
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_FORM_VALUES}
          disabled={loading || !projectPath}
        >
          <Text strong>Snapshot and tool gates</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="snapshotStaleDays" label="Snapshot stale after days">
              <InputNumber min={1} max={365} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnMissingSnapshots" valuePropName="checked" label="Block missing snapshots">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnStaleSnapshots" valuePropName="checked" label="Block stale snapshots">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnMissingTools" valuePropName="checked" label="Block missing tools">
              <Switch />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>Dependency risk thresholds</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="maxHighRiskDependencyChanges" label="Max high-risk changes">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="maxMediumRiskDependencyChanges" label="Max medium-risk changes">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="maxHighSeverityPolicyViolations" label="Max high policy violations">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="maxPolicyWarnings" label="Max policy warnings">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="maxPolicyViolations" label="Max total policy violations">
              <InputNumber min={0} max={100000} precision={0} />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>CI evidence gates</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="ciEvidenceMaxAgeDays" label="CI evidence max age">
              <InputNumber min={1} max={365} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnMissingCiEvidence" valuePropName="checked" label="Block missing CI evidence">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnStaleCiEvidence" valuePropName="checked" label="Block stale CI evidence">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnFailedCiEvidence" valuePropName="checked" label="Block failed CI evidence">
              <Switch />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>Audit evidence gates</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="auditEvidenceMaxAgeDays" label="Audit evidence max age">
              <InputNumber min={1} max={365} precision={0} />
            </Form.Item>
            <Form.Item name="maxCriticalAuditFindings" label="Max critical audit findings">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="maxHighAuditFindings" label="Max high audit findings">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="maxMediumAuditFindings" label="Max medium audit findings">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnMissingAuditEvidence" valuePropName="checked" label="Block missing audit">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnStaleAuditEvidence" valuePropName="checked" label="Block stale audit">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnCriticalAuditFindings" valuePropName="checked" label="Block critical audit">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnHighAuditFindings" valuePropName="checked" label="Block high audit">
              <Switch />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>Release approval gates</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="requiredReleaseApprovals" label="Required approvals">
              <InputNumber min={0} max={20} precision={0} />
            </Form.Item>
            <Form.Item name="releaseApprovalMaxAgeDays" label="Approval max age">
              <InputNumber min={1} max={365} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnMissingReleaseApprovals" valuePropName="checked" label="Block missing approvals">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnRejectedReleaseApproval" valuePropName="checked" label="Block rejected approvals">
              <Switch />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>Registry reachability gates</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="registryReachabilityTimeoutMs" label="Registry timeout ms">
              <InputNumber min={500} max={15000} precision={0} />
            </Form.Item>
            <Form.Item name="maxUnreachableRegistries" label="Max unreachable registries">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnMissingRegistryEndpoints" valuePropName="checked" label="Block missing registries">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnUnreachableRegistries" valuePropName="checked" label="Block unreachable registries">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnInsecureRegistries" valuePropName="checked" label="Block insecure registries">
              <Switch />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>Reproducibility gates</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="maxLockfileDriftWarnings" label="Max lock drift warnings">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnLockfileDrift" valuePropName="checked" label="Block lock drift">
              <Switch />
            </Form.Item>
            <Form.Item name="maxRuntimePinningWarnings" label="Max runtime warnings">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnRuntimePinning" valuePropName="checked" label="Block runtime pinning">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnFloatingContainerTags" valuePropName="checked" label="Block floating images">
              <Switch />
            </Form.Item>
            <Form.Item name="maxFloatingDeploymentRefs" label="Max floating deploy refs">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnFloatingDeploymentRefs" valuePropName="checked" label="Block floating deploy refs">
              <Switch />
            </Form.Item>
            <Form.Item name="maxMissingDeploymentBaselines" label="Max missing deploy baselines">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnMissingDeploymentBaselines" valuePropName="checked" label="Block missing deploy baselines">
              <Switch />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>Credential usage gates</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="maxMissingCredentialEndpoints" label="Max missing credentials">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnMissingCredentialEndpoints" valuePropName="checked" label="Block missing credentials">
              <Switch />
            </Form.Item>
            <Form.Item name="blockOnInsecureCredentialUsage" valuePropName="checked" label="Block insecure credentials">
              <Switch />
            </Form.Item>
            <Form.Item name="maxWeakCredentialMatches" label="Max weak matches">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnWeakCredentialMatches" valuePropName="checked" label="Block weak matches">
              <Switch />
            </Form.Item>
            <Form.Item name="maxUnusedCredentials" label="Max unused credentials">
              <InputNumber min={0} max={100000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnUnusedCredentials" valuePropName="checked" label="Block unused credentials">
              <Switch />
            </Form.Item>
          </Space>

          <Divider />
          <Text strong>Operation history and score</Text>
          <Space size={24} wrap align="start" style={{ width: '100%', marginTop: 8 }}>
            <Form.Item name="recentOperationDays" label="Recent operation window">
              <InputNumber min={1} max={365} precision={0} />
            </Form.Item>
            <Form.Item name="maxRecentFailedPublishOperations" label="Max failed publishes">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="maxRecentFailedMutatingOperations" label="Max failed mutations">
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="blockOnFailedMutatingOperations" valuePropName="checked" label="Block failed mutations">
              <Switch />
            </Form.Item>
            <Form.Item name="minimumScore" label="Minimum score">
              <InputNumber min={0} max={100} precision={0} />
            </Form.Item>
            <Form.Item name="blockBelowMinimumScore" valuePropName="checked" label="Block below score">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Space>
    </Modal>
  )
}

function integerValue(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback
}

export default ReadinessPolicyEditor
