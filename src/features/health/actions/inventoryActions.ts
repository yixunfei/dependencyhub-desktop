import { type ImplementedPackageManagerId } from '../../../domain/managers/registry'
import type { HealthData } from '../healthData'

export async function scanManagerAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setScanning' | 'setScans'
>, managerId: ImplementedPackageManagerId) {
  const { t, currentPath, addNotification, setScanning, setScans } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setScanning(managerId)
  try {
    const result = await window.electronAPI.dependencyHealth.scan(managerId as PackageManagerId, currentPath)
    setScans((prev) => ({ ...prev, [managerId]: result }))
  } catch (error: unknown) {
    setScans((prev) => ({ ...prev, [managerId]: { error: error instanceof Error ? error.message : String(error) } }))
  } finally {
    setScanning('')
  }
}

export async function scanDetectedManagersAction(context: Pick<HealthData,
  't' | 'managers' | 'detectedIds' | 'addNotification' | 'currentPath' | 'setScanning' | 'setScans'
>) {
  const { t, managers, detectedIds, addNotification } = context
  const targets = managers.filter((manager) => detectedIds.has(manager.id))
  if (targets.length === 0) {
    addNotification({ type: 'info', message: t('health.noScannableEcosystem') })
    return
  }

  for (const manager of targets) {
    await scanManagerAction(context, manager.id)
  }
}

export async function exportInventoryAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification'>) {
  const { t, currentPath, addNotification } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  try {
    const filePath = await window.electronAPI.project.exportInventory(currentPath)
    addNotification({
      type: 'success',
      message: t('health.inventoryExported'),
      description: filePath
    })
    await window.electronAPI.system.openFile(filePath)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.inventoryExportFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  }
}

