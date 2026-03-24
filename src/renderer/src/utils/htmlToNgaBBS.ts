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

export type HtmlToNgaBBSOptions = {
  imageConfig?: Partial<ImageModuleConfig>
}

function normalizePath(input: string): string {
  let path = input.replace(/\\/g, '/')
  path = path.replace(/\/+/g, '/')
  path = path.replace(/^([A-Za-z])\/(.+)$/, '$1:/$2')
  return path.replace(/^[A-Z]/, (match)=>match.toLowerCase())
}

function parseAppImagePath(src: string): string | null {
  if (!src.startsWith('app://')) return null

  const raw = src.slice('app://'.length)
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

function applyInlineStyle(el: HTMLElement, content: string): string {
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
    out = wrap(`size=${style.fontSize}`, out)
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
  return `[list]\n${items}[/list]\n\n`
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
  return `[table]\n${lines.join('\n')}\n[/table]\n\n`
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
    return `[collapse]\n${content}\n[/collapse]\n\n`
  }

  return `[collapse=${summary}]\n${content}\n[/collapse]\n\n`
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
      const resolved = resolveImageSource(src, options)
      return resolved ? `[img]${resolved}[/img]` : ''
    }
    case 'blockquote': {
      const content = serializeChildren(el, options).trim()
      return content ? `[quote]\n${content}\n[/quote]\n\n` : ''
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
      return content ? `[h]${content}[/h]\n\n` : ''
    }
    case 'hr':
      return '[h][/h]\n\n'
    case 'p':
    case 'div': {
      const inner = serializeChildren(el, options)
      const block = applyBlockStyle(el, inner).trim()
      return block ? `${block}\n\n` : '\n'
    }
    case 'span': {
      const inner = serializeChildren(el, options)
      return applyInlineStyle(el, inner)
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
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}
