import { ipcMain } from 'electron'

import { DPath } from './path'
import { DRandom } from './random'
import { DFS } from './fs'
import { DAsset } from './asset'

import { configManager } from './configManager'
import { broadcast, windowManager } from './windowManager'


function normalizeSettingsRoute(route?: string): string {
  if (!route) return '/project'
  const trimmed = route.trim()
  if (!trimmed) return '/project'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
export function registerCoreIpcHandlers(): void {
  DPath.registerIPC()
  DRandom.resgisterIPC()
  DFS.registerIPC()
  DAsset.registerIPC()

  ipcMain.handle('sys:deleteconfig', (_e, moduleName: string) => {
    const deleted = configManager.delete(moduleName)
    broadcast('sys:onconfig', configManager.getAll())
    return deleted
  })

  ipcMain.handle('project:is-loaded', () => {
    return configManager.isLoaded()
  })

  ipcMain.handle('project:ready', () => {
    if (windowManager.has('launcher')) {
      const launcherWindow = windowManager.get('launcher')
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.close()
      }
    }

    if (windowManager.has('editor')) {
      const existingWindow = windowManager.get('editor')
      if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus()
        return
      }
    }

    windowManager.createWindow('editor')
  })

  ipcMain.handle('window:open-settings', async (_e, route?: string) => {
    const targetRoute = normalizeSettingsRoute(route)

    const existingWindow = windowManager.get('settings')
    const settingsWindow =
      existingWindow && !existingWindow.isDestroyed()
        ? existingWindow
        : windowManager.createWindow('settings', { focusIfExists: false })

    const navigate = () => {
      settingsWindow.webContents.send('settings:navigate', targetRoute)
      settingsWindow.focus()
    }

    if (settingsWindow.webContents.isLoadingMainFrame()) {
      settingsWindow.webContents.once('did-finish-load', navigate)
    } else {
      navigate()
    }
  })
}
