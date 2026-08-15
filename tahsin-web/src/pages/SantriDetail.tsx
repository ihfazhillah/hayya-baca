import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMe } from '../me'
import { listRecords } from '../api'
import type { TahsinRecord } from '../types'
import { Header, Pill, Spinner } from '../components/ui'
import { scoreClass } from '../components/ScorePicker'
import { fmtShort, iso, parse, today, weekStart } from '../period'

const COLORS = ['#0f766e', '#b45309', '#6d28d9', '#be185d', '#0369a1', '#a16207']

/** Group records into weekly averages per item → polyline series. */
function weeklySeries(recs: TahsinRecord[], itemId: number) {
  const buckets: Record<string, number[]> = {}
  for (const r of recs) {
    const s = r.scores.find((x) => x.item === itemId)
    if (!s) continue
    const wk = weekStart(r.date)
    ;(buckets[wk] ??= []).push(s.value)
  }
  return Object.keys(buckets)
    .sort()
    .map((wk) => ({
      wk,
      avg: buckets[wk].reduce((a, b) => a + b, 0) / buckets[wk].length,
    }))
}

export function SantriDetail() {
  const { id } = useParams()
  const santriId = Number(id)
  const nav = useNavigate()
  const { me } = useMe()
  const items = useMemo(() => me?.items ?? [], [me])
  const santri = me?.santri.find((s) => s.id === santriId)
  const [recs, setRecs] = useState<TahsinRecord[] | null>(null)
  const [hidden, setHidden] = useState<Set<number>>(new Set())

  const from = useMemo(() => {
    const d = parse(today())
    d.setMonth(d.getMonth() - 3)
    return iso(d)
  }, [])

  useEffect(() => {
    listRecords({ santri: santriId, from }).then((r) =>
      setRecs([...r].sort((a, b) => (a.date < b.date ? -1 : 1))),
    )
  }, [santriId, from])

  if (!recs) return <Spinner />

  const W = 330
  const H = 150
  const allWeeks = Array.from(
    new Set(recs.map((r) => weekStart(r.date))),
  ).sort()
  const x = (wk: string) =>
    allWeeks.length <= 1
      ? W / 2
      : 22 + (allWeeks.indexOf(wk) * (W - 32)) / (allWeeks.length - 1)
  const y = (v: number) => H - 14 - (v * (H - 26)) / 5

  const pengampuName = santri?.is_pengampu
    ? null
    : me?.santri.find((s) => s.id === santri?.pengampu)?.name

  return (
    <div>
      <Header title={santri?.name ?? 'Santri'} back="/" />
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <Pill tone="gray">
            {santri?.is_pengampu
              ? 'Pengampu'
              : `Pengampu: ${pengampuName ?? '—'}`}
          </Pill>
          <span className="flex-1" />
          <span className="text-gray-500 text-sm">3 bulan terakhir</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-2.5 mb-3">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
            {[0, 1, 2, 3, 4, 5].map((v) => (
              <g key={v}>
                <line x1="22" x2={W} y1={y(v)} y2={y(v)} stroke="#eceff0" />
                <text x="2" y={y(v) + 4} fontSize="9" fill="#98a6a1">
                  {v}
                </text>
              </g>
            ))}
            {items.map((it, i) => {
              if (hidden.has(it.id)) return null
              const series = weeklySeries(recs, it.id)
              if (series.length === 0) return null
              const pts = series.map((p) => `${x(p.wk)},${y(p.avg)}`).join(' ')
              const lastPt = series[series.length - 1]
              return (
                <g key={it.id}>
                  <polyline
                    fill="none"
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth="2"
                    points={pts}
                  />
                  <circle
                    cx={x(lastPt.wk)}
                    cy={y(lastPt.avg)}
                    r="3.5"
                    fill={COLORS[i % COLORS.length]}
                  />
                </g>
              )
            })}
          </svg>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs mt-1.5">
            {items.map((it, i) => {
              const off = hidden.has(it.id)
              return (
                <button
                  key={it.id}
                  className={off ? 'opacity-40' : ''}
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev)
                      next.has(it.id) ? next.delete(it.id) : next.add(it.id)
                      return next
                    })
                  }
                >
                  <i
                    className="inline-block w-3.5 h-[3px] rounded mr-1 align-middle"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {it.code}
                </button>
              )
            })}
          </div>
          <div className="text-gray-500 text-[11px]">
            Rata-rata per pekan · tap kode untuk sembunyikan/tampilkan.
          </div>
        </div>

        <div className="flex items-center mb-1.5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">
            Catatan
          </div>
          <button
            className="text-teal-700 font-semibold text-sm"
            onClick={() => nav(`/santri/${santriId}/tambah`)}
          >
            + Tambah
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl px-3.5">
          {[...recs].reverse().map((r) => (
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
              {r.created_by_name && (
                <span className="text-gray-400 text-[11px]">
                  {r.created_by_name}
                </span>
              )}
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
