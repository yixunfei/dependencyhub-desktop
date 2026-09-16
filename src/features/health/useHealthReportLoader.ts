import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HealthReportLoader, type HealthReportBlock } from './reportBlocks'
import { collectReportFailures, createReportStatus, recordReportFailure, recordReportSuccess, type ReportStatusEntry } from './reportStatus'

export function useHealthReportLoader(buildBlocks: () => HealthReportBlock[]) {
  const loader = useMemo(() => new HealthReportLoader(), [])
  const buildRef = useRef(buildBlocks)
  buildRef.current = buildBlocks
  const blocksRef = useRef<HealthReportBlock[]>([])
  const [status, setStatus] = useState<Record<string, ReportStatusEntry>>({})
  const [loading, setLoading] = useState(false)
  const refreshId = useRef(0)
  const mounted = useRef(false)
  const mark = useCallback((key: string, state: 'ready' | 'error', error?: unknown) => {
    if (mounted.current) setStatus((previous) => state === 'ready'
      ? recordReportSuccess(previous, key) : recordReportFailure(previous, key, error))
  }, [])
  const loadOverview = useCallback(async () => {
    if (!mounted.current) return
    const id = ++refreshId.current
    loader.invalidate()
    const blocks = buildRef.current()
    blocksRef.current = blocks
    setLoading(true)
    setStatus(createReportStatus({}, blocks.map((block) => block.key), 'loading'))
    await Promise.all(blocks.map((block) => loader.load(block, mark)))
    if (mounted.current && id === refreshId.current) setLoading(false)
  }, [loader, mark])
  useEffect(() => {
    mounted.current = true
    void loadOverview()
    return () => {
      mounted.current = false
      refreshId.current += 1
      loader.invalidate()
    }
  }, [loadOverview, loader])
  const retryReport = async (key: string) => {
    const block = blocksRef.current.find((entry) => entry.key === key)
    if (!block || !mounted.current) return
    setStatus((previous) => createReportStatus(previous, [key], 'loading'))
    await loader.load(block, mark)
  }
  const failedReports = collectReportFailures(status, Object.fromEntries(
    blocksRef.current.map((block) => [block.key, block.label])
  ))
  const reloadFailedReports = async () => {
    await Promise.all(failedReports.map(({ key }) => retryReport(key)))
  }
  return { loading, loadOverview, failedReports, retryReport, reloadFailedReports }
}
