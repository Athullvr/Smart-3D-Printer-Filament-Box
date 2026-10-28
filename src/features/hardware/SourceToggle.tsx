import type { SourceMode } from '../../types'

const OPTIONS: { value: SourceMode; label: string }[] = [
  { value: 'simulation', label: 'Simulation' },
  { value: 'hardware', label: 'Hardware (HTTP)' },
]

export function SourceToggle({ mode, hardwareAvailable, onChange }: { mode: SourceMode; hardwareAvailable: boolean; onChange: (m: SourceMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Data source" className="grid grid-cols-2 gap-1 rounded-md border border-ink-600 bg-ink-900 p-1">
      {OPTIONS.map((o) => {
        const checked = mode === o.value
        const disabled = o.value === 'hardware' && !hardwareAvailable
        return (
          <button key={o.value} type="button" role="radio" aria-checked={checked} disabled={disabled} onClick={() => !checked && onChange(o.value)}
            className={`rounded px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${checked ? 'bg-sensor text-ink-950' : 'text-slate-300 hover:bg-ink-800'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
