export const MATERIALS = ['PLA', 'PETG', 'TPU', 'Nylon'] as const
export type Material = (typeof MATERIALS)[number]

export type ThresholdMap = Record<Material, number>

export interface Settings {
  material: Material
  thresholds: ThresholdMap
}

export type DataSource = 'simulated' | 'esp32-dht11'

/** A raw reading from any sensor provider. null means the value was unavailable. */
export interface SensorReading {
  humidity: number | null
  temperature: number | null
  timestamp: number
  source: DataSource
}

/** A validated humidity/temperature sample kept for charting. */
export interface Sample {
  timestamp: number
  humidity: number
  temperature: number | null
}

export type EventState = 'active' | 'closed'

export interface BreachEvent {
  id: string
  startedAt: number
  endedAt: number | null
  peakHumidity: number
  material: Material
  threshold: number
  acknowledged: boolean
  acknowledgedAt: number | null
  state: EventState
}

export type SystemStatus = 'no-data' | 'safe' | 'breach' | 'unavailable'

export interface MonitorState {
  status: SystemStatus
  /** Newest first. At most one event is ever active. */
  events: BreachEvent[]
  lastReading: SensorReading | null
  /** Most recent reading that passed validation. */
  lastValid: SensorReading | null
  error: string | null
  nextSeq: number
}
