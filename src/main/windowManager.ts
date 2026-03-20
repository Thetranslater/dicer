import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

export type WindowType = 'editor' | 'images' | 'settings'

interface WindowMeta {
  type: WindowType
  window: BrowserWindow
}

class WindowManager {
  private static instance: WindowManager
  private windows: Map<WindowType, WindowMeta | null> = new Map()

  private constructor() {}

  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager()
    }
    return WindowManager.instance
  }

  register(type: WindowType, window: BrowserWindow): void {
    this.windows.set(type, { type, window })

    window.on('closed', () => {
      this.windows.set(type, null)
    })
  }

  get(type: WindowType): BrowserWindow | null {
    const meta = this.windows.get(type)
    return meta?.window || null
  }

  has(type: WindowType): boolean {
    const meta = this.windows.get(type)
    return meta !== null && meta !== undefined && !meta.window.isDestroyed()
  }

  close(type: WindowType): void {
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

  getAll() : WindowMeta[] {
    const metas : WindowMeta[] = []
    for (const [_, meta] of this.windows) {
      if (meta && !meta.window.isDestroyed()) {
        metas.push(meta)
      }
    }
    return metas
  }

  getActiveWindowTypes(): WindowType[] {
    const activeTypes: WindowType[] = []
    for (const [type, meta] of this.windows) {
      if (meta && !meta.window.isDestroyed()) {
        activeTypes.push(type)
      }
    }
    return activeTypes
  }

  createWindow(
    type: WindowType,
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

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const fileName = htmlFile.split(/[\\/]/).pop() ?? 'index.html'
      const pageName = ['index.html', 'images.html', 'settings.html'].includes(fileName)
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
}

export function broadcast(channel : string, ...args){
  const windows = windowManager.getAll()
  windows.forEach((meta) => {
    meta.window.webContents.send(channel, args)
  })
}

export const windowManager = WindowManager.getInstance()
