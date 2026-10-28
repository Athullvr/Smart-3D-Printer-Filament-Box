import type { SensorReading } from '../../types'

export type ReadingListener = (reading: SensorReading) => void

/**
 * Contract between any sensor source and the monitoring engine.
 * A future ESP32-backed provider (e.g. WebSocket/MQTT/HTTP) implements this
 * interface; the engine and dashboard do not change.
 */
export interface SensorProvider {
  readonly source: SensorReading['source']
  /** Begin delivering readings (a first reading may be emitted immediately). */
  start(): void
  /** Stop delivering readings and release timers/connections. */
  stop(): void
  /** Subscribe to readings; returns an unsubscribe function. */
  subscribe(listener: ReadingListener): () => void
}
