import type { FSNode } from './fileService'

export type CustomPropertyType = 'Rollable' | 'Input' | 'TextArea' | 'Enum' | 'CheckBox' | 'EdgeArray'

export type CustomComponentProperty = {
  name: string
  type: CustomPropertyType
  value?: string[]
}

export type CustomComponentDefinition = {
  name: string
  properties: CustomComponentProperty[]
}

const CUSTOM_COMPONENT_FILE_PATTERN = /\.ccomponent\.json$/i
const customDefinitions = new Map<string, CustomComponentDefinition>()

function canonicalType(type: string): CustomPropertyType | null {
  const normalized = type.trim().toLowerCase()
  if (normalized === 'rollable') return 'Rollable'
  if (normalized === 'input') return 'Input'
  if (normalized === 'textarea') return 'TextArea'
  if (normalized === 'enum') return 'Enum'
  if (normalized === 'checkbox') return 'CheckBox'
  if (normalized === 'edgearray') return 'EdgeArray'
  return null
}

function normalizeProperty(raw: unknown, index: number): CustomComponentProperty | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>

  const propertyNameRaw = typeof value.name === 'string' ? value.name.trim() : ''
  const propertyName = propertyNameRaw || `property_${index + 1}`

  const typeRaw = typeof value.type === 'string' ? value.type : ''
  const type = canonicalType(typeRaw)
  if (!type) return null

  if (type === 'Enum') {
    const enumValues = Array.isArray(value.value)
      ? value.value.filter((item): item is string => typeof item === 'string')
      : []
    return { name: propertyName, type, value: enumValues }
  }

  return { name: propertyName, type }
}

function normalizeDefinition(raw: unknown): CustomComponentDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>

  const nameRaw = typeof value.name === 'string' ? value.name.trim() : ''
  const name = nameRaw || 'CustomComponent'

  const propertiesRaw = Array.isArray(value.properties) ? value.properties : []
  const properties = propertiesRaw
    .map((property, index) => normalizeProperty(property, index))
    .filter((property): property is CustomComponentProperty => Boolean(property))

  return { name, properties }
}

function defaultProps(definition: CustomComponentDefinition): Record<string, unknown> {
  const defaultProp = (property) => {
    switch (property.type) {
      case 'Rollable':
        return 0
      case 'Input':
        return ''
      case 'TextArea':
        return ''
      case 'Enum':
        return property.value?.[0] ?? ''
      case 'CheckBox':
        return false
      case 'EdgeArray':
        return []
    }
  }
  const result: Record<string, unknown> = {}
  for (const property of definition.properties) {
    result[property.name] = defaultProp(property)
  }
  return result
}

export function registerCComponent(nodes: FSNode[]) {
  for (const node of nodes) {
    if (!node || node.isDir) continue
    if (!CUSTOM_COMPONENT_FILE_PATTERN.test(node.name)) continue

    const dataText = typeof node.data === 'string' ? node.data : String(node.data ?? '')
    if (!dataText.trim()) continue

    try {
      const parsed = JSON.parse(dataText)
      const definition = normalizeDefinition(parsed)
      if (!definition) continue
      customDefinitions.set(definition.name, definition)
    } catch {
      continue
    }
  }
}

export function getCComponents(): CustomComponentDefinition[] {
  return [...customDefinitions.values()]
}

export function getCComponent(type: string): CustomComponentDefinition | null {
  return customDefinitions.get(type) ?? null
}

export function makeComponent(type: string): { type: string; props: Record<string, unknown> } {
  const customDefinition = getCComponent(type)
  if (customDefinition) {
    return {
      type: customDefinition.name,
      props: defaultProps(customDefinition)
    }
  }

  return { type, props: {} }
}

export function hydrateComponentProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  const customDefinition = getCComponent(type)
  if (!customDefinition) return { ...props }
  return {
    ...defaultProps(customDefinition),
    ...props
  }
}
