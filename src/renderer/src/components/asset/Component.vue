<script setup lang="ts">
import { computed, type Component as VueComponent } from 'vue'
import CharacterComponentEditor from './editors/CharacterComponentEditor.vue'
import ItemComponentEditor from './editors/ItemComponentEditor.vue'
import PlaceholderComponentEditor from './editors/PlaceholderComponentEditor.vue'

type ComponentNode = {
  id: string
  type: string
  props: Record<string, unknown>
}

const props = defineProps<{
  componentData?: ComponentNode | null
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

const editorRegistry: Record<string, VueComponent> = {
  CharacterComponent: CharacterComponentEditor,
  ItemComponent: ItemComponentEditor,
  PlaceholderComponent: PlaceholderComponentEditor
}

const activeEditor = computed(() => {
  if (!props.componentData) return null
  return editorRegistry[props.componentData.type] ?? null
})

function onEditorChange(nextProps: Record<string, unknown>): void {
  emit('change', nextProps)
}
</script>

<template>
  <section class="component-shell">
    <div v-if="componentData" class="component-body">
      <component :is="activeEditor" v-if="activeEditor" :model-value="componentData.props" @change="onEditorChange" />

      <div v-else class="unsupported">
        Unsupported component type.
      </div>
    </div>

    <div v-else class="empty">No component data.</div>
  </section>
</template>

<style scoped>
.component-shell {
  width: 100%;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px;
  box-sizing: border-box;
}

.component-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.unsupported {
  font-size: 12px;
  color: #b42318;
  background: #fffbfa;
  border: 1px solid #fecdca;
  border-radius: 6px;
  padding: 8px;
}

.empty {
  color: #6b7280;
  font-size: 12px;
}
</style>
