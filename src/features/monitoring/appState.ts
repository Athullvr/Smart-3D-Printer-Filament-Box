import type { Material, MonitorState, Sample, SensorReading, Settings } from '../../types'
import type { LoadedData } from '../../services/storage/storage'
import { createDefaultSettings, isValidThreshold } from '../settings/defaults'
import { acknowledge, applyReading, createInitialMonitorState, reevaluate, validateReading } from './engine'
import { MAX_SAMPLES } from '../../services/storage/storage'

export interface AppState {
  settings: Settings
  monitor: MonitorState
  samples: Sample[]
}

export type AppAction =
  | { type: 'reading'; reading: SensorReading }
  | { type: 'setMaterial'; material: Material; now: number }
  | { type: 'setThreshold'; material: Material; value: number; now: number }
  | { type: 'acknowledge'; now: number }
  | { type: 'reset' }

export const initAppState = (loaded: Pick<LoadedData, 'settings' | 'samples' | 'events'>): AppState => ({
  settings: loaded.settings,
  monitor: createInitialMonitorState(loaded.events),
  samples: loaded.samples,
})

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'reading': {
      const monitor = applyReading(state.monitor, action.reading, state.settings)
      let samples = state.samples
      const r = action.reading
      if (validateReading(r).ok) {
        const last = samples[samples.length - 1]
        const dup = last && last.timestamp === r.timestamp && last.humidity === r.humidity
        if (!dup) samples = [...samples, { timestamp: r.timestamp, humidity: r.humidity as number, temperature: r.temperature }].slice(-MAX_SAMPLES)
      }
      return { ...state, monitor, samples }
    }
    case 'setMaterial': {
      if (action.material === state.settings.material) return state
      const settings = { ...state.settings, material: action.material }
      return { ...state, settings, monitor: reevaluate(state.monitor, settings, action.now) }
    }
    case 'setThreshold': {
      if (!isValidThreshold(action.value)) return state
      const settings = { ...state.settings, thresholds: { ...state.settings.thresholds, [action.material]: action.value } }
      return { ...state, settings, monitor: reevaluate(state.monitor, settings, action.now) }
    }
    case 'acknowledge':
      return { ...state, monitor: acknowledge(state.monitor, action.now) }
    case 'reset':
      return { settings: createDefaultSettings(), monitor: createInitialMonitorState(), samples: [] }
  }
}
