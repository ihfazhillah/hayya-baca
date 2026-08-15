import '@testing-library/jest-dom/vitest'

// jsdom's localStorage under Node can lack a working API; install a simple
// in-memory Storage so persistence code runs unchanged in tests.
if (
  typeof localStorage === 'undefined' ||
  typeof localStorage.clear !== 'function'
) {
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
