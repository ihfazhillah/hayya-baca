/** Curated target sounds for "Fitness Lidah" (Spec 066) + their drill content.
 *
 * v1 detects a target in a word by spelling pattern (`match`) rather than a full
 * CMUdict — light, offline, no 4 MB dict. Good enough to *suggest* drills; a real
 * phoneme dictionary can replace `match` later for accuracy. Tuned for the sounds
 * Indonesian speakers of English trip on most.
 */
export interface TargetPhoneme {
  id: string
  label: string
  /** Spelling pattern that hints this sound is present in a word. */
  match: RegExp
  tip: string
  examples: string[]
  minimalPairs: [string, string][]
  tongueTwister: string
}

export const TARGET_PHONEMES: TargetPhoneme[] = [
  {
    id: 'TH',
    label: 'TH /θ–ð/',
    match: /th/,
    tip: 'Ujung lidah di antara gigi, tiupkan udara — bukan “t” atau “d”.',
    examples: ['think', 'this', 'three', 'weather'],
    minimalPairs: [
      ['think', 'sink'],
      ['three', 'tree'],
      ['they', 'day'],
    ],
    tongueTwister: 'The thirty-three thieves thought they thrilled the throne.',
  },
  {
    id: 'V',
    label: 'V /v/',
    match: /v/,
    tip: 'Gigit pelan bibir bawah dan getarkan — beda dari “f” yang tanpa getar.',
    examples: ['very', 'voice', 'love', 'seven'],
    minimalPairs: [
      ['vote', 'boat'],
      ['van', 'fan'],
      ['vest', 'best'],
    ],
    tongueTwister: 'Vivian’s very vivid violet van.',
  },
  {
    id: 'F',
    label: 'F /f/',
    match: /ph|f/,
    tip: 'Gigit bibir bawah, hembuskan udara tanpa suara.',
    examples: ['four', 'phone', 'coffee', 'laugh'],
    minimalPairs: [
      ['fan', 'van'],
      ['fine', 'vine'],
    ],
    tongueTwister: 'Four furious friends fought for the phone.',
  },
  {
    id: 'R',
    label: 'R /r/',
    match: /r/,
    tip: 'Lidah menggulung sedikit, tidak menyentuh langit-langit — bukan “r” getar.',
    examples: ['red', 'right', 'around', 'water'],
    minimalPairs: [
      ['right', 'light'],
      ['road', 'load'],
      ['rice', 'lice'],
    ],
    tongueTwister: 'Really rural roads run round the river.',
  },
  {
    id: 'L',
    label: 'L /l/',
    match: /l/,
    tip: 'Ujung lidah menempel di belakang gigi atas.',
    examples: ['light', 'yellow', 'little', 'call'],
    minimalPairs: [
      ['light', 'right'],
      ['lead', 'read'],
    ],
    tongueTwister: 'Little Lily lazily licked a lollipop.',
  },
  {
    id: 'SH',
    label: 'SH /ʃ/',
    match: /sh/,
    tip: 'Bibir sedikit maju, udara mengalir panjang “sh”.',
    examples: ['she', 'shop', 'wash', 'fish'],
    minimalPairs: [
      ['ship', 'sip'],
      ['she', 'see'],
    ],
    tongueTwister: 'She sells sea shells by the sea shore.',
  },
  {
    id: 'Z',
    label: 'Z /z/',
    match: /z/,
    tip: 'Seperti “s” tapi dengan getar suara.',
    examples: ['zoo', 'zero', 'buzz', 'lazy'],
    minimalPairs: [
      ['zip', 'sip'],
      ['zoo', 'sue'],
    ],
    tongueTwister: 'Zippy zebras zigzag in a zany zoo.',
  },
]

export const TARGET_BY_ID: Record<string, TargetPhoneme> = Object.fromEntries(
  TARGET_PHONEMES.map((p) => [p.id, p]),
)
