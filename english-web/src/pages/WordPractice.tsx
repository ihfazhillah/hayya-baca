import { useCallback, useEffect, useState } from 'react'
import {
  addWord,
  fetchWords,
  lookupWord,
  recordWords,
  removeWord,
  type WordPractice as WP,
} from '../api'
import { scoreAttempt, type AttemptScore } from '../scoring'
import { speakAU, stopSpeaking, useEnglishRecorder } from '../speech'
import { CONTRACTIONS } from '../words/contractions'
import { ScoreMarks } from '../components/ScoreMarks'

const playUrl = (url: string) => {
  const a = new Audio(url)
  void a.play()
}

function WordRow({
  w,
  onChange,
}: {
  w: WP
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [ipa, setIpa] = useState('')
  const [audio, setAudio] = useState('')

  useEffect(() => {
    let alive = true
    lookupWord(w.word)
      .then((d) => {
        if (!alive) return
        setIpa(d.ipa)
        setAudio(d.audio)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [w.word])

  return (
    <li className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-left"
        >
          <span className="text-lg font-semibold text-gray-800">{w.word}</span>
          {ipa && <span className="ml-2 text-sm text-gray-400">{ipa}</span>}
        </button>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{w.pass_streak}/3 lulus</span>
          <button
            onClick={() => removeWord(w.word).then(onChange)}
            className="rounded px-1.5 py-0.5 hover:text-red-500"
            aria-label="Hapus"
          >
            ✕
          </button>
        </div>
      </div>
      {open && <WordDrill word={w.word} nativeAudio={audio} onPass={onChange} />}
    </li>
  )
}

function WordDrill({
  word,
  nativeAudio,
  onPass,
}: {
  word: string
  nativeAudio?: string
  onPass: () => void
}) {
  const [result, setResult] = useState<AttemptScore | null>(null)
  const rec = useEnglishRecorder()

  useEffect(() => {
    if (rec.transcript) {
      const s = scoreAttempt(word, rec.transcript)
      setResult(s)
      if (s.score >= 60) void recordWords([{ word, pass: 1 }]).then(onPass)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.transcript])

  return (
    <div className="mt-2 rounded-lg bg-violet-50 p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => speakAU(word)}
          className="rounded-lg bg-[#6C5CE7] px-3 py-1.5 text-sm font-bold text-white"
        >
          ▶️ TTS
        </button>
        {nativeAudio && (
          <button
            onClick={() => playUrl(nativeAudio)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white"
          >
            🔊 Asli
          </button>
        )}
        {!rec.isRecording ? (
          <button
            onClick={() => {
              setResult(null)
              stopSpeaking()
              void rec.start()
            }}
            disabled={rec.isTranscribing}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {rec.isTranscribing ? '⏳ Menilai…' : '● Rekam'}
          </button>
        ) : (
          <button
            onClick={rec.stop}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-bold text-white"
          >
            ■ Selesai
          </button>
        )}
      </div>
      {rec.error && <p className="mt-2 text-sm text-red-500">{rec.error}</p>}
      {result && <ScoreMarks result={result} />}
    </div>
  )
}

export function WordPractice() {
  const [words, setWords] = useState<WP[] | null>(null)
  const [input, setInput] = useState('')

  const load = useCallback(() => {
    fetchWords()
      .then(setWords)
      .catch(() => setWords([]))
  }, [])
  useEffect(() => load(), [load])
  useEffect(() => () => stopSpeaking(), [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const w = input.trim()
    if (!w) return
    setInput('')
    await addWord(w).catch(() => {})
    load()
  }

  return (
    <div>
      <h2 className="text-xl font-extrabold text-gray-800">🗣️ Latihan Baca Kata</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Latih kata yang sering salah: dengar (aksen AU), tirukan, sampai lancar.
        Kata otomatis terkumpul dari kesalahan shadowing.
      </p>

      <form onSubmit={add} className="mb-5 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tambah kata / frasa (mis. nuanced, we are)"
          className="flex-1 rounded-xl border border-gray-200 bg-white p-2.5 outline-none focus:ring-2 focus:ring-[#6C5CE7]"
        />
        <button className="rounded-xl bg-[#6C5CE7] px-4 font-bold text-white">
          Tambah
        </button>
      </form>

      {!words && <p className="text-gray-500">Memuat…</p>}
      {words && words.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-gray-500 shadow-sm">
          Belum ada kata. Tambah manual di atas, atau kata yang sering salah saat
          shadowing akan muncul otomatis.
        </p>
      )}

      <ul className="space-y-2.5">
        {words?.map((w) => (
          <WordRow key={w.word} w={w} onChange={load} />
        ))}
      </ul>

      <h3 className="mb-2 mt-7 text-lg font-bold text-gray-800">
        🔁 Kontraksi &amp; bentuk lemah/kuat
      </h3>
      <ul className="space-y-2.5">
        {CONTRACTIONS.map((c) => (
          <li key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-2 font-semibold text-gray-800">{c.label}</p>
            <div className="flex flex-wrap gap-2">
              {c.forms.map((f) => (
                <button
                  key={f.text}
                  onClick={() => speakAU(f.text)}
                  className="rounded-lg bg-violet-50 px-3 py-2 text-left text-sm text-violet-800"
                >
                  ▶️ {f.text}
                  {f.note && (
                    <span className="block text-xs text-violet-500">{f.note}</span>
                  )}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
