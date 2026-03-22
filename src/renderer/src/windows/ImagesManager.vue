<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { type OpenFileOptions } from '../utils/fileService'

type ImageItem = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  isParentNav?: boolean
}

type Breadcrumb = {
  name: string
  path: string
}
//#region 'var set'
const rootPath = ref<string | null>(null)
const currentPath = ref<string>('')
const items = ref<ImageItem[]>([])
const selectedPaths = ref<string[]>([])
const dropTargetPath = ref<string | null>(null)
const dragTargetPaths = ref<string[] | null>(null)
const dragEnterDepthMap = new Map<string, number>()
const renamingPath = ref<string | null>(null)
const renamingName = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const loading = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
//#endregion

//#region 'basic function'
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}
function isPathSelected(path: string): boolean {
  return selectedPaths.value.includes(path)
}
function toImageSrc(path: string): string {
  return `app://${encodeURI(normalizePath(path))}`
}
async function loadDirectory(path?: string): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.imagesListDir(path)
    rootPath.value = normalizePath(result.rootPath)
    currentPath.value = normalizePath(result.currentPath)
    items.value = result.items
    selectedPaths.value = []
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
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
//#endregion

//#region 'reactive properties'
const hasRoot = computed(() => Boolean(rootPath.value))
const parentPath = computed(() => getParentPath(currentPath.value))
const canGoUp = computed(() => Boolean(parentPath.value))
const sortedItems = computed(() => {
  const list = [...items.value]
  list.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'en-US')
  })

  if (parentPath.value) {
    const parentItem: ImageItem = {
      name: '..',
      path: parentPath.value,
      isDirectory: true,
      size: 0,
      isParentNav: true,
    }
    return [parentItem, ...list]
  }

  return list
})
const selectedItems = computed<ImageItem[]>(() => {
  if (!selectedPaths.value || selectedPaths.value.length === 0) return []

  const byPath = new Map(items.value.map((item) => [item.path, item]))
  return selectedPaths.value
    .map((path) => byPath.get(path))
    .filter((item): item is ImageItem => Boolean(item))
})
const breadcrumbs = computed<Breadcrumb[]>(() => {
  const basePath = currentPath.value || rootPath.value
  if (!basePath) return []

  const normalized = normalizePath(basePath).replace(/\/+$/, '')
  if (!normalized) return []

  // Windows drive path: D:/a/b -> D: > a > b
  if (/^[A-Za-z]:/.test(normalized)) {
    const drive = normalized.slice(0, 2)
    const tail = normalized.slice(2).replace(/^\/+/, '')
    const result: Breadcrumb[] = [{ name: drive, path: `${drive}/` }]

    if (!tail) return result

    let accumulated = `${drive}/`
    for (const segment of tail.split('/').filter(Boolean)) {
      accumulated = `${accumulated.replace(/\/+$/, '')}/${segment}`
      result.push({ name: segment, path: accumulated })
    }
    return result
  }

  // POSIX-like absolute path: /a/b -> / > a > b
  if (normalized.startsWith('/')) {
    const segments = normalized.split('/').filter(Boolean)
    const result: Breadcrumb[] = [{ name: '/', path: '/' }]
    let accumulated = ''
    for (const segment of segments) {
      accumulated = `${accumulated}/${segment}`
      result.push({ name: segment, path: accumulated })
    }
    return result
  }

  // Fallback (relative path)
  const segments = normalized.split('/').filter(Boolean)
  const result: Breadcrumb[] = []
  let accumulated = ''
  for (const segment of segments) {
    accumulated = accumulated ? `${accumulated}/${segment}` : segment
    result.push({ name: segment, path: accumulated })
  }
  return result
})
//#endregion

//#region 'selection'
function toggleSelection(path: string): void {
  const index = selectedPaths.value.indexOf(path)
  if (index >= 0) {
    selectedPaths.value.splice(index, 1)
    return
  }

  selectedPaths.value = [...selectedPaths.value, path]
}

function onItemClick(event: MouseEvent, item: ImageItem): void {
  if (event.ctrlKey) {
    if (parentPath.value !== null) {
      const parentIndex = selectedPaths.value.indexOf(parentPath.value)
      if (parentIndex >= 0) selectedPaths.value.splice(parentIndex, 1)
    }
    if (!item.isParentNav) {
      toggleSelection(item.path)
    }
    return
  }
  selectedPaths.value = [item.path]
}
//#endregion

