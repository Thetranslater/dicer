<script setup lang="ts">
import { computed } from 'vue'

type ItemProps = {
  name: string
  element: string
  weaponType: string
  rarity: string
  enchantments: string[]
  stackable: boolean
  consumable: boolean
}

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>): void
}>()

const elementOptions = ['None', 'Fire', 'Water', 'Wind', 'Earth', 'Light', 'Dark'] as const
const weaponOptions = ['None', 'Sword', 'Bow', 'Staff', 'Dagger', 'Spear', 'Shield'] as const
const rarityOptions = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const

const defaults: ItemProps = {
  name: '',
  element: 'None',
  weaponType: 'None',
  rarity: 'Common',
  enchantments: [],
  stackable: false,
  consumable: false
}

function baseModel(): Record<string, unknown> {
  const raw = props.modelValue
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw
  }
  return {}
}

function readString(key: keyof ItemProps, fallback: string): string {
  const value = baseModel()[key]
  return typeof value === 'string' ? value : fallback
}

function readBoolean(key: keyof ItemProps, fallback: boolean): boolean {
  const value = baseModel()[key]
  return typeof value === 'boolean' ? value : fallback
}

function readStringArray(key: keyof ItemProps): string[] {
  const value = baseModel()[key]
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

const view = computed<ItemProps>(() => {
  return {
    name: readString('name', defaults.name),
    element: readString('element', defaults.element),
    weaponType: readString('weaponType', defaults.weaponType),
    rarity: readString('rarity', defaults.rarity),
    enchantments: readStringArray('enchantments'),
    stackable: readBoolean('stackable', defaults.stackable),
    consumable: readBoolean('consumable', defaults.consumable)
  }
})

const enchantmentsText = computed(() => view.value.enchantments.join(', '))

function patch(next: Partial<ItemProps>): void {
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

function onStringChange(key: 'name' | 'element' | 'weaponType' | 'rarity', event: Event): void {
  patch({ [key]: getInputValue(event) } as Partial<ItemProps>)
}

function onEnchantmentsChange(event: Event): void {
  const text = getInputValue(event)
  const enchantments = text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  patch({ enchantments })
}

function onToggleChange(key: 'stackable' | 'consumable', event: Event): void {
  const target = event.target
  const checked = target instanceof HTMLInputElement ? target.checked : false
  patch({ [key]: checked } as Partial<ItemProps>)
}

function clearEnchantments(): void {
  patch({ enchantments: [] })
}
</script>

<template>
  <div class="editor-shell">
    <div class="row">
      <label class="field full">
        <span class="label">Item Name</span>
        <input class="input" :value="view.name" @change="onStringChange('name', $event)" />
      </label>
    </div>

    <div class="row triple">
      <label class="field">
        <span class="label">Element</span>
        <select class="select" :value="view.element" @change="onStringChange('element', $event)">
          <option v-for="element in elementOptions" :key="element" :value="element">{{ element }}</option>
        </select>
      </label>

      <label class="field">
        <span class="label">Weapon Type</span>
        <select class="select" :value="view.weaponType" @change="onStringChange('weaponType', $event)">
          <option v-for="weapon in weaponOptions" :key="weapon" :value="weapon">{{ weapon }}</option>
        </select>
      </label>

      <label class="field">
        <span class="label">Rarity</span>
        <select class="select" :value="view.rarity" @change="onStringChange('rarity', $event)">
          <option v-for="rarity in rarityOptions" :key="rarity" :value="rarity">{{ rarity }}</option>
        </select>
      </label>
    </div>

    <div class="row">
      <label class="field full">
        <span class="label">Enchantments (comma separated)</span>
        <input class="input" :value="enchantmentsText" @change="onEnchantmentsChange" />
      </label>
    </div>

    <div class="row checks">
      <label class="check">
        <input type="checkbox" :checked="view.stackable" @change="onToggleChange('stackable', $event)" />
        <span>Stackable</span>
      </label>

      <label class="check">
        <input type="checkbox" :checked="view.consumable" @change="onToggleChange('consumable', $event)" />
        <span>Consumable</span>
      </label>
    </div>

    <div class="actions">
      <button class="btn" type="button" @click="clearEnchantments">Clear Enchantments</button>
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
  grid-template-columns: 1fr;
  gap: 8px;
}

.row.triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.row.checks {
  display: flex;
  align-items: center;
  gap: 16px;
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

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #1f2328;
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
