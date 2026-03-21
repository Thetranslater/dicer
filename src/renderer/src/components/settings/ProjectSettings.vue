<script setup lang="ts">
import { onMounted, ref } from 'vue'

type ProjectModuleConfig = {
  projectPath?: string
  configPath?: string
  createdAt?: string
  updatedAt?: string
}

const projectConfig = ref<ProjectModuleConfig | null>(null)
const loading = ref(false)
const errorMessage = ref('')

function normalizePath(path?: string): string {
  if (!path) return ''
  return path.replace(/\\/g, '/')
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function loadProjectConfig(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const config = await window.api.getConfig('project')
    projectConfig.value = (config ?? null) as ProjectModuleConfig | null
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
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
      <button @click="loadProjectConfig" :disabled="loading">Reload</button>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <div v-if="!projectConfig" class="placeholder">
      No project is loaded.
    </div>

    <div v-else class="config-grid">
      <div class="label">Project Path</div>
      <div class="value">{{ normalizePath(projectConfig.projectPath) }}</div>

      <div class="label">Config Path</div>
      <div class="value">{{ normalizePath(projectConfig.configPath) }}</div>

      <div class="label">Created At</div>
      <div class="value">{{ projectConfig.createdAt ?? '-' }}</div>

      <div class="label">Updated At</div>
      <div class="value">{{ projectConfig.updatedAt ?? '-' }}</div>
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

.action-row button {
  height: 32px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  padding: 0 12px;
  cursor: pointer;
}

.action-row button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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
