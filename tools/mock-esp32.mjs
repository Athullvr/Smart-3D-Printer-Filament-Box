// Mock ESP32 + DHT11 HTTP endpoint for FilamentGuard development. No dependencies.
//   node tools/mock-esp32.mjs            (or: npm run mock:esp32)   -> http://localhost:8787
// This is a SIMULATION of the device contract (docs/hardware-integration.md), not real hardware.
import http from 'node:http'
import { pathToFileURL } from 'node:url'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Cache-Control': 'no-store',
}

export function createMockEsp32({ now = Date.now, sampleMs = 1000, random = Math.random } = {}) {
  const state = {
    deviceId: 'mock-esp32-dry-box-01',
    humidity: 28,
    temperature: 24,
    timestamp: now(),
    valid: true,
    error: undefined,
    auto: false, // random walk on each sample
    frozen: false, // keep returning the same measurement (duplicate / stale)
    failing: false, // answer 503
    delayMs: 0, // delay every response
    corrupt: 'none', // 'none' | 'malformed' | 'out-of-range'
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

  const sample = () => {
    if (state.frozen) return
    if (state.auto) {
      state.humidity = Math.round(clamp(state.humidity + (random() - 0.5) * 6, 10, 70) * 10) / 10
      state.temperature = Math.round(clamp(state.temperature + (random() - 0.5) * 0.8, 18, 32) * 10) / 10
    }
    state.timestamp = now()
  }

  const body = () => {
    if (state.corrupt === 'malformed') return { deviceId: state.deviceId, humidity: 'abc', timestamp: state.timestamp, valid: true }
    if (state.corrupt === 'out-of-range') return { deviceId: state.deviceId, humidity: 140, temperature: 24, timestamp: state.timestamp, valid: true }
    const p = { deviceId: state.deviceId, timestamp: state.timestamp, valid: state.valid }
    return state.valid
      ? { ...p, humidity: state.humidity, temperature: state.temperature }
      : { ...p, humidity: null, temperature: null, error: state.error ?? 'DHT11 read failed' }
  }

  const send = (res, code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...CORS })
    res.end(JSON.stringify(data))
  }

  const readJson = (req) =>
    new Promise((resolve, reject) => {
      let raw = ''
      req.on('data', (c) => { raw += c; if (raw.length > 4096) reject(new Error('too large')) })
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch (e) { reject(e) } })
    })

  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }
    if (req.method === 'GET' && path === '/api/reading') {
      if (state.delayMs > 0) await new Promise((r) => setTimeout(r, state.delayMs))
      if (state.failing) return send(res, 503, { error: 'mock failure' })
      return send(res, 200, body())
    }
    if (req.method === 'GET' && path === '/mock/state') return send(res, 200, state)
    if (req.method === 'POST' && path === '/mock/control') {
      try {
        const patch = await readJson(req)
        const measurementChanged = ['humidity', 'temperature', 'valid', 'error'].some((k) => k in patch)
        for (const k of Object.keys(state)) if (k in patch && k !== 'timestamp') state[k] = patch[k]
        if (measurementChanged && !state.frozen) state.timestamp = Math.max(now(), state.timestamp + 1)
        return send(res, 200, state)
      } catch {
        return send(res, 400, { error: 'invalid JSON' })
      }
    }
    send(res, 404, { error: 'not found' })
  })

  let timer = null
  return {
    state,
    server,
    sample,
    listen(port = 8787, host = '127.0.0.1') {
      return new Promise((resolve) => {
        timer = setInterval(sample, sampleMs)
        timer.unref?.()
        server.listen(port, host, () => resolve(server.address().port))
      })
    },
    close() {
      if (timer) clearInterval(timer)
      return new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()) })
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787)
  const mock = createMockEsp32()
  mock.state.auto = process.env.AUTO !== '0'
  const p = await mock.listen(port)
  console.log(`Mock ESP32 listening on http://127.0.0.1:${p}  (NOT real hardware)`)
  console.log(`  GET  /api/reading        device contract endpoint`)
  console.log(`  GET  /mock/state         inspect mock state`)
  console.log(`  POST /mock/control       JSON patch, e.g.:`)
  console.log(`    curl -X POST localhost:${p}/mock/control -d '{"auto":false,"humidity":55}'   # breach (PLA 35)`)
  console.log(`    curl -X POST localhost:${p}/mock/control -d '{"valid":false,"error":"DHT11 timeout"}'`)
  console.log(`    curl -X POST localhost:${p}/mock/control -d '{"frozen":true}'      # duplicate then stale`)
  console.log(`    curl -X POST localhost:${p}/mock/control -d '{"failing":true}'     # HTTP 503 (disconnect)`)
  console.log(`    curl -X POST localhost:${p}/mock/control -d '{"delayMs":5000}'     # slower than the 3 s timeout`)
  console.log(`    curl -X POST localhost:${p}/mock/control -d '{"corrupt":"malformed"}'  # or "out-of-range" / "none"`)
}
