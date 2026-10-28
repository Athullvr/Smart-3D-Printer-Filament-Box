import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import type { Material } from '../types'
import type { SensorProvider } from '../services/sensor/types'
import type { SimulatedSensorProvider } from '../services/sensor/simulatedSensor'
import type { HttpSensorProvider } from '../services/sensor/httpSensor'
import type { StorageService } from '../services/storage/storage'
import { appReducer, initAppState } from '../features/monitoring/appState'

export interface UseFilamentGuardOptions {
  sensor: SensorProvider
  storage: StorageService
  clock?: () => number
  /** Called after app state is cleared during reset-demo (e.g. to reset the simulator). */
  onReset?: () => void
}

export function useFilamentGuard({ sensor, storage, clock = Date.now, onReset }: UseFilamentGuardOptions) {
  const loaded = useMemo(() => storage.load(), [storage])
  const [state, dispatch] = useReducer(appReducer, loaded, initAppState)
  const [saveFailed, setSaveFailed] = useState(false)
  const [now, setNow] = useState(() => clock())
  const clockRef = useRef(clock)
  clockRef.current = clock

  // Sensor wiring: readings flow provider -> reducer (engine). Cleanup makes Strict Mode remounts safe;
  // duplicate events are impossible because the engine only opens an event when none is active.
  // When the active provider changes (simulation <-> hardware) any open event from the other source
  // is closed and live status/chart samples restart; event history is kept.
  const previousSensor = useRef<SensorProvider | null>(null)
  useEffect(() => {
    dispatch({ type: 'sourceChanged', source: sensor.source, now: clockRef.current(), clearSamples: previousSensor.current !== null && previousSensor.current !== sensor })
    previousSensor.current = sensor
    const unsub = sensor.subscribe((reading) => dispatch({ type: 'reading', reading }))
    sensor.start()
    return () => {
      unsub()
      sensor.stop()
    }
  }, [sensor])

  // Wall clock for live durations.
  useEffect(() => {
    const id = setInterval(() => setNow(clockRef.current()), 1000)
    return () => clearInterval(id)
  }, [])

  // Persistence.
  const persist = (ok: boolean) => ok || setSaveFailed(true)
  useEffect(() => void persist(storage.saveSettings(state.settings)), [storage, state.settings])
  useEffect(() => void persist(storage.saveSamples(state.samples)), [storage, state.samples])
  useEffect(() => void persist(storage.saveEvents(state.monitor.events)), [storage, state.monitor.events])

  const setMaterial = useCallback((material: Material) => dispatch({ type: 'setMaterial', material, now: clockRef.current() }), [])
  const setThreshold = useCallback(
    (material: Material, value: number) => dispatch({ type: 'setThreshold', material, value, now: clockRef.current() }),
    [],
  )
  const acknowledge = useCallback(() => dispatch({ type: 'acknowledge', now: clockRef.current() }), [])
  const resetDemo = useCallback(() => {
    dispatch({ type: 'reset' })
    storage.clear()
    setSaveFailed(false)
    onReset?.()
  }, [storage, onReset])

  const storageMessages = [...loaded.warnings]
  const unavailable = loaded.warnings.some((w) => w.includes('unavailable'))
  if (saveFailed && !unavailable) storageMessages.push('Could not save data to browser storage. Recent changes may be lost on refresh.')

  return { state, now, setMaterial, setThreshold, acknowledge, resetDemo, storageMessages, loaded }
}

/** React binding for the simulator's controllable state; also persists slider values. */
export function useSimulator(provider: SimulatedSensorProvider, storage: StorageService) {
  const sim = useSyncExternalStore(provider.subscribeState, provider.getState)
  useEffect(() => {
    storage.saveSimulator({ humidity: sim.humidity, temperature: sim.temperature })
  }, [storage, sim.humidity, sim.temperature])
  return sim
}

/** React binding for the HTTP sensor provider's connection state. */
export function useHardware(provider: HttpSensorProvider) {
  return useSyncExternalStore(provider.subscribeState, provider.getState)
}
