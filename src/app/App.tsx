import { useState } from 'react'
import { AlertCircle, FlaskConical } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { Hero } from '../features/dashboard/Hero'
import { useActiveSection } from '../hooks/useActiveSection'
import { Card, ConfirmDialog, Pill } from '../components/ui'
import { useFilamentGuard, useHardware, useSimulator } from '../hooks/useFilamentGuard'
import type { SourceMode } from '../types'
import { HttpSensorProvider } from '../services/sensor/httpSensor'
import type { SensorProvider } from '../services/sensor/types'
import { DevicePanel } from '../features/hardware/DevicePanel'
import type { SimulatedSensorProvider } from '../services/sensor/simulatedSensor'
import type { StorageService } from '../services/storage/storage'
import { StatusBanner } from '../features/monitoring/StatusBanner'
import { MetricCards } from '../features/monitoring/MetricCards'
import { HumidityChart } from '../features/monitoring/HumidityChart'
import { SimulatorPanel } from '../features/simulator/SimulatorPanel'
import { MaterialSettings } from '../features/settings/MaterialSettings'
import { EventHistory, ExportButton } from '../features/events/EventHistory'

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'monitor', label: 'Live Monitor' },
  { id: 'events', label: 'Events' },
  { id: 'device', label: 'Device' },
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
]
const NAV_IDS = NAV.map((n) => n.id)

const fallbackHardware = new HttpSensorProvider()

export interface AppProps {
  sensor: SimulatedSensorProvider
  /** Optional hardware (HTTP) provider; without it the app is simulation-only. */
  hardware?: HttpSensorProvider
  storage: StorageService
  clock?: () => number
}

