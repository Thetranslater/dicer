<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type ImageItem = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  isParentNav?: boolean
  targetPath?: string
}

type Breadcrumb = {
  name: string
  path: string
}

const VIRTUAL_PARENT_PATH = '__virtual_parent__'
const rootPath = ref<string | null>(null)
const currentPath = ref<string>('')
const items = ref<ImageItem[]>([])
const selectedPath = ref<string | null>(null)
const dropTargetPath = ref<string | null>(null)
const dragEnterDepthMap = new Map<string, number>()
const renamingPath = ref<string | null>(null)
const renamingName = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const loading = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')

const hasRoot = computed(() => Boolean(rootPath.value))
const parentPath = computed(() => getParentPath(currentPath.value))

const sortedItems = computed(() => {
  const list = [...items.value]
  list.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'en-US')
  })

  if (parentPath.value) {
    const parentItem: ImageItem = {
      name: '..',
      path: VIRTUAL_PARENT_PATH,
      isDirectory: true,
      size: 0,
      isParentNav: true,
      targetPath: parentPath.value
    }
    return [parentItem, ...list]
  }

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
        size: selected.size
      }
      : null
  })
}

function getStateSnapshot() {
  return {
    rootPath: rootPath.value,
    currentPath: currentPath.value,
    hasRoot: hasRoot.value,
    loading: loading.value,
    errorMessage: errorMessage.value,
    statusMessage: statusMessage.value,
    selectedPath: selectedPath.value,
    selectedItem: selectedItem.value
      ? {
        name: selectedItem.value.name,
        path: selectedItem.value.path,
        isDirectory: selectedItem.value.isDirectory,
        size: selectedItem.value.size
      }
      : null,
    itemsCount: items.value.length,
    renamingPath: renamingPath.value,
    dropTargetPath: dropTargetPath.value
  }
}

