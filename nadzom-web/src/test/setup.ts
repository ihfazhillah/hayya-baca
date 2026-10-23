import '@testing-library/jest-dom/vitest'

// Node 26 menaruh `localStorage` bawaannya sendiri (undefined tanpa --localstorage-file) di atas milik jsdom.
if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
  const data = new Map<string, string>()
  const penyimpanan: Storage = {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k) },
    setItem: (k, v) => { data.set(k, String(v)) },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: penyimpanan, configurable: true })
}

// jsdom tidak punya scrollTo. Chrome 155 mengembalikan Promise; tiru agar efek yang mengembalikannya ketahuan.
window.scrollTo = (() => Promise.resolve()) as unknown as typeof window.scrollTo
