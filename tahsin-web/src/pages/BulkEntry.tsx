import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '../me'
import { bulkRecords, listRecords, ApiError } from '../api'
import {
  buildBulkPayload,
  clearDraft,
  emptyRow,
  isTouched,
  loadDraft,
  saveDraft,
  type Draft,
} from '../draft'
import { today } from '../period'
import { BigButton, Card, Header, Pill, Toast } from '../components/ui'
import { ScorePicker } from '../components/ScorePicker'

export function BulkEntry() {
  const { me } = useMe()
  const nav = useNavigate()
  const items = useMemo(() => me?.items ?? [], [me])
  const santri = me?.santri ?? []

  const [date, setDate] = useState(today())
  const [draft, setDraft] = useState<Draft>(() => loadDraft(today()))
  const [existing, setExisting] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Reload draft + duplicate warnings whenever the date changes.
  useEffect(() => {
    setDraft(loadDraft(date))
    listRecords({ from: date, to: date })
      .then((recs) => setExisting(new Set(recs.map((r) => r.santri))))
      .catch(() => setExisting(new Set()))
  }, [date])

  const persist = (next: Draft) => {
    setDraft(next)
    saveDraft(date, next)
  }
  const toggle = (sid: number) => {
    const row = draft[sid] ?? emptyRow()
    persist({ ...draft, [sid]: { ...row, open: !row.open } })
  }
  const setField = (sid: number, field: 'page' | 'page_detail', v: string) => {
    const row = draft[sid] ?? emptyRow()
    persist({ ...draft, [sid]: { ...row, [field]: v } })
  }
  const setScore = (sid: number, itemId: number, v: number | null) => {
    const row = draft[sid] ?? emptyRow()
    const scores = { ...row.scores }
    if (v == null) delete scores[itemId]
    else scores[itemId] = v
    persist({ ...draft, [sid]: { ...row, scores } })
  }

  const payload = buildBulkPayload(date, draft)
  const count = payload.length

  const submit = async () => {
    setBusy(true)
    try {
      await bulkRecords(payload)
      clearDraft(date)
      setToast(`${count} catatan tersimpan`)
      setTimeout(() => nav('/'), 900)
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Header title="Input catatan" back="/" />
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="date"
            className="flex-1 rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-teal-600"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {Object.keys(draft).length > 0 && <Pill>Draft tersimpan</Pill>}
        </div>
        <p className="text-gray-500 text-sm mb-3">
          Centang santri yang setor pada tanggal ini, lalu isi halaman & skor.
          Yang tidak dicentang tidak dikirim.
        </p>

        <div className="flex flex-col gap-2.5">
          {santri.map((s) => {
            const row = draft[s.id] ?? emptyRow()
            const dup = existing.has(s.id)
            return (
              <Card key={s.id}>
                <div
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => toggle(s.id)}
                >
                  <span
                    className={`w-6 h-6 rounded-md border-2 grid place-items-center text-white text-sm flex-none ${
                      row.open ? 'bg-teal-700 border-teal-700' : 'border-gray-300'
                    }`}
                  >
                    {row.open ? '✓' : ''}
                  </span>
                  <b>{s.name}</b>
                  {s.is_pengampu && <Pill tone="gray">pengampu</Pill>}
                  <span className="flex-1" />
                  {!row.open && (
                    <span className="text-gray-400 text-sm">tap untuk isi</span>
                  )}
                </div>

                {row.open && (
                  <div className="mt-3">
                    {dup && (
                      <div className="bg-orange-50 text-orange-800 rounded-lg px-2.5 py-2 text-sm mb-2">
                        Sudah ada catatan {s.name} tanggal ini — ini jadi catatan ke-2.
                      </div>
                    )}
                    <div className="flex gap-2.5 mb-1">
                      <input
                        inputMode="numeric"
                        placeholder="Hal."
                        className="w-20 rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-600"
                        value={row.page}
                        onChange={(e) => setField(s.id, 'page', e.target.value)}
                      />
                      <input
                        placeholder="Keterangan: ayat 1–10 / seperempat kedua…"
                        className="flex-1 rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-600"
                        value={row.page_detail}
                        onChange={(e) =>
                          setField(s.id, 'page_detail', e.target.value)
                        }
                      />
                    </div>
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="grid grid-cols-[52px_1fr] gap-2 items-center mt-2"
                      >
                        <div className="text-[13px] font-extrabold text-teal-700 leading-tight">
                          {it.code}
                          <span className="block font-normal text-gray-500 text-[10px] leading-tight">
                            {it.name}
                          </span>
                        </div>
                        <ScorePicker
                          value={row.scores[it.id] ?? null}
                          onChange={(v) => setScore(s.id, it.id, v)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-16 px-4 pb-2 pt-3 max-w-md mx-auto bg-gradient-to-t from-[#f3f5f3] via-[#f3f5f3] no-print">
        <BigButton disabled={busy || count === 0} onClick={submit}>
          {count === 0 ? 'Pilih santri dulu' : `Simpan ${count} catatan`}
        </BigButton>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  )
}

export { isTouched }
