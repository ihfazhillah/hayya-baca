import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi, usePostDetail } from '@/features/shared/hooks'
import { compressImage } from '@/features/shared/image'
import { Button } from '@/features/shared/ui'
import type { Panel } from '@/api/types'

export default function ComicComposer() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()
  const api = useApi()
  const qc = useQueryClient()
  const detail = usePostDetail(postId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['post', postId] })

  const upload = useMutation({
    // Compress in the browser first so the full-res photo never leaves the device.
    mutationFn: async (file: File) =>
      api.uploadPanel(postId, await compressImage(file)),
    onSuccess: invalidate,
    onError: () => setError('Gagal mengunggah gambar (maks 10 MB).'),
  })

  const removePanel = useMutation({
    mutationFn: (panelId: number) => api.deletePanel(postId, panelId),
    onSuccess: invalidate,
  })

  const setCaption = useMutation({
    mutationFn: (v: { panelId: number; caption: string }) =>
      api.patchPanel(postId, v.panelId, { caption: v.caption }),
    onSuccess: invalidate,
  })

  const reorder = useMutation({
    mutationFn: (v: { a: Panel; b: Panel }) =>
      Promise.all([
        api.patchPanel(postId, v.a.id, { order: v.b.order }),
        api.patchPanel(postId, v.b.id, { order: v.a.order }),
      ]),
    onSuccess: invalidate,
  })

  const publish = useMutation({
    mutationFn: () => api.updatePost(postId, { status: 'published' }),
    onSuccess: () => navigate(`/post/${postId}`),
  })

  const del = useMutation({
    mutationFn: () => api.deletePost(postId),
    onSuccess: () => navigate('/'),
  })

  const panels = detail.data?.panels ?? []

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-purple-400"
        >
          ← Simpan draf
        </button>
        <button
          onClick={() => {
            if (confirm('Hapus komik ini? Tidak bisa dikembalikan.'))
              del.mutate()
          }}
          disabled={del.isPending}
          className="text-sm text-red-500 disabled:opacity-50"
        >
          {del.isPending ? 'Menghapus…' : 'Hapus'}
        </button>
      </div>
      <h2 className="text-xl font-bold text-purple-800">🎨 Komikku</h2>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            if (!file.type.startsWith('image/')) {
              setError('Hanya gambar yang boleh diunggah, bukan video.')
            } else {
              upload.mutate(file)
            }
          }
          e.target.value = ''
        }}
      />
      <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? 'Mengunggah…' : '📷 Tambah gambar'}
      </Button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-4">
        {panels.map((panel, i) => (
          <div key={panel.id} className="rounded-2xl bg-white p-3 shadow-sm">
            {panel.image_url && (
              <img
                src={panel.image_url}
                alt={`Panel ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="max-h-80 w-full rounded-xl object-contain"
              />
            )}
            <input
              defaultValue={panel.caption}
              placeholder="Tulis keterangan…"
              onBlur={(e) =>
                e.target.value !== panel.caption &&
                setCaption.mutate({ panelId: panel.id, caption: e.target.value })
              }
              className="mt-2 w-full rounded-xl bg-purple-50 px-3 py-2 outline-none"
            />
            <div className="mt-2 flex justify-between text-sm">
              <div className="flex gap-2">
                <button
                  disabled={i === 0}
                  onClick={() => reorder.mutate({ a: panel, b: panels[i - 1] })}
                  className="text-purple-500 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  disabled={i === panels.length - 1}
                  onClick={() => reorder.mutate({ a: panel, b: panels[i + 1] })}
                  className="text-purple-500 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <button
                onClick={() => removePanel.mutate(panel.id)}
                className="text-red-500"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      {panels.length > 0 && (
        <Button
          onClick={() => publish.mutate()}
          disabled={publish.isPending}
          className="mt-2"
        >
          {publish.isPending ? 'Menerbitkan…' : '📮 Terbitkan untuk Orang Tua'}
        </Button>
      )}
    </div>
  )
}
