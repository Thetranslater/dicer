<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import type { FSNode, OpenOption, SaveOption } from '../utils/fileService'
import AssetCard from '../components/asset/Asset.vue'
import ComponentView from '../components/asset/Component.vue'

type AssetExplorerItem = {
  name: string
  path: string
  isDirectory: boolean
  isAssetFile?: boolean
  isParentNav?: boolean
}

type AssetComponentNode = {
  id: string
  type: string
  props: Record<string, unknown>
}

type AssetDocument = {
  name: string
  components: AssetComponentNode[]
}

let runtimeComponentIdSeed = 0

function createRuntimeComponentId(): string {
  runtimeComponentIdSeed += 1
  return `component-${Date.now()}-${runtimeComponentIdSeed}`
}

const ASSET_MODULE_NAME = 'asset'

type AssetModuleConfig = {
  root?: string
}

const MIN_PANE_HEIGHT = 150
const DEFAULT_TOP_PANE_HEIGHT = 320

const containerRef = ref<HTMLElement | null>(null)
const topPaneHeight = ref(DEFAULT_TOP_PANE_HEIGHT)
const isResizing = ref(false)

const assetsRootPath = ref('')
const currentPath = ref('')
const items = ref<AssetExplorerItem[]>([])

const selectedPath = ref<string | null>(null)
const selectedAssetPath = ref<string | null>(null)
const selectedAsset = ref<AssetDocument | null>(null)

const activeComponentId = ref<string | null>(null)
const expandedComponentIds = ref<string[]>([])

const searchKeyword = ref('')
const loading = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)
const renamingPath = ref<string | null>(null)
const renamingName = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const renamingBusy = ref(false)

const hasAssetsRoot = computed(() => Boolean(assetsRootPath.value))
const hasSelectedAsset = computed(() => Boolean(selectedAsset.value && selectedAssetPath.value))
const selectedExplorerItem = computed<AssetExplorerItem | null>(() => {
  if (!selectedPath.value) return null
  return (
    visibleItems.value.find((item) => item.path === selectedPath.value) ??
    items.value.find((item) => item.path === selectedPath.value) ??
    null
  )
})

watch(activeComponentId, (value) => {
  console.log('[AssetWindow] activeComponentId =>', value)
})

const visibleItems = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  let list = [...items.value]

  if (keyword) {
    list = list.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword)
      )
    })
  }

  list.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'en-US')
  })

  const rootKey = assetsRootPath.value.toLowerCase()
  const currentKey = currentPath.value.toLowerCase()
  if (currentPath.value && rootKey && currentKey !== rootKey) {
    const parentPath = getParentPath(currentPath.value)
    if (parentPath) {
      list = [
        {
          name: '..',
          path: parentPath,
          isDirectory: true,
          isAssetFile: false,
          isParentNav: true,
        },
        ...list
      ]
    }
  }

  return list
})

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAssetFileName(name: string): boolean {
  return /\.asset\.json$/i.test(name)
}

function stripAssetExt(name: string): string {
  return name.replace(/\.asset\.json$/i, '')
}

function joinPath(basePath: string, fileName: string): string {
  return `${basePath.replace(/[\\/]+$/, '')}/${fileName}`.replace(/\\/g, '/')
}

function getParentPath(path: string): string | null {
  const cleaned = path
  if (!cleaned) return null
  if (cleaned === '/') return null
  if (/^[A-Za-z]:$/i.test(cleaned)) return null
  if (/^[A-Za-z]:\/$/i.test(`${cleaned}/`)) return null

  const index = cleaned.lastIndexOf('/')
  if (index < 0) return null

  const parent = cleaned.slice(0, index)
  if (!parent) return '/'
  if (/^[A-Za-z]:$/i.test(parent)) return `${parent}/`
  return parent
}

function toDirectExplorerItems(nodes: FSNode[]): AssetExplorerItem[] {
  return nodes
    .filter((node) => {
      if (!node || !node.path || !node.name) return false
      if (node.isDir) return true
      return isAssetFileName(node.name)
    })
    .map((node) => ({
      name: node.isDir ? node.name : stripAssetExt(node.name),
      path: node.path,
      isDirectory: node.isDir,
      isAssetFile: !node.isDir && isAssetFileName(node.name)
    }))
}

