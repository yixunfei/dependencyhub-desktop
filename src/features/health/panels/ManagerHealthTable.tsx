import type { TableProps } from 'antd'
import { Button, Empty, Space, Table, Tag, Tooltip } from 'antd'
import { managerColor, managerIcon } from '../../../domain/managers/presentation'
import { renderScanStatus } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'

type Props = Pick<HealthCenterModel, 'rows' | 'loading' | 'toolStatusMap' | 'scanManager' | 'scanning' | 'currentPath' | 'navigate'>

export function ManagerHealthTable({ rows, loading, toolStatusMap, scanManager, scanning, currentPath, navigate }: Props) {
  return (<ManagerHealthTableTable rows={rows} loading={loading} toolStatusMap={toolStatusMap} scanManager={scanManager} scanning={scanning} currentPath={currentPath} navigate={navigate} />)
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

const ManagerHealthTableTableColumnManager: NonNullable<TableProps<NonNullable<Props['rows']>[number]>['columns']>[number] = {
    title: '生态',
    key: 'manager',
    width: 210,
    render: (_: unknown, record) => (
      <Space>
        {managerIcon(record.id)}
        <span>{record.name}</span>
      </Space>
    )
  }

const ManagerHealthTableTableColumnDetected: NonNullable<TableProps<NonNullable<Props['rows']>[number]>['columns']>[number] = {
    title: '识别',
    key: 'detected',
    width: 110,
    render: (_: unknown, record) => record.detected
      ? <Tag color="success">当前项目</Tag>
      : <Tag>未识别</Tag>
  }

function ManagerHealthTableTableColumnTools({ toolStatusMap }: Pick<PanelValues,
  'toolStatusMap'
>): NonNullable<TableProps<NonNullable<Props['rows']>[number]>['columns']>[number] {
  return ({
    title: '工具链',
    key: 'tools',
    width: 260,
    render: (_: unknown, record) => (
      <Space size={4} wrap>
        {record.tools.map((tool) => {
          const status = toolStatusMap.get(tool as ToolName)
          if (!status) return <Tag key={tool}>{tool}</Tag>
          return status.available ? (
            <Tooltip key={tool} title={status.version}>
              <Tag color="green">{tool}</Tag>
            </Tooltip>
          ) : (
            <Tooltip key={tool} title={status.message}>
              <Tag color="red">{tool}</Tag>
            </Tooltip>
          )
        })}
      </Space>
    )
  })
}

const ManagerHealthTableTableColumnHealth: NonNullable<TableProps<NonNullable<Props['rows']>[number]>['columns']>[number] = {
    title: '健康扫描',
    key: 'health',
    width: 240,
    render: (_: unknown, record) => renderScanStatus(record.scan)
  }

const ManagerHealthTableTableColumnProduction: NonNullable<TableProps<NonNullable<Props['rows']>[number]>['columns']>[number] = {
    title: '生产工具',
    key: 'production',
    render: (_: unknown, record) => (
      <Space size={4} wrap>
        {record.productionTools.slice(0, 3).map((tool) => (
          <Tag key={tool} color={managerColor(record.id)}>{tool}</Tag>
        ))}
      </Space>
    )
  }

function ManagerHealthTableTableColumnAction({ scanManager, scanning, currentPath, navigate }: Pick<PanelValues,
  'scanManager' | 'scanning' | 'currentPath' | 'navigate'
>): NonNullable<TableProps<NonNullable<Props['rows']>[number]>['columns']>[number] {
  return ({
    title: '操作',
    key: 'action',
    width: 210,
    render: (_: unknown, record) => (
      <Space>
        <Button size="small" onClick={() => scanManager(record.id)} loading={scanning === record.id} disabled={!currentPath}>
          扫描
        </Button>
        <Button size="small" onClick={() => navigate(record.route || '/plugins')}>
          打开
        </Button>
      </Space>
    )
  })
}

function ManagerHealthTableTable({ rows, loading, toolStatusMap, scanManager, scanning, currentPath, navigate }: Pick<PanelValues,
  'rows' | 'loading' | 'toolStatusMap' | 'scanManager' | 'scanning' | 'currentPath' | 'navigate'
>) {
  return (<Table
    dataSource={rows}
    rowKey="id"
    size="small"
    loading={loading}
    pagination={false}
    scroll={{ x: 1120 }}
    locale={{ emptyText: <Empty description="暂无管理器信息" /> }}
    columns={[ManagerHealthTableTableColumnManager, ManagerHealthTableTableColumnDetected, ManagerHealthTableTableColumnTools({ toolStatusMap }), ManagerHealthTableTableColumnHealth, ManagerHealthTableTableColumnProduction, ManagerHealthTableTableColumnAction({ scanManager, scanning, currentPath, navigate })]}
  />)
}