function logStateChange(key: string, prev: unknown, next: unknown): void {
  console.groupCollapsed(`[ImagesManager][StateChange] ${key}`)
  console.log('prev:', prev)
  console.log('next:', next)
  console.log('snapshot:', getStateSnapshot())
  console.groupEnd()
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

const canGoUp = computed(() => Boolean(parentPath.value))

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function getParentPath(path: string): string | null {
  const normalized = normalizePath(path).replace(/\/+$/, '')
  if (!normalized) return null
  if (/^[A-Za-z]:$/.test(normalized)) return null

  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return null

  // Keep drive root as "D:/" instead of "D:".
  // "D:" may resolve to drive working directory on Windows.
  if (idx === 2 && /^[A-Za-z]:\//.test(normalized)) {
    return normalized.slice(0, 3)
  }

  const parent = normalized.slice(0, idx)
  return parent || null
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
      statusMessage.value = rootPath.value
        ? 'Root selection cancelled. Keeping current root.'
        : 'No image root selected.'
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
  if (!parentPath.value) return
  await loadDirectory(parentPath.value)
}

async function openItem(item: ImageItem): Promise<void> {
  if (renamingPath.value) return

  if (item.isParentNav && item.targetPath) {
    await loadDirectory(item.targetPath)
    return
  }

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
  if (item.isParentNav || renamingPath.value === item.path) {
    event.preventDefault()
    return
  }
  event.dataTransfer?.setData('application/x-images-item-path', item.path)
  event.dataTransfer?.setData('text/plain', item.path)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function getDropTargetDir(item: ImageItem): string | null {
  if (item.isParentNav) return item.targetPath || null
  if (item.isDirectory) return item.path
  return null
}

function onItemDragEnter(event: DragEvent, item: ImageItem): void {
  const dropDir = getDropTargetDir(item)
  if (!dropDir) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

  const nextDepth = (dragEnterDepthMap.get(item.path) || 0) + 1
  dragEnterDepthMap.set(item.path, nextDepth)
  dropTargetPath.value = item.path
}

function onItemDragOver(event: DragEvent, item: ImageItem): void {
  const dropDir = getDropTargetDir(item)
  if (!dropDir) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onItemDragLeave(event: DragEvent, item: ImageItem): void {
  const dropDir = getDropTargetDir(item)
  if (!dropDir) return
  event.preventDefault()

  const nextDepth = (dragEnterDepthMap.get(item.path) || 1) - 1
  if (nextDepth <= 0) {
    dragEnterDepthMap.delete(item.path)
    if (dropTargetPath.value === item.path) {
      dropTargetPath.value = null
    }
    return
  }

  dragEnterDepthMap.set(item.path, nextDepth)
}

async function onItemDrop(event: DragEvent, item: ImageItem): Promise<void> {
  const dropDir = getDropTargetDir(item)
  if (!dropDir) return
  event.preventDefault()
  dragEnterDepthMap.delete(item.path)
  dropTargetPath.value = null
  await handleDrop(event, dropDir)
}

function onWorkspaceDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

async function onWorkspaceDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  dragEnterDepthMap.clear()
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

// watch(rootPath, (next, prev) => {
//   logStateChange('rootPath', prev, next)
// })

// watch(currentPath, (next, prev) => {
//   logStateChange('currentPath', prev, next)
// })

// watch(loading, (next, prev) => {
//   logStateChange('loading', prev, next)
// })

// watch(errorMessage, (next, prev) => {
//   logStateChange('errorMessage', prev, next)
// })

// watch(statusMessage, (next, prev) => {
//   logStateChange('statusMessage', prev, next)
// })

// watch(selectedPath, (next, prev) => {
//   logStateChange('selectedPath', prev, next)
// })

// watch(items, (next, prev) => {
//   const prevSummary = Array.isArray(prev)
//     ? prev.map((item) => ({ name: item.name, path: item.path, isDirectory: item.isDirectory }))
//     : []
//   const nextSummary = next.map((item) => ({ name: item.name, path: item.path, isDirectory: item.isDirectory }))
//   logStateChange('items', prevSummary, nextSummary)
// }, { deep: false })

// watch(renamingPath, (next, prev) => {
//   logStateChange('renamingPath', prev, next)
// })

watch(dropTargetPath, (next, prev) => {
  logStateChange('dropTargetPath', prev, next)
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
        <button v-for="crumb in breadcrumbs" :key="crumb.path" class="breadcrumb" @click="goToBreadcrumb(crumb.path)"
          :disabled="loading">
          {{ crumb.name }}
        </button>
      </div>
      <div class="toolbar-center" v-else>
        <span class="path-hint">Please select an image root folder first.</span>
      </div>

      <div class="toolbar-right">
        <button @click="importByDialog" :disabled="loading || !hasRoot">Import Images</button>
        <button @click="createFolder" :disabled="loading || !hasRoot">New Folder</button>
        <button @click="openConfigPlaceholder" :disabled="!hasRoot">Image Config</button>
      </div>
    </div>

    <div class="content" v-if="hasRoot">
      <div v-if="sortedItems.length === 0" class="empty-state">
        <p>This folder is empty. Drag images here or use "Import Images".</p>
      </div>

      <div v-else class="item-grid">
        <div v-for="item in sortedItems" :key="item.path" class="item-card" :class="{
          selected: selectedPath === item.path,
          'drop-target': dropTargetPath === item.path
        }" :draggable="renamingPath !== item.path && !item.isParentNav" @click="selectedPath = item.path"
          @dblclick="openItem(item)" @dragstart="onItemDragStart($event, item)" @dragenter="onItemDragEnter($event, item)"
          @dragover="onItemDragOver($event, item)" @dragleave="onItemDragLeave($event, item)"
          @drop="onItemDrop($event, item)">
          <div class="thumb">
            <template v-if="item.isDirectory">
              <div class="folder-icon">DIR</div>
            </template>
            <template v-else>
              <img :src="toImageSrc(item.path)" :alt="item.name" />
            </template>
          </div>

          <template v-if="renamingPath === item.path">
            <input :ref="setRenameInputRef" v-model="renamingName" class="rename-input" @click.stop @dblclick.stop
              @keydown="onRenameInputKeydown" @blur="commitRename" />
          </template>
          <div v-else class="name" :title="item.name">{{ item.name }}</div>
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

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #656d76;
}
</style>
