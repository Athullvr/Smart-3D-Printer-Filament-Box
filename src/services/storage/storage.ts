import { MATERIALS, type BreachEvent, type Material, type Sample, type Settings } from '../../types'
import { createDefaultSettings, isValidThreshold } from '../../features/settings/defaults'

export const MAX_SAMPLES = 120
export const MAX_EVENTS = 500

export interface SimulatorSnapshot {
  humidity: number
  temperature: number
}

export interface LoadedData {
  settings: Settings
  samples: Sample[]
  events: BreachEvent[]
  simulator: Partial<SimulatorSnapshot>
  warnings: string[]
}

/** Persistence contract. localStorage today; swap for IndexedDB/cloud later. */
export interface StorageService {
  load(): LoadedData
  saveSettings(s: Settings): boolean
  saveSamples(s: Sample[]): boolean
  saveEvents(e: BreachEvent[]): boolean
  saveSimulator(s: SimulatorSnapshot): boolean
  clear(): boolean
}

/** Subset of the Web Storage API we depend on. */
export interface KeyValueBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEYS = {
  settings: 'filamentguard:v1:settings',
  samples: 'filamentguard:v1:samples',
  events: 'filamentguard:v1:events',
  simulator: 'filamentguard:v1:simulator',
} as const

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isMaterial = (v: unknown): v is Material => MATERIALS.includes(v as Material)

export function parseSettings(raw: unknown): Settings {
  const d = createDefaultSettings()
  if (!isObj(raw)) return d
  const thresholds = { ...d.thresholds }
  if (isObj(raw.thresholds)) for (const m of MATERIALS) if (isValidThreshold(raw.thresholds[m])) thresholds[m] = raw.thresholds[m]
  return { material: isMaterial(raw.material) ? raw.material : d.material, thresholds }
}

export function parseSample(v: unknown): Sample | null {
  if (!isObj(v) || !isNum(v.timestamp) || !isNum(v.humidity) || v.humidity < 0 || v.humidity > 100) return null
  return { timestamp: v.timestamp, humidity: v.humidity, temperature: isNum(v.temperature) ? v.temperature : null }
}

export function parseEvent(v: unknown): BreachEvent | null {
  if (!isObj(v)) return null
  if (typeof v.id !== 'string' || !v.id || !isNum(v.startedAt) || !isNum(v.peakHumidity) || !isMaterial(v.material) || !isNum(v.threshold)) return null
  if (v.state !== 'active' && v.state !== 'closed') return null
  if (v.state === 'closed' && !isNum(v.endedAt)) return null
  return {
    id: v.id,
    startedAt: v.startedAt,
    endedAt: v.state === 'closed' ? (v.endedAt as number) : null,
    peakHumidity: v.peakHumidity,
    material: v.material,
    threshold: v.threshold,
    acknowledged: v.acknowledged === true,
    acknowledgedAt: isNum(v.acknowledgedAt) ? v.acknowledgedAt : null,
    state: v.state,
  }
}

/** Drop duplicates, sort newest first, and guarantee at most one active event. */
function normalizeEvents(events: BreachEvent[]): BreachEvent[] {
  const seen = new Set<string>()
  const sorted = events.filter((e) => !seen.has(e.id) && !!seen.add(e.id)).sort((a, b) => b.startedAt - a.startedAt)
  let activeSeen = false
  return sorted.map((e, i) => {
    if (e.state !== 'active') return e
    if (!activeSeen) {
      activeSeen = true
      return e
    }
    return { ...e, state: 'closed', endedAt: sorted[i - 1]?.startedAt ?? e.startedAt }
  })
}

export function createStorageService(backend: KeyValueBackend | null): StorageService {
  const read = (key: string, warnings: string[]): unknown => {
    if (!backend) return undefined
    try {
      const raw = backend.getItem(key)
      return raw === null ? undefined : JSON.parse(raw)
    } catch {
      warnings.push(`Stored "${key.split(':').pop()}" data was unreadable and has been ignored.`)
      return undefined
    }
  }
  const write = (key: string, value: unknown): boolean => {
    if (!backend) return false
    try {
      backend.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  return {
    load() {
      const warnings: string[] = []
      if (!backend) warnings.push('Browser storage is unavailable. Data will not persist after refresh.')
      const settings = parseSettings(read(KEYS.settings, warnings))

      const rawSamples = read(KEYS.samples, warnings)
      const samples = Array.isArray(rawSamples)
        ? rawSamples.map(parseSample).filter((s): s is Sample => s !== null).sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_SAMPLES)
        : []

      const rawEvents = read(KEYS.events, warnings)
      let events: BreachEvent[] = []
      if (Array.isArray(rawEvents)) {
        const parsed = rawEvents.map(parseEvent).filter((e): e is BreachEvent => e !== null)
        if (parsed.length < rawEvents.length) warnings.push(`${rawEvents.length - parsed.length} malformed stored event(s) were discarded.`)
        events = normalizeEvents(parsed)
      }

      const rawSim = read(KEYS.simulator, warnings)
      const simulator: Partial<SimulatorSnapshot> = {}
      if (isObj(rawSim)) {
        if (isNum(rawSim.humidity)) simulator.humidity = rawSim.humidity
        if (isNum(rawSim.temperature)) simulator.temperature = rawSim.temperature
      }
      return { settings, samples, events, simulator, warnings }
    },
    saveSettings: (s) => write(KEYS.settings, s),
    saveSamples: (s) => write(KEYS.samples, s.slice(-MAX_SAMPLES)),
    saveEvents: (e) => write(KEYS.events, e.slice(0, MAX_EVENTS)),
    saveSimulator: (s) => write(KEYS.simulator, s),
    clear() {
      if (!backend) return false
      try {
        Object.values(KEYS).forEach((k) => backend.removeItem(k))
        return true
      } catch {
        return false
      }
    },
  }
}

/** Resolves browser localStorage if usable, otherwise null (private mode, blocked, SSR). */
export function getBrowserBackend(): KeyValueBackend | null {
  try {
    const ls = window.localStorage
    const probe = 'filamentguard:probe'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return null
  }
}
