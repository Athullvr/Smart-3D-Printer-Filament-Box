import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { SimulatedSensorProvider } from '../services/sensor/simulatedSensor'
import { HttpSensorProvider } from '../services/sensor/httpSensor'
import { createStorageService } from '../services/storage/storage'
import { MemoryBackend } from '../test/helpers'

type Body = Record<string, unknown> | 'fail'
let body: Body
let ts: number
const fetchFn = vi.fn<typeof fetch>(async () => {
  if (body === 'fail') throw new TypeError('Failed to fetch')
  return new Response(JSON.stringify(body), { status: 200 })
})
const measurement = (humidity: number, extra: Record<string, unknown> = {}) => {
  body = { deviceId: 'mock-esp32', humidity, temperature: 23, timestamp: ++ts, valid: true, ...extra }
}
const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

function mount(backend = new MemoryBackend()) {
  const storage = createStorageService(backend)
  const sensor = new SimulatedSensorProvider({ initial: storage.load().simulator })
  const hardware = new HttpSensorProvider({ url: storage.load().connection.endpointUrl, fetchFn })
  return { backend, sensor, hardware, ...render(<App sensor={sensor} hardware={hardware} storage={storage} />) }
}
const status = () => screen.getByTestId('status-banner').getAttribute('data-status')
const rows = () => screen.queryAllByTestId('event-row')
const toHardware = async () => { fireEvent.click(screen.getByRole('radio', { name: /hardware/i })); await flush() }
const toSimulation = async () => { fireEvent.click(screen.getByRole('radio', { name: /simulation/i })); await flush() }

beforeEach(() => {
  vi.useFakeTimers()
  ts = 1_000
  fetchFn.mockClear()
  measurement(20)
})
afterEach(() => vi.useRealTimers())

