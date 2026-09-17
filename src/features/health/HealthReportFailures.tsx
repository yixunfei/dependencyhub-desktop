import React from 'react'
import { Alert, Button, Space, Typography } from 'antd'
import { useT } from '../../i18n'
import type { ReportFailure } from './reportStatus'
import styles from './HealthCenter.module.css'

const { Text } = Typography

export interface HealthReportFailuresProps {
  failures: ReportFailure[]
  onRetry: (key: string) => void
  onRetryAll: () => void
}

export const HealthReportFailures: React.FC<HealthReportFailuresProps> = ({ failures, onRetry, onRetryAll }) => {
  const t = useT()
  if (failures.length === 0) return null

  return (
    <Alert
      type="warning"
      showIcon
      className={styles.reportFailures}
      title={t('health.reportFailuresTitle', { count: failures.length })}
      description={
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          {failures.map((failure) => (
            <Space key={failure.key} style={{ justifyContent: 'space-between', width: '100%' }} wrap>
              <span>
                <Text strong>{failure.label}</Text>
                <Text type="secondary"> — {failure.message}</Text>
              </span>
              <Button size="small" aria-label={t('health.retryNamed', { label: failure.label })} onClick={() => onRetry(failure.key)}>{t('health.retry')}</Button>
            </Space>
          ))}
          <Button size="small" type="primary" ghost onClick={onRetryAll}>{t('health.retryAllFailed')}</Button>
        </Space>
      }
    />
  )
}
