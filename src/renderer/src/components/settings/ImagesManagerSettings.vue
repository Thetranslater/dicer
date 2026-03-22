<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { FileService, type OpenFileOptions } from '../../utils/fileService'

type ImageAttachmentMappingItem = {
  imagePath: string
  attachmentUrl: string
}

type ImageModuleConfig = {
  rootPath: string | null
  attachmentMappings: Record<string, string>
}

const rootPath = ref<string | null>(null)
const mappings = ref<ImageAttachmentMappingItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const isDirty = ref(false)

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function markDirty(): void {
  if (!isDirty.value) {
    isDirty.value = true
  }
}

function buildAttachmentMappingsPayload(): Record<string, string> {
  const payload: Record<string, string> = {}
  for (const item of mappings.value) {
    const url = item.attachmentUrl.trim()
    if (!url) continue
    payload[item.imagePath] = url
  }
  return payload
}

function buildConfigPayload(): ImageModuleConfig {
  return {
    rootPath: rootPath.value,
    attachmentMappings: buildAttachmentMappingsPayload()
  }
}

async function loadConfig(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.imagesGetAttachmentMappings()
    rootPath.value = result.rootPath ? await FileService.normalizePath(result.rootPath) : null
    mappings.value = result.items.map((item) => ({
      imagePath: item.imagePath,
      attachmentUrl: item.attachmentUrl
    }))
    isDirty.value = false
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function updateAttachmentUrl(index: number, nextValue: string): void {
  const item = mappings.value[index]
  if (!item) return
  if (item.attachmentUrl === nextValue) return
  item.attachmentUrl = nextValue
  markDirty()
}

function onMappingInput(index: number, event: Event): void {
  const target = event.target as HTMLInputElement | null
  updateAttachmentUrl(index, target?.value ?? '')
}

async function chooseRootDirectory() {
  errorMessage.value = ''

  const options: OpenFileOptions = {
    behavior: 'path',
    isMultiselection: false,
    broadcastInfo: 'settings-images-choose-root',
    dialogProperties: ['openDirectory', 'createDirectory'],
    dev: {
      source: 'settings-images-chooseRootDirectory',
      message: 'Choose root directory for image manager settings'
    }
  }

  const result = await window.api.openFileSignal(options)
  const selectedPath = Array.isArray(result[0]) ? result[0][0] : result[0]
  if (!selectedPath) return

  try {
    const normalized = await FileService.normalizePath(selectedPath)
    if (normalized !== rootPath.value) {
      rootPath.value = normalized
      markDirty()
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
}

async function persistConfigOnExit(): Promise<void> {
  if (!isDirty.value) return

  const payload = buildConfigPayload()
  try {
    await window.api.setConfig('image', payload)
    isDirty.value = false
    console.log('[ImagesManagerSettings] config saved on unmount', payload)
  } catch (error) {
    console.error('[ImagesManagerSettings] failed to save config on unmount', error)
  }
}

onMounted(() => {
  void loadConfig()
})

onBeforeUnmount(() => {
  void persistConfigOnExit()
})
</script>

<template>
  <section class="page">
    <h2>Images Manager</h2>

    <div class="toolbar">
      <label class="field-label">Root Path</label>
      <input class="root-input" :value="rootPath ?? ''" readonly placeholder="Not configured" />
      <button @click="chooseRootDirectory" :disabled="loading">Choose Root</button>
      <button @click="loadConfig" :disabled="loading">Reload</button>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <div v-if="!rootPath" class="placeholder">
      Please choose an image root path first.
    </div>

    <div v-else-if="mappings.length === 0" class="placeholder">
      No managed images found under current root.
    </div>

    <div v-else class="mapping-list">
      <div v-for="(item, index) in mappings" :key="item.imagePath" class="mapping-row">
        <div class="image-path" :title="item.imagePath">{{ item.imagePath }}</div>
        <input
          :value="item.attachmentUrl"
          class="url-input"
          type="text"
          placeholder="NGA attachment URL"
          @input="onMappingInput(index, $event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  width: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: grid;
  grid-template-columns: 90px 1fr auto auto;
  gap: 8px;
  align-items: center;
}

.field-label {
  font-size: 13px;
  color: #57606a;
}

.root-input,
.url-input {
  height: 32px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
}

.toolbar button {
  height: 32px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  padding: 0 12px;
  cursor: pointer;
}

.toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error-text {
  color: #cf222e;
  font-size: 13px;
  margin: 0;
}

.placeholder {
  color: #656d76;
  font-size: 14px;
  padding: 12px;
  border: 1px dashed #d0d7de;
  border-radius: 6px;
}

.mapping-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.mapping-row {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 2fr;
  gap: 10px;
  align-items: center;
}

.image-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #24292f;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 8px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
