import { describe, expect, it } from 'vitest'
import { docToPlainText, excerpt, isEmptyDoc } from './prosemirror'
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
