<script setup lang="ts">
import { onMounted, ref } from 'vue'

type ProjectModuleConfig = {
  root?: string
  name?: string
}

type EditorModuleConfig = {
  baseFontSizePx?: number
  [key: string]: unknown
}

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

const projectConfig = ref<ProjectModuleConfig | null>(null)
const baseFontSize = ref('16px')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

function normalizePath(path?: string): string {
  if (!path) return ''
  return path.replace(/\\/g, '/')
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function parsePx(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)px$/i)
  if (!match) return 16
  const n = Number(match[1])
  if (!Number.isFinite(n) || n <= 0) return 16
  return Math.round(n)
}

function normalizeBaseFontSizeValue(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  const px = Number.isFinite(n) && n > 0 ? Math.round(n) : 16
  const candidate = `${px}px`
  return fontSizes.some((item) => item.value === candidate) ? candidate : '16px'
}

function toEditorModuleConfig(value: unknown): EditorModuleConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return { ...(value as EditorModuleConfig) }
}

async function loadProjectConfig(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const [project, editor] = await Promise.all([
      window.api.getConfig('project'),
      window.api.getConfig('editor')
    ])

    projectConfig.value = (project ?? null) as ProjectModuleConfig | null
    const editorConfig = toEditorModuleConfig(editor)
    baseFontSize.value = normalizeBaseFontSizeValue(editorConfig.baseFontSizePx)
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function saveBaseFontSize(): Promise<void> {
  saving.value = true
  errorMessage.value = ''
  infoMessage.value = ''
  try {
    const current = await window.api.getConfig('editor')
    const editorConfig = toEditorModuleConfig(current)
    editorConfig.baseFontSizePx = parsePx(baseFontSize.value)

    await window.api.setConfig('editor', editorConfig)
    infoMessage.value = `Default base font size saved: ${editorConfig.baseFontSizePx}px`
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadProjectConfig()
})
</script>

<template>
  <section class="page">
    <h2>Project</h2>
    <p class="hint">The project path is immutable after the project is created.</p>

    <div class="action-row">
      <button @click="loadProjectConfig" :disabled="loading || saving">Reload</button>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    <p v-else-if="infoMessage" class="info-text">{{ infoMessage }}</p>

    <div v-if="!projectConfig" class="placeholder">
      No project is loaded.
    </div>

    <div v-else class="config-grid">
      <div class="label">Porject Name</div>
      <div class="value">{{ projectConfig.name }}</div>

      <div class="label">Project Path</div>
      <div class="value">{{ normalizePath(projectConfig.root) }}</div>
    </div>

    <div class="setting-row">
      <label class="label" for="base-font-size">Default Base Font Size</label>
      <select id="base-font-size" v-model="baseFontSize" :disabled="loading || saving">
        <option v-for="size in fontSizes" :key="size.value" :value="size.value">
          {{ size.label }}
        </option>
      </select>
      <button @click="saveBaseFontSize" :disabled="loading || saving">Save</button>
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

.hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.action-row button,
.setting-row button {
  height: 32px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  padding: 0 12px;
  cursor: pointer;
}

.action-row button:disabled,
.setting-row button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.setting-row {
  display: grid;
  grid-template-columns: 160px 120px auto;
  align-items: center;
  gap: 8px;
  max-width: 420px;
}

.setting-row select {
  height: 32px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: #fff;
}

.placeholder {
  color: #6b7280;
  font-size: 14px;
}

.error-text {
  margin: 0;
  color: #cf222e;
  font-size: 13px;
}

.info-text {
  margin: 0;
  color: #0969da;
  font-size: 13px;
}

.config-grid {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px 12px;
}

.label {
  color: #57606a;
  font-size: 13px;
}

.value {
  color: #24292f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
