// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMockEsp32, type MockEsp32 } from '../../../tools/mock-esp32.mjs'
import { HttpSensorProvider } from './httpSensor'
import type { SensorReading } from '../../types'

let mock: MockEsp32
let base: string
let provider: HttpSensorProvider
let got: SensorReading[]

const control = (patch: Record<string, unknown>) =>
  fetch(`${base}/mock/control`, { method: 'POST', body: JSON.stringify(patch) }).then((r) => r.json())
const waitFor = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 10))
  }
}

beforeEach(async () => {
  mock = createMockEsp32({ sampleMs: 20 })
  const port = await mock.listen(0)
  base = `http://127.0.0.1:${port}`
  provider = new HttpSensorProvider({ url: `${base}/api/reading`, pollMs: 25, timeoutMs: 200, staleAfterMs: 400 })
  got = []
  provider.subscribe((r) => got.push(r))
})
afterEach(async () => {
  provider.stop()
  await mock.close()
})

describe('mock ESP32 endpoint over real HTTP', () => {
  it('serves the contract: valid reading flows into the provider', async () => {
    const res = await fetch(`${base}/api/reading`)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(await res.json()).toMatchObject({ deviceId: 'mock-esp32-dry-box-01', humidity: 28, temperature: 24, valid: true })
    provider.start()
    await waitFor(() => got.some((r) => r.humidity === 28))
    expect(provider.getState().connection).toBe('connected')
    await control({ humidity: 55 })
    await waitFor(() => got.some((r) => r.humidity === 55))
  })

  it('invalid: device fault, malformed and out-of-range payloads become unavailable', async () => {
    provider.start()
    await waitFor(() => got.length > 0)
    await control({ valid: false, error: 'DHT11 timeout' })
    await waitFor(() => got.some((r) => r.error === 'DHT11 timeout'))
    await control({ valid: true, corrupt: 'malformed' })
    await waitFor(() => got.some((r) => r.error?.includes('humidity must be a finite number')))
    await control({ corrupt: 'out-of-range' })
    await waitFor(() => got.some((r) => r.error?.includes('outside 0-100')))
    expect(got.some((r) => r.humidity === 140)).toBe(false)
    await control({ corrupt: 'none', humidity: 30 })
    await waitFor(() => got.at(-1)?.humidity === 30)
  })

  it('duplicate: a frozen measurement is forwarded once, then reported stale', async () => {
    await control({ frozen: true })
    provider.start()
    await waitFor(() => provider.getState().connection === 'stale', 3000)
    expect(got.filter((r) => r.humidity !== null)).toHaveLength(1)
    expect(got.filter((r) => r.error?.includes('stale'))).toHaveLength(1)
    await control({ frozen: false, humidity: 20 })
    await waitFor(() => provider.getState().connection === 'connected')
    expect(got.at(-1)?.humidity).toBe(20)
  })

  it('delayed: slower than the timeout disconnects; recovery reconnects', async () => {
    provider.start()
    await waitFor(() => provider.getState().connection === 'connected')
    await control({ delayMs: 600 })
    await waitFor(() => provider.getState().connection === 'disconnected')
    expect(got.at(-1)?.error).toMatch(/no response within 200 ms/)
    await control({ delayMs: 0 })
    await waitFor(() => provider.getState().connection === 'connected', 4000)
  })

  it('disconnect/reconnect: HTTP 503 then recovery; server shutdown is also a disconnect', async () => {
    provider.start()
    await waitFor(() => provider.getState().connection === 'connected')
    await control({ failing: true })
    await waitFor(() => provider.getState().connection === 'disconnected')
    expect(got.at(-1)?.error).toMatch(/HTTP 503/)
    await control({ failing: false })
    await waitFor(() => provider.getState().connection === 'connected')
    await mock.close()
    await waitFor(() => provider.getState().connection === 'disconnected')
  })
})
