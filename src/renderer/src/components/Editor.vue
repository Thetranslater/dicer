<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import Image from '@tiptap/extension-image'
import { onBeforeUnmount, computed, onMounted, ref, watch } from 'vue'
import { FileService, OpenFileOptions, OpenFileDetails, SaveFileDetails, SaveFileOptions } from '../utils/fileService'
import { useEditorStore } from '../composables/useEditorStore'
import Dicer from './Dicer.vue'
import { htmlToNgaBBS } from '../utils/htmlToNgaBBS'

const { setEditor } = useEditorStore()

//#region 'var set'
const currentFilePath = ref<string | null>(null)
const editor = useEditor({
  extensions: [
    StarterKit,
    Subscript,
    Superscript,
    TextAlign.configure({
      types: ['heading', 'paragraph']
    }),
    TextStyleKit,
    Table.configure({
      resizable: true
    }),
    TableRow,
    TableHeader,
    TableCell,
    Details.configure({
      persist: false,
      HTMLAttributes: {
        class: 'details'
      }
    }),
    DetailsSummary,
    DetailsContent,
    Image.configure({
      resize: {
        enabled: true,
        directions: ['top', 'bottom', 'left', 'right'],
        minWidth: 50,
        minHeight: 50,
        alwaysPreserveAspectRatio: true
      }
    })
  ],
  content: '<p>欢迎使用安科编辑器...</p>',
})
const fontFamilies = [
  { label: '默认', value: 'default' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Arial Black', value: 'Arial Black' },
  { label: 'Book Antiqua', value: 'Book Antiqua' },
  { label: 'Century Gothic', value: 'Century Gothic' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Tahoma', value: 'Tahoma' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Script MT Bold', value: 'Script MT Bold' },
  { label: 'Stencil', value: 'Stencil' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Lucida Console', value: 'Lucida Console' }
]
const fontSizes = [
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
  { label: '36px', value: '36px' },
  { label: '48px', value: '48px' }
]
const colors = [
  { label: 'skyblue', value: 'skyblue' },
  { label: 'royalblue', value: 'royalblue' },
  { label: 'blue', value: 'blue' },
  { label: 'darkblue', value: 'darkblue' },
  { label: 'orange', value: 'orange' },
  { label: 'orangered', value: 'orangered' },
  { label: 'crimson', value: 'crimson' },
  { label: 'red', value: 'red' },
  { label: 'firebrick', value: 'firebrick' },
  { label: 'darkred', value: 'darkred' },
  { label: 'green', value: 'green' },
  { label: 'limegreen', value: 'limegreen' },
  { label: 'seagreen', value: 'seagreen' },
  { label: 'teal', value: 'teal' },
  { label: 'deeppink', value: 'deeppink' },
  { label: 'tomato', value: 'tomato' },
  { label: 'coral', value: 'coral' },
  { label: 'purple', value: 'purple' },
  { label: 'indigo', value: 'indigo' },
  { label: 'burlywood', value: 'burlywood' },
  { label: 'sandybrown', value: 'sandybrown' },
  { label: 'sienna', value: 'sienna' },
  { label: 'chocolate', value: 'chocolate' },
  { label: 'silver', value: 'silver' }
]
const showColorPalette = ref(false)
const colorPickerRef = ref<HTMLElement | null>(null)
//#endregion

//#region 'Ipc Callbacks'
const handleEditorSave = (details?: SaveFileDetails) => {
  if (!editor.value) return
  if (details?.broadcastInfo !== 'menu-savefile') return

  const options: SaveFileOptions = {
    broadcastInfo: 'menu-savefile',
    isBinary: false,
    encoding: 'utf-8',
    dialogfilters: [
      { name: 'HTML', extensions: ['html', 'htm'] }
    ],
    dev: {
      source: 'menu-save',
      message: '菜单保存，返回编辑器保存的HTML内容'
    }
  }

  const content = editor.value.getHTML()
  if (content !== null) {
    window.api.saveFileSignal(
      content,
      options
    )
  }
}

const handleEditorSaveAs = (details?: SaveFileDetails) => {
  if (!editor.value) return
  if (details?.broadcastInfo !== 'menu-saveas-bbs') return

  const options: SaveFileOptions = {
    broadcastInfo: 'menu-savefileas',
    isBinary: false,
    encoding: 'utf-8',
    dialogfilters: [
      { name: 'NGA BBS', extensions: ['bbs'] }
    ],
    dev: {
      source: 'menu-saveas',
      message: '菜单另存为，返回编辑器保存的bbs code内容'
    }
  }

  const html = editor.value.getHTML()
  const bbs = htmlToNgaBBS(html)
  window.api.saveFileSignal(bbs, options)
}

function IpcCallbackRegister() {
  FileService.OpenFileListeners.set('editor-opencontent', (filePath: string | string[], content?: string | string[], details?: OpenFileDetails) => {
    if (!editor.value) return
    if (details?.broadcastInfo !== 'menu-openfile' || details?.isDialogCanceled) return
    if (content) {
      const ext = (filePath as string).split('.').pop()?.toLowerCase()
      if (ext === 'json') {
        try {
          const json = JSON.parse(content as string)
          editor.value.commands.setContent(json)
          currentFilePath.value = filePath as string
        } catch (e) {
          console.error('Failed to parse JSON:', e)
        }
      } else if (ext === 'html' || ext === 'htm') {
        editor.value.commands.setContent(content as string)
        currentFilePath.value = filePath as string
      }
    }
  })
  //image insertion handler
  FileService.OpenFileListeners.set('editor-openimage', (filePath: string | string[], _content, details?: OpenFileDetails) => {
    console.log('reply2')
    if (!editor.value) return
    if (details?.broadcastInfo !== 'editor-insertimage' || details?.isDialogCanceled) return

    const imagePath = `app://${filePath}`
    editor.value.chain().focus().setImage({ src: imagePath }).run()
  })
  // saving signal from main process
  FileService.SaveFileListeners.set('editor-savecontent', handleEditorSave)
  FileService.SaveFileListeners.set('editor-saveas', handleEditorSaveAs)
}
//#endregion

onMounted(() => {
  IpcCallbackRegister()
  window.addEventListener('mousedown', handleGlobalMouseDown)
})

//#region 'basic function': bold, italic, font....
const currentFontFamily = computed(() => {
  return editor.value?.getAttributes('textStyle').fontFamily || 'default'
})

const currentFontSize = computed(() => {
  return editor.value?.getAttributes('textStyle').fontSize || ''
})

const currentColor = computed(() => {
  return editor.value?.getAttributes('textStyle').color || ''
})

const handleFontFamilyChange = (e: Event) => {
  const value = (e.target as HTMLSelectElement).value
  if (!editor.value) return
  if (value === 'default') {
    editor.value.chain().focus().unsetFontFamily().run()
  } else {
    editor.value.chain().focus().setFontFamily(value).run()
  }
}

const handleFontSizeChange = (e: Event) => {
  const value = (e.target as HTMLSelectElement).value
  if (!editor.value) return
  if (!value) {
    editor.value.chain().focus().unsetFontSize().run()
  } else {
    editor.value.chain().focus().setFontSize(value).run()
  }
}

const applyColor = (value: string) => {
  if (!editor.value) return
  if (currentColor.value === value) {
    editor.value.chain().focus().unsetColor().run()
  } else {
    editor.value.chain().focus().setColor(value).run()
  }
  showColorPalette.value = false
}

const toggleColorPalette = () => {
  showColorPalette.value = !showColorPalette.value
}

const handleGlobalMouseDown = (event: MouseEvent) => {
  if (!showColorPalette.value) return
  const target = event.target as Node | null
  if (colorPickerRef.value && target && colorPickerRef.value.contains(target)) return
  showColorPalette.value = false
}

// 处理格式按钮点击（只响应鼠标，键盘触发时 event.detail === 0）
const handleFormatButton = (event: MouseEvent, callback: () => void) => {
  if (event.detail === 0) return // 键盘触发，不执行
  callback()
}

const toggleBoldHandler = (event: MouseEvent) => {
  handleFormatButton(event, () => {
    editor.value?.chain().focus().toggleBold().run()
  })
}
//#endregion


const insertTable = () => {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}
const insertDetails = () => {
  editor.value?.chain().focus().setDetails().run()
}
const insertImage = () => {
  // 调用主进程打开图片对话框
  const options: OpenFileOptions = {
    behavior: 'path',
    isMultiselection: true,
    broadcastInfo: 'editor-insertimage',
    dialogProperties: ['openFile'],
    dev: {
      source: 'Editor.vue-insertImage',
      message: '编辑器插入图片'
    }
  }
  window.api.openFileSignal(options)
}

watch(editor, (newInstance) => {
  if (newInstance) {
    setEditor(newInstance)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleGlobalMouseDown)
  editor.value?.destroy()
})
</script>

<template>
  <div class="editor-container" v-if="editor">
    <!-- 工具栏-->
    <div class="toolbar">
      <!-- 文字格式 -->
      <div class="toolbar-group">
        <button @click="toggleBoldHandler" :class="{ active: editor.isActive('bold') }" title="加粗">
          B
        </button>
        <button @click="(e) => handleFormatButton(e, () => editor?.chain().focus().toggleItalic().run())"
          :class="{ active: editor.isActive('italic') }" title="斜体">
          I
        </button>
        <button @click="(e) => handleFormatButton(e, () => editor?.chain().focus().toggleUnderline().run())"
          :class="{ active: editor.isActive('underline') }" title="下划线">
          U
        </button>
      </div>

      <!-- 对齐 -->
      <div class="toolbar-group">
        <button @click="editor.chain().focus().setTextAlign('left').run()"
          :class="{ active: editor.isActive({ textAlign: 'left' }) }" title="左对齐">
          &#8676;
        </button>
        <button @click="editor.chain().focus().setTextAlign('center').run()"
          :class="{ active: editor.isActive({ textAlign: 'center' }) }" title="居中">
          &#8596;
        </button>
        <button @click="editor.chain().focus().setTextAlign('right').run()"
          :class="{ active: editor.isActive({ textAlign: 'right' }) }" title="右对齐">
          &#8677;
        </button>
        <button @click="editor.chain().focus().setTextAlign('justify').run()"
          :class="{ active: editor.isActive({ textAlign: 'justify' }) }" title="两端对齐">
          &#8780;
        </button>
      </div>

      <!-- 字体 -->
      <div class="toolbar-group">
        <select :value="currentFontFamily" @change="handleFontFamilyChange" title="字体">
          <option v-for="font in fontFamilies" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <!-- 骰子 -->
      <div class="toolbar-group">
        <Dicer />
      </div>

      <!-- 字号 -->
      <div class="toolbar-group">
        <select :value="currentFontSize" @change="handleFontSizeChange" title="字号">
          <option value="">字号</option>
          <option v-for="size in fontSizes" :key="size.value" :value="size.value">
            {{ size.label }}
          </option>
        </select>
      </div>

      <!-- 颜色 -->
      <div class="toolbar-group color-group" ref="colorPickerRef">
        <button type="button" class="color-trigger" @click="toggleColorPalette" title="颜色">
          <span class="color-preview" :style="{ backgroundColor: currentColor || '#ffffff' }"></span>
          <span class="color-arrow">▾</span>
        </button>

        <div v-show="showColorPalette" class="color-palette">
          <button v-for="color in colors" :key="color.value" type="button" class="color-swatch"
            :class="{ active: currentColor === color.value }" :style="{ backgroundColor: color.value }"
            :title="color.label" @click="applyColor(color.value)" />
        </div>
      </div>

      <!-- 标题 -->
      <div class="toolbar-group">
        <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
          :class="{ active: editor.isActive('heading', { level: 1 }) }" title="标题1">
          H1
        </button>
        <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          :class="{ active: editor.isActive('heading', { level: 2 }) }" title="标题2">
          H2
        </button>
        <button @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          :class="{ active: editor.isActive('heading', { level: 3 }) }" title="标题3">
          H3
        </button>
        <button @click="editor.chain().focus().setParagraph().run()" :class="{ active: editor.isActive('paragraph') }"
          title="正文">
          P
        </button>
      </div>

      <!-- 列表 -->
      <div class="toolbar-group">
        <button @click="editor.chain().focus().toggleBulletList().run()"
          :class="{ active: editor.isActive('bulletList') }" title="无序列表">
          &#8226;
        </button>
        <button @click="editor.chain().focus().toggleOrderedList().run()"
          :class="{ active: editor.isActive('orderedList') }" title="有序列表">
          1.
        </button>
      </div>

      <!-- 表格 -->
      <div class="toolbar-group">
        <button @click="insertTable" title="插入表格">
          &#9638;
        </button>
        <button @click="editor.chain().focus().addColumnAfter().run()" :disabled="!editor.can().addColumnAfter()"
          title="添加列">
          +
        </button>
        <button @click="editor.chain().focus().addRowAfter().run()" :disabled="!editor.can().addRowAfter()" title="添加行">
          =
        </button>
        <button @click="editor.chain().focus().deleteTable().run()" :disabled="!editor.can().deleteTable()"
          title="删除表格">
          &#10005;
        </button>
      </div>

      <!-- 其他 -->
      <div class="toolbar-group">
        <button @click="(e) => handleFormatButton(e, () => editor?.chain().focus().toggleStrike().run())"
          :class="{ active: editor.isActive('strike') }" title="删除线">
          S
        </button>
        <button @click="(e) => handleFormatButton(e, () => editor?.chain().focus().toggleSubscript().run())"
          :class="{ active: editor.isActive('subscript') }" title="下标">
          X₂
        </button>
        <button @click="(e) => handleFormatButton(e, () => editor?.chain().focus().toggleSuperscript().run())"
          :class="{ active: editor.isActive('superscript') }" title="上标">
          X²
        </button>
        <button @click="editor.chain().focus().toggleCode().run()" :class="{ active: editor.isActive('code') }"
          title="行内代码">
          行内代码
        </button>
        <button @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ active: editor.isActive('codeBlock') }"
          title="代码块">
          { }
        </button>
        <button @click="editor.chain().focus().toggleBlockquote().run()"
          :class="{ active: editor.isActive('blockquote') }" title="引用">
          &quot;
        </button>
        <button @click="(e) => handleFormatButton(e, () => editor?.chain().focus().setHorizontalRule().run())"
          title="分隔线">
          &#8212;
        </button>
      </div>

      <!-- 撤销/重做 -->
      <div class="toolbar-group">
        <button @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()" title="撤销">
          &#8630;
        </button>
        <button @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()" title="重做">
          &#8631;
        </button>
      </div>

      <!-- 折叠 -->
      <div class="toolbar-group">
        <button @click="insertDetails" title="插入折叠块">
          &#128194;
        </button>
      </div>

      <!-- 图片 -->
      <div class="toolbar-group">
        <button @click="insertImage" title="插入图片">
          &#128444;
        </button>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="editor-wrapper">
      <EditorContent :editor="editor" class="editor-content" />
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 8px;
  border-right: 1px solid #ddd;
}

