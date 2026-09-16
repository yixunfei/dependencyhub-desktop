import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { approvalCheckStatusColor, dependencyImpactSeverityColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyChangeApprovalPacket' | 'dependencyApprovalChecklist' | 'dependencyApprovalScopeItems'>

export function ChangeApprovalPanel({ dependencyChangeApprovalPacket, dependencyApprovalChecklist, dependencyApprovalScopeItems }: Props) {
  return (dependencyChangeApprovalPacket && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Dependency change approval packet</Text>
          <Tag color={readinessStatusColor(dependencyChangeApprovalPacket.status)}>
            {readinessStatusLabel(dependencyChangeApprovalPacket.status)}
          </Tag>
          <Tag>{dependencyChangeApprovalPacket.decision}</Tag>
          <Tag>{dependencyChangeApprovalPacket.summary.scopeItemCount} scope items</Tag>
          <Tag>{dependencyChangeApprovalPacket.summary.participantCount} participants</Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyChangeApprovalPacket.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Checklist: {dependencyChangeApprovalPacket.summary.checklistCount}</span>
        <span>Blocked checks: {dependencyChangeApprovalPacket.summary.blockedChecklistCount}</span>
        <span>Warning checks: {dependencyChangeApprovalPacket.summary.warningChecklistCount}</span>
        <span>Approvals: {dependencyChangeApprovalPacket.summary.approvedRecordCount}</span>
        <span>Rejected: {dependencyChangeApprovalPacket.summary.rejectedRecordCount}</span>
        <span>Active exceptions: {dependencyChangeApprovalPacket.summary.activeExceptionCount}</span>
        <span>Trust blocked: {dependencyChangeApprovalPacket.summary.trustBlockedCheckCount}</span>
        <span>Missing owners: {dependencyChangeApprovalPacket.summary.missingOwnerItemCount}</span>
        <span>Verify: {dependencyChangeApprovalPacket.summary.verificationCommandCount}</span>
      </div>
      <ChangeApprovalPanelTable dependencyApprovalChecklist={dependencyApprovalChecklist} />
      <ChangeApprovalPanelTable2 dependencyChangeApprovalPacket={dependencyChangeApprovalPacket} />
      <ChangeApprovalPanelTable3 dependencyApprovalScopeItems={dependencyApprovalScopeItems} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ChangeApprovalPanelTable({ dependencyApprovalChecklist }: Pick<PanelValues, 'dependencyApprovalChecklist'>) {
  return (<Table
    dataSource={dependencyApprovalChecklist}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No approval checklist items" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DependencyChangeApprovalCheckStatus) => <Tag color={approvalCheckStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 210,
        render: (source: DependencyChangeApprovalCheckSource) => <Tag>{source}</Tag>
      },
      {
        title: 'Check',
        dataIndex: 'title',
        key: 'title',
        width: 240,
        ellipsis: true
      },
      {
        title: 'Summary',
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

function ChangeApprovalPanelTable2({ dependencyChangeApprovalPacket }: Pick<PanelValues, 'dependencyChangeApprovalPacket'>) {
  return (<Table
    dataSource={dependencyChangeApprovalPacket.participants.slice(0, 12)}
    rowKey="owner"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No approval participants" /> }}
    columns={[
      {
        title: 'Role',
        dataIndex: 'role',
        key: 'role',
        width: 150,
        render: (role: DependencyChangeApprovalParticipant['role']) => <Tag>{role}</Tag>
      },
      {
        title: 'Owner / Reviewer',
        dataIndex: 'owner',
        key: 'owner',
        ellipsis: true
      },
      {
        title: 'Scope',
        key: 'scope',
        width: 240,
        render: (_: unknown, record: DependencyChangeApprovalParticipant) => (
          <Space size={4} wrap>
            <Tag>{record.workspaceCount} workspaces</Tag>
            {record.managerIds.map((managerId) => <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>)}
          </Space>
        )
      },
      {
        title: 'Approvals',
        dataIndex: 'approvalCount',
        key: 'approvalCount',
        width: 110
      }
    ]}
  />)
}

function ChangeApprovalPanelTable3({ dependencyApprovalScopeItems }: Pick<PanelValues, 'dependencyApprovalScopeItems'>) {
  return (<Table
    dataSource={dependencyApprovalScopeItems}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No approval scope items" /> }}
    columns={[
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 110,
        render: (severity: DependencyImpactSeverity) => <Tag color={dependencyImpactSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DependencyChangeApprovalPacketStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Scope',
        key: 'scope',
        width: 210,
        render: (_: unknown, record: DependencyChangeApprovalScopeItem) => (
          <Space size={4} wrap>
            <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
            <Tag>{record.workspaceRelativePath || '.'}</Tag>
          </Space>
        )
      },
      {
        title: 'Owners',
        dataIndex: 'owners',
        key: 'owners',
        width: 180,
        render: (owners: string[]) => owners.length > 0
          ? <Space size={4} wrap>{owners.map((owner) => <Tag key={owner}>{owner}</Tag>)}</Space>
          : <Tag color="orange">missing</Tag>
      },
      {
        title: 'Evidence',
        key: 'evidence',
        width: 220,
        render: (_: unknown, record: DependencyChangeApprovalScopeItem) => (
          <Space size={4} wrap>
            <Tag>{record.ciJobCount} CI</Tag>
            <Tag>{record.releaseGateCount} gates</Tag>
            <Tag>{record.riskFindingCount} risks</Tag>
            <Tag>{record.verificationCommandCount} verify</Tag>
          </Space>
        )
      },
      {
        title: 'Rollback',
        dataIndex: 'rollbackStatus',
        key: 'rollbackStatus',
        width: 130,
        render: (status?: DependencyChangeApprovalPacketStatus) => (
          <Tag color={status ? readinessStatusColor(status) : 'default'}>{status || 'missing'}</Tag>
        )
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
