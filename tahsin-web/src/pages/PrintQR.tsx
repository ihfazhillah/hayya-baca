import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useMe } from '../me'
import { getLoginCode } from '../api'
import type { LoginCode } from '../types'
import { Header, Spinner } from '../components/ui'

export function PrintQR() {
  const { id } = useParams()
  const santriId = Number(id)
  const nav = useNavigate()
  const { me } = useMe()
  const santri = me?.santri.find((s) => s.id === santriId)
  const [code, setCode] = useState<LoginCode | null>(null)

  useEffect(() => {
    getLoginCode(santriId).then(setCode).catch(() => setCode(null))
  }, [santriId])

  if (!santri || !code) return <Spinner />

  const card = (
    <div
      style={{
        border: '1px dashed #999',
        width: 340,
        margin: '0 auto',
        padding: 22,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#555',
        }}
      >
        Kartu login pengampu
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>
        {santri.name}
      </div>
      <div style={{ display: 'grid', placeItems: 'center', margin: '8px 0' }}>
        <QRCodeSVG value={code.url} size={190} level="M" />
      </div>
      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '0.14em',
          margin: '8px 0',
        }}
      >
        {code.code}
      </div>
      <div style={{ fontSize: 12, color: '#444' }}>
        Scan QR dengan kamera HP, atau buka <b>tahsin.ihfazh.com</b> dan ketik
        kode di atas.
      </div>
    </div>
  )

  return (
    <div>
      <div className="no-print">
        <Header title="Cetak kartu QR" back={`/kelola/pengampu/${santriId}`} />
        <div className="px-4">
          <div className="bg-gray-500 rounded-xl p-4 mb-4">
            <div className="bg-white p-6">{card}</div>
          </div>
          <button
            className="w-full bg-teal-700 text-white font-bold rounded-2xl p-3.5"
            onClick={() => window.print()}
          >
            ⎙ Cetak
          </button>
          <div className="text-center mt-3">
            <button
              className="text-teal-700 font-semibold text-sm"
              onClick={() => nav(`/kelola/pengampu/${santriId}`)}
            >
              ← Kembali
            </button>
          </div>
        </div>
      </div>
      <div className="print-area" style={{ paddingTop: 40 }}>
        {card}
      </div>
    </div>
  )
}
