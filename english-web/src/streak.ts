import { pingStreak } from './api'

const KEY = 'english.streak.pinged'
export const STREAK_UPDATED = 'english-streak-updated'

/** Register today's practice at most once per day (client-side guard), then
 *  notify the badge to refresh. Fire-and-forget — errors ignored. */
export function pingStreakOncePerDay(): void {
  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem(KEY) === today) return
  localStorage.setItem(KEY, today)
  pingStreak()
    .then(() => window.dispatchEvent(new Event(STREAK_UPDATED)))
    .catch(() => localStorage.removeItem(KEY)) // let a later attempt retry
}
