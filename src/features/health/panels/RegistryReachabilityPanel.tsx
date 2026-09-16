import { ToolOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Typography } from 'antd'
import styles from '../HealthCenter.module.css'
import { registryStatusColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'currentPath' | 'registryRows' | 'registryReport'>

export function RegistryReachabilityPanel({ currentPath, registryRows, registryReport }: Props) {
  return (currentPath && (
    <div className={styles.historyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <ToolOutlined />
          <Text strong>Registry reachability</Text>
          <Tag>{registryRows.length} endpoints</Tag>
          {registryReport && (
            <>
              <Tag color={registryReport.summary.unreachable > 0 ? 'red' : 'green'}>
                {registryReport.summary.reachable} reachable
              </Tag>
              <Tag color={registryReport.summary.insecure > 0 ? 'orange' : 'default'}>
                {registryReport.summary.insecure} insecure
              </Tag>
            </>
          )}
        </Space>
        <Text type="secondary">
          {registryReport ? new Date(registryReport.generatedAt).toLocaleString() : 'Discovered endpoints only'}
        </Text>
      </div>
      <RegistryReachabilityPanelTable registryRows={registryRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function RegistryReachabilityPanelTable({ registryRows }: Pick<PanelValues, 'registryRows'>) {
  return (<Table
    dataSource={registryRows}
    rowKey="id"
    size="small"
    pagination={false}
    locale={{ emptyText: <Empty description="No registry endpoints discovered" /> }}
    columns={[
      {
        title: 'Status',
        key: 'status',
        width: 120,
        render: (_: unknown, record: RegistryEndpoint | RegistryReachabilityResult) => {
          const status = 'status' in record ? record.status : 'not checked'
          return <Tag color={registryStatusColor(status)}>{status}</Tag>
        }
      },
      {
        title: 'Manager',
        dataIndex: 'managerId',
        key: 'managerId',
        width: 110,
        render: (managerId: DependencyManagerId | undefined) => managerId ? <Tag>{managerId}</Tag> : '-'
      },
      {
        title: 'Kind',
        dataIndex: 'kind',
        key: 'kind',
        width: 130
      },
      {
        title: 'URL',
        dataIndex: 'url',
        key: 'url',
        ellipsis: true,
        render: (url: string, record: RegistryEndpoint | RegistryReachabilityResult) => (
          <Space size={4} wrap>
            <span>{url}</span>
            {!record.secure && <Tag color="orange">http</Tag>}
            {record.privateHost && <Tag color="blue">private</Tag>}
          </Space>
        )
      },
      {
        title: 'Source',
        dataIndex: 'sourceFile',
        key: 'sourceFile',
        width: 160
      },
      {
        title: 'Message',
        key: 'message',
        width: 220,
        ellipsis: true,
        render: (_: unknown, record: RegistryEndpoint | RegistryReachabilityResult) => (
          'message' in record ? (record.message || record.statusCode || '-') : '-'
        )
      }
    ]}
  />)
}
