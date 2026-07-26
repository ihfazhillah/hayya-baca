// Quick-pick roster: the ONLY thing persisted on a shared device — never a
// token or session (Spec 060 §3.2, §3.4). Lets a child re-pick their username
// and avatar without typing it, then enter only their password.

export interface QuickPick {
  username: string
  name: string
  avatar_color: string
}

const KEY = 'ruangcerita.quickpick'

export function getQuickPicks(): QuickPick[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QuickPick[]) : []
  } catch {
    return []
  }
}

export function addQuickPick(pick: QuickPick): QuickPick[] {
  const others = getQuickPicks().filter((p) => p.username !== pick.username)
  const next = [pick, ...others].slice(0, 8)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function removeQuickPick(username: string): QuickPick[] {
  const next = getQuickPicks().filter((p) => p.username !== username)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
