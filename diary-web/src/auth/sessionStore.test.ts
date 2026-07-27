import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionStore } from './sessionStore'
import { addQuickPick, getQuickPicks, removeQuickPick } from './quickpick'
import type { Me } from '@/api/types'

const ME: Me = {
  role: 'child',
  user_id: 10,
  child: {
    id: 1,
    name: 'Ahmad',
    age: 8,
    avatar_color: '#1A73E8',
    coins: 0,
    stars: 0,
    created_at: '',
  },
}

const GUARDIAN: Me = {
  role: 'guardian',
  user_id: 5,
  children: [],
  telegram_linked: false,
}

describe('SessionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('holds the token in memory and returns it', () => {
    const s = new SessionStore()
    s.login('tok', ME)
    expect(s.getToken()).toBe('tok')
    expect(s.state.locked).toBe(false)
  })

  it('locks after the idle timeout, dropping the token', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.login('tok', ME)
    vi.advanceTimersByTime(1001)
    expect(s.getToken()).toBeNull()
    expect(s.state.locked).toBe(true)
  })

  it('touch resets the idle countdown', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.login('tok', ME)
    vi.advanceTimersByTime(800)
    s.touch()
    vi.advanceTimersByTime(800)
    expect(s.state.locked).toBe(false)
    vi.advanceTimersByTime(300)
    expect(s.state.locked).toBe(true)
  })

  it('logout clears everything', () => {
    const s = new SessionStore()
    s.login('tok', ME)
    s.logout()
    expect(s.getToken()).toBeNull()
    expect(s.state.me).toBeNull()
    expect(s.state.locked).toBe(false)
  })

  it('never persists a CHILD token to localStorage (shared-device semantics)', () => {
    const s = new SessionStore()
    s.login('secret-token', ME)
    const dump = JSON.stringify(localStorage)
    expect(dump).not.toContain('secret-token')
    // A fresh instance (page reload) must NOT restore a child session.
    const reloaded = new SessionStore()
    expect(reloaded.getToken()).toBeNull()
    expect(reloaded.state.me).toBeNull()
  })

  it('persists a GUARDIAN session and restores it after a reload', () => {
    const s = new SessionStore()
    s.login('gtok', GUARDIAN)
    const reloaded = new SessionStore()
    expect(reloaded.getToken()).toBe('gtok')
    expect(reloaded.state.me?.role).toBe('guardian')
    expect(reloaded.state.locked).toBe(false)
  })

  it('restores an idle-locked guardian session to the LOCK screen, not a live session', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.login('gtok', GUARDIAN)
    vi.advanceTimersByTime(1001)
    expect(s.state.locked).toBe(true)

    const reloaded = new SessionStore()
    expect(reloaded.getToken()).toBeNull() // token not usable after idle-lock
    expect(reloaded.state.locked).toBe(true) // → shows the lock screen
    expect(reloaded.state.me?.role).toBe('guardian')
  })

  it('logout clears the persisted guardian session', () => {
    const s = new SessionStore()
    s.login('gtok', GUARDIAN)
    s.logout()
    const reloaded = new SessionStore()
    expect(reloaded.getToken()).toBeNull()
    expect(reloaded.state.me).toBeNull()
  })
})

describe('quickpick', () => {
  beforeEach(() => localStorage.clear())

  it('adds and lists picks', () => {
    addQuickPick({ username: 'ahmad', name: 'Ahmad', avatar_color: '#111' })
    expect(getQuickPicks()).toHaveLength(1)
    expect(getQuickPicks()[0].username).toBe('ahmad')
  })

  it('dedupes by username, newest first', () => {
    addQuickPick({ username: 'ahmad', name: 'A', avatar_color: '#1' })
    addQuickPick({ username: 'fatimah', name: 'F', avatar_color: '#2' })
    addQuickPick({ username: 'ahmad', name: 'A2', avatar_color: '#3' })
    const picks = getQuickPicks()
    expect(picks).toHaveLength(2)
    expect(picks[0].username).toBe('ahmad')
    expect(picks[0].name).toBe('A2')
  })

  it('removes a pick', () => {
    addQuickPick({ username: 'ahmad', name: 'A', avatar_color: '#1' })
    removeQuickPick('ahmad')
    expect(getQuickPicks()).toHaveLength(0)
  })
})
