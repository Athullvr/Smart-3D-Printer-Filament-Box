import { describe, expect, it } from 'vitest'
import { acknowledge, applyReading, eventDurationMs, evaluateHumidity, getActiveEvent, isBuzzerActive, reevaluate, validateReading } from './engine'
import { freshMonitor, reading, settingsFor } from '../../test/helpers'

const pla = settingsFor('PLA') // threshold 35

describe('threshold rule', () => {
  it('1. reading below threshold is safe', () => {
    const s = applyReading(freshMonitor(), reading(30, 1000), pla)
    expect(s.status).toBe('safe')
    expect(s.events).toHaveLength(0)
  })
  it('2. reading exactly at threshold is safe', () => {
    expect(evaluateHumidity(35, 35)).toBe('safe')
    expect(applyReading(freshMonitor(), reading(35, 1000), pla).status).toBe('safe')
  })
  it('3. reading above threshold starts a breach with one active event', () => {
    const s = applyReading(freshMonitor(), reading(35.1, 1000), pla)
    expect(s.status).toBe('breach')
    expect(s.events).toHaveLength(1)
    expect(s.events[0]).toMatchObject({ id: 'EVT-0001', startedAt: 1000, endedAt: null, peakHumidity: 35.1, material: 'PLA', threshold: 35, acknowledged: false, state: 'active' })
    expect(isBuzzerActive(s.events)).toBe(true)
  })
  it('initial load already above threshold is consistent (one event, breach status)', () => {
    const s = applyReading(freshMonitor(), reading(80, 5), pla)
    expect([s.status, s.events.length, isBuzzerActive(s.events)]).toEqual(['breach', 1, true])
  })
})

describe('breach lifecycle', () => {
  it('4. repeated above-threshold readings do not duplicate events (incl. identical re-delivery)', () => {
    let s = freshMonitor()
    for (const [h, t] of [[40, 1], [41, 2], [41, 2], [40, 3], [40, 3]] as const) s = applyReading(s, reading(h, t), pla)
    expect(s.events).toHaveLength(1)
  })
  it('5. peak humidity only rises', () => {
    let s = freshMonitor()
    for (const h of [40, 55, 45, 50]) s = applyReading(s, reading(h, h), pla)
    expect(s.events[0]?.peakHumidity).toBe(55)
  })
  it('6. acknowledgment silences buzzer but keeps breach and monitoring', () => {
    let s = applyReading(freshMonitor(), reading(40, 1000), pla)
    s = acknowledge(s, 2000)
    expect(isBuzzerActive(s.events)).toBe(false)
    expect(s.status).toBe('breach')
    expect(getActiveEvent(s.events)).toMatchObject({ acknowledged: true, acknowledgedAt: 2000, state: 'active' })
    s = applyReading(s, reading(60, 3000), pla)
    expect(s.events[0]?.peakHumidity).toBe(60)
    expect(s.events[0]?.acknowledged).toBe(true)
    expect(s.events).toHaveLength(1)
  })
  it('acknowledge is a no-op without an active event or when repeated', () => {
    const safe = applyReading(freshMonitor(), reading(10, 1), pla)
    expect(acknowledge(safe, 5)).toBe(safe)
    const acked = acknowledge(applyReading(freshMonitor(), reading(40, 1), pla), 2)
    expect(acknowledge(acked, 9)).toBe(acked)
  })
  it('7. returning to safe closes the event and preserves peak and ack', () => {
    let s = applyReading(freshMonitor(), reading(50, 1000), pla)
    s = acknowledge(s, 1500)
    s = applyReading(s, reading(35, 4000), pla)
    expect(s.status).toBe('safe')
    expect(s.events[0]).toMatchObject({ state: 'closed', endedAt: 4000, peakHumidity: 50, acknowledged: true })
    expect(isBuzzerActive(s.events)).toBe(false)
  })
  it('8. a later breach creates a new event with a new id', () => {
    let s = applyReading(freshMonitor(), reading(50, 1), pla)
    s = applyReading(s, reading(20, 2), pla)
    s = applyReading(s, reading(45, 3), pla)
    expect(s.events.map((e) => e.id)).toEqual(['EVT-0002', 'EVT-0001'])
    expect(s.events.filter((e) => e.state === 'active')).toHaveLength(1)
  })
  it('fluctuating around the threshold follows the strict rule without hysteresis', () => {
    let s = freshMonitor()
    for (const [i, h] of [36, 35, 36, 35].entries()) s = applyReading(s, reading(h, i), pla)
    expect(s.events).toHaveLength(2)
    expect(s.status).toBe('safe')
  })
})

