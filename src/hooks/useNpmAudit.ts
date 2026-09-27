import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

/** Owns audit request lifetime so a closed or switched project cannot publish stale results. */
export function useNpmAudit(visible: boolean, projectPath: string, isGlobal: boolean) {
  const t = useT()
  const generation = useRef(0)
  const [loading, setLoading] = useState(false)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [auditError, setAuditError] = useState('')
  const runAudit = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    setAuditResult(null)
    setAuditError('')
    try {
      if (isGlobal) throw new Error(t('security.globalAuditUnsupported'))
      const result = await window.electronAPI.npm.audit(projectPath)
      if (request !== generation.current) return
      if (result?.error) throw new Error(result.error)
      if (!result?.vulnerabilities || !result?.metadata?.vulnerabilities) throw new Error(t('security.auditFailed'))
      setAuditResult(result)
    } catch (error) {
      if (request !== generation.current) return
      setAuditError(error instanceof Error ? error.message : String(error))
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [projectPath, isGlobal, t])

  useEffect(() => {
    setAuditResult(null)
    setAuditError('')
    setLoading(false)
    if (visible && (isGlobal || projectPath)) void runAudit()
    return () => { generation.current += 1 }
  }, [visible, projectPath, isGlobal, runAudit])

  return { loading, auditResult, auditError, runAudit }
}
