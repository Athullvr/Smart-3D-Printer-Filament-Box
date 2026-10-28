import type { Material, Settings, ThresholdMap } from '../../types'

/** Provisional demonstration values - NOT universal safety limits. */
export const DEFAULT_THRESHOLDS: ThresholdMap = { PLA: 35, PETG: 25, TPU: 20, Nylon: 15 }

export const THRESHOLD_MIN = 1
export const THRESHOLD_MAX = 100

export const createDefaultSettings = (): Settings => ({
  material: 'PLA',
  thresholds: { ...DEFAULT_THRESHOLDS },
})

export const isValidThreshold = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= THRESHOLD_MIN && v <= THRESHOLD_MAX

export const getThreshold = (s: Settings, m: Material = s.material): number => s.thresholds[m]