.toolbar-group:last-child {
  border-right: none;
}

.toolbar button,
.toolbar select {
  padding: 4px 8px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  min-width: 28px;
  height: 28px;
}

.toolbar button:hover {
  background: #e8e8e8;
}

.toolbar button.active {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}

.toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar select {
  min-width: 80px;
}

.color-group {
  position: relative;
}

.color-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 52px;
  justify-content: center;
}

.color-preview {
  width: 14px;
  height: 14px;
  border: 1px solid #999;
  border-radius: 2px;
  box-sizing: border-box;
}

.color-arrow {
  font-size: 11px;
  line-height: 1;
}

.color-palette {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(8, 18px);
  gap: 4px;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.color-swatch {
  width: 18px;
  height: 18px;
  border: 1px solid #bbb;
  border-radius: 2px;
  padding: 0;
  min-width: 0;
}

.color-swatch.active {
  outline: 2px solid #4a90d9;
  outline-offset: 1px;
}

.editor-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 20px 40px;
}

.editor-content {
  max-width: 800px;
  margin: 0 auto;
  min-height: 100%;
}

.editor-content :deep(.tiptap) {
  outline: none;
  min-height: 400px;

  [data-resize-handle] {
    position: absolute;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 2px;
    z-index: 10;

    &:hover {
      background: rgba(0, 0, 0, 0.8);
    }

    /* Corner handles */
    &[data-resize-handle='top-left'],
    &[data-resize-handle='top-right'],
    &[data-resize-handle='bottom-left'],
    &[data-resize-handle='bottom-right'] {
      width: 8px;
      height: 8px;
    }

    &[data-resize-handle='top-left'] {
      top: -4px;
      left: -4px;
      cursor: nwse-resize;
    }

    &[data-resize-handle='top-right'] {
      top: -4px;
      right: -4px;
      cursor: nesw-resize;
    }

    &[data-resize-handle='bottom-left'] {
      bottom: -4px;
      left: -4px;
      cursor: nesw-resize;
    }

    &[data-resize-handle='bottom-right'] {
      bottom: -4px;
      right: -4px;
      cursor: nwse-resize;
    }

    /* Edge handles */
    &[data-resize-handle='top'],
    &[data-resize-handle='bottom'] {
      height: 6px;
      left: 8px;
      right: 8px;
    }

    &[data-resize-handle='top'] {
      top: -3px;
      cursor: ns-resize;
    }

    &[data-resize-handle='bottom'] {
      bottom: -3px;
      cursor: ns-resize;
    }

    &[data-resize-handle='left'],
    &[data-resize-handle='right'] {
      width: 6px;
      top: 8px;
      bottom: 8px;
    }

    &[data-resize-handle='left'] {
      left: -3px;
      cursor: ew-resize;
    }

    &[data-resize-handle='right'] {
      right: -3px;
      cursor: ew-resize;
    }
  }

  [data-resize-state='true'] [data-resize-wrapper] {
    outline: 1px solid rgba(0, 0, 0, 0.25);
    border-radius: 0.125rem;
  }
}

