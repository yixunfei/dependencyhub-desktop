import {
  IMPLEMENTED_MANAGER_IDS,
  MANAGER_DEFINITIONS,
  formatManagerFiles,
  getImplementedManagerDefinitions,
  getManagerDefinition,
  getManagerDetectionFiles,
  getManagerRoute,
  getPlannedManagerDefinitions,
  type DependencyManagerDefinition,
  type DependencyManagerId,
  type FuturePackageManagerId,
  type ImplementedPackageManagerId,
  type ManagerCapability,
  type ManagerImplementationStatus,
  type ManagerScope
} from '@shared/managerRegistry'

export {
  IMPLEMENTED_MANAGER_IDS,
  MANAGER_DEFINITIONS,
  formatManagerFiles,
  getImplementedManagerDefinitions,
  getManagerDefinition,
  getManagerDetectionFiles,
  getManagerRoute,
  getPlannedManagerDefinitions,
  type DependencyManagerDefinition,
  type DependencyManagerId,
  type FuturePackageManagerId,
  type ImplementedPackageManagerId,
  type ManagerCapability,
  type ManagerImplementationStatus,
  type ManagerScope
}

export const implementedManagerRoutes = Object.fromEntries(
  getImplementedManagerDefinitions().map((manager) => [manager.id, manager.route || '/plugins'])
) as Record<PackageManagerId, string>
