import type { SensorReading } from '../../types'
import type { ReadingListener, SensorProvider } from './types'

export interface SimulatorState {
  humidity: number
  temperature: number
  auto: boolean
  fault: boolean
}

export const SIM_HUMIDITY = { min: 5, max: 95, default: 28 }
export const SIM_TEMPERATURE = { min: 10, max: 45, default: 24 }
export const AUTO_INTERVAL_MS = 1000
const AUTO_BOUNDS = { hMin: 10, hMax: 70, tMin: 18, tMax: 32 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10

export interface SimulatedSensorOptions {
  initial?: Partial<Pick<SimulatorState, 'humidity' | 'temperature'>>
  now?: () => number
  random?: () => number
  intervalMs?: number
}

/** Simulated sensor. Every reading it emits is tagged source: 'simulated'. */
export class SimulatedSensorProvider implements SensorProvider {
  readonly source = 'simulated' as const
  private state: SimulatorState
  private readingListeners = new Set<ReadingListener>()
  private stateListeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly now: () => number
  private readonly random: () => number
  private readonly intervalMs: number

  constructor(opts: SimulatedSensorOptions = {}) {
    this.now = opts.now ?? Date.now
    this.random = opts.random ?? Math.random
    this.intervalMs = opts.intervalMs ?? AUTO_INTERVAL_MS
    this.state = {
      humidity: clamp(opts.initial?.humidity ?? SIM_HUMIDITY.default, SIM_HUMIDITY.min, SIM_HUMIDITY.max),
      temperature: clamp(opts.initial?.temperature ?? SIM_TEMPERATURE.default, SIM_TEMPERATURE.min, SIM_TEMPERATURE.max),
      auto: false,
      fault: false,
    }
  }

  // --- SensorProvider ---
  start(): void {
    this.emit()
  }
  stop(): void {
    this.stopAuto()
  }
  subscribe(listener: ReadingListener): () => void {
    this.readingListeners.add(listener)
    return () => this.readingListeners.delete(listener)
  }

  // --- simulator controls (not part of the SensorProvider contract) ---
  getState = (): SimulatorState => this.state
  subscribeState = (cb: () => void): (() => void) => {
    this.stateListeners.add(cb)
    return () => this.stateListeners.delete(cb)
  }

  setHumidity(humidity: number): void {
    this.stopAuto()
    this.patch({ humidity: clamp(round1(humidity), SIM_HUMIDITY.min, SIM_HUMIDITY.max), fault: false })
    this.emit()
  }
  setTemperature(temperature: number): void {
    this.stopAuto()
    this.patch({ temperature: clamp(round1(temperature), SIM_TEMPERATURE.min, SIM_TEMPERATURE.max), fault: false })
    this.emit()
  }
  /** Emit an unavailable reading to exercise the sensor-error path. */
  injectFault(): void {
    this.stopAuto()
    this.patch({ fault: true })
    this.emit()
  }
  startAuto(): void {
    if (this.timer) return
    this.patch({ auto: true, fault: false })
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }
  stopAuto(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.state.auto) this.patch({ auto: false })
  }
  reset(): void {
    this.stopAuto()
    this.patch({ humidity: SIM_HUMIDITY.default, temperature: SIM_TEMPERATURE.default, fault: false })
    this.emit()
  }

  /** One bounded random-walk step; exposed for deterministic tests. */
  tick(): void {
    const r = this.random
    const h = clamp(this.state.humidity + (r() - 0.5) * 6, AUTO_BOUNDS.hMin, AUTO_BOUNDS.hMax)
    const t = clamp(this.state.temperature + (r() - 0.5) * 0.8, AUTO_BOUNDS.tMin, AUTO_BOUNDS.tMax)
    this.patch({ humidity: round1(h), temperature: round1(t) })
    this.emit()
  }

  private patch(p: Partial<SimulatorState>) {
    this.state = { ...this.state, ...p }
    this.stateListeners.forEach((l) => l())
  }

  private emit() {
    const reading: SensorReading = {
      humidity: this.state.fault ? null : this.state.humidity,
      temperature: this.state.fault ? null : this.state.temperature,
      timestamp: this.now(),
      source: 'simulated',
    }
    this.readingListeners.forEach((l) => l(reading))
  }
}
