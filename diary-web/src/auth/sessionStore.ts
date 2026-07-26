// Framework-agnostic session state. The auth token lives ONLY here in memory:
// closing the tab drops it, and an idle timeout locks the session on shared
// devices (Spec 060 §3.4). Nothing here touches localStorage except via the
// quick-pick module.
import type { Me } from '@/api/types'
import type { QuickPick } from './quickpick'

export const IDLE_MS = 10 * 60 * 1000 // 10 minutes

export interface SessionState {
  token: string | null
  me: Me | null
  locked: boolean
  lockedProfile: QuickPick | null
}

export interface SessionStoreOptions {
  idleMs?: number
  onChange?: (state: SessionState) => void
}

export class SessionStore {
  private token: string | null = null
  private me: Me | null = null
  private locked = false
  private lockedProfile: QuickPick | null = null
  private idleMs: number
  private onChange?: (state: SessionState) => void
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: SessionStoreOptions = {}) {
    this.idleMs = opts.idleMs ?? IDLE_MS
    this.onChange = opts.onChange
  }

  getToken = (): string | null => this.token

  get state(): SessionState {
    return {
      token: this.token,
      me: this.me,
      locked: this.locked,
      lockedProfile: this.lockedProfile,
    }
  }

  login(token: string, me: Me, profile: QuickPick | null = null) {
    this.token = token
    this.me = me
    this.locked = false
    if (profile) this.lockedProfile = profile
    this.resetIdle()
    this.notify()
  }

  /** Idle/401 lock: drop the token but remember who to re-auth. */
  lock = () => {
    if (this.token === null && this.locked) return
    this.token = null
    this.locked = true
    this.clearTimer()
    this.notify()
  }

  logout() {
    this.token = null
    this.me = null
    this.locked = false
    this.lockedProfile = null
    this.clearTimer()
    this.notify()
  }

  /** Reset the idle countdown on user activity. */
  touch = () => {
    if (this.token !== null) this.resetIdle()
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
