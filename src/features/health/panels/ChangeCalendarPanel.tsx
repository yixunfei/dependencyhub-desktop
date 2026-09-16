import { CalendarOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { changeWindowStatusColor, dependencyImpactSeverityColor, freezeReasonColor, readinessStatusColor, readinessStatusLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyChangeCalendar' | 'dependencyFreezeWindows' | 'dependencyChangeWindows'>

export function ChangeCalendarPanel({ dependencyChangeCalendar, dependencyFreezeWindows, dependencyChangeWindows }: Props) {
  return (dependencyChangeCalendar && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <CalendarOutlined />
          <Text strong>Dependency change calendar</Text>
          <Tag color={readinessStatusColor(dependencyChangeCalendar.status)}>
            {readinessStatusLabel(dependencyChangeCalendar.status)}
          </Tag>
          <Tag>{dependencyChangeCalendar.summary.windowCount} windows</Tag>
          <Tag>{dependencyChangeCalendar.summary.freezeWindowCount} freeze windows</Tag>
          <Tag>{dependencyChangeCalendar.summary.verificationCommandCount} verify</Tag>
        </Space>
        <Text type="secondary">{new Date(dependencyChangeCalendar.generatedAt).toLocaleString()}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Scheduled: {dependencyChangeCalendar.summary.scheduledWindowCount}</span>
        <span>Needs review: {dependencyChangeCalendar.summary.needsReviewWindowCount}</span>
        <span>Frozen: {dependencyChangeCalendar.summary.frozenWindowCount}</span>
        <span>Blocked: {dependencyChangeCalendar.summary.blockedWindowCount}</span>
        <span>Automation: {dependencyChangeCalendar.summary.automationWindowCount}</span>
        <span>Manual review: {dependencyChangeCalendar.summary.manualReviewWindowCount}</span>
        <span>Security hotfix: {dependencyChangeCalendar.summary.securityHotfixWindowCount}</span>
        <span>Missing owners: {dependencyChangeCalendar.summary.missingOwnerItemCount}</span>
        <span>Trust blocked: {dependencyChangeCalendar.summary.trustBlockedCheckCount}</span>
      </div>
      <ChangeCalendarPanelTable dependencyFreezeWindows={dependencyFreezeWindows} />
      <ChangeCalendarPanelTable2 dependencyChangeWindows={dependencyChangeWindows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ChangeCalendarPanelTable({ dependencyFreezeWindows }: Pick<PanelValues, 'dependencyFreezeWindows'>) {
  return (<Table
    dataSource={dependencyFreezeWindows}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No dependency freeze windows" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: DependencyChangeCalendarStatus) => <Tag color={readinessStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Reason',
        dataIndex: 'reason',
        key: 'reason',
        width: 180,
        render: (reason: DependencyChangeFreezeReason) => <Tag color={freezeReasonColor(reason)}>{reason}</Tag>
      },
      {
        title: 'Scope',
        dataIndex: 'scope',
        key: 'scope',
        width: 210,
        ellipsis: true
      },
      {
        title: 'Window',
        key: 'window',
        width: 250,
        render: (_: unknown, record: DependencyChangeFreezeWindow) => (
          <Space size={4} wrap>
            <Tag>{record.startsAt}</Tag>
            <Tag>{record.endsAt || 'open'}</Tag>
          </Space>
        )
      },
      {
        title: 'Affected',
        key: 'affected',
        width: 170,
        render: (_: unknown, record: DependencyChangeFreezeWindow) => (
          <Space size={4} wrap>
            <Tag>{record.affectedWorkspaceCount} workspaces</Tag>
            <Tag>{record.affectedManagerCount} managers</Tag>
          </Space>
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

function ChangeCalendarPanelTable2({ dependencyChangeWindows }: Pick<PanelValues, 'dependencyChangeWindows'>) {
  return (<Table
    dataSource={dependencyChangeWindows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No dependency change windows" /> }}
    columns={[
      {
        title: 'Kind',
        dataIndex: 'kind',
        key: 'kind',
        width: 140,
        render: (kind: DependencyChangeWindowKind) => <Tag>{kind}</Tag>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 130,
        render: (status: DependencyChangeWindowStatus) => <Tag color={changeWindowStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 110,
        render: (severity: DependencyImpactSeverity) => <Tag color={dependencyImpactSeverityColor(severity)}>{severity}</Tag>
      },
      {
        title: 'Schedule',
        key: 'schedule',
        width: 250,
        render: (_: unknown, record: DependencyChangeCalendarWindow) => (
          <Space size={4} wrap>
            <Tag>{record.startAt || 'unscheduled'}</Tag>
            <Tag>{record.endAt || '-'}</Tag>
          </Space>
        )
      },
      {
        title: 'Scope',
        key: 'scope',
        width: 210,
        render: (_: unknown, record: DependencyChangeCalendarWindow) => (
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
        title: 'Actions',
        dataIndex: 'requiredActions',
        key: 'requiredActions',
        ellipsis: true,
        render: (actions: string[]) => actions.join('; ')
      }
    ]}
  />)
}
