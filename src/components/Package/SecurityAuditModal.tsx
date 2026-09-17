import React, { useState } from 'react'
import { Modal, Table, Tag, Alert, Button, Space, Spin, Typography, Card, Row, Col, Descriptions } from 'antd'
import {
  WarningOutlined, CheckCircleOutlined,
  SecurityScanOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import { localizedMessage as message } from '../../utils/localizedFeedback'
import { useT, type TranslationKey } from '../../i18n'

const { Text, Title, Paragraph } = Typography

interface SecurityAuditModalProps {
  visible: boolean
  projectPath?: string
  scope?: 'project' | 'global'
  onClose: () => void
}

interface Vulnerability {
  name: string
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical'
  version: string
  via: string
  description: string
  range?: string
  nodes?: string[]
  effects?: string[]
  fixAvailable?: boolean
  fixVersion?: string
  isSemverMajor?: boolean
  url?: string
  advisories: AuditAdvisory[]
}

interface AuditAdvisory {
  title: string
  severity?: string
  range?: string
  url?: string
  cwe?: string[]
  cvss?: {
    score?: number
    vectorString?: string
  }
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  visible,
  projectPath = '',
  scope = 'project',
  onClose
}) => {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [auditResult, setAuditResult] = useState<any>(null)
  const [fixing, setFixing] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Vulnerability | null>(null)
  const isGlobal = scope === 'global'
  
  React.useEffect(() => {
    if (visible && (isGlobal || projectPath)) {
      runAudit()
    }
  }, [visible, projectPath, scope])
  
  const runAudit = async () => {
    setLoading(true)
    try {
      const result = isGlobal
        ? await window.electronAPI.npm.globalAudit()
        : await window.electronAPI.npm.audit(projectPath)
      setAuditResult(result)
      if (result?.error) {
        message.warning(result.error)
      }
    } catch (error: any) {
      message.error(error.message || t('security.auditFailed'))
    } finally {
      setLoading(false)
    }
  }
  
  const handleFix = async () => {
    if (isGlobal) {
      message.info(t('security.globalFixUnsupported'))
      return
    }

    setFixing(true)
    try {
      const output = await window.electronAPI.npm.auditFix(projectPath)
      message.success(output ? t('security.fixCommandRun') : t('security.fixComplete'))
      await runAudit()
    } catch (error: any) {
      message.error(error.message || t('security.fixFailed'))
    } finally {
      setFixing(false)
    }
  }
  
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'default',
      low: 'green',
      moderate: 'orange',
      high: 'red',
      critical: 'magenta'
    }
    return colors[severity] || 'default'
  }
  
  const vulnerabilities: Vulnerability[] = auditResult?.vulnerabilities
    ? Object.entries(auditResult.vulnerabilities).map(([name, data]: [string, any]) => {
        const advisories = normalizeAdvisories(data.via, t)
        const fixAvailable = typeof data.fixAvailable === 'object' ? data.fixAvailable : null
        const firstAdvisory = advisories[0]
        return {
          name,
          severity: data.severity,
          version: data.version || data.range || '-',
          via: advisories.map((item) => item.title).join(', ') || stringifyVia(data.via),
          description: firstAdvisory?.title || data.title || t('security.knownRisk'),
          range: data.range || firstAdvisory?.range,
          nodes: data.nodes || [],
          effects: data.effects || [],
          fixAvailable: !!data.fixAvailable,
          fixVersion: fixAvailable?.version,
          isSemverMajor: !!fixAvailable?.isSemVerMajor,
          url: firstAdvisory?.url || data.url,
          advisories
        }
      })
    : []
  
  const metadata = auditResult?.metadata
  const totalVulnerabilities = metadata?.vulnerabilities 
    ? Object.values(metadata.vulnerabilities).reduce((a: number, b: any) => a + b, 0) as number
    : vulnerabilities.length
  
  const columns = [
    {
      title: t('package.columnName'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: t('common.severity'),
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)} icon={
          severity === 'critical' || severity === 'high' 
            ? <WarningOutlined /> 
            : undefined
        }>
          {severity?.toUpperCase?.() || 'UNKNOWN'}
        </Tag>
      )
    },
    {
      title: t('security.columnRange'),
      dataIndex: 'version',
      key: 'version',
      width: 130
    },
    {
      title: t('security.columnDescription'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: t('security.columnFix'),
      key: 'fix',
      width: 170,
      render: (_: any, record: Vulnerability) => (
        record.fixAvailable ? (
          <Tag color={record.isSemverMajor ? 'orange' : 'green'} icon={<CheckCircleOutlined />}>
            {record.fixVersion ? t('security.fixableTo', { version: record.fixVersion }) : t('security.fixable')}
          </Tag>
        ) : (
          <Tag color="red">{t('security.noAutomaticFix')}</Tag>
        )
      )
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 170,
      render: (_: any, record: Vulnerability) => (
        <Space>
          <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setSelectedIssue(record)}>
            {t('security.details')}
          </Button>
          {record.url && (
            <Button size="small" type="link" onClick={() => window.electronAPI.openExternal(record.url!)}>
              {t('security.advisory')}
            </Button>
          )}
        </Space>
      )
    }
  ]
  
  return (
    <>
      <Modal
        title={
          <Space>
            <SecurityScanOutlined />
            {isGlobal ? t('security.globalAuditTitle') : t('security.projectAuditTitle')}
          </Space>
        }
        open={visible}
        onCancel={onClose}
        footer={
          <Space>
            <Button onClick={onClose}>{t('common.close')}</Button>
            <Button onClick={runAudit} loading={loading}>{t('security.rescan')}</Button>
            {totalVulnerabilities > 0 && (
              <Button type="primary" onClick={handleFix} loading={fixing} disabled={isGlobal}>{t('security.autoFix')}</Button>
            )}
          </Space>
        }
        width={980}
      >
        <Spin spinning={loading}>
          {metadata && (
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                      {metadata.vulnerabilities?.info || 0}
                    </Title>
                    <Text type="secondary">{t('security.severityInfo')}</Text>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Title level={2} style={{ margin: 0, color: '#faad14' }}>
                      {metadata.vulnerabilities?.low || 0}
                    </Title>
                    <Text type="secondary">{t('security.severityLow')}</Text>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Title level={2} style={{ margin: 0, color: '#fa8c16' }}>
                      {metadata.vulnerabilities?.moderate || 0}
                    </Title>
                    <Text type="secondary">{t('security.severityModerate')}</Text>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Title level={2} style={{ margin: 0, color: '#f5222d' }}>
                      {(metadata.vulnerabilities?.high || 0) + (metadata.vulnerabilities?.critical || 0)}
                    </Title>
                    <Text type="secondary">{t('security.severityHigh')}</Text>
                  </div>
                </Card>
              </Col>
            </Row>
          )}

          {totalVulnerabilities === 0 ? (
            <Alert
              title={t('security.noVulnerabilities')}
              description={isGlobal ? t('security.noVulnerabilitiesGlobal') : t('security.noVulnerabilitiesProject')}
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
            />
          ) : (
            <>
              <Alert
                title={t('security.vulnerabilitiesFound', { count: totalVulnerabilities })}
                description={isGlobal ? t('security.globalAuditHint') : t('security.projectAuditHint')}
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
              />
              <Table
                dataSource={vulnerabilities}
                columns={columns}
                rowKey="name"
                pagination={false}
                size="small"
              />
            </>
          )}
        </Spin>
      </Modal>

      <Modal
        title={t('security.detailTitle')}
        open={!!selectedIssue}
        onCancel={() => setSelectedIssue(null)}
        footer={<Button onClick={() => setSelectedIssue(null)}>{t('common.close')}</Button>}
        width={760}
      >
        {selectedIssue && (
          <Space orientation="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label={t('package.columnName')}>{selectedIssue.name}</Descriptions.Item>
              <Descriptions.Item label={t('common.severity')}>
                <Tag color={getSeverityColor(selectedIssue.severity)}>{selectedIssue.severity.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('security.columnRange')}>{selectedIssue.range || selectedIssue.version || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('security.columnAffectedPath')}>
                {selectedIssue.nodes?.length ? selectedIssue.nodes.join(', ') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('security.columnAffectedDependency')}>
                {selectedIssue.effects?.length ? selectedIssue.effects.join(', ') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('security.autoFix')}>
                {selectedIssue.fixAvailable
                  ? `${selectedIssue.fixVersion ? t('security.upgradeTo', { version: selectedIssue.fixVersion }) : t('security.fixable')}${selectedIssue.isSemverMajor ? t('security.mayIncludeBreakingChanges') : ''}`
                  : t('security.noAutomaticFixPlan')}
              </Descriptions.Item>
            </Descriptions>
            {selectedIssue.advisories.map((advisory, index) => (
              <Card key={`${advisory.title}-${index}`} size="small" title={advisory.title || t('security.securityAdvisory')}>
                <Paragraph>
                  {t('security.affectedRangeLabel', { range: advisory.range || selectedIssue.range || '-' })}
                </Paragraph>
                {advisory.cwe?.length ? <Paragraph>CWE: {advisory.cwe.join(', ')}</Paragraph> : null}
                {advisory.cvss?.score ? <Paragraph>CVSS: {advisory.cvss.score}</Paragraph> : null}
                {advisory.url ? (
                  <Button size="small" type="link" onClick={() => window.electronAPI.openExternal(advisory.url!)}>
                    {t('security.viewAdvisory')}
                  </Button>
                ) : null}
              </Card>
            ))}
          </Space>
        )}
      </Modal>
    </>
  )
}

function normalizeAdvisories(via: any, t: (key: TranslationKey) => string): AuditAdvisory[] {
  if (!Array.isArray(via)) return []
  return via
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => ({
      title: item.title || item.name || t('security.securityIssue'),
      severity: item.severity,
      range: item.range,
      url: item.url,
      cwe: item.cwe,
      cvss: item.cvss
    }))
}

function stringifyVia(via: any): string {
  if (Array.isArray(via)) {
    return via.map((item) => typeof item === 'string' ? item : item.title || item.name).filter(Boolean).join(', ')
  }
  return typeof via === 'string' ? via : ''
}
