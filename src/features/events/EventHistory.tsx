import { Download, History } from 'lucide-react'
import type { BreachEvent } from '../../types'
import { Button, Pill } from '../../components/ui'
import { eventDurationMs } from '../monitoring/engine'
import { downloadCsv, eventsToCsv } from './csv'
import { formatDateTime, formatDuration } from '../../utils/format'

export function ExportButton({ events, now }: { events: BreachEvent[]; now: number }) {
  return (
    <Button disabled={events.length === 0} onClick={() => downloadCsv(eventsToCsv(events, now), `filamentguard-events-${new Date(now).toISOString().slice(0, 10)}.csv`)}>
      <Download className="h-4 w-4" aria-hidden />Export CSV
    </Button>
  )
}

export function EventHistory({ events, now }: { events: BreachEvent[]; now: number }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-ink-600 px-4 py-10 text-center" data-testid="events-empty">
        <History className="h-6 w-6 text-slate-500" aria-hidden />
        <p className="text-sm font-medium text-slate-200">No breach events recorded</p>
        <p className="max-w-sm text-xs text-slate-400">Events appear here when humidity exceeds the selected material's threshold. Use the simulator to trigger one.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm" data-testid="events-table">
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr className="border-b border-ink-700">
            {['Event', 'Start', 'End', 'Duration', 'Peak', 'Material', 'Acknowledged'].map((h) => <th key={h} scope="col" className="px-2 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-ink-800" data-testid="event-row">
              <td className="px-2 py-2 font-mono text-xs">{e.id}</td>
              <td className="px-2 py-2">{formatDateTime(e.startedAt)}</td>
              <td className="px-2 py-2">{e.endedAt === null ? <Pill tone="breach">Active</Pill> : formatDateTime(e.endedAt)}</td>
              <td className="px-2 py-2 font-mono">{formatDuration(eventDurationMs(e, now))}</td>
              <td className="px-2 py-2 font-mono">{e.peakHumidity.toFixed(1)}% RH</td>
              <td className="px-2 py-2">{e.material} <span className="text-xs text-slate-500">(&gt;{e.threshold}%)</span></td>
              <td className="px-2 py-2">{e.acknowledged ? <Pill tone="safe">Yes</Pill> : <Pill tone="warn">No</Pill>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
