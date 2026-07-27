import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/SessionProvider'
import { useApi, usePostTypes } from '@/features/shared/hooks'
import { Avatar } from '@/features/shared/ui'
import { RenderDoc } from '@/features/shared/RenderDoc'
import { ReactionBar } from '@/features/shared/ReactionBar'
import { CommentThread } from '@/features/shared/CommentThread'
import type { FeedItem, GuardianBadges, PostType } from '@/api/types'

export default function Feed() {
  const api = useApi()
  const { state } = useSession()
  const children = state.me?.role === 'guardian' ? state.me.children : []
  const myUserId = state.me?.role === 'guardian' ? state.me.user_id : 0
  const [filter, setFilter] = useState<number | null>(null)
  const types = usePostTypes()

  const feed = useQuery({
    queryKey: ['feed', filter ?? 'all'],
    queryFn: () => api.feed({ child: filter ?? undefined }),
  })

  // Poll unread counts so chips stay fresh (Spec 060 §6.1).
  const badges = useQuery({
    queryKey: ['badges'],
    queryFn: () => api.badges() as Promise<GuardianBadges>,
    refetchInterval: 30_000,
  })
  const unreadByChild = new Map(
    (badges.data?.children ?? []).map((c) => [c.child_id, c.unread]),
  )
  const typeBySlug = new Map<string, PostType>(
    (types.data ?? []).map((t) => [t.slug, t]),
  )

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === null} onClick={() => setFilter(null)} label="Semua" />
          {children.map((c) => (
            <Chip
              key={c.id}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
              label={c.name}
              badge={unreadByChild.get(c.id) ?? 0}
            />
          ))}
        </div>
      )}

      {feed.isLoading && <p className="text-purple-400">Memuat…</p>}
      {feed.data?.results.length === 0 && (
        <p className="text-center text-purple-400">Belum ada cerita baru.</p>
      )}

      <div className="flex flex-col gap-4">
        {feed.data?.results.map((item) => (
          <FeedPost
            key={item.id}
            item={item}
            emoji={typeBySlug.get(item.type)?.emoji ?? '📝'}
            myUserId={myUserId}
          />
        ))}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  label,
  badge = 0,
}: {
  active: boolean
  onClick: () => void
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={
        'relative rounded-full px-4 py-1 text-sm font-medium ' +
        (active ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 shadow-sm')
      }
    >
      {label}
      {badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

function FeedPost({
  item,
  emoji,
  myUserId,
}: {
  item: FeedItem
  emoji: string
  myUserId: number
}) {
  const api = useApi()
  const qc = useQueryClient()
  const markSeen = useMutation({
    mutationFn: () => api.markSeen(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['badges'] })
    },
  })

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <header className="flex items-center gap-3">
        <Avatar name={item.child.name} color={item.child.avatar_color} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold text-purple-800">
            {item.child.name} <span>{emoji}</span>
            {item.is_unread && (
              <span className="h-2 w-2 rounded-full bg-red-500" aria-label="baru" />
            )}
          </p>
          {item.title && (
            <p className="truncate text-sm text-purple-500">{item.title}</p>
          )}
        </div>
        {item.seen_by_me ? (
          <span className="shrink-0 text-sm font-medium text-green-600">
            ✓ Sudah dibaca
          </span>
        ) : (
          <button
            onClick={() => markSeen.mutate()}
            disabled={markSeen.isPending}
            className="shrink-0 rounded-full border-2 border-purple-500 px-3 py-1 text-sm font-medium text-purple-600 disabled:opacity-50"
          >
            {markSeen.isPending ? '…' : 'Tandai sudah dibaca'}
          </button>
        )}
      </header>

      <RenderDoc doc={item.body} />

      {item.panels.length > 0 && (
        <div className="flex flex-col gap-3">
          {item.panels.map((panel, i) => (
            <figure key={panel.id}>
              {panel.image_url && (
                <img
                  src={panel.image_url}
                  alt={`Panel ${i + 1}`}
                  className="w-full rounded-xl object-contain"
                />
              )}
              {panel.caption && (
                <figcaption className="mt-1 text-center text-sm text-purple-500">
                  {panel.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      <ReactionBar postId={item.id} reactions={item.reactions} />
      <CommentThread postId={item.id} comments={item.comments} myUserId={myUserId} />
    </article>
  )
}
