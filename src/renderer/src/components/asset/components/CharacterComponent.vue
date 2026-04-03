<script setup lang="ts">
import { computed } from 'vue'
import RollableProperty from './RollableProperty.vue'

type Gender = 'Unknown' | 'Male' | 'Female' | 'Other'

type CharacterProps = {
  name: string
  gender: Gender
  race: string
  bio: string
  magic: number
  strength: number
  sanity: number
  intelligence: number
  appearance: number
  endurance: number
  luck: number
  age: number
  hp: number
  agility: number
  critChance: number
  critDamage: number
  constitution: number
  bodySize: number
  willpower: number
  charm: number
  money: number
}

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

const genderOptions: readonly Gender[] = ['Unknown', 'Male', 'Female', 'Other'] as const

const defaults: CharacterProps = {
  name: '',
  gender: 'Unknown',
  race: '',
  bio: '',
  magic: 0,
  strength: 0,
  sanity: 0,
  intelligence: 0,
  appearance: 0,
  endurance: 0,
  luck: 0,
  age: 0,
  hp: 0,
  agility: 0,
  critChance: 0,
  critDamage: 0,
  constitution: 0,
  bodySize: 0,
  willpower: 0,
  charm: 0,
  money: 0
}

function baseModel(): Record<string, unknown> {
  const raw = props.modelValue
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw
  }
  return {}
}

function readString(key: keyof CharacterProps, fallback: string): string {
  const value = baseModel()[key]
  return typeof value === 'string' ? value : fallback
}

function readNumber(key: keyof CharacterProps, fallback: number): number {
  const value = baseModel()[key]
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readGender(): Gender {
  const value = readString('gender', defaults.gender)
  return (genderOptions as readonly string[]).includes(value) ? (value as Gender) : defaults.gender
}

const view = computed<CharacterProps>(() => {
  return {
    name: readString('name', defaults.name),
    gender: readGender(),
    race: readString('race', defaults.race),
    bio: readString('bio', defaults.bio),
    magic: readNumber('magic', defaults.magic),
    strength: readNumber('strength', defaults.strength),
    sanity: readNumber('sanity', defaults.sanity),
    intelligence: readNumber('intelligence', defaults.intelligence),
    appearance: readNumber('appearance', defaults.appearance),
    endurance: readNumber('endurance', defaults.endurance),
    luck: readNumber('luck', defaults.luck),
    age: readNumber('age', defaults.age),
    hp: readNumber('hp', defaults.hp),
    agility: readNumber('agility', defaults.agility),
    critChance: readNumber('critChance', defaults.critChance),
    critDamage: readNumber('critDamage', defaults.critDamage),
    constitution: readNumber('constitution', defaults.constitution),
    bodySize: readNumber('bodySize', defaults.bodySize),
    willpower: readNumber('willpower', defaults.willpower),
    charm: readNumber('charm', defaults.charm),
    money: readNumber('money', defaults.money)
  }
})

function patch(next: Partial<CharacterProps>): void {
  emit('change', {
    ...baseModel(),
    ...view.value,
    ...next
  })
}

function getInputValue(event: Event): string {
  const target = event.target
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target.value
  }
  return ''
}

function onStringChange(key: 'name' | 'race' | 'bio', event: Event): void {
  patch({ [key]: getInputValue(event) } as Partial<CharacterProps>)
}

function onGenderChange(event: Event): void {
  const value = getInputValue(event)
  const next: Gender = (genderOptions as readonly string[]).includes(value)
    ? (value as Gender)
    : defaults.gender
  patch({ gender: next })
}

function onRollableChange(
  key:
    | 'magic'
    | 'strength'
    | 'sanity'
    | 'intelligence'
    | 'appearance'
    | 'endurance'
    | 'luck'
    | 'age'
    | 'hp'
    | 'agility'
    | 'critChance'
    | 'critDamage'
    | 'constitution'
    | 'bodySize'
    | 'willpower'
    | 'charm'
    | 'money',
  value: number
): void {
  patch({ [key]: value } as Partial<CharacterProps>)
}

