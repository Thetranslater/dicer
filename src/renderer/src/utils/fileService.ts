export type FSNode = {
  path: string
  name: string
  isDir: boolean
  data?: any
  children?: FSNode[]
}

export type OpenOption = {
  isMultiselection?:boolean
  dialogOpenType?: 'file' | 'dir'
  fileOption?:{
    path?:string[]
    isLoad?:boolean
    dialogfilters?:{name: string, extensions: string[]}[]
  }
  dirOption?:{
    path?:string[]
    isRecursive?:boolean
  }
}

export type SaveOption = {
  path?:string[]
}

//SaveFile
export type SaveFileOptions = {
  path?:string
  broadcastInfo?:string
  isBinary?:boolean
  isMakedir?:boolean
  encoding?:string
  dialogfilters?: {name: string, extensions: string[]}[]
  dev?:{
    source?:string
    message?:string
  }
}

export type SaveFileDetails = {
  broadcastInfo?:string
  isDialogCanceled?:boolean
  savedPath?: string
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
  isMultiselection?: boolean
  broadcastInfo?: string
  dialogfilters?: {name: string, extensions: string[]}[]
  dialogProperties?: ("openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles" | "createDirectory" | "promptToCreate" | "noResolveAliases" | "treatPackageAsDirectory" | "dontAddToRecent")[]
  fileOption?:{
    path?:string[]
    isLoad?:boolean
    isMultiselection?:boolean
    dialogfilters?:{name: string, extensions: string[]}[]
  }
  dirOption?:{
    path?:string[]
    isRecursive?:boolean
  }
  
  dev?:{
    source?: string
    message?: string
  }
}
export type OpenFileDetails = {
  broadcastInfo?: string
  isDialogCanceled?: boolean
  dev?: {
    source?: string
    message?: string
  }
}
export type OpenFileCallback = (filePath: string | string[], content?: string | string[], details? : OpenFileDetails) => void
