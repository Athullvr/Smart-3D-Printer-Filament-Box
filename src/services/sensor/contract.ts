import { HUMIDITY_RANGE, TEMPERATURE_RANGE } from '../../features/monitoring/engine'

/**
 * Sensor reading contract: what a device (real or mock ESP32) returns from `GET /api/reading`.
 * Full documentation: docs/hardware-integration.md
 *
 *   {
 *     "deviceId": "dry-box-01",       // non-empty string, max 64 chars
 *     "humidity": 31.5,               // % RH, finite number 0-100 (null allowed only when valid=false)
 *     "temperature": 24.1,            // degrees Celsius, finite number -40..125 (null allowed only when valid=false)
 *     "timestamp": 1730000000000,     // measurement time, epoch milliseconds, positive integer
 *     "valid": true,                  // false when the device could not take a valid measurement
 *     "error": "DHT11 checksum"       // optional, human-readable, only meaningful when valid=false
 *   }
 */
export interface DeviceReadingPayload {
  deviceId: string
  humidity: number | null
  temperature: number | null
  timestamp: number
  valid: boolean
  error?: string
}

export type ParseResult = { ok: true; payload: DeviceReadingPayload } | { ok: false; error: string }

export const DEVICE_READING_PATH = '/api/reading'
const MAX_ID = 64
const MAX_ERROR = 200

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const bad = (error: string): ParseResult => ({ ok: false, error: `Rejected malformed reading: ${error}` })

export function parseDeviceReading(raw: unknown): ParseResult {
  if (!isObj(raw)) return bad('payload is not a JSON object.')
  if (typeof raw.deviceId !== 'string' || raw.deviceId.trim() === '' || raw.deviceId.length > MAX_ID) return bad('deviceId must be a non-empty string (max 64 chars).')
  if (!fin(raw.timestamp) || raw.timestamp <= 0 || !Number.isInteger(raw.timestamp)) return bad('timestamp must be a positive integer (epoch ms).')
  if (typeof raw.valid !== 'boolean') return bad('valid must be a boolean.')
  const deviceId = raw.deviceId
  const timestamp = raw.timestamp
  const error = typeof raw.error === 'string' ? raw.error.slice(0, MAX_ERROR) : undefined

  if (!raw.valid) {
    return { ok: true, payload: { deviceId, timestamp, valid: false, humidity: null, temperature: null, error: error ?? 'Device reported an invalid measurement.' } }
  }
  const { humidity, temperature } = raw
  if (!fin(humidity)) return bad('humidity must be a finite number.')
  if (humidity < HUMIDITY_RANGE.min || humidity > HUMIDITY_RANGE.max) return bad(`humidity ${humidity} is outside 0-100 % RH.`)
  if (!fin(temperature)) return bad('temperature must be a finite number.')
  if (temperature < TEMPERATURE_RANGE.min || temperature > TEMPERATURE_RANGE.max) return bad(`temperature ${temperature} is outside ${TEMPERATURE_RANGE.min}..${TEMPERATURE_RANGE.max} C.`)
  return { ok: true, payload: { deviceId, timestamp, valid: true, humidity, temperature } }
}

export function isValidEndpointUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
