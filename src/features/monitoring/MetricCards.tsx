import { Droplets, Thermometer } from 'lucide-react'
import type { MonitorState, Settings } from '../../types'
import { Pill } from '../../components/ui'
import { getThreshold } from '../settings/defaults'
import { formatTime } from '../../utils/format'

export function MetricCards({ monitor, settings, hardware = false }: { monitor: MonitorState; settings: Settings; hardware?: boolean }) {
  const tag = hardware ? 'HARDWARE FEED' : 'SIMULATED'
  const r = monitor.lastReading
  const unavailable = monitor.status === 'unavailable'
  const h = !unavailable && r ? r.humidity : null
  const t = !unavailable && r ? r.temperature : null
  const threshold = getThreshold(settings)
  const tone = monitor.status === 'breach' ? 'text-breach' : monitor.status === 'safe' ? 'text-safe' : 'text-slate-400'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-ink-700 bg-ink-850 p-4" data-testid="humidity-card">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span className="flex items-center gap-2"><Droplets className="h-4 w-4 text-sensor" aria-hidden />Relative humidity</span>
          <Pill tone="sensor">{tag}</Pill>
        </div>
        <p className={`mt-3 font-mono text-4xl font-semibold ${tone}`} data-testid="humidity-value">
          {h === null ? '--' : h.toFixed(1)}<span className="ml-1 text-lg text-slate-400">% RH</span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Limit for {settings.material}: <span className="font-mono text-slate-200">{threshold}% RH</span> (provisional)
        </p>
        <p className="mt-1 text-xs text-slate-400">{r && !unavailable ? `Updated ${formatTime(r.timestamp)}` : unavailable ? 'Sensor data unavailable' : 'No reading yet'}</p>
      </div>
      <div className="rounded-lg border border-ink-700 bg-ink-850 p-4" data-testid="temperature-card">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-sensor" aria-hidden />Temperature</span>
          <Pill tone="sensor">{tag}</Pill>
        </div>
        <p className="mt-3 font-mono text-4xl font-semibold text-sensor" data-testid="temperature-value">
          {t === null ? '--' : t.toFixed(1)}<span className="ml-1 text-lg text-slate-400">°C</span>
        </p>
        <p className="mt-2 text-xs text-slate-400">Informational only; no temperature threshold is configured.</p>
        <p className="mt-1 text-xs text-slate-400">{r && !unavailable ? `Updated ${formatTime(r.timestamp)}` : 'No reading'}</p>
      </div>
    </div>
  )
}
