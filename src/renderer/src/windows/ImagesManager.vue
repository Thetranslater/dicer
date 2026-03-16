<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type SortType = 'name' | 'time'

type ImageItem = {
  name: string
  path: string
  isDirectory: boolean
  createdTime: number
  modifiedTime: number
  size: number
}

type Breadcrumb = {
  name: string
  path: string
}

const sortType = ref<SortType>('name')
const rootPath = ref<string | null>(null)
const currentPath = ref<string>('')
const items = ref<ImageItem[]>([])
const selectedPath = ref<string | null>(null)
const dropTargetPath = ref<string | null>(null)
const renamingPath = ref<string | null>(null)
const renamingName = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const loading = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')

const hasRoot = computed(() => Boolean(rootPath.value))

const sortedItems = computed(() => {
  const list = [...items.value]
  list.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    if (sortType.value === 'time') {
      const diff = b.createdTime - a.createdTime
      if (diff !== 0) return diff
    }
    return a.name.localeCompare(b.name, 'en-US')
  })
  return list
})

const selectedItem = computed(() => {
  if (!selectedPath.value) return null
  return items.value.find((item) => item.path === selectedPath.value) || null
})

function logSelectionDebug(source: string): void {
  const selected = selectedItem.value
  console.log('[ImagesManager][Selection]', {
    source,
    currentPath: currentPath.value,
    selectedPath: selectedPath.value,
    selected: selected
      ? {
          name: selected.name,
          path: selected.path,
          isDirectory: selected.isDirectory,
          createdTime: selected.createdTime,
          modifiedTime: selected.modifiedTime,
          size: selected.size
        }
      : null
  })
}

const breadcrumbs = computed<Breadcrumb[]>(() => {
  if (!rootPath.value) return []
  const root = normalizePath(rootPath.value).replace(/\/+$/, '')
  const current = normalizePath(currentPath.value || rootPath.value).replace(/\/+$/, '')

  const rootCrumb: Breadcrumb = { name: displayNameForPath(rootPath.value), path: rootPath.value }
  if (!current.toLowerCase().startsWith(root.toLowerCase())) return [rootCrumb]
  if (current.toLowerCase() === root.toLowerCase()) return [rootCrumb]

  const relative = current.slice(root.length).replace(/^\/+/, '')
  const segments = relative ? relative.split('/').filter(Boolean) : []

  const result: Breadcrumb[] = [rootCrumb]
  let accumulated = root
  for (const segment of segments) {
    accumulated = `${accumulated.replace(/\/+$/, '')}/${segment}`
    result.push({ name: segment, path: accumulated })
  }
  return result
})

const canGoUp = computed(() => breadcrumbs.value.length > 1)

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function displayNameForPath(path: string): string {
  const normalized = normalizePath(path).replace(/\/+$/, '')
  if (/^[A-Za-z]:$/.test(normalized)) return normalized
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || normalized
}

function toImageSrc(path: string): string {
  return `app://${encodeURI(normalizePath(path))}`
}

function formatTime(timestamp: number): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString()
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function setRenameInputRef(el: Element | null): void {
  renameInputRef.value = el as HTMLInputElement | null
}

