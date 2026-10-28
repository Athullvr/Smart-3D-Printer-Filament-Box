import { Activity, AlertOctagon, CheckCircle2, Flame, Play, RotateCcw, Square, ZapOff } from 'lucide-react'
import type { SimulatedSensorProvider, SimulatorState } from '../../services/sensor/simulatedSensor'
import { SIM_HUMIDITY, SIM_TEMPERATURE } from '../../services/sensor/simulatedSensor'
import type { Settings } from '../../types'
import { Button } from '../../components/ui'
import { getThreshold } from '../settings/defaults'

export function SimulatorPanel({ provider, sim, settings, onReset }: {
  provider: SimulatedSensorProvider; sim: SimulatorState; settings: Settings; onReset: () => void
}) {
  const threshold = getThreshold(settings)
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="sim-humidity" className="flex justify-between text-sm font-medium text-graphite">
          <span>Humidity</span><span className="font-mono text-filament-ink">{sim.humidity.toFixed(1)} % RH</span>
        </label>
        <input id="sim-humidity" type="range" min={SIM_HUMIDITY.min} max={SIM_HUMIDITY.max} step={0.5} value={sim.humidity} aria-valuetext={`${sim.humidity.toFixed(1)} percent relative humidity`}
          onChange={(e) => provider.setHumidity(Number(e.target.value))} className="mt-1 h-8 w-full cursor-pointer accent-[#F47721]" />
      </div>
      <div>
        <label htmlFor="sim-temperature" className="flex justify-between text-sm font-medium text-graphite">
          <span>Temperature</span><span className="font-mono text-filament-ink">{sim.temperature.toFixed(1)} °C</span>
        </label>
        <input id="sim-temperature" type="range" min={SIM_TEMPERATURE.min} max={SIM_TEMPERATURE.max} step={0.5} value={sim.temperature} aria-valuetext={`${sim.temperature.toFixed(1)} degrees Celsius`}
          onChange={(e) => provider.setTemperature(Number(e.target.value))} className="mt-1 h-8 w-full cursor-pointer accent-[#F47721]" />
      </div>
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        <Button onClick={() => provider.setHumidity(Math.max(SIM_HUMIDITY.min, threshold - 8))}><CheckCircle2 className="h-4 w-4 text-safe-ink" aria-hidden />Set safe</Button>
        <Button onClick={() => provider.setHumidity(Math.min(SIM_HUMIDITY.max, threshold + 5))}><AlertOctagon className="h-4 w-4 text-danger-ink" aria-hidden />Trigger breach</Button>
        <Button onClick={() => provider.setHumidity(80)}><Flame className="h-4 w-4 text-filament-ink" aria-hidden />High humidity</Button>
        <Button onClick={() => provider.injectFault()}><ZapOff className="h-4 w-4 text-filament-ink" aria-hidden />Sensor fault</Button>
      </div>
      <div className="rounded-md border border-line bg-ivory p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-filament-ink" aria-hidden />Automatic simulation: <strong>{sim.auto ? 'RUNNING' : 'OFF'}</strong></span>
          {sim.auto
            ? <Button variant="primary" onClick={() => provider.stopAuto()}><Square className="h-4 w-4" aria-hidden />Stop auto</Button>
            : <Button variant="primary" onClick={() => provider.startAuto()}><Play className="h-4 w-4" aria-hidden />Start auto</Button>}
        </div>
        <p className="mt-2 text-sm text-muted-ink">Bounded random walk, 1 reading/second. Manual controls stop automatic mode.</p>
      </div>
      <Button variant="ghost" className="w-full border border-graphite/30" onClick={onReset}><RotateCcw className="h-4 w-4" aria-hidden />Reset demo</Button>
    </div>
  )
}
