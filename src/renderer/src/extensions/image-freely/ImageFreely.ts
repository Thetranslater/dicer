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

export interface ImageFreelyOptions {
  inline: boolean
  allowBase64: boolean
  HTMLAttributes: Record<string, any>
  resize: ResizeOption
  resizeIcon: any
  onExtraCreated: (eleExtra: HTMLElement, imgRef: HTMLImageElement) => void
  onError: (eleExtra: HTMLElement, imgRef?: HTMLImageElement | null) => void
}

export interface SetImageOptions {
  src: string
  alt?: string
  title?: string
  width?: string | number | null
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

export function isOptionEnabled(option: ResizeOption, defaultValue = true): boolean {
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

function buildWidthStyle(width: string | null): string | null {
  if (!width) return null
  return `width: ${width};`
}

function readWidth(element: HTMLElement): string | null {
  const raw = element.getAttribute('data-width') ?? element.style.width ?? element.getAttribute('width')
  return normalizeCssSize(raw)
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
              width: normalizeCssSize(options.width)
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
