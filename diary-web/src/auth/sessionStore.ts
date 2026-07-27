// Framework-agnostic session state for the family-lobby model (Spec 061).
//
// Two layers:
//   • family  — the unlocked guardian's username + cached children list. This
//     is the ONLY thing persisted (localStorage), and it carries NO token, so
//     a reload lands on the lobby without re-login and without a usable token.
//   • active  — the live profile (child or guardian) with its token. In-memory
//     ONLY: reload/relaunch drops it, and every profile entry needs its own
//     password. Idle-lock drops `active` back to the lobby; `family` stays.
import type { MeChild, MeGuardian } from '@/api/types'

export const IDLE_MS = 10 * 60 * 1000 // 10 minutes

const FAMILY_KEY = 'ruangcerita.family'

export interface FamilyChild {
  id: number
  name: string
  avatar_color: string
  username: string | null
  has_diary_account: boolean
}

export interface Family {
  guardianUsername: string
  children: FamilyChild[]
}

export type Active =
  | { kind: 'child'; token: string; me: MeChild }
  | { kind: 'guardian'; token: string; me: MeGuardian }
  | null

export interface SessionState {
  family: Family | null // null → Unlock screen; else → lobby available
  active: Active // null → Lobby; else → inside a profile
}

export interface SessionStoreOptions {
  idleMs?: number
  onChange?: (state: SessionState) => void
}

function toFamilyChildren(me: MeGuardian): FamilyChild[] {
  return me.children.map((c) => ({
    id: c.id,
    name: c.name,
    avatar_color: c.avatar_color,
    username: c.username,
    has_diary_account: c.has_diary_account,
  }))
}

function loadFamily(): Family | null {
  try {
    const raw = localStorage.getItem(FAMILY_KEY)
    if (!raw) return null
    const f = JSON.parse(raw) as Family
    return f && typeof f.guardianUsername === 'string' && Array.isArray(f.children)
      ? f
      : null
  } catch {
    return null
  }
}

function saveFamily(family: Family) {
  try {
    localStorage.setItem(FAMILY_KEY, JSON.stringify(family))
  } catch {
    /* ignore */
  }
}

function clearFamily() {
  try {
    localStorage.removeItem(FAMILY_KEY)
  } catch {
    /* ignore */
  }
}

export class SessionStore {
  private family: Family | null = null
  private active: Active = null
  private idleMs: number
  private onChange?: (state: SessionState) => void
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: SessionStoreOptions = {}) {
    this.idleMs = opts.idleMs ?? IDLE_MS
    this.onChange = opts.onChange
    // Restore the family cache (no token) on reload → lands on the lobby.
    this.family = loadFamily()
  }

  /** The active profile's token, or null in the lobby / unlock screen. */
  getToken = (): string | null => this.active?.token ?? null

  get state(): SessionState {
    return { family: this.family, active: this.active }
  }

  /** Enter a child profile with a freshly issued token. */
  enterChild(me: MeChild, token: string) {
    this.active = { kind: 'child', token, me }
    this.resetIdle()
    this.notify()
  }

  /**
   * Enter guardian mode. Also (re)caches the family so the lobby knows the
   * children — the guardian login IS how the family cache gets populated, so
   * there is no separate "unlock" step (Spec 061 rev: lobby-first).
   */
  enterGuardian(guardianUsername: string, me: MeGuardian, token: string) {
    this.family = { guardianUsername, children: toFamilyChildren(me) }
    this.active = { kind: 'guardian', token, me }
    saveFamily(this.family)
    this.resetIdle()
    this.notify()
  }

  /** Back to the lobby, keeping the family unlocked. */
  switchProfile() {
    this.active = null
    this.clearTimer()
    this.notify()
  }

  /** Full logout → unlock screen. */
  logout() {
    this.family = null
    this.active = null
    clearFamily()
    this.clearTimer()
    this.notify()
  }

  /** Idle timeout / 401 → drop the active profile back to the lobby. */
  lock = () => {
    if (this.active === null) return
    this.active = null
    this.clearTimer()
    this.notify()
  }

  /** Reset the idle countdown on user activity. */
  touch = () => {
    if (this.active !== null) this.resetIdle()
  }

  destroy() {
    this.clearTimer()
  }

  private resetIdle() {
    this.clearTimer()
    this.timer = setTimeout(this.lock, this.idleMs)
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private notify() {
    this.onChange?.(this.state)
  }
}
