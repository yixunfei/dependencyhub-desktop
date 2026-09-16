import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { licenseComplianceStatusColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'thirdPartyNotices' | 'thirdPartyNoticeRows'>

export function ThirdPartyNoticesPanel({ thirdPartyNotices, thirdPartyNoticeRows }: Props) {
  return (thirdPartyNotices && (
    <div className={styles.policyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>Third-party notices</Text>
          <Tag>{thirdPartyNotices.summary.noticeCount} notices</Tag>
          <Tag color={thirdPartyNotices.summary.policyViolationCount > 0 ? 'orange' : 'green'}>
            {thirdPartyNotices.summary.policyViolationCount} policy
          </Tag>
          <Tag>{thirdPartyNotices.summary.unknownLicenseComponentCount} unknown</Tag>
        </Space>
        <Tooltip title={thirdPartyNotices.policy.path}>
          <Text type="secondary">{new Date(thirdPartyNotices.generatedAt).toLocaleString()}</Text>
        </Tooltip>
      </div>
      <div className={styles.readinessSummary}>
        <span>Components: {thirdPartyNotices.summary.componentCount}</span>
        <span>Known: {thirdPartyNotices.summary.knownLicenseComponentCount}</span>
        <span>Unknown: {thirdPartyNotices.summary.unknownLicenseComponentCount}</span>
        <span>Distinct licenses: {thirdPartyNotices.summary.distinctLicenseCount}</span>
        <span>Managers: {thirdPartyNotices.summary.managerCount}</span>
        <span>Blocked: {thirdPartyNotices.summary.blockedLicenseComponentCount}</span>
        <span>Not allowed: {thirdPartyNotices.summary.notAllowedLicenseComponentCount}</span>
      </div>
      <ThirdPartyNoticesPanelTable thirdPartyNoticeRows={thirdPartyNoticeRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function ThirdPartyNoticesPanelTable({ thirdPartyNoticeRows }: Pick<PanelValues, 'thirdPartyNoticeRows'>) {
  return (<Table
    dataSource={thirdPartyNoticeRows}
    rowKey="id"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No third-party notices captured" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: LicenseComplianceStatus) => <Tag color={licenseComplianceStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'Manager',
        dataIndex: 'managerId',
        key: 'managerId',
        width: 120,
        render: (managerId: DependencyManagerId) => <Tag color={managerColor(managerId)}>{managerId}</Tag>
      },
      {
        title: 'Package',
        dataIndex: 'name',
        key: 'name',
        width: 220,
        ellipsis: true
      },
      {
        title: 'Version',
        dataIndex: 'version',
        key: 'version',
        width: 140,
        render: (version?: string) => version || '-'
      },
      {
        title: 'License',
        dataIndex: 'licenseExpression',
        key: 'licenseExpression',
        width: 180,
        ellipsis: true
      },
      {
        title: 'Source',
        dataIndex: 'sourceFile',
        key: 'sourceFile',
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
