import { WarningOutlined } from '@ant-design/icons'
import { Space, Table, Tag, Tooltip, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { dependencyChangeColor, dependencyRiskColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'dependencyDiff' | 'dependencyHighRiskCount' | 'dependencyDiffRows'>

export function DependencyRiskPanel({ dependencyDiff, dependencyHighRiskCount, dependencyDiffRows }: Props) {
  return (dependencyDiff && (
    <div className={styles.riskPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <WarningOutlined />
          <Text strong>Dependency change risk</Text>
          <Tag color={dependencyHighRiskCount > 0 ? 'red' : dependencyDiff.summary.mediumRisk > 0 ? 'orange' : 'green'}>
            {dependencyHighRiskCount} high+
          </Tag>
          <Tag>{dependencyDiff.summary.added} added</Tag>
          <Tag>{dependencyDiff.summary.updated} updated</Tag>
          <Tag>{dependencyDiff.summary.removed} removed</Tag>
        </Space>
        <Text type="secondary">Baseline {dependencyDiff.fromSnapshotId}</Text>
      </div>
      <div className={styles.readinessSummary}>
        <span>Before: {dependencyDiff.beforeComponentCount}</span>
        <span>After: {dependencyDiff.afterComponentCount}</span>
        <span>Major: {dependencyDiff.summary.majorUpdates}</span>
        <span>Prerelease: {dependencyDiff.summary.prereleaseChanges}</span>
        <span>Unpinned: {dependencyDiff.summary.unpinnedChanges}</span>
        <span>License: {dependencyDiff.summary.licenseChanges}</span>
      </div>
      <DependencyRiskPanelTable dependencyDiffRows={dependencyDiffRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function DependencyRiskPanelTable({ dependencyDiffRows }: Pick<PanelValues, 'dependencyDiffRows'>) {
  return (<Table
    dataSource={dependencyDiffRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    columns={[
      {
        title: 'Risk',
        dataIndex: 'risk',
        key: 'risk',
        width: 96,
        render: (risk: DependencyRiskLevel) => <Tag color={dependencyRiskColor(risk)}>{risk}</Tag>
      },
      {
        title: 'Change',
        dataIndex: 'kind',
        key: 'kind',
        width: 100,
        render: (kind: DependencyChangeKind) => <Tag color={dependencyChangeColor(kind)}>{kind}</Tag>
      },
      {
        title: 'Package',
        key: 'package',
        width: 260,
        render: (_: unknown, record: DependencyComponentChange) => (
          <Space size={4} wrap>
            <Tag color={managerColor(record.managerId)}>{record.managerId}</Tag>
            <span>{record.name}</span>
          </Space>
        )
      },
      {
        title: 'Before',
        key: 'before',
        width: 130,
        render: (_: unknown, record: DependencyComponentChange) => record.before?.version || '-'
      },
      {
        title: 'After',
        key: 'after',
        width: 130,
        render: (_: unknown, record: DependencyComponentChange) => record.after?.version || '-'
      },
      {
        title: 'Reasons',
        key: 'reasons',
        ellipsis: true,
        render: (_: unknown, record: DependencyComponentChange) => (
          <Tooltip title={record.riskReasons.join('; ')}>
            <span>{record.riskReasons.join('; ')}</span>
          </Tooltip>
        )
      }
    ]}
  />)
}
