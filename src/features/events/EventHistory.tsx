import type { ReactNode } from 'react'
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
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-muted bg-ivory px-4 py-10 text-center" data-testid="events-empty">
        <History className="h-6 w-6 text-muted-ink" aria-hidden />
        <p className="font-display text-lg font-semibold text-graphite">No breach events recorded</p>
        <p className="max-w-sm text-sm text-muted-ink">Events appear here when humidity exceeds the selected material's threshold. Use the simulator to trigger one.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table role="table" className="block w-full text-left text-sm lg:table" data-testid="events-table">
        <thead role="rowgroup" className="sr-only lg:not-sr-only lg:table-header-group text-xs font-semibold uppercase tracking-wider text-muted-ink">
          <tr role="row" className="lg:table-row lg:border-b lg:border-graphite/30">
            {['Event', 'Start', 'End', 'Duration', 'Peak', 'Material', 'Acknowledged'].map((h) => <th key={h} role="columnheader" scope="col" className="px-2 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block lg:table-row-group">
          {events.map((e) => (
            <tr key={e.id} role="row" className="mb-3 block rounded-md border border-line bg-white p-3 lg:mb-0 lg:table-row lg:rounded-none lg:border-0 lg:border-b lg:border-line lg:bg-transparent lg:p-0" data-testid="event-row">
              <Cell label="Event" className="font-mono text-xs">{e.id}</Cell>
              <Cell label="Start">{formatDateTime(e.startedAt)}</Cell>
              <Cell label="End">{e.endedAt === null ? <Pill tone="breach">Active</Pill> : formatDateTime(e.endedAt)}</Cell>
              <Cell label="Duration" className="font-mono">{formatDuration(eventDurationMs(e, now))}</Cell>
              <Cell label="Peak" className="font-mono">{e.peakHumidity.toFixed(1)}% RH</Cell>
              <Cell label="Material"><span>{e.material} <span className="text-xs text-muted-ink">(&gt;{e.threshold}%)</span></span></Cell>
              <Cell label="Acknowledged">{e.acknowledged ? <Pill tone="safe">Yes</Pill> : <Pill tone="warn">No</Pill>}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cell({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <td role="cell" data-label={label} className={`flex items-center justify-between gap-3 py-1 before:text-xs before:font-semibold before:uppercase before:tracking-wider before:text-muted-ink before:content-[attr(data-label)] lg:table-cell lg:px-2 lg:py-2 lg:before:hidden ${className}`}>
      {children}
    </td>
  )
}