export async function exportSupplyChainAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setSupplyChainReport'
>, format: SupplyChainExportResult['format']) {
  const { t, currentPath, addNotification, setReporting, setSupplyChainReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'cyclonedx'
      ? await window.electronAPI.supplyChain.exportCycloneDx(currentPath)
      : format === 'spdx'
        ? await window.electronAPI.supplyChain.exportSpdx(currentPath)
        : await window.electronAPI.supplyChain.exportMarkdown(currentPath)
    addNotification({
      type: 'success',
      message: t('health.supplyChainExported'),
      description: `${result.format}: ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
    setSupplyChainReport(await window.electronAPI.supplyChain.report(currentPath))
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: t('health.supplyChainExportFailed'),
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportLicenseComplianceAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setLicenseReport'
>, format: LicenseComplianceExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setLicenseReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'json'
      ? await window.electronAPI.supplyChain.exportLicenseJson(currentPath)
      : await window.electronAPI.supplyChain.exportLicenseMarkdown(currentPath)
    addNotification({
      type: result.summary.policyViolationComponentCount > 0 ? 'warning' : 'success',
      message: 'License compliance matrix exported',
      description: `${result.licenseCount} license value(s), ${result.summary.policyViolationComponentCount} policy finding(s): ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
    setLicenseReport(await window.electronAPI.supplyChain.licenseReport(currentPath))
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'License compliance export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportThirdPartyNoticesAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setThirdPartyNotices' | 'setReportArtifactIndex'
>, format: ThirdPartyNoticeFormat = 'text') {
  const { t, currentPath, addNotification, setReporting, setThirdPartyNotices, setReportArtifactIndex } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'json'
      ? await window.electronAPI.thirdPartyNotices.exportJson(currentPath)
      : format === 'markdown'
        ? await window.electronAPI.thirdPartyNotices.exportMarkdown(currentPath)
        : await window.electronAPI.thirdPartyNotices.exportText(currentPath)
    addNotification({
      type: result.summary.policyViolationCount > 0 ? 'warning' : 'success',
      message: 'Third-party notices exported',
      description: `${result.noticeCount} notice(s), ${result.summary.unknownLicenseComponentCount} unknown license(s): ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
    const [noticeReport, artifacts] = await Promise.all([
      window.electronAPI.thirdPartyNotices.report(currentPath),
      window.electronAPI.reportArtifacts.report(currentPath).catch(() => null)
    ])
    setThirdPartyNotices(noticeReport)
    if (artifacts) setReportArtifactIndex(artifacts)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Third-party notice export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function checkRegistriesAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setRegistryReport' | 'setRegistryEndpoints' |
  'setReadinessReport'
>) {
  const { t, currentPath, addNotification, setReporting, setRegistryReport, setRegistryEndpoints, setReadinessReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.registryReachability.check(currentPath)
    setRegistryReport(result)
    setRegistryEndpoints(result.endpoints)
    setReadinessReport(await window.electronAPI.readiness.report(currentPath))
    addNotification({
      type: result.summary.unreachable > 0 ? 'warning' : 'success',
      message: 'Registry reachability checked',
      description: `${result.summary.reachable}/${result.summary.endpointCount} reachable; ${result.summary.unreachable} unreachable`
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Registry reachability check failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportRegistryReachabilityAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setRegistryReport' | 'setRegistryEndpoints'
>, format: RegistryReachabilityExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setRegistryReport, setRegistryEndpoints } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'json'
      ? await window.electronAPI.registryReachability.exportJson(currentPath)
      : await window.electronAPI.registryReachability.exportMarkdown(currentPath)
    addNotification({
      type: result.summary.unreachable > 0 ? 'warning' : 'success',
      message: 'Registry reachability report exported',
      description: `${result.summary.endpointCount} endpoint(s): ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
    const refreshed = await window.electronAPI.registryReachability.check(currentPath)
    setRegistryReport(refreshed)
    setRegistryEndpoints(refreshed.endpoints)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Registry reachability export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportCredentialUsageAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting'
>, format: CredentialUsageExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'json'
      ? await window.electronAPI.credentialUsage.exportJson(currentPath)
      : await window.electronAPI.credentialUsage.exportMarkdown(currentPath)
    addNotification({
      type: result.summary.missingCredentialEndpointCount > 0 || result.summary.insecureStorageEndpointCount > 0 ? 'warning' : 'success',
      message: 'Credential usage map exported',
      description: `${result.summary.endpointCount} endpoint(s), ${result.summary.missingCredentialEndpointCount} missing credential(s): ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Credential usage map export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportLockfileDriftAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting'
>, format: LockfileDriftExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'json'
      ? await window.electronAPI.lockfileDrift.exportJson(currentPath)
      : await window.electronAPI.lockfileDrift.exportMarkdown(currentPath)
    addNotification({
      type: result.summary.blocked > 0 ? 'warning' : 'success',
      message: 'Lockfile drift report exported',
      description: `${result.summary.workspaceCount} workspace(s), ${result.summary.findingCount} finding(s): ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Lockfile drift export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportRuntimePinningAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting'
>, format: RuntimePinningExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'json'
      ? await window.electronAPI.runtimePinning.exportJson(currentPath)
      : await window.electronAPI.runtimePinning.exportMarkdown(currentPath)
    addNotification({
      type: result.summary.blocked > 0 || result.summary.warning > 0 ? 'warning' : 'success',
      message: 'Runtime pinning report exported',
      description: `${result.summary.workspaceCount} workspace(s), ${result.summary.findingCount} finding(s): ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Runtime pinning export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportOfflineCacheReadinessAction(context: Pick<HealthData,
  't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setOfflineCacheReport'
>, format: OfflineCacheReadinessExportFormat = 'markdown') {
  const { t, currentPath, addNotification, setReporting, setOfflineCacheReport } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = format === 'json'
      ? await window.electronAPI.offlineCacheReadiness.exportJson(currentPath)
      : await window.electronAPI.offlineCacheReadiness.exportMarkdown(currentPath)
    addNotification({
      type: result.summary.blocked > 0 ? 'error' : result.summary.warning > 0 ? 'warning' : 'success',
      message: 'Offline cache readiness exported',
      description: `${result.summary.workspaceCount} workspace(s), ${result.summary.findingCount} finding(s): ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
    setOfflineCacheReport(await window.electronAPI.offlineCacheReadiness.report(currentPath))
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Offline cache readiness export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function diffDependencyComponentsAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyDiff'>) {
  const { t, currentPath, addNotification, setReporting, setDependencyDiff } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(currentPath)
    setDependencyDiff(result)
    if (!result) {
      addNotification({ type: 'info', message: t('health.noSnapshotToAnalyse') })
      return
    }

    addNotification({
      type: result.summary.criticalRisk + result.summary.highRisk > 0 ? 'warning' : 'success',
      message: 'Dependency risk diff completed',
      description: `${result.summary.added} added, ${result.summary.updated} updated, ${result.summary.removed} removed`
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency risk diff failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}

export async function exportDependencyDiffAction(context: Pick<HealthData, 't' | 'currentPath' | 'addNotification' | 'setReporting' | 'setDependencyDiff'>) {
  const { t, currentPath, addNotification, setReporting, setDependencyDiff } = context
  if (!currentPath) {
    addNotification({ type: 'warning', message: t('common.selectProjectFirst') })
    return
  }

  setReporting(true)
  try {
    const result = await window.electronAPI.supplyChain.exportDependencyDiffMarkdown(currentPath)
    addNotification({
      type: result.summary.criticalRisk + result.summary.highRisk > 0 ? 'warning' : 'success',
      message: 'Dependency risk report exported',
      description: `${result.changeCount} changes: ${result.path}`
    })
    await window.electronAPI.system.openFile(result.path)
    setDependencyDiff(await window.electronAPI.supplyChain.dependencyDiffLatestSnapshot(currentPath))
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      message: 'Dependency risk report export failed',
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    setReporting(false)
  }
}
