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

  it('enterGuardian caches the family and enters guardian mode', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    expect(s.getToken()).toBe('gtok')
    expect(s.state.active?.kind).toBe('guardian')
    expect(s.state.family?.guardianUsername).toBe('ayah')
    expect(s.state.family?.children).toHaveLength(2)
  })

  it('restores the family (only) after a reload — no token, on the lobby', () => {
    new SessionStore().enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    const reloaded = new SessionStore()
    expect(reloaded.state.family?.guardianUsername).toBe('ayah')
    expect(reloaded.state.active).toBeNull() // reload → lobby, not guardian
    expect(reloaded.getToken()).toBeNull()
  })

  it('enterChild sets an in-memory child session with a token', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.switchProfile() // → lobby
    s.enterChild(CHILD_ME, 'ctok')
    expect(s.getToken()).toBe('ctok')
    expect(s.state.active?.kind).toBe('child')
  })

  it('idle timeout drops the active profile back to the lobby, keeping family', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    vi.advanceTimersByTime(1001)
    expect(s.state.active).toBeNull()
    expect(s.getToken()).toBeNull()
    expect(s.state.family).not.toBeNull()
  })

  it('switchProfile returns to the lobby, keeping the family', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.switchProfile()
    expect(s.state.active).toBeNull()
    expect(s.state.family).not.toBeNull()
    expect(s.getToken()).toBeNull()
  })

  it('touch resets the idle countdown while in a profile', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    vi.advanceTimersByTime(800)
    s.touch()
    vi.advanceTimersByTime(800)
    expect(s.state.active).not.toBeNull()
    vi.advanceTimersByTime(300)
    expect(s.state.active).toBeNull()
  })

  it('logout clears the family and its storage', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.logout()
    expect(s.state.family).toBeNull()
    expect(s.state.active).toBeNull()
    expect(new SessionStore().state.family).toBeNull()
  })

  it('never persists any token to localStorage', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'secret-guardian-token')
    s.switchProfile()
    s.enterChild(CHILD_ME, 'secret-child-token')
    const dump = JSON.stringify(localStorage)
    expect(dump).not.toContain('secret-child-token')
    expect(dump).not.toContain('secret-guardian-token')
  })

  // F8 — trusted parent device
  it('trusted device restores the guardian session on reload (skips lobby)', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.setTrusted(true)
    expect(s.state.trusted).toBe(true)

    const reloaded = new SessionStore()
    expect(reloaded.state.active?.kind).toBe('guardian')
    expect(reloaded.getToken()).toBe('gtok')
  })

  it('trusted device disables the idle-lock', () => {
    const s = new SessionStore({ idleMs: 1000 })
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.setTrusted(true)
    vi.advanceTimersByTime(5000)
    expect(s.state.active?.kind).toBe('guardian') // still logged in
  })

  it('turning trust off forgets the persisted guardian', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.setTrusted(true)
    s.setTrusted(false)
    const reloaded = new SessionStore()
    expect(reloaded.state.active).toBeNull() // back to lobby-on-reload
  })

  it('a 401 lock forgets the persisted guardian even when trusted', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.setTrusted(true)
    s.lock() // simulate 401
    expect(s.state.active).toBeNull()
    expect(new SessionStore().state.active).toBeNull()
  })

  it('never persists a child token even on a trusted device', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.setTrusted(true)
    s.switchProfile()
    s.enterChild(CHILD_ME, 'secret-child-token')
    expect(JSON.stringify(localStorage)).not.toContain('secret-child-token')
  })

  it('logout clears the trusted flag and stored guardian', () => {
    const s = new SessionStore()
    s.enterGuardian('ayah', GUARDIAN_ME, 'gtok')
    s.setTrusted(true)
    s.logout()
    const reloaded = new SessionStore()
    expect(reloaded.state.trusted).toBe(false)
    expect(reloaded.state.active).toBeNull()
  })
})
