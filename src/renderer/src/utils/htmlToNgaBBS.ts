const AC1_EMOJICODE = [
  'blink', 'goodjob', '上', '中枪', '偷笑', '冷', '凌乱', '反对', '吓', '吻', '呆', '咦', '哦', '哭', '哭1', '哭笑', '哼', '喘', '喷', '嘲笑', '嘲笑1', '囧', '委屈', '心', '忧伤', '怒', '怕', '惊', '愁', '抓狂', '抠鼻', '擦汗', '无语', '晕', '汗', '瞎', '羞', '羡慕', '花痴', '茶', '衰', '计划通', '赞同', '闪光', '黑枪'
]
const AC2_EMOJICODE = [
  'goodjob', '偷笑', '怒', '欸嘿', '笑', '那个...', '哦嗬嗬嗬', '舔', '有何贵干', '病娇', 'lucky', '鬼脸', '大哭', '冷', '哭', '妮可妮可妮', '惊', 'poi', '恨', '囧2', '中枪', '囧', '你看看你', 'yes', 'doge', '自戳双目', '偷吃', '冷笑', '壁咚', '不活了', '不明觉厉', 'jojo立', 'jojo立2', 'jojo立3', 'jojo立5', 'jojo立方4', '威吓', '你已经死了', '异议', '认真', '你这种人...', '是在下输了', '抢镜头', '你为猴这么', '干杯', '干杯2'
]

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, ' ')
}

function wrap(tag: string, content: string): string {
  if (!content) return ''
  return `[${tag}]${content}[/${tag.split('=')[0]}]`
}

export type ImageModuleConfig = {
  rootPath: string | null
  attachmentMappings: Record<string, string>
}

export type EditorModuleConfig = {
  baseFontSizePx?: number
}

export type HtmlToNgaBBSOptions = {
  imageConfig?: Partial<ImageModuleConfig>
  editorConfig?: Partial<EditorModuleConfig>
}

const DEFAULT_BASE_FONT_SIZE_PX = 16

function normalizePath(input: string): string {
  let path = input.replace(/\\/g, '/')
  path = path.replace(/\/+/g, '/')
  path = path.replace(/^([A-Za-z])\/(.+)$/, '$1:/$2')
  return path.replace(/^[A-Z]/, (match) => match.toLowerCase())
}

