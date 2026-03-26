<template>
  <NodeViewWrapper
    class="image-freely"
    :as="wrapperTag"
    :class="{
      'image-freely--inline': options.inline,
      'image-freely--error': isError
    }"
    :style="wrapperStyle"
  >
    <img
      ref="imgRef"
      v-bind="imageExtraAttrs"
      :src="attrs.src"
      :alt="attrs.alt || undefined"
      :title="attrs.title || undefined"
      :class="imageClass"
      :style="imageStyle"
      contenteditable="false"
      data-drag-handle="true"
      draggable="false"
      @load="handleLoad"
      @error="handleError"
    />

    <button
      v-if="showRotate"
      type="button"
      class="image-freely__tool image-freely__rotate"
      contenteditable="false"
      @mousedown.prevent
      @click.prevent="rotateImage"
    >
      <component :is="options.rotateIcon" v-if="hasCustomRotateIcon" />
      <span v-else-if="hasRotateIconText">{{ options.rotateIcon }}</span>
      <svg
        v-else
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M128 384h512a42.666667 42.666667 0 0 1 42.666667 42.666667v384a42.666667 42.666667 0 0 1-42.666667 42.666666H128a42.666667 42.666667 0 0 1-42.666667-42.666666v-384A42.666667 42.666667 0 0 1 128 384zm42.666667 85.333333v298.666667h426.666666v-298.666667H170.666667z"
        />
        <path
          d="M548.992 251.008V315.733333a8.533333 8.533333 0 0 1-13.653333 6.826667L387.413333 211.626667a8.533333 8.533333 0 0 1 0-13.653334l147.925334-110.933333a8.533333 8.533333 0 0 1 13.653333 6.826667v71.808a384 384 0 0 1 383.701333 384 42.666667 42.666667 0 1 1-85.333333 0 298.666667 298.666667 0 0 0-298.368-298.666667z"
        />
      </svg>
    </button>

    <button
      v-if="showResize"
      type="button"
      class="image-freely__tool image-freely__resize"
      :class="{ 'image-freely__resize--custom': hasCustomResizeIcon || hasResizeIconText }"
      contenteditable="false"
      @mousedown.stop.prevent="startResize"
    >
      <component :is="options.resizeIcon" v-if="hasCustomResizeIcon" />
      <span v-else-if="hasResizeIconText">{{ options.resizeIcon }}</span>
    </button>

    <div ref="extraRef" class="image-freely__extra" contenteditable="false"></div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import {
  isOptionEnabled,
  normalizeRotation,
  resolveMinWidth,
  type ImageFreelyOptions
} from './ImageFreely'

const props = defineProps(nodeViewProps)

const imgRef = ref<HTMLImageElement | null>(null)
const extraRef = ref<HTMLElement | null>(null)
const isLoaded = ref(false)
const isError = ref(false)
const isResizing = ref(false)
const wrapperWidth = ref<number | null>(null)
const wrapperHeight = ref<number | null>(null)

let extraCreated = false
let cleanupResizeListeners: (() => void) | null = null

const options = computed(() => props.extension.options as ImageFreelyOptions)

const attrs = computed(() => {
  const nodeAttrs = props.node.attrs as {
    src?: string | null
    alt?: string | null
    title?: string | null
    width?: string | null
    rotate?: string | number | null
  }

  return {
    src: nodeAttrs.src ?? '',
    alt: nodeAttrs.alt ?? '',
    title: nodeAttrs.title ?? '',
    width: nodeAttrs.width ?? null,
    rotate: normalizeRotation(nodeAttrs.rotate)
  }
})

const wrapperTag = computed(() => (options.value.inline ? 'span' : 'div'))

const isResizeEnabled = computed(() => isOptionEnabled(options.value.resize))
const isRotateEnabled = computed(() => isOptionEnabled(options.value.rotate))

const showRotate = computed(() => {
  return (props.selected || isResizing.value) && props.editor.isEditable && isLoaded.value && isRotateEnabled.value
})

const showResize = computed(() => {
  return (props.selected || isResizing.value) && props.editor.isEditable && isLoaded.value && isResizeEnabled.value
})

