import { StrictMode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { SimulatedSensorProvider } from '../services/sensor/simulatedSensor'
import { createStorageService } from '../services/storage/storage'
import { MemoryBackend } from '../test/helpers'

let clockNow = 1_700_000_000_000
const clock = () => clockNow

function mount(backend = new MemoryBackend(), opts: { strict?: boolean } = {}) {
  const storage = createStorageService(backend)
  const sensor = new SimulatedSensorProvider({ now: clock, initial: storage.load().simulator })
  const el = <App sensor={sensor} storage={storage} clock={clock} />
  const utils = render(opts.strict ? <StrictMode>{el}</StrictMode> : el)
  return { backend, sensor, storage, ...utils }
}
const slider = () => screen.getByLabelText(/^Humidity/) as HTMLInputElement
const setH = (v: number) => fireEvent.change(slider(), { target: { value: String(v) } })
const status = () => screen.getByTestId('status-banner').getAttribute('data-status')
const rows = () => screen.queryAllByTestId('event-row')

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('dashboard basics', () => {
  it('shows branding, device, simulation indicator, safe state and empty states', () => {
    mount()
    expect(screen.getByRole('heading', { level: 1, name: 'Your filament. Protected.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /filamentguard/i })).toBeInTheDocument()
    expect(screen.getByText('Smart Filament Storage Monitor')).toBeInTheDocument()
    expect(screen.getByText('Dry Box Unit 01')).toBeInTheDocument()
    expect(screen.getByText('SIMULATION MODE')).toBeInTheDocument()
    expect(status()).toBe('safe')
    expect(screen.getByTestId('events-empty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled()
  })
})

describe('breach lifecycle through the UI', () => {
  it('creates one event, acknowledges without stopping monitoring, then closes', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(status()).toBe('breach')
    expect(rows()).toHaveLength(1)
    expect(screen.getByTestId('buzzer-state')).toHaveAttribute('data-active', 'true')

    await user.click(screen.getByRole('button', { name: /acknowledge alert/i }))
    expect(screen.getByTestId('buzzer-state')).toHaveAttribute('data-active', 'false')
    expect(status()).toBe('breach')

    setH(60)
    expect(rows()).toHaveLength(1)
    expect(within(rows()[0]!).getByText('60.0% RH')).toBeInTheDocument()
    expect(within(rows()[0]!).getByText('Yes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /set safe/i }))
    expect(status()).toBe('safe')
    expect(within(rows()[0]!).queryByText('Active')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(rows()).toHaveLength(2)
  })

  it('does not duplicate events under React Strict Mode', async () => {
    const user = userEvent.setup()
    mount(new MemoryBackend(), { strict: true })
    await user.click(screen.getByRole('button', { name: /high humidity/i }))
    setH(81)
    expect(rows()).toHaveLength(1)
  })

  it('material change re-evaluates the current reading; events keep original material', async () => {
    const user = userEvent.setup()
    mount()
    setH(30)
    expect(status()).toBe('safe')
    await user.selectOptions(screen.getByLabelText('Stored material'), 'Nylon')
    expect(status()).toBe('breach')
    expect(rows()[0]).toHaveTextContent('Nylon')
    await user.selectOptions(screen.getByLabelText('Stored material'), 'PLA')
    expect(status()).toBe('safe')
    expect(rows()[0]).toHaveTextContent('Nylon')
    expect(rows()[0]).toHaveTextContent('(>15%)')
  })

  it('shows an error state (not safe) when sensor data is unavailable', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /sensor fault/i }))
    expect(status()).toBe('unavailable')
    expect(screen.getByText('SENSOR DATA ERROR')).toBeInTheDocument()
    expect(screen.getByTestId('humidity-value')).toHaveTextContent('--')
  })
})

describe('persistence', () => {
  it('12. event history and an active breach survive a refresh without duplicating', async () => {
    const backend = new MemoryBackend()
    const first = mount(backend)
    setH(50)
    fireEvent.click(screen.getByRole('button', { name: /acknowledge alert/i }))
    first.unmount()

    mount(backend) // "refresh": new provider/state from storage; simulator restored at 50%
    expect(status()).toBe('breach')
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('EVT-0001')
    expect(rows()[0]).toHaveTextContent('Active')
    expect(screen.getByTestId('buzzer-state')).toHaveAttribute('data-active', 'false')
  })

  it('persists material and thresholds across refresh', async () => {
    const user = userEvent.setup()
    const backend = new MemoryBackend()
    const first = mount(backend)
    await user.selectOptions(screen.getByLabelText('Stored material'), 'TPU')
    const input = screen.getByLabelText('PETG')
    await user.clear(input)
    await user.type(input, '27')
    await user.tab()
    first.unmount()
    mount(backend)
    expect(screen.getByLabelText('Stored material')).toHaveValue('TPU')
    expect(screen.getByLabelText('PETG')).toHaveValue(27)
  })

  it('survives corrupt stored data', () => {
    const backend = new MemoryBackend()
    backend.setItem('filamentguard:v1:events', 'garbage{')
    backend.setItem('filamentguard:v1:settings', '42')
    mount(backend)
    expect(screen.getByTestId('storage-warning')).toBeInTheDocument()
    expect(status()).toBe('safe')
  })

  it('warns when storage is unavailable but keeps working', async () => {
    const storage = createStorageService(null)
    const sensor = new SimulatedSensorProvider({ now: clock })
    render(<App sensor={sensor} storage={storage} clock={clock} />)
    expect(screen.getByTestId('storage-warning')).toHaveTextContent(/unavailable/i)
    fireEvent.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(rows()).toHaveLength(1)
  })

  it('warns when saving fails', () => {
    const backend = new MemoryBackend()
    backend.setItem = () => { throw new Error('quota') }
    mount(backend)
    expect(screen.getByTestId('storage-warning')).toHaveTextContent(/could not save/i)
  })
})

describe('thresholds', () => {
  it('rejects invalid threshold input and reverts', async () => {
    const user = userEvent.setup()
    mount()
    const input = screen.getByLabelText('PLA')
    await user.clear(input)
    await user.type(input, '150')
    expect(screen.getByRole('alert')).toHaveTextContent(/1 to 100/)
    await user.tab()
    expect(screen.getByLabelText('PLA')).toHaveValue(35)
  })
  it('applying a new threshold re-evaluates the reading', async () => {
    const user = userEvent.setup()
    mount()
    setH(30)
    const input = screen.getByLabelText('PLA')
    await user.clear(input)
    await user.type(input, '29')
    await user.tab()
    expect(status()).toBe('breach')
  })
})

describe('simulation controls', () => {
  it('14. automatic simulation starts and stops from the UI', () => {
    vi.useFakeTimers()
    const { sensor } = mount()
    fireEvent.click(screen.getByRole('button', { name: /start auto/i }))
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
    const spy = vi.fn()
    sensor.subscribe(spy)
    act(() => void vi.advanceTimersByTime(3000))
    expect(spy).toHaveBeenCalledTimes(3)
    fireEvent.click(screen.getByRole('button', { name: /stop auto/i }))
    expect(screen.getByText('OFF')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(3000))
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('15. reset demo asks for confirmation, and erases events, history, settings and storage', async () => {
    const user = userEvent.setup()
    const { backend } = mount()
    await user.selectOptions(screen.getByLabelText('Stored material'), 'TPU')
    await user.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(rows()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /reset demo/i }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(rows()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /reset demo/i }))
    await user.click(screen.getByRole('button', { name: /erase and reset/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('events-empty')).toBeInTheDocument()
    expect(screen.getByLabelText('Stored material')).toHaveValue('PLA')
    expect(status()).toBe('safe')
    expect(JSON.parse(backend.getItem('filamentguard:v1:events')!)).toEqual([])
  })
})

describe('accessibility', () => {
  it('reset dialog: focuses inside, traps Tab, closes on Escape and restores focus', async () => {
    const user = userEvent.setup()
    mount()
    const trigger = screen.getByRole('button', { name: /reset demo/i })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Reset demo?')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.tab(); await user.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
  it('exposes labelled controls, a skip link, and per-cell labels for the stacked event layout', async () => {
    mount()
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main')
    expect(screen.getByLabelText('Stored material')).toBeInTheDocument()
    expect(slider()).toHaveAttribute('aria-valuetext')
    fireEvent.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(within(rows()[0]!).getAllByRole('cell').map((c) => c.getAttribute('data-label'))).toEqual(
      ['Event', 'Start', 'End', 'Duration', 'Peak', 'Material', 'Acknowledged'])
    expect(screen.getByTestId('status-banner')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('Filament Lab redesign', () => {
  it('has the six-item primary navigation with an active state that follows clicks', async () => {
    const user = userEvent.setup()
    mount()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const labels = within(nav).getAllByRole('link').map((a) => a.textContent)
    expect(labels).toEqual(['Dashboard', 'Live Monitor', 'Events', 'Device', 'Settings', 'About'])
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'location')
    await user.click(within(nav).getByRole('link', { name: 'Events' }))
    expect(within(nav).getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'location')
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
    for (const id of ['dashboard', 'monitor', 'events', 'device', 'settings', 'about']) expect(document.getElementById(id)).not.toBeNull()
  })

  it('states honestly that simulation mode has no physical sensor', () => {
    mount()
    expect(screen.getByTestId('mode-explainer')).toHaveTextContent(/no physical sensor is connected/i)
    expect(screen.getByText(/schematic illustration, not a photo of the prototype/i)).toBeInTheDocument()
  })

  it('dry-box illustration and box check follow the monitoring state, never showing invalid data as safe', async () => {
    const user = userEvent.setup()
    mount()
    const ill = () => screen.getByTestId('drybox-illustration').getAttribute('data-status')
    expect(ill()).toBe('safe')
    await user.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(ill()).toBe('breach')
    expect(screen.getByTestId('drybox-state')).toHaveTextContent('Over the limit')
    await user.click(screen.getByRole('button', { name: /sensor fault/i }))
    expect(ill()).toBe('unavailable')
    expect(screen.getByTestId('drybox-state')).toHaveTextContent('Reading unavailable')
    expect(screen.getByTestId('drybox-illustration')).toHaveAccessibleName(/reading unavailable/i)
  })

  it('shows the selected material profile and provisional limit', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.getByTestId('selected-material-summary')).toHaveTextContent('PLA')
    expect(screen.getByTestId('selected-material-summary')).toHaveTextContent('35% RH')
    expect(screen.getByTestId('selected-material-summary')).toHaveTextContent(/provisional/i)
    await user.selectOptions(screen.getByLabelText('Stored material'), 'Nylon')
    expect(screen.getByTestId('selected-material-summary')).toHaveTextContent('15% RH')
  })

  it('uses distinct non-colour cues per status (title text and dashed border for errors)', async () => {
    const user = userEvent.setup()
    mount()
    const banner = screen.getByTestId('status-banner')
    expect(banner).toHaveTextContent('SAFE')
    await user.click(screen.getByRole('button', { name: /sensor fault/i }))
    expect(banner).toHaveTextContent('SENSOR DATA ERROR')
    expect(banner.className).toContain('border-dashed')
  })
})

describe('CSV export', () => {
  it('13. downloads a CSV containing the recorded event', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: /trigger breach/i }))
    let captured: Blob | null = null
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => ((captured = b as Blob), 'blob:test'))
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    expect(captured).not.toBeNull()
    const blob = captured as unknown as Blob
    const text = await new Promise<string>((res) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.readAsText(blob)
    })
    expect(text).toContain('event_id,state,start_time_iso')
    expect(text).toContain('EVT-0001,active,')
    expect(text).toContain(',PLA,35,no,')
  })
})

describe('live durations and responsive layout', () => {
  it('active event duration advances with the clock', () => {
    vi.useFakeTimers()
    mount()
    fireEvent.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(rows()[0]).toHaveTextContent('0s')
    clockNow += 65_000
    act(() => void vi.advanceTimersByTime(1000))
    expect(rows()[0]).toHaveTextContent('1m 05s')
  })
  it('uses responsive containers: scrollable table wrapper, stacking grids, 3-column mobile nav', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: /trigger breach/i }))
    expect(screen.getByTestId('events-table').parentElement).toHaveClass('overflow-x-auto')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveClass('grid-cols-3')
    expect(screen.getByTestId('humidity-card').parentElement).toHaveClass('grid-cols-1', 'md:grid-cols-5')
  })
})
