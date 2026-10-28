import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

if (typeof HTMLElement !== 'undefined') {
  for (const prop of ['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight'] as const)
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 600 })

  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

afterEach(() => {
  cleanup()
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

// jsdom has no layout; with stubbed element sizes Recharts emits duplicate axis-tick keys. Test-env artifact only.
const origError = console.error
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Encountered two children with the same key, `tick-')) return
  origError(...args)
}
