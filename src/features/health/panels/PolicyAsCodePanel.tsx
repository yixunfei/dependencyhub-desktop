import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { policyAsCodeSeverityColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'policyAsCodePack' | 'policyDeploymentGateRows' | 'policyRequiredArtifactRows' | 'policyAsCodeFindings'>

export function PolicyAsCodePanel({ policyAsCodePack, policyDeploymentGateRows, policyRequiredArtifactRows, policyAsCodeFindings }: Props) {
  return (policyAsCodePack && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Policy-as-code pack</Text>
          <Tag color={readinessStatusColor(policyAsCodePack.status)}>
            {readinessStatusLabel(policyAsCodePack.status)}
          </Tag>
          <Tag>{policyAsCodePack.summary.dependencyPolicyRuleCount} rules</Tag>
          <Tag>{policyAsCodePack.summary.readinessGateCount} gates</Tag>
          <Tag>{policyAsCodePack.summary.deploymentPolicyGateCount} deployment gates</Tag>
        </Space>
        <Text type="secondary">{new Date(policyAsCodePack.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Managers: {policyAsCodePack.summary.managers.join(', ') || '-'}</span>
        <span>Automation rules: {policyAsCodePack.summary.automationSafetyRuleCount}</span>
        <span>Review routes: {policyAsCodePack.summary.reviewRouteCount}</span>
        <span>Missing owner routes: {policyAsCodePack.summary.missingOwnerRouteCount}</span>
        <span>Required secrets: {policyAsCodePack.summary.requiredSecretCount}</span>
        <span>Required artifacts: {policyAsCodePack.summary.requiredArtifactCount}</span>
        <span>Deployment gates: {policyAsCodePack.summary.deploymentPolicyGateCount}</span>
      </div>
      <PolicyAsCodePanelTable policyAsCodePack={policyAsCodePack} />
      <PolicyAsCodePanelTable2 policyAsCodePack={policyAsCodePack} />
      <PolicyAsCodePanelTable3 policyDeploymentGateRows={policyDeploymentGateRows} />
      <PolicyAsCodePanelTable4 policyRequiredArtifactRows={policyRequiredArtifactRows} />
      <PolicyAsCodePanelTable5 policyAsCodeFindings={policyAsCodeFindings} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function PolicyAsCodePanelTable({ policyAsCodePack }: Pick<PanelValues, 'policyAsCodePack'>) {
  return (<Table
    dataSource={policyAsCodePack.pack.enforcement.dependencyPolicyRules.slice(0, 12).map((rule, index) => ({ id: `rule:${index}`, rule }))}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No dependency policy rules" /> }}
    columns={[
      {
        title: 'Dependency policy rule',
        dataIndex: 'rule',
        key: 'rule',
        ellipsis: true
      }
    ]}
  />)
}

function PolicyAsCodePanelTable2({ policyAsCodePack }: Pick<PanelValues, 'policyAsCodePack'>) {
  return (<Table
    dataSource={policyAsCodePack.pack.enforcement.readinessGates.slice(0, 12).map((gate, index) => ({ id: `gate:${index}`, gate }))}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No readiness policy gates" /> }}
    columns={[
      {
        title: 'Readiness gate',
        dataIndex: 'gate',
        key: 'gate',
        ellipsis: true
      }
    ]}
  />)
}

function PolicyAsCodePanelTable3({ policyDeploymentGateRows }: Pick<PanelValues, 'policyDeploymentGateRows'>) {
  return (<Table
    dataSource={policyDeploymentGateRows}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No deployment policy gates" /> }}
    columns={[
      {
        title: 'Deployment policy gate',
        dataIndex: 'gate',
        key: 'gate',
        ellipsis: true
      }
    ]}
  />)
}

function PolicyAsCodePanelTable4({ policyRequiredArtifactRows }: Pick<PanelValues, 'policyRequiredArtifactRows'>) {
  return (<Table
    dataSource={policyRequiredArtifactRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No required evidence artifacts" /> }}
    columns={[
      {
        title: 'Required evidence artifact',
        dataIndex: 'artifact',
        key: 'artifact',
        ellipsis: true
      }
    ]}
  />)
}

function PolicyAsCodePanelTable5({ policyAsCodeFindings }: Pick<PanelValues, 'policyAsCodeFindings'>) {
  return (<Table
    dataSource={policyAsCodeFindings}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No policy-as-code findings" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: PolicyAsCodeFindingSeverity) => <Tag color={policyAsCodeSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 170,
        render: (source: PolicyAsCodeFindingSource) => <Tag>{source}</Tag>
      },
      {
        title: 'Finding',
        dataIndex: 'summary',
        key: 'summary',
        ellipsis: true
      },
      {
        title: 'Recommendation',
        dataIndex: 'recommendation',
        key: 'recommendation',
        ellipsis: true
      }
    ]}
  />)
}
