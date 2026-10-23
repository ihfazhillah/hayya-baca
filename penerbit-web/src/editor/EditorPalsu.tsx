/** Pengganti Editor untuk tes halaman (vi.mock), supaya tes halaman tidak bergantung pada Quill. */
import { useImperativeHandle, useRef, useState } from 'react'
import type { DataEditor, EditorProps } from './Editor'

export type { AlatStabilo, DataEditor, EditorApi, EditorProps } from './Editor'

export default function EditorPalsu(props: EditorProps) {
  const teksAwal = props.teks ?? (props.isi?.ops ?? []).map((o) => (typeof o.insert === 'string' ? o.insert : '')).join('').replace(/\n$/, '')
  const data = useRef<DataEditor>({ isi: props.isi ?? { ops: [{ insert: teksAwal + '\n' }] }, teks: teksAwal, sorotan: props.sorotan ?? [] })
  const [, setN] = useState(0)
  useImperativeHandle(props.ref, () => ({
    ambil: () => data.current,
    aturSorotan: (s) => {
      data.current = { ...data.current, sorotan: s }
      setN((n) => n + 1)
    },
    fokus: () => {},
  }))
  const ketik = () => {
    const teks = data.current.teks + ' tambah'
    data.current = { ...data.current, teks, isi: { ops: [{ insert: teks + '\n' }] } }
    props.onUbah?.(data.current)
    setN((n) => n + 1)
  }
  return (
    <div data-testid="editor" data-mode={props.mode} data-timer={String(!!props.timerBerjalan)}
      data-nonaktif={String(!!props.nonaktif)} data-sorotan={data.current.sorotan.length}>
      <p>{data.current.teks}</p>
      <p>{(props.alat ?? []).map((a) => a.kode).join(',')}</p>
      {props.statusSimpan && <span>{props.statusSimpan}</span>}
      <button type="button" onClick={ketik}>ketik palsu</button>
    </div>
  )
}
