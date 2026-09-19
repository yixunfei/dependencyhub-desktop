import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import semver from 'semver'

export interface PackageInfo {
  name: string
  version: string
  latest?: string
  wanted?: string
  dependent?: string
  description?: string
  type?: 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies'
  outdated?: boolean
  homepage?: string
  license?: string
  size?: string
  fileCount?: number
  status?: 'installed' | 'missing' | 'invalid' | 'extraneous' | 'peer-conflict'
  problems?: string[]
}

interface CacheData {
  projectPackages: PackageInfo[]
  globalPackages: PackageInfo[]
  lastUpdate: number
  projectPath: string
}

interface PackageState {
  projectPackages: PackageInfo[]
  globalPackages: PackageInfo[]
  projectLoading: boolean
  globalLoading: boolean
  mutating: boolean
  projectError: string | null
  packageDetails: Record<string, any>
  cache: Record<string, CacheData>
  currentProjectPath: string

  setProjectPackages: (packages: PackageInfo[]) => void
  setGlobalPackages: (packages: PackageInfo[]) => void
  setPackageDetails: (name: string, details: any) => void
  setCurrentProjectPath: (path: string) => void
  
  getCache: (path: string) => CacheData | null
  setCache: (path: string, data: CacheData) => void
  clearCache: (path?: string) => void
  isCacheValid: (path: string) => boolean
  
  /** Resolves true when data was refreshed (or the request was superseded), false when the current refresh failed. */
  fetchProjectPackages: (projectPath: string, forceRefresh?: boolean) => Promise<boolean>
  fetchGlobalPackages: (forceRefresh?: boolean) => Promise<void>
  
  installPackage: (args: InstallArgs) => Promise<void>
  uninstallPackage: (args: UninstallArgs) => Promise<void>
  updatePackage: (args: UpdateArgs) => Promise<void>
  installSpecificVersion: (args: InstallVersionArgs) => Promise<void>
}

interface InstallArgs {
  packageName: string
  cwd?: string
  global?: boolean
  dev?: boolean
  version?: string
}

interface UninstallArgs {
  packageName: string
  cwd?: string
  global?: boolean
}

interface UpdateArgs {
  packageName?: string
  cwd?: string
  global?: boolean
  version?: string
}

interface InstallVersionArgs {
  packageName: string
  version: string
  cwd?: string
  global?: boolean
  dev?: boolean
}

const CACHE_EXPIRY = 5 * 60 * 1000 // 5分钟缓存过期
let projectRequestId = 0
// Separate counter: global refreshes race independently of project refreshes.
let globalRequestId = 0

function normalizeProjectPath(path: string): string {
  return path.trim().replace(/[\\/]+$/, '').toLowerCase()
}

function isCacheShape(value: unknown): value is Record<string, CacheData> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((entry) =>
    !!entry &&
    typeof entry === 'object' &&
    typeof (entry as CacheData).lastUpdate === 'number' &&
    Array.isArray((entry as CacheData).projectPackages) &&
    Array.isArray((entry as CacheData).globalPackages)
  )
}

async function fetchPackageDetailsBatch(packageNames: string[], batchSize = 5): Promise<Record<string, any>> {
  const results: Record<string, any> = {}
  
  for (let i = 0; i < packageNames.length; i += batchSize) {
    const batch = packageNames.slice(i, i + batchSize)
    const promises = batch.map(async (name) => {
      try {
        const info = await window.electronAPI.npm.getPackageInfo(name)
        const size = await window.electronAPI.npm.getPackageSize(name)
        return { name, info, size }
      } catch {
        return { name, info: null, size: null }
      }
    })
    
    const batchResults = await Promise.all(promises)
    for (const { name, info, size } of batchResults) {
      if (info) {
        results[name] = { ...info, size }
      }
    }
  }
  
  return results
}

