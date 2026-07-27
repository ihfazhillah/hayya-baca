import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi, usePostDetail } from '@/features/shared/hooks'
import { TiptapEditor } from '@/features/shared/TiptapEditor'
import { Button } from '@/features/shared/ui'
import { useAutosave, type SaveStatus } from './useAutosave'
import type { PMDoc } from '@/api/types'

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case 'pending':
      return 'Menyimpan…'
    case 'saved':
      return 'Tersimpan ✓'
    case 'error':
      return 'Gagal menyimpan — akan dicoba lagi'
    default:
      return ' '
  }
}

export default function Editor() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()
  const api = useApi()
  const detail = usePostDetail(postId)

  const del = useMutation({
    mutationFn: () => api.deletePost(postId),
    onSuccess: () => navigate('/'),
  })

  return detail.data ? (
    <EditorForm
      key={postId}
      postId={postId}
      initialTitle={detail.data.title}
      initialBody={detail.data.body}
      onDone={() => navigate('/')}
      onPublished={() => navigate(`/post/${postId}`)}
      onDelete={() => {
        if (confirm('Hapus cerita ini? Tidak bisa dikembalikan.')) del.mutate()
      }}
      deleting={del.isPending}
      save={api.updatePost}
    />
  ) : (
    <p className="text-purple-400">Memuat…</p>
  )
}

function EditorForm({
  postId,
  initialTitle,
  initialBody,
  onDone,
  onPublished,
  onDelete,
  deleting,
  save,
}: {
  postId: number
  initialTitle: string
  initialBody: PMDoc | null
  onDone: () => void
  onPublished: () => void
  onDelete: () => void
  deleting: boolean
  save: (
    id: number,
    payload: Partial<{ title: string; body: PMDoc | null; status: string }>,
    retries?: number,
  ) => Promise<unknown>
}) {
  const [title, setTitle] = useState(initialTitle)
  const bodyRef = useState<{ current: PMDoc | null }>(() => ({
    current: initialBody,
  }))[0]

  const autosave = useAutosave(
    (payload: { title: string; body: PMDoc | null }) => save(postId, payload, 2),
    3000,
  )

  const scheduleSave = useMemo(
    () => (next: { title?: string; body?: PMDoc }) => {
      if (next.title !== undefined) setTitle(next.title)
      if (next.body !== undefined) bodyRef.current = next.body
      autosave.schedule({
        title: next.title ?? title,
        body: bodyRef.current,
      })
    },
    [autosave, title, bodyRef],
  )

  const publish = useMutation({
    mutationFn: () => save(postId, { status: 'published' }),
    onSuccess: onPublished,
  })

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={onDone} className="text-sm text-purple-400">
          ← Simpan draf
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-purple-500">
            {statusLabel(autosave.status)}
          </span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-sm text-red-500 disabled:opacity-50"
          >
            {deleting ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => scheduleSave({ title: e.target.value })}
        placeholder="Judul (boleh kosong)"
        className="rounded-2xl bg-white px-4 py-3 text-xl font-semibold outline-none"
      />

      <TiptapEditor
        initial={initialBody}
        onChange={(doc) => scheduleSave({ body: doc })}
      />

      <Button
        onClick={() => publish.mutate()}
        disabled={publish.isPending}
        className="mt-2"
      >
        {publish.isPending ? 'Menerbitkan…' : '📮 Terbitkan untuk Orang Tua'}
      </Button>
      {publish.isError && (
        <p className="text-center text-sm text-red-600">
          Gagal menerbitkan. Coba lagi.
        </p>
      )}
    </div>
  )
}
