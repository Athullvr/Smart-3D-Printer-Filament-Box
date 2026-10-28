import type { SourceMode } from '../../types'

const OPTIONS: { value: SourceMode; label: string }[] = [
  { value: 'simulation', label: 'Simulation' },
  { value: 'hardware', label: 'Hardware (HTTP)' },
]

export function SourceToggle({ mode, hardwareAvailable, onChange }: { mode: SourceMode; hardwareAvailable: boolean; onChange: (m: SourceMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Data source" className="inline-grid w-full grid-cols-2 gap-1 rounded-md border border-graphite/40 bg-paper p-1 sm:w-auto">
      {OPTIONS.map((o) => {
        const checked = mode === o.value
        const disabled = o.value === 'hardware' && !hardwareAvailable
        return (
          <button key={o.value} type="button" role="radio" aria-checked={checked} disabled={disabled} onClick={() => !checked && onChange(o.value)}
            className={`min-h-11 rounded px-4 py-2 text-sm transition-colors disabled:opacity-45 ${checked ? 'bg-filament font-semibold text-graphite' : 'text-graphite hover:bg-ivory'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
