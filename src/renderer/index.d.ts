import { ElectronAPI } from '@electron-toolkit/preload'
import { FSNode } from '@renderer/utils/fileService'

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
  rand: (pseudo?: boolean, seed?: string | number) => number

  projectIsLoaded: () => Promise<boolean>
  projectReady: () => Promise<void>
  openSettingsWindow: (route?: string) => Promise<void>
  onSettingsNavigate: (callback: (route: string) => void) => () => void

  imagesSelectRoot: () => Promise<string | null>
  imagesGetAttachmentMappings: () => Promise<ImageAttachmentMappingsResult>
  imagesSaveAttachmentMappings: (mappings: Record<string, string>) => Promise<{ savedCount: number }>
  imagesCreateFolder: (parentPath: string, folderName?: string) => Promise<string>
  imagesImportDialog: (targetDirectory: string) => Promise<string[]>
  imagesImportFiles: (targetDirectory: string, sourceFilePaths: string[]) => Promise<string[]>

  //new modularized API
  fs: {
    open: (option?) => Promise<FSNode[]>
    save: (content, option?) => Promise<string[]>
    mkdir: (path, option?) => any
    rm: (paths: string[], option?) => any
    mv: (source, target, option?) => any
    rnm: (target, next, option?) => any
  }
  path: {
    normalize: (path) => any
    parent: (path) => any
  }
  cfg: {
    get: (module) => any
    set: (module, newconfig) => any
    initialize: (config) => any
  }
  imgr: {
    mkdefaultdir: (folder, name) => any
  }
  on: (callback: (ch, ...args) => void) => void
}

declare global {

  interface Window {
    electron: ElectronAPI
    api: IAPI
  }
}