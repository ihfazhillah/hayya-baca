import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { useApi, usePostDetail, usePostTypes } from '@/features/shared/hooks'
import { PostView } from '@/features/shared/PostView'

export default function ChildPostDetail() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()
  const api = useApi()
  const { state } = useSession()
  const detail = usePostDetail(postId)
  const types = usePostTypes()

  const seen = useMutation({ mutationFn: () => api.markSeen(postId) })
  const del = useMutation({
    mutationFn: () => api.deletePost(postId),
    onSuccess: () => navigate('/'),
  })

  // Mark seen once so guardian-reply badges clear.
  const loadedId = detail.data?.id
  useEffect(() => {
    if (loadedId) seen.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId])

  if (!detail.data) return <p className="text-purple-400">Memuat…</p>
  const post = detail.data
  const myUserId = state.me?.role === 'child' ? state.me.user_id : 0
  const kind = types.data?.find((t) => t.slug === post.type)?.kind ?? 'text'

  const onEdit = () =>
    navigate(kind === 'comic' ? `/komik/${postId}` : `/tulis/${postId}`)
  const onDelete = () => {
    if (confirm('Hapus cerita ini? Tidak bisa dikembalikan.')) del.mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate('/')}
        className="self-start text-sm text-purple-400"
      >
        ← Kembali
      </button>
      <PostView
        post={post}
        myUserId={myUserId}
        showReadBy
        headerRight={
          <div className="flex shrink-0 gap-3 text-sm">
            <button onClick={onEdit} className="text-purple-500">
              Ubah
            </button>
            <button onClick={onDelete} className="text-red-500">
              Hapus
            </button>
          </div>
        }
      />
    </div>
  )
}
