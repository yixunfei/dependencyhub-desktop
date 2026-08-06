import { access, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  MANAGER_DEFINITIONS,
  getManagerDetectionFiles,
  type DependencyManagerDefinition,
  type DependencyManagerId,
  type ManagerCapability,
  type ManagerImplementationStatus
} from '../../shared/managerRegistry'

export interface ProjectManagerDetection {
  id: DependencyManagerId
  name: string
  language: string
  packageManager: string
  implemented: boolean
  status: ManagerImplementationStatus
  route?: string
  detected: boolean
  files: string[]
  capabilities: ManagerCapability[]
}

export interface ProjectInfo {
  path: string
  name: string
  version: string
  hasPackageJson: boolean
  hasRequirementsTxt: boolean
  hasPomXml: boolean
  hasCargoToml: boolean
  hasGradleBuild: boolean
  hasGoMod: boolean
  hasPubspecYaml: boolean
  hasNativeProject: boolean
  ecosystems: string[]
  detectedManagers: ProjectManagerDetection[]
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown'
}

export interface ProjectInventoryFile {
  managerId: DependencyManagerId
  role: 'manifest' | 'lock' | 'config'
  file: string
  path: string
  size: number
  modifiedAt: string
}

export interface ProjectInventory {
  generatedAt: string
  project: ProjectInfo
  managers: ProjectManagerDetection[]
  files: ProjectInventoryFile[]
  productionTools: Array<{
    managerId: DependencyManagerId
    name: string
    implemented: boolean
    tools: readonly string[]
    productionTools: readonly string[]
  }>
}

export class ProjectService {
  async detectProject(projectPath: string): Promise<ProjectInfo> {
    const detectedManagers = await this.detectManagers(projectPath)
    const info: ProjectInfo = {
      path: projectPath,
      name: '',
      version: '',
      hasPackageJson: false,
      hasRequirementsTxt: false,
      hasPomXml: false,
      hasCargoToml: false,
      hasGradleBuild: false,
      hasGoMod: false,
      hasPubspecYaml: false,
      hasNativeProject: false,
      ecosystems: [],
      detectedManagers,
      packageManager: 'npm'
    }

    info.hasRequirementsTxt = await this.exists(join(projectPath, 'requirements.txt'))
    info.hasPomXml = await this.exists(join(projectPath, 'pom.xml'))
    info.hasCargoToml = await this.exists(join(projectPath, 'Cargo.toml'))
    info.hasGradleBuild = await this.exists(join(projectPath, 'build.gradle'))
      || await this.exists(join(projectPath, 'build.gradle.kts'))
      || await this.exists(join(projectPath, 'settings.gradle'))
      || await this.exists(join(projectPath, 'settings.gradle.kts'))
    info.hasGoMod = await this.exists(join(projectPath, 'go.mod'))
    info.hasPubspecYaml = await this.exists(join(projectPath, 'pubspec.yaml'))
    info.hasNativeProject = await this.exists(join(projectPath, 'CMakeLists.txt'))
      || await this.exists(join(projectPath, 'vcpkg.json'))
      || await this.exists(join(projectPath, 'conanfile.txt'))
      || await this.exists(join(projectPath, 'conanfile.py'))

    try {
      await access(join(projectPath, 'package.json'))
      info.hasPackageJson = true
      
      const pkg = await this.readPackageJson(projectPath)
      info.name = pkg.name || ''
      info.version = pkg.version || ''
      
      if (await this.exists(join(projectPath, 'yarn.lock'))) {
        info.packageManager = 'yarn'
      } else if (await this.exists(join(projectPath, 'pnpm-lock.yaml'))) {
        info.packageManager = 'pnpm'
      } else if (await this.exists(join(projectPath, 'bun.lock')) || await this.exists(join(projectPath, 'bun.lockb'))) {
        info.packageManager = 'bun'
      } else if (await this.exists(join(projectPath, 'package-lock.json'))) {
        info.packageManager = 'npm'
      }
    } catch (error) {
      info.hasPackageJson = false
    }

    info.ecosystems = [
      info.hasPackageJson ? 'npm' : '',
      info.hasRequirementsTxt ? 'pip' : '',
      info.hasPomXml ? 'maven' : '',
      info.hasCargoToml ? 'cargo' : '',
      info.hasGradleBuild ? 'gradle' : '',
      info.hasGoMod ? 'go' : '',
      info.hasPubspecYaml ? 'flutter' : '',
      info.hasNativeProject ? 'native' : '',
      ...detectedManagers
        .filter((manager) => manager.detected)
        .map((manager) => manager.id)
    ].filter(Boolean)
    info.ecosystems = [...new Set(info.ecosystems)]

    return info
  }

