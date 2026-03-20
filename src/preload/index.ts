import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type ImageManagerConfig = {
  rootPath: string | null
}

type ImageItem = {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

type ImageDirResult = {
  rootPath: string
  currentPath: string
  items: ImageItem[]
}

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
  // core
  saveFileChannel: (callback: (details?) => void) => {
    ipcRenderer.on('sys:savefilec', (_event, details) => callback(details))
  },
  saveFileSignal: (content: string | Buffer, options?) =>
    ipcRenderer.send('sys:savefile', content, options),
  openFileChannel: (callback: (filePath: string | string[], content?: string | string[], details?) => void) => {
    ipcRenderer.on('sys:openfilec', (_event, filePath, content, details) => callback(filePath, content, details))
  },
  openFileSignal: (options?) => ipcRenderer.send('sys:openfile', options),
  //core:config
  getConfig: (moduleName : string) => ipcRenderer.invoke('sys:getconfig',moduleName),
  onConfig:(callback: (projectConfig)=>void) =>{
    ipcRenderer.on('sys:onconfig', (_event, projectConfig)=>callback(projectConfig))
  },

  // Image manager module (module:function)
  imagesGetFilePath: (file : File) : string => webUtils.getPathForFile(file),
  imagesGetConfig: (): Promise<ImageManagerConfig> => ipcRenderer.invoke('images:get-config'),
  imagesSelectRoot: (): Promise<string | null> => ipcRenderer.invoke('images:select-root'),
  imagesSetRoot: (rootPath: string): Promise<string> => ipcRenderer.invoke('images:set-root', rootPath),
  imagesGetAttachmentMappings: (): Promise<ImageAttachmentMappingsResult> =>
    ipcRenderer.invoke('images:get-attachment-mappings'),
  imagesSaveAttachmentMappings: (mappings: Record<string, string>): Promise<{ savedCount: number }> =>
    ipcRenderer.invoke('images:save-attachment-mappings', mappings),
  //check-ListDir
  imagesListDir: (directoryPath?: string): Promise<ImageDirResult> => ipcRenderer.invoke('images:list-dir', directoryPath),
  imagesCreateFolder: (parentPath: string, folderName?: string): Promise<string> =>
    ipcRenderer.invoke('images:create-folder', parentPath, folderName),
  imagesRename: (targetPath: string, nextName: string): Promise<string> =>
    ipcRenderer.invoke('images:rename', targetPath, nextName),
  imagesMove: (sourcePath: string, targetDirectory: string): Promise<string> =>
    ipcRenderer.invoke('images:move', sourcePath, targetDirectory),
  imagesImportDialog: (targetDirectory: string): Promise<string[]> =>
    ipcRenderer.invoke('images:import-dialog', targetDirectory),
  imagesImportFiles: (targetDirectory: string, sourceFilePaths: string[]): Promise<string[]> =>
    ipcRenderer.invoke('images:import-files', targetDirectory, sourceFilePaths)
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
