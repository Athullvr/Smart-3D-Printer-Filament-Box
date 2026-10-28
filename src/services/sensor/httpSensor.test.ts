import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpSensorProvider } from './httpSensor'
import type { SensorReading } from '../../types'

const payload = (over: Record<string, unknown> = {}) => ({ deviceId: 'dev-1', humidity: 30, temperature: 24, timestamp: 1000, valid: true, ...over })
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const slow = (ms: number, body: unknown) => (_u: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((resolve, reject) => {
    const t = setTimeout(() => resolve(ok(body)), ms)
    init?.signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
  })

function setup(opts: { staleAfterMs?: number } = {}) {
  const fetchFn = vi.fn<typeof fetch>()
  const p = new HttpSensorProvider({ url: 'http://dev/api/reading', fetchFn, ...opts })
  const got: SensorReading[] = []
  p.subscribe((r) => got.push(r))
  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)
  return { p, fetchFn, got, advance }
}

describe('HttpSensorProvider', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('emits a validated reading tagged with source, device id and measurement time', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(async () => ok(payload({ humidity: 42.5, timestamp: 777 })))
    p.start()
    await advance(0)
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ humidity: 42.5, temperature: 24, source: 'esp32-dht11', deviceId: 'dev-1', measuredAt: 777 })
    expect(got[0]!.timestamp).toBe(Date.now())
    expect(p.getState()).toMatchObject({ connection: 'connected', deviceId: 'dev-1', lastMeasurementAt: 777, error: null })
    p.stop()
  })

  it.each([
    ['humidity out of range', payload({ humidity: 140 })],
    ['humidity as string', payload({ humidity: 'abc' })],
    ['missing fields', { humidity: 30 }],
    ['not an object', 'oops'],
  ])('rejects malformed reading (%s): unavailable, never safe, and not counted as fresh', async (_n, body) => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(async () => ok(body))
    p.start()
    await advance(0)
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ humidity: null, error: expect.stringContaining('Rejected malformed') })
    expect(p.getState().lastMeasurementAt).toBeNull()
    p.stop()
  })

  it('forwards a device-reported invalid measurement as unavailable with the device error', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(async () => ok(payload({ valid: false, humidity: null, temperature: null, error: 'DHT11 checksum' })))
    p.start()
    await advance(0)
    expect(got[0]).toMatchObject({ humidity: null, error: 'DHT11 checksum', deviceId: 'dev-1' })
    expect(p.getState().connection).toBe('connected')
    p.stop()
  })

  it('does not forward the same measurement twice, but accepts the next new one', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(async () => ok(payload()))
    p.start()
    await advance(0)
    await advance(2000)
    await advance(2000)
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(got).toHaveLength(1)
    fetchFn.mockImplementation(async () => ok(payload({ timestamp: 2000, humidity: 31 })))
    await advance(2000)
    expect(got).toHaveLength(2)
    p.stop()
  })

  it('accepts a delayed response that arrives within the timeout', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(slow(2500, payload()))
    p.start()
    await advance(2400)
    expect(got).toHaveLength(0)
    await advance(200)
    expect(got).toHaveLength(1)
    expect(p.getState().connection).toBe('connected')
    p.stop()
  })

  it('times out slow responses as disconnected and ignores any late data', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(slow(10_000, payload()))
    p.start()
    await advance(3100)
    expect(p.getState().connection).toBe('disconnected')
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ humidity: null, error: expect.stringContaining('no response within 3000 ms') })
    await advance(1000)
    expect(got.filter((r) => r.humidity !== null)).toHaveLength(0)
    p.stop()
  })

  it('treats HTTP errors and non-JSON bodies as disconnected', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockResolvedValueOnce(new Response('x', { status: 503 }))
    p.start()
    await advance(0)
    expect(got[0]?.error).toMatch(/HTTP 503/)
    fetchFn.mockResolvedValueOnce(new Response('<html>', { status: 200 }))
    await advance(2000)
    expect(got[1]?.error).toMatch(/not valid JSON/)
    expect(p.getState().connection).toBe('disconnected')
    p.stop()
  })

  it('disconnects, then reconnects on the next new measurement', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockResolvedValueOnce(ok(payload()))
    p.start()
    await advance(0)
    fetchFn.mockRejectedValue(new TypeError('Failed to fetch'))
    await advance(2000)
    expect(p.getState().connection).toBe('disconnected')
    expect(got.at(-1)).toMatchObject({ humidity: null, error: expect.stringContaining('Cannot reach') })
    fetchFn.mockImplementation(async () => ok(payload({ timestamp: 3000, humidity: 22 })))
    await advance(2000)
    expect(p.getState()).toMatchObject({ connection: 'connected', error: null })
    expect(got.at(-1)).toMatchObject({ humidity: 22 })
    p.stop()
  })

  it('detects stale data when the device keeps returning the same measurement, once, and recovers', async () => {
    const { p, fetchFn, got, advance } = setup({ staleAfterMs: 10_000 })
    fetchFn.mockImplementation(async () => ok(payload()))
    p.start()
    await advance(0)
    await advance(8000)
    expect(p.getState().connection).toBe('connected')
    await advance(4000)
    expect(p.getState().connection).toBe('stale')
    const stale = got.filter((r) => r.error?.includes('stale'))
    expect(stale).toHaveLength(1)
    expect(stale[0]!.humidity).toBeNull()
    await advance(6000)
    expect(got.filter((r) => r.error?.includes('stale'))).toHaveLength(1)
    fetchFn.mockImplementation(async () => ok(payload({ timestamp: 9999, humidity: 18 })))
    await advance(2000)
    expect(p.getState().connection).toBe('connected')
    expect(got.at(-1)).toMatchObject({ humidity: 18 })
    p.stop()
  })

  it('reports stale (not connected) if the endpoint returns the old measurement after a long outage', async () => {
    const { p, fetchFn, advance } = setup()
    fetchFn.mockResolvedValueOnce(ok(payload()))
    p.start()
    await advance(0)
    fetchFn.mockRejectedValue(new TypeError('down'))
    await advance(12_000)
    fetchFn.mockImplementation(async () => ok(payload()))
    await advance(2000)
    expect(p.getState().connection).toBe('stale')
    p.stop()
  })

  it('stop() halts polling and discards in-flight responses; restart works', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(slow(1000, payload()))
    p.start()
    await advance(500)
    p.stop()
    await advance(5000)
    expect(got).toHaveLength(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(p.getState().connection).toBe('idle')
    fetchFn.mockImplementation(async () => ok(payload({ timestamp: 5 })))
    p.start(); p.start()
    await advance(0)
    expect(got).toHaveLength(1)
    p.stop()
  })

  it('never overlaps polls', async () => {
    const { p, fetchFn, advance } = setup()
    fetchFn.mockImplementation(slow(2900, payload()))
    p.start()
    await advance(2800)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    p.stop()
  })

  it('setUrl validates, restarts polling, and clears dedupe memory', async () => {
    const { p, fetchFn, got, advance } = setup()
    fetchFn.mockImplementation(async () => ok(payload()))
    p.start()
    await advance(0)
    expect(p.setUrl('ftp://nope')).toBe(false)
    expect(p.getState().url).toBe('http://dev/api/reading')
    expect(p.setUrl('http://other/api/reading')).toBe(true)
    await advance(0)
    expect(fetchFn).toHaveBeenLastCalledWith('http://other/api/reading', expect.anything())
    expect(got).toHaveLength(2)
    p.stop()
  })
})
