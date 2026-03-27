import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type ImageAttachmentMappingItem = {
  imagePath: string
  attachmentUrl: string
}

type ImageAttachmentMappingsResult = {
  rootPath: string | null
  items: ImageAttachmentMappingItem[]
}

// Custom APIs for renderer
const api = {
  /**
   * [0,1)随机数生成，可重新配置
   */
  rand: (pseudo?: boolean, seed?: string | number) => ipcRenderer.invoke('sys:rand', pseudo, seed),

  projectIsLoaded: (): Promise<boolean> => ipcRenderer.invoke('project:is-loaded'),
  projectReady: (): Promise<void> => ipcRenderer.invoke('project:ready'),
  openSettingsWindow: (route?: string): Promise<void> => ipcRenderer.invoke('window:open-settings', route),
  onSettingsNavigate: (callback: (route: string) => void): (() => void) => {
    const listener = (_event, route: string) => callback(route)
    ipcRenderer.on('settings:navigate', listener)
    return () => ipcRenderer.removeListener('settings:navigate', listener)
  },

  // Image manager module (module:function)
  imagesGetFilePath: (file: File): string => webUtils.getPathForFile(file),
  imagesSelectRoot: (): Promise<string | null> => ipcRenderer.invoke('images:select-root'),
  imagesGetAttachmentMappings: (): Promise<ImageAttachmentMappingsResult> =>
    ipcRenderer.invoke('images:get-attachment-mappings'),
  imagesSaveAttachmentMappings: (mappings: Record<string, string>): Promise<{ savedCount: number }> =>
    ipcRenderer.invoke('images:save-attachment-mappings', mappings),
  imagesCreateFolder: (parentPath: string, folderName?: string): Promise<string> =>
    ipcRenderer.invoke('images:create-folder', parentPath, folderName),
  imagesRename: (targetPath: string, nextName: string): Promise<string> =>
    ipcRenderer.invoke('images:rename', targetPath, nextName),
  imagesImportDialog: (targetDirectory: string): Promise<string[]> =>
    ipcRenderer.invoke('images:import-dialog', targetDirectory),
  imagesImportFiles: (targetDirectory: string, sourceFilePaths: string[]): Promise<string[]> =>
    ipcRenderer.invoke('images:import-files', targetDirectory, sourceFilePaths),

  //TODO
  on: (callback: (ch: string, ...args) => void) => ipcRenderer.on('BUS_CHANNEL', (event, ch, ...args) => callback(ch, event, args)),
  fs: {
    open: (option?) => ipcRenderer.invoke('fs:open', option),
    save: (content: any[], option?) => ipcRenderer.invoke('fs:save', content, option),
    mv: (source: string, target: string, option?) => ipcRenderer.invoke('fs:mv', source, target, option),
    rm: (paths: string[], option?) => ipcRenderer.invoke('fs:rm', paths, option)
  },
  path: {
    /**
    * 规范化一个路径，比如将D:\folder\..转成D:/
    */
    normalize: (path: string): Promise<string> => ipcRenderer.invoke('path:normalize', path),
    /**
    * 获得父路径，当参数是根目录时(D:/或D:)返回NULL
    */
    parent: (path: string): Promise<string | null> => ipcRenderer.invoke('path:parent', path),
  },
  cfg: {
    /**
    * 根据模块名获取对应config。如果输入不存在的模块名或该模块尚未配置，则返回undefined
    */
    get: (module: string): Promise<any> => ipcRenderer.invoke('cfg:get', module),
    set: (module: string, configJson: unknown): Promise<boolean> => ipcRenderer.invoke('cfg:set', module, configJson),
    initialize: (config: Record<string, any>) => ipcRenderer.invoke('cfg:initialize', config)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

