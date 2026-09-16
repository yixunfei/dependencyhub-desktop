import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// antd's responsive grid reads matchMedia; provide a deterministic stub so
// component tests can render reliably in jsdom without a browser layout pass.
if (typeof window !== 'undefined') window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  media: '',
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false
}))

if (typeof window !== 'undefined') {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  // jsdom has no pseudo-element layout; Ant Design only needs base scrollbar styles.
  const getComputedStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = (element) => getComputedStyle(element)
}
