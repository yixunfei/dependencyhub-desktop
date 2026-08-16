import { MANAGER_DEFINITIONS } from '../../shared/managerRegistry'
import { ExtendedManagerService } from '../services/extendedManager'
import type { ManagerAdapter } from './adapter'
import { ProfiledManagerAdapter } from './profiledAdapter'

export class LegacyManagerAdapter extends ProfiledManagerAdapter {}

export function createLegacyManagerAdapters(service: ExtendedManagerService): ManagerAdapter[] {
  return MANAGER_DEFINITIONS
    .filter((definition) => !definition.builtIn)
    .map((definition) => new LegacyManagerAdapter(definition, service))
}
