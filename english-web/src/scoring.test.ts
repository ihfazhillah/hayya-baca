import { describe, it, expect } from 'vitest'
import { scoreAttempt, normalizeWords } from './scoring'

/** Scoring must be fair when Whisper normalizes speech differently from the
 *  reference text: contractions expanded ("you'll"→"you will") and numbers as
 *  digits ("three"→"3"). Both sides are canonicalized before comparison. */
describe('normalizeWords canonicalization', () => {
  it('expands contractions the same way regardless of source form', () => {
    expect(normalizeWords("you'll")).toEqual(['you', 'will'])
    expect(normalizeWords("don't")).toEqual(['do', 'not'])
    expect(normalizeWords("we're")).toEqual(['we', 'are'])
    expect(normalizeWords("I've")).toEqual(['i', 'have'])
    expect(normalizeWords("I'm")).toEqual(['i', 'am'])
    expect(normalizeWords("won't")).toEqual(['will', 'not'])
    expect(normalizeWords("can't")).toEqual(['can', 'not'])
    expect(normalizeWords('cannot')).toEqual(['can', 'not'])
    expect(normalizeWords("it's")).toEqual(['it', 'is'])
  })

  it('unifies number words and digits', () => {
    expect(normalizeWords('three')).toEqual(['3'])
    expect(normalizeWords('twenty')).toEqual(['20'])
  })

  it('leaves possessive ’s and typographic apostrophes intact', () => {
    // curly apostrophe normalized to straight, possessive kept
    expect(normalizeWords('John’s')).toEqual(["john's"])
    expect(normalizeWords("you’ll")).toEqual(['you', 'will'])
  })
})

describe('scoreAttempt is fair across normalization', () => {
  const perfect = (t: string, a: string) => expect(scoreAttempt(t, a).score).toBe(100)

  it('contraction vs expanded, both directions', () => {
    perfect("You'll be fine.", 'you will be fine')
    perfect('you will be fine', "You'll be fine")
    perfect("Don't stop now", 'do not stop now')
  })

  it('number word vs digit, both directions', () => {
    perfect('I have three apples', 'i have 3 apples')
    perfect('3 apples', 'three apples')
  })

  it('does not break possessives', () => {
    perfect("This is John's book", "this is John's book")
  })
})
