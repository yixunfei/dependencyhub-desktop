import React, { useEffect, useState } from 'react'
import { Alert, Button, Empty, Input, Table, Tag, Typography } from 'antd'
import { ExportOutlined, SearchOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { DependencyManagerId } from '../../../domain/managers/registry'
import { useAppStore } from '../../../stores/appStore'
import type {
  ManagerHealthReport,
  ManagerSearchResult
} from '@shared/managerWorkspace'
import styles from './ManagerDiagnosticsPanel.module.css'

const { Text } = Typography

interface ManagerDiagnosticsPanelProps {
  managerId: DependencyManagerId
  currentPath?: string
  searchSupported: boolean
  healthSupported: boolean
}

export const ManagerDiagnosticsPanel: React.FC<ManagerDiagnosticsPanelProps> = ({
  managerId,
  currentPath,
  searchSupported,
  healthSupported
}) => {
  if (!searchSupported && !healthSupported) return null
  return (
    <div className={styles.grid}>
      {searchSupported && <ManagerSearchPanel key={`search:${managerId}`} managerId={managerId} currentPath={currentPath} />}
      {healthSupported && <ManagerHealthPanel key={`health:${managerId}`} managerId={managerId} currentPath={currentPath} />}
    </div>
  )
}

interface ManagerPanelProps {
  managerId: DependencyManagerId
  currentPath?: string
}

const ManagerSearchPanel: React.FC<ManagerPanelProps> = ({ managerId, currentPath }) => {
  const addNotification = useAppStore((state) => state.addNotification)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ManagerSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const search = async (value: string) => {
    const text = value.trim()
    if (!text) return
    setSearching(true)
    try {
      setResults(await window.electronAPI.managers.search(currentPath, managerId, { text, limit: 20 }))
    } catch (error: any) {
      setResults([])
      addNotification({ type: 'error', message: `${managerId} registry search failed`, description: error.message })
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.title}><SearchOutlined /><Text strong>Registry search</Text></div>
      <Input.Search
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onSearch={search}
        loading={searching}
        enterButton="Search"
        placeholder="Package name or keywords"
      />
      <Table<ManagerSearchResult>
        dataSource={results}
        rowKey={(record) => `${record.managerId}:${record.name}:${record.version || ''}`}
        size="small"
        scroll={{ x: 520 }}
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No search results" /> }}
        columns={[
          { title: 'Package', dataIndex: 'name', key: 'name', render: (name: string) => <Text strong>{name}</Text> },
          { title: 'Version', dataIndex: 'version', key: 'version', width: 120, render: (version?: string) => version ? <Tag>{version}</Tag> : '-' },
          { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
          {
            title: '',
            key: 'open',
            width: 44,
            render: (_, record) => record.source
              ? <Button type="text" icon={<ExportOutlined />} title="Open package" onClick={() => window.electronAPI.openExternal(record.source!)} />
              : null
          }
        ]}
      />
    </section>
  )
}

const ManagerHealthPanel: React.FC<ManagerPanelProps> = ({ managerId, currentPath }) => {
  const addNotification = useAppStore((state) => state.addNotification)
  const [report, setReport] = useState<ManagerHealthReport | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => setReport(null), [currentPath, managerId])

  const checkHealth = async () => {
    if (!currentPath) return
    setChecking(true)
    try {
      setReport(await window.electronAPI.managers.health(currentPath, managerId))
    } catch (error: any) {
      setReport(null)
      addNotification({ type: 'error', message: `${managerId} health check failed`, description: error.message })
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}><SafetyCertificateOutlined /><Text strong>Manager health</Text></div>
        <Button icon={<SafetyCertificateOutlined />} onClick={checkHealth} loading={checking} disabled={!currentPath}>Check</Button>
      </div>
      {report && (
        <Alert
          showIcon
          type={report.status === 'error' ? 'error' : report.status === 'warning' ? 'warning' : 'success'}
          message={report.status}
          description={report.summary}
        />
      )}
      <Table
        dataSource={report?.findings || []}
        rowKey="id"
        size="small"
        scroll={{ x: 420 }}
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={report ? 'No health findings' : 'Health has not been checked'} /> }}
        columns={[
          {
            title: 'Severity',
            dataIndex: 'severity',
            key: 'severity',
            width: 100,
            render: (severity: string) => <Tag color={severity === 'error' ? 'red' : severity === 'warning' ? 'orange' : 'blue'}>{severity}</Tag>
          },
          { title: 'Finding', dataIndex: 'title', key: 'title', width: 220, render: (title: string) => <Text strong>{title}</Text> },
          { title: 'Details', dataIndex: 'message', key: 'message', ellipsis: true }
        ]}
      />
    </section>
  )
}

export default ManagerDiagnosticsPanel
