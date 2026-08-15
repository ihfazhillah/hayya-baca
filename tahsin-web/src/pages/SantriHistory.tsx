import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMe } from '../me'
import { listRecords } from '../api'
import type { TahsinRecord } from '../types'
import { BigButton, Header, Spinner } from '../components/ui'
import { scoreClass } from '../components/ScorePicker'
import { fmtShort, iso, parse, today } from '../period'

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}
const f1 = (v: number | null) => (v == null ? '–' : v.toFixed(1))

export function SantriHistory() {
  const { id } = useParams()
  const santriId = Number(id)
  const nav = useNavigate()
  const { me } = useMe()
  const items = useMemo(() => me?.items ?? [], [me])
  const santri = me?.santri.find((s) => s.id === santriId)
  const [recs, setRecs] = useState<TahsinRecord[] | null>(null)

  useEffect(() => {
    listRecords({ santri: santriId }).then((r) =>
      setRecs([...r].sort((a, b) => (a.date < b.date ? 1 : -1))),
    )
  }, [santriId])

  const weekAgo = useMemo(() => {
    const d = parse(today())
    d.setDate(d.getDate() - 7)
    return iso(d)
  }, [])

  const perItem = useMemo(() => {
    if (!recs) return []
    return items.map((it) => {
      const cur: number[] = []
      const prev: number[] = []
      for (const r of recs) {
        const s = r.scores.find((x) => x.item === it.id)
        if (!s) continue
        ;(r.date >= weekAgo ? cur : prev).push(s.value)
      }
      return { it, a: avg(cur), p: avg(prev) }
    })
  }, [recs, items, weekAgo])

  if (!recs) return <Spinner />

  return (
    <div>
      <Header title={santri?.name ?? 'Santri'} back="/" />
      <div className="px-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-3.5 mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Pekan ini vs pekan lalu
          </div>
          <div className="flex flex-wrap gap-1.5">
            {perItem.map((w) => (
              <div key={w.it.id} className="flex-1 min-w-[70px] text-center">
                <div className="text-teal-700 text-xs font-bold">{w.it.code}</div>
                <div className="text-xl font-extrabold tabular-nums">
                  {f1(w.a)}
                  {w.a != null && w.p != null && w.a > w.p + 0.25 && (
                    <span className="text-green-600 text-xs"> ▲</span>
                  )}
                  {w.a != null && w.p != null && w.a < w.p - 0.25 && (
                    <span className="text-red-600 text-xs"> ▼</span>
                  )}
                </div>
                <div className="text-gray-500 text-[11px]">lalu {f1(w.p)}</div>
              </div>
            ))}
          </div>
        </div>

        <BigButton secondary onClick={() => nav(`/santri/${santriId}/tambah`)}>
          + Tambah catatan {santri?.name}
        </BigButton>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">
          Semua catatan
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl px-3.5">
          {recs.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer"
              onClick={() => nav(`/rekam/${r.id}/edit?santri=${santriId}`)}
            >
              <div className="w-14">
                <b>{fmtShort(r.date)}</b>
              </div>
              <div className="flex-1">
                <div>
                  hal. {r.page ?? '–'}{' '}
                  <span className="text-gray-500 text-sm">{r.page_detail}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {items.map((it) => {
                    const s = r.scores.find((x) => x.item === it.id)
                    return (
                      <b
                        key={it.id}
                        className={`inline-block px-1.5 rounded text-[11px] font-bold ${scoreClass(s?.value ?? null)}`}
                      >
                        {it.code} {s?.value ?? '–'}
                      </b>
                    )
                  })}
                </div>
              </div>
              <span className="text-gray-300">›</span>
            </div>
          ))}
          {recs.length === 0 && (
            <p className="text-gray-500 text-sm py-4">Belum ada catatan.</p>
          )}
        </div>
      </div>
    </div>
  )
}
