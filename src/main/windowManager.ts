import { BrowserWindow, shell, Menu } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

import { DFS } from './fs'
import { configManager } from './configManager'
import { SaveOption } from '../renderer/src/utils/fileService'

interface BaseWindowOptions {
  width: number
  height: number
  title: string
  htmlFile: string
}

interface CreateWindowParams {
  focusIfExists?: boolean
  overrides?: Partial<BaseWindowOptions>
}

const MODULE_WINDOW_CONFIG: Record<string, BaseWindowOptions> = {
  editor: {
    width: 900,
    height: 670,
    title: '',
    htmlFile: join(__dirname, '../renderer/index.html')
  },
  images: {
    width: 800,
    height: 600,
    title: 'Images Manager',
    htmlFile: join(__dirname, '../renderer/images.html')
  },
  assets: {
    width: 980,
    height: 720,
    title: 'Asset Manager',
    htmlFile: join(__dirname, '../renderer/assets.html')
  },
  settings: {
    width: 980,
    height: 680,
    title: 'Settings',
    htmlFile: join(__dirname, '../renderer/settings.html')
  },
  launcher: {
    width: 620,
    height: 380,
    title: 'Launcher',
    htmlFile: join(__dirname, '../renderer/project-launcher.html')
  }
}

function focusExistingWindow(type: string): BrowserWindow | null {
  const existingWindow = windowManager.get(type)
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.focus()
    return existingWindow
  }
  return null
}

class WindowManager {
  private static instance: WindowManager
  private windows: Map<string, BrowserWindow | null> = new Map()

  private constructor() { }

  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager()
    }
    return WindowManager.instance
  }

  register(type: string, window: BrowserWindow): void {
    this.windows.set(type, window)

    window.on('closed', () => {
      if (type === 'settings') {
        const config = configManager.getAll()
        const option: SaveOption = {
          path: [join(config['root'], 'project.config.json')]
        }
        DFS.fsSave([JSON.stringify(config, null, 2)], option)
      }
      this.windows.set(type, null)
    })
  }
  get(type: string): BrowserWindow | null {
    const window = this.windows.get(type)
    return window ?? null
  }
  has(type: string): boolean {
    const window = this.windows.get(type)
    return window !== null && window !== undefined && !window.isDestroyed()
  }
  close(type: string): void {
    const window = this.get(type)
    if (window && !window.isDestroyed()) {
      window.close()
    }
  }
  closeAll(): void {
    for (const [type] of this.windows) {
      this.close(type)
    }
  }
  getAll(): BrowserWindow[] {
    const windows: BrowserWindow[] = []
    for (const [_, window] of this.windows) {
      if (window && !window.isDestroyed()) {
        windows.push(window)
      }
    }
    return windows
  }
  getActiveWindowTypes(): string[] {
    const activeTypes: string[] = []
    for (const [type, window] of this.windows) {
      if (window && !window.isDestroyed()) {
        activeTypes.push(type)
      }
    }
    return activeTypes
  }

  private _createWindow(
    type: string,
    options: {
      width?: number
      height?: number
      title?: string
      htmlFile: string
    }
  ): BrowserWindow {
    const { width = 900, height = 670, title = '', htmlFile } = options

    const window = new BrowserWindow({
      width,
      height,
      title,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    window.on('ready-to-show', () => {
      window.show()
    })

    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const fileName = htmlFile.split(/[\\/]/).pop() ?? 'index.html'
      const pageName = ['index.html', 'images.html', 'assets.html', 'settings.html', 'project-launcher.html'].includes(fileName)
        ? fileName
        : 'index.html'
      const baseUrl = process.env['ELECTRON_RENDERER_URL']
      window.loadURL(`${baseUrl}/${pageName}`)
    } else {
      window.loadFile(htmlFile)
    }

    this.register(type, window)

    return window
  }

  createWindow(module: string, params: CreateWindowParams = {}): BrowserWindow {
    const { focusIfExists = true, overrides = {} } = params

    if (focusIfExists) {
      const existingWindow = focusExistingWindow(module)
      if (existingWindow) {
        return existingWindow
      }
    }

    const windowOptions: BaseWindowOptions = {
      ...MODULE_WINDOW_CONFIG[module],
      ...overrides
    }

    const window = windowManager._createWindow(module, windowOptions)
    if (module !== 'editor' && process.platform !== 'darwin') {
      window.removeMenu()
      window.setMenuBarVisibility(false)
      window.setAutoHideMenuBar(true)
    }

    return window
  }
  setMenu(template) {
    const menu = Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[])
    Menu.setApplicationMenu(menu)
  }
}

export function broadcast(channel: string, ...args) {
  const windows = windowManager.getAll()
  windows.forEach((meta) => {
    meta.webContents.send('BUS_CHANNEL', channel, ...args)
  })
}

export const windowManager = WindowManager.getInstance()
