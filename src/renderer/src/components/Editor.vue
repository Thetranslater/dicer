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
import Image from '../extensions/image-freely/ImageFreely'
import { onBeforeUnmount, computed, onMounted, ref, watch, nextTick } from 'vue'
import type { OpenOption, FSNode, SaveOption } from '../utils/fileService'
import { useEditorStore } from '../composables/useEditorStore'
import Dicer from './Dicer.vue'
import { htmlToNgaBBS } from '../utils/htmlToNgaBBS'

const { setEditor } = useEditorStore()

//#region 'var set'
const SAVE_INTERVAL_MS = 3 * 60 * 1000
const relatedPath = ref('')
const saveStatus = ref('Ready')
const isDirty = ref(false)
const suppressDirtyTracking = ref(false)
let autoSaveTimer: number | null = null
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      link: {
        openOnClick: false
      }
    }),
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
      inline: true,
      resize: {
        enabled: true,
        minWidth: 10,
        alwaysPreserveAspectRatio: true
      }
    })
  ],
  content: '',
  onUpdate: () => {
    if (suppressDirtyTracking.value) return
    isDirty.value = true
  }
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
const showEmojiPanel = ref(false)
const activeEmojiGroup = ref<'ac1' | 'ac2'>('ac1')
const emojiPickerRef = ref<HTMLElement | null>(null)
const emojiPanelRef = ref<HTMLElement | null>(null)
const showLinkPanel = ref(false)
const linkPickerRef = ref<HTMLElement | null>(null)
const linkPanelRef = ref<HTMLElement | null>(null)
const linkUrl = ref('')
const linkText = ref('')
const PANEL_EDGE_GAP = 8

type EmojiItem = {
  name: string
  src: string
}

