import { ElectronAPI } from '@electron-toolkit/preload'
import type { AfterReadCallbackDetails } from '../renderer/src/utils/fileService'

type ImageManagerConfig = {
  rootPath: string | null
}

type ImageItem = {
  name: string
  path: string
  isDirectory: boolean
  createdTime: number
  modifiedTime: number
  size: number
}

type ImageDirResult = {
  rootPath: string
  currentPath: string
  items: ImageItem[]
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      saveFileSignal: (callback: () => void) => void
      saveFileImpl: (content: string, defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
      openFileSignal: (callback: (filePath: string | string[], content?: string | string[], details?: AfterReadCallbackDetails) => void) => void

      imagesGetConfig: () => Promise<ImageManagerConfig>
      imagesSelectRoot: () => Promise<string | null>
      imagesListDir: (directoryPath?: string) => Promise<ImageDirResult>
      imagesCreateFolder: (parentPath: string, folderName?: string) => Promise<string>
      imagesRename: (targetPath: string, nextName: string) => Promise<string>
      imagesMove: (sourcePath: string, targetDirectory: string) => Promise<string>
      imagesImportDialog: (targetDirectory: string) => Promise<string[]>
      imagesImportFiles: (targetDirectory: string, sourceFilePaths: string[]) => Promise<string[]>
    }
  }
}

export {}
