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

describe('SessionStore', () => {
  beforeEach(() => vi.useFakeTimers())
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

  it('never persists the token to localStorage (tab-close semantics)', () => {
    const s = new SessionStore()
    s.login('secret-token', ME)
    const dump = JSON.stringify(localStorage)
    expect(dump).not.toContain('secret-token')
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
