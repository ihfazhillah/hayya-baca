import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useApi, useMyPosts, usePostTypes } from '@/features/shared/hooks'
import { excerpt } from '@/features/shared/prosemirror'
import { Button } from '@/features/shared/ui'
import type { ChildBadges, Post, PostType } from '@/api/types'

export default function Timeline() {
  const api = useApi()
  const navigate = useNavigate()
  const posts = useMyPosts()
  const types = usePostTypes()

  // New guardian replies per post (Spec 060 §6.1) — poll so it stays fresh.
  const badges = useQuery({
    queryKey: ['badges'],
    queryFn: () => api.badges() as Promise<ChildBadges>,
    refetchInterval: 30_000,
  })
  const repliesByPost = new Map(
    (badges.data?.posts ?? []).map((p) => [p.post_id, p.unread_replies]),
  )
  const totalNewReplies = badges.data?.total ?? 0

  const typeBySlug = new Map<string, PostType>(
    (types.data ?? []).map((t) => [t.slug, t]),
  )

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Button className="w-full py-5 text-xl" onClick={() => navigate('/new')}>
        ✏️ Aku mau nulis…
      </Button>

      {totalNewReplies > 0 && (
        <div className="rounded-2xl bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-800">
          🎉 Ada {totalNewReplies} balasan baru dari orang tua!
        </div>
      )}

      {posts.isLoading && <p className="text-purple-400">Memuat…</p>}
      {posts.data?.length === 0 && (
        <p className="text-center text-purple-400">
          Belum ada cerita. Ayo tulis yang pertama!
        </p>
      )}

      <div className="flex flex-col gap-3">
        {posts.data?.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            type={typeBySlug.get(post.type)}
            newReplies={repliesByPost.get(post.id) ?? 0}
            onOpen={() =>
              navigate(
                post.status === 'draft' ? `/tulis/${post.id}` : `/post/${post.id}`,
              )
            }
          />
        ))}
      </div>
    </div>
  )
}

function PostCard({
  post,
  type,
  newReplies,
  onOpen,
}: {
  post: Post
  type?: PostType
  newReplies: number
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="flex items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <span className="text-2xl">{type?.emoji ?? '📝'}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-purple-800">
            {post.title || type?.label || 'Cerita'}
          </span>
          {post.status === 'draft' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Draf
            </span>
          )}
        </span>
        <span className="mt-1 block truncate text-sm text-purple-500">
          {excerpt(post.body, 80) || (type?.kind === 'comic' ? 'Komik' : '…')}
        </span>
        {newReplies > 0 && (
          <span className="mt-2 inline-block rounded-full bg-purple-600 px-2 py-0.5 text-xs font-semibold text-white">
            💬 {newReplies} balasan baru
          </span>
        )}
      </span>
    </button>
  )
}
