import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface IAPI {
  //signal:renderer process to main, channel: main to renderer process
  saveFileChannel: (callback: (details?) => void) => void
  saveFileSignal: (content: string | Buffer, options?) => void
  openFileChannel: (callback: (filePath: string | string[], content?: string | string[], details?) => void) => void
  openFileSignal:(options?) => void

  imagesGetFilePath: (file: File) => string
  imagesGetConfig: () => Promise<ImageManagerConfig>
  imagesSelectRoot: () => Promise<string | null>
  imagesSetRoot: (rootPath: string) => Promise<string>
  imagesGetAttachmentMappings: () => Promise<ImageAttachmentMappingsResult>
  imagesSaveAttachmentMappings: (mappings: Record<string, string>) => Promise<{ savedCount: number }>
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

export {}