function resetStats(): void {
  patch({
    magic: defaults.magic,
    strength: defaults.strength,
    sanity: defaults.sanity,
    intelligence: defaults.intelligence,
    appearance: defaults.appearance,
    endurance: defaults.endurance,
    luck: defaults.luck,
    age: defaults.age,
    hp: defaults.hp,
    agility: defaults.agility,
    critChance: defaults.critChance,
    critDamage: defaults.critDamage,
    constitution: defaults.constitution,
    bodySize: defaults.bodySize,
    willpower: defaults.willpower,
    charm: defaults.charm,
    money: defaults.money
  })
}
</script>

<template>
  <div class="editor-shell">
    <div class="row">
      <label class="field">
        <span class="label">Name</span>
        <input class="input" :value="view.name" @change="onStringChange('name', $event)" />
      </label>

      <label class="field">
        <span class="label">Gender</span>
        <select class="select" :value="view.gender" @change="onGenderChange">
          <option v-for="gender in genderOptions" :key="gender" :value="gender">{{ gender }}</option>
        </select>
      </label>
    </div>

    <div class="row">
      <label class="field">
        <span class="label">Race</span>
        <input class="input" :value="view.race" @change="onStringChange('race', $event)" />
      </label>

      <label class="field">
        <RollableProperty label="AGE" :model-value="view.age" @update:model-value="onRollableChange('age', $event)" />
      </label>
    </div>

    <div class="stats-grid">
      <RollableProperty label="MAG" :model-value="view.magic" @update:model-value="onRollableChange('magic', $event)" />
      <RollableProperty label="STR" :model-value="view.strength"
        @update:model-value="onRollableChange('strength', $event)" />
      <RollableProperty label="SAN" :model-value="view.sanity" @update:model-value="onRollableChange('sanity', $event)" />
      <RollableProperty label="INT" :model-value="view.intelligence"
        @update:model-value="onRollableChange('intelligence', $event)" />
      <RollableProperty label="APP" :model-value="view.appearance"
        @update:model-value="onRollableChange('appearance', $event)" />
      <RollableProperty label="END" :model-value="view.endurance"
        @update:model-value="onRollableChange('endurance', $event)" />
      <RollableProperty label="LUK" :model-value="view.luck" @update:model-value="onRollableChange('luck', $event)" />
      <RollableProperty label="HP" :model-value="view.hp" @update:model-value="onRollableChange('hp', $event)" />
      <RollableProperty label="AGI" :model-value="view.agility"
        @update:model-value="onRollableChange('agility', $event)" />
      <RollableProperty label="CRT" :model-value="view.critChance"
        @update:model-value="onRollableChange('critChance', $event)" />
      <RollableProperty label="CDMG" :model-value="view.critDamage"
        @update:model-value="onRollableChange('critDamage', $event)" />
      <RollableProperty label="CON" :model-value="view.constitution"
        @update:model-value="onRollableChange('constitution', $event)" />
      <RollableProperty label="SIZ" :model-value="view.bodySize"
        @update:model-value="onRollableChange('bodySize', $event)" />
      <RollableProperty label="WIL" :model-value="view.willpower"
        @update:model-value="onRollableChange('willpower', $event)" />
      <RollableProperty label="CHA" :model-value="view.charm" @update:model-value="onRollableChange('charm', $event)" />
      <RollableProperty label="MON" :model-value="view.money" @update:model-value="onRollableChange('money', $event)" />
    </div>

    <div class="row">
      <label class="field full">
        <span class="label">Description</span>
        <textarea class="textarea" rows="3" :value="view.bio" @change="onStringChange('bio', $event)" />
      </label>
    </div>

    <div class="actions">
      <button class="btn" type="button" @click="resetStats">Reset Stats</button>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.field.full {
  grid-column: 1 / -1;
}

.label {
  font-size: 12px;
  color: #57606a;
}

.input,
.select {
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
