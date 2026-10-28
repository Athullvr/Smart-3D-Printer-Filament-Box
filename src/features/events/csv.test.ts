import { describe, expect, it } from 'vitest'
import { CSV_HEADERS, escapeCsv, eventsToCsv } from './csv'
import type { BreachEvent } from '../../types'

const base: BreachEvent = {
  id: 'EVT-0001', startedAt: Date.UTC(2026, 0, 1, 10, 0, 0), endedAt: Date.UTC(2026, 0, 1, 10, 1, 30), peakHumidity: 47.5,
  material: 'PETG', threshold: 25, source: 'simulated', acknowledged: true, acknowledgedAt: Date.UTC(2026, 0, 1, 10, 0, 20), state: 'closed',
}

describe('csv export', () => {
  it('13. has headings and correct event data', () => {
    const lines = eventsToCsv([base], 0).trim().split('\r\n')
    expect(lines[0]).toBe(CSV_HEADERS.join(','))
    expect(lines[1]).toBe('EVT-0001,closed,2026-01-01T10:00:00.000Z,2026-01-01T10:01:30.000Z,90,47.5,PETG,25,yes,2026-01-01T10:00:20.000Z,simulated')
  })
  it('exports active events with blank end and live duration', () => {
    const active: BreachEvent = { ...base, endedAt: null, state: 'active', acknowledged: false, acknowledgedAt: null }
    const row = eventsToCsv([active], base.startedAt + 12_000).trim().split('\r\n')[1]!.split(',')
    expect(row[3]).toBe('')
    expect(row[4]).toBe('12')
    expect(row[8]).toBe('no')
  })
  it('floors duration to whole seconds, matching the UI formatter', () => {
    const e: BreachEvent = { ...base, endedAt: base.startedAt + 1999 }
    expect(eventsToCsv([e], 0).split('\r\n')[1]!.split(',')[4]).toBe('1')
  })
  it('escapes commas, quotes and newlines', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"')
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsv('l1\nl2')).toBe('"l1\nl2"')
    expect(escapeCsv(null)).toBe('')
    expect(escapeCsv('plain')).toBe('plain')
  })
  it('produces only headers for no events', () => {
    expect(eventsToCsv([], 0)).toBe(CSV_HEADERS.join(',') + '\r\n')
  })
})
