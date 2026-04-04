<script setup lang="ts">
import { computed } from 'vue'
import EdgeProperty from './EdgeProperty.vue'
import RollableProperty from './RollableProperty.vue'
import type { CustomComponentDefinition, CustomComponentProperty } from '../../../utils/componentFactory'

type EdgeModel = {
  to: string
  value: number
}

const props = defineProps<{
  modelValue: Record<string, unknown>
  definition: CustomComponentDefinition
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

const rollableProperties = computed(() => {
  return props.definition.properties.filter((property) => property.type === 'Rollable')
})

const singleLineProperties = computed(() => {
  return props.definition.properties.filter(
    (property) =>
      property.type === 'Input' ||
      property.type === 'Enum' ||
      property.type === 'CheckBox' ||
      property.type === 'TextArea'
  )
})

const blockProperties = computed(() => {
  return props.definition.properties.filter((property) => property.type === 'EdgeArray')
})

function patchField(name: string, value: unknown): void {
  emit('change', {
    ...props.modelValue,
    [name]: value
  })
}

function getStringValue(name: string): string {
  const value = props.modelValue[name]
  return typeof value === 'string' ? value : ''
}

function getRollableValue(name: string): number {
  const value = Number(props.modelValue[name])
  return Number.isFinite(value) ? value : 0
}

function getBooleanValue(name: string): boolean {
  return Boolean(props.modelValue[name])
}

function getEnumOptions(property: CustomComponentProperty): string[] {
  return property.value ?? []
}

function getEnumValue(property: CustomComponentProperty): string {
  const current = getStringValue(property.name)
  if (current) return current
  return property.value?.[0] ?? ''
}

function normalizeEdge(raw: unknown): EdgeModel | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  return {
    to: typeof value.to === 'string' ? value.to : '',
    value: Number.isFinite(Number(value.value)) ? Number(value.value) : 0
  }
}

function getEdgeArray(name: string): EdgeModel[] {
  const value = props.modelValue[name]
  if (!Array.isArray(value)) return []
  return value.map((edge) => normalizeEdge(edge)).filter((edge): edge is EdgeModel => Boolean(edge))
}

function updateEdgeArray(name: string, next: EdgeModel[]): void {
  patchField(name, next)
}

function addEdge(name: string): void {
  updateEdgeArray(name, [...getEdgeArray(name), { to: '', value: 0 }])
}

function removeEdge(name: string): void {
  const edges = getEdgeArray(name)
  if (edges.length === 0) return
  updateEdgeArray(name, edges.slice(0, -1))
}

function onEdgeChange(name: string, index: number, edge: EdgeModel): void {
  const edges = [...getEdgeArray(name)]
  edges[index] = edge
  updateEdgeArray(name, edges)
}

function getInputValue(event: Event): string {
  const target = event.target
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return target.value
  }
  return ''
}

function onTextChange(name: string, event: Event): void {
  patchField(name, getInputValue(event))
}

function onCheckBoxChange(name: string, event: Event): void {
  const target = event.target
  patchField(name, target instanceof HTMLInputElement ? target.checked : false)
}
</script>

<template>
  <div class="editor-shell">
    <div class="single-line-list">
      <RollableProperty
        v-for="property in rollableProperties"
        :key="property.name"
        :label="property.name"
        :model-value="getRollableValue(property.name)"
        @update:model-value="patchField(property.name, $event)"
      />

      <div v-for="property in singleLineProperties" :key="property.name" class="single-line-row"
        :class="{ 'textarea-row': property.type === 'TextArea' }">
        <span class="single-line-name">{{ property.name }}</span>

        <div class="single-line-content" :class="{ 'textarea-content': property.type === 'TextArea' }">
          <input
            v-if="property.type === 'Input'"
            class="input"
            :value="getStringValue(property.name)"
            @change="onTextChange(property.name, $event)"
          />

          <select
            v-else-if="property.type === 'Enum'"
            class="select"
            :value="getEnumValue(property)"
            @change="onTextChange(property.name, $event)"
          >
            <option v-for="item in getEnumOptions(property)" :key="item" :value="item">{{ item }}</option>
          </select>

          <label v-else-if="property.type === 'CheckBox'" class="checkbox-field">
            <input class="checkbox-input" type="checkbox" :checked="getBooleanValue(property.name)"
              @change="onCheckBoxChange(property.name, $event)" />
          </label>

          <textarea
            v-else-if="property.type === 'TextArea'"
            class="textarea textarea-inline"
            rows="3"
            :value="getStringValue(property.name)"
            @change="onTextChange(property.name, $event)"
          />
        </div>
      </div>
    </div>

    <div v-for="property in blockProperties" :key="property.name" class="field-row">
      <span class="label">{{ property.name }}</span>

      <div v-if="property.type === 'EdgeArray'" class="edge-array-panel">
        <div class="edge-array-head">
          <button class="icon-btn" type="button" @click="addEdge(property.name)">+</button>
          <button class="icon-btn" type="button" :disabled="getEdgeArray(property.name).length === 0"
            @click="removeEdge(property.name)">-</button>
        </div>

        <div class="edge-array-list">
          <EdgeProperty
            v-for="(edge, index) in getEdgeArray(property.name)"
            :key="`${property.name}-${index}`"
            :model-value="edge"
            @update:model-value="onEdgeChange(property.name, index, $event)"
          />

          <div v-if="getEdgeArray(property.name).length === 0" class="empty-text">No edges</div>
        </div>
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

.single-line-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.single-line-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.single-line-row.textarea-row {
  align-items: flex-start;
}

.single-line-name {
  flex: 0 0 auto;
  width: 60px;
  font-size: 12px;
  color: #57606a;
  line-height: 1;
}

.single-line-row.textarea-row .single-line-name {
  padding-top: 6px;
  line-height: 1.2;
}

.single-line-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 30px;
}

.single-line-content.textarea-content {
  align-items: flex-start;
  height: auto;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: #57606a;
}

.input,
.select {
  width: 100%;
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: #fff;
  color: #1f2328;
  box-sizing: border-box;
}

.textarea {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
  background: #fff;
  color: #1f2328;
  box-sizing: border-box;
  line-height: 1.4;
  overflow-y: auto;
  resize: vertical;
}

.textarea-inline {
  width: 100%;
  min-height: 72px;
}

.checkbox-field {
  width: 100%;
  height: 30px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  margin: 0;
}

.edge-array-panel {
  position: relative;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #fff;
  padding: 28px 8px 8px 8px;
}

.edge-array-head {
  position: absolute;
  top: 4px;
  right: 6px;
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 24px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edge-array-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: calc(30px * 5 + 6px * 4);
  overflow-y: auto;
  overflow-x: hidden;
}

.empty-text {
  font-size: 12px;
  color: #6b7280;
  padding: 6px 2px;
}
</style>
