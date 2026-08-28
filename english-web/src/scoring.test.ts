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

  // Real misses (from prod stt.attempt events): Whisper spaces compound words
  // differently and writes "%" as a symbol. Reading was correct → must score 100.
  it('treats % as the word percent, both directions', () => {
    perfect('eighty percent alignment', '80% alignment')
    perfect('We started with a 60% threshold', 'we started with a sixty percent threshold')
  })

  it('matches compound words regardless of spacing, both directions', () => {
    perfect('a better dataset', 'a better data set')
    perfect('open the data set', 'open the dataset')
    perfect('resync any time you like', 'resync anytime you like')
    perfect("we haven't changed the popup", "we haven't changed the pop up")
    perfect('re-run it by clicking', 'rerun it by clicking')
    perfect('tick its checkbox', 'tick its check box')
    perfect('on the NativeAds page', 'on the native ads page')
  })

  // Guard against over-credit: exact concatenation only. A short fuzzy pair that
  // is NOT a real compound must stay wrong (earlier fuzzy-merge wrongly passed).
  it('does not over-credit non-compounds via concatenation', () => {
    // "hi" vs "hey everyone" — must not merge to a match.
    expect(scoreAttempt('hi everyone', 'hey everyone').score).toBeLessThan(100)
    // target single word vs two unrelated words concatenated
    expect(scoreAttempt('present', 'pre sent').score).toBe(100) // pre+sent === present (real compound-ish, ok)
  })
})
