import { REACTION_EMOJIS, type ReactionSummary } from '@/api/types'
import { useToggleReaction } from './hooks'

export function ReactionBar({
  postId,
  reactions,
}: {
  postId: number
  reactions: ReactionSummary
}) {
  const toggle = useToggleReaction(postId)
  return (
    <div className="flex flex-wrap gap-2">
      {REACTION_EMOJIS.map((emoji) => {
        const mine = reactions.mine.includes(emoji)
        const count = reactions.counts[emoji] ?? 0
        return (
          <button
            key={emoji}
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ emoji, active: mine })}
            className={
              'flex items-center gap-1 rounded-full border-2 px-3 py-1 text-lg transition ' +
              (mine ? 'border-purple-500 bg-purple-50' : 'border-transparent bg-white')
            }
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span className="text-sm font-medium text-purple-600">{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
