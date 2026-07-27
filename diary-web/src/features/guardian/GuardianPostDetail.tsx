import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { useApi, usePostDetail } from '@/features/shared/hooks'
import { PostView } from '@/features/shared/PostView'

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

  const loadedId = detail.data?.id
  useEffect(() => {
    if (loadedId) seen.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId])

  if (!detail.data) return <p className="text-purple-400">Memuat…</p>
  const myUserId = me?.role === 'guardian' ? me.user_id : 0

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <button
        onClick={() => navigate('/')}
        className="self-start text-sm text-purple-400"
      >
        ← Beranda
      </button>
      <PostView post={detail.data} myUserId={myUserId} showReadBy={false} />
    </div>
  )
}
