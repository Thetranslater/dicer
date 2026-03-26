import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface IAPI {
  //signal:renderer process to main, channel: main to renderer process
  saveFileChannel: (callback: (details?) => void) => void
  saveFileSignal: (content: string | Buffer, options?) => Promise<any>
  openFileChannel: (callback: (filePath: string | string[], content?: any, details?) => void) => void
  openFileSignal: (options?) => Promise<[string | string[], any, any]>
  delete: (path: string | string[], options? : any) => void
  normalizePath: (path : string) => Promise<string>
  parentPath: (path : string) => Promise<string | null>
  rand: (pseudo? : boolean, seed? : string | number) => number

  getConfig: (moduleName: string) => Promise<any>
  loadProjectConfig: (configJson: Record<string, any>) => Promise<ProjectConfig>
  setConfig: (moduleName: string, configJson: unknown) => Promise<boolean>
  deleteConfig: (moduleName: string) => Promise<boolean>
  onConfig: (callback: (projectConfig: ProjectConfig) => void) => void

  projectIsLoaded: () => Promise<boolean>
  projectReady: () => Promise<void>
  openSettingsWindow: (route?: string) => Promise<void>
  onSettingsNavigate: (callback: (route: string) => void) => () => void

  imagesGetFilePath: (file: File) => string
  imagesSelectRoot: () => Promise<string | null>
  imagesGetAttachmentMappings: () => Promise<ImageAttachmentMappingsResult>
  imagesSaveAttachmentMappings: (mappings: Record<string, string>) => Promise<{ savedCount: number }>
  imagesListDir: (directoryPath: string) => Promise<ImageItem[]>
  imagesCreateFolder: (parentPath: string, folderName?: string) => Promise<string>
  imagesRename: (targetPath: string, nextName: string) => Promise<string>
  imagesMove: (sourcePath: string, targetDirectory: string) => Promise<string>
  imagesImportDialog: (targetDirectory: string) => Promise<string[]>
  imagesImportFiles: (targetDirectory: string, sourceFilePaths: string[]) => Promise<string[]>

  //new modularized API
  fs: {
    open: (option?)=>any
    save: (content, option?)=>any
    mkdir: (path, option?)=>any
    rm: (path, option?)=>any
    mv: (source, target, option?)=>any
  }
  path: {
    normalize: (path)=>any
    parent: (path)=>any
  }
  config: {
    get: (module)=>any
    set: (module, newconfig)=>any

  }
  on: (callback: (ch, ...args)=>void)=>void
}

declare global {

  interface Window {
    electron: ElectronAPI
    api: IAPI
  }
}

export {}

