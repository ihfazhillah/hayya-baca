import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import Quill, { Delta } from 'quill'
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

  it('fokus() pada draf yang sudah ada menaruh kursor di akhir, bukan di awal', () => {
    // jsdom tidak punya tata letak untuk Range
    Range.prototype.getBoundingClientRect ??= () => new DOMRect()
    Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
    const ref = createRef<EditorApi>()
    render(<Editor ref={ref} mode="draf_nol" teks="Sore itu hujan." />)
    const q = Quill.find(document.querySelector('.ql-container')!) as Quill
    act(() => ref.current?.fokus())
    expect(q.getSelection()?.index).toBe('Sore itu hujan.'.length)
  })

  it('bilah stabilo hilang setelah anak mengetik menggantikan pilihan', async () => {
    Range.prototype.getBoundingClientRect ??= () => new DOMRect()
    Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
    render(<Editor mode="revisi" teks="Fatih sedih." alat={[{ ...ALAT[0] }]} warna={ALAT} />)
    const q = Quill.find(document.querySelector('.ql-container')!) as Quill
    act(() => {
      q.setSelection(6, 5, 'user')
    })
    expect(await screen.findByRole('toolbar', { name: 'Stabilo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stabilo Kamera' })).toBeInTheDocument()
    await act(async () => {
      q.updateContents(new Delta().retain(6).delete(5).insert('murung'), 'user')
      // seperti mengetik sungguhan: kursor menyempit tanpa event selection-change
      q.setSelection(12, 0, 'silent')
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(screen.queryByRole('toolbar', { name: 'Stabilo' })).toBeNull()
  })
})
