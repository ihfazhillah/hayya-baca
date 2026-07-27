// Framework-agnostic session state.
//
// Children (shared chromebooks) keep the token ONLY in memory — closing the tab
// or refreshing drops it (Spec 060 §3.4). Guardians (their own phone) instead
// persist the session to localStorage so a refresh or PWA relaunch does NOT log
// them out; the idle-lock still applies, and an idle-locked session restores to
// the lock screen (not a live session).
import type { Me } from '@/api/types'
import type { QuickPick } from './quickpick'

export const IDLE_MS = 10 * 60 * 1000 // 10 minutes

const SESSION_KEY = 'ruangcerita.session'

export interface SessionState {
  token: string | null
  me: Me | null
  locked: boolean
  lockedProfile: QuickPick | null
}

/** Read a persisted GUARDIAN session, if any. Anything else is ignored. */
function loadPersisted(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as SessionState
    return p?.me?.role === 'guardian' ? p : null
  } catch {
    return null
  }
}

function clearPersisted() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
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
    // Restore a persisted guardian session on construction (page reload).
    const p = loadPersisted()
    if (p) {
      this.me = p.me
      this.lockedProfile = p.lockedProfile
      this.locked = p.locked
      // A locked session restores without a usable token (→ lock screen).
      this.token = p.locked ? null : p.token
      if (this.token) this.resetIdle()
    }
  }

  /** Persist guardian sessions only; everything else clears storage. */
  private persist() {
    if (this.me?.role === 'guardian') {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(this.state))
      } catch {
        /* ignore */
      }
    } else {
      clearPersisted()
    }
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
    this.persist()
    this.onChange?.(this.state)
  }
}
