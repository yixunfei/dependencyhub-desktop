import { stat } from 'fs/promises'
import { basename, extname } from 'path'

/**
 * Extensions that Windows shell associations would execute rather than open.
 * Reports/manifests opened from the renderer are always user-visible text,
 * so blocking these keeps the shell.openPath IPC from becoming an
 * arbitrary-execution primitive if the renderer is ever compromised.
 */
const BLOCKED_EXECUTABLE_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.msi', '.msp', '.mst',
  '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.wsb',
  '.hta', '.jar', '.lnk', '.reg', '.cpl', '.gadget', '.url', '.inf', '.msix',
  '.appx', '.msu', '.settingcontent-ms', '.chm'
])

export async function assertSafeShellTarget(targetPath: string): Promise<void> {
  if (!targetPath || !targetPath.trim()) {
    throw new Error('A non-empty path is required')
  }

  if (/^(?:\\\\|\/\/)/.test(targetPath.trim())) {
    throw new Error('Refusing to open remote network paths')
  }

  // Windows strips trailing dots/spaces when it resolves a path, so
  // `payload.exe.` / `payload.exe ` must be normalized before both the stat and
  // the extension check, or they bypass the blacklist entirely.
  const normalizedPath = targetPath.trimEnd().replace(/[. ]+$/, '')
  const stats = await statIfExists(targetPath)
    || (normalizedPath !== targetPath ? await statIfExists(normalizedPath) : undefined)
  if (!stats) {
    // Missing paths fail naturally in shell.openPath; nothing to guard here.
    return
  }

  if (stats.isDirectory()) return

  const extension = extname(basename(normalizedPath || targetPath)).toLowerCase()
  if (BLOCKED_EXECUTABLE_EXTENSIONS.has(extension)) {
    throw new Error(`Refusing to open executable file: ${extension}`)
  }
}

async function statIfExists(path: string): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
  try {
    return await stat(path)
  } catch {
    return undefined
  }
}
