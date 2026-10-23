/** Editor tulisan: satu editor Quill 2 untuk semua tempat anak menulis
 *  (Rancangan Situs §Editor tulisan). Mode: draf_nol, stabilo, revisi, baca. */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import Quill, { Delta as QDelta, type Op } from 'quill'
import 'quill/dist/quill.core.css'
import './editor.css'
import type { Delta, Sorotan } from '../types'
import {
  PESAN_HAPUS, PESAN_TEMPEL, adaHapusan, bolehPotong, bolehTempel, hitungKata, inputMenghapus,
  inputTempel, kebijakan, opsPemulih, opsTanpaHapus, type Mode,
} from './modes'
import { geserSorotan, hapusRentang, tambahSorotan, teksPenghitung, type OpUbah } from './sorotan'
import { cssWarna, daftarkanStabilo, gambarSorotan, sisipanBerstabilo, tanpaStabilo, type WarnaAlat } from './stabilo'
import { warnaCss, warnaStabilo } from '../components/ui'

export interface AlatStabilo extends WarnaAlat {
  nama: string
  emoji: string
}

export interface DataEditor {
  isi: Delta
  teks: string
  sorotan: Sorotan[]
}

export interface EditorApi {
  ambil(): DataEditor
  aturSorotan(daftar: Sorotan[]): void
  fokus(): void
}

export interface EditorProps {
  mode: Mode
  /** isi awal (hanya dibaca saat dipasang; ganti `key` untuk memuat isi lain) */
  isi?: Delta | null
  teks?: string
  sorotan?: Sorotan[]
  /** tombol di bilah stabilo: hanya alat yang sudah dipelajari */
  alat?: AlatStabilo[]
  /** warna semua alat (untuk sorotan lama/sistem dari alat yang tidak ada di bilah) */
  warna?: WarnaAlat[]
  timerBerjalan?: boolean
  /** true = belum boleh mengetik (mis. Draf Nol sebelum Mulai) */
  nonaktif?: boolean
  label?: string
  /** teks samar saat editor kosong */
  placeholder?: string
  statusSimpan?: string
  /** kode status simpan (tersimpan, menyimpan, antre, kalah, galat) untuk warnanya */
  statusKode?: string
  onUbah?: (d: DataEditor) => void
  ref?: Ref<EditorApi>
}

interface Pilihan {
  index: number
  length: number
  /** atas dan bawah pilihan, relatif terhadap .editor-wadah */
  top: number
  bottom: number
  left: number
}

/** Jarak bilah stabilo dari pilihan. */
const JARAK_BILAH = 8

/** Teks polos tanpa baris baru penutup milik Quill. */
function teksDari(q: Quill): string {
  return q.getText().replace(/\n$/, '')
}

