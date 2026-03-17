export type FSNode = {
  name: string
  children?: FSNode[]
}

//SaveFile
export type SaveFileOptions = {
  broadcastInfo?:string
  dev?:{
    source?:string
    message?:string
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
  isDialogCanceled?: Boolean
  dev?: {
    source?: string
    message?: string
  }
}
export type OpenFileCallback = (filePath: string | string[], content?: string | string[], details? : OpenFileDetails) => void

//FileService , emit all callbacks registered from renderer. Renderer using ipc to communicate to main process.
export class FileService{
  public static readonly OpenFileListeners: Map<string, OpenFileCallback> = new Map<string, OpenFileCallback>()
  public static readonly SaveFileListeners: Map<string, SaveFileCallback> = new Map<string, SaveFileCallback>()
  public static emitAfterRead(filePath: string | string[], content?: string | string[], details? : OpenFileDetails) {
    console.log(this.OpenFileListeners.size)
    this.OpenFileListeners.forEach((callback, _) => callback(filePath, content, details))
  }
  public static emitBeforeSave(details? : SaveFileDetails){
    this.SaveFileListeners.forEach((callback, _) => callback(details))
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
