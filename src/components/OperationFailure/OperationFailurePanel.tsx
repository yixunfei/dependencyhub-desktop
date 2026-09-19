import { useNavigate } from 'react-router-dom'
import { Alert, Button, Space, Tooltip } from 'antd'
import type { ManagerOperationFailure } from '@shared/managerWorkspace'
import { useT } from '../../i18n'
import { useCommandLogStore } from '../../stores/commandLogStore'
import { failureGuidance, type FailureActionKind } from './failureGuidance'

interface Props {
  failure?: ManagerOperationFailure | null
  /** Rendered when a manual retry makes sense for this failure. */
  onRetry?: () => void
  onRestoreBackup?: () => void
  /** Overrides the default navigation for an action. */
  onAction?: (kind: FailureActionKind) => void
}

/**
 * Shows why an operation failed and what the user can do next. Rather than
 * repeating the package manager's raw stderr, it leads with the cause and offers
 * the two or three actions that could actually unblock them.
 */
export function OperationFailurePanel({ failure, onRetry, onRestoreBackup, onAction }: Props) {
  const t = useT()
  const navigate = useNavigate()
  const guidance = failureGuidance(failure || undefined)

  if (!failure) return null

  const run = (kind: FailureActionKind) => {
    if (onAction) {
      onAction(kind)
      return
    }
    if (kind === 'openCommandLog') {
      useCommandLogStore.getState().setVisible(true)
      return
    }
    navigate(kind === 'openToolchain' ? '/environment' : '/settings')
  }

  return (
    <Alert
      type={guidance.tone}
      showIcon
      message={t(guidance.titleKey, guidance.params)}
      description={
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <span>{t(guidance.reasonKey, guidance.params)}</span>
          <span style={{ opacity: 0.75 }}>
            {t(failure.retryable ? 'failure.retryHint' : 'failure.noRetryHint')}
          </span>
          <Space wrap size={4}>
            {failure.retryable && onRetry && (
              <Button size="small" onClick={onRetry}>{t('failure.action.retry')}</Button>
            )}
            {onRestoreBackup && (
              <Button size="small" onClick={onRestoreBackup}>{t('failure.action.restoreBackup')}</Button>
            )}
            {guidance.actions.map(({ kind, labelKey }) => (
              <Button key={kind} size="small" type="link" onClick={() => run(kind)}>
                {t(labelKey)}
              </Button>
            ))}
          </Space>
          <Tooltip title={t('failure.operationId', { id: failure.operationId })}>
            <span style={{ opacity: 0.55, fontSize: 12 }}>
              {t('failure.operationId', { id: failure.operationId })}
            </span>
          </Tooltip>
        </Space>
      }
    />
  )
}

export default OperationFailurePanel
