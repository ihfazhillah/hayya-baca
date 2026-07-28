// Client-side helpers for ProseMirror JSON (must mirror the backend whitelist:
// doc/paragraph/text/hardBreak, marks bold/italic/textStyle).
import type { PMDoc, PMNode } from '@/api/types'

export function emptyDoc(): PMDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

// Plain text → ProseMirror doc, one paragraph per line (blank line = empty
// paragraph). Mirrors the backend whitelist: doc → paragraph → text.
export function textToDoc(text: string): PMDoc {
  return {
    type: 'doc',
    content: text.split('\n').map((line) =>
      line.length === 0
        ? { type: 'paragraph' }
        : { type: 'paragraph', content: [{ type: 'text', text: line }] },
    ),
  }
}

export function docToPlainText(doc: PMDoc | null): string {
  if (!doc) return ''
  const parts: string[] = []
  const walk = (node: PMNode) => {
    if (node.type === 'text' && node.text) parts.push(node.text)
    if (node.type === 'hardBreak') parts.push(' ')
    node.content?.forEach(walk)
    if (node.type === 'paragraph') parts.push('\n')
  }
  walk(doc)
  return parts.join('').replace(/\n{2,}/g, '\n').trim()
}

export function isEmptyDoc(doc: PMDoc | null): boolean {
  return docToPlainText(doc).length === 0
}

export function excerpt(doc: PMDoc | null, limit = 140): string {
  const text = docToPlainText(doc).replace(/\n/g, ' ')
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text
}
