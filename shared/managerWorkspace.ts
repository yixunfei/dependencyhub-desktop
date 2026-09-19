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
  status?: 'installed' | 'missing' | 'invalid' | 'extraneous'
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
  plan?: ManagerOperationPlan
  /** Caller-supplied operation id so the UI can cancel the running command. */
  operationId?: string
}

/**
 * Failure outcomes shared by the main process classifier and the renderer.
 * The first five describe how the process ended; the rest describe why, so the
 * UI can offer the right remedy instead of repeating raw stderr.
 */
export type ManagerFailureCategory =
  | 'cancelled'
  | 'timeout'
  | 'output-limit'
  | 'exit-code'
  | 'unknown'
  | 'network'
  | 'certificate'
  | 'proxy'
  | 'permission'
  | 'toolchain-missing'
  | 'auth'
  | 'registry'
  | 'conflict'

/** Evidence gathered from the command output, used to fill the reason template. */
export interface OperationFailureEvidence {
  host?: string
  endpoint?: string
  statusCode?: number
  errorCode?: string
  tool?: string
  managerId?: DependencyManagerId
}

/** Why it failed, as a key plus parameters the renderer resolves with i18n. */
export interface OperationFailureReason {
  key: string
  params?: Record<string, string | number>
}

/** Structured failure every mutating operation rejects with, so the UI can offer retry / rollback. */
export interface ManagerOperationFailure {
  category: ManagerFailureCategory
  operationId: string
  message: string
  retryable: boolean
  reason?: OperationFailureReason
  evidence?: OperationFailureEvidence
  exitCode?: number | string
  backupPath?: string
}

export interface ManagerCommandResult {
  managerId: DependencyManagerId
  command: string
  stdout: string
  stderr: string
  dryRun: boolean
  backup?: ManagerBackup
  operationId?: string
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
