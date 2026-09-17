import type { ManagerCommandResult, ManagerDependency, ManagerHealthReport, ManagerOperationRequest } from '../../../../shared/managerWorkspace'
import { recoverCommandFailure } from '../../../services/commandRecovery'
import type { ExtendedManagerService } from '../../../services/extendedManager'
import { type AiManagerId, type AiMutationPlan, type AiOperationTemplate, createAiBackup } from './aiTypes'

export interface AiExecutorContext {
  cwd: string
  managerId: AiManagerId
  request: ManagerOperationRequest
  dryRun: boolean
  service: ExtendedManagerService
  inventory: (cwd: string) => Promise<ManagerDependency[]>
  health: (cwd: string) => Promise<ManagerHealthReport>
  plan: (cwd: string, request: ManagerOperationRequest) => Promise<AiOperationTemplate>
  lock: (cwd: string) => Promise<AiMutationPlan>
  mutate?: (cwd: string, request: ManagerOperationRequest) => Promise<AiMutationPlan>
}

/**
 * Runs an AI dependency operation locally. AI ecosystems have no package-manager CLI,
 * so the plan is executed by this engine: read-only operations re-scan the project and
 * mutating operations write the manifest or lock file through a backed-up atomic write.
 */
export async function executeAiOperation(context: AiExecutorContext): Promise<ManagerCommandResult> {
  const { cwd, managerId, request, dryRun, service } = context
  const template = await context.plan(cwd, request)
  if (template.requirements.length > 0) throw new Error(template.requirements.join('; '))

  const command = [template.tool, ...template.args].filter(Boolean).join(' ')

  if (!template.mutating) {
    return {
      managerId,
      command,
      stdout: await describeState(cwd, request, context),
      stderr: '',
      dryRun: false
    }
  }

  const mutation = request.operation === 'lock'
    ? await context.lock(cwd)
    : await (context.mutate?.(cwd, request) ?? Promise.reject(new Error(`${managerId} does not support ${request.operation} as a local mutation.`)))

  if (dryRun) {
    return {
      managerId,
      command,
      stdout: `dry-run: no file was changed (${mutation.files.join(', ')})\n`,
      stderr: '',
      dryRun: true
    }
  }

  const backup = await createAiBackup(cwd, managerId, command, mutation.files)
  try {
    const summary = await mutation.apply()
    return { managerId, command, stdout: summary, stderr: '', dryRun: false, backup }
  } catch (error) {
    return await recoverCommandFailure(error, backup, (path) => service.restoreBackup(cwd, path))
  }
}

async function describeState(cwd: string, request: ManagerOperationRequest, context: AiExecutorContext): Promise<string> {
  if (request.operation === 'audit') {
    const report = await context.health(cwd)
    const lines = [`${context.managerId} audit: ${report.status} - ${report.summary}`]
    for (const finding of report.findings) lines.push(`[${finding.severity}] ${finding.title}: ${finding.message}`)
    return `${lines.join('\n')}\n`
  }

  const dependencies = await context.inventory(cwd)
  const lines = [`${context.managerId} inventory: ${dependencies.length} entr${dependencies.length === 1 ? 'y' : 'ies'}`]
  for (const dependency of dependencies) {
    const detail = dependency.resolvedVersion || dependency.requestedVersion || dependency.source || ''
    lines.push(`- ${dependency.name}${detail ? ` (${detail})` : ''} [${dependency.type}] ${dependency.file}${dependency.status ? ` - ${dependency.status}` : ''}`)
  }
  return `${lines.join('\n')}\n`
}
