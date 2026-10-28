import { AlertTriangle, BellOff, BellRing, CheckCircle2, CircleDashed, ServerCrash } from 'lucide-react'
import type { MonitorState, Settings } from '../../types'
import { Button } from '../../components/ui'
import { getActiveEvent, isBuzzerActive } from './engine'
import { getThreshold } from '../settings/defaults'

/** Each state differs in colour, border style, icon shape and text, so colour is never the only cue. */
const THEME = {
  safe: 'border-l-[10px] border-y border-r border-safe border-r-safe/40 border-y-safe/40 bg-safe-tint',
  breach: 'border-2 border-l-[10px] border-danger-ink bg-danger-tint',
  unavailable: 'border-2 border-dashed border-l-[10px] border-filament-ink bg-filament-tint',
  'no-data': 'border border-line border-l-[10px] border-l-muted bg-paper',
} as const
const TITLE_TONE = { safe: 'text-safe-ink', breach: 'text-danger-ink', unavailable: 'text-filament-ink', 'no-data': 'text-muted-ink' } as const

export function StatusBanner({ monitor, settings, onAcknowledge, hardware = false }: { monitor: MonitorState; settings: Settings; onAcknowledge: () => void; hardware?: boolean }) {
  const threshold = getThreshold(settings)
  const active = getActiveEvent(monitor.events)
  const buzzer = isBuzzerActive(monitor.events)
  const { status } = monitor
  const iconCls = `h-8 w-8 ${TITLE_TONE[status]}`

  let icon = <CircleDashed className={iconCls} aria-hidden />
  let title = 'AWAITING DATA'
  let detail = 'Waiting for the first sensor reading.'
  if (status === 'safe') {
    icon = <CheckCircle2 className={iconCls} aria-hidden />
    title = 'SAFE'
    detail = `Humidity is at or below the ${settings.material} threshold of ${threshold}% RH.`
  } else if (status === 'breach') {
    icon = <AlertTriangle className={iconCls} aria-hidden />
    title = 'HUMIDITY BREACH'
    detail = `Humidity is above the ${settings.material} threshold of ${threshold}% RH.`
  } else if (status === 'unavailable') {
    icon = <ServerCrash className={iconCls} aria-hidden />
    title = hardware && monitor.error?.includes('Cannot reach') ? 'SENSOR DISCONNECTED' : hardware && monitor.error?.includes('stale') ? 'SENSOR DATA STALE' : 'SENSOR DATA ERROR'
    detail = `${monitor.error ?? 'Sensor data unavailable.'} Storage condition cannot be confirmed.`
  }

  return (
    <div role="status" aria-live="polite" data-testid="status-banner" data-status={status} className={`flex flex-col gap-4 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${THEME[status]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <p className={`font-display text-2xl font-bold tracking-wide ${TITLE_TONE[status]}`}>{title}</p>
          <p className="mt-0.5 text-sm text-graphite">{detail}</p>
          {active && hardware && <p className="mt-1.5 text-sm text-muted-ink">Acknowledging here only affects this dashboard; the ESP32's own buzzer is controlled by its firmware.</p>}
          {active && (
            <p className="mt-1.5 text-sm text-muted-ink">
              Open event <span className="font-mono text-graphite">{active.id}</span> is still being monitored{status === 'unavailable' ? ' (state unconfirmed while sensor data is unavailable)' : ''}.
            </p>
          )}
        </div>
      </div>
      {active && (
        <div className="flex flex-col gap-2 sm:items-end">
          <span data-testid="buzzer-state" data-active={buzzer} className={`inline-flex items-start gap-1.5 text-sm font-semibold ${buzzer ? 'text-danger-ink' : 'text-muted-ink'}`}>
            {buzzer ? <BellRing className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <BellOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            {hardware ? (buzzer ? 'Dashboard alert: ACTIVE' : 'Dashboard alert: ACKNOWLEDGED') : buzzer ? 'Buzzer (simulated): SOUNDING' : 'Buzzer (simulated): SILENCED'}
          </span>
          <Button variant="danger" className="w-full sm:w-auto" onClick={onAcknowledge} disabled={!buzzer}>
            {buzzer ? 'Acknowledge alert' : 'Acknowledged'}
          </Button>
        </div>
      )}
    </div>
  )
}
