import type { SensorReading, Settings } from '../types'
import { createDefaultSettings } from '../features/settings/defaults'
import { createInitialMonitorState } from '../features/monitoring/engine'
import type { KeyValueBackend } from '../services/storage/storage'

export const reading = (humidity: number | null, timestamp: number, temperature: number | null = 24): SensorReading => ({
  humidity, temperature, timestamp, source: 'simulated',
})
export const settingsFor = (material: Settings['material'] = 'PLA'): Settings => ({ ...createDefaultSettings(), material })
export const freshMonitor = () => createInitialMonitorState()

export class MemoryBackend implements KeyValueBackend {
  data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, v)
  removeItem = (k: string) => void this.data.delete(k)
}
