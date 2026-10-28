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
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-graphite">
        <Pill tone="sensor">{hardware ? 'HARDWARE FEED (UNVERIFIED)' : 'SIMULATED DATA'}</Pill>
        <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-filament" />Humidity history ({history.length})</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-graphite bg-filament" />Current</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-danger-ink" />{settings.material} limit {threshold}% RH</span>
      </div>
      {samples.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-muted bg-ivory px-4 text-center text-sm text-muted-ink" data-testid="chart-empty">
          No humidity readings yet. Readings from the active source will appear here.
        </div>
      ) : (
        <div className="h-64 w-full sm:h-72" data-testid="humidity-chart" role="img" aria-label={`Line chart of ${samples.length} humidity readings against the ${settings.material} limit of ${threshold} percent RH. Latest: ${current?.humidity.toFixed(1)} percent RH.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
              <CartesianGrid stroke="#e7e0d2" strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" scale="time" domain={xDomain} allowDataOverflow tickFormatter={formatTime} stroke="#858982" tick={{ fontSize: 12, fill: '#5c615b' }} minTickGap={40}
                label={{ value: 'Time (local)', position: 'insideBottom', offset: -12, fill: '#5c615b', fontSize: 12 }} />
              <YAxis domain={[0, 100]} stroke="#858982" tick={{ fontSize: 12, fill: '#5c615b' }} width={44}
                label={{ value: 'Humidity (% RH)', angle: -90, position: 'insideLeft', fill: '#5c615b', fontSize: 12, style: { textAnchor: 'middle' } }} />
              <Tooltip contentStyle={{ background: '#fffcf7', border: '1px solid #202522', borderRadius: 4, color: '#202522', fontSize: 13 }} labelFormatter={(v) => formatTime(Number(v))}
                formatter={(v) => [`${Number(v).toFixed(1)} % RH`, 'Humidity']} />
              <ReferenceLine y={threshold} stroke="#b3322a" strokeDasharray="6 4" strokeWidth={2} />
              <Line type="monotone" dataKey="humidity" stroke="#f47721" strokeWidth={3} dot={false} isAnimationActive={false} />
              {current && <ReferenceDot x={current.timestamp} y={current.humidity} r={6} fill="#f47721" stroke="#202522" strokeWidth={2.5} ifOverflow="visible" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
