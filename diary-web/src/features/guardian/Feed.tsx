import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useSession } from '@/auth/SessionProvider'
import { useApi, usePostTypes } from '@/features/shared/hooks'
import { Avatar } from '@/features/shared/ui'
import { RenderDoc } from '@/features/shared/RenderDoc'
import { ReactionBar } from '@/features/shared/ReactionBar'
import { CommentThread } from '@/features/shared/CommentThread'
import { formatPostTime } from '@/features/shared/datetime'
import type { FeedItem, GuardianBadges, PostType } from '@/api/types'

// DRF returns a full `next` URL; pull the opaque cursor back out for api.feed.
function cursorFromUrl(url: string | null): string | undefined {
  if (!url) return undefined
  const m = url.match(/[?&]cursor=([^&]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function Feed() {
  const api = useApi()
  const { me } = useSession()
  const children = me?.role === 'guardian' ? me.children : []
  const myUserId = me?.role === 'guardian' ? me.user_id : 0
  const [filter, setFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [resolvedView, setResolvedView] = useState(false)
  const types = usePostTypes()

  const feed = useInfiniteQuery({
    queryKey: ['feed', filter ?? 'all', typeFilter ?? 'all', resolvedView],
    queryFn: ({ pageParam }) =>
      api.feed({
        child: filter ?? undefined,
        type: typeFilter ?? undefined,
        resolved: resolvedView || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => cursorFromUrl(lastPage.next),
  })

  const pickType = (slug: string | null) => {
    setTypeFilter(slug)
    if (slug !== 'curhat') setResolvedView(false)
  }
  const posts = feed.data?.pages.flatMap((p) => p.results) ?? []
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed

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

  // Only the windowed cards (+ overscan buffer for context) stay mounted, so
  // scrolling deep never piles heavy cards into the DOM (Spec 061 perf).
  const listRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  useLayoutEffect(() => {
    offsetRef.current = listRef.current?.offsetTop ?? 0
  }, [feed.isLoading, children.length])

  const virtualizer = useWindowVirtualizer({
    count: posts.length,
    estimateSize: () => 480,
    overscan: 5, // keep a few off-screen cards for smooth context
    scrollMargin: offsetRef.current,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? -1

  // Fetch the next page once the last mounted card is near the end.
  useEffect(() => {
    if (lastIndex >= posts.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [lastIndex, posts.length, hasNextPage, isFetchingNextPage, fetchNextPage])

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

      <div className="flex flex-wrap gap-2">
        <Chip
          active={typeFilter === null}
          onClick={() => pickType(null)}
          label="Semua jenis"
        />
        {(types.data ?? []).map((t) => (
          <Chip
            key={t.slug}
            active={typeFilter === t.slug}
            onClick={() => pickType(t.slug)}
            label={`${t.emoji} ${t.label}`}
          />
        ))}
      </div>

      {typeFilter === 'curhat' && (
        <div className="flex flex-wrap gap-2">
          <Chip
            active={!resolvedView}
            onClick={() => setResolvedView(false)}
            label="Belum selesai"
          />
          <Chip
            active={resolvedView}
            onClick={() => setResolvedView(true)}
            label="Sudah selesai"
          />
        </div>
      )}

      {feed.isLoading && <p className="text-purple-400">Memuat…</p>}
      {!feed.isLoading && posts.length === 0 && (
        <p className="text-center text-purple-400">Belum ada cerita baru.</p>
      )}

      <div ref={listRef}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${(virtualItems[0]?.start ?? 0) - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {virtualItems.map((vi) => {
              const item = posts[vi.index]
              return (
                <div
                  key={item.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className="pb-4"
                >
                  <FeedPost
                    item={item}
                    emoji={typeBySlug.get(item.type)?.emoji ?? '📝'}
                    myUserId={myUserId}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {isFetchingNextPage && (
        <p className="py-2 text-center text-sm text-purple-400">Memuat…</p>
      )}
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
  const resolve = useMutation({
    mutationFn: () =>
      item.is_resolved ? api.unresolvePost(item.id) : api.resolvePost(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  })
  const isCurhat = item.type === 'curhat'

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
          <time className="block text-xs text-purple-400">
            {formatPostTime(item.published_at ?? item.created_at)}
          </time>
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
                  loading="lazy"
                  decoding="async"
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

      {isCurhat && (
        <button
          onClick={() => resolve.mutate()}
          disabled={resolve.isPending}
          className={
            'self-start rounded-full px-3 py-1 text-sm font-medium disabled:opacity-50 ' +
            (item.is_resolved
              ? 'bg-purple-100 text-purple-600'
              : 'bg-green-100 text-green-700')
          }
        >
          {resolve.isPending
            ? '…'
            : item.is_resolved
              ? '↩︎ Buka lagi'
              : '✓ Tandai selesai'}
        </button>
      )}
    </article>
  )
}
