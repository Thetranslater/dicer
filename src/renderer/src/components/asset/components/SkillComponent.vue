<script setup lang="ts">
import { computed } from 'vue'
import RollableProperty from './RollableProperty.vue'

const skillDefs = [
  { key: 'spotHidden', label: '侦察' },
  { key: 'listen', label: '聆听' },
  { key: 'stealth', label: '潜行' },
  { key: 'tracking', label: '追踪' },
  { key: 'navigation', label: '导航' },
  { key: 'fastTalk', label: '话术' },
  { key: 'intimidate', label: '恐吓' },
  { key: 'persuade', label: '说服' },
  { key: 'psychology', label: '心理学' },
  { key: 'nativeLanguage', label: '母语' },
  { key: 'foreignLanguage', label: '外语' },
  { key: 'dodge', label: '闪避' },
  { key: 'throwSkill', label: '投掷' },
  { key: 'firstAid', label: '急救' },
  { key: 'medicine', label: '医学' },
  { key: 'hypnosis', label: '催眠' },
  { key: 'climb', label: '攀爬' },
  { key: 'jump', label: '跳跃' },
  { key: 'swim', label: '游泳' },
  { key: 'dive', label: '潜水' },
  { key: 'anthropology', label: '人类学' },
  { key: 'history', label: '历史学' },
  { key: 'archaeology', label: '考古学' },
  { key: 'occult', label: '神秘学' },
  { key: 'computer', label: '计算机' },
  { key: 'repair', label: '维修' },
  { key: 'drive', label: '驾驶' },
  { key: 'animalHandling', label: '驯兽' },
  { key: 'lockpick', label: '开锁' },
  { key: 'fighting', label: '格斗' },
  { key: 'shooting', label: '射击' },
  { key: 'military', label: '军事' }
] as const

type SkillKey = (typeof skillDefs)[number]['key']
type SkillProps = Record<SkillKey, number>

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

const defaults: SkillProps = {
  spotHidden: 0,
  listen: 0,
  stealth: 0,
  tracking: 0,
  navigation: 0,
  fastTalk: 0,
  intimidate: 0,
  persuade: 0,
  psychology: 0,
  nativeLanguage: 0,
  foreignLanguage: 0,
  dodge: 0,
  throwSkill: 0,
  firstAid: 0,
  medicine: 0,
  hypnosis: 0,
  climb: 0,
  jump: 0,
  swim: 0,
  dive: 0,
  anthropology: 0,
  history: 0,
  archaeology: 0,
  occult: 0,
  computer: 0,
  repair: 0,
  drive: 0,
  animalHandling: 0,
  lockpick: 0,
  fighting: 0,
  shooting: 0,
  military: 0
}

function baseModel(): Record<string, unknown> {
  const raw = props.modelValue
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw
  }
  return {}
}

function readNumber(key: SkillKey, fallback: number): number {
  const value = baseModel()[key]
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const view = computed<SkillProps>(() => {
  const next = {} as SkillProps
  for (const def of skillDefs) {
    next[def.key] = readNumber(def.key, defaults[def.key])
  }
  return next
})

function patch(next: Partial<SkillProps>): void {
  emit('change', {
    ...baseModel(),
    ...view.value,
    ...next
  })
}

function onRollableChange(key: SkillKey, value: number): void {
  patch({ [key]: value } as Partial<SkillProps>)
}

function resetSkills(): void {
  patch({ ...defaults })
}
</script>

<template>
  <div class="editor-shell">
    <div class="skills-grid">
      <RollableProperty
        v-for="def in skillDefs"
        :key="def.key"
        :label="def.label"
        :model-value="view[def.key]"
        @update:model-value="onRollableChange(def.key, $event)"
      />
    </div>

    <div class="actions">
      <button class="btn" type="button" @click="resetSkills">Reset Skills</button>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.btn {
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
</style>
