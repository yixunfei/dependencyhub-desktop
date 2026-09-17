import React, { useState, useEffect } from 'react'
import { Modal, Tabs, Descriptions, Tag, Spin, Tree, Alert, Button, Space, Collapse, Typography, Statistic, Row, Col, Card } from 'antd'
import {
  InfoCircleOutlined, CloudDownloadOutlined,
  FileTextOutlined, ApartmentOutlined, DownloadOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useT } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'

const { Panel } = Collapse
const { Text } = Typography

interface PackageDetailModalProps {
  visible: boolean
  packageName: string
  onClose: () => void
  onInstall?: (version?: string) => void
}

interface PackageInfo {
  name: string
  version: string
  description?: string
  author?: any
  license?: string
  homepage?: string
  repository?: any
  keywords?: string[]
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  time?: Record<string, string>
  maintainers?: any[]
}

export const PackageDetailModal: React.FC<PackageDetailModalProps> = ({
  visible,
  packageName,
  onClose,
  onInstall
}) => {
  const t = useT()
  const language = useSettingsStore((state) => state.language)
  const [loading, setLoading] = useState(false)
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null)
  const [sizeInfo, setSizeInfo] = useState<any>(null)
  const [dependencyTree, setDependencyTree] = useState<any>(null)
  const [readme, setReadme] = useState<string>('')
  const [dependents, setDependents] = useState<number>(0)
  const [downloads, setDownloads] = useState<any>(null)
  const [versions, setVersions] = useState<string[]>([])
  
  useEffect(() => {
    if (visible && packageName) {
      loadPackageInfo()
    }
  }, [visible, packageName])
  
  const loadPackageInfo = async () => {
    setLoading(true)
    try {
      const [info, size, tree, readmeContent, dependentsCount, downloadStats, versionList] = await Promise.all([
        window.electronAPI.npm.getPackageInfo(packageName),
        window.electronAPI.npm.getPackageSize(packageName),
        window.electronAPI.npm.getDependencyTree(packageName, undefined, 2),
        window.electronAPI.npm.getReadme(packageName),
        window.electronAPI.npm.getDependents(packageName),
        window.electronAPI.npm.downloadStats(packageName),
        window.electronAPI.npm.getVersions(packageName)
      ])
      
      setPackageInfo(info)
      setSizeInfo(size)
      setDependencyTree(tree)
      setReadme(readmeContent)
      setDependents(dependentsCount)
      setDownloads(downloadStats)
      setVersions(versionList)
    } catch (error) {
      console.error('Failed to load package info:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const convertToTreeData = (node: any): any => {
    if (!node) return null
    return {
      title: (
        <Space>
          <Tag color="blue">{node.name}</Tag>
          <Text type="secondary">v{node.version}</Text>
        </Space>
      ),
      key: `${node.name}@${node.version}`,
      children: node.dependencies?.map((dep: any) => convertToTreeData(dep)) || []
    }
  }
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  
  const renderDependencies = (deps: Record<string, string> | undefined, title: string) => {
    if (!deps || Object.keys(deps).length === 0) return null
    
    return (
      <div style={{ marginTop: 16 }}>
        <Text strong>{title}:</Text>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(deps).map(([name, version]) => (
            <Tag key={name}>{name}@{version}</Tag>
          ))}
        </div>
      </div>
    )
  }
  
  const TabItems = [
    {
      key: 'info',
      label: t('package.tabInfo'),
      icon: <InfoCircleOutlined />,
      children: (
        <Spin spinning={loading}>
          <Row gutter={16}>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title={t('package.installSize')}
                  value={sizeInfo?.prettySize || t('common.unknown')}
                  prefix={<DownloadOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title={t('package.fileCount')}
                  value={sizeInfo?.fileCount || 0}
                  suffix={t('package.filesSuffix')}
                />
              </Card>
            </Col>
          </Row>
          
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title={t('package.weeklyDownloads')}
                  value={downloads?.downloads || 0}
                  prefix={<CloudDownloadOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title={t('package.dependentCount')}
                  value={dependents}
                  suffix={t('package.projectsSuffix')}
                />
              </Card>
            </Col>
          </Row>
          
          <Descriptions bordered column={1} style={{ marginTop: 16 }} size="small">
            <Descriptions.Item label={t('package.columnName')}>{packageInfo?.name}</Descriptions.Item>
            <Descriptions.Item label={t('package.columnCurrentVersion')}>
              <Space>
                <Tag color="blue">v{packageInfo?.version}</Tag>
                <Text type="secondary">
                  {t('package.publishedAt', { date: formatDate(packageInfo?.time?.[packageInfo?.version || ''] || '') })}
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('package.descriptionLabel')}>
              {packageInfo?.description || t('common.noDescription')}
            </Descriptions.Item>
            <Descriptions.Item label={t('package.authorLabel')}>
              {typeof packageInfo?.author === 'string' 
                ? packageInfo.author 
                : packageInfo?.author?.name || t('common.unknown')}
            </Descriptions.Item>
            <Descriptions.Item label={t('package.licenseLabel')}>
              <Tag>{packageInfo?.license || t('common.unknown')}</Tag>
            </Descriptions.Item>
            {packageInfo?.homepage && (
              <Descriptions.Item label={t('package.homepageLabel')}>
                <a onClick={() => window.electronAPI.openExternal(packageInfo.homepage!)}>
                  {packageInfo.homepage}
                </a>
              </Descriptions.Item>
            )}
            {packageInfo?.repository && (
              <Descriptions.Item label={t('package.repositoryLabel')}>
                <a onClick={() => {
                  const url = typeof packageInfo.repository === 'string' 
                    ? packageInfo.repository 
                    : packageInfo.repository.url
                  window.electronAPI.openExternal(url.replace('git+', '').replace('.git', ''))
                }}>
                  {typeof packageInfo.repository === 'string' 
                    ? packageInfo.repository 
                    : packageInfo.repository.url}
                </a>
              </Descriptions.Item>
            )}
            {packageInfo?.keywords && packageInfo.keywords.length > 0 && (
              <Descriptions.Item label={t('package.keywordsLabel')}>
                <Space wrap>
                  {packageInfo.keywords.map((keyword) => (
                    <Tag key={keyword}>{keyword}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('package.maintainersLabel')}>
              <Space wrap>
                {packageInfo?.maintainers?.map((m, index) => (
                  <Tag key={index} color="green">{m.name || m}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          </Descriptions>
          
          {renderDependencies(packageInfo?.dependencies, t('package.runtimeDependencies'))}
          {renderDependencies(packageInfo?.devDependencies, t('package.devDependenciesLabel'))}
        </Spin>
      )
    },
    {
      key: 'versions',
      label: t('package.tabVersionHistory'),
      icon: <FileTextOutlined />,
      children: (
        <Spin spinning={loading}>
          <div style={{ marginBottom: 16 }}>
            <Text>{t('package.totalVersions', { count: versions.length })}</Text>
          </div>
          <Collapse accordion>
            {versions.slice(0, 20).map((version) => (
              <Panel 
                header={
                  <Space>
                    <Tag color={version === packageInfo?.version ? 'blue' : 'default'}>
                      v{version}
                    </Tag>
                    {packageInfo?.time?.[version] && (
                      <Text type="secondary">
                        {formatDate(packageInfo.time[version])}
                      </Text>
                    )}
                  </Space>
                }
                key={version}
              >
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Text>{t('package.versionLabel', { version })}</Text>
                  <Text type="secondary">
                    {t('package.publishedAtLabel', { date: formatDate(packageInfo?.time?.[version] || '') })}
                  </Text>
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={() => onInstall?.(version)}
                  >
                    {t('package.installThisVersion')}
                  </Button>
                </Space>
              </Panel>
            ))}
          </Collapse>
        </Spin>
      )
    },
    {
      key: 'dependencies',
      label: t('package.tabDependencyTree'),
      icon: <ApartmentOutlined />,
      children: (
        <Spin spinning={loading}>
          {dependencyTree?.dependencies?.length > 0 ? (
            <>
              <Alert
                title={t('package.directDependencyCount', { count: dependencyTree.dependencies.length })}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Tree
                treeData={[convertToTreeData(dependencyTree)]}
                defaultExpandAll
                showLine
              />
            </>
          ) : (
            <Alert
              title={t('package.noRuntimeDependencies')}
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
            />
          )}
        </Spin>
      )
    },
    {
      key: 'readme',
      label: 'README',
      icon: <FileTextOutlined />,
      children: (
        <Spin spinning={loading}>
          <div className="readme-content" style={{ 
            maxHeight: 400, 
            overflow: 'auto',
            padding: 16,
            background: 'var(--bg-tertiary, #252526)',
            borderRadius: 8
          }}>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {readme}
            </pre>
          </div>
        </Spin>
      )
    }
  ]
  
  return (
    <Modal
      title={
        <Space>
          <Tag color="blue">{packageName}</Tag>
          {sizeInfo?.prettySize && (
            <Tag color="green" icon={<DownloadOutlined />}>
              {sizeInfo.prettySize}
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.close')}</Button>
          <Button type="primary" onClick={() => onInstall?.()}>
            {t('package.installLatest')}
          </Button>
        </Space>
      }
      width={800}
    >
      <Tabs items={TabItems} />
    </Modal>
  )
}
