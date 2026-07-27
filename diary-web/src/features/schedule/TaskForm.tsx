import { useState, type FormEvent } from 'react'
import { Button, TextInput } from '@/features/shared/ui'
import type { PartOfDay, ScheduleKind, ScheduleTaskInput } from '@/api/types'

export const PARTS: { key: PartOfDay; label: string }[] = [
  { key: 'pagi', label: '☀️ Pagi' },
  { key: 'siang', label: '🌤️ Siang' },
  { key: 'sore', label: '🌇 Sore' },
  { key: 'malam', label: '🌙 Malam' },
]

// Monday = 0 … Sunday = 6, matching the backend.
export const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export function localDate(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function TaskForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (input: ScheduleTaskInput) => void
  onCancel: () => void
  busy: boolean
}) {
  const [title, setTitle] = useState('')
  const [part, setPart] = useState<PartOfDay>('pagi')
  const [kind, setKind] = useState<ScheduleKind>('routine')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [date, setDate] = useState(localDate())

  const toggleDay = (i: number) =>
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      part_of_day: part,
      kind,
      ...(kind === 'routine' ? { repeat_days: days } : { date }),
    })
  }

  const canSubmit =
    !!title.trim() && (kind === 'once' ? !!date : days.length > 0)

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <TextInput
        placeholder="Nama kegiatan (mis. Sholat Subuh)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {PARTS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPart(p.key)}
            className={
              'rounded-full px-3 py-1 text-sm font-medium ' +
              (part === p.key
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 text-purple-600')
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <TypePill active={kind === 'routine'} onClick={() => setKind('routine')}>
          Rutin
        </TypePill>
        <TypePill active={kind === 'once'} onClick={() => setKind('once')}>
          Sekali
        </TypePill>
      </div>

      {kind === 'routine' ? (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((w, i) => (
            <button
              key={w}
              type="button"
              onClick={() => toggleDay(i)}
              className={
                'h-9 w-11 rounded-lg text-sm font-medium ' +
                (days.includes(i)
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-500')
              }
            >
              {w}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-2xl border-2 border-purple-200 bg-white px-4 py-3 text-lg outline-none focus:border-purple-500"
        />
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !canSubmit} className="flex-1">
          {busy ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl px-4 text-sm text-purple-400 underline"
        >
          Batal
        </button>
      </div>
    </form>
  )
}

function TypePill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex-1 rounded-xl py-2 text-center font-semibold ' +
        (active ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600')
      }
    >
      {children}
    </button>
  )
}
