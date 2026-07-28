import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { useApi, usePostDetail } from '@/features/shared/hooks'
import { PostView } from '@/features/shared/PostView'
import { formatPostTime } from '@/features/shared/datetime'

export default function GuardianPostDetail() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()
  const api = useApi()
  const qc = useQueryClient()
  const { me } = useSession()
  const detail = usePostDetail(postId)

  // Opening the post records the read receipt + clears the unread badge.
  const seen = useMutation({
    mutationFn: () => api.markSeen(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['badges'] }),
  })

  const resolve = useMutation({
    mutationFn: () =>
      detail.data?.is_resolved
        ? api.unresolvePost(postId)
        : api.resolvePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const save = useMutation({
    mutationFn: () =>
      detail.data?.is_saved ? api.unsavePost(postId) : api.savePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const loadedId = detail.data?.id
  useEffect(() => {
    if (loadedId) seen.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId])

  if (!detail.data) return <p className="text-purple-400">Memuat…</p>
  const myUserId = me?.role === 'guardian' ? me.user_id : 0
  const isCurhat = detail.data.type === 'curhat'

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <button
        onClick={() => navigate('/')}
        className="self-start text-sm text-purple-400"
      >
        ← Beranda
      </button>
      <PostView
        post={detail.data}
        myUserId={myUserId}
        showReadBy={false}
        subtitle={`${detail.data.child.name} • ${formatPostTime(
          detail.data.published_at ?? detail.data.created_at,
        )}`}
        headerRight={
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              aria-pressed={detail.data.is_saved}
              className={
                'rounded-full px-3 py-1 text-sm font-medium disabled:opacity-50 ' +
                (detail.data.is_saved
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-purple-50 text-purple-500')
              }
            >
              {save.isPending
                ? '…'
                : detail.data.is_saved
                  ? '⭐ Tersimpan'
                  : '☆ Simpan'}
            </button>
            {isCurhat && (
              <button
                onClick={() => resolve.mutate()}
                disabled={resolve.isPending}
                className={
                  'rounded-full px-3 py-1 text-sm font-medium disabled:opacity-50 ' +
                  (detail.data.is_resolved
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-green-100 text-green-700')
                }
              >
                {resolve.isPending
                  ? '…'
                  : detail.data.is_resolved
                    ? '↩︎ Buka lagi'
                    : '✓ Tandai selesai'}
              </button>
            )}
          </div>
        }
      />
    </div>
  )
}
