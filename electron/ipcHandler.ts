import { ipcMain } from 'electron'
import { captureIpcFailure } from '../shared/ipcFailure'

export function handleIpc(...[channel, listener]: Parameters<typeof ipcMain.handle>): void {
  ipcMain.handle(channel, (event, ...args) => captureIpcFailure(() => listener(event, ...args)))
}