const imageExtraAttrs = computed(() => {
  const htmlAttributes = { ...(props.HTMLAttributes ?? {}) } as Record<string, unknown>

  delete htmlAttributes.class
  delete htmlAttributes.style
  delete htmlAttributes.src
  delete htmlAttributes.alt
  delete htmlAttributes.title
  delete htmlAttributes.width
  delete htmlAttributes.rotate
  delete htmlAttributes['data-width']
  delete htmlAttributes['data-rotate']

  return htmlAttributes
})

const imageClass = computed(() => ['image-freely__img', props.HTMLAttributes?.class ?? null])

const wrapperStyle = computed(() => {
  if (wrapperWidth.value == null || wrapperHeight.value == null) return undefined

  return {
    width: `${Math.round(wrapperWidth.value)}px`,
    height: `${Math.round(wrapperHeight.value)}px`
  }
})

const imageStyle = computed(() => {
  return {
    width: attrs.value.width ?? undefined,
    transform: `rotate(${attrs.value.rotate}deg) ${getTranslate(attrs.value.rotate)}`,
    transformOrigin: 'left top'
  }
})

const hasCustomRotateIcon = computed(() => isComponent(options.value.rotateIcon))
const hasCustomResizeIcon = computed(() => isComponent(options.value.resizeIcon))
const hasRotateIconText = computed(() => {
  return typeof options.value.rotateIcon === 'string' || typeof options.value.rotateIcon === 'number'
})
const hasResizeIconText = computed(() => {
  return typeof options.value.resizeIcon === 'string' || typeof options.value.resizeIcon === 'number'
})

function isComponent(value: unknown): value is Component {
  return typeof value === 'object' || typeof value === 'function'
}

function isQuarterTurn(rotation: number): boolean {
  return Math.abs(rotation) % 180 === 90
}

function getTranslate(rotation: number): string {
  switch (rotation) {
    case -90:
      return 'translate(-100%, 0)'
    case -180:
      return 'translate(-100%, -100%)'
    case -270:
      return 'translate(0, -100%)'
    default:
      return 'translate(0, 0)'
  }
}

function scheduleSyncWrapper(): void {
  if (typeof window === 'undefined') return

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(syncWrapperSize)
  })
}

function syncWrapperSize(): void {
  const img = imgRef.value
  if (!img) return

  const width = img.offsetWidth || img.clientWidth
  const height = img.offsetHeight || img.clientHeight
  if (!width || !height) return

  if (isQuarterTurn(attrs.value.rotate)) {
    wrapperWidth.value = height
    wrapperHeight.value = width
    return
  }

  wrapperWidth.value = width
  wrapperHeight.value = height
}

function getMaxEditorWidth(): number {
  const container = props.editor.view.dom as HTMLElement | null
  const width = container?.clientWidth ?? 0
  return width > 0 ? width : 800
}

function getAspectRatio(): number {
  const img = imgRef.value
  if (!img) return 1

  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    return img.naturalWidth / img.naturalHeight
  }

  const width = img.offsetWidth || img.clientWidth
  const height = img.offsetHeight || img.clientHeight

  return width > 0 && height > 0 ? width / height : 1
}

function ensureExtraHook(): void {
  if (extraCreated || !extraRef.value || !imgRef.value) return

  options.value.onExtraCreated(extraRef.value, imgRef.value)
  extraCreated = true
}

function handleLoad(): void {
  isLoaded.value = true
  isError.value = false
  ensureExtraHook()

  const img = imgRef.value
  if (!img) {
    scheduleSyncWrapper()
    return
  }

  const maxWidth = getMaxEditorWidth()
  let nextWidth = img.offsetWidth || img.clientWidth || img.naturalWidth
  const currentHeight = img.offsetHeight || img.clientHeight || img.naturalHeight
  let shouldConstrain = false

  if (isQuarterTurn(attrs.value.rotate) && currentHeight > maxWidth) {
    nextWidth = (nextWidth * maxWidth) / currentHeight
    shouldConstrain = true
  } else if (nextWidth > maxWidth) {
    nextWidth = maxWidth
    shouldConstrain = true
  }

  const normalizedWidth = `${Math.round(nextWidth)}px`
  if (shouldConstrain && nextWidth > 0 && attrs.value.width !== normalizedWidth) {
    props.updateAttributes({ width: normalizedWidth })
    return
  }

  scheduleSyncWrapper()
}

function handleError(): void {
  isError.value = true
  isLoaded.value = false
  ensureExtraHook()

  if (extraRef.value) {
    options.value.onError(extraRef.value, imgRef.value)
  }
}

