import { describe, expect, it } from 'vitest'
import { docToPlainText, excerpt, isEmptyDoc, textToDoc } from './prosemirror'
import type { PMDoc } from '@/api/types'

const doc = (text: string): PMDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

describe('prosemirror helpers', () => {
  it('flattens a doc to plain text', () => {
    expect(docToPlainText(doc('Hujan turun'))).toBe('Hujan turun')
  })

  it('detects an empty doc', () => {
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
    expect(isEmptyDoc(doc('x'))).toBe(false)
  })

  it('truncates an excerpt', () => {
    const out = excerpt(doc('a'.repeat(200)), 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith('…')).toBe(true)
  })

  it('handles null', () => {
    expect(docToPlainText(null)).toBe('')
    expect(isEmptyDoc(null)).toBe(true)
  })
})

describe('textToDoc', () => {
  it('wraps a single line in one paragraph', () => {
    expect(textToDoc('Halo')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Halo' }] }],
    })
  })

  it('splits newlines into separate paragraphs', () => {
    const out = textToDoc('baris satu\nbaris dua')
    expect(out.content).toHaveLength(2)
    expect(docToPlainText(out)).toBe('baris satu\nbaris dua')
  })

  it('keeps a blank line as an empty paragraph', () => {
    const out = textToDoc('atas\n\nbawah')
    expect(out.content).toHaveLength(3)
    expect(out.content?.[1]).toEqual({ type: 'paragraph' })
  })
})
