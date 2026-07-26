import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { useApi, usePostTypes } from '@/features/shared/hooks'
import { Avatar } from '@/features/shared/ui'
import type { FeedItem, GuardianBadges, PostType } from '@/api/types'

export default function Feed() {
  const api = useApi()
  const navigate = useNavigate()
  const { state } = useSession()
  const children = state.me?.role === 'guardian' ? state.me.children : []
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

      <div className="flex flex-col gap-3">
        {feed.data?.results.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            emoji={typeBySlug.get(item.type)?.emoji ?? '📝'}
            onOpen={() => navigate(`/post/${item.id}`)}
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

function FeedCard({
  item,
  emoji,
  onOpen,
}: {
  item: FeedItem
  emoji: string
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="flex items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <Avatar name={item.child.name} color={item.child.avatar_color} size={40} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-purple-800">{item.child.name}</span>
          <span>{emoji}</span>
          {item.is_unread && (
            <span className="h-2 w-2 rounded-full bg-red-500" aria-label="baru" />
          )}
        </span>
        <span className="mt-1 block truncate text-sm text-purple-500">
          {item.title || 'Cerita baru'}
        </span>
        <span className="mt-1 block text-xs text-purple-400">
          💬 {item.comment_count} · ❤️ {item.reaction_count}
        </span>
      </span>
    </button>
  )
}
