// 文件操作服务 - 处理保存和加载逻辑 1-12 行（已完成，在今后任何对话中都不需要修改）
import { useEditorStore } from "../composables/useEditorStore"

const editorStore = useEditorStore()

const editorContentRequire = () => {
  const editor = editorStore.getEditor()
  const content = editor?.getHTML()
  if(content != null) window.api.saveFileImpl(content, undefined, [{name : 'HTML' ,extensions : ['.html']}])
}

window.api.saveFileSignal(editorContentRequire)

export type FSNode = {
  name: string
  children?: FSNode[]
}

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

export class OpenFileService{
  public static readonly OpenFileListeners: OpenFileCallback[] = []
  public static emitAfterRead(filePath: string | string[], content?: string | string[], details? : OpenFileDetails) {
    this.OpenFileListeners.forEach(callback => callback(filePath, content, details))
  }
}

export const setupMenuListeners = () => {
  window.api.openFileChannel((filePath: string | string[], content?: string | string[], details? : OpenFileDetails) => {
    OpenFileService.emitAfterRead(filePath, content, details)
  })
}
