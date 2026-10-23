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
    for (const p of MODUL[0].pelajaran) aturSelesai(kodePelajaran(0, p.nomor), true)
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
