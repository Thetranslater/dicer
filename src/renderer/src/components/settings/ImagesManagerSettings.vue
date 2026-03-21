<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { FileService, type OpenFileOptions } from '../../utils/fileService'

type ImageAttachmentMappingItem = {
  imagePath: string
  attachmentUrl: string
}

const ROOT_PICKER_CALLBACK_KEY = 'settings-images-root-picker'

const rootPath = ref<string | null>(null)
const mappings = ref<ImageAttachmentMappingItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function loadMappings(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.imagesGetAttachmentMappings()
    rootPath.value = result.rootPath ? normalizePath(result.rootPath) : null
    mappings.value = result.items.map((item) => ({
      imagePath: item.imagePath,
      attachmentUrl: item.attachmentUrl
    }))
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function buildSavePayload(): Record<string, string> {
  const payload: Record<string, string> = {}
  for (const item of mappings.value) {
    const url = item.attachmentUrl.trim()
    if (!url) continue
    payload[item.imagePath] = url
  }
  return payload
}

async function saveSettings(): Promise<void> {
  saving.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const saved = await window.api.imagesSaveAttachmentMappings(buildSavePayload())
    await loadMappings()
    infoMessage.value = `Saved ${saved.savedCount} mapping(s) to config manager.`
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    saving.value = false
  }
}

async function chooseRootDirectory() {
  errorMessage.value = ''
  infoMessage.value = ''

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

  loading.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const savedRootPath = await window.api.imagesSetRoot(selectedPath)
    rootPath.value = normalizePath(savedRootPath)
    await loadMappings()
    infoMessage.value = 'Image root path has been updated.'
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function registerIpcCallbacks(): void {
}

onMounted(() => {
  registerIpcCallbacks()
  void loadMappings()
})

onBeforeUnmount(() => {
  FileService.OpenFileListeners.delete(ROOT_PICKER_CALLBACK_KEY)
})
</script>

<template>
  <section class="page">
    <h2>Images Manager</h2>

    <div class="toolbar">
      <label class="field-label">Root Path</label>
      <input class="root-input" :value="rootPath ?? ''" readonly placeholder="Not configured" />
      <button @click="chooseRootDirectory" :disabled="loading || saving">Choose Root</button>
      <button @click="loadMappings" :disabled="loading || saving">Reload</button>
      <button @click="saveSettings" :disabled="loading || saving || !rootPath">Save Mappings</button>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    <p v-else-if="infoMessage" class="info-text">{{ infoMessage }}</p>

    <div v-if="!rootPath" class="placeholder">
      Please choose an image root path first.
    </div>

    <div v-else-if="mappings.length === 0" class="placeholder">
      No managed images found under current root.
    </div>

    <div v-else class="mapping-list">
      <div v-for="item in mappings" :key="item.imagePath" class="mapping-row">
        <div class="image-path" :title="item.imagePath">{{ item.imagePath }}</div>
        <input v-model="item.attachmentUrl" class="url-input" type="text" placeholder="NGA attachment URL" />
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
  grid-template-columns: 90px 1fr auto auto auto;
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

.info-text {
  color: #0969da;
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
