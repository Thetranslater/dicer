<script setup lang="ts">
import { computed } from 'vue'

type PlaceholderProps = {
  note: string
}

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

function baseModel(): Record<string, unknown> {
  const raw = props.modelValue
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw
  }
  return {}
}

const note = computed(() => {
  const raw = baseModel().note
  return typeof raw === 'string' ? raw : ''
})

function onNoteChange(event: Event): void {
  const target = event.target
  const value = target instanceof HTMLTextAreaElement ? target.value : ''
  const next: PlaceholderProps = { note: value }
  emit('change', { ...baseModel(), ...next })
}
</script>

<template>
  <div class="editor-shell">
    <label class="field">
      <span class="label">Note</span>
      <textarea class="textarea" rows="4" :value="note" @change="onNoteChange"></textarea>
    </label>
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

.textarea {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  background: #fff;
  color: #1f2328;
  box-sizing: border-box;
  resize: vertical;
}
</style>
