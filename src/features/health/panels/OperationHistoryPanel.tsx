import { ExportOutlined, HistoryOutlined } from '@ant-design/icons'
import { Button, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { formatDuration, operationKindColor, operationKindLabel } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel,
  'operationHistory' | 'filteredOperations' | 'historyManagerFilter' | 'setHistoryManagerFilter' |
  'operationManagerOptions' | 'historyStatusFilter' | 'setHistoryStatusFilter' | 'historyChangeFilter' |
  'setHistoryChangeFilter' | 'operationStats' | 'exportOperationHistory' | 'reporting' | 'recentOperations'
>

export function OperationHistoryPanel({ operationHistory, filteredOperations, historyManagerFilter, setHistoryManagerFilter, operationManagerOptions, historyStatusFilter, setHistoryStatusFilter, historyChangeFilter, setHistoryChangeFilter, operationStats, exportOperationHistory, reporting, recentOperations }: Props) {
  return (operationHistory.length > 0 && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <HistoryOutlined />
          <Text strong>最近操作</Text>
          <Tag>{operationHistory.length} 条记录</Tag>
        </Space>
        <Text type="secondary">CLI 命令会持久记录到当前项目的 `.npmDesktopManager/operations`。</Text>
      </div>
      <div className={styles.historyControls}>
        <Text type="secondary">
          {filteredOperations.length}/{operationHistory.length} 条记录
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
            { value: 'all', label: '全部状态' },
            { value: 'success', label: '成功' },
            { value: 'error', label: '失败' }
          ]}
          style={{ width: 112 }}
        />
        <Select
          size="small"
          value={historyChangeFilter}
          onChange={(value: 'all' | 'mutating' | 'readonly') => setHistoryChangeFilter(value)}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'mutating', label: '变更' },
            { value: 'readonly', label: '只读' }
          ]}
          style={{ width: 112 }}
        />
        <Tag color="orange">{operationStats.mutating} 变更</Tag>
        <Tag color={operationStats.errors > 0 ? 'red' : 'green'}>{operationStats.errors} 失败</Tag>
        <Button size="small" icon={<ExportOutlined />} onClick={() => exportOperationHistory('markdown')} loading={reporting}>
          导出
        </Button>
      </div>
      <OperationHistoryPanelTable recentOperations={recentOperations} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function OperationHistoryPanelTable({ recentOperations }: Pick<PanelValues, 'recentOperations'>) {
  return (<Table
    dataSource={recentOperations}
    rowKey="id"
    size="small"
    pagination={false}
    columns={[
      {
        title: '完成时间',
        dataIndex: 'finishedAt',
        key: 'finishedAt',
        width: 190,
        render: (value: string) => new Date(value).toLocaleString()
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (status: OperationHistoryStatus) => (
          <Tag color={status === 'success' ? 'green' : 'red'}>{status === 'success' ? '成功' : '失败'}</Tag>
        )
      },
      {
        title: '命令',
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
                {operationKindLabel(record.classification?.operation)}
              </Tag>
              <Tag color={record.classification?.mutating ? 'orange' : 'blue'}>
                {record.classification?.mutating ? '变更' : '只读'}
              </Tag>
            </Space>
            <Text code>{command}</Text>
          </Space>
        )
      },
      {
        title: '耗时',
        dataIndex: 'durationMs',
        key: 'durationMs',
        width: 90,
        render: (durationMs: number) => formatDuration(durationMs)
      },
      {
        title: '摘要',
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
