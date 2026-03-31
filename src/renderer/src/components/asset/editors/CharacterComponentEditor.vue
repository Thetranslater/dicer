<script setup lang="ts">
import { computed } from 'vue'

type CharacterProps = {
  name: string
  role: string
  faction: string
  hp: number
  attack: number
  defense: number
  agility: number
}

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

const roleOptions = ['Warrior', 'Mage', 'Rogue', 'Support'] as const

const defaults: CharacterProps = {
  name: '',
  role: 'Warrior',
  faction: '',
  hp: 100,
  attack: 10,
  defense: 8,
  agility: 8
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

const view = computed<CharacterProps>(() => {
  return {
    name: readString('name', defaults.name),
    role: readString('role', defaults.role),
    faction: readString('faction', defaults.faction),
    hp: readNumber('hp', defaults.hp),
    attack: readNumber('attack', defaults.attack),
    defense: readNumber('defense', defaults.defense),
    agility: readNumber('agility', defaults.agility)
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

function onStringChange(key: 'name' | 'role' | 'faction', event: Event): void {
  patch({ [key]: getInputValue(event) } as Partial<CharacterProps>)
}

function onNumberChange(key: 'hp' | 'attack' | 'defense' | 'agility', event: Event): void {
  const raw = getInputValue(event)
  const parsed = Number(raw)
  patch({ [key]: Number.isFinite(parsed) ? parsed : 0 } as Partial<CharacterProps>)
}

function resetBaseStats(): void {
  patch({
    hp: defaults.hp,
    attack: defaults.attack,
    defense: defaults.defense,
    agility: defaults.agility
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
        <span class="label">Role</span>
        <select class="select" :value="view.role" @change="onStringChange('role', $event)">
          <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
        </select>
      </label>
    </div>

    <div class="row">
      <label class="field full">
        <span class="label">Faction</span>
        <input class="input" :value="view.faction" @change="onStringChange('faction', $event)" />
      </label>
    </div>

    <div class="stats-grid">
      <label class="field">
        <span class="label">HP</span>
        <input class="input" type="number" min="0" :value="view.hp" @change="onNumberChange('hp', $event)" />
      </label>

      <label class="field">
        <span class="label">ATK</span>
        <input class="input" type="number" min="0" :value="view.attack" @change="onNumberChange('attack', $event)" />
      </label>

      <label class="field">
        <span class="label">DEF</span>
        <input class="input" type="number" min="0" :value="view.defense" @change="onNumberChange('defense', $event)" />
      </label>

      <label class="field">
        <span class="label">AGI</span>
        <input class="input" type="number" min="0" :value="view.agility" @change="onNumberChange('agility', $event)" />
      </label>
    </div>

    <div class="actions">
      <button class="btn" type="button" @click="resetBaseStats">Reset Base Stats</button>
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
