import '@testing-library/jest-dom/vitest'

// vitest 4's jsdom environment (Node 25) exposes a `localStorage` without a
// working API, so tests that clear/read it throw. Install a simple in-memory
// Storage so the app's persistence code runs unchanged under test.
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  class MemoryStorage implements Storage {
    private map = new Map<string, string>()
    get length() {
      return this.map.size
    }
    clear() {
      this.map.clear()
    }
    getItem(key: string) {
      return this.map.has(key) ? this.map.get(key)! : null
    }
    key(index: number) {
      return Array.from(this.map.keys())[index] ?? null
    }
    removeItem(key: string) {
      this.map.delete(key)
    }
    setItem(key: string, value: string) {
      this.map.set(key, String(value))
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  })
}

// jsdom has no ResizeObserver; @tanstack/react-virtual needs it to measure rows.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver)
