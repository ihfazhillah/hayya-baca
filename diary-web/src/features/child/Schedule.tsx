import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/features/shared/hooks'
import { Button } from '@/features/shared/ui'
import { PARTS, TaskForm, localDate } from '@/features/schedule/TaskForm'
import type { ScheduleTaskInput, TodayTask } from '@/api/types'

const PART_LABEL = Object.fromEntries(PARTS.map((p) => [p.key, p.label]))

export default function Schedule() {
  const api = useApi()
  const qc = useQueryClient()
  const date = localDate()
  const [adding, setAdding] = useState(false)

  const today = useQuery({
    queryKey: ['schedule-today', date],
    queryFn: () => api.scheduleToday(date),
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['schedule-today'] })

  const create = useMutation({
    mutationFn: (input: ScheduleTaskInput) => api.createScheduleTask(input),
    onSuccess: () => {
      invalidate()
      setAdding(false)
    },
  })
  const toggle = useMutation({
    mutationFn: (v: { id: number; done: boolean }) =>
      api.toggleScheduleTask(v.id, date, v.done),
    onSuccess: invalidate,
  })
  const del = useMutation({
    mutationFn: (id: number) => api.deleteScheduleTask(id),
    onSuccess: invalidate,
  })

  const data = today.data
  const allDone = !!data && data.total > 0 && data.done_count === data.total

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-purple-800">Jadwalku Hari Ini</h2>
        {data && data.total > 0 && (
          <span className="text-sm font-semibold text-purple-500">
            {data.done_count}/{data.total} selesai
          </span>
        )}
      </div>

      {allDone && (
        <div className="rounded-2xl bg-green-100 px-4 py-3 text-center text-sm font-semibold text-green-700">
          🎉 Semua selesai, hebat!
        </div>
      )}

      {today.isLoading && <p className="text-purple-400">Memuat…</p>}
      {data && data.total === 0 && !adding && (
        <p className="text-center text-purple-400">
          Belum ada kegiatan. Ayo susun jadwalmu!
        </p>
      )}

      {data?.groups.map((g) => (
        <section key={g.part_of_day} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-purple-400">
            {PART_LABEL[g.part_of_day]}
          </h3>
          {g.items.map((item) => (
            <TaskRow
              key={item.id}
              item={item}
              onToggle={() => toggle.mutate({ id: item.id, done: !item.done })}
              onDelete={() => del.mutate(item.id)}
            />
          ))}
        </section>
      ))}

      {adding ? (
        <TaskForm
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => create.mutate(input)}
        />
      ) : (
        <Button onClick={() => setAdding(true)}>＋ Tambah kegiatan</Button>
      )}
    </div>
  )
}

function TaskRow({
  item,
  onToggle,
  onDelete,
}: {
  item: TodayTask
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        className="h-6 w-6 accent-purple-600"
      />
      <span
        className={
          'flex-1 ' +
          (item.done ? 'text-purple-400 line-through' : 'text-purple-800')
        }
      >
        {item.emoji && <span className="mr-1">{item.emoji}</span>}
        {item.title}
      </span>
      {item.from_guardian ? (
        <span title="dari orang tua" aria-label="dari orang tua">
          👪
        </span>
      ) : (
        <button
          onClick={onDelete}
          className="text-sm text-red-300 hover:text-red-500"
          aria-label="hapus"
        >
          ✕
        </button>
      )}
    </div>
  )
}
