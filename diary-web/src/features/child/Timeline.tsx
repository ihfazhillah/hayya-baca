import { useNavigate } from 'react-router-dom'
import { useMyPosts, usePostTypes } from '@/features/shared/hooks'
import { excerpt } from '@/features/shared/prosemirror'
import { Button } from '@/features/shared/ui'
import type { Post, PostType } from '@/api/types'

export default function Timeline() {
  const navigate = useNavigate()
  const posts = useMyPosts()
  const types = usePostTypes()

  const typeBySlug = new Map<string, PostType>(
    (types.data ?? []).map((t) => [t.slug, t]),
  )

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Button className="w-full py-5 text-xl" onClick={() => navigate('/new')}>
        ✏️ Aku mau nulis…
      </Button>

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
  onOpen,
}: {
  post: Post
  type?: PostType
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
      </span>
    </button>
  )
}
