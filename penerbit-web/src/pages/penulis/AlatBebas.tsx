/** Alat Bebas (spec 075 K4): tempel atau ketik paragraf apa saja, lalu pakai stabilo alat yang
 *  sudah dipelajari. Tanda sistem (kata kembar, kalimat panjang) bisa dinyalakan.
 *  Tidak dinilai dan tidak disimpan sebagai naskah; teks terakhir hanya diingat di tablet ini. */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAlat } from '../../api'
import { sorotanBebas } from '../../apiBuatSoal'
import type { Alat } from '../../types'
import { Galat, KepalaHalaman, Memuat } from '../../components/ui'
import Editor, { type AlatStabilo, type EditorApi } from '../../editor/Editor'
import { alatDipelajari } from '../../editor/naskah'
import { gantiSorotanSistem } from '../../editor/sorotan'
import '../../editor/editor.css'
import '../../styles/penulis-halaman.css'

const KUNCI_TEKS = 'penerbit.alat-bebas'
const BATAS_TEKS = 5000

/** Tanda sistem yang bisa dinyalakan, per alat yang memakainya (jejak.py). */
const SISTEM = [
  { alat: 'kembar', label: 'Tandai kata kembar (lebih dari 3 kali)' },
  { alat: 'gunting', label: 'Tandai kalimat panjang (lebih dari 20 kata)' },
]

function bacaTeks(): string {
  try {
    return localStorage.getItem(KUNCI_TEKS) ?? ''
  } catch {
    return ''
  }
}

function ingatTeks(teks: string) {
  try {
    if (teks) localStorage.setItem(KUNCI_TEKS, teks)
    else localStorage.removeItem(KUNCI_TEKS)
  } catch {
    /* penyimpanan tablet tidak tersedia: tidak apa-apa */
  }
}

function keStabilo(a: Alat): AlatStabilo {
  return { kode: a.kode, nama: a.nama, emoji: a.emoji, warna: a.warna }
}

export default function AlatBebas() {
  const [alat, setAlat] = useState<Alat[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [teks, setTeks] = useState(bacaTeks)
  const [dipakai, setDipakai] = useState<string | null>(null)
  const [nomorEditor, setNomorEditor] = useState(0)
  const [sistem, setSistem] = useState<string[]>([])
  const editor = useRef<EditorApi>(null)

  useEffect(() => {
    getAlat().then((r) => setAlat(r.alat)).catch((e: Error) => setGalat(e.message))
  }, [])

  const dipelajari = alat ? alatDipelajari(alat) : []
  const kodeDipelajari = dipelajari.map((a) => a.kode)
  const pilihanSistem = SISTEM.filter((s) => kodeDipelajari.includes(s.alat))

  function ubahTeks(t: string) {
    setTeks(t)
    ingatTeks(t)
  }

  function pakaiStabilo() {
    setGalat(null)
    setSistem([])
    setDipakai(teks)
    setNomorEditor((n) => n + 1)
  }

  async function aturSistem(kode: string, nyala: boolean) {
    if (dipakai === null) return
    const aktif = nyala ? [...sistem, kode] : sistem.filter((k) => k !== kode)
    setSistem(aktif)
    setGalat(null)
    try {
      const tanda = aktif.length ? await sorotanBebas(dipakai, aktif) : []
      const api = editor.current
      if (api) api.aturSorotan(gantiSorotanSistem(api.ambil().sorotan, tanda))
    } catch (e) {
      setGalat((e as Error).message)
    }
  }

  return (
    <main className="page ph-halaman">
      <Link className="kembali" to="/alat">← Kotak Alat Editor</Link>
      <KepalaHalaman judul="Alat Bebas"
        sub="Tempel atau ketik paragraf apa saja: dari bukumu, ceritamu, atau tulisan teman. Lalu periksa dengan stabilo alatmu." />
      <Galat pesan={galat} />
      {!alat && !galat && <Memuat />}
      {alat && dipelajari.length === 0 && (
        <p>Alat Bebas terbuka setelah kamu belajar alat pertamamu. <Link to="/">Mulai dari Beranda</Link>.</p>
      )}
      {alat && dipelajari.length > 0 && (
        <>
          <p className="kecil">Tidak dinilai dan tidak disimpan. Teksmu hanya diingat di tablet ini.</p>
          {dipakai === null ? (
            <section className="tumpuk">
              <label className="tumpuk">
                <span>Tempel atau ketik paragrafmu</span>
                <textarea rows={8} maxLength={BATAS_TEKS} value={teks} onChange={(e) => ubahTeks(e.target.value)} />
              </label>
              <div className="baris">
                <button type="button" className="btn-besar" disabled={!teks.trim()} onClick={pakaiStabilo}>Pakai stabilo</button>
              </div>
            </section>
          ) : (
            <section className="tumpuk">
              <p className="kecil">Pilih beberapa kata, lalu ketuk alat yang cocok di bilah stabilo.</p>
              {pilihanSistem.length > 0 && (
                <div className="baris" role="group" aria-label="Tanda dari sistem">
                  {pilihanSistem.map((s) => (
                    <label key={s.alat} className="kecil">
                      <input type="checkbox" checked={sistem.includes(s.alat)}
                        onChange={(e) => void aturSistem(s.alat, e.target.checked)} />
                      {' '}{s.label}
                    </label>
                  ))}
                </div>
              )}
              <Editor key={nomorEditor} ref={editor} mode="stabilo" teks={dipakai} sorotan={[]}
                alat={dipelajari.map(keStabilo)} warna={alat} label="Paragraf untuk distabilo" />
              <div className="baris">
                <button type="button" className="btn btn-ghost" onClick={() => setDipakai(null)}>Ganti teks</button>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