describe('material changes', () => {
  it('9. changing material re-evaluates the current reading', () => {
    let s = applyReading(freshMonitor(), reading(30, 1000), pla)
    expect(s.status).toBe('safe')
    s = reevaluate(s, settingsFor('Nylon'), 2000) // threshold 15
    expect(s.status).toBe('breach')
    expect(s.events[0]).toMatchObject({ material: 'Nylon', threshold: 15, startedAt: 2000 })
    s = reevaluate(s, settingsFor('PLA'), 3000)
    expect(s.status).toBe('safe')
    expect(s.events[0]).toMatchObject({ state: 'closed', endedAt: 3000 })
  })
  it('10. events preserve original material and threshold across changes', () => {
    let s = applyReading(freshMonitor(), reading(30, 1000), settingsFor('Nylon'))
    s = reevaluate(s, settingsFor('PETG'), 2000) // 30 > 25 -> still breach, same event
    expect(s.events).toHaveLength(1)
    expect(s.events[0]).toMatchObject({ material: 'Nylon', threshold: 15, state: 'active' })
    s = reevaluate(s, settingsFor('PLA'), 3000)
    expect(s.events[0]).toMatchObject({ material: 'Nylon', threshold: 15, state: 'closed' })
  })
  it('does not turn an unavailable sensor into safe on re-evaluation', () => {
    let s = applyReading(freshMonitor(), reading(30, 1), pla)
    s = applyReading(s, reading(null, 2), pla)
    const r = reevaluate(s, settingsFor('Nylon'), 3)
    expect(r).toBe(s)
    expect(r.status).toBe('unavailable')
  })
})

describe('invalid readings', () => {
  it.each([[null], [NaN], [Infinity], [-5], [150]])('11. humidity %s is flagged unavailable, never safe', (h) => {
    const s = applyReading(freshMonitor(), reading(h, 1), pla)
    expect(s.status).toBe('unavailable')
    expect(s.error).toBeTruthy()
  })
  it('invalid temperature and timestamp are rejected', () => {
    expect(validateReading(reading(20, 1, NaN)).ok).toBe(false)
    expect(validateReading(reading(20, NaN)).ok).toBe(false)
    expect(validateReading(undefined).ok).toBe(false)
  })
  it('keeps an active breach open (and unacked) when data becomes unavailable, then recovers', () => {
    let s = applyReading(freshMonitor(), reading(50, 1), pla)
    s = applyReading(s, reading(null, 2), pla)
    expect(s.status).toBe('unavailable')
    expect(getActiveEvent(s.events)).toBeDefined()
    expect(isBuzzerActive(s.events)).toBe(true)
    s = applyReading(s, reading(10, 3), pla)
    expect(s.status).toBe('safe')
    expect(s.events[0]?.state).toBe('closed')
  })
})

describe('duration', () => {
  it('computes active and closed durations, clamped at zero', () => {
    let s = applyReading(freshMonitor(), reading(50, 1000), pla)
    const active = s.events[0]!
    expect(eventDurationMs(active, 6000)).toBe(5000)
    expect(eventDurationMs(active, 500)).toBe(0)
    s = applyReading(s, reading(10, 9000), pla)
    expect(eventDurationMs(s.events[0]!, 99999)).toBe(8000)
  })
})
