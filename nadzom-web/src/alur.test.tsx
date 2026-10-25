/** Alur utama pengguna: dari peta ke pelajaran, peragaan Hudhud sampai giliran, latihan, dan alat timbang. */
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { MODUL } from './content'
import { kitabahBait } from './lib/kitabah'
import { aturSelesai, kodePelajaran } from './lib/progres'
import { timbangBait } from './lib/timbang'
import { BAHR } from './lib/bahr'
import Susun from './components/Susun'
import Irama from './components/Irama'
import CariPincang from './components/CariPincang'
import TandaiDrill from './components/TandaiDrill'
import Kenali from './components/Kenali'
import Cetakan from './components/Cetakan'
import Laci from './components/Laci'
import Panen from './components/Panen'
import { Jilid } from './components/Jilid'
import { bacaLaci, imporMarkdown, keMarkdown } from './lib/laciSaya'

function buka(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

describe('peta', () => {
  it('mulai dari Modul 0; setiap modul yang sudah ada bisa dibuka, Boss tampil dengan namanya', () => {
    buka('/')
    expect(screen.getByRole('link', { name: /Mulai Modul 0/ })).toHaveAttribute('href', '/modul/0/1')
    expect(screen.getByRole('link', { name: /Modul 0: Peluru Pertama/ })).toBeInTheDocument()
    for (const m of MODUL) expect(document.querySelector(`a[href="/modul/${m.nomor}"]`), `Modul ${m.nomor}`).not.toBeNull()
    expect(screen.getByRole('link', { name: /Boss 1Nasihat/ })).toHaveAttribute('href', '/modul/11')
  })

  it('Lanjutkan menunjuk pelajaran pertama yang belum selesai, mengikuti urutan peta', () => {
    for (const p of MODUL[0].pelajaran) aturSelesai(kodePelajaran(0, p.nomor, p.versi), true)
    buka('/')
    expect(screen.getByRole('link', { name: /Lanjutkan: Modul 1, pelajaran 1/ })).toHaveAttribute('href', '/modul/1/1')
  })

  it('pindah halaman lewat tautan langsung tampil tanpa muat ulang', async () => {
    const user = userEvent.setup()
    buka('/')
    await user.click(screen.getByRole('link', { name: /Modul 0: Peluru Pertama/ }))
    await user.click(screen.getByRole('link', { name: /Pelajaran 1/ }))
    expect(screen.getByRole('heading', { level: 1, name: MODUL[0].pelajaran[0].judul })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Rujukan' }))
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

describe('pelajaran 1: peragaan lalu giliran', () => {
  it('Lanjut sampai giliran, menandai syathr kedua dengan benar, lalu patokan dicentang', async () => {
    const user = userEvent.setup()
    buka('/modul/0/1')
    expect(screen.getByRole('heading', { level: 1, name: 'Menimbang satu bait' })).toBeInTheDocument()
    const bahts = screen.getByRole('region', { name: 'Pembahasan' })
    const langkah = MODUL[0].pelajaran[0].bahts.langkah.length
    for (let i = 0; i < langkah - 1; i++) await user.click(within(bahts).getByRole('button', { name: 'Lanjut' }))
    await user.click(within(bahts).getByRole('button', { name: 'Giliran saya' }))
    expect(within(bahts).getByText('Giliran Anda')).toBeInTheDocument()

    const k = kitabahBait(MODUL[0].pelajaran[0].bahts.bait)
    if (!k.ok) throw new Error()
    const target = k.syathr[1]
    const kotak = within(bahts).getAllByRole('button', { name: /^Huruf / })
    expect(kotak).toHaveLength(target.length)
    // Ketuk sekali = 1, dua kali = 0.
    for (let i = 0; i < kotak.length; i++) {
      await user.click(kotak[i])
      if (target[i].bit === 0) await user.click(kotak[i])
    }
    await user.click(within(bahts).getByRole('button', { name: 'Periksa' }))
    expect(within(bahts).getByText(`Semua ${target.length} huruf benar.`)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Patokan tercapai/ }))
    expect(localStorage.getItem('nadzom.selesai.v1')).toContain('0-1')
  })

  it('langkah bahr: kunci dilagukan لا لا نعم, dan nagham dari ahlinya bisa diputar', async () => {
    const user = userEvent.setup()
    buka('/modul/0/1')
    const bahts = screen.getByRole('region', { name: 'Pembahasan' })
    const ke = MODUL[0].pelajaran[0].bahts.langkah.findIndex((l) => l.tampil === 'bahr')
    for (let i = 0; i < ke; i++) await user.click(within(bahts).getByRole('button', { name: 'Lanjut' }))
    expect(within(bahts).getByText('لا لا نعم لا لا نعم لا لا نعم')).toBeInTheDocument()
    const video = within(bahts).getByTitle(/Lisan Mubin/)
    expect(video.getAttribute('src')).toContain('youtube-nocookie.com/embed/b3dA6ihqHjM')
  })

  it('pilihan ganda: salah boleh dicoba lagi, benar membuka alasannya', async () => {
    const user = userEvent.setup()
    buka('/modul/0/1')
    const latihan = screen.getByRole('region', { name: 'Latihan' })
    await user.click(within(latihan).getByRole('button', { name: /1011010/ }))
    expect(within(latihan).getByText('Belum tepat. Coba pilihan lain.')).toBeInTheDocument()
    await user.click(within(latihan).getByRole('button', { name: '1010110' }))
    expect(latihan.querySelector('.pesan.ok')?.textContent).toContain('مُسْ = 10, تَفْ = 10')
  })
})

describe('pelajaran 2: cetakan', () => {
  it('baris dengan kata sendiri ditimbang langsung dan bisa disimpan bila lurus', async () => {
    const user = userEvent.setup()
    buka('/modul/0/2')
    const latihan = screen.getByRole('region', { name: 'Latihan' })
    await user.type(within(latihan).getByLabelText('Kotak 1'), 'عِلْمِ')
    await user.type(within(latihan).getByLabelText('Kotak 2'), 'نُورٌ')
    expect(within(latihan).getByText('Lurus, 0 patah. Simpan baris ini.')).toBeInTheDocument()
    await user.click(within(latihan).getByRole('button', { name: 'Simpan baris' }))
    expect(within(latihan).getByText('1 dari 3 baris')).toBeInTheDocument()
  })
})

describe("pelajaran 3: mu'aradhah rajaz Khandaq menggantikan susun bebas", () => {
  it('pola tampil berlagu; mulai dari pola, yang belum diganti ditolak, ganti satu kata lalu timbang, ujung lain ditandai', async () => {
    const user = userEvent.setup()
    buka('/modul/0/3')
    const latihan = screen.getByRole('region', { name: 'Latihan' })
    const pola = within(latihan).getByRole('region', { name: "Pola mu'aradhah" })
    expect(within(pola).getByText('نَحْنُ الَّذِينَ بَايَعُوا مُحَمَّدَا')).toBeInTheDocument()
    expect(within(pola).getAllByText('لَ لا نعم').length).toBeGreaterThan(0)

    const isian = within(latihan).getByLabelText(/Bait Anda/) as HTMLTextAreaElement
    const susun = within(isian.closest('.tumpuk') as HTMLElement)
    await user.click(susun.getByRole('button', { name: 'Mulai dari pola' }))
    expect(isian.value).toBe('نَحْنُ الَّذِينَ بَايَعُوا مُحَمَّدَا\nعَلَى الْجِهَادِ مَا بَقِينَا أَبَدَا')
    await user.click(susun.getByRole('button', { name: 'Timbang' }))
    expect(susun.getByText(/Masih sama dengan pola/)).toBeInTheDocument()

    await user.clear(isian)
    await user.type(isian, 'نَحْنُ الَّذِينَ عَاهَدُوا مُحَمَّدَا\nعَلَى الْجِهَادِ مَا بَقِينَا أَبَدَا')
    await user.click(susun.getByRole('button', { name: 'Timbang' }))
    expect(susun.getByText('patah 0')).toBeInTheDocument()
    expect(susun.queryByText(/Ujung syathr/)).toBeNull()

    await user.clear(isian)
    await user.type(isian, 'بَدَأْتُ نَظْمِي حَامِدًا لِلْأَوَّلِ\nمُصَلِّيًا عَلَى النَّبِيِّ الْمُرْسَلِ')
    await user.click(susun.getByRole('button', { name: 'Timbang' }))
    expect(susun.getByText(/Ujung syathr 1: rawiy ل berbeda dari د/)).toBeInTheDocument()
  })
})

describe('alat timbang', () => {
  it('contoh bawaan langsung tertimbang: rajaz, 0 patah', () => {
    buka('/timbang')
    const hasil = screen.getByRole('region', { name: 'Hasil' })
    expect(within(hasil).getByText('Rajaz')).toBeInTheDocument()
    expect(within(hasil).getByText('Patah: 0')).toBeInTheDocument()
  })

  it('kata tanpa harakat ditolak dengan nama katanya', async () => {
    const user = userEvent.setup()
    buka('/timbang')
    const teks = screen.getByLabelText('Bait')
    await user.clear(teks)
    await user.type(teks, 'دار لِسَلْمَى')
    await user.click(screen.getByRole('button', { name: 'Timbang' }))
    expect(screen.getByText(/Beri harakat pada kata «دار»/)).toBeInTheDocument()
  })
})

describe('susun banyak bait (Muzdawij, Boss)', () => {
  const t = { jenis: 'susun' as const, petunjuk: 'Susun dua bait.', bahr: 'rajaz' as const, makna: 'Bebas.', bankKata: true, jumlah: 2, qafiyah: 'muzdawij' as const }

  it('setiap bait ditimbang dan dicek qafiyahnya; laci bisa dibuka', async () => {
    const user = userEvent.setup()
    render(<Susun t={t} />)
    const isian = screen.getByLabelText(/Bait-bait Anda/)
    await user.type(isian, 'قَالَ مُحَمَّدٌ هُوَ ابْنُ مَالِكِ | أَحْمَدُ رَبِّي اللَّهَ خَيْرَ مَالِكِ\nوَأَسْتَعِينُ اللَّهَ فِي أَلْفِيَّهْ | قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ')
    await user.click(screen.getByRole('button', { name: 'Timbang' }))
    expect(screen.getByText('2 dari 2 bait')).toBeInTheDocument()
    expect(screen.getByText('qafiyah pas')).toBeInTheDocument()
    expect(screen.getByText('ujung lain')).toBeInTheDocument()
    expect(screen.getByText(/Bait 2: Dua syathr tidak berpasangan/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Buka laci kata' }))
    expect(screen.getByRole('button', { name: /Laci qafiyah/ })).toBeInTheDocument()
  })
})

describe('irama', () => {
  it('suku pendek dan panjang ditampilkan; tombol putar tidak gagal tanpa audio', async () => {
    const user = userEvent.setup()
    const k = kitabahBait(BAHR.rajaz.kunci)
    if (!k.ok) throw new Error(k.galat)
    render(<Irama hasil={timbangBait(k.syathr, BAHR.rajaz)} />)
    const baris = screen.getByLabelText('Irama syathr 1')
    // مُسْتَفْعِلُنْ = مُسْ تَفْ عِ لُنْ: tiga panjang, satu pendek; tiga kali.
    expect(baris.querySelectorAll('.suku.panjang')).toHaveLength(9)
    expect(baris.querySelectorAll('.suku:not(.panjang)')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Putar irama' }))
  })
})

describe('tamrinat bertingkat', () => {
  it('cari yang pincang: centang, periksa, lalu skor dan status per baris', async () => {
    const user = userEvent.setup()
    render(
      <CariPincang
        petunjuk="Mana yang pincang?"
        bahr="rajaz"
        baris={[
          { bait: ['دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ', 'قَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ'] },
          { bait: ['بَدَأْتُ نَظْمِي حَامِدًا لِلْأَوَّلِ', 'وَصَلَّيْتُ عَلَى النَّبِيِّ الْمُرْسَلِ'] },
        ]}
      />,
    )
    const kotak = screen.getAllByRole('checkbox', { name: 'Pincang' })
    await user.click(kotak[1])
    await user.click(screen.getByRole('button', { name: 'Periksa' }))
    expect(screen.getByText('2 dari 2 tepat')).toBeInTheDocument()
    expect(screen.getByText('lurus')).toBeInTheDocument()
    expect(screen.getByText('patah 1')).toBeInTheDocument()
  })

  it('drill tandai: butir demi butir, hitungan benar bertambah', async () => {
    const user = userEvent.setup()
    render(<TandaiDrill petunjuk="Beri tanda." butir={['لَمْ', 'نَعَمْ']} />)
    expect(screen.getByText(/Butir 1 dari 2/)).toBeInTheDocument()
    const sel = screen.getAllByRole('button', { name: /huruf/i })
    await user.click(sel[0])
    await user.click(sel[1]); await user.click(sel[1])
    await user.click(screen.getByRole('button', { name: 'Periksa' }))
    expect(screen.getByText('1 benar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Butir berikutnya' }))
    expect(screen.getByText(/Butir 2 dari 2/)).toBeInTheDocument()
  })

  it('set kenali: skor percobaan pertama setelah semua soal dijawab', async () => {
    const user = userEvent.setup()
    render(<Kenali petunjuk="Kenali." soal={[
      { soal: 'لَمْ = ?', pilihan: ['10', '110'], jawaban: 0, alasan: 'sabab' },
      { soal: 'نَعَمْ = ?', pilihan: ['10', '110'], jawaban: 1, alasan: 'watad' },
    ]} />)
    const [satuA, , duaA, duaB] = screen.getAllByRole('button')
    await user.click(satuA)
    await user.click(duaA)
    await user.click(duaB)
    expect(screen.getByText('2 dari 2 soal')).toBeInTheDocument()
    expect(screen.getByText(/Benar pada percobaan pertama: 1 dari 2/)).toBeInTheDocument()
  })
})

describe('Jilid 1: mode salim (spec 077)', () => {
  const susun = { jenis: 'susun' as const, petunjuk: 'Susun satu bait.', bahr: 'rajaz' as const, makna: 'Bebas.', bankKata: true }
  const salim = (anak: React.ReactNode) => <Jilid.Provider value={{ salim: true, modul: 0 }}>{anak}</Jilid.Provider>

  it('taf\'ilah yang berubah belum lulus dan ditunjukkan bentuk utuhnya; bait utuh lulus', async () => {
    const user = userEvent.setup()
    render(salim(<Susun t={susun} />))
    const isian = screen.getByLabelText(/Bait Anda/)
    await user.type(isian, 'بَدَأْتُ نَظْمِي حَامِدًا لِلْأَوَّلِ\nمُصَلِّيًا عَلَى النَّبِيِّ الْمُرْسَلِ')
    await user.click(screen.getByRole('button', { name: 'Timbang' }))
    expect(screen.getByText('belum utuh 3')).toBeInTheDocument()
    expect(screen.getAllByText(/belum utuh\. Di Jilid 1 setiap taf'ilah harus مُسْتَفْعِلُنْ \(1010110\)/).length).toBe(3)
    await user.clear(isian)
    await user.type(isian, 'دَارٌ لِسَلْمَى إِذْ سُلَيْمَى جَارَةٌ\nقَفْرٌ تَرَى آيَاتِهَا مِثْلَ الزُّبُرْ')
    await user.click(screen.getByRole('button', { name: 'Timbang' }))
    expect(screen.getByText('utuh semua')).toBeInTheDocument()
  })

  it('cetakan: baris lurus yang berubah tidak bisa disimpan di Jilid 1', async () => {
    const user = userEvent.setup()
    const t = { jenis: 'cetakan' as const, petunjuk: 'Isi.', cetakan: '{1} بَحْرٌ يَسْهُلُ', bahr: 'rajaz' as const, jumlah: 1, kotak: [{ petunjuk: 'Satu taf\'ilah lebih', pola: '1010110 10', contoh: ['فِي أَبْحُرِ الْأَرْجَازِ'] }] }
    render(salim(<Cetakan t={t} />))
    await user.type(screen.getByLabelText('Kotak 1'), 'وَفِي بُحُورِ الشِّعْرِ')
    expect(screen.getByText(/belum utuh/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan baris' })).toBeDisabled()
  })

  it('laci tersaring: hanya kata dari modul yang sudah dibuka dan bahr yang dilatih', async () => {
    render(<Laci sampai={0} bahr="rajaz" />)
    expect(screen.queryByText('يَدَانِ')).toBeNull()
    expect(screen.queryByText('سَأُنْبِيكَ')).toBeNull()
    expect(document.querySelectorAll('.laci tbody tr').length).toBeGreaterThan(0)
  })
})

describe('panen laci sendiri (spec 077)', () => {
  const t = { jenis: 'panen' as const, petunjuk: 'Panen.', bait: ['صُبْحٌ بَدَا بَدْرٌ هَدَى طَوْدٌ عَلَا', 'بَحْرٌ حَلَا غَيْثٌ هَمَى لَيْثٌ سَطَا'], bahr: 'rajaz' as const, jumlah: 1, kotak: true, sumber: 'Hazim al-Qarthajanni' }

  it('pilih kata berurutan, pola dihitung; satu taf\'ilah utuh bisa disimpan ke Laci saya, lalu tampil di laci', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Panen t={t} />)
    expect(screen.getByRole('region', { name: "Kotak taf'ilah" })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'صُبْحٌ' })[0])
    expect(screen.getByText(/1010 · belum satu taf'ilah/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'بَدَا' })[0])
    expect(screen.getByText(/1010110 · satu مُسْتَفْعِلُنْ utuh/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Arti'), 'fajar yang terbit')
    await user.click(screen.getByRole('button', { name: 'Simpan ke Laci saya' }))
    expect(screen.getByText('1 dari 1 panen')).toBeInTheDocument()
    expect(localStorage.getItem('nadzom.laci.v1')).toContain('صُبْحٌ بَدَا')
    unmount()
    render(<Laci />)
    expect(screen.getByRole('region', { name: 'Laci saya' })).toBeInTheDocument()
    expect(screen.getByText('fajar yang terbit')).toBeInTheDocument()
  })

  it('laci saya bisa diekspor ke Markdown dan diimpor kembali', async () => {
    const user = userEvent.setup()
    localStorage.setItem('nadzom.laci.v1', JSON.stringify([{ teks: 'صُبْحٌ بَدَا', arti: 'fajar terbit', pola: '1010110', cocok: 'satu مُسْتَفْعِلُنْ utuh', sumber: ['Hazim'] }]))
    const md = keMarkdown(bacaLaci())
    expect(md).toContain('| صُبْحٌ بَدَا | 1010110 | fajar terbit |')
    localStorage.clear()
    expect(imporMarkdown(md)).toBe(1)
    expect(bacaLaci()[0].arti).toBe('fajar terbit')
    render(<Laci />)
    await user.click(screen.getByRole('button', { name: 'Ekspor Laci saya' }))
    expect((screen.getByLabelText('Markdown Laci saya') as HTMLTextAreaElement).value).toContain('صُبْحٌ بَدَا')
  })
})
