import { ElectronAPI } from '@electron-toolkit/preload'
import type { OpenFileOptions, OpenFileDetails } from '../renderer/src/utils/fileService'

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

export interface IAPI {
  //signal:renderer process to main, channel: main to renderer process
  saveFileSignal: (callback: () => void) => void
  saveFileImpl: (content: string, defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  openFileChannel: (callback: (filePath: string | string[], content?: string | string[], details?: OpenFileDetails) => void) => void
  openFileSignal:(options? : OpenFileOptions) => void

  imagesGetConfig: () => Promise<ImageManagerConfig>
  imagesSelectRoot: () => Promise<string | null>
  imagesListDir: (directoryPath?: string) => Promise<ImageDirResult>
  imagesCreateFolder: (parentPath: string, folderName?: string) => Promise<string>
  imagesRename: (targetPath: string, nextName: string) => Promise<string>
  imagesMove: (sourcePath: string, targetDirectory: string) => Promise<string>
  imagesImportDialog: (targetDirectory: string) => Promise<string[]>
  imagesImportFiles: (targetDirectory: string, sourceFilePaths: string[]) => Promise<string[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IAPI
  }
}
