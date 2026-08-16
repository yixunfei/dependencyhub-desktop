import type {
  ManagerHealthFinding,
  ManagerHealthReport,
  ManagerHealthSeverity
} from '../../shared/managerWorkspace'

export function createHealthFinding(
  id: string,
  severity: ManagerHealthSeverity,
  title: string,
  message: string,
  details: Partial<Pick<ManagerHealthFinding, 'packageName' | 'currentVersion' | 'fixedVersion' | 'source'>> = {}
): ManagerHealthFinding {
  return { id, severity, title, message, ...details }
}

export function appendHealthFindings(
  report: ManagerHealthReport,
  findings: ManagerHealthFinding[]
): ManagerHealthReport {
  const unique = [...new Map([...report.findings, ...findings].map((finding) => [finding.id, finding])).values()]
  const status = unique.some((finding) => finding.severity === 'error')
    ? 'error'
    : unique.length > 0
      ? 'warning'
      : 'healthy'
  return {
    ...report,
    status,
    summary: unique.length > 0 ? `${unique.length} manager health finding(s)` : report.summary,
    findings: unique
  }
}
