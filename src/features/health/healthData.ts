import type { LabelTranslator } from '../../i18n'
import type { HealthDerived } from './useHealthDerived'
import type { useHealthReportLoader } from './useHealthReportLoader'
import type { HealthState } from './useHealthState'

// `t` is part of the context because actions run outside React and still need to
// label their notifications for the active language.
export type HealthData = HealthState & HealthDerived & ReturnType<typeof useHealthReportLoader> & { t: LabelTranslator }
