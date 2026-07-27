import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { useApi } from '@/features/shared/hooks'
import { Button } from '@/features/shared/ui'
import { PARTS, TaskForm, localDate } from '@/features/schedule/TaskForm'
import type { ScheduleTaskInput, TodayTask } from '@/api/types'

const PART_LABEL = Object.fromEntries(PARTS.map((p) => [p.key, p.label]))

export default function GuardianSchedule() {
  const { childId } = useParams()
  const cid = Number(childId)
  const navigate = useNavigate()
  const api = useApi()
  const qc = useQueryClient()
  const { me } = useSession()
  const child =
    me?.role === 'guardian' ? me.children.find((c) => c.id === cid) : undefined
  const date = localDate()
  const [adding, setAdding] = useState(false)

  const today = useQuery({
    queryKey: ['child-schedule', cid, date],
    queryFn: () => api.childScheduleToday(cid, date),
  })
  const create = useMutation({
    mutationFn: (input: ScheduleTaskInput) =>
      api.addChildScheduleTask(cid, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-schedule', cid] })
      setAdding(false)
    },
  })

  const data = today.data

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <button
        onClick={() => navigate('/kelola')}
        className="self-start text-sm text-purple-400"
      >
        ← Kembali
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-purple-800">
          Jadwal {child?.name ?? ''}
        </h2>
        {data && data.total > 0 && (
          <span className="text-sm font-semibold text-purple-500">
            {data.done_count}/{data.total} selesai
          </span>
        )}
      </div>

      {today.isLoading && <p className="text-purple-400">Memuat…</p>}
      {data && data.total === 0 && !adding && (
        <p className="text-center text-purple-400">
          Belum ada kegiatan hari ini.
        </p>
      )}

      {data?.groups.map((g) => (
        <section key={g.part_of_day} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-purple-400">
            {PART_LABEL[g.part_of_day]}
          </h3>
          {g.items.map((item) => (
            <TaskRow key={item.id} item={item} />
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
        <Button onClick={() => setAdding(true)}>＋ Tambah tugas untuk anak</Button>
      )}
    </div>
  )
}

function TaskRow({ item }: { item: TodayTask }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <span>{item.done ? '✅' : '⬜'}</span>
      <span
        className={
          'flex-1 ' +
          (item.done ? 'text-purple-400 line-through' : 'text-purple-800')
        }
      >
        {item.emoji && <span className="mr-1">{item.emoji}</span>}
        {item.title}
      </span>
      {item.from_guardian && (
        <span className="text-xs text-purple-400" title="ditambahkan orang tua">
          👪
        </span>
      )}
    </div>
  )
}
