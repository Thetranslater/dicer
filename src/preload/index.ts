import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type ImageItem = {
  name: string
  path: string
  isDirectory: boolean
}

type ImageAttachmentMappingItem = {
  imagePath: string
  attachmentUrl: string
}

type ImageAttachmentMappingsResult = {
  rootPath: string | null
  items: ImageAttachmentMappingItem[]
}

type ProjectConfig = {
  [module: string]: any
}

// Custom APIs for renderer
const api = {
  // core
  saveFileChannel: (callback: (details?) => void) => {
    ipcRenderer.on('sys:savefilec', (_event, details) => callback(details))
  },
  saveFileSignal: (content: string | Buffer, options?) =>
    ipcRenderer.invoke('sys:savefile', content, options),
  openFileChannel: (callback: (filePath: string | string[], content?: any, details?) => void) => {
    ipcRenderer.on('sys:openfilec', (_event, filePath, content, details) => callback(filePath, content, details))
  },
  openFileSignal: (options?) => ipcRenderer.invoke('sys:openfile', options),
  /**
   * 删除一个（组）文件或文件夹
   */
  delete: (path : string | string[], options?: any)=> ipcRenderer.invoke('sys:delete', path, options),
  /**
   * 规范化一个路径，比如将D:\folder\..转成D:/
   */
  normalizePath: (path:string) : Promise<string>=>ipcRenderer.invoke('sys:normalizepath', path),
  /**
   * 获得父路径，当参数是根目录时(D:/或D:)返回NULL
   */
  parentPath: (path : string) : Promise<string | null> => ipcRenderer.invoke('sys:parentpath', path),
  /**
   * [0,1)随机数生成，可重新配置
   */
  rand: (pseudo?:boolean, seed?: string | number)=>ipcRenderer.invoke('sys:rand', pseudo, seed),

  //core:config
  /**
   * 根据模块名获取对应config。如果输入不存在的模块名或该模块尚未配置，则返回undefined
   */
  getConfig: (moduleName: string): Promise<any> => ipcRenderer.invoke('sys:getconfig', moduleName),
  loadProjectConfig: (configJson: Record<string, any>): Promise<ProjectConfig> =>
    ipcRenderer.invoke('sys:loadprojectconfig', configJson),
  setConfig: (moduleName: string, configJson: unknown): Promise<boolean> =>
    ipcRenderer.invoke('sys:setconfig', moduleName, configJson),
  deleteConfig: (moduleName: string): Promise<boolean> =>
    ipcRenderer.invoke('sys:deleteconfig', moduleName),
  onConfig: (callback: (projectConfig: ProjectConfig) => void) => {
    ipcRenderer.on('sys:onconfig', (_event, projectConfig)=>callback(projectConfig))
  },
  projectIsLoaded: (): Promise<boolean> => ipcRenderer.invoke('project:is-loaded'),
  projectReady: (): Promise<void> => ipcRenderer.invoke('project:ready'),
  openSettingsWindow: (route?: string): Promise<void> => ipcRenderer.invoke('window:open-settings', route),
  onSettingsNavigate: (callback: (route: string) => void): (() => void) => {
    const listener = (_event, route: string) => callback(route)
    ipcRenderer.on('settings:navigate', listener)
    return () => ipcRenderer.removeListener('settings:navigate', listener)
  },

  // Image manager module (module:function)
  imagesGetFilePath: (file : File) : string => webUtils.getPathForFile(file),
  imagesSelectRoot: (): Promise<string | null> => ipcRenderer.invoke('images:select-root'),
  imagesGetAttachmentMappings: (): Promise<ImageAttachmentMappingsResult> =>
    ipcRenderer.invoke('images:get-attachment-mappings'),
  imagesSaveAttachmentMappings: (mappings: Record<string, string>): Promise<{ savedCount: number }> =>
    ipcRenderer.invoke('images:save-attachment-mappings', mappings),
  //check-ListDir
  imagesListDir: (directoryPath: string): Promise<ImageItem[]> => ipcRenderer.invoke('images:listdir', directoryPath),
  imagesCreateFolder: (parentPath: string, folderName?: string): Promise<string> =>
    ipcRenderer.invoke('images:create-folder', parentPath, folderName),
  imagesRename: (targetPath: string, nextName: string): Promise<string> =>
    ipcRenderer.invoke('images:rename', targetPath, nextName),
  imagesMove: (sourcePath: string, targetDirectory: string): Promise<string> =>
    ipcRenderer.invoke('images:move', sourcePath, targetDirectory),
  imagesImportDialog: (targetDirectory: string): Promise<string[]> =>
    ipcRenderer.invoke('images:import-dialog', targetDirectory),
  imagesImportFiles: (targetDirectory: string, sourceFilePaths: string[]): Promise<string[]> =>
    ipcRenderer.invoke('images:import-files', targetDirectory, sourceFilePaths),

  //TODO
  on: (callback: (ch: string, ...args) => void) => ipcRenderer.on('BUS_CHANNEL', (event, ch, ...args)=>callback(ch, event, args))
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

