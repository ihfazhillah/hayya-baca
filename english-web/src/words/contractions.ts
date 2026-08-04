/** Curated contraction & weak/strong-form drills (Spec 069). Audio is browser
 *  TTS (en-AU); this is the paired-form content to contrast by ear. */
export interface ContractionDrill {
  id: string
  label: string
  forms: { text: string; note?: string }[]
}

export const CONTRACTIONS: ContractionDrill[] = [
  {
    id: 'were',
    label: "We're ↔ We are",
    forms: [
      { text: "We're", note: 'kontraksi, 1 suku kata /wɪr/' },
      { text: 'We are', note: 'bentuk penuh, 2 kata' },
    ],
  },
  {
    id: 'its',
    label: "It's ↔ It is",
    forms: [
      { text: "It's", note: '/ɪts/' },
      { text: 'It is', note: 'penuh' },
    ],
  },
  {
    id: 'theyre',
    label: "They're ↔ They are",
    forms: [{ text: "They're" }, { text: 'They are' }],
  },
  {
    id: 'dont',
    label: "Don't ↔ Do not",
    forms: [{ text: "Don't" }, { text: 'Do not' }],
  },
  {
    id: 'ill',
    label: "I'll ↔ I will",
    forms: [{ text: "I'll" }, { text: 'I will' }],
  },
  {
    id: 'the',
    label: 'the — weak vs strong',
    forms: [
      { text: 'the apple', note: 'strong /ðiː/ sebelum vokal' },
      { text: 'the book', note: 'weak /ðə/ sebelum konsonan' },
    ],
  },
]
