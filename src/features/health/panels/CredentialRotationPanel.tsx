import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { credentialRotationSeverityColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'credentialRotationPlan' | 'credentialRotationActions'>

export function CredentialRotationPanel({ credentialRotationPlan, credentialRotationActions }: Props) {
  return (credentialRotationPlan && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Credential rotation plan</Text>
          <Tag color={readinessStatusColor(credentialRotationPlan.status)}>
            {readinessStatusLabel(credentialRotationPlan.status)}
          </Tag>
          <Tag>{credentialRotationPlan.summary.actionCount} actions</Tag>
          <Tag>{credentialRotationPlan.summary.credentialCount} credentials</Tag>
        </Space>
        <Text type="secondary">{new Date(credentialRotationPlan.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Private endpoints: {credentialRotationPlan.summary.privateEndpointCount}</span>
        <span>Missing credentials: {credentialRotationPlan.summary.missingCredentialEndpointCount}</span>
        <span>Weak matches: {credentialRotationPlan.summary.weakMatchEndpointCount}</span>
        <span>Insecure storage: {credentialRotationPlan.summary.insecureStorageCredentialCount}</span>
        <span>Stale: {credentialRotationPlan.summary.staleCredentialCount}</span>
        <span>Unused: {credentialRotationPlan.summary.unusedCredentialCount}</span>
        <span>Automation secrets: {credentialRotationPlan.summary.automationSecretCount}</span>
        <span>Vault encrypted: {credentialRotationPlan.summary.vaultEncrypted ? 'yes' : 'no'}</span>
      </div>
      <CredentialRotationPanelTable credentialRotationActions={credentialRotationActions} />
      <CredentialRotationPanelTable2 credentialRotationPlan={credentialRotationPlan} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function CredentialRotationPanelTable({ credentialRotationActions }: Pick<PanelValues, 'credentialRotationActions'>) {
  return (<Table
    dataSource={credentialRotationActions}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No credential rotation actions" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity: CredentialRotationSeverity) => <Tag color={credentialRotationSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Kind',
        dataIndex: 'kind',
        key: 'kind',
        width: 190,
        render: (kind: CredentialRotationActionKind) => <Tag>{kind}</Tag>
      },
      {
        title: 'Action',
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

function CredentialRotationPanelTable2({ credentialRotationPlan }: Pick<PanelValues, 'credentialRotationPlan'>) {
  return (<Table
    dataSource={credentialRotationPlan.credentials.slice(0, 10)}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No credential metadata" /> }}
    columns={[
      {
        title: 'Credential',
        dataIndex: 'label',
        key: 'label',
        ellipsis: true
      },
      {
        title: 'Manager',
        dataIndex: 'managerId',
        key: 'managerId',
        width: 110,
        render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
      },
      {
        title: 'Age',
        dataIndex: 'ageDays',
        key: 'ageDays',
        width: 90,
        render: (age: number) => `${age}d`
      },
      {
        title: 'Encrypted',
        dataIndex: 'encrypted',
        key: 'encrypted',
        width: 110,
        render: (encrypted: boolean) => <Tag color={encrypted ? 'green' : 'red'}>{encrypted ? 'yes' : 'no'}</Tag>
      },
      {
        title: 'Flags',
        key: 'flags',
        width: 220,
        render: (_: unknown, record: CredentialRotationCredential) => (
          <Space size={4} wrap>
            {record.needsRotation && <Tag color="orange">rotate</Tag>}
            {record.stale && <Tag>stale</Tag>}
            {record.unused && <Tag>unused</Tag>}
            {record.matchTypes.map((match) => <Tag key={match}>{match}</Tag>)}
          </Space>
        )
      }
    ]}
  />)
}
