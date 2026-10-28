import { describe, expect, it } from 'vitest'
import { createStorageService, MAX_SAMPLES } from './storage'
import { MemoryBackend } from '../../test/helpers'
import type { BreachEvent } from '../../types'

const ev = (over: Partial<BreachEvent> = {}): BreachEvent => ({
  id: 'EVT-0001', startedAt: 1, endedAt: null, peakHumidity: 50, material: 'PLA', threshold: 35, acknowledged: false, acknowledgedAt: null, state: 'active', ...over,
})

describe('storage service', () => {
  it('round-trips settings, events and samples', () => {
    const b = new MemoryBackend()
    const s = createStorageService(b)
    s.saveEvents([ev()])
    s.saveSamples([{ timestamp: 1, humidity: 20, temperature: 22 }])
    s.saveSettings({ material: 'TPU', thresholds: { PLA: 30, PETG: 25, TPU: 18, Nylon: 15 } })
    const l = createStorageService(b).load()
    expect(l.events).toEqual([ev()])
    expect(l.samples).toHaveLength(1)
    expect(l.settings.material).toBe('TPU')
    expect(l.settings.thresholds.TPU).toBe(18)
    expect(l.warnings).toEqual([])
  })
  it('falls back to defaults on malformed JSON without throwing', () => {
    const b = new MemoryBackend()
    for (const k of ['settings', 'samples', 'events', 'simulator']) b.setItem(`filamentguard:v1:${k}`, '{not json')
    const l = createStorageService(b).load()
    expect(l.settings.material).toBe('PLA')
    expect(l.events).toEqual([])
    expect(l.warnings.length).toBeGreaterThan(0)
  })
  it('discards structurally invalid records and invalid thresholds', () => {
    const b = new MemoryBackend()
    b.setItem('filamentguard:v1:events', JSON.stringify([ev(), { id: 5 }, null, ev({ id: 'EVT-0002', state: 'closed', endedAt: null })]))
    b.setItem('filamentguard:v1:settings', JSON.stringify({ material: 'Wood', thresholds: { PLA: -3, PETG: 'x', TPU: 22 } }))
    b.setItem('filamentguard:v1:samples', JSON.stringify([{ timestamp: 1, humidity: 999 }, { timestamp: 2, humidity: 40 }]))
    const l = createStorageService(b).load()
    expect(l.events).toHaveLength(1)
    expect(l.warnings.join(' ')).toMatch(/malformed/)
    expect(l.settings).toEqual({ material: 'PLA', thresholds: { PLA: 35, PETG: 25, TPU: 22, Nylon: 15 } })
    expect(l.samples).toHaveLength(1)
  })
  it('keeps at most one active event when stored data has several', () => {
    const b = new MemoryBackend()
    b.setItem('filamentguard:v1:events', JSON.stringify([ev({ id: 'EVT-0001', startedAt: 1 }), ev({ id: 'EVT-0002', startedAt: 10 })]))
    const l = createStorageService(b).load()
    expect(l.events.filter((e) => e.state === 'active')).toHaveLength(1)
    expect(l.events[0]?.id).toBe('EVT-0002')
    expect(l.events[1]).toMatchObject({ state: 'closed', endedAt: 10 })
  })
  it('caps stored samples', () => {
    const b = new MemoryBackend()
    const s = createStorageService(b)
    s.saveSamples(Array.from({ length: MAX_SAMPLES + 30 }, (_, i) => ({ timestamp: i, humidity: 20, temperature: null })))
    expect(s.load().samples).toHaveLength(MAX_SAMPLES)
  })
  it('handles unavailable storage and write failures', () => {
    const none = createStorageService(null)
    expect(none.saveEvents([])).toBe(false)
    expect(none.load().warnings[0]).toMatch(/unavailable/)
    const throwing = createStorageService({ getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('x') } })
    expect(throwing.saveSettings({ material: 'PLA', thresholds: { PLA: 35, PETG: 25, TPU: 20, Nylon: 15 } })).toBe(false)
    expect(throwing.clear()).toBe(false)
    expect(() => throwing.load()).not.toThrow()
  })
  it('clear removes all keys', () => {
    const b = new MemoryBackend()
    const s = createStorageService(b)
    s.saveEvents([ev()])
    s.clear()
    expect(b.data.size).toBe(0)
  })
})
