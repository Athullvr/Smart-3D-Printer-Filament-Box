import { useState } from 'react'
import { AlertCircle, FlaskConical, ShieldCheck } from 'lucide-react'
import { Card, ConfirmDialog, Pill } from '../components/ui'
import { useFilamentGuard, useSimulator } from '../hooks/useFilamentGuard'
import type { SimulatedSensorProvider } from '../services/sensor/simulatedSensor'
import type { StorageService } from '../services/storage/storage'
import { StatusBanner } from '../features/monitoring/StatusBanner'
import { MetricCards } from '../features/monitoring/MetricCards'
import { HumidityChart } from '../features/monitoring/HumidityChart'
import { SimulatorPanel } from '../features/simulator/SimulatorPanel'
import { MaterialSettings } from '../features/settings/MaterialSettings'
import { EventHistory, ExportButton } from '../features/events/EventHistory'

const NAV = [
  { href: '#dashboard', label: 'Dashboard' },
  { href: '#events', label: 'Events' },
  { href: '#settings', label: 'Settings' },
  { href: '#simulator', label: 'Simulator' },
]

export interface AppProps {
  sensor: SimulatedSensorProvider
  storage: StorageService
  clock?: () => number
}

export function App({ sensor, storage, clock }: AppProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const fg = useFilamentGuard({ sensor, storage, clock, onReset: () => sensor.reset() })
  const sim = useSimulator(sensor, storage)
  const { state, now } = fg

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-sensor focus:px-3 focus:py-2 focus:text-ink-950">Skip to content</a>
      <header className="lg:sticky lg:top-0 z-40 border-b border-ink-700 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-7 w-7 text-sensor" aria-hidden />
            <div className="leading-tight">
              <h1 className="text-base font-semibold">FilamentGuard</h1>
              <p className="text-xs text-slate-400">Smart Filament Storage Monitor</p>
            </div>
          </div>
          <nav aria-label="Primary" className="order-3 grid w-full grid-cols-4 gap-1 text-center text-xs sm:order-none sm:flex sm:w-auto sm:text-sm">
            {NAV.map((n) => <a key={n.href} href={n.href} className="rounded px-2.5 py-2 text-slate-300 hover:bg-ink-800 hover:text-white">{n.label}</a>)}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-300">Dry Box Unit 01</span>
            <span className="inline-flex items-center gap-1.5 rounded border border-warn/50 bg-warn/10 px-2 py-1 text-xs font-semibold tracking-wider text-warn">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />SIMULATION MODE
            </span>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        {fg.storageMessages.length > 0 && (
          <div role="alert" data-testid="storage-warning" className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <ul>{fg.storageMessages.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}

        <div id="dashboard" className="space-y-4">
          <StatusBanner monitor={state.monitor} settings={state.settings} onAcknowledge={fg.acknowledge} />
          <MetricCards monitor={state.monitor} settings={state.settings} />
          <Card title="Humidity over time" subtitle="Recent simulated readings (last 120 samples)">
            <HumidityChart samples={state.samples} settings={state.settings} />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="settings" title="Material & thresholds" subtitle="Per-material humidity limits">
            <MaterialSettings settings={state.settings} onMaterial={fg.setMaterial} onThreshold={fg.setThreshold} />
          </Card>
          <Card id="simulator" title="Sensor simulator" subtitle="Feeds the same monitoring engine a physical sensor will use" action={<Pill tone="warn">NO HARDWARE</Pill>}>
            <SimulatorPanel provider={sensor} sim={sim} settings={state.settings} onReset={() => setConfirmReset(true)} />
          </Card>
        </div>

        <Card id="events" title="Breach event history" subtitle={`${state.monitor.events.length} event(s) recorded`} action={<ExportButton events={state.monitor.events} now={now} />}>
          <EventHistory events={state.monitor.events} now={now} />
        </Card>

        <footer className="pb-6 pt-2 text-center text-xs text-slate-400">
          FilamentGuard prototype: all data is simulated. No ESP32 or DHT11 hardware is connected.
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
