import { watch, access, constants, type FSWatcher } from 'fs'
import { projectIdentity } from './projectIdentity'

export interface FileChangeEvent {
  type: string
  path: string
  file: string
}

type FileChangeCallback = (change: FileChangeEvent) => void

export const MANIFEST_FILES = [
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'Cargo.toml',
  'Cargo.lock',
  'go.mod',
  'go.sum',
  'Package.swift',
  'Podfile',
  'Podfile.lock',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'pubspec.yaml',
  'pubspec.lock',
  'deno.json',
  'deno.lock',
  'deno.jsonc',
  'bun.lock',
  'bun.lockb',
  'uv.lock',
  'poetry.lock',
  'Pipfile.lock',
  'environment.yml',
  'environment.yaml',
  'conda-lock.yml',
  'Package.resolved',
  'gradle.lockfile',
  'composer.json',
  'composer.lock',
  'Gemfile',
  'Gemfile.lock',
  'packages.lock.json',
  'CMakeLists.txt',
  'CMakePresets.json',
  'vcpkg.json',
  'conanfile.py',
  'conanfile.txt',
  'conan.lock',
  'Chart.yaml',
  'Chart.lock',
  'helmfile.yaml',
  '.terraform.lock.hcl'
]

const DEBOUNCE_MS = 250

export class FileWatcher {
  // One directory-level watcher per project root; a single debounce timer coalesces
  // rapid multi-file edits (for example a save that rewrites manifest + lock) into
  // a single refresh.
  private watchers = new Map<string, FSWatcher>()
  private requests = new Map<string, object>()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  // Identity keys may be lowercased/realpath'd, so remember the caller-visible path.
  private projectPaths = new Map<string, string>()

  async watchProject(projectPath: string, callback: FileChangeCallback): Promise<void> {
    this.unwatchProject(projectPath)
    // Windows exposes the same directory under case/alias variants; identity keys
    // keep one FSWatcher per real directory instead of duplicating listeners.
    const key = projectIdentity(projectPath)
    const request = {}
    this.requests.set(key, request)

    try {
      await new Promise<void>((resolve, reject) => {
        access(projectPath, constants.F_OK, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    } catch (error) {
      console.warn(`project directory not found at ${projectPath}, skipping watch`)
      return
    }

    if (this.requests.get(key) !== request) return
    try {
      // Directory-level watch also catches atomic-replace editors (write a temp file
      // then rename), which a single-file `change` watcher never sees.
      const watcher = watch(projectPath, { recursive: false }, (eventType, filename) => {
        const file = String(filename || '')
        if (!this.isRelevantFile(file)) return
        this.scheduleEmit(key, callback, { type: eventType || 'change', path: projectPath, file })
      })

      watcher.on('error', (error: unknown) => {
        console.error('Watcher error:', error)
      })

      this.watchers.set(key, watcher)
      this.projectPaths.set(key, projectPath)
    } catch (error) {
      console.error('Failed to watch project directory:', error)
    }
  }

  private isRelevantFile(filename: string): boolean {
    const base = filename.split(/[\\/]/).pop() || ''
    return !base || MANIFEST_FILES.includes(base) || /\.(csproj|fsproj|vbproj)$/.test(base)
  }

  private scheduleEmit(key: string, callback: FileChangeCallback, change: FileChangeEvent): void {
    const existing = this.debounceTimers.get(key)
    if (existing) clearTimeout(existing)
    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key)
      callback(change)
    }, DEBOUNCE_MS))
  }

  unwatchProject(projectPath: string): void {
    const key = projectIdentity(projectPath)
    this.requests.delete(key)
    const watcher = this.watchers.get(key)
    if (watcher) {
      watcher.close()
      this.watchers.delete(key)
    }
    this.projectPaths.delete(key)
    const timer = this.debounceTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(key)
    }
  }

  unwatchAll(): void {
    this.requests.clear()
    for (const watcher of this.watchers.values()) watcher.close()
    this.watchers.clear()
    this.projectPaths.clear()
    for (const timer of this.debounceTimers.values()) clearTimeout(timer)
    this.debounceTimers.clear()
  }

  watchedProjects(): string[] {
    // Report the caller-visible paths, not the lowercased/realpath identity
    // keys, so consumers can compare them with the paths they registered.
    return [...this.projectPaths.values()]
  }
}

export const fileWatcher = new FileWatcher()
