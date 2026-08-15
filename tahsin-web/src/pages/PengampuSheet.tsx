import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useMe } from '../me'
import { getLoginCode, regenLoginCode, updateSantri } from '../api'
import type { LoginCode } from '../types'
import { BigButton, Header, Pill, Spinner, Toast } from '../components/ui'

export function PengampuSheet() {
  const { id } = useParams()
  const santriId = Number(id)
  const nav = useNavigate()
  const { me, refresh } = useMe()
  const santri = me?.santri.find((s) => s.id === santriId)
  const [code, setCode] = useState<LoginCode | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    getLoginCode(santriId)
      .then(setCode)
      .catch(() => setCode(null))
  }, [santriId])

  const students = (me?.santri ?? []).filter((s) => s.pengampu === santriId)

  const regen = async () => {
    const c = await regenLoginCode(santriId)
    setCode(c)
    setToast('Kode diganti — sesi lama keluar')
  }
  const deactivate = async () => {
    await updateSantri(santriId, { is_pengampu: false })
    await refresh()
    nav('/kelola')
  }

  if (!santri) return <Spinner />

  return (
    <div>
      <Header title={santri.name} back="/kelola" />
      <div className="px-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Kode login pengampu
          </div>
          {code ? (
            <>
              <div className="grid place-items-center mb-2">
                <QRCodeSVG value={code.url} size={160} level="M" />
              </div>
              <div className="font-mono text-2xl tracking-widest">{code.code}</div>
              <p className="text-gray-500 text-sm mt-1.5 mb-3">
                Scan dengan kamera HP → langsung masuk. Berlaku terus sampai diganti.
              </p>
              <div className="flex gap-2.5">
                <BigButton secondary onClick={() => nav(`/cetak/qr/${santriId}`)}>
                  ⎙ Cetak kartu
                </BigButton>
                <BigButton danger onClick={regen}>
                  Ganti kode
                </BigButton>
              </div>
            </>
          ) : (
            <Spinner label="Memuat kode…" />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-3.5 mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Santri yang diampu ({students.length})
          </div>
          {students.map((s) => (
            <div
              key={s.id}
              className="flex items-center py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1">{s.name}</div>
            </div>
          ))}
          {students.length === 0 && (
            <p className="text-gray-500 text-sm">
              Belum ada santri. Assign lewat tab Pengampu.
            </p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-3.5">
          <div className="flex items-center">
            <div>Status pengampu</div>
            <span className="flex-1" />
            <Pill>Aktif</Pill>
          </div>
          <p className="text-gray-500 text-xs mt-1">
            Nonaktifkan → kode & sesi mati, santrinya jadi "belum ada pengampu".
            Ia tetap tercatat sebagai santri.
          </p>
          <button
            className="text-red-600 font-semibold text-sm mt-2"
            onClick={deactivate}
          >
            Nonaktifkan pengampu
          </button>
        </div>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  )
}