  async readPackageJson(projectPath: string): Promise<any> {
    const content = await readFile(join(projectPath, 'package.json'), 'utf-8')
    return JSON.parse(content)
  }

  async writePackageJson(projectPath: string, content: any): Promise<void> {
    const jsonContent = JSON.stringify(content, null, 2)
    await writeFile(join(projectPath, 'package.json'), jsonContent, 'utf-8')
  }

  async inventory(projectPath: string): Promise<ProjectInventory> {
    const project = await this.detectProject(projectPath)
    const files: ProjectInventoryFile[] = []

    for (const manager of MANAGER_DEFINITIONS) {
      files.push(...await this.inspectFilePatterns(projectPath, manager, 'manifest', manager.manifestFiles))
      files.push(...await this.inspectFilePatterns(projectPath, manager, 'lock', manager.lockFiles))
      files.push(...await this.inspectFilePatterns(projectPath, manager, 'config', manager.configFiles || []))
    }

    return {
      generatedAt: new Date().toISOString(),
      project,
      managers: project.detectedManagers,
      files,
      productionTools: MANAGER_DEFINITIONS.map((manager) => ({
        managerId: manager.id,
        name: manager.name,
        implemented: manager.implemented,
        tools: manager.tools,
        productionTools: manager.productionTools
      }))
    }
  }

  async exportInventory(projectPath: string): Promise<string> {
    const inventory = await this.inventory(projectPath)
    const outputPath = join(projectPath, '.npmDesktopManager', 'dependency-inventory.json')
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, JSON.stringify(inventory, null, 2), 'utf-8')
    return outputPath
  }

  private async detectManagers(projectPath: string): Promise<ProjectManagerDetection[]> {
    return await Promise.all(MANAGER_DEFINITIONS.map(async (manager) => {
      const files = await this.existingPatternMatches(projectPath, getManagerDetectionFiles(manager))
      return {
        id: manager.id,
        name: manager.name,
        language: manager.language,
        packageManager: manager.packageManager,
        implemented: manager.implemented,
        status: manager.status,
        route: manager.route,
        detected: files.length > 0,
        files,
        capabilities: [...manager.capabilities]
      }
    }))
  }

  private async inspectFilePatterns(
    projectPath: string,
    manager: DependencyManagerDefinition,
    role: ProjectInventoryFile['role'],
    patterns: readonly string[]
  ): Promise<ProjectInventoryFile[]> {
    const matches = await this.existingPatternMatches(projectPath, patterns)
    const files: ProjectInventoryFile[] = []

    for (const file of matches) {
      const filePath = join(projectPath, file)
      const fileStat = await stat(filePath)
      files.push({
        managerId: manager.id,
        role,
        file,
        path: filePath,
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString()
      })
    }

    return files
  }

  private async existingPatternMatches(projectPath: string, patterns: readonly string[]): Promise<string[]> {
    const matches: string[] = []
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const directoryItems = await this.readRootDirectory(projectPath)
        const regex = wildcardToRegExp(pattern)
        matches.push(...directoryItems.filter((item) => regex.test(item)))
        continue
      }

      if (await this.exists(join(projectPath, pattern))) {
        matches.push(pattern)
      }
    }

    return [...new Set(matches)]
  }

  private async readRootDirectory(projectPath: string): Promise<string[]> {
    try {
      return await readdir(projectPath)
    } catch {
      return []
    }
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}