async function loadDirectory(path?: string): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.imagesListDir(path)
    rootPath.value = result.rootPath
    currentPath.value = result.currentPath
    items.value = result.items
    selectedPath.value = null
    logSelectionDebug('load-directory')
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function chooseRootDirectory(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  statusMessage.value = ''
  try {
    const selected = await window.api.imagesSelectRoot()
    if (!selected) {
      rootPath.value = null
      currentPath.value = ''
      items.value = []
      statusMessage.value = 'No image root selected.'
      return
    }
    await loadDirectory(selected)
    statusMessage.value = 'Image root has been set.'
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function initialize(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const config = await window.api.imagesGetConfig()
    if (config.rootPath) {
      await loadDirectory(config.rootPath)
      return
    }
    statusMessage.value = 'First launch: please select an image root folder.'
    await chooseRootDirectory()
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function refresh(): Promise<void> {
  if (!hasRoot.value) return
  await loadDirectory(currentPath.value || undefined)
}

async function goToBreadcrumb(path: string): Promise<void> {
  await loadDirectory(path)
}

async function goUp(): Promise<void> {
  if (!canGoUp.value) return
  const parent = breadcrumbs.value[breadcrumbs.value.length - 2]
  if (parent) await loadDirectory(parent.path)
}

async function openItem(item: ImageItem): Promise<void> {
  if (renamingPath.value) return
  selectedPath.value = item.path
  logSelectionDebug('open-item')
  if (item.isDirectory) {
    await loadDirectory(item.path)
  }
}

async function createFolder(): Promise<void> {
  if (!currentPath.value) return

  loading.value = true
  errorMessage.value = ''
  try {
    const createdPath = await window.api.imagesCreateFolder(currentPath.value)
    const createdName = displayNameForPath(createdPath)
    statusMessage.value = `Folder created: ${createdName}`
    await loadDirectory(currentPath.value)
    selectedPath.value = createdPath
    logSelectionDebug('create-folder')
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function startRenameSelected(): Promise<void> {
  if (!selectedItem.value || loading.value || renamingPath.value) return
  renamingPath.value = selectedItem.value.path
  renamingName.value = selectedItem.value.name
  logSelectionDebug('rename-start')
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function cancelRename(): void {
  renamingPath.value = null
  renamingName.value = ''
}

async function commitRename(): Promise<void> {
  if (!renamingPath.value) return
  const targetPath = renamingPath.value
  const targetItem = items.value.find((item) => item.path === targetPath)
  const nextName = renamingName.value.trim()

  if (!targetItem || !nextName || nextName === targetItem.name) {
    cancelRename()
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const renamedPath = await window.api.imagesRename(targetPath, nextName)
    statusMessage.value = `Renamed to: ${nextName}`
    await loadDirectory(currentPath.value)
    selectedPath.value = renamedPath
    logSelectionDebug('rename-commit')
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
    cancelRename()
  }
}

function onRenameInputKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    void commitRename()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (event.key !== 'F2' || !selectedItem.value || renamingPath.value) return
  const target = event.target as HTMLElement | null
  if (target?.tagName === 'INPUT' || target?.isContentEditable) return
  event.preventDefault()
  void startRenameSelected()
}

async function importByDialog(): Promise<void> {
  if (!currentPath.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const imported = await window.api.imagesImportDialog(currentPath.value)
    statusMessage.value = imported.length > 0 ? `Imported ${imported.length} file(s)` : 'No files imported'
    await loadDirectory(currentPath.value)
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function onItemDragStart(event: DragEvent, item: ImageItem): void {
  if (renamingPath.value === item.path) {
    event.preventDefault()
    return
  }
  event.dataTransfer?.setData('application/x-images-item-path', item.path)
  event.dataTransfer?.setData('text/plain', item.path)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onItemDragOver(event: DragEvent, item: ImageItem): void {
  if (!item.isDirectory) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropTargetPath.value = item.path
}

function onItemDragLeave(item: ImageItem): void {
  if (dropTargetPath.value === item.path) dropTargetPath.value = null
}

async function onItemDrop(event: DragEvent, item: ImageItem): Promise<void> {
  if (!item.isDirectory) return
  event.preventDefault()
  dropTargetPath.value = null
  await handleDrop(event, item.path)
}

function onWorkspaceDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

async function onWorkspaceDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  dropTargetPath.value = null
  await handleDrop(event, currentPath.value)
}

async function handleDrop(event: DragEvent, targetDir: string): Promise<void> {
  if (!targetDir) return

  const internalSource = event.dataTransfer?.getData('application/x-images-item-path')
  const files = Array.from(event.dataTransfer?.files ?? []) as Array<File & { path?: string }>
  const sourcePaths = files.map((f) => f.path).filter((p): p is string => Boolean(p))

  loading.value = true
  errorMessage.value = ''
  try {
    if (internalSource && internalSource !== targetDir) {
      await window.api.imagesMove(internalSource, targetDir)
      statusMessage.value = 'Moved successfully.'
      await loadDirectory(currentPath.value)
      return
    }

    if (sourcePaths.length > 0) {
      const imported = await window.api.imagesImportFiles(targetDir, sourcePaths)
      statusMessage.value = imported.length > 0 ? `Imported ${imported.length} file(s)` : 'No image files imported'
      await loadDirectory(currentPath.value)
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openConfigPlaceholder(): void {
  window.alert('Image config page will be implemented in a later version.')
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  void initialize()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

watch(selectedPath, () => {
  logSelectionDebug('selectedPath-change')
})

watch(items, () => {
  logSelectionDebug('items-change')
}, { deep: false })

watch(currentPath, () => {
  logSelectionDebug('currentPath-change')
})
</script>

<template>
  <div class="images-window" @dragover="onWorkspaceDragOver" @drop="onWorkspaceDrop">
    <div class="toolbar">
      <div class="toolbar-left">
        <button @click="goUp" :disabled="!canGoUp || loading" title="Go up">Up</button>
        <button @click="refresh" :disabled="!hasRoot || loading" title="Refresh">Refresh</button>
        <button @click="chooseRootDirectory" :disabled="loading" title="Set root folder">Set Root</button>
      </div>

      <div class="toolbar-center" v-if="hasRoot">
        <button
          v-for="crumb in breadcrumbs"
          :key="crumb.path"
          class="breadcrumb"
          @click="goToBreadcrumb(crumb.path)"
          :disabled="loading"
        >
          {{ crumb.name }}
        </button>
      </div>
      <div class="toolbar-center" v-else>
        <span class="path-hint">Please select an image root folder first.</span>
      </div>

      <div class="toolbar-right">
        <select v-model="sortType" :disabled="loading || !hasRoot">
          <option value="name">Sort by Name</option>
          <option value="time">Sort by Created Time</option>
        </select>
        <button @click="importByDialog" :disabled="loading || !hasRoot">Import Images</button>
        <button @click="createFolder" :disabled="loading || !hasRoot">New Folder</button>
        <button @click="openConfigPlaceholder" :disabled="!hasRoot">Image Config</button>
      </div>
    </div>

    <div class="message-row">
      <span v-if="loading" class="loading">Processing...</span>
      <span v-if="statusMessage" class="status">{{ statusMessage }}</span>
      <span v-if="errorMessage" class="error">{{ errorMessage }}</span>
    </div>

    <div class="content" v-if="hasRoot">
      <div v-if="sortedItems.length === 0" class="empty-state">
        <p>This folder is empty. Drag images here or use "Import Images".</p>
      </div>

      <div v-else class="item-grid">
        <div
          v-for="item in sortedItems"
          :key="item.path"
          class="item-card"
          :class="{
            selected: selectedPath === item.path,
            'drop-target': dropTargetPath === item.path
          }"
          :draggable="renamingPath !== item.path"
          @click="selectedPath = item.path; logSelectionDebug('item-click')"
          @dblclick="openItem(item)"
          @dragstart="onItemDragStart($event, item)"
          @dragover="onItemDragOver($event, item)"
          @dragleave="onItemDragLeave(item)"
          @drop="onItemDrop($event, item)"
        >
          <div class="thumb">
            <template v-if="item.isDirectory">
              <div class="folder-icon">DIR</div>
            </template>
            <template v-else>
              <img :src="toImageSrc(item.path)" :alt="item.name" />
            </template>
          </div>

          <template v-if="renamingPath === item.path">
            <input
              :ref="setRenameInputRef"
              v-model="renamingName"
              class="rename-input"
              @click.stop
              @dblclick.stop
              @keydown="onRenameInputKeydown"
              @blur="commitRename"
            />
          </template>
          <div v-else class="name" :title="item.name">{{ item.name }}</div>

          <div class="meta">{{ formatTime(item.createdTime) }}</div>
        </div>
      </div>
    </div>

    <div class="content empty-state" v-else>
      <p>No image root folder has been configured.</p>
      <button @click="chooseRootDirectory" :disabled="loading">Select Image Root</button>
    </div>
  </div>
</template>

<style scoped>
.images-window {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #ffffff;
  color: #1f2328;
}

.toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid #d0d7de;
  background: #f6f8fa;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar button,
.toolbar select {
  height: 30px;
  border: 1px solid #d0d7de;
  background: #ffffff;
  border-radius: 4px;
  padding: 0 10px;
  font-size: 13px;
  cursor: pointer;
}

.toolbar button:disabled,
.toolbar select:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  padding: 0 4px;
}

.breadcrumb {
  border: 1px solid #d0d7de;
  background: #ffffff;
  border-radius: 4px;
  padding: 0 10px;
  height: 28px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.path-hint {
  color: #656d76;
  font-size: 13px;
}

.message-row {
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 12px;
  border-bottom: 1px solid #eaeef2;
  font-size: 12px;
}

.loading {
  color: #0969da;
}

.status {
  color: #1a7f37;
}

.error {
  color: #cf222e;
}

.content {
  flex: 1;
  overflow: auto;
  padding: 14px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.item-card {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 8px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.item-card:hover {
  background: #f6f8fa;
}

.item-card.selected {
  border-color: #0969da;
  box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.16);
}

.item-card.drop-target {
  border-color: #1a7f37;
  box-shadow: 0 0 0 2px rgba(26, 127, 55, 0.18);
}

.thumb {
  width: 100%;
  height: 110px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #d8dee4;
  background: #f6f8fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.folder-icon {
  font-size: 12px;
  letter-spacing: 0.5px;
  color: #656d76;
  background: #fff8c5;
  border: 1px solid #e3b341;
  border-radius: 4px;
  padding: 4px 8px;
}

.name {
  font-size: 13px;
  line-height: 1.3;
  word-break: break-all;
}

.rename-input {
  width: 100%;
  height: 28px;
  border: 1px solid #0969da;
  border-radius: 4px;
  padding: 0 8px;
  font-size: 13px;
  outline: none;
}

.meta {
  font-size: 11px;
  color: #656d76;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #656d76;
}
</style>
