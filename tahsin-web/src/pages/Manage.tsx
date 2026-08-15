import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '../me'
import {
  assignSantri,
  createItem,
  createSantri,
  deleteItem,
  seedItems,
  updateItem,
  updateSantri,
} from '../api'
import { Header, Pill } from '../components/ui'

type Tab = 'aspek' | 'santri' | 'pengampu'

export function Manage() {
  const { me, refresh } = useMe()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('aspek')

  const items = me?.items ?? []
  const santri = me?.santri ?? []
  const pengampuList = santri.filter((s) => s.is_pengampu)

  const [newItemName, setNewItemName] = useState('')
  const [newItemCode, setNewItemCode] = useState('')
  const [newSantri, setNewSantri] = useState('')

  const addItem = async () => {
    if (!newItemName.trim() || !newItemCode.trim()) return
    await createItem({ name: newItemName.trim(), code: newItemCode.trim() })
    setNewItemName('')
    setNewItemCode('')
    await refresh()
  }
  const toggleItem = async (id: number, active: boolean) => {
    if (active) await deleteItem(id)
    else await updateItem(id, { is_active: true })
    await refresh()
  }
  const addSantri = async () => {
    if (!newSantri.trim()) return
    await createSantri({ name: newSantri.trim() })
    setNewSantri('')
    await refresh()
  }
  const makePengampu = async (id: number, val: boolean) => {
    await updateSantri(id, { is_pengampu: val })
    await refresh()
  }
  const move = async (santriId: number, pengampuId: number | null) => {
    await assignSantri(santriId, pengampuId)
    await refresh()
  }

  return (
    <div>
      <Header title="Kelola" />
      <div className="px-4">
        <div className="flex bg-gray-200 p-1 rounded-xl mb-3">
          {(['aspek', 'santri', 'pengampu'] as const).map((t) => (
            <button
              key={t}
              className={`flex-1 rounded-lg py-2 font-semibold capitalize ${
                tab === t ? 'bg-white shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'aspek' && (
          <>
            {items.length === 0 && (
              <button
                className="w-full bg-teal-50 text-teal-700 font-bold rounded-2xl p-3 mb-3"
                onClick={() => seedItems().then(refresh)}
              >
                Pakai aspek default (ns/t, mt)
              </button>
            )}
            <div className="bg-white border border-gray-200 rounded-2xl px-3.5 mb-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-gray-300">⋮⋮</span>
                  <div className="flex-1">
                    <b>{it.name}</b> <Pill>{it.code}</Pill>
                  </div>
                  <button
                    className="text-teal-700 font-semibold text-sm"
                    onClick={() => toggleItem(it.id, it.is_active)}
                  >
                    {it.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-3.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Tambah aspek
              </div>
              <div className="flex gap-2.5">
                <input
                  className="flex-1 rounded-xl border border-gray-200 p-2.5"
                  placeholder="Nama, mis. Ghunnah"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
                <input
                  className="w-20 rounded-xl border border-gray-200 p-2.5"
                  placeholder="Kode"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                />
              </div>
              <button
                className="w-full bg-teal-50 text-teal-700 font-bold rounded-2xl p-3 mt-2.5"
                onClick={addItem}
              >
                Tambah
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Urutan di sini = urutan kolom di input & lembar cetak. Nonaktif =
              tidak muncul lagi, riwayat skor tetap ada.
            </p>
          </>
        )}

        {tab === 'santri' && (
          <>
            <div className="flex gap-2.5 mb-3">
              <input
                className="flex-1 rounded-xl border border-gray-200 p-3"
                placeholder="Nama santri baru"
                value={newSantri}
                onChange={(e) => setNewSantri(e.target.value)}
              />
              <button
                className="bg-teal-700 text-white font-bold rounded-2xl px-4"
                onClick={addSantri}
              >
                Tambah
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-3.5">
              {santri.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <b>{s.name}</b>
                    <div className="text-gray-500 text-sm">
                      {s.is_pengampu
                        ? `Pengampu · ${santri.filter((x) => x.pengampu === s.id).length} santri`
                        : s.pengampu
                          ? `Pengampu: ${santri.find((x) => x.id === s.pengampu)?.name ?? '—'}`
                          : 'Belum ada pengampu'}
                    </div>
                  </div>
                  {s.is_pengampu ? (
                    <button
                      className="text-teal-700 font-semibold text-sm"
                      onClick={() => nav(`/kelola/pengampu/${s.id}`)}
                    >
                      QR ›
                    </button>
                  ) : (
                    <button
                      className="text-teal-700 font-semibold text-sm"
                      onClick={() => makePengampu(s.id, true)}
                    >
                      Jadikan pengampu
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Jadikan pengampu → santri langsung dapat kode login + QR.
            </p>
          </>
        )}

        {tab === 'pengampu' && (
          <>
            {pengampuList.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-2xl p-3.5 mb-3"
              >
                <div className="flex items-center">
                  <b className="text-base flex-1">{p.name}</b>
                  <button
                    className="text-teal-700 font-semibold text-sm"
                    onClick={() => nav(`/kelola/pengampu/${p.id}`)}
                  >
                    QR & kode ›
                  </button>
                </div>
                {santri
                  .filter((s) => s.pengampu === p.id)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex-1">{s.name}</div>
                      <button
                        className="text-gray-500 font-semibold text-sm"
                        onClick={() => move(s.id, null)}
                      >
                        Lepas
                      </button>
                    </div>
                  ))}
              </div>
            ))}
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-3.5">
              <b>Belum ada pengampu</b>
              {santri
                .filter((s) => !s.is_pengampu && !s.pengampu)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1">{s.name}</div>
                    <select
                      className="rounded-lg border border-gray-200 p-1.5 text-sm"
                      defaultValue=""
                      onChange={(e) =>
                        e.target.value && move(s.id, Number(e.target.value))
                      }
                    >
                      <option value="">Tetapkan…</option>
                      {pengampuList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
