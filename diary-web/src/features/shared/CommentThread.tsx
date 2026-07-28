import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommentItem } from '@/api/types'
import { RenderDoc } from './RenderDoc'
import { textToDoc } from './prosemirror'
import { Button } from './ui'
import { useApi, useAddComment } from './hooks'

export function CommentThread({
  postId,
  comments,
  myUserId,
}: {
  postId: number
  comments: CommentItem[]
  myUserId: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold text-purple-700">Obrolan</h3>
      {comments.length === 0 && (
        <p className="text-sm text-purple-400">Belum ada obrolan.</p>
      )}
      {comments.map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          postId={postId}
          mine={c.author_id === myUserId}
        />
      ))}
      <Composer postId={postId} />
    </div>
  )
}

function CommentRow({
  comment,
  postId,
  mine,
}: {
  comment: CommentItem
  postId: number
  mine: boolean
}) {
  const api = useApi()
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => api.deleteComment(comment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
  return (
    <div
      className={
        'rounded-2xl p-3 ' +
        (comment.author_role === 'child' ? 'bg-purple-100' : 'bg-white shadow-sm')
      }
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-purple-700">
          {comment.author_label}
        </span>
        {mine && (
          <button
            onClick={() => del.mutate()}
            className="text-xs text-red-400"
          >
            hapus
          </button>
        )}
      </div>
      <RenderDoc doc={comment.body} />
    </div>
  )
}

function Composer({ postId }: { postId: number }) {
  const [text, setText] = useState('')
  const add = useAddComment(postId)
  const send = () => {
    const trimmed = text.replace(/\n+$/, '').trim()
    if (!trimmed) return
    // Send the original text (minus trailing blank lines) so intended line
    // breaks are preserved; `trimmed` above is only the non-empty guard.
    add.mutate(textToDoc(text.replace(/\n+$/, '')), {
      onSuccess: () => setText(''),
    })
  }
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tulis balasan…"
        rows={1}
        className="max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border-2 border-purple-200 bg-white px-3 py-2 outline-none focus:border-purple-500"
        onInput={(e) => {
          const el = e.currentTarget
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight}px`
        }}
      />
      <Button
        onClick={send}
        disabled={add.isPending || !text.trim()}
        className="shrink-0 px-4 py-2"
      >
        Kirim
      </Button>
    </div>
  )
}
