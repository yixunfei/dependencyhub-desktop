import { bindHealthActions } from './actions/bindHealthActions'
import { buildHealthReportBlocks } from './healthReportCatalog'
import { useHealthDerived } from './useHealthDerived'
import { useHealthReportLoader } from './useHealthReportLoader'
import { useHealthState } from './useHealthState'

export function useHealthCenterModel() {
  const state = useHealthState()
  const derived = useHealthDerived(state)
  const reports = useHealthReportLoader(() => buildHealthReportBlocks(state, state.currentPath))
  const data = { ...state, ...derived, ...reports }
  return { ...data, ...bindHealthActions(data) }
}

export type HealthCenterModel = ReturnType<typeof useHealthCenterModel>
