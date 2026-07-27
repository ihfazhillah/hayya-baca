import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; @tanstack/react-virtual needs it to measure rows.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver)
