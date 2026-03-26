import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ImageFreelyView from './ImageFreelyView.vue'

export type ResizeOption =
  | boolean
  | {
      enabled?: boolean
      minWidth?: number
      alwaysPreserveAspectRatio?: boolean
    }

export type RotateOption =
  | boolean
  | {
      enabled?: boolean
    }

export interface ImageFreelyOptions {
  inline: boolean
  allowBase64: boolean
  HTMLAttributes: Record<string, any>
  resize: ResizeOption
  resizeIcon: any
  rotate: RotateOption
  rotateIcon: any
  onExtraCreated: (eleExtra: HTMLElement, imgRef: HTMLImageElement) => void
  onError: (eleExtra: HTMLElement, imgRef?: HTMLImageElement | null) => void
}

export interface SetImageOptions {
  src: string
  alt?: string
  title?: string
  width?: string | number | null
  rotate?: string | number | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      setImage: (options: SetImageOptions) => ReturnType
    }
  }
}

export const inputRegex =
  /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/

export function normalizeCssSize(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null

  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${Math.round(value)}px` : null
  }

  const normalized = value.trim()
  if (!normalized || normalized === 'auto') return null
  if (/^\d+(\.\d+)?$/.test(normalized)) return `${normalized}px`

  return normalized
}

export function normalizeRotation(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0

  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 0

  const snapped = Math.round(numeric / 90) * 90
  let normalized = snapped % 360

  if (normalized > 0) {
    normalized -= 360
  }

  if (normalized <= -360 || normalized === 360) {
    return 0
  }

  return normalized
}

export function isOptionEnabled(option: ResizeOption | RotateOption, defaultValue = true): boolean {
  if (typeof option === 'boolean') return option
  if (option && typeof option === 'object' && typeof option.enabled === 'boolean') {
    return option.enabled
  }

  return defaultValue
}

export function resolveMinWidth(option: ResizeOption, fallback = 80): number {
  if (option && typeof option === 'object' && typeof option.minWidth === 'number' && option.minWidth > 0) {
    return option.minWidth
  }

  return fallback
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

function buildWidthStyle(width: string | null): string | null {
  if (!width) return null
  return `width: ${width};`
}

function buildRotationStyle(rotation: number): string | null {
  if (!rotation) return null
  return `transform: rotate(${rotation}deg) ${getTranslate(rotation)}; transform-origin: left top;`
}

function readWidth(element: HTMLElement): string | null {
  const raw = element.getAttribute('data-width') ?? element.style.width ?? element.getAttribute('width')
  return normalizeCssSize(raw)
}

function readRotation(element: HTMLElement): number {
  const raw = element.getAttribute('data-rotate') ?? element.getAttribute('rotate')
  return normalizeRotation(raw)
}

function shouldStopNodeViewEvent(event: Event): boolean {
  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('.image-freely__tool, .image-freely__extra'))
}

const ImageFreely = Node.create<ImageFreelyOptions>({
  name: 'image',
  draggable: true,

  addOptions() {
    return {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
      resize: true,
      resizeIcon: null,
      rotate: true,
      rotateIcon: null,
      onExtraCreated: () => {},
      onError: () => {}
    }
  },

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  addAttributes() {
    return {
      src: {
        default: null
      },
      alt: {
        default: null
      },
      title: {
        default: null
      },
      width: {
        default: null,
        parseHTML: element => readWidth(element as HTMLElement),
        renderHTML: attributes => {
          const width = normalizeCssSize(attributes.width)
          const style = buildWidthStyle(width)

          return {
            ...(width ? { 'data-width': width } : {}),
            ...(style ? { style } : {})
          }
        }
      },
      rotate: {
        default: 0,
        parseHTML: element => readRotation(element as HTMLElement),
        renderHTML: attributes => {
          const rotate = normalizeRotation(attributes.rotate)
          const style = buildRotationStyle(rotate)

          return {
            ...(rotate ? { 'data-rotate': String(rotate) } : {}),
            ...(style ? { style } : {})
          }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64
          ? 'img[src]'
          : 'img[src]:not([src^="data:"])'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addCommands() {
    return {
      setImage:
        options =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              ...options,
              width: normalizeCssSize(options.width),
              rotate: normalizeRotation(options.rotate)
            }
          })
        }
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageFreelyView, {
      stopEvent: ({ event }) => shouldStopNodeViewEvent(event),
    })
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: match => {
          const [, , alt, src, title] = match

          return {
            src,
            alt,
            title
          }
        }
      })
    ]
  }
})

export default ImageFreely
export { ImageFreely }