function normalizeComponentNode(raw: unknown, _index: number): AssetComponentNode | null {
  if (!isRecord(raw)) return null

  const id = createRuntimeComponentId()
  const type = typeof raw.type === 'string' && raw.type.trim().length > 0 ? raw.type : 'PlaceholderComponent'
  const props = isRecord(raw.props) ? raw.props : {}

  return { id, type, props }
}

function normalizeAssetDocument(raw: unknown, fallbackName: string): AssetDocument {
  if (!isRecord(raw)) return { name: fallbackName, components: [] }

  const normalizedName =
    typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : fallbackName

  const rawComponents = Array.isArray(raw.components) ? raw.components : []
  const normalizedComponents = rawComponents
    .map((item, index) => normalizeComponentNode(item, index))
    .filter((item): item is AssetComponentNode => Boolean(item))

  return {
    name: normalizedName,
    components: normalizedComponents
  }
}

function toPersistedAssetDocument(doc: AssetDocument): {
  name: string
  components: Array<{ type: string; props: Record<string, unknown> }>
} {
  return {
    name: doc.name,
    components: doc.components.map((component) => ({
      type: component.type,
      props: component.props
    }))
  }
}

function resetInspector(): void {
  selectedAssetPath.value = null
  selectedAsset.value = null
  activeComponentId.value = null
  expandedComponentIds.value = []
}

