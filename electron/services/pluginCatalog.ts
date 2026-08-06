import { app } from 'electron'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  getImplementedManagerDefinitions,
  getManagerDetectionFiles,
  type DependencyManagerDefinition,
  type ImplementedPackageManagerId
} from '../../shared/managerRegistry'
import { checkTools, ToolName } from './toolchain'

export type PackageManagerId = ImplementedPackageManagerId

export interface PackageManagerPlugin {
  id: PackageManagerId
  name: string
  language: string
  packageManager: string
  tools: ToolName[]
  manifestFiles: string[]
  lockFiles: string[]
  capabilities: string[]
  scenarios: string[]
  builtIn: boolean
  enabled: boolean
  detected: boolean
  available: boolean
  version?: string
  configuredPath?: string
  message?: string
}

interface PluginState {
  disabled: PackageManagerId[]
}

const PLUGIN_DEFINITIONS = getImplementedManagerDefinitions()

export class PluginCatalogService {
  async catalog(projectPath?: string): Promise<PackageManagerPlugin[]> {
    const [globalState, projectState, statuses] = await Promise.all([
      readState(globalStatePath()),
      projectPath ? readState(projectStatePath(projectPath)) : Promise.resolve({ disabled: [] }),
      checkTools(projectPath)
    ])

    const disabled = new Set<PackageManagerId>([...globalState.disabled, ...projectState.disabled])
    const statusMap = new Map(statuses.map((status) => [status.tool, status]))

    return await Promise.all(PLUGIN_DEFINITIONS.map(async (definition) => {
      const tools = toToolNames(definition)
      const toolStatuses = tools.map((tool) => statusMap.get(tool)).filter(Boolean)
      const primaryStatus = toolStatuses[0]
      const available = definition.id === 'native'
        ? toolStatuses.some((status) => status?.available)
        : tools.every((tool) => statusMap.get(tool)?.available)
      return {
        id: definition.id,
        name: definition.name,
        language: definition.language,
        packageManager: definition.packageManager,
        tools,
        manifestFiles: [...definition.manifestFiles],
        lockFiles: [...definition.lockFiles],
        capabilities: [...definition.capabilities],
        scenarios: [...definition.scenarios],
        builtIn: definition.builtIn,
        enabled: !disabled.has(definition.id),
        detected: projectPath ? await this.isDetected(definition.id, projectPath) : false,
        available,
        version: primaryStatus?.version,
        configuredPath: primaryStatus?.configuredPath,
        message: primaryStatus?.message
      }
    }))
  }

  async setEnabled(id: PackageManagerId, enabled: boolean, projectPath?: string): Promise<PackageManagerPlugin[]> {
    const targetPath = projectPath ? projectStatePath(projectPath) : globalStatePath()
    const state = await readState(targetPath)
    const disabled = new Set(state.disabled)

    if (enabled) {
      disabled.delete(id)
    } else {
      disabled.add(id)
    }

    await writeState(targetPath, { disabled: [...disabled] })
    return await this.catalog(projectPath)
  }

  async detected(projectPath: string): Promise<PackageManagerId[]> {
    const detected: PackageManagerId[] = []
    for (const definition of PLUGIN_DEFINITIONS) {
      if (await this.isDetected(definition.id, projectPath)) {
        detected.push(definition.id)
      }
    }
    return detected
  }

  private async isDetected(id: PackageManagerId, projectPath: string): Promise<boolean> {
    const definition = PLUGIN_DEFINITIONS.find((item) => item.id === id)
    if (!definition) return false
    for (const manifest of getManagerDetectionFiles(definition)) {
      try {
        await access(join(projectPath, manifest))
        return true
      } catch {
      }
    }
    return false
  }
}

function toToolNames(definition: Pick<DependencyManagerDefinition, 'tools'>): ToolName[] {
  return [...definition.tools] as ToolName[]
}

function globalStatePath(): string {
  return join(app.getPath('userData'), 'plugin-components.json')
}

function projectStatePath(projectPath: string): string {
  return join(projectPath, '.npmDesktopManager', 'plugin-components.json')
}

async function readState(filePath: string): Promise<PluginState> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf-8'))
    return {
      disabled: Array.isArray(parsed.disabled) ? parsed.disabled : []
    }
  } catch {
    return { disabled: [] }
  }
}

async function writeState(filePath: string, state: PluginState): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8')
}