const ac1EmojiModules = import.meta.glob('../assets/emoji/ac1/*.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>

const ac2EmojiModules = import.meta.glob('../assets/emoji/ac2/*.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>

function buildEmojiItems(modules: Record<string, string>): EmojiItem[] {
  return Object.entries(modules)
    .map(([path, src]) => {
      const fileName = path.split('/').pop() ?? path
      const name = fileName.replace(/\.png$/i, '')
      return { name, src }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
}

const emojiGroups: Record<'ac1' | 'ac2', EmojiItem[]> = {
  ac1: buildEmojiItems(ac1EmojiModules),
  ac2: buildEmojiItems(ac2EmojiModules)
}

const currentEmojiItems = computed(() => emojiGroups[activeEmojiGroup.value])

type ImageExportConfig = {
  rootPath: string | null
  attachmentMappings: Record<string, string>
}

type EditorExportConfig = {
  baseFontSizePx?: number
}

type SaveTrigger = 'manual' | 'autosave' | 'switch'

const hasRelatedPath = computed(() => relatedPath.value.trim().length > 0)

function normalizeImageExportConfig(raw: unknown): ImageExportConfig | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const obj = raw as Record<string, unknown>

  const rootPath =
    typeof obj.rootPath === 'string' && obj.rootPath.trim().length > 0
      ? obj.rootPath
      : null

  const attachmentMappings: Record<string, string> = {}
  const rawMappings = obj.attachmentMappings
  if (rawMappings && typeof rawMappings === 'object' && !Array.isArray(rawMappings)) {
    for (const [key, value] of Object.entries(rawMappings as Record<string, unknown>)) {
      if (typeof value !== 'string') continue
      const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '').trim()
      if (!normalizedKey) continue
      const url = value.trim()
      if (!url) continue
      attachmentMappings[normalizedKey] = url
    }
  }

  return { rootPath, attachmentMappings }
}

function normalizeEditorExportConfig(raw: unknown): EditorExportConfig | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const obj = raw as Record<string, unknown>
  const baseRaw = obj.baseFontSizePx
  const n = typeof baseRaw === 'number' ? baseRaw : Number(baseRaw)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return { baseFontSizePx: Math.round(n) }
}

function setSaveStatus(message: string, extra?: Record<string, unknown>): void {
  saveStatus.value = message
  console.log('[EditorSave]', message, {
    relatedPath: relatedPath.value,
    hasRelatedPath: hasRelatedPath.value,
    isDirty: isDirty.value,
    ...(extra ?? {})
  })
}

function inferFormatFromPath(path: string): 'html' | 'json' {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext === 'json' ? 'json' : 'html'
}

function serializeEditorContent(format: 'html' | 'json'): string {
  if (!editor.value) return ''
  if (format === 'json') {
    return JSON.stringify(editor.value.getJSON(), null, 2)
  }
  return editor.value.getHTML()
}

async function saveEditorContent(trigger: SaveTrigger, forceChoosePath = false): Promise<boolean> {
  if (!editor.value) return false

  const directPath = !forceChoosePath && hasRelatedPath.value ? relatedPath.value : undefined
  const initialFormat = directPath ? inferFormatFromPath(directPath) : 'html'
  const initialContent = serializeEditorContent(initialFormat)
  const option: SaveOption = {
    path: directPath ? [directPath] : undefined,
    dialogfilters: [{ name: initialFormat === 'json' ? 'JSON' : 'HTML', extensions: [initialFormat] }]
  }

  let targets
  try {
    targets = await window.api.fs.save(initialContent, option)
  } catch (error) {
    setSaveStatus(`Save failed (${trigger})`, { error })
    return false
  }

  relatedPath.value = targets[0]

  isDirty.value = false
  return true
}

async function handleBeforeFileSwitch(): Promise<boolean> {
  //const shouldSave = window.confirm('Current document has unsaved changes. Save before opening another file?')
  if (!isDirty.value) {
    setSaveStatus('Switched without saving previous content')
    return true
  }

  if (hasRelatedPath.value) {
    const saved = await saveEditorContent('switch')
    if (!saved) {
      setSaveStatus('Switch canceled: save failed')
      return false
    }
    return true
  }

  const saved = await saveEditorContent('switch', true)
  if (!saved) {
    setSaveStatus('Switch canceled: previous content not saved')
    return false
  }

  return true
}

function startAutoSaveLoop(): void {
  autoSaveTimer = window.setInterval(async () => {
    if (!isDirty.value) return

    if (!hasRelatedPath.value) {
      setSaveStatus('Auto-save failed: no file path')
      return
    }

    await saveEditorContent('autosave')
  }, SAVE_INTERVAL_MS)
}
//#endregion

//#region 'Ipc Callbacks'

const handleEditorSaveAs = async () => {
  if (!editor.value) return

  const option: SaveOption = {
    dialogfilters: [
      { name: 'NGA BBS', extensions: ['bbs'] }
    ]
  }

  const html = editor.value.getHTML()

  let imageConfig: ImageExportConfig | undefined
  try {
    const rawConfig = await window.api.cfg.get('image')
    imageConfig = normalizeImageExportConfig(rawConfig)
  } catch (error) {
    console.warn('[Editor] failed to read image config, fallback to original image src', error)
  }

  let editorConfig: EditorExportConfig | undefined
  try {
    const rawConfig = await window.api.cfg.get('editor')
    editorConfig = normalizeEditorExportConfig(rawConfig)
  } catch (error) {
    console.warn('[Editor] failed to read editor config, fallback to default base font size', error)
  }

  const bbs = htmlToNgaBBS(html, { imageConfig, editorConfig })
  const saveDetails = await window.api.fs.save(bbs, option)
  setSaveStatus('Saved as .bbs', { path: saveDetails[0] ?? null })
}

function IpcCallbackRegister() {
  //menu-save
  window.api.on((ch, ..._args) => {
    if (ch && ch === 'menu-save') {
      if (!editor.value) return
      saveEditorContent('manual')
    }
  })
  //menu-saveas
  window.api.on((ch, ..._args) => {
    if (ch && ch === 'menu-saveas') handleEditorSaveAs()
  })
  //menu-open
  window.api.on(async (ch, _event, args) => {
    if (ch && ch === 'menu-open') {
      if (!editor.value) return
      const fsnode = (args[0] as FSNode[])[0]
      const content = fsnode.data
      const filePath = fsnode.path
      if (!content) return

      const proceed = await handleBeforeFileSwitch()
      if (!proceed) return

      const targetPath = typeof filePath === 'string' ? filePath : filePath[0]
      const ext = targetPath?.split('.').pop()?.toLowerCase()

      suppressDirtyTracking.value = true
      try {
        if (ext === 'json') {
          try {
            const json = JSON.parse(content as string)
            editor.value.commands.setContent(json)
          } catch (e) {
            console.error('Failed to parse JSON:', e)
            setSaveStatus('Open failed: invalid JSON')
            return
          }
        } else {
          editor.value.commands.setContent(content as string)
        }

        relatedPath.value = targetPath ?? ''
        isDirty.value = false
        setSaveStatus('File opened', { path: relatedPath.value })
      } finally {
        suppressDirtyTracking.value = false
      }
    }
  })
}
//#endregion

onMounted(() => {
  IpcCallbackRegister()
  window.addEventListener('mousedown', handleGlobalMouseDown)
  window.addEventListener('resize', handleViewportResize)
  startAutoSaveLoop()
  setSaveStatus('Editor ready')
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

function clampPanelHorizontally(panelEl: HTMLElement): void {
  panelEl.style.transform = 'translateX(0px)'

  const rect = panelEl.getBoundingClientRect()
  let deltaX = 0
  const maxRight = window.innerWidth - PANEL_EDGE_GAP

  if (rect.right > maxRight) {
    deltaX -= rect.right - maxRight
  }

  const minLeft = PANEL_EDGE_GAP
  if (rect.left + deltaX < minLeft) {
    deltaX += minLeft - (rect.left + deltaX)
  }

  panelEl.style.transform = `translateX(${Math.round(deltaX)}px)`
}

async function clampOpenDropdowns(): Promise<void> {
  await nextTick()

  if (showLinkPanel.value && linkPanelRef.value) {
    clampPanelHorizontally(linkPanelRef.value)
  }

  if (showEmojiPanel.value && emojiPanelRef.value) {
    clampPanelHorizontally(emojiPanelRef.value)
  }
}

const handleViewportResize = () => {
  void clampOpenDropdowns()
}

const toggleEmojiPanel = () => {
  showEmojiPanel.value = !showEmojiPanel.value
  if (showEmojiPanel.value) {
    void clampOpenDropdowns()
  }
}

const setEmojiGroup = (group: 'ac1' | 'ac2') => {
  activeEmojiGroup.value = group
  if (showEmojiPanel.value) {
    void clampOpenDropdowns()
  }
}

const toggleLinkPanel = () => {
  showLinkPanel.value = !showLinkPanel.value
  if (showLinkPanel.value) {
    linkUrl.value = ''
    linkText.value = ''
    void clampOpenDropdowns()
  }
}

const cancelInsertLink = () => {
  showLinkPanel.value = false
  linkUrl.value = ''
  linkText.value = ''
}

function normalizeHref(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) return value
  return `https://${value}`
}

const confirmInsertLink = () => {
  if (!editor.value) return

  const href = normalizeHref(linkUrl.value)
  if (!href) return

  const text = linkText.value.trim() || href
  const insertFrom = editor.value.state.selection.from

  editor.value
    .chain()
    .focus()
    .insertContent(text)
    .setTextSelection({ from: insertFrom, to: insertFrom + text.length })
    .setLink({ href })
    .run()

  cancelInsertLink()
}

const handleGlobalMouseDown = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!target) return

  if (showColorPalette.value && colorPickerRef.value && !colorPickerRef.value.contains(target)) {
    showColorPalette.value = false
  }

  if (showEmojiPanel.value && emojiPickerRef.value && !emojiPickerRef.value.contains(target)) {
    showEmojiPanel.value = false
  }

  if (showLinkPanel.value && linkPickerRef.value && !linkPickerRef.value.contains(target)) {
    showLinkPanel.value = false
  }
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
const insertImage = async () => {
  // 调用主进程打开图片对话框
  const option: OpenOption = {
    isMultiselection: false,
    dialogOpenType: 'file',
    fileOption: {
      isLoad: false
    }
  }
  const result = await window.api.fs.open(option)
  const fsnode = result[0]
  if (!editor.value) return

  const imagePath = `app://${fsnode.path}`
  //editor.value.chain().focus().insertContent('<img src="app://C:/Users/Mage/Desktop/redface.gif" contenteditable="false" draggable="true">').run()
  editor.value.chain().focus().setImage({ src: imagePath }).run()
}

const insertEmoji = (src: string) => {
  if (!editor.value) return
  editor.value.chain().focus().setImage({ src }).run()
  showEmojiPanel.value = false
}

watch(editor, (newInstance) => {
  if (newInstance) {
    setEditor(newInstance)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleGlobalMouseDown)
  window.removeEventListener('resize', handleViewportResize)
  if (autoSaveTimer !== null) {
    window.clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
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
        <button @click="editor.chain().focus().deleteTable().run()" :disabled="!editor.can().deleteTable()" title="删除表格">
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
      <div class="toolbar-group insert-group insert-group-start">
        <button @click="insertDetails" title="插入折叠块">
          &#128194;
        </button>
      </div>

      <!-- 图片 -->
      <div class="toolbar-group insert-group insert-group-mid">
        <button @click="insertImage" title="插入图片">
          &#128444;
        </button>
      </div>
      <div class="toolbar-group link-group insert-group insert-group-end" ref="linkPickerRef">
        <button type="button" @click="toggleLinkPanel" :class="{ active: editor.isActive('link') }" title="插入链接">
          &#128279;
        </button>
        <div v-show="showLinkPanel" ref="linkPanelRef" class="link-panel">
          <input v-model="linkUrl" class="link-input" type="text" placeholder="URL (https://...)"
            @keydown.enter.prevent="confirmInsertLink" />
          <input v-model="linkText" class="link-input" type="text" placeholder="Display text"
            @keydown.enter.prevent="confirmInsertLink" />
          <div class="link-actions">
            <button type="button" class="link-btn" @click="confirmInsertLink">Insert</button>
            <button type="button" class="link-btn" @click="cancelInsertLink">Cancel</button>
          </div>
        </div>
      </div>
      <div class="toolbar-group emoji-group" ref="emojiPickerRef">
        <button type="button" @click="toggleEmojiPanel" title="插入表情">
          &#128578;
        </button>
        <div v-show="showEmojiPanel" ref="emojiPanelRef" class="emoji-panel">
          <div class="emoji-tabs">
            <button type="button" :class="{ active: activeEmojiGroup === 'ac1' }" @click="setEmojiGroup('ac1')">
              ac1
            </button>
            <button type="button" :class="{ active: activeEmojiGroup === 'ac2' }" @click="setEmojiGroup('ac2')">
              ac2
            </button>
          </div>
          <div class="emoji-grid">
            <button v-for="emoji in currentEmojiItems" :key="emoji.src" type="button" class="emoji-item"
              :title="emoji.name" @click="insertEmoji(emoji.src)">
              <img :src="emoji.src" :alt="emoji.name" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑区域 -->
    <div class="editor-wrapper">
      <EditorContent :editor="editor" class="editor-content" />
    </div>

    <div class="save-status-bar">
      <span class="save-status-text">{{ saveStatus }}</span>
      <span class="save-status-path">{{ hasRelatedPath ? relatedPath : 'No related file path' }}</span>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #e9edf2;
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

.insert-group {
  border-right: none;
  padding-right: 0;
}

.insert-group-start {
  border-left: 1px solid transparent;
}

.insert-group-end {
  border-right: 1px solid #ddd;
  padding-right: 8px;
}

.link-group {
  position: relative;
}

.link-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 24;
  width: min(260px, calc(100vw - 16px));
  max-width: calc(100vw - 16px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.15);
  transform: translateX(0);
}

.link-input {
  width: 100%;
  height: 28px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid #c7ced9;
  border-radius: 4px;
  font-size: 12px;
}

.link-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.link-btn {
  min-width: 64px;
  height: 28px;
}

.emoji-group {
  position: relative;
}

.emoji-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: auto;
  z-index: 24;
  width: min(320px, calc(100vw - 16px));
  max-width: calc(100vw - 16px);
  max-height: min(240px, calc(100vh - 180px));
  display: flex;
  flex-direction: column;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transform: translateX(0);
}

.emoji-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.emoji-tabs button {
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 6px 10px;
  height: 30px;
}

.emoji-tabs button.active {
  background: #eef3ff;
  color: #1f2937;
  border-bottom: 2px solid #4a90d9;
}

.emoji-group .emoji-panel .emoji-grid {
  padding: 8px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, 50px);
  grid-auto-rows: 50px;
  gap: 4px;
  justify-content: start;
}

.emoji-group .emoji-panel .emoji-grid .emoji-item {
  box-sizing: border-box;
  width: 50px;
  min-width: 50px;
  max-width: 50px;
  height: 50px;
  min-height: 50px;
  max-height: 50px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 50px;

  &:hover {
    border-color: #9bb4d4;
    background: #f5f8ff;
  }
}

.emoji-group .emoji-panel .emoji-grid .emoji-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.editor-wrapper {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 40px;
  background: #e9edf2;
}

.editor-content {
  max-width: 800px;
  margin: 0 auto;
  min-height: 100%;
  background: #fff;
  border: 1px solid #d4dbe3;
  border-radius: 6px;
  padding: 24px 28px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.save-status-bar {
  height: 24px;
  padding: 0 10px;
  border-top: 1px solid #d5dbe3;
  background: #f3f6fa;
  color: #4b5563;
  font-size: 12px;
  line-height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.save-status-text,
.save-status-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.save-status-path {
  color: #6b7280;
  text-align: right;
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
</style>
