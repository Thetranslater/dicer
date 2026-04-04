import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { updateElectronApp } from 'update-electron-app'
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

updateElectronApp()

// 娴嬭瘯涓婁紶鍥剧墖
// function testUploadImage(): void {
//   const imagePath = join(__dirname, '../../test.jpg')
//   console.log('璇诲彇鍥剧墖璺緞:', imagePath)

//   const imageBuffer = readFileSync(imagePath)
//   console.log('鍥剧墖澶у皬:', imageBuffer.length, 'bytes')
//   const params = {
//     'v2': '1',
//     'func': 'upload',
//     'fid': '-447601',
//     'auth': '03b0912569b2c835462d396c6464a39f71a0008b8631051b8f34ab976a56',
//     'attachment_file1': imageBuffer.toString(),
//     'attachment_file1_dscp': 'test image',
//     'attachment_file1_url_utf8_name': encodeURIComponent('test.jpg'),
//   }
//   const baseUrl = 'https://img8.nga.cn/attach.php'
//   const url = new URL(baseUrl)
//   for (const key in params) {
//     if (key === 'attachment_file1') {
//       continue // 浜岃繘鍒舵暟鎹崟鐙锟?    }
//     url.searchParams.append(key, params[key as keyof typeof params])
//     }
//   }

//   const request = net.request({
//     method: 'POST',
//     protocol: 'https:',
//     url: 'https://bbs.nga.cn/index.php?lite=js',
//     headers: {
//       'Cookie': 'Hm_lvt_01c4614f24e14020e036f4c3597aa059=1774409549; HMACCOUNT=3866E0CF232BF660; __ad_cookie_mapping_tck_731=0527c107441bef0cc49db488585794dc; ngacn0comUserInfo=UIDIAIPI%09UIDIAIPI%0939%0939%09%0910%090%094%090%090%09192_20%2C130_10; ngaPassportUid=61903141; ngaPassportUrlencodedUname=UIDIAIPI; ngaPassportCid=X8uiqit3hkql9fnnmd7l461vjnvhpb65s1gomg7u; ngacn0comUserInfoCheck=c23f1e8669136a6c99d0649e751f6f7c; ngacn0comInfoCheckTime=1774411622; lastpath=/; lastvisit=1774423241; bbsmisccookies=%7B%22pv_count_for_insad%22%3A%7B0%3A-22%2C1%3A1774458088%7D%2C%22insad_views%22%3A%7B0%3A1%2C1%3A1774458088%7D%2C%22uisetting%22%3A%7B0%3A%22d%22%2C1%3A1774423541%7D%7D; Hm_lpvt_01c4614f24e14020e036f4c3597aa059=1774423242',
//       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
//       'Referer': 'https://nga.cn/',
//       'Accept': '*/*',
//       'Accept-Language': 'zh-CN,zh;q=0.9',
//       'Connection': 'keep-alive',
//       'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
//     }
//   })

//   request.on('response', (response) => {
//     console.log(`STATUS: ${response.statusCode}`)
//     console.log(`HEADERS: ${JSON.stringify(response.headers)}`)
//     let data = ''
//     response.on('data', (chunk) => {
//       data += chunk.toString()
//     })
//     response.on('end', () => {
//       console.log('涓婁紶鍝嶅簲:', data)
//     })
//   })

//   //request.write(fullBody)
//   request.end()
// }

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

  // 娉ㄥ唽鏈湴鏂囦欢鍗忚
  registerLocalProtocol()

  registerCoreIpcHandlers()
  registerImageManagerIpcHandlers()
  registerConfigManagerIpcHandlers()

  //Menu template
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
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



