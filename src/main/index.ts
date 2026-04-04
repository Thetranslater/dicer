import { app, BrowserWindow, ipcMain, protocol, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import { electronApp, optimizer } from '@electron-toolkit/utils'
// import { net } from 'electron'
// import { URL } from 'url'

import { windowManager } from './windowManager'
import { DFS } from './fs'
import { registerCoreIpcHandlers } from './core'
import { registerImageManagerIpcHandlers } from './imageManagerService'
import type { OpenOption, SaveOption } from '../renderer/src/utils/fileService'
import { registerConfigManagerIpcHandlers } from './configManager'



// 娉ㄥ唽鏈湴鏂囦欢鍗忚
function registerLocalProtocol(): void {
  protocol.handle('app', async (request) => {
    let filePath = request.url.replace(/^app:\/\//, '')
    filePath = decodeURIComponent(filePath)
    // 杩樺師 Windows 鐩樼涓娴忚鍣ㄥ幓鎺夌殑鍐掑彿
    // 渚嬪 C/User/... -> C:/Users/...
    filePath = filePath.replace(/^([A-Za-z])\/(.+)$/, '$1:/$2')
    const options: OpenOption = {
      fileOption: {
        path: [filePath],
        isLoad: true,
        dialogfilters: [{ name: 'img', extensions: ['jpg', 'png', 'jpeg', 'gif', 'bmp', 'svg', 'tif'] }]
      }
    }
    const result = await DFS.fsOpen(options)
    return new Response(result[0].data as any)
  })
}

function setupAutoUpdate() {
  const { autoUpdater } = electronUpdater;

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['重启更新', '稍后'],
      defaultId: 0,
      message: '新版本已下载，是否重启安装？'
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.checkForUpdates()
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
])

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  setupAutoUpdate()

  registerLocalProtocol()

  registerCoreIpcHandlers()
  registerImageManagerIpcHandlers()
  registerConfigManagerIpcHandlers()

  //Menu template
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建...',
          click: () => {
            const option: SaveOption = {
              dialogfilters: [{ name: 'HTML', extensions: ['html', 'htm'] }, { name: 'JSON', extensions: ['json'] }]
            }
            const newPath = DFS.fsSave([''], option)
            if (newPath[0]?.length > 1) {
              const ooption: OpenOption = {
                dialogOpenType: 'file',
                fileOption: {
                  path: newPath,
                  isLoad: true,
                  dialogfilters: [{ name: 'HTML', extensions: ['html', 'htm'] }, { name: 'JSON', extensions: ['json'] }]
                }
              }
              const result = DFS.fsOpen(ooption)
              if (result.length === 1)
                windowManager.get('editor')?.webContents.send('BUS_CHANNEL', 'menu-open', result)
            }
          }
        },
        {
          label: '打开...',
          click: async () => {
            try {
              const option: OpenOption = {
                isMultiselection: false,
                dialogOpenType: 'file',
                fileOption: {
                  isLoad: true,
                  dialogfilters: [{ name: 'HTML', extensions: ['html', 'htm'] }, { name: 'JSON', extensions: ['json'] }]
                }
              }

              const result = DFS.fsOpen(option)
              if (result.length === 1) {
                windowManager.get('editor')?.webContents.send('BUS_CHANNEL', 'menu-open', result)
              }
            }
            catch (error) {
              console.error('Error read file:', error)
            }
          }
        },
        { type: 'separator' },
        {
          label: '保存',
          click: () => windowManager.get('editor')?.webContents.send('BUS_CHANNEL', 'menu-save')
        },
        {
          label: '另存为...',
          click: () => windowManager.get('editor')?.webContents.send('BUS_CHANNEL', 'menu-saveas')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '图像管理',
      submenu: [
        {
          label: '打开图像管理器',
          click: () => {
            windowManager.createWindow('images')
          }
        }
      ]
    },
    {
      label: '资产管理',
      submenu: [
        {
          label: '打开资产管理器',
          click: () => {
            windowManager.createWindow('assets')
          }
        }
      ]
    },
    {
      label: '设置',
      submenu: [
        {
          label: '打开设置窗口',
          click: () => {
            windowManager.createWindow('settings')
          }
        }
      ]
    }
  ]


  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  windowManager.createWindow('launcher')
  windowManager.setMenu(template)


  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) windowManager.createWindow('launcher')
  })

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})



