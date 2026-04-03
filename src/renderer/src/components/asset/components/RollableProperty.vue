<script setup lang="ts">
import { ref, watch } from 'vue'
import { Expression } from '../../../utils/expression'

const props = defineProps<{
  label: string
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const inputText = ref('0')

function syncFromModel(): void {
  inputText.value = String(props.modelValue)
}

function fallback(): void {
  emit('update:modelValue', 0)
  inputText.value = '0'
}

function blurring(): void {
  const raw = inputText.value.trim()

  if (!raw) {
    fallback()
    return
  }

  const parsed = Number.isSafeInteger(Number(raw)) ? Number(raw) : null
  if (parsed !== null) {
    emit('update:modelValue', parsed)
    inputText.value = String(parsed)
  }
}

watch(
  () => props.modelValue,
  () => {
    syncFromModel()
  },
  { immediate: true }
)

async function rolling(): Promise<void> {
  const expressionText = inputText.value.trim()
  if (!expressionText) {
    fallback()
    return
  }

  try {
    const expression = new Expression(expressionText)
    const result = await expression.evaluate()
    emit('update:modelValue', result)
    inputText.value = String(result)
  } catch (error) {
    console.warn('[RollableProperty] evaluate failed:', {
      label: props.label,
      expression: expressionText,
      error
    })
    fallback()
  }
}
</script>

<template>
  <label class="rollable-property">
    <span class="name">{{ label }}</span>
    <div class="control">
      <input v-model="inputText" class="input" type="text" @blur="blurring" @keydown.enter.prevent="rolling" />
      <button class="roll-button" type="button" title="Roll" aria-label="Roll" @click="rolling">
        <span class="dice-icon">&#127922;</span>
      </button>
    </div>
  </label>
</template>

<style scoped>
.rollable-property {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.rollable-property .name {
  flex: 0 0 auto;
  width: 60px;
  font-size: 12px;
  color: #57606a;
  line-height: 1;
}

.rollable-property .control {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.rollable-property .control .input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  padding: 0 8px;
  font-size: 13px;
  color: #1f2328;
  background: transparent;
  box-sizing: border-box;
}

.rollable-property .control .roll-button {
  flex: 0 0 auto;
  width: 30px;
  height: 100%;
  border: none;
  border-left: 1px solid #d0d7de;
  background: transparent;
  color: #1f2328;
  cursor: pointer;
  padding: 0;

  &:hover {
    background: #f6f8fa;
  }
}

.rollable-property .control .roll-button .dice-icon {
  font-size: 14px;
  line-height: 1;
}
</style>