//#region 'workspace change': chooseroot, openitem, goup, breadcrumbs， refresh(to self), create folder(to self)
async function chooseRootDirectory(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  statusMessage.value = ''
  const options: OpenFileOptions = {
    behavior: 'path',
    isMultiselection: false,
    broadcastInfo: 'imgmanager-chooseroot',
    dialogProperties: ['openDirectory', 'createDirectory'],
    dev: {
      source: 'imagemanager-chooseRootDirectory',
      message: 'ImgManager选择根目录功能'
    }
  }

  try {
    const [filePath, _content, details] = await window.api.openFileSignal(options)

    if (details?.isDialogCanceled) {
      statusMessage.value = 'Root selection canceled.'
      return
    }

    const selectedPath = Array.isArray(filePath) ? filePath[0] : filePath
    if (!selectedPath) {
      statusMessage.value = 'No root directory selected.'
      return
    }

    const savedRootPath = await window.api.imagesSetRoot(selectedPath)
    await loadDirectory(savedRootPath)
    statusMessage.value = `Root updated: ${normalizePath(savedRootPath)}`
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}
async function goToBreadcrumb(path: string): Promise<void> {
  await loadDirectory(path)
}
async function refresh(): Promise<void> {
  if (!hasRoot.value) return
  await loadDirectory(currentPath.value || undefined)
}
async function goUp(): Promise<void> {
  if (!parentPath.value) return
  await loadDirectory(parentPath.value)
}
async function openItem(item: ImageItem): Promise<void> {
  if (renamingPath.value) return

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
    await refresh()
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}
//#endregion

//#region 'drag-drop'
function isSamePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b)
}
function getInternalDragSources(dataTransfer: DataTransfer | null | undefined): string[] {
  if (!dataTransfer) return []

  const multi = dataTransfer.getData('application/x-images-item-paths')
  let transferData: string[] = []
  if (multi) {
    try {
      const parsed = JSON.parse(multi)
      if (Array.isArray(parsed)) {
        transferData = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
      }
    } catch {
      // ignore malformed payload
    }
  }
  return transferData
}
function hasInternalDragData(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false
  const types = Array.from(dataTransfer.types ?? [])
  return types.includes('application/x-images-item-paths')
}
function isExternalFileDrag(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false
  const types = Array.from(dataTransfer.types ?? [])
  return types.includes('Files') && !hasInternalDragData(dataTransfer)
}
async function handleDrop(event: DragEvent, targetDir: string): Promise<void> {
  if (!targetDir) return

  const internalSources = getInternalDragSources(event.dataTransfer)
  const files = Array.from(event.dataTransfer?.files ?? []) as Array<File>
  const externalSources = files.map((f) => window.electron.webUtils.getPathForFile(f)).filter((p): p is string => Boolean(p))

  loading.value = true
  errorMessage.value = ''
  try {
    if (internalSources.length > 0) {
      const moveSources = internalSources.filter((source) => !isSamePath(source, targetDir))
      if (moveSources.length === 0) return

      const results = await Promise.allSettled(
        moveSources.map((source) => window.api.imagesMove(source, targetDir))
      )
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.length - successCount

      statusMessage.value = failCount === 0
        ? `Moved ${successCount} item(s).`
        : `Moved ${successCount} item(s), failed ${failCount} item(s).`

      await loadDirectory(currentPath.value)
      return
    } else if (externalSources.length > 0) {
      const imported = await window.api.imagesImportFiles(targetDir, externalSources)
      statusMessage.value = imported.length > 0 ? `Imported ${imported.length} file(s)` : 'No image files imported'
      await loadDirectory(currentPath.value)
    }
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

  const useMulti = selectedPaths.value.length > 1 && selectedPaths.value.includes(item.path)
  dragTargetPaths.value = useMulti ? selectedPaths.value : [item.path]

  event.dataTransfer?.setData('application/x-images-item-paths', JSON.stringify(dragTargetPaths.value))
  event.dataTransfer?.setData('text/plain', dragTargetPaths.value.join('\n'))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function getDropTargetDir(item: ImageItem): string | null {
  if (item.isParentNav) return item.path || null
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
  if (!dropDir || dragTargetPaths.value?.includes(dropDir)) return
  event.preventDefault()
  dragEnterDepthMap.delete(item.path)
  dropTargetPath.value = null
  await handleDrop(event, dropDir)
}
function onWorkspaceDragOver(event: DragEvent): void {
  if (!isExternalFileDrag(event.dataTransfer)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}
async function onWorkspaceDrop(event: DragEvent): Promise<void> {
  if (!isExternalFileDrag(event.dataTransfer)) return
  event.preventDefault()
  dragEnterDepthMap.clear()
  dropTargetPath.value = null
  await handleDrop(event, currentPath.value)
}
//#endregion

function displayNameForPath(path: string): string {
  const normalized = normalizePath(path).replace(/\/+$/, '')
  if (/^[A-Za-z]:$/.test(normalized)) return normalized
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || normalized
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
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

async function startRenameSelected(): Promise<void> {
  if (selectedItems.value.length === 1) {
    const selectedItem = selectedItems.value[0]
    if (loading.value || renamingPath.value) return
    renamingPath.value = selectedItem.path
    renamingName.value = selectedItem.name
    await nextTick()
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  }
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
    selectedPaths.value = [renamedPath]
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
  const target = event.target as HTMLElement | null
  if (target?.tagName === 'INPUT' || target?.isContentEditable) return

  if (event.key === 'Delete') {
    event.preventDefault()
    void deleteSelected()
    return
  }

  if (event.key !== 'F2' || selectedPaths.value.length !== 1 || renamingPath.value) return
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

async function deleteSelected(): Promise<void> {
  if (loading.value) return
  if (renamingPath.value) return

  const targets = Array.from(new Set(selectedItems.value.map((item) => item.path)))
  if (targets.length === 0) return

  loading.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.imagesDelete(targets)
    const failedCount = result.failedPaths.length

    statusMessage.value =
      failedCount === 0
        ? `Deleted ${result.deletedCount} item(s).`
        : `Deleted ${result.deletedCount} item(s), failed ${failedCount} item(s).`

    selectedPaths.value = []
    await loadDirectory(currentPath.value || undefined)
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function openConfigPlaceholder(): Promise<void> {
  try {
    await window.api.openSettingsWindow('/images')
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  void initialize()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <div class="images-window" @dragover.prevent.stop="onWorkspaceDragOver" @drop.prevent.stop="onWorkspaceDrop">
    <div class="toolbar">
      <div class="toolbar-left">
        <button @click="goUp" :disabled="!canGoUp || loading" title="Go up">Up</button>
        <button @click="refresh" :disabled="!hasRoot || loading" title="Refresh">Refresh</button>
      </div>

      <div class="toolbar-spacer"></div>

      <div class="toolbar-right">
        <button @click="importByDialog" :disabled="loading || !hasRoot">Import Images</button>
        <button @click="createFolder" :disabled="loading || !hasRoot">New Folder</button>
        <button @click="openConfigPlaceholder" :disabled="loading">Image Config</button>
      </div>
    </div>

    <div class="breadcrumb-row" v-if="hasRoot">
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
        <button class="crumb-link" :class="{ 'is-last': index === breadcrumbs.length - 1 }"
          @click="goToBreadcrumb(crumb.path)" :disabled="loading || index === breadcrumbs.length - 1"
          :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined">
          {{ crumb.name }}
        </button>
      </template>
    </div>
    <div class="breadcrumb-row" v-else>
      <span class="path-hint">Please select an image root folder first.</span>
    </div>

    <div class="content" v-if="hasRoot">
      <div v-if="sortedItems.length === 0" class="empty-state">
        <p>This folder is empty. Drag images here or use "Import Images".</p>
      </div>

      <div v-else class="item-grid">
        <div v-for="item in sortedItems" :key="item.path" class="item-card"
          :class="{ selected: isPathSelected(item.path), 'drop-target': dropTargetPath === item.path && !dragTargetPaths?.includes(item.path) }"
          :draggable="renamingPath !== item.path && !item.isParentNav" @click="onItemClick($event, item)"
          @dblclick="openItem(item)" @dragstart="onItemDragStart($event, item)" @dragenter="onItemDragEnter($event, item)"
          @dragover.prevent.stop="onItemDragOver($event, item)" @dragleave="onItemDragLeave($event, item)"
          @drop.prevent.stop="onItemDrop($event, item)">
          <div class="thumb">
            <template v-if="item.isDirectory">
              <div class="folder-icon">DIR</div>
            </template>
            <template v-else>
              <img :src="toImageSrc(item.path)" :alt="item.name" />
            </template>
          </div>

          <template v-if="renamingPath === item.path">
            <input :ref="(el) => { renameInputRef = el as HTMLInputElement | null }" v-model="renamingName"
              class="rename-input" @click.stop @dblclick.stop @keydown="onRenameInputKeydown" @blur="commitRename" />
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

.toolbar-spacer {
  min-width: 0;
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

.breadcrumb-row {
  display: flex;
  align-items: center;
  min-height: 28px;
  gap: 0;
  padding: 4px 12px;
  border-bottom: 1px solid #eaeef2;
  background: #f8fafc;
  white-space: nowrap;
  overflow-x: auto;
}

.crumb-link {
  border: none;
  background: transparent;
  padding: 0;
  height: 20px;
  max-width: 96px;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #57606a;
  text-decoration: none;
  font-size: 12px;
  line-height: 20px;
}

.crumb-link::after {
  content: '>';
  color: #8c959f;
  padding: 0 4px;
}

.crumb-link.is-last::after {
  content: '';
  padding: 0;
}

.crumb-link:hover:not(:disabled) {
  color: #0969da;
}

.crumb-link:disabled {
  color: #24292f;
  text-decoration: none;
  cursor: default;
  opacity: 1;
}

.path-hint {
  color: #656d76;
  font-size: 12px;
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