export default function Editor(props: EditorProps) {
  const { mode, alat = [], timerBerjalan = false, nonaktif = false, label = 'Tulisanmu', statusSimpan, statusKode } = props
  const wadah = useRef<HTMLDivElement>(null)
  const tempat = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const sorotanRef = useRef<Sorotan[]>(props.sorotan ?? [])
  const [sorotan, setSorotan] = useState<Sorotan[]>(sorotanRef.current)
  const [jumlahKata, setJumlahKata] = useState(0)
  const [pesan, setPesan] = useState<string | null>(null)
  const [pilihan, setPilihan] = useState<Pilihan | null>(null)
  const [formatBaris, setFormatBaris] = useState({ judul: false, dialog: false })
  const pilihanRef = useRef<Pilihan | null>(null)
  const salinan = useRef<string | null>(null)
  const seretInternal = useRef(false)
  const sudahPesanHapus = useRef(false)
  const gambarTunda = useRef(false)
  const riwayat = useRef<{ lalu: Sorotan[][]; maju: Sorotan[][] }>({ lalu: [], maju: [] })
  const awal = useRef({ isi: props.isi, teks: props.teks })
  const placeholderAwal = useRef(props.placeholder)
  const bilahRef = useRef<HTMLDivElement>(null)
  const [posBilah, setPosBilah] = useState<{ top: number; left: number } | null>(null)

  // nilai terbaru untuk handler Quill (dipasang sekali)
  const modeRef = useRef(mode)
  const timerRef = useRef(timerBerjalan)
  const onUbahRef = useRef(props.onUbah)
  modeRef.current = mode
  timerRef.current = timerBerjalan
  onUbahRef.current = props.onUbah

  const k = kebijakan(mode, timerBerjalan)

  const ambil = useCallback((): DataEditor => {
    const q = quillRef.current
    if (!q) return { isi: { ops: [] }, teks: '', sorotan: sorotanRef.current }
    return {
      isi: { ops: tanpaStabilo(q.getContents().ops as OpUbah[]) as Delta['ops'] },
      teks: teksDari(q),
      sorotan: sorotanRef.current,
    }
  }, [])

  const kabari = useCallback(() => {
    onUbahRef.current?.(ambil())
  }, [ambil])

  const tampilPesan = useCallback((p: string) => {
    setPesan(p)
  }, [])

  useEffect(() => {
    if (!pesan) return
    const t = setTimeout(() => setPesan(null), 4000)
    return () => clearTimeout(t)
  }, [pesan])

  const pesanHapus = useCallback(() => {
    if (sudahPesanHapus.current) return
    sudahPesanHapus.current = true
    tampilPesan(PESAN_HAPUS)
  }, [tampilPesan])

  const gambar = useCallback(() => {
    const q = quillRef.current
    if (!q) return
    if (q.composition.isComposing) {
      gambarTunda.current = true
      return
    }
    gambarSorotan(q, sorotanRef.current)
  }, [])

  const terapkan = useCallback(
    (daftar: Sorotan[], catatRiwayat = true) => {
      if (catatRiwayat) {
        riwayat.current.lalu.push(sorotanRef.current)
        riwayat.current.maju = []
      }
      sorotanRef.current = daftar
      setSorotan(daftar)
      gambar()
      kabari()
    },
    [gambar, kabari],
  )

  useImperativeHandle(
    props.ref,
    () => ({
      ambil,
      aturSorotan: (d: Sorotan[]) => terapkan(d, false),
      fokus: () => {
        const q = quillRef.current
        if (!q) return
        // Lanjut menulis di akhir naskah; tanpa ini kursor jatuh di awal teks.
        const r = q.getSelection()
        if (r) q.focus()
        else q.setSelection(Math.max(0, q.getLength() - 1), 0, 'user')
      },
    }),
    [ambil, terapkan],
  )

  const perbaruiPilihan = useCallback(() => {
    const q = quillRef.current
    if (!q || !wadah.current) return
    const r = q.getSelection()
    if (r) {
      const f = q.getFormat(r)
      setFormatBaris({ judul: !!f.header, dialog: !!f.blockquote })
    }
    if (!r || r.length === 0 || !kebijakan(modeRef.current).stabilo) {
      pilihanRef.current = null
      setPilihan(null)
      return
    }
    let top = 0
    let bottom = 0
    let left = 0
    try {
      const b = q.getBounds(r.index, r.length)
      const rw = wadah.current.getBoundingClientRect()
      const rc = q.container.getBoundingClientRect()
      if (b) {
        top = rc.top - rw.top + b.top
        bottom = rc.top - rw.top + b.top + b.height
        left = rc.left - rw.left + b.left + b.width / 2
      }
    } catch {
      /* jsdom / tata letak belum siap */
    }
    const p = { index: r.index, length: r.length, top, bottom, left }
    pilihanRef.current = p
    setPilihan(p)
  }, [])

  // Pasang Quill sekali.
  useEffect(() => {
    daftarkanStabilo()
    const host = tempat.current
    const luar = wadah.current
    if (!host || !luar) return
    const el = document.createElement('div')
    host.appendChild(el)

    const izinHapus = () => {
      if (kebijakan(modeRef.current, timerRef.current).hapus) return true
      pesanHapus()
      return false
    }
    const izinUrungkan = () => kebijakan(modeRef.current, timerRef.current).urungkan
    const semuaModifier = { altKey: null, ctrlKey: null, metaKey: null, shiftKey: null }

    const q = new Quill(el, {
      placeholder: placeholderAwal.current,
      formats: ['stabilo', 'sistem', 'header', 'blockquote'],
      modules: {
        history: { userOnly: true, delay: 800 },
        keyboard: {
          bindings: {
            jagaBackspace: { key: 'Backspace', ...semuaModifier, handler: izinHapus },
            jagaDelete: { key: 'Delete', ...semuaModifier, handler: izinHapus },
            jagaUrungkan: { key: 'z', shortKey: true, shiftKey: null, handler: izinUrungkan },
            jagaUlangi: { key: 'y', shortKey: true, handler: izinUrungkan },
          },
        },
      },
    })
    quillRef.current = q
    const root = q.root
    root.setAttribute('spellcheck', 'false')
    root.setAttribute('autocorrect', 'off')
    root.setAttribute('autocapitalize', 'off')
    root.setAttribute('autocomplete', 'off')
    root.setAttribute('aria-label', label)
    root.setAttribute('aria-multiline', 'true')
    root.setAttribute('role', 'textbox')

    const { isi, teks } = awal.current
    if (isi?.ops?.length) q.setContents(isi.ops as Op[], 'silent')
    else if (teks) q.setText(teks, 'silent')
    gambarSorotan(q, sorotanRef.current)
    q.history.clear()
    setJumlahKata(hitungKata(teksDari(q)))

    q.on('text-change', (delta: QDelta, lama: QDelta, source: string) => {
      if (source !== 'user') return
      let ops = delta.ops as OpUbah[]
      let pulihkan = false
      if (!kebijakan(modeRef.current, timerRef.current).hapus && adaHapusan(ops)) {
        const pemulih = opsPemulih(ops, (i, n) => lama.slice(i, i + n).ops as OpUbah[])
        q.updateContents(new QDelta(pemulih as Op[]), 'silent')
        ops = opsTanpaHapus(ops)
        pulihkan = true
        pesanHapus()
      }
      const lamaS = sorotanRef.current
      const baru = geserSorotan(lamaS, ops)
      sorotanRef.current = baru
      if (pulihkan || sisipanBerstabilo(ops) || baru.some((s, i) => s.diperbaiki !== lamaS[i]?.diperbaiki)) {
        setTimeout(gambar, 0)
      }
      setSorotan(baru)
      setJumlahKata(hitungKata(teksDari(q)))
      kabari()
      // mengetik menutup pilihan; Quill tidak selalu mengirim selection-change
      if (pilihanRef.current) setTimeout(perbaruiPilihan, 0)
    })
    q.on('selection-change', () => perbaruiPilihan())

    const sesudahPilih = () => setTimeout(perbaruiPilihan, 0)
    const akhirKomposisi = () => {
      if (gambarTunda.current) {
        gambarTunda.current = false
        setTimeout(gambar, 0)
      }
    }
    const sebelumInput = (e: Event) => {
      const ev = e as InputEvent
      const kb = kebijakan(modeRef.current, timerRef.current)
      if (!kb.hapus && inputMenghapus(ev.inputType)) {
        ev.preventDefault()
        pesanHapus()
      } else if (inputTempel(ev.inputType) && !seretInternal.current) {
        ev.preventDefault()
        tampilPesan(PESAN_TEMPEL)
      }
    }
    const salin = () => {
      const r = q.getSelection()
      if (r && r.length) salinan.current = q.getText(r.index, r.length)
    }
    const potong = (e: ClipboardEvent) => {
      if (!bolehPotong(modeRef.current, timerRef.current)) {
        e.preventDefault()
        e.stopPropagation()
        if (kebijakan(modeRef.current).ketik) pesanHapus()
        return
      }
      salin()
    }
    const tempel = (e: ClipboardEvent) => {
      const teksPapan = e.clipboardData?.getData('text/plain') ?? ''
      if (bolehTempel(modeRef.current, teksPapan, salinan.current)) return
      e.preventDefault()
      e.stopPropagation()
      if (kebijakan(modeRef.current).ketik) tampilPesan(PESAN_TEMPEL)
    }
    const mulaiSeret = () => {
      seretInternal.current = true
    }
    const akhirSeret = () => {
      seretInternal.current = false
    }
    const jatuhkan = (e: DragEvent) => {
      const kb = kebijakan(modeRef.current, timerRef.current)
      if (!seretInternal.current || !kb.ketik || !kb.hapus) {
        e.preventDefault()
        e.stopPropagation()
        if (kb.ketik) {
          if (seretInternal.current) pesanHapus()
          else tampilPesan(PESAN_TEMPEL)
        }
      }
      seretInternal.current = false
    }

    root.addEventListener('beforeinput', sebelumInput, true)
    root.addEventListener('compositionend', akhirKomposisi)
    root.addEventListener('mouseup', sesudahPilih)
    root.addEventListener('touchend', sesudahPilih)
    root.addEventListener('keyup', sesudahPilih)
    luar.addEventListener('copy', salin, true)
    luar.addEventListener('cut', potong, true)
    luar.addEventListener('paste', tempel, true)
    luar.addEventListener('dragstart', mulaiSeret, true)
    luar.addEventListener('dragend', akhirSeret, true)
    luar.addEventListener('drop', jatuhkan, true)

    return () => {
      root.removeEventListener('beforeinput', sebelumInput, true)
      root.removeEventListener('compositionend', akhirKomposisi)
      root.removeEventListener('mouseup', sesudahPilih)
      root.removeEventListener('touchend', sesudahPilih)
      root.removeEventListener('keyup', sesudahPilih)
      luar.removeEventListener('copy', salin, true)
      luar.removeEventListener('cut', potong, true)
      luar.removeEventListener('paste', tempel, true)
      luar.removeEventListener('dragstart', mulaiSeret, true)
      luar.removeEventListener('dragend', akhirSeret, true)
      luar.removeEventListener('drop', jatuhkan, true)
      quillRef.current = null
      el.remove()
    }
    // label dan isi awal hanya dibaca saat dipasang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mode dan kunci menulis.
  useEffect(() => {
    const q = quillRef.current
    if (!q) return
    const kb = kebijakan(mode, timerBerjalan)
    q.enable(kb.ketik && !nonaktif)
    if (!kb.stabilo) {
      pilihanRef.current = null
      setPilihan(null)
    }
  }, [mode, timerBerjalan, nonaktif])

  // Teks samar bisa berganti (mis. sebelum dan sesudah Mulai).
  useEffect(() => {
    const q = quillRef.current
    if (q && props.placeholder !== undefined) q.root.setAttribute('data-placeholder', props.placeholder)
  }, [props.placeholder])

  // Bilah stabilo: di atas pilihan; kalau tidak muat (baris pertama), di bawahnya.
  // Digeser supaya tidak keluar dari tepi editor (layar tablet sempit).
  useLayoutEffect(() => {
    if (!pilihan) {
      setPosBilah(null)
      return
    }
    const bilah = bilahRef.current
    const luar = wadah.current
    const lebarBilah = bilah?.offsetWidth ?? 0
    const tinggiBilah = bilah?.offsetHeight ?? 52
    const lebarWadah = luar?.clientWidth ?? 0
    let top = pilihan.top - tinggiBilah - JARAK_BILAH
    if (top < 0) top = pilihan.bottom + JARAK_BILAH
    let left = pilihan.left - lebarBilah / 2
    if (lebarWadah > 0) left = Math.min(Math.max(0, left), Math.max(0, lebarWadah - lebarBilah))
    setPosBilah({ top, left })
  }, [pilihan])

  // Timer Draf Nol selesai: riwayat dibersihkan supaya Urungkan tidak menghapus ketikan
  // yang tadi dijaga.
  const timerLalu = useRef(timerBerjalan)
  useEffect(() => {
    if (timerLalu.current && !timerBerjalan) quillRef.current?.history.clear()
    timerLalu.current = timerBerjalan
  }, [timerBerjalan])

  const bersihkanPilihan = () => {
    pilihanRef.current = null
    setPilihan(null)
    try {
      window.getSelection()?.removeAllRanges()
    } catch {
      /* abaikan */
    }
  }

  const pakaiAlat = (kode: string) => {
    const p = pilihanRef.current
    if (!p) return
    terapkan(tambahSorotan(sorotanRef.current, kode, p.index, p.length))
    bersihkanPilihan()
  }

  const hapusSorotan = () => {
    const p = pilihanRef.current
    if (!p) return
    terapkan(hapusRentang(sorotanRef.current, p.index, p.length))
    bersihkanPilihan()
  }

  const urungkan = () => {
    const q = quillRef.current
    if (!q || !k.urungkan) return
    if (mode === 'stabilo') {
      const lalu = riwayat.current.lalu.pop()
      if (!lalu) return
      riwayat.current.maju.push(sorotanRef.current)
      terapkan(lalu, false)
    } else q.history.undo()
  }

  const ulangi = () => {
    const q = quillRef.current
    if (!q || !k.urungkan) return
    if (mode === 'stabilo') {
      const maju = riwayat.current.maju.pop()
      if (!maju) return
      riwayat.current.lalu.push(sorotanRef.current)
      terapkan(maju, false)
    } else q.history.redo()
  }

  const formatBarisIni = (nama: 'header' | 'blockquote', nilai: number | boolean) => {
    const q = quillRef.current
    if (!q) return
    const r = q.getSelection(true)
    if (!r) return
    const f = q.getFormat(r)
    q.format(nama, f[nama] ? false : nilai, 'user')
    const g = q.getFormat(r)
    setFormatBaris({ judul: !!g.header, dialog: !!g.blockquote })
  }

  const warnaSemua = props.warna ?? alat
  const adaSorotan = sorotan.some((s) => s.length > 0 || s.diperbaiki)
  const tampilkanBilah = k.format || mode !== 'baca'
  const tampilkanPenghitung = adaSorotan && mode !== 'draf_nol'

  return (
    <div className={`editor-tulis mode-${mode}${nonaktif ? ' nonaktif' : ''}`} data-mode={mode}>
      {warnaSemua.length > 0 && <style>{cssWarna(warnaSemua)}</style>}
      <div className="editor-kartu">
        {(tampilkanBilah || tampilkanPenghitung) && (
          <div className="editor-atas">
            {tampilkanBilah && (
              <div className="editor-bilah" role="toolbar" aria-label="Alat menulis">
                {k.format && (
                  <>
                    <button type="button" aria-pressed={formatBaris.judul} onMouseDown={(e) => e.preventDefault()}
                      onClick={() => formatBarisIni('header', 2)}>Judul bab</button>
                    <button type="button" aria-pressed={formatBaris.dialog} onMouseDown={(e) => e.preventDefault()}
                      onClick={() => formatBarisIni('blockquote', true)}>Dialog</button>
                  </>
                )}
                <button type="button" className="editor-urung" aria-label="Urungkan" title="Urungkan"
                  disabled={!k.urungkan || nonaktif} onMouseDown={(e) => e.preventDefault()} onClick={urungkan}>↶</button>
                <button type="button" className="editor-urung" aria-label="Ulangi" title="Ulangi"
                  disabled={!k.urungkan || nonaktif} onMouseDown={(e) => e.preventDefault()} onClick={ulangi}>↷</button>
              </div>
            )}
            {tampilkanPenghitung && (
              <p className="editor-penghitung" aria-live="polite">{teksPenghitung(sorotan)}</p>
            )}
          </div>
        )}
        <div className="editor-wadah" ref={wadah}>
          <div ref={tempat} className="editor-quill" />
          {pilihan && k.stabilo && (
            <div ref={bilahRef} className="bilah-stabilo" role="toolbar" aria-label="Stabilo"
              style={{ top: posBilah?.top ?? Math.max(0, pilihan.top - 60), left: posBilah?.left ?? pilihan.left,
                visibility: posBilah ? 'visible' : 'hidden' }}
              onMouseDown={(e) => e.preventDefault()}>
              {alat.map((a) => (
                <button key={a.kode} type="button" style={{ background: warnaStabilo(a.warna, 40), borderColor: warnaCss(a.warna) }}
                  onClick={() => pakaiAlat(a.kode)} aria-label={`Stabilo ${a.nama}`} title={a.nama}>
                  <span aria-hidden="true">{a.emoji}</span>
                </button>
              ))}
              <button type="button" className="hapus-sorotan" onClick={hapusSorotan} aria-label="Hapus sorotan">hapus</button>
            </div>
          )}
        </div>
        <p className="editor-pesan" role="status" aria-live="polite">{pesan ?? ''}</p>
        <div className="editor-kaki">
          {adaSorotan ? (
            <p className="editor-legenda" aria-hidden="true">
              {sorotan.some((x) => x.sumber === 'anak') && <span><span className="contoh blok">blok</span> sorotanku</span>}
              {sorotan.some((x) => x.sumber === 'sistem') && <span><span className="contoh garis">garis</span> dari sistem</span>}
              {sorotan.some((x) => x.diperbaiki) && <span><span className="contoh pudar">pudar ✓</span> sudah diperbaiki</span>}
            </p>
          ) : <span />}
          <span className="editor-kaki-kanan">
            <span className="editor-kata" aria-label={`${jumlahKata} kata`}>{jumlahKata} kata</span>
            {statusSimpan && (
              <span className="editor-status" role="status" data-status={statusKode}>{statusSimpan}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
