import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { OpenFileDetails, OpenFileOptions, SaveFileDetails } from '../renderer/src/utils/fileService'

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

// Custom APIs for renderer
const api = {
  // core
  saveFileChannel: (callback: (details?:SaveFileDetails) => void) => {
    ipcRenderer.on('sys:savefilec', (_event, details) => callback(details))
  },
  saveFileSignal: (content: string, defaultPath?: string, filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('sys:savefile', content, defaultPath, filters),

  openFileChannel: (callback: (filePath: string | string[], content?: string | string[], details?: OpenFileDetails) => void) => {
    ipcRenderer.on('sys:openfilec', (_event, filePath, content, details) => callback(filePath, content, details))
  },
  openFileSignal: (options?: OpenFileOptions) => ipcRenderer.send('sys:openfile', options),

  // Image manager module (module:function)
  imagesGetFilePath: (file : File) : string => webUtils.getPathForFile(file),
  imagesGetConfig: (): Promise<ImageManagerConfig> => ipcRenderer.invoke('images:get-config'),
  imagesSelectRoot: (): Promise<string | null> => ipcRenderer.invoke('images:select-root'),
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