export const usePackageStore = create<PackageState>()(
  persist(
    (set, get) => ({
      projectPackages: [],
      globalPackages: [],
      projectLoading: false,
      globalLoading: false,
      mutating: false,
      projectError: null,
      packageDetails: {},
      cache: {},
      currentProjectPath: '',

      setProjectPackages: (packages) => set({ projectPackages: packages }),
      setGlobalPackages: (packages) => set({ globalPackages: packages }),
      setPackageDetails: (name, details) => set((state) => ({
        packageDetails: { ...state.packageDetails, [name]: details }
      })),
      setCurrentProjectPath: (path) => set({ currentProjectPath: path }),
      
      getCache: (path) => {
        const state = get()
        return state.cache[normalizeProjectPath(path)] || null
      },
      
      setCache: (path, data) => set((state) => ({
        cache: { ...state.cache, [normalizeProjectPath(path)]: data }
      })),
      
      clearCache: (path) => {
        if (path) {
          set((state) => {
            const newCache = { ...state.cache }
            // Keys are stored normalized (see setCache), so removals must
            // normalize too or case/slash variants miss the entry.
            delete newCache[normalizeProjectPath(path)]
            return { cache: newCache }
          })
        } else {
          set({ cache: {} })
        }
      },
      
      isCacheValid: (path) => {
        const state = get()
        const cached = state.cache[normalizeProjectPath(path)]
        if (!cached) return false
        return Date.now() - cached.lastUpdate < CACHE_EXPIRY
      },
      
      fetchProjectPackages: async (projectPath: string, forceRefresh = false) => {
        const normalizedPath = normalizeProjectPath(projectPath)
        const requestId = ++projectRequestId
        const state = get()
        
        // 检查缓存
        if (!forceRefresh && state.isCacheValid(normalizedPath) && state.cache[normalizedPath]?.projectPackages) {
          const cached = state.cache[normalizedPath]
          set({
            projectPackages: cached.projectPackages,
            projectError: null,
            currentProjectPath: projectPath,
            // The cache hit returns instantly while a superseded request for
            // another project may still be in flight; its finally block would
            // skip resetting projectLoading (requestId already bumped), so the
            // loading state must be cleared here or the page spins forever.
            projectLoading: false
          })
          return true
        }
        
        set({ projectLoading: true, projectError: null, currentProjectPath: projectPath })
        
        try {
          const listResult = await window.electronAPI.npm.list(projectPath, false)
          if (requestId !== projectRequestId || normalizeProjectPath(get().currentProjectPath) !== normalizedPath) return true
          const outdatedResult = await window.electronAPI.npm.outdated(projectPath)
          
          const statuses = listResult.statuses || {}
          const packages: PackageInfo[] = []
          const allPackageNames: string[] = []
          for (const name of Object.keys(listResult.dependencies || {})) allPackageNames.push(name)
          
          if (listResult.dependencies) {
            Object.entries(listResult.dependencies).forEach(([name]: [string, any]) => {
              allPackageNames.push(name)
            })
          }
          
          if (listResult.devDependencies) {
            Object.entries(listResult.devDependencies).forEach(([name]: [string, any]) => {
              allPackageNames.push(name)
            })
          }
          
          // 分批并行获取详情
          const detailsMap = await fetchPackageDetailsBatch([...new Set(allPackageNames)], 10)
          
          if (listResult.dependencies) {
            Object.entries(listResult.dependencies).forEach(([name, info]: [string, any]) => {
              const outdated = outdatedResult[name]
              const details = detailsMap[name]
              const currentVersion = info.version
              const latestVersion = outdated?.latest || details?.version
              
              let isOutdated = !!outdated
              if (!isOutdated && currentVersion && latestVersion) {
                try {
                  isOutdated = semver.lt(currentVersion, latestVersion)
                } catch {
                }
              }
              
              packages.push({
                name,
                version: currentVersion,
                type: statuses[name]?.type || 'dependencies',
                status: statuses[name]?.status || 'installed',
                problems: statuses[name]?.problems,
                wanted: outdated?.wanted,
                latest: latestVersion,
                outdated: isOutdated,
                description: details?.description || '',
                homepage: details?.homepage,
                license: details?.license,
                size: details?.size?.prettySize,
                fileCount: details?.size?.fileCount
              })
            })
          }
          
          if (listResult.devDependencies) {
            Object.entries(listResult.devDependencies).forEach(([name, info]: [string, any]) => {
              const outdated = outdatedResult[name]
              const details = detailsMap[name]
              const currentVersion = info.version
              const latestVersion = outdated?.latest || details?.version
              
              let isOutdated = !!outdated
              if (!isOutdated && currentVersion && latestVersion) {
                try {
                  isOutdated = semver.lt(currentVersion, latestVersion)
                } catch {
                }
              }
              
              packages.push({
                name,
                version: currentVersion,
                type: 'devDependencies' as const,
                status: statuses[name]?.status || 'installed',
                problems: statuses[name]?.problems,
                wanted: outdated?.wanted,
                latest: latestVersion,
                outdated: isOutdated,
                description: details?.description || '',
                homepage: details?.homepage,
                license: details?.license,
                size: details?.size?.prettySize,
                fileCount: details?.size?.fileCount
              })
            })
          }
          
          const rows = Object.entries(listResult.statuses || {}) as Array<[string, any]>
          for (const [name, status] of rows) {
            if (packages.some((item) => item.name === name)) continue
            const info = listResult.dependencies?.[name] || {}
            packages.push({ name, version: info.version || '', type: status.type, status: status.status, problems: status.problems, outdated: false })
          }

          // 更新缓存
          get().setCache(projectPath, {
            projectPackages: packages,
            globalPackages: state.globalPackages,
            lastUpdate: Date.now(),
            projectPath
          })
          
          if (requestId === projectRequestId && normalizeProjectPath(get().currentProjectPath) === normalizedPath) {
            set({ projectPackages: packages, projectError: null })
          }
          return true
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error('Failed to fetch project packages:', error)
          if (requestId === projectRequestId && normalizeProjectPath(get().currentProjectPath) === normalizedPath) {
            const cached = get().cache[normalizeProjectPath(projectPath)]
            set({ projectPackages: cached?.projectPackages || [], projectError: message })
            // Callers like "refresh" / "check updates" must not report success
            // on failure; a superseded request stays silent because a newer
            // request owns the outcome.
            return false
          }
          return true
        } finally {
          if (requestId === projectRequestId) set({ projectLoading: false })
        }
      },
      
      fetchGlobalPackages: async (forceRefresh = false) => {
        const requestId = ++globalRequestId
        const state = get()

        // 全局包缓存键
        const globalCacheKey = '__global_packages__'

        if (!forceRefresh && state.isCacheValid(globalCacheKey) && state.cache[globalCacheKey]?.globalPackages) {
          const cached = state.cache[globalCacheKey]
          set({ globalPackages: cached.globalPackages })
          return
        }

        set({ globalLoading: true })

        try {
          const listResult = await window.electronAPI.npm.list('', true)
          if (requestId !== globalRequestId) return
          const outdatedResult = await window.electronAPI.npm.globalOutdated()
          if (requestId !== globalRequestId) return
          
          const packages: PackageInfo[] = []
          const allPackageNames: string[] = []
          for (const name of Object.keys(listResult.dependencies || {})) allPackageNames.push(name)
          
          if (listResult.dependencies) {
            Object.entries(listResult.dependencies).forEach(([name]: [string, any]) => {
              allPackageNames.push(name)
            })
          }
          
          // 分批并行获取详情
          const detailsMap = await fetchPackageDetailsBatch([...new Set(allPackageNames)], 10)
          if (requestId !== globalRequestId) return

          if (listResult.dependencies) {
            Object.entries(listResult.dependencies).forEach(([name, info]: [string, any]) => {
              const outdated = outdatedResult[name]
              const details = detailsMap[name]
              const currentVersion = info.version
              const latestVersion = outdated?.latest || details?.version

              let isOutdated = !!outdated
              if (!isOutdated && currentVersion && latestVersion) {
                try {
                  isOutdated = semver.lt(currentVersion, latestVersion)
                } catch {
                }
              }

              packages.push({
                name,
                version: currentVersion,
                wanted: outdated?.wanted,
                latest: latestVersion,
                outdated: isOutdated,
                description: details?.description || '',
                homepage: details?.homepage,
                license: details?.license,
                size: details?.size?.prettySize,
                fileCount: details?.size?.fileCount
              })
            })
          }
          
          const rows = Object.entries(listResult.statuses || {}) as Array<[string, any]>
          for (const [name, status] of rows) {
            if (packages.some((item) => item.name === name)) continue
            const info = listResult.dependencies?.[name] || {}
            packages.push({ name, version: info.version || '', type: status.type, status: status.status, problems: status.problems, outdated: false })
          }

          // 更新缓存
          if (requestId !== globalRequestId) return
          get().setCache(globalCacheKey, {
            projectPackages: [],
            globalPackages: packages,
            lastUpdate: Date.now(),
            projectPath: globalCacheKey
          })

          set({ globalPackages: packages })
        } catch (error) {
          console.error('Failed to fetch global packages:', error)
          // Rethrow only when still current: the "check updates" entry must not
          // report success on failure, while a superseded request stays silent.
          if (requestId === globalRequestId) throw error
        } finally {
          if (requestId === globalRequestId) set({ globalLoading: false })
        }
      },
      
      installPackage: async (args: InstallArgs) => {
        set({ mutating: true })
        try {
          await window.electronAPI.npm.install(args)
          if (args.global) {
            get().clearCache('__global_packages__')
            // The operation already succeeded; a failed background refresh
            // (fetchGlobalPackages rethrows) must not surface as a failure.
            await get().fetchGlobalPackages().catch(() => {})
          } else if (args.cwd) {
            get().clearCache(args.cwd)
            await get().fetchProjectPackages(args.cwd, true)
          }
        } catch (error) {
          console.error('Failed to install package:', error)
          throw error
        } finally {
          set({ mutating: false })
        }
      },
      
      uninstallPackage: async (args: UninstallArgs) => {
        set({ mutating: true })
        try {
          await window.electronAPI.npm.uninstall(args)
          if (args.global) {
            get().clearCache('__global_packages__')
            // Background refresh failure must not be reported as a failed uninstall.
            await get().fetchGlobalPackages().catch(() => {})
          } else if (args.cwd) {
            get().clearCache(args.cwd)
            await get().fetchProjectPackages(args.cwd, true)
          }
        } catch (error) {
          console.error('Failed to uninstall package:', error)
          throw error
        } finally {
          set({ mutating: false })
        }
      },
      
      updatePackage: async (args: UpdateArgs) => {
        set({ mutating: true })
        try {
          await window.electronAPI.npm.update(args)
          if (args.global) {
            get().clearCache('__global_packages__')
            // Background refresh failure must not be reported as a failed update.
            await get().fetchGlobalPackages().catch(() => {})
          } else if (args.cwd) {
            get().clearCache(args.cwd)
            await get().fetchProjectPackages(args.cwd, true)
          }
        } catch (error) {
          console.error('Failed to update package:', error)
          throw error
        } finally {
          set({ mutating: false })
        }
      },
      
      installSpecificVersion: async (args: InstallVersionArgs) => {
        set({ mutating: true })
        try {
          await window.electronAPI.npm.installVersion(args)
          if (args.global) {
            get().clearCache('__global_packages__')
            await get().fetchGlobalPackages().catch(() => {})
          } else if (args.cwd) {
            get().clearCache(args.cwd)
            await get().fetchProjectPackages(args.cwd, true)
          }
        } catch (error) {
          console.error('Failed to install specific version:', error)
          throw error
        } finally {
          set({ mutating: false })
        }
      }
    }),
    {
      name: 'package-storage',
      partialize: (state) => ({
        cache: state.cache,
        currentProjectPath: state.currentProjectPath
      }),
      // Persisted cache may be corrupted (null / non-object) in localStorage;
      // drop it instead of letting every fetch index into garbage.
      merge: (persisted, current) => {
        const persistedState = (persisted ?? {}) as Partial<PackageState>
        return { ...current, ...persistedState, cache: isCacheShape(persistedState.cache) ? persistedState.cache : {} }
      }
    }
  )
)
