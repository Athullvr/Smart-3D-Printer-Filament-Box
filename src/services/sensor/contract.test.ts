import { describe, expect, it } from 'vitest'
import { isValidEndpointUrl, parseDeviceReading } from './contract'

const good = { deviceId: 'dry-box-01', humidity: 31.5, temperature: 24.1, timestamp: 1_730_000_000_000, valid: true }

describe('device reading contract', () => {
  it('accepts a valid reading, including range boundaries', () => {
    expect(parseDeviceReading(good)).toEqual({ ok: true, payload: good })
    for (const humidity of [0, 100]) expect(parseDeviceReading({ ...good, humidity }).ok).toBe(true)
  })
  it('accepts valid:false with null values and a default or provided error', () => {
    const r = parseDeviceReading({ deviceId: 'a', timestamp: 5, valid: false, humidity: null, temperature: null, error: 'DHT11 timeout' })
    expect(r).toMatchObject({ ok: true, payload: { valid: false, humidity: null, error: 'DHT11 timeout' } })
    expect(parseDeviceReading({ deviceId: 'a', timestamp: 5, valid: false })).toMatchObject({ ok: true, payload: { error: expect.any(String) } })
  })
  it.each([
    ['not an object', 'hello'], ['null', null], ['array', []],
    ['missing deviceId', { ...good, deviceId: undefined }], ['empty deviceId', { ...good, deviceId: ' ' }],
    ['bad timestamp (string)', { ...good, timestamp: '1' }], ['bad timestamp (zero)', { ...good, timestamp: 0 }], ['bad timestamp (float)', { ...good, timestamp: 1.5 }],
    ['missing valid', { ...good, valid: undefined }], ['valid as string', { ...good, valid: 'true' }],
    ['humidity string', { ...good, humidity: '30' }], ['humidity null while valid', { ...good, humidity: null }],
    ['humidity NaN', { ...good, humidity: NaN }], ['humidity > 100', { ...good, humidity: 100.1 }], ['humidity < 0', { ...good, humidity: -1 }],
    ['temperature missing', { ...good, temperature: undefined }], ['temperature too high', { ...good, temperature: 500 }],
  ])('rejects %s', (_n, payload) => {
    const r = parseDeviceReading(payload)
    expect(r.ok).toBe(false)
  })
  it('validates endpoint URLs', () => {
    expect(isValidEndpointUrl('http://192.168.1.50/api/reading')).toBe(true)
    expect(isValidEndpointUrl('javascript:alert(1)')).toBe(false)
    expect(isValidEndpointUrl('not a url')).toBe(false)
  })
})
