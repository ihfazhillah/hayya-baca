import type { PostDetail } from '@/api/types'
import { RenderDoc } from './RenderDoc'
import { ReactionBar } from './ReactionBar'
import { CommentThread } from './CommentThread'

// Shared post reader used by both child and guardian (Spec 060 §5, §7.5, §8.2).
export function PostView({
  post,
  myUserId,
  showReadBy,
  headerRight,
  subtitle,
}: {
  post: PostDetail
  myUserId: number
  showReadBy: boolean
  headerRight?: React.ReactNode
  subtitle?: React.ReactNode
}) {
  return (
    <article className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {post.title && (
            <h2 className="text-2xl font-bold text-purple-900">{post.title}</h2>
          )}
          {subtitle && (
            <p className="text-sm text-purple-400">{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <RenderDoc doc={post.body} />
        {post.panels.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {post.panels.map((panel, i) => (
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
      </div>

      {showReadBy && post.read_by.length > 0 && (
        <p className="text-sm text-green-600">
          ✓ Dibaca {post.read_by.map((r) => r.label).join(' · ')}
        </p>
      )}

      <ReactionBar postId={post.id} reactions={post.reactions} />
      <CommentThread
        postId={post.id}
        comments={post.comments}
        myUserId={myUserId}
      />
    </article>
  )
}
