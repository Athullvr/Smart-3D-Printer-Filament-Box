import { useState } from 'react'
import { PlugZap, RotateCcw } from 'lucide-react'
import type { HttpSensorState } from '../../services/sensor/httpSensor'
import { isValidEndpointUrl } from '../../services/sensor/contract'
import { Button, Pill } from '../../components/ui'
import { formatDateTime } from '../../utils/format'

const CONNECTION: Record<HttpSensorState['connection'], { label: string; tone: 'safe' | 'warn' | 'breach' | 'neutral' }> = {
  idle: { label: 'Idle', tone: 'neutral' },
  connecting: { label: 'Connecting', tone: 'warn' },
  connected: { label: 'Connected', tone: 'safe' },
  stale: { label: 'Stale data', tone: 'warn' },
  disconnected: { label: 'Disconnected', tone: 'breach' },
}

export function DevicePanel({ state, onApplyUrl, onReset }: { state: HttpSensorState; onApplyUrl: (url: string) => void; onReset: () => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? state.url
  const invalid = draft !== null && !isValidEndpointUrl(draft.trim())
  const c = CONNECTION[state.connection]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm"><PlugZap className="h-4 w-4 text-filament-ink" aria-hidden />Connection</span>
        <span data-testid="connection-state" data-state={state.connection}><Pill tone={c.tone}>{c.label.toUpperCase()}</Pill></span>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (draft !== null && !invalid) { onApplyUrl(draft.trim()); setDraft(null) } }}>
        <label htmlFor="endpoint-url" className="mb-1 block text-sm font-medium text-graphite">Sensor endpoint (GET, JSON)</label>
        <div className="flex gap-2">
          <input id="endpoint-url" type="url" value={text} onChange={(e) => setDraft(e.target.value)} aria-invalid={invalid}
            aria-describedby={invalid ? 'endpoint-error' : undefined}
            className={`min-h-11 min-w-0 flex-1 rounded-md border bg-white px-2 py-2 font-mono text-sm text-graphite ${invalid ? 'border-danger-ink border-2' : 'border-graphite/40'}`} />
          <Button type="submit" disabled={draft === null || invalid}>Apply</Button>
        </div>
        {invalid && <p id="endpoint-error" role="alert" className="mt-1 text-sm font-medium text-danger-ink">Enter a valid http:// or https:// URL.</p>}
      </form>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-ink">Device ID</dt><dd className="font-mono text-xs" data-testid="device-id">{state.deviceId ?? '-'}</dd>
        <dt className="text-muted-ink">Last measurement</dt><dd>{state.lastMeasurementAt ? formatDateTime(state.lastMeasurementAt) : '-'}</dd>
        <dt className="text-muted-ink">Last received</dt><dd>{state.lastReceivedAt ? formatDateTime(state.lastReceivedAt) : '-'}</dd>
      </dl>
      {state.error && <p role="status" data-testid="device-error" className="rounded-md border border-dashed border-filament-ink bg-filament-tint p-2 text-sm text-filament-ink">{state.error}</p>}
      <p className="text-sm text-muted-ink">
        Read-only: this page only sends GET requests and cannot change or silence the device. Physical monitoring and alerts must run on the ESP32 itself.
        Tested against a mock endpoint only; no real ESP32 has been verified. Dashboard acknowledgement never silences the physical buzzer.
      </p>
      <Button variant="ghost" className="w-full border border-graphite/30" onClick={onReset}><RotateCcw className="h-4 w-4" aria-hidden />Reset demo data</Button>
    </div>
  )
}
