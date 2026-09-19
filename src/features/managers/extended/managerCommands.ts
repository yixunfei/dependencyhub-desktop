import { unwrapIpcResult } from '@shared/ipcFailure'
import type { IpcFailureEnvelope } from '@shared/ipcFailure'

type RawExecute = Window['electronAPI']['managers']['execute']
type RawRunCustom = Window['electronAPI']['managers']['runCustom']
// execute/runCustom return the raw failure envelope: contextBridge strips
// custom properties from thrown Errors, so the envelope must cross the bridge
// intact and be unwrapped here to keep failure/backup/restore details usable.
type UnwrappedResult = Exclude<Awaited<ReturnType<RawExecute>>, IpcFailureEnvelope>

export const managerCommands = {
  execute: async (...args: Parameters<RawExecute>): Promise<UnwrappedResult> =>
    unwrapIpcResult(await window.electronAPI.managers.execute(...args)) as UnwrappedResult,
  runCustom: async (...args: Parameters<RawRunCustom>): Promise<UnwrappedResult> =>
    unwrapIpcResult(await window.electronAPI.managers.runCustom(...args)) as UnwrappedResult
}
