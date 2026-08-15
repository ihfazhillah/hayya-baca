import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMe } from '../me'
import {
  ApiError,
  createRecord,
  deleteRecord,
  listRecords,
  updateRecord,
} from '../api'
import { today } from '../period'
import { BigButton, Header, Toast } from '../components/ui'
import { ScorePicker } from '../components/ScorePicker'

/** Add (santri/:id/tambah) or edit (rekam/:id/edit) one record. */
export function RecordForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { me } = useMe()
  const items = useMemo(() => me?.items ?? [], [me])

  const isEdit = window.location.pathname.includes('/rekam/')
  const recordId = isEdit ? Number(id) : null
  const [santriId, setSantriId] = useState<number | null>(
    isEdit ? null : Number(id),
  )
  const [date, setDate] = useState(today())
  const [page, setPage] = useState('')
  const [pageDetail, setPageDetail] = useState('')
  const [notes, setNotes] = useState('')
  const [scores, setScores] = useState<Record<number, number>>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit || recordId == null) return
    // Fetch the record via a bounded list (no detail GET needed).
    const backTo = params.get('santri')
    if (backTo) setSantriId(Number(backTo))
    listRecords(backTo ? { santri: Number(backTo) } : {}).then((recs) => {
      const r = recs.find((x) => x.id === recordId)
      if (!r) return
      setSantriId(r.santri)
      setDate(r.date)
      setPage(r.page == null ? '' : String(r.page))
      setPageDetail(r.page_detail)
      setNotes(r.notes)
      setScores(Object.fromEntries(r.scores.map((s) => [s.item, s.value])))
    })
  }, [isEdit, recordId, params])

  const santri = me?.santri.find((s) => s.id === santriId)
  const setScore = (itemId: number, v: number | null) => {
    setScores((prev) => {
      const next = { ...prev }
      if (v == null) delete next[itemId]
      else next[itemId] = v
      return next
    })
  }

  const save = async () => {
    if (santriId == null) return
    setBusy(true)
    const pageNum = page.trim() === '' ? null : Number(page)
    const body = {
      santri: santriId,
      date,
      page: pageNum !== null && Number.isFinite(pageNum) ? pageNum : null,
      page_detail: pageDetail.trim(),
      notes: notes.trim(),
      scores: Object.entries(scores).map(([item, value]) => ({
        item: Number(item),
        value,
      })),
    }
    try {
      if (isEdit && recordId != null) await updateRecord(recordId, body)
      else await createRecord(body)
      setToast('Tersimpan')
      setTimeout(() => nav(`/santri/${santriId}`), 700)
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : 'Gagal menyimpan')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (recordId == null) return
    setBusy(true)
    try {
      await deleteRecord(recordId)
      setToast('Catatan dihapus')
      setTimeout(() => nav(`/santri/${santriId}`), 700)
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : 'Gagal menghapus')
      setBusy(false)
    }
  }

  return (
    <div>
      <Header title={isEdit ? 'Edit catatan' : 'Catatan baru'} back={-1} />
      <div className="px-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-3.5">
          <div className="flex items-center gap-2">
            <b className="text-lg flex-1">{santri?.name ?? '…'}</b>
            <input
              type="date"
              className="rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-600"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2.5 mt-2.5">
            <input
              inputMode="numeric"
              placeholder="Hal."
              className="w-20 rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-600"
              value={page}
              onChange={(e) => setPage(e.target.value)}
            />
            <input
              placeholder="Keterangan"
              className="flex-1 rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-600"
              value={pageDetail}
              onChange={(e) => setPageDetail(e.target.value)}
            />
          </div>
          {santri?.is_pengampu && (
            <p className="text-gray-500 text-sm mt-1">
              Penilaian pengampu — halaman boleh dikosongkan.
            </p>
          )}
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
                value={scores[it.id] ?? null}
                onChange={(v) => setScore(it.id, v)}
              />
            </div>
          ))}
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">
            Catatan (opsional)
          </label>
          <input
            className="w-full rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-600"
            placeholder="mis. perlu ulang halaman ini"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <BigButton disabled={busy || santriId == null} onClick={save}>
            Simpan
          </BigButton>
        </div>
        {isEdit && (
          <div className="text-center mt-3">
            <button
              className="text-red-600 font-semibold text-sm"
              disabled={busy}
              onClick={remove}
            >
              Hapus catatan ini
            </button>
          </div>
        )}
      </div>
      {toast && <Toast message={toast} />}
    </div>
  )
}
