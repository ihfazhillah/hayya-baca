import { useEffect, useState } from 'react'
import { fetchStreak, type Streak } from '../api'
import { STREAK_UPDATED } from '../streak'

/** Header badge: 🔥 N-day English streak. Hidden when 0. Refreshes when a
 *  practice ping fires (Spec 068). */
export function StreakBadge() {
  const [streak, setStreak] = useState<Streak | null>(null)

  useEffect(() => {
    const load = () => {
      fetchStreak()
        .then(setStreak)
        .catch(() => {})
    }
    load()
    window.addEventListener(STREAK_UPDATED, load)
    return () => window.removeEventListener(STREAK_UPDATED, load)
  }, [])

  if (!streak || streak.current_streak < 1) return null
  return (
    <span
      title={`Streak English · terpanjang ${streak.longest_streak} hari`}
      className="rounded-lg bg-white/15 px-2 py-1 font-semibold"
    >
      🔥 {streak.current_streak}
    </span>
  )
}
