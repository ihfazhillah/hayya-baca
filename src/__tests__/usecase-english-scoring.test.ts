import { scoreAttempt, normalizeWords } from "@/lib/english";

/**
 * Use case: a learner speaks a sentence correctly, but Whisper transcribes it
 * in a normalized form — contractions expanded ("you'll"→"you will") or numbers
 * as digits ("three"→"3"). Scoring must still credit them, by canonicalizing
 * both the reference and the transcript before aligning. Kept in sync with
 * english-web/src/scoring.test.ts.
 */
describe("english scoring is fair across Whisper normalization", () => {
  const perfect = (target: string, attempt: string) =>
    expect(scoreAttempt(target, attempt).score).toBe(100);

  it("canonicalizes contractions and numbers consistently", () => {
    expect(normalizeWords("you'll")).toEqual(["you", "will"]);
    expect(normalizeWords("don't")).toEqual(["do", "not"]);
    expect(normalizeWords("won't")).toEqual(["will", "not"]);
    expect(normalizeWords("cannot")).toEqual(["can", "not"]);
    expect(normalizeWords("three")).toEqual(["3"]);
    expect(normalizeWords("John’s")).toEqual(["john's"]); // possessive kept
  });

  it("credits contraction ↔ expanded, both directions", () => {
    perfect("You'll be fine.", "you will be fine");
    perfect("you will be fine", "You'll be fine");
    perfect("Don't stop now", "do not stop now");
  });

  it("credits number word ↔ digit, both directions", () => {
    perfect("I have three apples", "i have 3 apples");
    perfect("3 apples", "three apples");
  });

  it("does not break possessives", () => {
    perfect("This is John's book", "this is John's book");
  });

  // Real prod misses: Whisper writes "%" as a symbol and spaces compound words
  // differently. A correct reading must still score 100.
  it("credits % ↔ percent and compound spacing, both directions", () => {
    perfect("eighty percent alignment", "80% alignment");
    perfect("a better dataset", "a better data set");
    perfect("open the data set", "open the dataset");
    perfect("resync any time you like", "resync anytime you like");
    perfect("re-run it by clicking", "rerun it by clicking");
  });

  it("does not over-credit non-compounds via fuzzy concatenation", () => {
    expect(scoreAttempt("hi everyone", "hey everyone").score).toBeLessThan(100);
  });
});
