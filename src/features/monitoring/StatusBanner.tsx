import { AlertTriangle, BellOff, BellRing, CheckCircle2, CircleDashed, ServerCrash } from 'lucide-react'
import type { MonitorState, Settings } from '../../types'
import { Button } from '../../components/ui'
import { getActiveEvent, isBuzzerActive } from './engine'
import { getThreshold } from '../settings/defaults'

const THEME = {
  safe: 'border-safe/40 bg-safe/10',
  breach: 'border-breach/50 bg-breach/10',
  unavailable: 'border-warn/50 bg-warn/10',
  'no-data': 'border-ink-600 bg-ink-800',
} as const

export function StatusBanner({ monitor, settings, onAcknowledge }: { monitor: MonitorState; settings: Settings; onAcknowledge: () => void }) {
  const threshold = getThreshold(settings)
  const active = getActiveEvent(monitor.events)
  const buzzer = isBuzzerActive(monitor.events)
  const { status } = monitor

  let icon = <CircleDashed className="h-6 w-6 text-slate-400" aria-hidden />
  let title = 'AWAITING DATA'
  let detail = 'Waiting for the first sensor reading.'
  if (status === 'safe') {
    icon = <CheckCircle2 className="h-6 w-6 text-safe" aria-hidden />
    title = 'SAFE'
    detail = `Humidity is at or below the ${settings.material} threshold of ${threshold}% RH.`
  } else if (status === 'breach') {
    icon = <AlertTriangle className="h-6 w-6 text-breach" aria-hidden />
    title = 'HUMIDITY BREACH'
    detail = `Humidity is above the ${settings.material} threshold of ${threshold}% RH.`
  } else if (status === 'unavailable') {
    icon = <ServerCrash className="h-6 w-6 text-warn" aria-hidden />
    title = 'SENSOR DATA ERROR'
    detail = `${monitor.error ?? 'Sensor data unavailable.'} Storage condition cannot be confirmed.`
  }

  return (
    <div role="status" aria-live="polite" data-testid="status-banner" data-status={status} className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${THEME[status]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <p className="text-lg font-semibold tracking-wide">{title}</p>
          <p className="text-sm text-slate-300">{detail}</p>
          {active && (
            <p className="mt-1 text-xs text-slate-400">
              Open event <span className="font-mono">{active.id}</span> is still being monitored{status === 'unavailable' ? ' (state unconfirmed while sensor data is unavailable)' : ''}.
            </p>
          )}
        </div>
      </div>
      {active && (
        <div className="flex flex-col gap-2 sm:items-end">
          <span data-testid="buzzer-state" data-active={buzzer} className={`inline-flex items-start gap-1.5 text-sm font-medium ${buzzer ? 'text-breach' : 'text-slate-400'}`}>
            {buzzer ? <BellRing className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <BellOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            {buzzer ? 'Buzzer (simulated): SOUNDING' : 'Buzzer (simulated): SILENCED'}
          </span>
          <Button variant="danger" className="w-full sm:w-auto" onClick={onAcknowledge} disabled={!buzzer}>
            {buzzer ? 'Acknowledge alert' : 'Acknowledged'}
          </Button>
        </div>
      )}
    </div>
  )
}
