import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '../me'
import { Header } from '../components/ui'

/** Generic daily assessment sheet — not tied to any pengampu (Spec 072). */
export function PrintForm() {
  const { me } = useMe()
  const nav = useNavigate()
  const items = useMemo(
    () => (me?.items ?? []).filter((i) => i.is_active),
    [me],
  )
  const [rows, setRows] = useState(20)
  const [days, setDays] = useState(1)
  const landscape = items.length > 12

  const sheet = (key: number) => (
    <div
      key={key}
      className="a4-sheet"
      style={{ pageBreakAfter: 'always', padding: '0 0 24px' }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>
        Lembar Penilaian Tahsin
      </h1>
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        Pengampu:{' '}
        <b style={{ display: 'inline-block', minWidth: 240, borderBottom: '1px solid #000' }} />
        <span style={{ marginLeft: 24 }}>
          Bulan:{' '}
          <b style={{ display: 'inline-block', minWidth: 140, borderBottom: '1px solid #000' }} />
        </span>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle(70)}>Tanggal</th>
            <th style={thStyle(landscape ? 140 : 180)}>Nama santri</th>
            <th style={thStyle(landscape ? 90 : 120)}>Halaman</th>
            {items.map((i) => (
              <th key={i.id} style={thStyle()}>
                {i.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td style={tdStyle} />
              <td style={tdStyle} />
              <td style={tdStyle} />
              {items.map((it) => (
                <td key={it.id} style={tdStyle} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px 20px',
        }}
      >
        <b style={{ gridColumn: '1/-1' }}>
          Keterangan kode (skor 0–5, kosong = tidak dinilai)
        </b>
        {items.map((i) => (
          <div key={i.id}>
            <b>{i.code}</b> = {i.name}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className="no-print">
        <Header title="Cetak lembar" back="/" />
        <div className="px-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-3.5">
            <p className="text-gray-500 text-sm mb-2">
              Lembar umum & bisa dipakai berulang — kolom <b>Tanggal</b> di dalam
              tabel, nama pengampu diisi tangan. Satu lembar menampung beberapa
              hari; cetak 1 lembar lalu fotokopi.
            </p>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Baris (isian)
                </div>
                <input
                  type="number"
                  className="w-full rounded-xl border border-gray-200 p-2.5"
                  value={rows}
                  min={1}
                  max={40}
                  onChange={(e) => setRows(Number(e.target.value) || 20)}
                />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Jumlah lembar
                </div>
                <select
                  className="w-full rounded-xl border border-gray-200 p-2.5 bg-white"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
            </div>
            <button
              className="w-full bg-teal-700 text-white font-bold rounded-2xl p-3.5 mt-3"
              onClick={() => window.print()}
            >
              ⎙ Cetak
            </button>
            {landscape && (
              <p className="text-orange-700 text-xs mt-2">
                {items.length} aspek — atur printer ke <b>Landscape</b> agar
                kolom muat.
              </p>
            )}
          </div>

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">
            Pratinjau
          </div>
          <div className="bg-gray-500 rounded-xl p-3 overflow-x-auto">
            <div className="bg-white p-6 mx-auto" style={{ width: 620 }}>
              {sheet(0)}
            </div>
          </div>
          <div className="text-center mt-4">
            <button className="text-teal-700 font-semibold text-sm" onClick={() => nav('/')}>
              ← Kembali
            </button>
          </div>
        </div>
      </div>

      {/* Actual print output */}
      <div className="print-area">
        {Array.from({ length: days }).map((_, i) => sheet(i))}
      </div>
    </div>
  )
}

function thStyle(width?: number): React.CSSProperties {
  return {
    border: '1px solid #000',
    background: '#eee',
    padding: '0 4px',
    height: 30,
    fontSize: 11,
    textAlign: 'center',
    width,
  }
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #000',
  height: 34,
  fontSize: 11,
  textAlign: 'center',
}