function parsePxValue(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i)
  if (!match) return null
  const n = Number(match[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function resolveBaseFontSizePx(options?: HtmlToNgaBBSOptions): number {
  const raw = options?.editorConfig?.baseFontSizePx
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BASE_FONT_SIZE_PX
  return n
}

function toNgaFontSizeTag(value: string, options?: HtmlToNgaBBSOptions): string {
  const px = parsePxValue(value)
  if (!px) {
    return `size=${value}`
  }

  const basePx = resolveBaseFontSizePx(options)
  const percent = Math.max(1, Math.round((px / basePx) * 100))
  return `size=${percent}%`
}

function parseAppImagePath(src: string): string {
  let raw = src
  if (src.startsWith('app://'))
    raw = src.slice('app://'.length)
  try {
    return normalizePath(decodeURIComponent(raw))
  } catch {
    return normalizePath(raw)
  }
}

function toRelativePath(absolutePath: string, rootPath: string): string | null {
  const abs = normalizePath(absolutePath).replace(/\/+$/, '')
  const root = normalizePath(rootPath).replace(/\/+$/, '')

  if (!root) return null
  if (abs === root) return null
  if (!abs.startsWith(`${root}/`)) return null

  return abs.slice(root.length + 1).replace(/^\/+/, '')
}

function resolveImageSource(src: string, options?: HtmlToNgaBBSOptions): string {
  const config = options?.imageConfig
  if (!config) return src
  if (!config.rootPath || !config.attachmentMappings) return src

  const absolutePath = parseAppImagePath(src)
  if (!absolutePath) return src

  const relativePath = toRelativePath(absolutePath, config.rootPath)
  if (!relativePath) return src

  const mapped = config.attachmentMappings[relativePath]
  if (typeof mapped !== 'string') return src

  const trimmed = mapped.trim()
  return trimmed || src
}

function getImageFileIndex(src: string): number | null {
  const path = parseAppImagePath(src)
  const file = path.split('/').pop() ?? ''
  const stem = file.replace(/\.[^.]+$/, '')
  if (!/^\d+$/.test(stem)) return null

  const index = Number(stem)
  return Number.isInteger(index) ? index : null
}

function getEmojiSetFromSrc(src: string): 'ac' | 'a2' | null {
  const path = parseAppImagePath(src)
  if (path.includes('/emoji/ac1/') || path.includes('/ac1/')) return 'ac'
  if (path.includes('/emoji/ac2/') || path.includes('/ac2/')) return 'a2'
  return null
}

function resolveEmojiTag(src: string): string | null {
  const set = getEmojiSetFromSrc(src)
  const index = getImageFileIndex(src)
  if (!set || index === null) return null

  if (set === 'ac') {
    if (index < 0 || index >= AC1_EMOJICODE.length) return null
    const code = AC1_EMOJICODE[index]
    return code ? `[s:ac:${code}]` : null
  }

  if (index < 0 || index >= AC2_EMOJICODE.length) return null
  const code = AC2_EMOJICODE[index]
  return code ? `[s:a2:${code}]` : null
}

function applyInlineStyle(el: HTMLElement, content: string, options?: HtmlToNgaBBSOptions): string {
  let out = content
  const style = el.style

  if (style.color) {
    out = wrap(`color=${style.color}`, out)
  }

  if (style.fontFamily) {
    const font = style.fontFamily.replace(/['"]/g, '').split(',')[0]?.trim()
    if (font) out = wrap(`font=${font}`, out)
  }

  if (style.fontSize) {
    out = wrap(toNgaFontSizeTag(style.fontSize, options), out)
  }

  return out
}

function applyBlockStyle(el: HTMLElement, content: string): string {
  let out = content
  const align = el.style.textAlign?.trim().toLowerCase()
  if (align === 'left' || align === 'center' || align === 'right') {
    out = wrap(`align=${align}`, out)
  }
  return out
}

function serializeChildren(node: Node, options?: HtmlToNgaBBSOptions): string {
  return Array.from(node.childNodes).map((child) => serializeNode(child, options)).join('')
}

function serializeList(el: HTMLElement, options?: HtmlToNgaBBSOptions): string {
  const items = Array.from(el.children)
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((li) => {
      const content = serializeChildren(li, options).trim()
      return content ? `[*]${content}\n` : ''
    })
    .join('')

  if (!items) return ''
  return `[list]\n${items}[/list]\n`
}

function serializeTable(el: HTMLElement, options?: HtmlToNgaBBSOptions): string {
  const rows = Array.from(el.querySelectorAll(':scope > tbody > tr, :scope > tr'))
  if (rows.length === 0) return ''

  const lines = rows
    .map((tr) => {
      const cells = Array.from(tr.children)
        .filter((cell) => {
          const tag = cell.tagName.toLowerCase()
          return tag === 'td' || tag === 'th'
        })
        .map((cell) => `[td]${serializeChildren(cell, options).trim()}[/td]`)
        .join('')
      return cells ? `[tr]${cells}[/tr]` : ''
    })
    .filter(Boolean)

  if (lines.length === 0) return ''
  return `[table]\n${lines.join('\n')}\n[/table]\n`
}

function serializeDetails(el: HTMLElement, options?: HtmlToNgaBBSOptions): string {
  const summaryEl = Array.from(el.children).find(
    (child) => child.tagName.toLowerCase() === 'summary'
  ) as HTMLElement | undefined
  const summary = summaryEl ? serializeChildren(summaryEl, options).trim() : ''

  const content = Array.from(el.childNodes)
    .filter((child) => child !== summaryEl)
    .map((child) => serializeNode(child, options))
    .join('')
    .trim()

  if (!summary) {
    return `[collapse]\n${content}\n[/collapse]\n`
  }

  return `[collapse=${summary}]\n${content}\n[/collapse]\n`
}

function serializeNode(node: Node, options?: HtmlToNgaBBSOptions): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeText(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  switch (tag) {
    case 'br':
      return '\n'
    case 'strong':
    case 'b':
      return wrap('b', serializeChildren(el, options))
    case 'em':
    case 'i':
      return wrap('i', serializeChildren(el, options))
    case 'u':
      return wrap('u', serializeChildren(el, options))
    case 's':
    case 'strike':
    case 'del':
      return wrap('del', serializeChildren(el, options))
    case 'sub':
      return wrap('sub', serializeChildren(el, options))
    case 'sup':
      return wrap('sup', serializeChildren(el, options))
    case 'a': {
      const href = el.getAttribute('href') || ''
      const text = serializeChildren(el, options) || href
      return href ? `[url=${href}]${text}[/url]` : text
    }
    case 'img': {
      const src = el.getAttribute('src') || ''
      const emojiTag = resolveEmojiTag(src)
      if (emojiTag) return emojiTag
      const resolved = resolveImageSource(src, options)
      return resolved ? `[img]${resolved}[/img]` : ''
    }
    case 'blockquote': {
      const content = serializeChildren(el, options).trim()
      return content ? `[quote]\n${content}\n[/quote]\n` : ''
    }
    case 'ul':
    case 'ol':
      return serializeList(el, options)
    case 'details':
      return serializeDetails(el, options)
    case 'table':
      return serializeTable(el, options)
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const content = serializeChildren(el, options).trim()
      return content ? `[h]${content}[/h]\n` : ''
    }
    case 'hr':
      return '[h][/h]\n'
    case 'p':
    case 'div': {
      const inner = serializeChildren(el, options)
      const block = applyBlockStyle(el, inner).trim()
      return block ? `${block}\n` : '\n'
    }
    case 'span': {
      const inner = serializeChildren(el, options)
      return applyInlineStyle(el, inner, options)
    }
    default:
      return serializeChildren(el, options)
  }
}

export function htmlToNgaBBS(html: string, options?: HtmlToNgaBBSOptions): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const raw = serializeChildren(doc.body, options)

  return raw
    .replace(/\n{3,}/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}
