import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error'

/**
 * Debounced autosave. `schedule(value)` marks the draft dirty and, after
 * `delay` ms of quiet, calls `save`. In-flight changes stay in memory so a
 * dropped connection never loses the child's writing (Spec 060 §4.4).
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay = 3000) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<T | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const flush = useCallback(async () => {
    if (latest.current === null) return
    const value = latest.current
    try {
      await saveRef.current(value)
      // Only clear to "saved" if nothing newer was queued meanwhile.
      if (latest.current === value) setStatus('saved')
    } catch {
      setStatus('error')
    }
  }, [])

  const schedule = useCallback(
    (value: T) => {
      latest.current = value
      setStatus('pending')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [delay, flush],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return { status, schedule }
}
