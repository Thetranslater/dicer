<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Expression } from '../../../utils/expression'

type EdgeModel = {
  to: string
  value: number
}

const props = defineProps<{
  modelValue: EdgeModel
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: EdgeModel): void
  (e: 'dropping', assetPath: string): void
}>()

const exprInput = ref('0')
const isDragOver = ref(false)

const targetLabel = computed(() => {
  const path = props.modelValue.to || ''
  if (!path) return '---'
  const file = path.replace(/\\/g, '/').split('/').pop() || ''
  return file.replace(/\.asset\.json$/i, '') || file || '---'
})

watch(
  () => props.modelValue,
  () => {
    exprInput.value = String(props.modelValue.value ?? 0)
  },
  { deep: true, immediate: true }
)

function patch(next: Partial<EdgeModel>): void {
  emit('update:modelValue', {
    to: props.modelValue.to || '',
    value: props.modelValue.value ?? 0,
    ...next
  })
}

function parseInteger(text: string): number | null {
  if (!/^-?\d+$/.test(text)) return null
  return Number(text)
}

function onBlurExpr(): void {
  const raw = exprInput.value.trim()
  if (!raw) {
    patch({ value: 0 })
    exprInput.value = '0'
    return
  }

  const parsed = parseInteger(raw)
  if (parsed !== null) {
    patch({ value: parsed })
    exprInput.value = String(parsed)
  }
}

async function onRoll(): Promise<void> {
  const raw = exprInput.value.trim()
  if (!raw) {
    patch({ value: 0 })
    exprInput.value = '0'
    return
  }

  try {
    const result = await new Expression(raw).evaluate()
    patch({ value: result })
    exprInput.value = String(result)
  } catch {
    patch({ value: 0 })
    exprInput.value = '0'
  }
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  isDragOver.value = true
}

function onDragLeave(): void {
  isDragOver.value = false
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragOver.value = false

  const path = event.dataTransfer?.getData('text/plain')?.trim() || ''
  if (!path) return

  patch({ to: path })
  emit('dropping', path)
}
</script>

<template>
  <div class="edge-row">
    <div
      class="drop-target"
      :class="{ active: isDragOver }"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      {{ targetLabel }}
    </div>

    <div class="value-control">
      <input
        v-model="exprInput"
        class="value-input"
        type="text"
        @blur="onBlurExpr"
        @keydown.enter.prevent="onRoll"
      />
      <button class="roll-button" type="button" @click="onRoll">
        <span class="dice-icon">&#127922;</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.edge-row {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 8px;
  align-items: center;
}

.drop-target {
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #1f2328;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.drop-target.active {
  border-color: #0969da;
  background: #eef6ff;
}

.value-control {
  display: flex;
  align-items: center;
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.value-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  padding: 0 8px;
  font-size: 13px;
  box-sizing: border-box;
}

.roll-button {
  width: 30px;
  height: 100%;
  border: none;
  border-left: 1px solid #d0d7de;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.roll-button:hover {
  background: #f6f8fa;
}

.dice-icon {
  font-size: 14px;
}
</style>
