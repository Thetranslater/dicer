import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

/** 窗口类型标识 */
export type WindowType = 'editor' | 'images' | 'settings'

/** 窗口元数据 */
interface WindowMeta {
  type: WindowType
  window: BrowserWindow
}

/**
 * 窗口池管理器
 * 统一管理项目中的所有窗口
 */
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

  /**
   * 注册窗口到池中
   */
  register(type: WindowType, window: BrowserWindow): void {
    this.windows.set(type, { type, window })

    // 监听窗口关闭，自动从池中移除
    window.on('closed', () => {
      this.windows.set(type, null)
    })
  }

  /**
   * 根据类型获取窗口
   */
  get(type: WindowType): BrowserWindow | null {
    const meta = this.windows.get(type)
    return meta?.window || null
  }

  /**
   * 检查窗口是否存在且未关闭
   */
  has(type: WindowType): boolean {
    const meta = this.windows.get(type)
    return meta !== null && meta !== undefined && !meta.window.isDestroyed()
  }

  /**
   * 关闭指定类型的窗口
   */
  close(type: WindowType): void {
    const window = this.get(type)
    if (window && !window.isDestroyed()) {
      window.close()
    }
  }

  /**
   * 关闭所有窗口
   */
  closeAll(): void {
    for (const [type] of this.windows) {
      this.close(type)
    }
  }

  /**
   * 获取所有活动窗口的类型
   */
  getActiveWindowTypes(): WindowType[] {
    const activeTypes: WindowType[] = []
    for (const [type, meta] of this.windows) {
      if (meta && !meta.window.isDestroyed()) {
        activeTypes.push(type)
      }
    }
    return activeTypes
  }

  /**
   * 创建新窗口（通用方法）
   */
  createWindow(type: WindowType, options: {
    width?: number
    height?: number
    title?: string
    htmlFile: string
  }): BrowserWindow {
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

    // 加载页面
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      // 开发模式：根据 htmlFile 名称加载对应页面
      const pageName = htmlFile.includes('images') ? 'images.html' : 'index.html'
      const baseUrl = process.env['ELECTRON_RENDERER_URL']
      window.loadURL(`${baseUrl}/${pageName}`)
    } else {
      window.loadFile(htmlFile)
    }

    // 注册到窗口池
    this.register(type, window)

    return window
  }
}

export const windowManager = WindowManager.getInstance()
