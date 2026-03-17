export type FSNode = {
  name: string
  children?: FSNode[]
}

//SaveFile
export type SaveFileOptions = {
  broadcastInfo?:string
  dev?:{
    source?:string
    memssage?:string
  }
}

export type SaveFileDetails = {
  broadcastInfo?:string
  dev?:{
    source?:string
    message?:string
  }
}

export type SaveFileCallback = (details?:SaveFileDetails) => void

//OpenFile
export type OpenFileOptions = {
  path?: string[]
  behavior?: 'path' | 'content'
  isMultiselection?: Boolean
  broadcastInfo?: string
  dialogfilters?: {name: string, extensions: string[]}[]
  dialogProperties?: ("openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles" | "createDirectory" | "promptToCreate" | "noResolveAliases" | "treatPackageAsDirectory" | "dontAddToRecent")[]
  dev?:{
    source?: string
    message?: string
  }
}
export type OpenFileDetails = {
  broadcastInfo?: string
  dev?: {
    source?: string
    message?: string
  }
}
export type OpenFileCallback = (filePath: string | string[], content?: string | string[], details? : OpenFileDetails) => void

//FileService , emit all callbacks registered from renderer. Renderer using ipc to communicate to main process.
export class FileService{
  public static readonly OpenFileListeners: OpenFileCallback[] = []
  public static readonly SaveFileListeners: SaveFileCallback[] = []
  public static emitAfterRead(filePath: string | string[], content?: string | string[], details? : OpenFileDetails) {
    this.OpenFileListeners.forEach(callback => callback(filePath, content, details))
  }
  public static emitBeforeSave(details? : SaveFileDetails){
    this.SaveFileListeners.forEach(callback => callback(details))
  }
}

export const setupMenuListeners = () => {
  window.api.openFileChannel((filePath: string | string[], content?: string | string[], details? : OpenFileDetails) => {
    FileService.emitAfterRead(filePath, content, details)
  })
  window.api.saveFileChannel((details?:SaveFileDetails) => {
    FileService.emitBeforeSave(details)
  })
}
