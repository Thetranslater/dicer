import { app, shell, BrowserWindow, ipcMain, Menu, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
// import { net } from 'electron'
// import { URL } from 'url'

import { windowManager} from './windowManager'
import {openFile, registerCoreIpcHandlers} from './core'
import { registerImageManagerIpcHandlers } from './imageManagerService'
import { OpenFileOptions } from '../renderer/src/utils/fileService'

// 注册本地文件协议
function registerLocalProtocol(): void {
  protocol.handle('app', async (request) => {
    let filePath = request.url.replace(/^app:\/\//, '')
    filePath = decodeURIComponent(filePath)
    // 还原 Windows 盘符中被浏览器去掉的冒号
    // 例如 C/User/... -> C:/Users/...
    filePath = filePath.replace(/^([A-Za-z])\/(.+)$/, '$1:/$2')
    const options : OpenFileOptions = {
      path : [filePath],
      behavior : 'content',
      dialogProperties : ['openFile'],
      dev:{
        source:'app protocol request',
        message: 'app protocol request'
      }
    }
    const result = await openFile(options)
    return new Response(result[1])
  })
}

// 测试上传图片
// function testUploadImage(): void {
//   const imagePath = join(__dirname, '../../test.jpg')
//   console.log('读取图片路径:', imagePath)

//   const imageBuffer = readFileSync(imagePath)
//   console.log('图片大小:', imageBuffer.length, 'bytes')
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
//       continue // 二进制数据单独处�?    }
//     url.searchParams.append(key, params[key as keyof typeof params])
//     }
//   }

//   const request = net.request({
//     method: 'POST',
//     protocol: 'https:',
//     url: url.toString(),
//     headers: {
//       'Cookie': 'Hm_lvt_6933ef97905336bef84f9609785bcc3d=1773319391; HMACCOUNT=7A2D040D741BF72F; ngacn0comUserInfo=UIDIAIPI%09UIDIAIPI%0939%0939%09%0910%090%094%090%090%09192_20%2C130_10; ngaPassportUid=61903141; ngaPassportUrlencodedUname=UIDIAIPI; ngaPassportCid=X8uiqit3hkql9fnnmd7l461vjnvhpb65s1gomg7u; HM_tbj=p9whnc%7C1kw.w0; lastpath=/thread.php?fid=-447601; ngacn0comUserInfoCheck=32a870d6e40ec6ffc4da228231236067; ngacn0comInfoCheckTime=1773323427; bbsmisccookies=%7B%22pv_count_for_insad%22%3A%7B0%3A-24%2C1%3A1773334830%7D%2C%22insad_views%22%3A%7B0%3A1%2C1%3A1773334830%7D%2C%22uisetting%22%3A%7B0%3A1%2C1%3A1773925337%7D%7D; Hm_lpvt_6933ef97905336bef84f9609785bcc3d=1773323480; lastvisit=1773323492',
//       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
//       //'Referer': 'https://ngabbs.com/post.php?action=new&fid=-447601',
//       'Origin': 'https://ngabbs.com',
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
//       console.log('上传响应:', data)
//     })
//   })

//   //request.write(fullBody)
//   request.end()
// }

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 创建菜单
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-file-new')
          }
        },
        {
          label: '打开...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
              try{
                const result = await openFile({
                  behavior: 'content',
                  isMultiselection: false,
                  broadcastInfo: 'menu-openfile',
                  dialogfilters: [{name: 'HTML',extensions: ['html', 'htm']}, {name:'JSON', extensions:['json']}],
                  dialogProperties: ['openFile'],
                  dev :{
                    source: 'menu-open-click',
                    message: '由菜单点击打开选项触发'
                  }
                })
                if (!result[2].isDialogCanceled){
                  const filePath = result[0]
                  const content = result[1]
                  mainWindow.webContents.send('sys:openfilec', filePath, content, result[2])
                }
              }
              catch (error){
                console.error('Error read file:', error)
              }
          }
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const details = {
              broadcastInfo: 'menu-savefile',
              dev:{
                source:'menu-save-click',
                message:'由菜单触发的保存'
              }
            }
            mainWindow.webContents.send('sys:savefilec', details)
          }
        },
        {
          label: '另存为..',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const details = {
              broadcastInfo: 'menu-saveas-bbs',
              dev: {
                source: 'menu-saveas-click',
                message: 'Save as NGA BBS'
              }
            }
            mainWindow.webContents.send('sys:savefilec', details)
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '图像管理',
      submenu: [
        {
          label: '打开图像管理窗口',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            createImagesWindow()
          }
        }
      ]
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Open Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            createSettingsWindow()
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 注册到窗口池
  windowManager.register('editor', mainWindow)
}

protocol.registerSchemesAsPrivileged([
  {
    scheme : 'app',
    privileges:{
      standard : true,
      secure : true,
      supportFetchAPI : true
    }
  }
])

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // 注册本地文件协议
  registerLocalProtocol()
  registerImageManagerIpcHandlers()
  registerCoreIpcHandlers()

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

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// 创建图像管理窗口
function createImagesWindow(): void {
  // 如果窗口已存在，则聚焦并返回
  if (windowManager.has('images')) {
    const existingWindow = windowManager.get('images')
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus()
      return
    }
  }

  windowManager.createWindow('images', {
    width: 800,
    height: 600,
    title: '图像管理',
    htmlFile: join(__dirname, '../renderer/images.html')
  })
}

function createSettingsWindow(): void {
  if (windowManager.has('settings')) {
    const existingWindow = windowManager.get('settings')
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus()
      return
    }
  }

  windowManager.createWindow('settings', {
    width: 980,
    height: 680,
    title: 'Settings',
    htmlFile: join(__dirname, '../renderer/settings.html')
  })
}