function rotateImage(): void {
  const img = imgRef.value
  if (!img) return

  const nextRotate = normalizeRotation(attrs.value.rotate - 90)
  const maxWidth = getMaxEditorWidth()
  let nextWidth = img.offsetWidth || img.clientWidth
  const currentHeight = img.offsetHeight || img.clientHeight

  if (isQuarterTurn(nextRotate) && currentHeight > maxWidth) {
    nextWidth = (nextWidth * maxWidth) / currentHeight
  } else if (!isQuarterTurn(nextRotate) && nextWidth > maxWidth) {
    nextWidth = maxWidth
  }

  props.updateAttributes({
    rotate: nextRotate,
    width: `${Math.round(nextWidth)}px`
  })
}

function startResize(event: MouseEvent): void {
  if (event.button !== 0 || !imgRef.value) return

  cleanupResizeListeners?.()
  isResizing.value = true

  const pos = props.getPos()
  if (typeof pos === 'number') {
    props.editor.commands.setNodeSelection(pos)
  }

  const img = imgRef.value
  const startX = event.clientX
  const startWidth = img.offsetWidth || img.clientWidth
  const maxWidth = getMaxEditorWidth()
  const aspectRatio = getAspectRatio()
  const maxImageWidth = isQuarterTurn(attrs.value.rotate) ? maxWidth * aspectRatio : maxWidth
  const minWidth = resolveMinWidth(options.value.resize)

  const onMouseMove = (moveEvent: MouseEvent) => {
    const delta = moveEvent.clientX - startX
    const nextWidth = Math.min(maxImageWidth, Math.max(minWidth, startWidth + delta))

    props.updateAttributes({
      width: `${Math.round(nextWidth)}px`
    })

    if (typeof pos === 'number') {
      props.editor.commands.setNodeSelection(pos)
    }
  }

  const stop = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', stop)
    document.removeEventListener('mouseleave', stop)
    isResizing.value = false
    cleanupResizeListeners = null
  }

  cleanupResizeListeners = stop

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stop)
  document.addEventListener('mouseleave', stop)
}

watch(
  () => attrs.value.src,
  () => {
    isLoaded.value = false
    isError.value = false
    wrapperWidth.value = null
    wrapperHeight.value = null
  }
)

watch(
  () => [attrs.value.width, attrs.value.rotate, attrs.value.src],
  () => {
    scheduleSyncWrapper()
  },
  { flush: 'post' }
)

watch(
  () => props.selected,
  selected => {
    if (!selected && !isResizing.value) {
      cleanupResizeListeners?.()
    }

    if (selected) {
      scheduleSyncWrapper()
    }
  }
)

watch([imgRef, extraRef], () => {
  ensureExtraHook()
}, { flush: 'post' })

onMounted(() => {
  ensureExtraHook()

  if (imgRef.value?.complete && imgRef.value.naturalWidth > 0) {
    handleLoad()
    return
  }

  scheduleSyncWrapper()
})

onBeforeUnmount(() => {
  cleanupResizeListeners?.()
})
</script>

<style scoped>
.image-freely {
  position: relative;
  display: inline-block;
  max-width: 100%;
  vertical-align: top;
}

.image-freely--inline {
  vertical-align: middle;
}

.image-freely__img {
  display: block;
  user-select: none;
  transform-origin: left top;
}

.ProseMirror-selectednode .image-freely__img {
  cursor: grab;
}

.image-freely--error .image-freely__img {
  opacity: 0.5;
}

.ProseMirror-selectednode.image-freely {
  outline: 2px solid rgba(74, 144, 217, 0.35);
  outline-offset: 2px;
}

.image-freely__tool {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
}

.image-freely__rotate {
  top: 0;
  right: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  cursor: pointer;
  transform: translate(50%, -50%);
}

.image-freely__rotate svg {
  width: 5px;
  height: 5px;
  fill: currentColor;
}

.image-freely__resize {
  right: 0;
  bottom: 0;
  cursor: nwse-resize;
  transform: translate(50%, 50%);
}

.image-freely__resize:not(.image-freely__resize--custom) {
  width: 3px;
  height: 3px;
  border: 1px solid #ffffff;
  border-radius: 2px;
  background: #111827;
}

.image-freely__resize--custom {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.image-freely__extra {
  position: absolute;
  top: 36px;
  right: 0;
  z-index: 2;
  display: flex;
  gap: 8px;
}
</style>
