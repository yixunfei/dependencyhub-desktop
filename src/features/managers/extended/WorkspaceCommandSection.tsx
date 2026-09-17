import React from 'react'
import { Button, Form, Input, Space, Typography, type FormInstance } from 'antd'
import { ExportOutlined, PlayCircleOutlined, RollbackOutlined } from '@ant-design/icons'
import type { DependencyManagerId } from '../../../domain/managers/registry'
import type { ManagerBackup } from '@shared/managerWorkspace'
import styles from './ExtendedManagerWorkspace.module.css'

const { Text } = Typography

export interface WorkspaceCommandSectionProps {
  /** False for managers executed by the local AI dependency engine, which reject shell commands. */
  customCommands: boolean
  activeManager: DependencyManagerId
  quickCommands: string[]
  commandPlaceholder: string
  form: FormInstance<{ commandLine: string }>
  running: boolean
  currentPath: string
  activeOperationId: string | null
  lastBackup: ManagerBackup | null
  restoring: boolean
  onRun: (commandLine: string | undefined) => void
  onCancel: () => void
  onRestore: () => void
}

/** Quick commands, custom command runner, and backup recovery actions for a manager workspace. */
const WorkspaceCommandSection: React.FC<WorkspaceCommandSectionProps> = ({
  customCommands,
  activeManager,
  quickCommands,
  commandPlaceholder,
  form,
  running,
  currentPath,
  activeOperationId,
  lastBackup,
  restoring,
  onRun,
  onCancel,
  onRestore
}) => (
  <>
    {customCommands && (
      <div className={styles.quickCommands}>
        <Text strong>Quick commands</Text>
        <Space wrap>
          {quickCommands.map((command) => (
            <Button key={command} size="small" onClick={() => onRun(command)} loading={running}>
              {activeManager} {command}
            </Button>
          ))}
        </Space>
      </div>
    )}

    <Form form={form} layout="vertical" onFinish={(values) => onRun(values.commandLine)}>
      {customCommands && (
        <Form.Item name="commandLine" label="Custom command">
          <Input placeholder={commandPlaceholder} />
        </Form.Item>
      )}
      <Space wrap>
        {customCommands && (
          <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={running} disabled={!currentPath}>
            Run command
          </Button>
        )}
        {running && activeOperationId && (
          <Button danger onClick={onCancel}>Cancel</Button>
        )}
        {lastBackup && (
          <>
            <Button icon={<ExportOutlined />} onClick={() => window.electronAPI.system.openFile(lastBackup.path)}>Open backup</Button>
            <Button danger icon={<RollbackOutlined />} onClick={onRestore} loading={restoring}>Restore backup</Button>
          </>
        )}
      </Space>
    </Form>
  </>
)

export default WorkspaceCommandSection
