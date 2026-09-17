import { ExportOutlined, HistoryOutlined } from '@ant-design/icons'
import { Button, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { useT } from '../../../i18n'
import { formatDuration, operationKindColor, operationKindLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'operationHistory' | 'filteredOperations' | 'historyManagerFilter' | 'setHistoryManagerFilter' |
  'operationManagerOptions' | 'historyStatusFilter' | 'setHistoryStatusFilter' | 'historyChangeFilter' |
  'setHistoryChangeFilter' | 'operationStats' | 'exportOperationHistory' | 'reporting' | 'recentOperations'
>

export function OperationHistoryPanel({ operationHistory, filteredOperations, historyManagerFilter, setHistoryManagerFilter, operationManagerOptions, historyStatusFilter, setHistoryStatusFilter, historyChangeFilter, setHistoryChangeFilter, operationStats, exportOperationHistory, reporting, recentOperations }: Props) {
  const t = useT()
  return (operationHistory.length > 0 && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <HistoryOutlined />
          <Text strong>{t('health.recentOperations')}</Text>
          <Tag>{t('health.recordCount', { count: operationHistory.length })}</Tag>
        </Space>
        <Text type="secondary">{t('health.operationHint')}</Text>
      </div>
      <div className={styles.historyControls}>
        <Text type="secondary">
          {t('health.filteredRecords', { shown: filteredOperations.length, total: operationHistory.length })}
        </Text>
        <Select
          size="small"
          value={historyManagerFilter}
          onChange={(value) => setHistoryManagerFilter(value)}
          options={operationManagerOptions}
          style={{ width: 132 }}
        />
        <Select
          size="small"
          value={historyStatusFilter}
          onChange={(value: 'all' | OperationHistoryStatus) => setHistoryStatusFilter(value)}
          options={[
            { value: 'all', label: t('health.allStatuses') },
            { value: 'success', label: t('common.success') },
            { value: 'error', label: t('common.failure') }
          ]}
          style={{ width: 112 }}
        />
        <Select
          size="small"
          value={historyChangeFilter}
          onChange={(value: 'all' | 'mutating' | 'readonly') => setHistoryChangeFilter(value)}
          options={[
            { value: 'all', label: t('health.allTypes') },
            { value: 'mutating', label: t('health.mutatingTag') },
            { value: 'readonly', label: t('health.readonlyTag') }
          ]}
          style={{ width: 112 }}
        />
        <Tag color="orange">{t('health.mutatingCount', { count: operationStats.mutating })}</Tag>
        <Tag color={operationStats.errors > 0 ? 'red' : 'green'}>{t('health.errorCount', { count: operationStats.errors })}</Tag>
        <Button size="small" icon={<ExportOutlined />} onClick={() => exportOperationHistory('markdown')} loading={reporting}>
          {t('common.export')}
        </Button>
      </div>
      <OperationHistoryPanelTable recentOperations={recentOperations} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function OperationHistoryPanelTable({ recentOperations }: Pick<PanelValues, 'recentOperations'>) {
  const t = useT()
  return (<Table
    dataSource={recentOperations}
    rowKey="id"
    size="small"
    pagination={false}
    columns={[
      {
        title: t('health.columnCompletedAt'),
        dataIndex: 'finishedAt',
        key: 'finishedAt',
        width: 190,
        render: (value: string) => new Date(value).toLocaleString()
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (status: OperationHistoryStatus) => (
          <Tag color={status === 'success' ? 'green' : 'red'}>{status === 'success' ? t('common.success') : t('common.failure')}</Tag>
        )
      },
      {
        title: t('health.columnCommand'),
        dataIndex: 'command',
        key: 'command',
        ellipsis: true,
        render: (command: string, record: OperationHistoryRecord) => (
          <Space orientation="vertical" size={2} className={styles.historyCommand}>
            <Space size={4} wrap>
              <Tag color={record.classification?.managerId ? managerColor(record.classification.managerId) : 'default'}>
                {record.classification?.managerId || record.classification?.tool || 'unknown'}
              </Tag>
              <Tag color={operationKindColor(record.classification?.operation)}>
                {operationKindLabel(record.classification?.operation, t)}
              </Tag>
              <Tag color={record.classification?.mutating ? 'orange' : 'blue'}>
                {record.classification?.mutating ? t('health.mutatingTag') : t('health.readonlyTag')}
              </Tag>
            </Space>
            <Text code>{command}</Text>
          </Space>
        )
      },
      {
        title: t('health.columnDuration'),
        dataIndex: 'durationMs',
        key: 'durationMs',
        width: 90,
        render: (durationMs: number) => formatDuration(durationMs)
      },
      {
        title: t('health.columnSummary'),
        key: 'summary',
        width: 220,
        ellipsis: true,
        render: (_: unknown, record: OperationHistoryRecord) => {
          const summary = record.summary || record.error || record.stderr || record.stdout || '-'
          return <Tooltip title={summary}><span>{summary}</span></Tooltip>
        }
      }
    ]}
  />)
}
