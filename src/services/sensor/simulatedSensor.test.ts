import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SimulatedSensorProvider } from './simulatedSensor'
import type { SensorReading } from '../../types'

describe('SimulatedSensorProvider', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('tags every reading as simulated and emits on start', () => {
    const p = new SimulatedSensorProvider()
    const got: SensorReading[] = []
    p.subscribe((r) => got.push(r))
    p.start()
    p.setHumidity(50)
    expect(got.map((r) => r.source)).toEqual(['simulated', 'simulated'])
  })
  it('14. automatic mode emits bounded readings and can be stopped; repeated start/stop is safe', () => {
    const p = new SimulatedSensorProvider({ intervalMs: 1000 })
    const got: SensorReading[] = []
    p.subscribe((r) => got.push(r))
    p.startAuto(); p.startAuto()
    vi.advanceTimersByTime(5000)
    expect(got).toHaveLength(5)
    p.stopAuto(); p.stopAuto()
    vi.advanceTimersByTime(5000)
    expect(got).toHaveLength(5)
    expect(p.getState().auto).toBe(false)
    p.startAuto()
    vi.advanceTimersByTime(2000)
    expect(got).toHaveLength(7)
    p.stop()
  })
  it('stays within bounds for extreme random sequences', () => {
    for (const rnd of [() => 0, () => 0.999]) {
      const p = new SimulatedSensorProvider({ random: rnd })
      for (let i = 0; i < 200; i++) p.tick()
      const s = p.getState()
      expect(s.humidity).toBeGreaterThanOrEqual(10)
      expect(s.humidity).toBeLessThanOrEqual(70)
      expect(s.temperature).toBeGreaterThanOrEqual(18)
      expect(s.temperature).toBeLessThanOrEqual(32)
    }
  })
  it('fault emits null readings and manual input clears it; manual input stops auto', () => {
    const p = new SimulatedSensorProvider()
    const got: SensorReading[] = []
    p.subscribe((r) => got.push(r))
    p.startAuto()
    p.injectFault()
    expect(got.at(-1)?.humidity).toBeNull()
    expect(p.getState().auto).toBe(false)
    p.setHumidity(40)
    expect(got.at(-1)?.humidity).toBe(40)
  })
  it('clamps slider values', () => {
    const p = new SimulatedSensorProvider()
    p.setHumidity(500)
    expect(p.getState().humidity).toBe(95)
  })
})
