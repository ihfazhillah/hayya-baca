import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useApi, usePostTypes } from '@/features/shared/hooks'
import type { PostType } from '@/api/types'

export default function TypePicker() {
  const navigate = useNavigate()
  const api = useApi()
  const types = usePostTypes()

  const create = useMutation({
    mutationFn: (type: PostType) => api.createPost({ type: type.slug }),
    onSuccess: (post, type) => {
      navigate(type.kind === 'comic' ? `/komik/${post.id}` : `/tulis/${post.id}`)
    },
  })

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <button
        onClick={() => navigate(-1)}
        className="self-start text-sm text-purple-400"
      >
        ← Kembali
      </button>
      <h2 className="text-center text-xl font-bold text-purple-800">
        Aku mau nulis…
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {types.data?.map((type) => (
          <button
            key={type.slug}
            disabled={create.isPending}
            onClick={() => create.mutate(type)}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl bg-white p-4 text-center shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            <span className="text-4xl">{type.emoji}</span>
            <span className="font-semibold text-purple-800">{type.label}</span>
          </button>
        ))}
      </div>
      {create.isError && (
        <p className="text-center text-sm text-red-600">
          Gagal membuat. Coba lagi.
        </p>
      )}
    </div>
  )
}
