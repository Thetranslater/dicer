<script setup lang="ts">
import { computed } from 'vue'
import EdgeProperty from './EdgeProperty.vue'

type EdgeModel = {
  to: string
  value: number
}

type GraphModel = {
  name: string
  edges: EdgeModel[]
}

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

function readModel(): GraphModel {
  const raw = props.modelValue as Partial<GraphModel>
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    edges: Array.isArray(raw?.edges) ? (raw.edges as EdgeModel[]) : []
  }
}

const view = computed(() => readModel())

function patch(next: Partial<GraphModel>): void {
  emit('change', {
    ...view.value,
    ...next
  })
}

function getValue(event: Event): string {
  const target = event.target as HTMLInputElement | null
  return target?.value ?? ''
}

function onNameChange(event: Event): void {
  patch({ name: getValue(event) })
}

function addEdge(): void {
  patch({
    edges: [...view.value.edges, { to: '', value: 0 }]
  })
}

function deleteEdge(): void {
  if (view.value.edges.length === 0) return
  patch({
    edges: view.value.edges.slice(0, -1)
  })
}

function onEdgeChange(index: number, edge: EdgeModel): void {
  const next = [...view.value.edges]
  next[index] = edge
  patch({ edges: next })
}
</script>

<template>
  <div class="editor-shell">
    <label class="field">
      <span class="label">Name</span>
      <input class="input" :value="view.name" @change="onNameChange" />
    </label>

    <div class="edges-panel">
      <div class="controls">
        <button class="btn" type="button" @click="addEdge">+</button>
        <button class="btn" type="button" :disabled="view.edges.length === 0" @click="deleteEdge">-</button>
      </div>

      <div class="edges-list">
        <EdgeProperty v-for="(edge, index) in view.edges" :key="`edge-${index}`" :model-value="edge"
          @update:model-value="onEdgeChange(index, $event)" />
        <div v-if="view.edges.length === 0" class="empty">No edges</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: #57606a;
}

.input {
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  box-sizing: border-box;
}

.edges-panel {
  position: relative;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 28px 8px 8px 8px;
  background: #fff;
}

.controls {
  position: absolute;
  top: 4px;
  right: 6px;
  display: flex;
  gap: 4px;
}

.btn {
  width: 24px;
  height: 22px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  padding: 0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edges-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: calc(30px * 5 + 6px * 4);
  overflow-y: auto;
  overflow-x: hidden;
}

.empty {
  font-size: 12px;
  color: #6b7280;
  padding: 6px 2px;
}
</style>
