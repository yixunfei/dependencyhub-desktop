import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { managerColor } from '../../../domain/managers/presentation'
import styles from '../HealthCenter.module.css'
import { licenseComplianceStatusColor } from '../healthPresentation'
import type { HealthCenterModel } from '../useHealthCenterModel'
const { Text } = Typography

type Props = Pick<HealthCenterModel, 'licenseReport' | 'licenseRiskCount' | 'licenseRows'>

export function LicenseCompliancePanel({ licenseReport, licenseRiskCount, licenseRows }: Props) {
  return (licenseReport && (
    <div className={styles.policyPanel}>
      <div className={styles.policyHeader}>
        <Space wrap>
          <SafetyCertificateOutlined />
          <Text strong>License compliance</Text>
          <Tag>{licenseReport.summary.licenseCount} licenses</Tag>
          <Tag color={licenseRiskCount > 0 ? 'orange' : 'green'}>
            {licenseRiskCount} risk
          </Tag>
          {licenseReport.policy.requireKnownLicenses && (
            <Tag color="blue">known required</Tag>
          )}
        </Space>
        <Tooltip title={licenseReport.policy.path}>
          <Text type="secondary">{new Date(licenseReport.generatedAt).toLocaleString()}</Text>
        </Tooltip>
      </div>
      <div className={styles.readinessSummary}>
        <span>Components: {licenseReport.summary.componentCount}</span>
        <span>Known: {licenseReport.summary.knownLicenseComponentCount}</span>
        <span>Unknown: {licenseReport.summary.unknownLicenseComponentCount}</span>
        <span>Allowed: {licenseReport.summary.allowedComponentCount}</span>
        <span>Blocked: {licenseReport.summary.blockedLicenseComponentCount}</span>
        <span>Not allowed: {licenseReport.summary.notAllowedLicenseComponentCount}</span>
        <span>Unrestricted: {licenseReport.summary.unrestrictedComponentCount}</span>
        <span>Policy findings: {licenseReport.summary.policyViolationComponentCount}</span>
      </div>
      <LicenseCompliancePanelTable licenseRows={licenseRows} />
    </div>
  ))
}

type PanelValues = { [Key in keyof Props]: NonNullable<Props[Key]> }

function LicenseCompliancePanelTable({ licenseRows }: Pick<PanelValues, 'licenseRows'>) {
  return (<Table
    dataSource={licenseRows}
    rowKey="normalizedLicense"
    size="small"
    pagination={{ pageSize: 8 }}
    locale={{ emptyText: <Empty description="No license metadata captured" /> }}
    columns={[
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: LicenseComplianceStatus) => <Tag color={licenseComplianceStatusColor(status)}>{status}</Tag>
      },
      {
        title: 'License',
        dataIndex: 'license',
        key: 'license',
        width: 180
      },
      {
        title: 'Components',
        dataIndex: 'componentCount',
        key: 'componentCount',
        width: 110
      },
      {
        title: 'Managers',
        dataIndex: 'managers',
        key: 'managers',
        width: 220,
        render: (managerIds: DependencyManagerId[]) => (
          <Space size={4} wrap>
            {managerIds.map((managerId) => <Tag key={managerId} color={managerColor(managerId)}>{managerId}</Tag>)}
          </Space>
        )
      },
      {
        title: 'Packages',
        dataIndex: 'packages',
        key: 'packages',
        ellipsis: true,
        render: (packages: string[]) => packages.join(', ') || '-'
      },
      {
        title: 'Sources',
        dataIndex: 'sources',
        key: 'sources',
        ellipsis: true,
        render: (sources: string[]) => sources.join(', ') || '-'
      }
    ]}
  />)
}
