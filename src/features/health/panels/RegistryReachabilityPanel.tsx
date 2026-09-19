import { ToolOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Tooltip, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { registryStatusColor } from '../healthPresentation'
import { useT } from '../../../i18n'
import type { TranslationKey } from '../../../i18n'
import type { HealthCenterModel } from '../useHealthCenterModel'
import { pagedPagination } from '../../../utils/tablePagination'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'registryRows' | 'registryReport'>

const STATUS_KEYS: Record<RegistryReachabilityStatus | 'not checked', TranslationKey> = {
  reachable: 'registry.status.reachable',
  unauthorized: 'registry.status.unauthorized',
  'not-found': 'registry.status.notFound',
  unreachable: 'registry.status.unreachable',
  slow: 'registry.status.slow',
  unknown: 'registry.status.unknown',
  skipped: 'registry.status.skipped',
  'not checked': 'registry.status.unknown'
}

export function RegistryReachabilityPanel({ currentPath, registryRows, registryReport }: Props) {
  const t = useT()
  const summary = registryReport?.summary
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ToolOutlined />
          <Text strong>{t('health.block.registryEndpoints')}</Text>
          <Tag>{t('health.endpointsCount', { count: registryRows.length })}</Tag>
          {summary && (
            <>
              <Tag color={summary.unreachable > 0 ? 'red' : 'green'}>
                {summary.reachable} {t('registry.status.reachable')}
              </Tag>
              <Tag color={summary.insecure > 0 ? 'orange' : 'default'}>
                {summary.insecure} insecure
              </Tag>
              {summary.privateHost > 0 && (
                <Tooltip title={t('registry.privateHint')}>
                  <Tag color="blue">{summary.privateHost} private</Tag>
                </Tooltip>
              )}
            </>
          )}
        </Space>
        <Text type="secondary">
          {registryReport ? new Date(registryReport.generatedAt).toLocaleString() : t('health.discoveredEndpointsOnly')}
        </Text>
      </div>
      <RegistryReachabilityPanelTable registryRows={registryRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function RegistryReachabilityPanelTable({ registryRows }: Pick<PanelValues, 'registryRows'>) {
  const t = useT()
  return (<Table
    dataSource={registryRows}
    rowKey="id"
    size="small"
    // Dozens of endpoints are common once Docker and Helm files are included.
    pagination={pagedPagination(registryRows, t)}
    locale={{ emptyText: <Empty description={t('health.noRegistryEndpoints')} /> }}
    columns={[
      {
        title: t('health.columnStatus'),
        key: 'status',
        width: 130,
        render: (_: unknown, record: RegistryEndpoint | RegistryReachabilityResult) => {
          const status = 'status' in record ? record.status : 'not checked'
          return <Tag color={registryStatusColor(status)}>{t(STATUS_KEYS[status])}</Tag>
        }
      },
      {
        title: t('health.columnManager'),
        dataIndex: 'managerId',
        key: 'managerId',
        width: 110,
        render: (managerId: RegistryEndpoint['managerId']) => managerId ? <Tag>{managerId}</Tag> : '-'
      },
      {
        title: t('health.columnKind'),
        dataIndex: 'kind',
        key: 'kind',
        width: 130
      },
      {
        title: t('health.columnUrl'),
        dataIndex: 'url',
        key: 'url',
        ellipsis: true,
        render: (url: string, record: RegistryEndpoint | RegistryReachabilityResult) => (
          <Space size={4} wrap>
            <span>{url}</span>
            {/* The badge alone says nothing: explaining why it matters is the
                difference between noticing a private feed and understanding it. */}
            {!record.secure && (
              <Tooltip title={t('registry.insecureHint')}>
                <Tag color="orange">http</Tag>
              </Tooltip>
            )}
            {record.privateHost && (
              <Tooltip title={t('registry.privateHint')}>
                <Tag color="blue">private</Tag>
              </Tooltip>
            )}
          </Space>
        )
      },
      {
        title: t('health.columnSource'),
        dataIndex: 'sourceFile',
        key: 'sourceFile',
        width: 160
      },
      {
        title: t('health.columnMessage'),
        key: 'message',
        width: 240,
        ellipsis: true,
        render: (_: unknown, record: RegistryEndpoint | RegistryReachabilityResult) => (
          'message' in record ? (record.message || record.statusCode || '-') : '-'
        )
      }
    ]}
  />)
}

export default RegistryReachabilityPanel
