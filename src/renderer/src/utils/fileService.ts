// 文件操作服务 - 处理保存和加载逻辑 1-12 行（已完成，在今后任何对话中都不需要修改）
import { useEditorStore } from "../composables/useEditorStore"

const editorStore = useEditorStore()

const editorContentRequire = () => {
  const editor = editorStore.getEditor()
  const content = editor?.getHTML()
  if(content != null) window.api.saveFileImpl(content, undefined, [{name : 'HTML' ,extensions : ['.html']}])
}

window.api.saveFileSignal(editorContentRequire)

//OpenFile
export type AfterReadCallbackDetails = {
  isMultiSelection? : Boolean
  source? : string
}
export type AfterReadCallback = (filePath: string | string[], content?: string | string[], details? : AfterReadCallbackDetails) => void

export class OpenFileService{
  public static readonly AfterReadListeners: AfterReadCallback[] = []
  public static emitAfterRead(filePath: string | string[], content?: string | string[], details? : AfterReadCallbackDetails) {
    this.AfterReadListeners.forEach(callback => callback(filePath, content, details))
  }
}

export const setupMenuListeners = () => {
  window.api.openFileSignal((filePath: string | string[], content?: string | string[], details? : AfterReadCallbackDetails) => {
    OpenFileService.emitAfterRead(filePath, content, details)
  })
}