export function App({ sensor, hardware, storage, clock }: AppProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [mode, setMode] = useState<SourceMode>(() => (hardware && storage.load().connection.mode === 'hardware' ? 'hardware' : 'simulation'))
  const isHardware = mode === 'hardware' && !!hardware
  const active: SensorProvider = isHardware ? hardware : sensor
  const fg = useFilamentGuard({ sensor: active, storage, clock, onReset: () => { if (!isHardware) sensor.reset() } })
  const sim = useSimulator(sensor, storage)
  const { state, now } = fg
  const hw = useHardware(hardware ?? fallbackHardware)

  const saveConnection = (m: SourceMode, endpointUrl: string) => storage.saveConnection({ mode: m, endpointUrl })
  const switchMode = (m: SourceMode) => {
    setMode(m)
    if (hardware) saveConnection(m, hardware.getState().url)
  }
  const applyUrl = (url: string) => {
    if (hardware?.setUrl(url)) saveConnection(mode, url)
  }

  const [activeSection, setActiveSection] = useActiveSection(NAV_IDS)

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-filament focus:px-3 focus:py-2 focus:font-semibold focus:text-graphite">Skip to content</a>
      <header data-surface="dark" className="z-40 bg-charcoal text-ivory lg:sticky lg:top-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <a href="#dashboard" className="flex min-h-11 items-center gap-2.5" onClick={() => setActiveSection('dashboard')}>
            <BrandMark />
            <span className="font-display text-2xl font-bold tracking-tight text-ivory">FilamentGuard</span>
          </a>
          <nav aria-label="Primary" className="order-3 grid w-full grid-cols-3 gap-1 text-center text-sm lg:order-none lg:flex lg:w-auto">
            {NAV.map((n) => {
              const current = activeSection === n.id
              return (
                <a key={n.id} href={`#${n.id}`} aria-current={current ? 'location' : undefined} onClick={() => setActiveSection(n.id)}
                  className={`flex min-h-11 items-center justify-center rounded px-3 py-2 transition-colors ${current ? 'bg-filament font-semibold text-graphite' : 'text-ivory hover:bg-white/10'}`}>
                  {n.label}
                </a>
              )
            })}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#B9BDB4]">Unit: <span className="font-medium text-ivory">Dry Box Unit 01</span></span>
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-filament px-2 py-1 text-xs font-bold tracking-wider text-filament">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />{isHardware ? 'HARDWARE MODE (UNVERIFIED)' : 'SIMULATION MODE'}
            </span>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 px-4 py-6 focus:outline-none">
        {fg.storageMessages.length > 0 && (
          <div role="alert" data-testid="storage-warning" className="flex items-start gap-2 rounded-md border border-dashed border-filament-ink bg-filament-tint p-3 text-sm text-filament-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <ul>{fg.storageMessages.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}

        <Hero monitor={state.monitor} settings={state.settings} mode={mode} hardwareAvailable={!!hardware} onMode={switchMode} />
        <StatusBanner monitor={state.monitor} settings={state.settings} onAcknowledge={fg.acknowledge} hardware={isHardware} />
        <MetricCards monitor={state.monitor} settings={state.settings} hardware={isHardware} />

        <Card id="monitor" title="Live monitor" subtitle={`Humidity history from the ${isHardware ? 'hardware feed' : 'simulator'}, last 120 samples`}>
          <HumidityChart samples={state.samples} settings={state.settings} hardware={isHardware} />
        </Card>

        <Card id="events" title="Recent events" subtitle={`${state.monitor.events.length} breach event(s) recorded, newest first`} action={<ExportButton events={state.monitor.events} now={now} />}>
          <EventHistory events={state.monitor.events} now={now} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="device" title={isHardware ? 'Device and quick actions' : 'Quick actions'}
            subtitle={isHardware ? 'Hardware sensor polled over HTTP' : 'Sensor simulator: feeds the same engine a physical sensor will use'}
            action={<Pill tone="warn">{isHardware ? 'MOCK-TESTED ONLY' : 'NO HARDWARE'}</Pill>}>
            {isHardware
              ? <DevicePanel state={hw} onApplyUrl={applyUrl} onReset={() => setConfirmReset(true)} />
              : <SimulatorPanel provider={sensor} sim={sim} settings={state.settings} onReset={() => setConfirmReset(true)} />}
          </Card>
          <Card id="settings" title="Material and thresholds" subtitle="Humidity limit for each filament profile">
            <MaterialSettings settings={state.settings} onMaterial={fg.setMaterial} onThreshold={fg.setThreshold} />
          </Card>
        </div>

        <Card id="about" title="About this prototype" subtitle="FilamentGuard, milestone 1 (EDIS capstone)">
          <div className="grid gap-4 text-sm leading-relaxed text-graphite md:grid-cols-3">
            <p><strong className="font-semibold">What it does.</strong> Evaluates each humidity reading against the limit of the stored material, opens one event per breach, keeps the peak, and closes it when conditions recover. Events and settings persist in this browser.</p>
            <p><strong className="font-semibold">What is provisional.</strong> Material limits are demonstration values you can edit, not universal safety limits. The hardware path is tested against a mock endpoint only.</p>
            <p><strong className="font-semibold">What stays on the device.</strong> Real protection must come from firmware alerts on the ESP32. This page is a read-only viewer, and acknowledging here does not silence a physical buzzer.</p>
          </div>
        </Card>

        <footer className="pb-6 pt-2 text-center text-sm text-muted-ink">
          {isHardware
            ? 'FilamentGuard prototype: hardware mode reads an HTTP endpoint that has only been tested against a mock. No real ESP32 or DHT11 has been verified.'
            : 'FilamentGuard prototype: all data is simulated. No ESP32 or DHT11 hardware is connected.'}
        </footer>
      </main>

      {confirmReset && (
        <ConfirmDialog
          title="Reset demo?"
          message="This permanently erases all breach events, humidity history and saved settings, and restores default thresholds and simulator values."
          confirmLabel="Erase and reset"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => { setConfirmReset(false); fg.resetDemo() }}
        />
      )}
    </div>
  )
}
