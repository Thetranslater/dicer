<script setup lang="ts">
import { computed, type Component as VueComponent } from 'vue'
import CharacterComponent from './components/CharacterComponent.vue'
import SkillComponent from './components/SkillComponent.vue'
import GraphComponent from './components/GraphComponent.vue'
import CustomComponent from './components/CustomComponent.vue'
import { getCComponent, type CustomComponentDefinition } from '../../utils/componentFactory'

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

const presetRegistry: Record<string, VueComponent> = {
  CharacterComponent,
  SkillComponent,
  GraphComponent
}

const isPresetType = computed(() => {
  if (!props.componentData) return false
  return Boolean(presetRegistry[props.componentData.type])
})

const resolvedCustomDefinition = computed<CustomComponentDefinition | null>(() => {
  if (!props.componentData || isPresetType.value) return null
  return (
    getCComponent(props.componentData.type) ?? {
      name: props.componentData.type,
      properties: []
    }
  )
})

const activeRenderer = computed<VueComponent | null>(() => {
  if (!props.componentData) return null
  return presetRegistry[props.componentData.type] ?? CustomComponent
})

const activeRendererProps = computed<Record<string, unknown>>(() => {
  if (!props.componentData) return {}

  if (isPresetType.value) {
    return {
      modelValue: props.componentData.props
    }
  }

  return {
    modelValue: props.componentData.props,
    definition: resolvedCustomDefinition.value
  }
})

function onEditorChange(nextProps: Record<string, unknown>): void {
  emit('change', nextProps)
}
</script>

<template>
  <section class="component-shell">
    <div v-if="componentData" class="component-body">
      <component
        v-if="activeRenderer"
        :is="activeRenderer"
        v-bind="activeRendererProps"
        @change="onEditorChange"
      />
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

.empty {
  color: #6b7280;
  font-size: 12px;
}
</style>
