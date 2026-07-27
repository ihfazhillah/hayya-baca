import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionStore } from './sessionStore'
import type { MeChild, MeGuardian } from '@/api/types'

const GUARDIAN_ME: MeGuardian = {
  role: 'guardian',
  user_id: 5,
  telegram_linked: false,
  children: [
    {
      id: 1,
      name: 'Ahmad',
      age: 8,
      avatar_color: '#111',
      coins: 0,
      stars: 0,
      created_at: '',
      has_diary_account: true,
      username: 'ahmad',
    },
    {
      id: 2,
      name: 'Fatimah',
      age: 6,
      avatar_color: '#222',
      coins: 0,
      stars: 0,
      created_at: '',
      has_diary_account: false,
      username: null,
    },
  ],
}

const CHILD_ME: MeChild = {
  role: 'child',
  user_id: 10,
  child: {
    id: 1,
    name: 'Ahmad',
    age: 8,
    avatar_color: '#111',
    coins: 0,
    stars: 0,
    created_at: '',
  },
}

describe('SessionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('unlock caches the family and lands on the lobby without a token', () => {
    const s = new SessionStore()
    s.unlock('ayah', GUARDIAN_ME)
    expect(s.getToken()).toBeNull()
    expect(s.state.active).toBeNull()
    expect(s.state.family?.guardianUsername).toBe('ayah')
    expect(s.state.family?.children).toHaveLength(2)
  })

  it('restores the family (only) after a reload — no token, on the lobby', () => {
    new SessionStore().unlock('ayah', GUARDIAN_ME)
    const reloaded = new SessionStore()
    expect(reloaded.state.family?.guardianUsername).toBe('ayah')
    expect(reloaded.state.active).toBeNull()
    expect(reloaded.getToken()).toBeNull()
  })

  it('enterChild sets an in-memory child session with a token', () => {
    const s = new SessionStore()
    s.unlock('ayah', GUARDIAN_ME)
    s.enterChild(CHILD_ME, 'ctok')
    expect(s.getToken()).toBe('ctok')
    expect(s.state.active?.kind).toBe('child')
  })

  it('enterGuardian sets guardian session + refreshes the family cache', () => {
    const s = new SessionStore()
    s.unlock('ayah', GUARDIAN_ME)
    s.enterGuardian(GUARDIAN_ME, 'gtok')
    expect(s.getToken()).toBe('gtok')
    expect(s.state.active?.kind).toBe('guardian')
  })

  it('idle timeout drops the active profile back to the lobby, keeping family', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.unlock('ayah', GUARDIAN_ME)
    s.enterChild(CHILD_ME, 'ctok')
    vi.advanceTimersByTime(1001)
    expect(s.state.active).toBeNull()
    expect(s.getToken()).toBeNull()
    expect(s.state.family).not.toBeNull()
  })

  it('switchProfile returns to the lobby, keeping the family', () => {
    const s = new SessionStore()
    s.unlock('ayah', GUARDIAN_ME)
    s.enterChild(CHILD_ME, 'ctok')
    s.switchProfile()
    expect(s.state.active).toBeNull()
    expect(s.state.family).not.toBeNull()
    expect(s.getToken()).toBeNull()
  })

  it('touch resets the idle countdown while in a profile', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.unlock('ayah', GUARDIAN_ME)
    s.enterChild(CHILD_ME, 'ctok')
    vi.advanceTimersByTime(800)
    s.touch()
    vi.advanceTimersByTime(800)
    expect(s.state.active).not.toBeNull()
    vi.advanceTimersByTime(300)
    expect(s.state.active).toBeNull()
  })

  it('logout clears the family and its storage', () => {
    const s = new SessionStore()
    s.unlock('ayah', GUARDIAN_ME)
    s.enterChild(CHILD_ME, 'ctok')
    s.logout()
    expect(s.state.family).toBeNull()
    expect(s.state.active).toBeNull()
    expect(new SessionStore().state.family).toBeNull()
  })

  it('never persists any token to localStorage', () => {
    const s = new SessionStore()
    s.unlock('ayah', GUARDIAN_ME)
    s.enterChild(CHILD_ME, 'secret-child-token')
    s.enterGuardian(GUARDIAN_ME, 'secret-guardian-token')
    const dump = JSON.stringify(localStorage)
    expect(dump).not.toContain('secret-child-token')
    expect(dump).not.toContain('secret-guardian-token')
  })
})
