import type { BreachEvent, MonitorState, SensorReading, Settings } from '../../types'
import { getThreshold } from '../settings/defaults'

/**
 * Monitoring engine: pure functions only. No clocks, no React, no storage.
 *
 * Rule (no hysteresis): humidity <= threshold is SAFE, humidity > threshold is BREACH.
 */

export const HUMIDITY_RANGE = { min: 0, max: 100 }
export const TEMPERATURE_RANGE = { min: -40, max: 125 }

export type Evaluation = 'safe' | 'breach'

export const evaluateHumidity = (humidity: number, threshold: number): Evaluation =>
  humidity > threshold ? 'breach' : 'safe'

export type ReadingValidation = { ok: true } | { ok: false; reason: string }

export function validateReading(reading: SensorReading | null | undefined): ReadingValidation {
  if (!reading || typeof reading !== 'object') return { ok: false, reason: 'No reading received from sensor.' }
  if (typeof reading.timestamp !== 'number' || !Number.isFinite(reading.timestamp))
    return { ok: false, reason: 'Reading has an invalid timestamp.' }
  const h = reading.humidity
  if (h === null || h === undefined || typeof h !== 'number') return { ok: false, reason: reading.error || 'Humidity value unavailable.' }
  if (!Number.isFinite(h)) return { ok: false, reason: 'Humidity value is not a finite number.' }
  if (h < HUMIDITY_RANGE.min || h > HUMIDITY_RANGE.max)
    return { ok: false, reason: `Humidity ${h} is outside the valid 0-100 %RH range.` }
  const t = reading.temperature
  if (t !== null && t !== undefined && (typeof t !== 'number' || !Number.isFinite(t) || t < TEMPERATURE_RANGE.min || t > TEMPERATURE_RANGE.max))
    return { ok: false, reason: 'Temperature value is invalid.' }
  return { ok: true }
}

export const createInitialMonitorState = (events: BreachEvent[] = []): MonitorState => ({
  status: 'no-data',
  events,
  lastReading: null,
  lastValid: null,
  error: null,
  nextSeq: nextSequenceFor(events),
})

const ID_PREFIX = 'EVT-'
export const formatEventId = (seq: number) => `${ID_PREFIX}${String(seq).padStart(4, '0')}`

export function nextSequenceFor(events: BreachEvent[]): number {
  let max = 0
  for (const e of events) {
    const n = e.id.startsWith(ID_PREFIX) ? Number(e.id.slice(ID_PREFIX.length)) : NaN
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

export const getActiveEvent = (events: BreachEvent[]): BreachEvent | undefined =>
  events.find((e) => e.state === 'active')

/** The simulated buzzer sounds while an active breach exists that has not been acknowledged. */
export const isBuzzerActive = (events: BreachEvent[]): boolean => {
  const a = getActiveEvent(events)
  return !!a && !a.acknowledged
}

const replaceEvent = (events: BreachEvent[], id: string, patch: Partial<BreachEvent>) =>
  events.map((e) => (e.id === id ? { ...e, ...patch } : e))

/**
 * Feed one reading through the engine.
 * - invalid reading: status becomes 'unavailable'; any active event is left untouched (never assumed safe).
 * - breach: opens exactly one event, or raises the peak of the active one.
 * - safe: closes the active event at the reading's timestamp.
 */
export function applyReading(state: MonitorState, reading: SensorReading, settings: Settings): MonitorState {
  const v = validateReading(reading)
  if (!v.ok) return { ...state, status: 'unavailable', lastReading: reading ?? null, error: v.reason }

  const humidity = reading.humidity as number
  const threshold = getThreshold(settings)
  const base = { lastReading: reading, lastValid: reading, error: null }
  const active = getActiveEvent(state.events)

  if (evaluateHumidity(humidity, threshold) === 'breach') {
    if (active) {
      const events = humidity > active.peakHumidity ? replaceEvent(state.events, active.id, { peakHumidity: humidity }) : state.events
      return { ...state, ...base, status: 'breach', events }
    }
    const event: BreachEvent = {
      id: formatEventId(state.nextSeq),
      startedAt: reading.timestamp,
      endedAt: null,
      peakHumidity: humidity,
      material: settings.material,
      threshold,
      acknowledged: false,
      acknowledgedAt: null,
      state: 'active',
      source: reading.source,
    }
    return { ...state, ...base, status: 'breach', events: [event, ...state.events], nextSeq: state.nextSeq + 1 }
  }

  const events = active
    ? replaceEvent(state.events, active.id, { state: 'closed', endedAt: Math.max(reading.timestamp, active.startedAt) })
    : state.events
  return { ...state, ...base, status: 'safe', events }
}

/**
 * Re-evaluate the latest valid reading after a settings change (material or threshold).
 * If the sensor is currently unavailable, the status is not changed - it must not become "safe".
 * An already-open event keeps the material/threshold it started with.
 */
export function reevaluate(state: MonitorState, settings: Settings, now: number): MonitorState {
  if (!state.lastValid || state.status === 'unavailable' || state.status === 'no-data') return state
  return applyReading(state, { ...state.lastValid, timestamp: now }, settings)
}

export function acknowledge(state: MonitorState, now: number): MonitorState {
  const active = getActiveEvent(state.events)
  if (!active || active.acknowledged) return state
  return { ...state, events: replaceEvent(state.events, active.id, { acknowledged: true, acknowledgedAt: now }) }
}

/**
 * The data source changed (simulation <-> hardware) or the app (re)started with a given source.
 * An event cannot span sources: an active event from another source is closed at `now`.
 * Live status is reset to 'no-data' until the new source delivers a reading. Event history is kept.
 */
export function changeSource(state: MonitorState, source: BreachEvent['source'], now: number): MonitorState {
  const active = getActiveEvent(state.events)
  const events = active && active.source !== source ? replaceEvent(state.events, active.id, { state: 'closed', endedAt: Math.max(now, active.startedAt) }) : state.events
  return { ...state, events, status: 'no-data', lastReading: null, lastValid: null, error: null }
}

export const eventDurationMs = (e: BreachEvent, now: number): number =>
  Math.max(0, (e.endedAt ?? now) - e.startedAt)
