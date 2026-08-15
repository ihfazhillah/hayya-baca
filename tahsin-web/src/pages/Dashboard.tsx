import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '../me'
import { useAuth } from '../auth'
import { getSummary, seedItems } from '../api'
import type { Summary } from '../types'
import { Header, Spinner } from '../components/ui'
import { label, shift, today, weekStart } from '../period'

const f1 = (v: number | null) => (v == null ? '–' : v.toFixed(1))
function heatBg(v: number | null): string {
  if (v == null) return 'bg-gray-100 text-gray-400'
  const r = Math.round(v)
  return (
    ['bg-red-700', 'bg-red-600', 'bg-orange-500', 'bg-yellow-500', 'bg-green-600', 'bg-green-700'][r] +
    ' text-white'
  )
}
function barColor(v: number | null): string {
  if (v == null) return 'bg-gray-300'
  return v < 3 ? 'bg-red-600' : v < 4 ? 'bg-yellow-500' : 'bg-green-600'
}

export function Dashboard() {
  const { me, refresh } = useMe()
  const { logout } = useAuth()
  const nav = useNavigate()
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [start, setStart] = useState(() => weekStart(today()))
  const [pengampu, setPengampu] = useState<number | ''>('')
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getSummary({
      period,
      start,
      pengampu: pengampu === '' ? undefined : pengampu,
    })
      .then(setData)
      .finally(() => setLoading(false))
  }, [period, start, pengampu])

  const pengampuList = useMemo(
    () => (me?.santri ?? []).filter((s) => s.is_pengampu),
    [me],
  )
  const noItems = (me?.items ?? []).length === 0

  const move = (dir: number) => setStart(shift(period, start, dir))
  const switchPeriod = (p: 'week' | 'month') => {
    setPeriod(p)
    setStart(p === 'week' ? weekStart(today()) : today())
  }

  const ranked = useMemo(
    () =>
      (data?.items ?? [])
        .filter((i) => i.avg != null)
        .sort((a, b) => (a.avg! - b.avg!)),
    [data],
  )
  const low = ranked[0]
  const high = ranked[ranked.length - 1]

  // Group santri by pengampu for the heatmap.
  const groups = useMemo(() => {
    const items = data?.santri ?? []
    const byId: Record<string, typeof items> = {}
    const pengampuSelf: typeof items = []
    for (const s of items) {
      if (s.is_pengampu) {
        pengampuSelf.push(s)
        continue
      }
      const key = s.pengampu_id == null ? 'none' : String(s.pengampu_id)
      ;(byId[key] ??= []).push(s)
    }
    const out: { label: string; rows: typeof items }[] = []
    for (const p of pengampuList) {
      if (byId[String(p.id)]?.length)
        out.push({ label: `Pengampu: ${p.name}`, rows: byId[String(p.id)] })
    }
    if (byId['none']?.length)
      out.push({ label: 'Belum ada pengampu', rows: byId['none'] })
    if (pengampuSelf.length)
      out.push({ label: 'Pengampu (dinilai ustadz)', rows: pengampuSelf })
    return out
  }, [data, pengampuList])

  if (noItems)
    return (
      <div>
        <Header title="Dashboard" />
        <div className="px-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center">
            <p className="text-gray-600 mb-3">
              Belum ada aspek penilaian. Mulai dengan aspek default.
            </p>
            <button
              className="bg-teal-700 text-white font-bold rounded-2xl px-4 py-3"
              onClick={() => seedItems().then(refresh)}
            >
              Pakai aspek default (ns/t, mt)
            </button>
          </div>
        </div>
      </div>
    )

  const items = data?.items ?? []

  return (
    <div>
      <Header
        title="Dashboard"
        right={
          <button className="text-teal-700 font-semibold text-sm" onClick={logout}>
            Keluar
          </button>
        }
      />
      <div className="px-4">
        {/* PeriodNav */}
        <div className="flex bg-gray-200 p-1 rounded-xl mb-2">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              className={`flex-1 rounded-lg py-2 font-semibold ${
                period === p ? 'bg-white shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => switchPeriod(p)}
            >
              {p === 'week' ? 'Pekan' : 'Bulan'}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mb-2">
          <button className="text-2xl text-teal-700 px-2" onClick={() => move(-1)}>
            ‹
          </button>
          <b>{label(period, start)}</b>
          <button className="text-2xl text-teal-700 px-2" onClick={() => move(1)}>
            ›
          </button>
        </div>
        <select
          className="w-full rounded-xl border border-gray-200 p-3 mb-3 bg-white"
          value={pengampu}
          onChange={(e) =>
            setPengampu(e.target.value === '' ? '' : Number(e.target.value))
          }
        >
          <option value="">Semua pengampu</option>
          {pengampuList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {loading || !data ? (
          <Spinner />
        ) : (
          <>
            {/* Attention / good */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white border border-orange-200 rounded-2xl p-3">
                <div className="text-gray-500 text-xs">⚠ Perlu perhatian</div>
                <div className="text-2xl font-extrabold text-red-700 tabular-nums">
                  {low ? `${low.code} ${f1(low.avg)}` : '–'}
                </div>
                <div className="text-gray-500 text-xs">
                  {low ? `${low.name} · ${low.count} nilai` : 'Belum ada data'}
                </div>
              </div>
              <div className="bg-white border border-green-200 rounded-2xl p-3">
                <div className="text-gray-500 text-xs">✓ Sudah bagus</div>
                <div className="text-2xl font-extrabold text-green-700 tabular-nums">
                  {high ? `${high.code} ${f1(high.avg)}` : '–'}
                </div>
                <div className="text-gray-500 text-xs">
                  {high ? `${high.name} · ${high.count} nilai` : ''}
                </div>
              </div>
            </div>

            {/* Bars per item */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3.5 mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Rata-rata per aspek
              </div>
              {items.map((x) => (
                <div key={x.id} className="flex items-center gap-2 my-1.5">
                  <div className="w-11 text-teal-700 text-xs font-bold">{x.code}</div>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor(x.avg)}`}
                      style={{ width: `${((x.avg ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                  <div className="w-16 text-right tabular-nums text-sm">
                    <b>{f1(x.avg)}</b>{' '}
                    <span className="text-gray-400 text-[11px]">
                      {x.prev_avg != null &&
                        x.avg != null &&
                        (x.avg > x.prev_avg + 0.25
                          ? '▲'
                          : x.avg < x.prev_avg - 0.25
                            ? '▼'
                            : '=')}{' '}
                      {f1(x.prev_avg)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Heatmap */}
            <div className="bg-white border border-gray-200 rounded-2xl p-2 overflow-x-auto">
              <table className="border-collapse w-full text-[13px] tabular-nums">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white text-left text-[11px] text-gray-500 font-bold px-1.5 py-1.5">
                      Santri
                    </th>
                    <th className="text-[11px] text-gray-500 font-bold px-1">Sesi</th>
                    <th className="text-[11px] text-gray-500 font-bold px-1">Hal.</th>
                    {items.map((i) => (
                      <th key={i.id} className="text-[11px] text-gray-500 font-bold px-1">
                        {i.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.label}>
                      <tr>
                        <td
                          colSpan={3 + items.length}
                          className="text-left text-[11px] text-gray-500 font-bold pt-2.5 uppercase tracking-wide"
                        >
                          {g.label}
                        </td>
                      </tr>
                      {g.rows.map((s) => (
                        <tr key={s.id}>
                          <td
                            className="sticky left-0 bg-white text-left px-1.5 cursor-pointer"
                            onClick={() => nav(`/santri/${s.id}`)}
                          >
                            <b>{s.name}</b>
                          </td>
                          <td className="text-center px-1">{s.sessions}</td>
                          <td className="text-center px-1">{s.last_page ?? '–'}</td>
                          {items.map((it) => {
                            const v = s.scores[it.id] ?? null
                            const prev = data.items.find((x) => x.id === it.id)?.prev_avg
                            const arrow =
                              v != null && prev != null
                                ? v > prev + 0.25
                                  ? ' ▲'
                                  : v < prev - 0.25
                                    ? ' ▼'
                                    : ''
                                : ''
                            return (
                              <td key={it.id} className="text-center p-1">
                                <span
                                  className={`inline-block min-w-[34px] py-1 rounded-lg font-bold ${heatBg(v)}`}
                                >
                                  {f1(v)}
                                  {arrow}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {groups.length === 0 && (
                    <tr>
                      <td
                        colSpan={3 + items.length}
                        className="text-center text-gray-500 py-4"
                      >
                        Belum ada catatan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="text-gray-500 text-[11px] px-1.5 pt-1.5">
                ▲▼ = beda ≥ 0,25 vs periode sebelumnya. Tap nama untuk detail.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
