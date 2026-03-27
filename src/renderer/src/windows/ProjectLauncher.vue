<script setup lang="ts">
import { ref, watch } from 'vue'
import type { OpenOption, SaveOption } from '@renderer/utils/fileService'

const selectedPath = ref('')
const projectName = ref('default')
const createRootPath = ref('')
const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function normalizeProjectName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '_')
  return cleaned.length > 0 ? cleaned : 'default'
}

function updateRootPreview(): void {
  if (!createRootPath.value) return
  const safeName = normalizeProjectName(projectName.value)
  selectedPath.value = `${createRootPath.value}/${safeName}`
}

watch(projectName, () => {
  updateRootPreview()
})

async function chooseDirectory(_exist: boolean): Promise<string | null> {
  const chooseOptions: OpenOption = {
    isMultiselection: false,
    dialogOpenType: 'dir',
    fileOption: {
      isLoad: false,
    },
    dirOption: {
      isRecursive: false,
    }
  }

  const fsnodes = await window.api.fs.open(chooseOptions)
  if (fsnodes.length !== 1) return null

  const pathValue = fsnodes[0].path
  if (typeof pathValue !== 'string' || pathValue.length === 0) return null
  return normalizePath(pathValue)
}

async function readExistingProjectConfig(projectDir: string): Promise<any> {
  const configPath = `${projectDir}/project.config.json`
  const openConfigOptions: OpenOption = {
    isMultiselection: false,
    dialogOpenType: 'file',
    fileOption: {
      isLoad: true,
      path: [configPath]
    }
  }

  const configResult = await window.api.fs.open(openConfigOptions)
  if (configResult.length !== 1) return null

  return JSON.parse(configResult[0].data)
}

async function chooseCreateRootPath(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    const basePath = await chooseDirectory(false)
    if (!basePath) {
      loading.value = false
      return
    }
    createRootPath.value = basePath
    updateRootPreview()
    infoMessage.value = 'Create path selected.'
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function openExistingProject(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    const basePath = await chooseDirectory(true)
    if (!basePath)
      return

    const existingConfig = await readExistingProjectConfig(basePath)
    if (!existingConfig)
      throw new Error('No valid project.config.json found in selected folder.')

    createRootPath.value = ''
    selectedPath.value = existingConfig.root
    projectName.value = normalizeProjectName(existingConfig.name)
    await window.api.cfg.initialize(existingConfig)
    loading.value = false
    infoMessage.value = `Project "${projectName.value}" loaded.`

    await window.api.projectReady()
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function createProject(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    if (!createRootPath.value) {
      throw new Error('Please choose project root path first.')
    }

    const safeName = normalizeProjectName(projectName.value)
    projectName.value = safeName

    const projectDir = `${createRootPath.value}/${safeName}`

    const projectConfig = {
      root: projectDir,
      name: safeName
    }

    const saveConfigOptions: SaveOption = {
      path: [`${normalizePath(projectDir)}/project.config.json`],
    }

    await window.api.fs.save(JSON.stringify(projectConfig, null, 2), saveConfigOptions)
    await window.api.cfg.initialize(projectConfig)
    infoMessage.value = `Project "${safeName}" created.`
    await window.api.projectReady()
  } catch (error) {
    errorMessage.value = toErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="launcher-window">
    <section class="launcher-card">
      <h1>Project Launcher</h1>
      <p class="hint">
        Choose an existing project or create a new project.
      </p>

      <div class="path-row">
        <label>Project Name</label>
        <input v-model="projectName" :disabled="loading" placeholder="default" />
      </div>

      <div class="path-row">
        <label>Project Root</label>
        <div class="input-shell">
          <input class="with-action" :value="selectedPath" readonly placeholder="No project selected" />
          <button class="inline-pick-button" @click="chooseCreateRootPath" :disabled="loading"
            aria-label="Choose project root">
            &middot;&middot;&middot;
          </button>
        </div>
      </div>

      <div class="actions">
        <button @click="openExistingProject" :disabled="loading">Open Existing</button>
        <button @click="createProject" :disabled="loading">Create New</button>
      </div>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <p v-else-if="infoMessage" class="info-text">{{ infoMessage }}</p>
    </section>
  </div>
</template>

<style scoped>
.launcher-window {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #f7fafc 0%, #edf2f7 100%);
}

.launcher-card {
  width: min(640px, 90vw);
  min-height: 320px;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

h1 {
  margin: 0;
  font-size: 24px;
  color: #0f172a;
}

.hint {
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.path-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
  align-items: center;
}

.path-row label {
  font-size: 13px;
  color: #475569;
}

.path-row input {
  height: 34px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
  background: #f8fafc;
}

.input-shell {
  position: relative;
}

.with-action {
  width: 100%;
  padding-right: 34px;
}

.inline-pick-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  color: #57606a;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.inline-pick-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: auto;
  justify-content: flex-end;
}

.actions button {
  height: 34px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  padding: 0 12px;
  font-size: 13px;
  cursor: pointer;
}

.actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
</style>
