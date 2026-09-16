import { unwrapIpcResult } from '@shared/ipcFailure'

/** Reconstruct errors in the renderer, after both IPC and contextBridge have copied the data. */
export const managerCommands = {
  execute: async (...args: Parameters<Window['electronAPI']['managers']['execute']>) =>
    unwrapIpcResult(await window.electronAPI.managers.execute(...args)),
  runCustom: async (...args: Parameters<Window['electronAPI']['managers']['runCustom']>) =>
    unwrapIpcResult(await window.electronAPI.managers.runCustom(...args))
}
