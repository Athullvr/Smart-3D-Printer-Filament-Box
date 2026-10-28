import type { SensorReading } from '../../types'
import type { ReadingListener, SensorProvider } from './types'
import { isValidEndpointUrl, parseDeviceReading } from './contract'

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'stale' | 'disconnected'

export interface HttpSensorState {
  url: string
  connection: ConnectionState
  deviceId: string | null
  /** Device-reported time of the newest accepted measurement (epoch ms). */
  lastMeasurementAt: number | null
  /** Browser time when that measurement was received (epoch ms). */
  lastReceivedAt: number | null
  error: string | null
}

export const DEFAULT_ENDPOINT = 'http://localhost:8787/api/reading'

export interface HttpSensorOptions {
  url?: string
  /** Delay between the end of one poll and the start of the next. */
  pollMs?: number
  /** Per-request timeout (covers headers and body). */
  timeoutMs?: number
  /** No NEW measurement for this long (browser clock) => stale. */
  staleAfterMs?: number
  now?: () => number
  fetchFn?: typeof fetch
}

/**
 * Read-only HTTP polling provider. It only ever issues GET requests: nothing in this app can
 * change, silence, or disable the device. Physical monitoring and alerts live in ESP32 firmware.
 *
 * Time handling: the engine receives the browser's receive time as `timestamp` (device clocks may be
 * wrong or unset); the device's own measurement time is carried as `measuredAt`.
 * Duplicates: a reading with the same (deviceId, timestamp) as the last accepted one is the same
 * measurement and is not forwarded. Older/different timestamps are accepted (device clocks can reset).
 */
export class HttpSensorProvider implements SensorProvider {
  readonly source = 'esp32-dht11' as const
  private state: HttpSensorState
  private readingListeners = new Set<ReadingListener>()
  private stateListeners = new Set<() => void>()
  private running = false
  private epoch = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private controller: AbortController | null = null
  private lastKey: string | null = null
  private lastNewAt: number | null = null
  private readonly pollMs: number
  private readonly timeoutMs: number
  private readonly staleAfterMs: number
  private readonly now: () => number
  private readonly fetchFn: typeof fetch

  constructor(opts: HttpSensorOptions = {}) {
    this.pollMs = opts.pollMs ?? 2000
    this.timeoutMs = opts.timeoutMs ?? 3000
    this.staleAfterMs = opts.staleAfterMs ?? 10_000
    this.now = opts.now ?? Date.now
    this.fetchFn = opts.fetchFn ?? ((...a) => fetch(...a))
    const url = opts.url && isValidEndpointUrl(opts.url) ? opts.url : DEFAULT_ENDPOINT
    this.state = { url, connection: 'idle', deviceId: null, lastMeasurementAt: null, lastReceivedAt: null, error: null }
  }

  // --- SensorProvider ---
  start(): void {
    if (this.running) return
    this.running = true
    this.epoch++
    this.resetMemory()
    this.patch({ connection: 'connecting', error: null })
    void this.poll(this.epoch)
  }
  stop(): void {
    this.running = false
    this.epoch++
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.controller?.abort()
    this.controller = null
    this.patch({ connection: 'idle' })
  }
  subscribe(listener: ReadingListener): () => void {
    this.readingListeners.add(listener)
    return () => this.readingListeners.delete(listener)
  }

  // --- state / configuration ---
  getState = (): HttpSensorState => this.state
  subscribeState = (cb: () => void): (() => void) => {
    this.stateListeners.add(cb)
    return () => this.stateListeners.delete(cb)
  }
  /** Returns false (and changes nothing) if the URL is not a valid http(s) URL. */
  setUrl(url: string): boolean {
    if (!isValidEndpointUrl(url)) return false
    if (url === this.state.url) return true
    const wasRunning = this.running
    if (wasRunning) this.stop()
    this.patch({ url, deviceId: null, lastMeasurementAt: null, lastReceivedAt: null, error: null })
    if (wasRunning) this.start()
    return true
  }

  // --- internals ---
  private resetMemory() {
    this.lastKey = null
    this.lastNewAt = null
    this.patch({ deviceId: null, lastMeasurementAt: null, lastReceivedAt: null })
  }

  private current(epoch: number) {
    return this.running && epoch === this.epoch
  }

  private async poll(epoch: number): Promise<void> {
    if (!this.current(epoch)) return
    const ctrl = new AbortController()
    this.controller = ctrl
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; ctrl.abort() }, this.timeoutMs)
    try {
      const res = await this.fetchFn(this.state.url, { signal: ctrl.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: unknown = await res.json().catch(() => { throw new Error('response was not valid JSON') })
      if (this.current(epoch)) this.handlePayload(json)
    } catch (e) {
      if (this.current(epoch)) this.handleFailure(timedOut ? `no response within ${this.timeoutMs} ms` : e instanceof Error ? e.message : String(e))
    } finally {
      clearTimeout(timeout)
    }
    if (this.current(epoch)) this.timer = setTimeout(() => void this.poll(epoch), this.pollMs)
  }

  private isStale(): boolean {
    return this.lastNewAt !== null && this.now() - this.lastNewAt > this.staleAfterMs
  }

  private staleMessage(): string {
    const s = Math.round((this.now() - (this.lastNewAt ?? this.now())) / 1000)
    return `Sensor data is stale: no new measurement for ${s}s. The device may be frozen or powered off.`
  }

  private handlePayload(json: unknown) {
    const parsed = parseDeviceReading(json)
    if (!parsed.ok) {
      this.patch({ connection: this.isStale() ? 'stale' : 'connected', error: parsed.error })
      return this.emitUnavailable(parsed.error)
    }
    const p = parsed.payload
    const key = `${p.deviceId}|${p.timestamp}`
    if (key === this.lastKey) {
      if (this.isStale()) {
        if (this.state.connection !== 'stale') {
          const msg = this.staleMessage()
          this.patch({ connection: 'stale', error: msg })
          this.emitUnavailable(msg, p.deviceId)
        }
      } else if (this.state.connection === 'disconnected' || this.state.connection === 'connecting') {
        this.patch({ connection: 'connected', error: null })
      }
      return
    }
    this.lastKey = key
    this.lastNewAt = this.now()
    this.patch({ connection: 'connected', deviceId: p.deviceId, lastMeasurementAt: p.timestamp, lastReceivedAt: this.lastNewAt, error: p.valid ? null : (p.error ?? null) })
    if (!p.valid) return this.emitUnavailable(p.error ?? 'Device reported an invalid measurement.', p.deviceId)
    this.emit({ humidity: p.humidity, temperature: p.temperature, timestamp: this.lastNewAt, measuredAt: p.timestamp, deviceId: p.deviceId, source: this.source })
  }

  private handleFailure(reason: string) {
    const msg = `Cannot reach sensor endpoint: ${reason}.`
    this.patch({ connection: 'disconnected', error: msg })
    this.emitUnavailable(msg)
  }

  private emitUnavailable(error: string, deviceId?: string) {
    this.emit({ humidity: null, temperature: null, timestamp: this.now(), source: this.source, error, ...(deviceId ? { deviceId } : {}) })
  }

  private emit(reading: SensorReading) {
    this.readingListeners.forEach((l) => l(reading))
  }

  private patch(p: Partial<HttpSensorState>) {
    this.state = { ...this.state, ...p }
    this.stateListeners.forEach((l) => l())
  }
}
