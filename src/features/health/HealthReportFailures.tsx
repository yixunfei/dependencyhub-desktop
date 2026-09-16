import React from 'react'
import { Alert, Button, Space, Typography } from 'antd'
import type { ReportFailure } from './reportStatus'
import styles from './HealthCenter.module.css'

const { Text } = Typography

export interface HealthReportFailuresProps {
  failures: ReportFailure[]
  onRetry: (key: string) => void
  onRetryAll: () => void
}

export const HealthReportFailures: React.FC<HealthReportFailuresProps> = ({ failures, onRetry, onRetryAll }) => {
  if (failures.length === 0) return null

  return (
    <Alert
      type="warning"
      showIcon
      className={styles.reportFailures}
      title={`${failures.length} 个报告加载失败`}
      description={
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          {failures.map((failure) => (
            <Space key={failure.key} style={{ justifyContent: 'space-between', width: '100%' }} wrap>
              <span>
                <Text strong>{failure.label}</Text>
                <Text type="secondary"> — {failure.message}</Text>
              </span>
              <Button size="small" aria-label={`重试${failure.label}`} onClick={() => onRetry(failure.key)}>重试</Button>
            </Space>
          ))}
          <Button size="small" type="primary" ghost onClick={onRetryAll}>重试全部失败报告</Button>
        </Space>
      }
    />
  )
}