.editor-content :deep(.tiptap p) {
  margin: 0.5em 0;
}

.editor-content :deep(.tiptap h1) {
  font-size: 2em;
  font-weight: bold;
  margin: 0.67em 0;
}

.editor-content :deep(.tiptap h2) {
  font-size: 1.5em;
  font-weight: bold;
  margin: 0.75em 0;
}

.editor-content :deep(.tiptap h3) {
  font-size: 1.17em;
  font-weight: bold;
  margin: 0.83em 0;
}

.editor-content :deep(.tiptap ul),
.editor-content :deep(.tiptap ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.editor-content :deep(.tiptap li) {
  margin: 0.25em 0;
}

.editor-content :deep(.tiptap blockquote) {
  border-left: 3px solid #ccc;
  padding-left: 1em;
  margin-left: 0;
  color: #666;
}

.editor-content :deep(.tiptap code) {
  background: #f4f4f4;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-family: monospace;
}

.editor-content :deep(.tiptap pre) {
  background: #f4f4f4;
  padding: 1em;
  border-radius: 3px;
  overflow-x: auto;
}

.editor-content :deep(.tiptap pre code) {
  background: none;
  padding: 0;
}

/* 表格样式 */
.editor-content :deep(.tiptap table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.editor-content :deep(.tiptap th),
.editor-content :deep(.tiptap td) {
  border: 1px solid #ccc;
  padding: 6px 10px;
  text-align: left;
}

.editor-content :deep(.tiptap th) {
  background: #f5f5f5;
  font-weight: bold;
}

.editor-content :deep(.ProseMirror .selectedCell) {
  background: #e8f4fc;
}

/* 折叠块样式*/
.editor-content :deep(.tiptap .details) {
  display: flex;
  gap: 0.25rem;
  margin: 1.5rem 0;
  border: 1px solid #f5f5f5;
  border-radius: 0.5rem;
  padding: 0.5rem;

  &.is-open>button::before {
    transform: rotate(90deg);
  }

  >div {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;

    >[data-type='detailsContent']> :last-child {
      margin-bottom: 0.5rem;
    }
  }
}

.editor-content :deep(.tiptap .details > button) {
  align-items: center;
  background: transparent;
  border-radius: 4px;
  display: flex;
  font-size: 0.625rem;
  height: 1.25rem;
  justify-content: center;
  line-height: 1;
  margin-top: 0.1rem;
  padding: 0;
  width: 1.25rem;

  &:hover {
    background-color: gray;
  }

  &:before {
    content: '\25B6';
  }

}

.editor-content :deep(.tiptap hr) {
  border: none;
  border-top: 1px solid rgba(61, 37, 20, .08);
  cursor: pointer;
  margin: 2rem 0;

  &.ProseMirror-selectednode {
    border-top: 1px solid purple;
  }
}

.editor-content :deep(.tiptap img) {
  display: blcok;
}
</style>
