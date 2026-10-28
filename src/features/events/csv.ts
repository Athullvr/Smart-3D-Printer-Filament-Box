import type { BreachEvent } from '../../types'
import { eventDurationMs } from '../monitoring/engine'

export const CSV_HEADERS = [
  'event_id',
  'state',
  'start_time_iso',
  'end_time_iso',
  'duration_seconds',
  'peak_humidity_pct_rh',
  'material',
  'threshold_pct_rh',
  'acknowledged',
  'acknowledged_time_iso',
  'data_source',
] as const

/** RFC 4180 escaping: quote fields containing commas, quotes, CR or LF; double embedded quotes. */
export function escapeCsv(value: string | number | boolean | null): string {
  const s = value === null ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function eventsToCsv(events: BreachEvent[], now: number): string {
  const iso = (t: number | null) => (t === null ? '' : new Date(t).toISOString())
  const rows = events.map((e) =>
    [
      e.id,
      e.state,
      iso(e.startedAt),
      iso(e.endedAt),
      Math.floor(eventDurationMs(e, now) / 1000),
      e.peakHumidity,
      e.material,
      e.threshold,
      e.acknowledged ? 'yes' : 'no',
      iso(e.acknowledgedAt),
      e.source === 'esp32-dht11' ? 'esp32-dht11' : 'simulated',
    ].map(escapeCsv).join(','),
  )
  return [CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n'
}

export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