async function loadAssets(targetPath?: string): Promise<void> {
  const pathToLoad = targetPath || currentPath.value || assetsRootPath.value
  if (!pathToLoad) return

  loading.value = true
  try {
    const option: OpenOption = {
      fileOption: {
        isLoad: false
      },
      dirOption: {
        path: [pathToLoad],
        isRecursive: false
      }
    }

    const fsnodes = await window.api.fs.open(option)
    const rootNode = fsnodes[0]
    const children = Array.isArray(rootNode?.children) ? rootNode.children : []

    currentPath.value = rootNode?.path || pathToLoad
    items.value = toDirectExplorerItems(children)
  } catch (error) {
    console.error('[AssetWindow] loadAssets failed', toErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadAssetDocument(assetPath: string): Promise<void> {
  try {
    const option: OpenOption = {
      fileOption: {
        path: [assetPath],
        isLoad: true
      }
    }

    const fsnodes = await window.api.fs.open(option)
    if (fsnodes.length !== 1) {
      throw new Error(`Unable to open asset file: ${assetPath}`)
    }

    const fsnode = fsnodes[0]
    const rawData = typeof fsnode.data === 'string' ? fsnode.data : String(fsnode.data ?? '')
    const parsed = JSON.parse(rawData)
    const fallbackName = stripAssetExt(fsnode.name || '')

    const doc = normalizeAssetDocument(parsed, fallbackName)

    selectedAssetPath.value = assetPath
    selectedAsset.value = doc
    activeComponentId.value = doc.components[0]?.id ?? null
    expandedComponentIds.value = doc.components[0]?.id ? [doc.components[0].id] : []
  } catch (error) {
    resetInspector()
    console.error('[AssetWindow] loadAssetDocument failed', toErrorMessage(error))
  }
}

async function saveSelectedAssetDocument(): Promise<boolean> {
  if (!selectedAssetPath.value || !selectedAsset.value) return false

  try {
    const option: SaveOption = { path: [selectedAssetPath.value] }
    const persistedDoc = toPersistedAssetDocument(selectedAsset.value)
    await window.api.fs.save([JSON.stringify(persistedDoc, null, 2)], option)
    return true
  } catch (error) {
    console.error('[AssetWindow] saveSelectedAssetDocument failed', toErrorMessage(error))
    return false
  }
}

async function initialize(): Promise<void> {
  loading.value = true
  try {
    const rawAssetConfig = await window.api.cfg.get(ASSET_MODULE_NAME)
    const assetRootFromConfig =
      rawAssetConfig && typeof (rawAssetConfig as AssetModuleConfig).root === 'string'
        ? (rawAssetConfig as AssetModuleConfig).root?.trim()
        : ''

    let resolvedRoot = assetRootFromConfig || ''

    if (!resolvedRoot) {
      const rawProjectConfig = await window.api.cfg.get('project')
      const projectRoot =
        rawProjectConfig &&
          typeof (rawProjectConfig as { root?: unknown }).root === 'string'
          ? String((rawProjectConfig as { root?: unknown }).root).trim()
          : ''

      if (!projectRoot) {
        throw new Error('Asset root is not configured, and project.root is unavailable.')
      }

      const migratedRoot = joinPath(projectRoot, 'assets')
      const saved = await window.api.cfg.set(ASSET_MODULE_NAME, { root: migratedRoot })
      if (!saved) {
        throw new Error('Failed to migrate legacy config: unable to save asset.root.')
      }

      resolvedRoot = migratedRoot
      console.info('[AssetWindow] migrated legacy config to asset.root:', resolvedRoot)
    }

    assetsRootPath.value = resolvedRoot
    currentPath.value = resolvedRoot

    await window.api.fs.mkdir(assetsRootPath.value)
    await loadAssets(resolvedRoot)
  } catch (error) {
    console.error('[AssetWindow] initialize failed', toErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function makeUniqueName(base: string, existingLowercase: Set<string>): string {
  if (!existingLowercase.has(base.toLowerCase())) return base
  let i = 1
  while (true) {
    const next = `${base} (${i})`
    if (!existingLowercase.has(next.toLowerCase())) return next
    i += 1
  }
}

async function createFolder(): Promise<void> {
  if (!assetsRootPath.value) return

  loading.value = true
  try {
    const baseDir = currentPath.value || assetsRootPath.value
    const baseDirKey = baseDir.toLowerCase()
    const existingDirNames = new Set(
      items.value
        .filter((item) => {
          if (!item.isDirectory) return false
          const itemPathKey = item.path.toLowerCase()
          return itemPathKey === baseDirKey || itemPathKey.startsWith(`${baseDirKey}/`)
        })
        .map((item) => item.name.toLowerCase())
    )

    const folderName = makeUniqueName('New Folder', existingDirNames)
    const folderPath = joinPath(baseDir, folderName)

    await window.api.fs.mkdir(folderPath)
    await loadAssets()
  } catch (error) {
    console.error('[AssetWindow] createFolder failed', toErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function createAsset(): Promise<void> {
  if (!assetsRootPath.value) return

  loading.value = true
  try {
    const baseDir = currentPath.value || assetsRootPath.value
    const baseDirKey = baseDir.toLowerCase()
    const existingAssetNames = new Set(
      items.value
        .filter((item) => {
          if (!item.isAssetFile) return false
          const itemPathKey = item.path.toLowerCase()
          return itemPathKey === baseDirKey || itemPathKey.startsWith(`${baseDirKey}/`)
        })
        .map((item) => item.name.toLowerCase())
    )

    const assetName = makeUniqueName('New Asset', existingAssetNames)
    const assetPath = joinPath(baseDir, `${assetName}.asset.json`)

    const doc: AssetDocument = {
      name: assetName,
      components: []
    }

    const option: SaveOption = { path: [assetPath] }
    await window.api.fs.save([JSON.stringify(doc, null, 2)], option)

    await loadAssets()
  } catch (error) {
    console.error('[AssetWindow] createAsset failed', toErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function selectItem(item: AssetExplorerItem): Promise<void> {
  selectedPath.value = item.path

  if (item.isAssetFile && !item.isDirectory) {
    await loadAssetDocument(item.path)
    return
  }

  //resetInspector()
}

async function openItem(item: AssetExplorerItem): Promise<void> {
  if (renamingPath.value) {
    await commitRename()
  }

  await selectItem(item)

  if (item.isDirectory) {
    await loadAssets(item.path)
  }
}

//#region drag-drop
const dragSourcePath = ref<string | null>(null)
const dropTargetPath = ref<string | null>(null)
const dropDoor = ref<EventTarget | null>(null)

function onItemDragStart(event: DragEvent, item: AssetExplorerItem): void {
  if (item.isParentNav) {
    event.preventDefault()
    return
  }
  dropDoor.value = null
  dragSourcePath.value = item.path
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', item.path)
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onItemDragOver(event: DragEvent, item: AssetExplorerItem): void {
  if (!item.isDirectory) return
  event.preventDefault()
}

function onItemDragEnter(event: DragEvent, item: AssetExplorerItem): void {
  if (!item.isDirectory) return
  event.preventDefault()
  dropDoor.value = event.target
  dropTargetPath.value = item.path
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onItemDragLeave(event: DragEvent, item: AssetExplorerItem): void {
  if (!item.isDirectory) return
  event.preventDefault()
  if (dropDoor.value !== event.target) return
  dropDoor.value = null
  if (dropTargetPath.value === item.path) {
    dropTargetPath.value = null
  }
}

async function onItemDrop(event: DragEvent, item: AssetExplorerItem): Promise<void> {
  if (!item.isDirectory) return

  event.preventDefault()

  const sourcePath = dragSourcePath.value || event.dataTransfer?.getData('text/plain') || ''
  if (!sourcePath) {
    dropDoor.value = null
    dropTargetPath.value = null
    return
  }

  if (sourcePath === item.path) {
    dropDoor.value = null
    dropTargetPath.value = null
    dragSourcePath.value = null
    return
  }

  loading.value = true
  try {
    await window.api.fs.mv(sourcePath, item.path)
    await loadAssets(currentPath.value)

  } catch (error) {
    console.error('[AssetWindow] onItemDrop failed', toErrorMessage(error))
  } finally {
    loading.value = false
    dropDoor.value = null
    dropTargetPath.value = null
    dragSourcePath.value = null
  }
}
//#endregion

function cancelRename(): void {
  renamingPath.value = null
  renamingName.value = ''
}

async function startRenameSelected(): Promise<void> {
  const item = selectedExplorerItem.value
  if (!item || item.isParentNav || loading.value) return

  renamingPath.value = item.path
  renamingName.value = item.name

  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

async function commitRename(): Promise<void> {
  if (!renamingPath.value || renamingBusy.value) return

  const item =
    visibleItems.value.find((entry) => entry.path === renamingPath.value) ??
    items.value.find((entry) => entry.path === renamingPath.value) ??
    null

  if (!item || item.isParentNav) {
    cancelRename()
    return
  }

  const rawName = renamingName.value.trim()
  if (!rawName) {
    cancelRename()
    return
  }

  let finalName = rawName
  if (item.isAssetFile) {
    const baseName = stripAssetExt(rawName).trim()
    if (!baseName) {
      cancelRename()
      return
    }
    finalName = `${baseName}.asset.json`
  }

  renamingBusy.value = true
  loading.value = true
  try {
    const renamedPath = await window.api.fs.rnm(item.path, finalName)
    await loadAssets(currentPath.value)
    selectedPath.value = renamedPath

    if (selectedAssetPath.value === item.path) {
      selectedAssetPath.value = renamedPath
    }
  } catch (error) {
    console.error('[AssetWindow] commitRename failed', toErrorMessage(error))
  } finally {
    renamingBusy.value = false
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

function setRenameInputRef(el: Element | ComponentPublicInstance | null): void {
  renameInputRef.value = el instanceof HTMLInputElement ? el : null
}

async function deleteSelectedItem(): Promise<void> {
  const item = selectedExplorerItem.value
  if (!item || item.isParentNav || loading.value || renamingBusy.value) return

  loading.value = true
  try {
    await window.api.fs.rm([item.path])

    if (selectedAssetPath.value === item.path) {
      resetInspector()
    }

    selectedPath.value = null
    await loadAssets(currentPath.value)
  } catch (error) {
    console.error('[AssetWindow] deleteSelectedItem failed', toErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) return

  if (event.key === 'F2') {
    event.preventDefault()
    void startRenameSelected()
    return
  }

  if (event.key === 'Delete') {
    event.preventDefault()
    void deleteSelectedItem()
  }
}

function setTopPaneHeight(nextHeight: number): void {
  const container = containerRef.value
  if (!container) return

  const maxHeight = Math.max(MIN_PANE_HEIGHT, container.clientHeight - MIN_PANE_HEIGHT)
  const clamped = Math.max(MIN_PANE_HEIGHT, Math.min(maxHeight, Math.round(nextHeight)))
  topPaneHeight.value = clamped
}

function onDividerMouseDown(event: MouseEvent): void {
  event.preventDefault()
  if (!containerRef.value) return

  isResizing.value = true
  resizeStartY.value = event.clientY
  resizeStartHeight.value = topPaneHeight.value

  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
}

function onWindowMouseMove(event: MouseEvent): void {
  if (!isResizing.value) return
  const delta = event.clientY - resizeStartY.value
  setTopPaneHeight(resizeStartHeight.value + delta)
}

function onWindowMouseUp(): void {
  if (!isResizing.value) return
  isResizing.value = false
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
}

function isExpanded(componentId: string): boolean {
  return expandedComponentIds.value.includes(componentId)
}

function toggleComponentNode(componentId: string): void {
  const index = expandedComponentIds.value.indexOf(componentId)
  if (index >= 0) {
    expandedComponentIds.value.splice(index, 1)
    activeComponentId.value = null
    return
  }

  expandedComponentIds.value = [...expandedComponentIds.value, componentId]
  activeComponentId.value = componentId
}

function createDefaultComponentProps(type: string): Record<string, unknown> {
  if (type === 'CharacterComponent') {
    return {
      name: '',
      role: 'Warrior',
      faction: '',
      hp: 100,
      attack: 10,
      defense: 8,
      agility: 8
    }
  }

  if (type === 'ItemComponent') {
    return {
      name: '',
      element: 'None',
      weaponType: 'None',
      rarity: 'Common',
      enchantments: [],
      stackable: false,
      consumable: false
    }
  }

  return {
    note: 'Edit this component in a concrete implementation.'
  }
}

async function addComponentByType(type: string): Promise<void> {
  if (!selectedAsset.value) return

  const id = createRuntimeComponentId()
  selectedAsset.value.components.push({
    id,
    type,
    props: createDefaultComponentProps(type)
  })

  const saved = await saveSelectedAssetDocument()
  if (saved) {
    activeComponentId.value = id
    if (!expandedComponentIds.value.includes(id)) {
      expandedComponentIds.value = [...expandedComponentIds.value, id]
    }
  }
}

async function onComponentPropsChange(componentId: string, nextProps: Record<string, unknown>): Promise<void> {
  if (!selectedAsset.value) return

  const index = selectedAsset.value.components.findIndex((component) => component.id === componentId)
  if (index < 0) return

  selectedAsset.value.components[index] = {
    ...selectedAsset.value.components[index],
    props: nextProps
  }

  await saveSelectedAssetDocument()
}

async function removeActiveComponent(): Promise<void> {
  if (!selectedAsset.value || !activeComponentId.value) return

  const idx = selectedAsset.value.components.findIndex((item) => item.id === activeComponentId.value)
  if (idx < 0) return

  const removedId = selectedAsset.value.components[idx].id
  selectedAsset.value.components.splice(idx, 1)

  const saved = await saveSelectedAssetDocument()
  if (saved) {
    expandedComponentIds.value = expandedComponentIds.value.filter((id) => id !== removedId)
    activeComponentId.value = selectedAsset.value.components[0]?.id ?? null
  }
}

async function reloadSelectedAsset(): Promise<void> {
  if (!selectedAssetPath.value) return
  await loadAssetDocument(selectedAssetPath.value)
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  initialize()
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <div ref="containerRef" class="asset-window">
    <div class="pane pane-top" :style="{ height: `${topPaneHeight}px` }">
      <div class="toolbar">
        <div class="toolbar-left">
          <button @click="loadAssets()" :disabled="loading || !hasAssetsRoot">Refresh</button>
          <button @click="createFolder" :disabled="loading || !hasAssetsRoot">New Folder</button>
          <button @click="createAsset" :disabled="loading || !hasAssetsRoot">New Asset</button>
        </div>
        <div class="toolbar-right">
          <input v-model="searchKeyword" class="search-input" type="text" placeholder="Search assets..."
            :disabled="loading || !hasAssetsRoot" />
        </div>
      </div>

      <div v-if="!hasAssetsRoot" class="empty">
        Asset root is not available. Please load a project first.
      </div>

      <div v-else-if="visibleItems.length === 0" class="empty">
        No assets found.
      </div>

      <div v-else class="asset-grid">
        <div v-for="item in visibleItems" :key="item.path" class="asset-cell"
          :draggable="!item.isParentNav && item.path !== renamingPath" @click="void selectItem(item)"
          @dblclick="void openItem(item)" @dragstart="onItemDragStart($event, item)"
          @dragover.prevent.stop="onItemDragOver($event, item)" @dragenter="onItemDragEnter($event, item)"
          @dragleave="onItemDragLeave($event, item)" @drop.prevent.stop="void onItemDrop($event, item)">
          <AssetCard :item="item" :selected="selectedPath === item.path"
            :drop-target="item.isDirectory && dropTargetPath === item.path && dragSourcePath !== item.path">
            <template #name>
              <input v-if="renamingPath === item.path" :ref="setRenameInputRef" v-model="renamingName"
                class="rename-input-inline" @click.stop @dblclick.stop @keydown="onRenameInputKeydown"
                @blur="commitRename" />
              <span v-else :title="item.name">{{ item.name }}</span>
            </template>
          </AssetCard>
        </div>
      </div>
    </div>

    <div class="divider" @mousedown="onDividerMouseDown">
      <div class="divider-handle"></div>
    </div>

    <div class="pane pane-bottom">
      <div class="inspector-head">
        <div class="inspector-title">Inspector</div>
        <div class="inspector-actions">
          <button @click="reloadSelectedAsset" :disabled="loading || !hasSelectedAsset">Reload</button>
          <button @click="addComponentByType('CharacterComponent')" :disabled="loading || !hasSelectedAsset">
            Add Character
          </button>
          <button @click="addComponentByType('ItemComponent')" :disabled="loading || !hasSelectedAsset">
            Add Item
          </button>
          <button @click="removeActiveComponent" :disabled="loading || !activeComponentId">Remove Component</button>
        </div>
      </div>

      <div v-if="!selectedAsset" class="empty">
        Select an asset file to inspect its components.
      </div>

      <div v-else class="inspector-tree">
        <div v-for="component in selectedAsset.components" :key="component.id" class="component-node">
          <div class="node-head" :class="{ active: activeComponentId === component.id }">
            <button class="node-toggle" @click.stop="toggleComponentNode(component.id)">
              {{ isExpanded(component.id) ? '▲' : '▼' }}
            </button>
            <span class="node-label">{{ component.type }}</span>
          </div>

          <div v-if="isExpanded(component.id)" class="node-body">
            <ComponentView :component-data="component" @change="void onComponentPropsChange(component.id, $event)" />
          </div>
        </div>

        <div v-if="selectedAsset.components.length === 0" class="component-empty">
          This asset has no components.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-window {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  color: #1f2328;
  overflow: hidden;
}

.pane {
  min-height: 0;
  min-width: 0;
}

.pane-top {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #d0d7de;
  background: #f8fafc;
  overflow: hidden;
}

.toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #e5e7eb;
  padding: 8px 12px;
  background: #f6f8fa;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.toolbar button,
.inspector-actions button {
  height: 30px;
  border: 1px solid #d0d7de;
  background: #fff;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
  cursor: pointer;
}

.toolbar button:disabled,
.inspector-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-input {
  width: min(260px, 45vw);
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
  font-size: 13px;
}

.rename-input-inline {
  width: 100%;
  height: 24px;
  border: 1px solid #0969da;
  border-radius: 4px;
  padding: 0 6px;
  background: #fff;
  font-size: 11px;
  line-height: 1;
  box-sizing: border-box;
  outline: none;
}

.asset-grid {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, 96px);
  grid-auto-rows: 92px;
  justify-content: flex-start;
  align-content: flex-start;
  gap: 8px;
}

.asset-cell {
  user-select: none;
  width: 96px;
  height: 92px;
}

.divider {
  height: 8px;
  background: #e5e7eb;
  cursor: row-resize;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.divider-handle {
  width: 56px;
  height: 2px;
  border-radius: 999px;
  background: #9aa4b2;
}

.pane-bottom {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.inspector-head {
  height: 44px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: #f9fafb;
}

.inspector-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2328;
}

.inspector-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inspector-tree {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 10px;
  display: block;
}

.component-node {
  border: none;
  border-radius: 0;
  background: transparent;
  overflow: visible;
  margin-bottom: 0;
  flex: 0 0 auto;
}

.component-node:last-child {
  margin-bottom: 0;
}

.node-head {
  display: grid;
  grid-template-columns: 14px 1fr;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

.node-head.active {
  background: transparent;
  border-color: #0969da;
}

.node-toggle {
  width: auto;
  height: auto;
  border: none;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0;
  margin: 0;
  color: #57606a;
}

.node-toggle:hover {
  color: #1f2328;
}

.node-label {
  font-size: 12px;
  color: #1f2328;
  line-height: 1.2;
}

.node-body {
  padding: 4px 0 8px 18px;
}

.component-empty,
.empty {
  color: #6b7280;
  font-size: 13px;
  padding: 12px;
}
</style>
