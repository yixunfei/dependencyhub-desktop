import { access, readFile } from 'fs/promises'
import { join } from 'path'
import type { DependencyManagerDefinition } from '../../../../shared/managerRegistry'
import type {
  ManagerDependency,
  ManagerHealthFinding,
  ManagerHealthReport
} from '../../../../shared/managerWorkspace'
import { analyzeManagerHealth } from '../../staticHealth'
import type { NodeWorkspaceManagerId } from './nodeLockParsers'

const LOCK_FILES: Record<NodeWorkspaceManagerId, string[]> = {
  pnpm: ['pnpm-lock.yaml'],
  yarn: ['yarn.lock'],
  bun: ['bun.lock', 'bun.lockb']
}

export async function analyzeNodeManagerHealth(
  cwd: string,
  definition: DependencyManagerDefinition,
  dependencies: ManagerDependency[]
): Promise<ManagerHealthReport> {
  const managerId = definition.id as NodeWorkspaceManagerId
  const base = await analyzeManagerHealth(cwd, definition, dependencies)
  const findings = [...base.findings]
  const manifest = await readPackageManifest(cwd, findings)

  if (manifest) inspectPackageManagerDeclaration(managerId, manifest, findings)
  await inspectCompetingLockfiles(cwd, managerId, findings)
  if (managerId === 'bun') await inspectLegacyBunLock(cwd, findings)

  const uniqueFindings = uniqueById(findings)
  const status = uniqueFindings.some((item) => item.severity === 'error')
    ? 'error'
    : uniqueFindings.length > 0
      ? 'warning'
      : 'healthy'
  return {
    ...base,
    status,
    summary: uniqueFindings.length > 0
      ? `${uniqueFindings.length} Node manager health finding(s)`
      : `${dependencies.length} dependencies inspected without findings`,
    findings: uniqueFindings
  }
}

async function readPackageManifest(
  cwd: string,
  findings: ManagerHealthFinding[]
): Promise<Record<string, unknown> | null> {
  const path = join(cwd, 'package.json')
  const content = await readFile(path, 'utf-8').catch(() => '')
  if (!content) {
    findings.push(finding('manifest-missing', 'error', 'package.json is missing', 'Select a Node.js project root that contains package.json.'))
    return null
  }
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch (error: any) {
    findings.push(finding('manifest-invalid', 'error', 'package.json is invalid', error.message))
    return null
  }
  findings.push(finding('manifest-invalid', 'error', 'package.json is invalid', 'The manifest root must be a JSON object.'))
  return null
}

function inspectPackageManagerDeclaration(
  managerId: NodeWorkspaceManagerId,
  manifest: Record<string, unknown>,
  findings: ManagerHealthFinding[]
): void {
  const declaration = typeof manifest.packageManager === 'string' ? manifest.packageManager.trim() : ''
  if (!declaration) {
    findings.push(finding(
      'package-manager-unpinned',
      'warning',
      'Package manager is not pinned',
      `Add "packageManager": "${managerId}@<version>" so local and CI installs use the same CLI release.`
    ))
    return
  }

  const separator = declaration.lastIndexOf('@')
  const declaredManager = separator > 0 ? declaration.slice(0, separator) : declaration
  const declaredVersion = separator > 0 ? declaration.slice(separator + 1) : ''
  if (declaredManager.toLowerCase() !== managerId) {
    findings.push(finding(
      'package-manager-mismatch',
      'error',
      'Package manager declaration does not match the selected manager',
      `package.json declares ${declaration}, but this workspace is using ${managerId}.`
    ))
  } else if (!declaredVersion) {
    findings.push(finding('package-manager-version-missing', 'warning', 'Package manager version is not pinned', declaration))
  }
}

async function inspectCompetingLockfiles(
  cwd: string,
  managerId: NodeWorkspaceManagerId,
  findings: ManagerHealthFinding[]
): Promise<void> {
  const detected: string[] = []
  for (const file of [...LOCK_FILES.pnpm, ...LOCK_FILES.yarn, ...LOCK_FILES.bun]) {
    if (await access(join(cwd, file)).then(() => true).catch(() => false)) detected.push(file)
  }
  const expected = new Set(LOCK_FILES[managerId])
  const competing = detected.filter((file) => !expected.has(file))
  if (competing.length > 0) {
    findings.push(finding(
      'competing-lockfiles',
      'warning',
      'Competing Node lockfiles were detected',
      `Review and remove stale lockfiles before changing dependencies: ${competing.join(', ')}.`
    ))
  }
}

async function inspectLegacyBunLock(cwd: string, findings: ManagerHealthFinding[]): Promise<void> {
  const hasTextLock = await access(join(cwd, 'bun.lock')).then(() => true).catch(() => false)
  const hasBinaryLock = await access(join(cwd, 'bun.lockb')).then(() => true).catch(() => false)
  if (!hasTextLock && hasBinaryLock) {
    findings.push(finding(
      'binary-lockfile',
      'warning',
      'Bun uses a binary lockfile',
      'DependencyHub can inventory direct dependencies, but transitive lock evidence requires the text bun.lock format.'
    ))
  }
}

function finding(
  id: string,
  severity: ManagerHealthFinding['severity'],
  title: string,
  message: string
): ManagerHealthFinding {
  return { id, severity, title, message }
}

function uniqueById(findings: ManagerHealthFinding[]): ManagerHealthFinding[] {
  const seen = new Set<string>()
  return findings.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