describe('hardware mode', () => {
  it('starts in simulation mode; hardware mode hides simulator-only controls and labels the mode honestly', async () => {
    mount()
    expect(screen.getByText('SIMULATION MODE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trigger breach/i })).toBeInTheDocument()
    expect(fetchFn).not.toHaveBeenCalled()

    await toHardware()
    expect(screen.getByText('HARDWARE MODE (UNVERIFIED)')).toBeInTheDocument()
    expect(screen.queryByText('SIMULATION MODE')).not.toBeInTheDocument()
    for (const name of [/trigger breach/i, /set safe/i, /high humidity/i, /sensor fault/i, /start auto/i]) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Humidity/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/sensor endpoint/i)).toBeInTheDocument()
    expect(screen.getByText(/no real esp32 or dht11 has been verified/i)).toBeInTheDocument()
    expect(screen.queryByText(/all data is simulated/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('HARDWARE FEED')).toHaveLength(2)
    expect(status()).toBe('safe')
    expect(screen.getByTestId('connection-state')).toHaveAttribute('data-state', 'connected')
    expect(screen.getByTestId('device-id')).toHaveTextContent('mock-esp32')
  })

  it('runs the breach lifecycle from hardware readings without duplicates; ack is dashboard-only', async () => {
    mount()
    await toHardware()
    measurement(50)
    await flush(2000)
    expect(status()).toBe('breach')
    expect(rows()).toHaveLength(1)
    for (let i = 0; i < 3; i++) await flush(2000) // same measurement re-delivered
    expect(rows()).toHaveLength(1)
    expect(screen.getByText(/Dashboard alert: ACTIVE/)).toBeInTheDocument()
    expect(screen.getByText(/only affects this dashboard/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /acknowledge alert/i }))
    expect(screen.getByTestId('buzzer-state')).toHaveAttribute('data-active', 'false')
    expect(status()).toBe('breach')

    measurement(62)
    await flush(2000)
    expect(within(rows()[0]!).getByText('62.0% RH')).toBeInTheDocument()
    expect(rows()).toHaveLength(1)

    measurement(30)
    await flush(2000)
    expect(status()).toBe('safe')
    expect(rows()[0]).not.toHaveTextContent('Active')
    expect(rows()[0]).toHaveTextContent('62.0% RH')
  })

  it('shows disconnected, then reconnected; never safe while the device is unreachable', async () => {
    mount()
    await toHardware()
    expect(status()).toBe('safe')
    body = 'fail'
    await flush(2000)
    expect(status()).toBe('unavailable')
    expect(screen.getByText('SENSOR DISCONNECTED')).toBeInTheDocument()
    expect(screen.getByTestId('connection-state')).toHaveAttribute('data-state', 'disconnected')
    expect(screen.getByTestId('humidity-value')).toHaveTextContent('--')
    expect(screen.getByTestId('device-error')).toHaveTextContent(/Cannot reach/)
    measurement(22)
    await flush(2000)
    expect(status()).toBe('safe')
    expect(screen.getByTestId('connection-state')).toHaveAttribute('data-state', 'connected')
  })

  it('shows stale data explicitly when the device stops producing new measurements', async () => {
    mount()
    await toHardware()
    await flush(12_000)
    expect(status()).toBe('unavailable')
    expect(screen.getByText('SENSOR DATA STALE')).toBeInTheDocument()
    expect(screen.getByTestId('connection-state')).toHaveAttribute('data-state', 'stale')
    measurement(21)
    await flush(2000)
    expect(status()).toBe('safe')
  })

  it('rejects malformed and out-of-range payloads without marking safe or opening events', async () => {
    mount()
    await toHardware()
    body = { deviceId: 'mock-esp32', humidity: 150, temperature: 23, timestamp: 9999, valid: true }
    await flush(2000)
    expect(status()).toBe('unavailable')
    expect(screen.getByText('SENSOR DATA ERROR')).toBeInTheDocument()
    expect(screen.getAllByText(/Rejected malformed/).length).toBeGreaterThan(0)
    body = { humidity: 'wet' }
    await flush(2000)
    expect(status()).toBe('unavailable')
    expect(rows()).toHaveLength(0)
  })

  it('a device-reported invalid measurement is an error, not safe', async () => {
    mount()
    await toHardware()
    body = { deviceId: 'mock-esp32', timestamp: 5000, valid: false, humidity: null, temperature: null, error: 'DHT11 timeout' }
    await flush(2000)
    expect(status()).toBe('unavailable')
    expect(screen.getAllByText(/DHT11 timeout/).length).toBeGreaterThan(0)
  })

  it('validates the endpoint URL and applies a valid one', async () => {
    const { hardware } = mount()
    await toHardware()
    const input = screen.getByLabelText(/sensor endpoint/i)
    fireEvent.change(input, { target: { value: 'ftp://nope' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/valid http/i)
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    fireEvent.change(input, { target: { value: 'http://192.168.1.50/api/reading' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await flush()
    expect(hardware.getState().url).toBe('http://192.168.1.50/api/reading')
    expect(fetchFn).toHaveBeenLastCalledWith('http://192.168.1.50/api/reading', expect.anything())
  })
})

describe('switching between simulation and hardware', () => {
  it('closes an open simulated event on switch, keeps history, tags sources, and resumes simulation', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Active')

    await toHardware()
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).not.toHaveTextContent('Active')
    expect(status()).toBe('safe')
    expect(screen.queryByTestId('buzzer-state')).not.toBeInTheDocument()

    measurement(50)
    await flush(2000)
    expect(rows()).toHaveLength(2)
    expect(rows()[0]).toHaveTextContent('EVT-0002')

    await toSimulation()
    expect(rows()[1]).toHaveTextContent('EVT-0002')
    expect(rows()[1]).not.toHaveTextContent('Active')
    const callsAfterSwitch = fetchFn.mock.calls.length
    await flush(10_000)
    expect(fetchFn.mock.calls.length).toBe(callsAfterSwitch)
    expect(screen.getByText('SIMULATION MODE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trigger breach/i })).toBeInTheDocument()
    expect(status()).toBe('breach')
    expect(rows()).toHaveLength(3)
    expect(rows()[0]).toHaveTextContent('EVT-0003')
    expect(rows()[0]).toHaveTextContent('Active')
  })

  it('clears chart samples on switch so sources are never mixed', async () => {
    mount()
    expect(screen.getByTestId('humidity-chart')).toBeInTheDocument()
    await toHardware()
    measurement(20)
    expect(screen.getByText(/Humidity history \(0\)/)).toBeInTheDocument()
  })

  it('persists the mode and endpoint across refresh and keeps them through Reset demo', async () => {
    const backend = new MemoryBackend()
    const first = mount(backend)
    await toHardware()
    first.unmount()
    mount(backend)
    await flush()
    expect(screen.getByText('HARDWARE MODE (UNVERIFIED)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reset demo data/i }))
    fireEvent.click(screen.getByRole('button', { name: /erase and reset/i }))
    await flush()
    expect(screen.getByText('HARDWARE MODE (UNVERIFIED)')).toBeInTheDocument()
  })

  it('refresh during an active hardware breach restores the event without duplicating it', async () => {
    const backend = new MemoryBackend()
    const first = mount(backend)
    await toHardware()
    measurement(50)
    await flush(2000)
    expect(rows()).toHaveLength(1)
    first.unmount()
    mount(backend)
    await flush(2000)
    expect(status()).toBe('breach')
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Active')
  })

  it('without a hardware provider the app is simulation-only (no source toggle)', () => {
    const storage = createStorageService(new MemoryBackend())
    render(<App sensor={new SimulatedSensorProvider()} storage={storage} />)
    expect(screen.queryByRole('radiogroup', { name: /data source/i })).not.toBeInTheDocument()
    expect(screen.getByText('SIMULATION MODE')).toBeInTheDocument()
  })
})
