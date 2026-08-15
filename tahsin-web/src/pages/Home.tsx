import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '../me'
import { useAuth } from '../auth'
import { listRecords } from '../api'
import type { TahsinRecord } from '../types'
import { BigButton, Card, Header, Pill } from '../components/ui'
import { fmtShort, parse, today } from '../period'

export function Home() {
  const { me } = useMe()
  const { logout } = useAuth()
  const nav = useNavigate()
  const [last, setLast] = useState<Record<number, TahsinRecord>>({})

  useEffect(() => {
    // Last record per santri over the past ~2 months.
    const from = today()
    const d = parse(from)
    d.setMonth(d.getMonth() - 2)
    const fromStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    listRecords({ from: fromStr }).then((recs) => {
      const map: Record<number, TahsinRecord> = {}
      for (const r of recs) {
        const cur = map[r.santri]
        if (!cur || r.date > cur.date) map[r.santri] = r
      }
      setLast(map)
    })
  }, [])

  const santri = me?.santri ?? []
  const staleDays = 5
  const isStale = (dateStr: string) => {
    const diff = (Date.now() - parse(dateStr).getTime()) / 864e5
    return diff > staleDays
  }

  return (
    <div>
      <Header
        title={`Assalamu'alaikum, ${me?.display_name}`}
        right={
          <button className="text-teal-700 font-semibold text-sm" onClick={logout}>
            Keluar
          </button>
        }
      />
      <div className="px-4">
        <p className="text-gray-500 text-sm -mt-1 mb-3">
          Kamu mengampu <b>{santri.length} santri</b>
        </p>
        <BigButton onClick={() => nav('/input')}>✎ &nbsp;Input catatan</BigButton>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">
          Santri ampuanmu
        </div>
        <div className="flex flex-col gap-2.5">
          {santri.map((s) => {
            const r = last[s.id]
            return (
              <Card
                key={s.id}
                className="active:bg-gray-50 cursor-pointer"
                onClick={() => nav(`/santri/${s.id}`)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex-1">
                    <b>{s.name}</b>
                    <div className="text-gray-500 text-sm">
                      {r
                        ? `Terakhir ${fmtShort(r.date)}${r.page ? ' · hal. ' + r.page : ''}`
                        : 'Belum ada catatan'}
                    </div>
                  </div>
                  {r && isStale(r.date) && <Pill tone="warn">5 hari</Pill>}
                  <span className="text-gray-300">›</span>
                </div>
              </Card>
            )
          })}
          {santri.length === 0 && (
            <p className="text-gray-500 text-sm">
              Belum ada santri yang di-assign ke kamu.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
