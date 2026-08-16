import type {
  DependencyManagerId,
  ManagerImplementationStatus
} from './managerRegistry'

export const MANAGER_OPERATIONS = [
  'sync',
  'install',
  'remove',
  'update',
  'outdated',
  'audit',
  'tree',
  'list',
  'lock',
  'validate'
] as const

export type ManagerOperation = (typeof MANAGER_OPERATIONS)[number]

export type ManagerIntegrationKind =
  | 'package'
  | 'declarative'
  | 'automation'
  | 'build'
  | 'runtime'

export type ManagerRuntimePlatform = 'win32' | 'darwin' | 'linux'
export type ManagerRiskLevel = 'low' | 'medium' | 'high'

export interface ManagerCapabilityProfile {
  kind: ManagerIntegrationKind
  operations: ManagerOperation[]
  search: boolean
  health: boolean
  customCommands: boolean
  nativeDryRun: boolean
  networkAccess: boolean
  requiresElevation: boolean
  platforms: ManagerRuntimePlatform[]
}

export interface ManagerDescriptor {
  managerId: DependencyManagerId
  name: string
  language: string
  ecosystem: string
  packageManager: string
  status: ManagerImplementationStatus
  route?: string
  tools: string[]
  capabilities: ManagerCapabilityProfile
}

export interface ManagerDetection {
  id: DependencyManagerId
  name: string
  language: string
  packageManager: string
  status: ManagerImplementationStatus
  detected: boolean
  files: string[]
  tools: string[]
  route?: string
  capabilities: ManagerCapabilityProfile
}

export interface ManagerDependency {
  managerId: DependencyManagerId
  name: string
  version?: string
  requestedVersion?: string
  resolvedVersion?: string
  type: string
  scope?: string
  source?: string
  file: string
  direct?: boolean
  integrity?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface ManagerOperationRequest {
  operation: ManagerOperation
  packageName?: string
  version?: string
  dev?: boolean
  options?: Record<string, string | number | boolean>
}

export interface ManagerBackupFile {
  file: string
  hash: string
  size: number
}

export interface ManagerBackup {
  id: string
  managerId: DependencyManagerId
  projectPath: string
  createdAt: string
  mutating: boolean
  path: string
  files: ManagerBackupFile[]
}

export interface ManagerOperationPlan {
  managerId: DependencyManagerId
  managerName: string
  request: ManagerOperationRequest
  operation: ManagerOperation
  tool: string
  command: string
  args: string[]
  mutating: boolean
  dryRunSupported: boolean
  dryRunCommand?: string
  dryRunArgs?: string[]
  backupFiles: ManagerBackupFile[]
  warnings: string[]
  requirements: string[]
  requiresConfirmation: boolean
  riskLevel: ManagerRiskLevel
  generatedAt: string
}

export interface ManagerExecuteOptions {
  dryRun?: boolean
}

export interface ManagerCommandResult {
  managerId: DependencyManagerId
  command: string
  stdout: string
  stderr: string
  dryRun: boolean
  backup?: ManagerBackup
}

export interface ManagerRestoreResult {
  backupPath: string
  restoredCount: number
  restoredFiles: string[]
}

export interface ManagerSearchQuery {
  text: string
  limit?: number
  registry?: string
}

export interface ManagerSearchResult {
  managerId: DependencyManagerId
  name: string
  version?: string
  description?: string
  source?: string
  homepage?: string
  license?: string
  metadata?: Record<string, string | number | boolean | null>
}

export type ManagerHealthStatus = 'healthy' | 'warning' | 'error' | 'unavailable'
export type ManagerHealthSeverity = 'info' | 'warning' | 'error'

export interface ManagerHealthFinding {
  id: string
  severity: ManagerHealthSeverity
  title: string
  message: string
  packageName?: string
  currentVersion?: string
  fixedVersion?: string
  source?: string
}

export interface ManagerHealthReport {
  managerId: DependencyManagerId
  status: ManagerHealthStatus
  generatedAt: string
  summary: string
  findings: ManagerHealthFinding[]
  raw?: string
}
