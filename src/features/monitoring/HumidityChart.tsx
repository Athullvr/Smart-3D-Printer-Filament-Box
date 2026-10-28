import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Sample, Settings } from '../../types'
import { Pill } from '../../components/ui'
import { getThreshold } from '../settings/defaults'
import { formatTime } from '../../utils/format'

export function HumidityChart({ samples, settings, hardware = false }: { samples: Sample[]; settings: Settings; hardware?: boolean }) {
  const threshold = getThreshold(settings)
  const history = samples.slice(0, -1)
  const current = samples[samples.length - 1]
  const first = samples[0]?.timestamp ?? 0
  const xDomain: [number, number] = current && current.timestamp > first ? [first, current.timestamp] : [first - 30_000, first + 30_000]
  const data = samples.map((s) => ({ t: s.timestamp, humidity: s.humidity }))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <Pill tone="sensor">{hardware ? 'HARDWARE FEED (UNVERIFIED)' : 'SIMULATED DATA'}</Pill>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-sensor" />Humidity history ({history.length})</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-sensor" />Current</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-breach" />{settings.material} limit {threshold}% RH</span>
      </div>
      {samples.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-ink-600 text-center text-sm text-slate-400" data-testid="chart-empty">
          No humidity readings yet. Readings from the active source will appear here.
        </div>
      ) : (
        <div className="h-64 w-full sm:h-72" data-testid="humidity-chart" role="img" aria-label={`Line chart of ${samples.length} simulated humidity readings against the ${settings.material} limit of ${threshold} percent RH. Latest: ${current?.humidity.toFixed(1)} percent RH.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
              <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" scale="time" domain={xDomain} allowDataOverflow tickFormatter={formatTime} stroke="#64748b" tick={{ fontSize: 11 }} minTickGap={40}
                label={{ value: 'Time (local)', position: 'insideBottom', offset: -12, fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} width={44}
                label={{ value: 'Humidity (% RH)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11, style: { textAnchor: 'middle' } }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #2c3b5c', fontSize: 12 }} labelFormatter={(v) => formatTime(Number(v))}
                formatter={(v) => [`${Number(v).toFixed(1)} % RH`, 'Humidity']} />
              <ReferenceLine y={threshold} stroke="#fb7185" strokeDasharray="6 4" strokeWidth={1.5} />
              <Line type="monotone" dataKey="humidity" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
              {current && <ReferenceDot x={current.timestamp} y={current.humidity} r={5} fill="#22d3ee" stroke="#fff" strokeWidth={2} ifOverflow="visible" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
