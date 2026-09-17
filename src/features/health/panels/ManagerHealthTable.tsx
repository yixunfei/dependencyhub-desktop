import type { TableProps } from 'antd'
import { Button, Empty, Space, Table, Tag, Tooltip } from 'antd'
import { managerColor, managerIcon } from '../../../domain/managers/presentation'
import { useT, type LabelTranslator } from '../../../i18n'
import { renderScanStatus } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'

type Props = Pick<HealthCenterModel, 'rows' | 'loading' | 'toolStatusMap' | 'scanManager' | 'scanning' | 'currentPath' | 'navigate'>

export function ManagerHealthTable({ rows, loading, toolStatusMap, scanManager, scanning, currentPath, navigate }: Props) {
  return (<ManagerHealthTableTable rows={rows} loading={loading} toolStatusMap={toolStatusMap} scanManager={scanManager} scanning={scanning} currentPath={currentPath} navigate={navigate} />)
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

type Column = NonNullable<TableProps<NonNullable<Props['rows']>[number]>['columns']>[number]

/**
 * Columns are built per render rather than declared at module scope: the titles
 * and the health-scan cells resolve through the dictionary, and module scope
 * cannot call `useT()`.
 */
function buildColumns(t: LabelTranslator, { toolStatusMap, scanManager, scanning, currentPath, navigate }: Pick<PanelValues,
  'toolStatusMap' | 'scanManager' | 'scanning' | 'currentPath' | 'navigate'
>): Column[] {
  return [
    {
      title: t('health.columnEcosystem'),
      key: 'manager',
      width: 210,
      render: (_: unknown, record) => (
        <Space>
          {managerIcon(record.id)}
          <span>{record.name}</span>
        </Space>
      )
    },
    {
      title: t('health.columnDetected'),
      key: 'detected',
      width: 110,
      render: (_: unknown, record) => record.detected
        ? <Tag color="success">{t('health.detectedInProject')}</Tag>
        : <Tag>{t('common.notDetected')}</Tag>
    },
    {
      title: t('health.columnToolchain'),
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
    },
    {
      title: t('health.columnHealthScan'),
      key: 'health',
      width: 240,
      render: (_: unknown, record) => renderScanStatus(record.scan, t)
    },
    {
      title: t('health.columnProductionTools'),
      key: 'production',
      render: (_: unknown, record) => (
        <Space size={4} wrap>
          {record.productionTools.slice(0, 3).map((tool) => (
            <Tag key={tool} color={managerColor(record.id)}>{tool}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 210,
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" onClick={() => scanManager(record.id)} loading={scanning === record.id} disabled={!currentPath}>
            {t('health.scan')}
          </Button>
          <Button size="small" onClick={() => navigate(record.route || '/plugins')}>
            {t('common.open')}
          </Button>
        </Space>
      )
    }
  ]
}

function ManagerHealthTableTable({ rows, loading, toolStatusMap, scanManager, scanning, currentPath, navigate }: Pick<PanelValues,
  'rows' | 'loading' | 'toolStatusMap' | 'scanManager' | 'scanning' | 'currentPath' | 'navigate'
>) {
  const t = useT()
  return (<Table
    dataSource={rows}
    rowKey="id"
    size="small"
    loading={loading}
    pagination={false}
    scroll={{ x: 1120 }}
    locale={{ emptyText: <Empty description={t('health.noManagerInfo')} /> }}
    columns={buildColumns(t, { toolStatusMap, scanManager, scanning, currentPath, navigate })}
  />)
}
