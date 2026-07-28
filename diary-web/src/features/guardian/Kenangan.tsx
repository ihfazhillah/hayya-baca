import { useInfiniteQuery } from '@tanstack/react-query'
import { useSession } from '@/auth/SessionProvider'
import { useApi, usePostTypes } from '@/features/shared/hooks'
import type { PostType } from '@/api/types'
import { FeedPost, cursorFromUrl } from './Feed'

// The shared family keepsake collection: every post a guardian has saved,
// newest first, across all children (Spec 063 follow-up).
export default function Kenangan() {
  const api = useApi()
  const { me } = useSession()
  const myUserId = me?.role === 'guardian' ? me.user_id : 0
  const types = usePostTypes()
  const typeBySlug = new Map<string, PostType>(
    (types.data ?? []).map((t) => [t.slug, t]),
  )

  const feed = useInfiniteQuery({
    queryKey: ['feed', 'saved'],
    queryFn: ({ pageParam }) => api.feed({ saved: true, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => cursorFromUrl(lastPage.next),
  })
  const posts = feed.data?.pages.flatMap((p) => p.results) ?? []

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-purple-800">⭐ Kenangan</h2>
        <p className="text-sm text-purple-400">
          Karya-karya istimewa yang kamu simpan.
        </p>
      </div>

      {feed.isLoading && <p className="text-purple-400">Memuat…</p>}
      {!feed.isLoading && posts.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-purple-400 shadow-sm">
          Belum ada kenangan tersimpan. Tekan ☆ Simpan pada cerita yang
          istimewa.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {posts.map((item) => (
          <FeedPost
            key={item.id}
            item={item}
            emoji={typeBySlug.get(item.type)?.emoji ?? '📝'}
            myUserId={myUserId}
          />
        ))}
      </div>

      {feed.hasNextPage && (
        <button
          onClick={() => feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className="rounded-2xl bg-white py-2 text-sm font-medium text-purple-600 shadow-sm disabled:opacity-50"
        >
          {feed.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
        </button>
      )}
    </div>
  )
}
