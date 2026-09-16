import type { HealthDerived } from './useHealthDerived'
import type { useHealthReportLoader } from './useHealthReportLoader'
import type { HealthState } from './useHealthState'

export type HealthData = HealthState & HealthDerived & ReturnType<typeof useHealthReportLoader>
