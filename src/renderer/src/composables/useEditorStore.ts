import { shallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'

// 使用 shallowRef 存储 editor 实例，避免深度响应
const editorInstance = shallowRef<Editor | null>(null)

export function useEditorStore() {
  // 设置 editor 实例
  const setEditor = (editor: Editor | null) => {
    editorInstance.value = editor
  }

  // 获取 editor 实例
  const getEditor = () => {
    return editorInstance.value
  }

  // 检查 editor 是否已初始化
  const isReady = () => {
    return editorInstance.value !== null
  }

  return {
    editor: editorInstance,
    setEditor,
    getEditor,
    isReady
  }
}
