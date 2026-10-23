import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import Quill from 'quill'
import Editor, { type EditorApi } from './Editor'
import { PESAN_TEMPEL } from './modes'

function tempel(target: Element, teks: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'clipboardData', { value: { getData: (t: string) => (t === 'text/plain' ? teks : '') } })
  target.dispatchEvent(ev)
  return ev
}

const ALAT = [{ kode: 'kamera', nama: 'Kamera', emoji: '🎥', warna: '--color-actor-4' }]

describe('Editor (Quill di jsdom)', () => {
  it('pemeriksa ejaan browser dimatikan di elemen editor', () => {
    render(<Editor mode="draf_nol" teks="Halo" />)
    const root = screen.getByRole('textbox')
    expect(root).toHaveAttribute('spellcheck', 'false')
    expect(root).toHaveAttribute('autocorrect', 'off')
    expect(root).toHaveAttribute('autocapitalize', 'off')
    expect(root).toHaveTextContent('Halo')
  })

  it('tempel dari luar ditolak dengan pesan ramah', async () => {
    render(<Editor mode="revisi" teks="Fatih sedih." />)
    const ev = tempel(screen.getByRole('textbox'), 'Kalimat dari Gemini')
    expect(ev.defaultPrevented).toBe(true)
    expect(await screen.findByText(PESAN_TEMPEL)).toBeInTheDocument()
  })

  it('sorotan tampil sebagai format stabilo dan bisa dihitung', () => {
    const ref = createRef<EditorApi>()
    render(
      <Editor ref={ref} mode="baca" teks="Rak kosong. Fatih sedih." warna={ALAT}
        sorotan={[{ alat: 'kamera', index: 12, length: 12, sumber: 'anak', diperbaiki: true }]} />,
    )
    const tanda = document.querySelector('.stabilo-kamera_ok')
    expect(tanda).toHaveTextContent('Fatih sedih.')
    expect(screen.getByText('1 sorotan, 1 sudah diperbaiki')).toBeInTheDocument()
    act(() => ref.current?.aturSorotan([{ alat: 'kembar', index: 0, length: 3, sumber: 'sistem', diperbaiki: false }]))
    expect(document.querySelector('.sistem-kembar')).toHaveTextContent('Rak')
    expect(document.querySelector('.stabilo-kamera_ok')).toBeNull()
    // Delta yang disimpan tidak membawa atribut stabilo
    const data = ref.current!.ambil()
    expect(JSON.stringify(data.isi)).not.toContain('sistem')
    expect(data.teks).toBe('Rak kosong. Fatih sedih.')
  })

  it('Draf Nol saat timer berjalan: hapusan dikembalikan dan pesan muncul sekali', async () => {
    const ubah: string[] = []
    render(<Editor mode="draf_nol" teks="Boleh jelek" timerBerjalan onUbah={(d) => ubah.push(d.teks)} />)
    const q = Quill.find(document.querySelector('.ql-container')!) as Quill
    act(() => {
      q.deleteText(0, 6, 'user')
    })
    expect(q.getText()).toBe('Boleh jelek\n')
    expect(await screen.findByText('Boleh jelek, dilarang menghapus.')).toBeInTheDocument()
    act(() => {
      q.insertText(11, ' sekali', 'user')
    })
    expect(ubah.at(-1)).toBe('Boleh jelek sekali')
  })

  it('Revisi: mengubah teks yang disorot membuatnya "sudah diperbaiki"', async () => {
    const ref = createRef<EditorApi>()
    render(
      <Editor ref={ref} mode="revisi" teks="Rak kosong. Fatih sedih." warna={ALAT}
        sorotan={[{ alat: 'kamera', index: 12, length: 12, sumber: 'anak', diperbaiki: false }]} />,
    )
    expect(screen.getByText('1 sorotan, 0 sudah diperbaiki')).toBeInTheDocument()
    const q = Quill.find(document.querySelector('.ql-container')!) as Quill
    act(() => {
      q.deleteText(18, 5, 'user') // "sedih"
      q.insertText(18, 'menunduk', 'user')
    })
    expect(screen.getByText('1 sorotan, 1 sudah diperbaiki')).toBeInTheDocument()
    const s = ref.current!.ambil().sorotan[0]
    expect(ref.current!.ambil().teks.slice(s.index, s.index + s.length)).toBe('Fatih menunduk.')
  })
})
