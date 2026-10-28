import { Droplets, Thermometer } from 'lucide-react'
import type { MonitorState, Settings } from '../../types'
import { Pill } from '../../components/ui'
import { getThreshold } from '../settings/defaults'
import { formatTime } from '../../utils/format'

const STATE_LABEL = { safe: 'Within limit', breach: 'Over limit', unavailable: 'No valid reading', 'no-data': 'Awaiting data' } as const

export function MetricCards({ monitor, settings, hardware = false }: { monitor: MonitorState; settings: Settings; hardware?: boolean }) {
  const tag = hardware ? 'HARDWARE FEED' : 'SIMULATED'
  const r = monitor.lastReading
  const unavailable = monitor.status === 'unavailable'
  const h = !unavailable && r ? r.humidity : null
  const t = !unavailable && r ? r.temperature : null
  const threshold = getThreshold(settings)
  const tone = monitor.status === 'breach' ? 'text-danger-ink' : monitor.status === 'safe' ? 'text-safe-ink' : 'text-muted-ink'
  const pct = h === null ? 0 : Math.min(100, Math.max(0, h))
  const tickLabelLeft = Math.min(88, Math.max(12, threshold))

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      <div className="rounded-md border border-line bg-paper p-4 sm:p-5 md:col-span-3" data-testid="humidity-card">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-ink">
          <span className="flex items-center gap-2 font-medium text-graphite"><Droplets className="h-4 w-4" aria-hidden />Relative humidity</span>
          <Pill tone="sensor">{tag}</Pill>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className={`font-mono text-5xl font-semibold leading-none sm:text-6xl ${tone}`} data-testid="humidity-value">
            {h === null ? '--' : h.toFixed(1)}<span className="ml-1.5 text-xl text-muted-ink">% RH</span>
          </p>
          <span className={`text-sm font-semibold ${tone}`}>{STATE_LABEL[monitor.status]}</span>
        </div>

        <div className="mt-6" aria-hidden>
          <div className={`relative h-3 rounded-full border ${h === null ? 'border-dashed border-muted bg-ivory' : 'border-line bg-ivory'}`}>
            {h !== null && <div className={`absolute inset-y-0 left-0 rounded-full ${monitor.status === 'breach' ? 'bg-danger' : 'bg-safe'}`} style={{ width: `${pct}%` }} />}
            <div className="absolute -inset-y-1.5 w-0.5 bg-graphite" style={{ left: `${threshold}%` }} />
          </div>
          <div className="relative mt-2 h-4 text-xs text-muted-ink">
            <span className="absolute left-0">0</span>
            <span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-graphite" style={{ left: `${tickLabelLeft}%` }}>Limit {threshold}%</span>
            <span className="absolute right-0">100% RH</span>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-ink">
          {settings.material} limit <span className="font-mono font-semibold text-graphite">{threshold}% RH</span> (provisional demonstration value)
        </p>
        <p className="mt-1 text-xs text-muted-ink">{r && !unavailable ? `Updated ${formatTime(r.timestamp)}` : unavailable ? 'Sensor data unavailable' : 'No reading yet'}</p>
      </div>

      <div className="rounded-md border border-line bg-paper p-4 sm:p-5 md:col-span-2" data-testid="temperature-card">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-ink">
          <span className="flex items-center gap-2 font-medium text-graphite"><Thermometer className="h-4 w-4" aria-hidden />Temperature</span>
          <Pill tone="sensor">{tag}</Pill>
        </div>
        <p className="mt-3 font-mono text-5xl font-semibold leading-none text-graphite" data-testid="temperature-value">
          {t === null ? '--' : t.toFixed(1)}<span className="ml-1.5 text-xl text-muted-ink">°C</span>
        </p>
        <p className="mt-6 text-sm text-muted-ink">Informational only; no temperature threshold is configured.</p>
        <p className="mt-1 text-xs text-muted-ink">{r && !unavailable ? `Updated ${formatTime(r.timestamp)}` : 'No reading'}</p>
      </div>
    </div>
  )
}
