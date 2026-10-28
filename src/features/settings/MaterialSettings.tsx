import { useState } from 'react'
import { MATERIALS, type Material, type Settings } from '../../types'
import { Pill } from '../../components/ui'
import { isValidThreshold, THRESHOLD_MAX, THRESHOLD_MIN } from './defaults'

function ThresholdInput({ material, value, selected, onCommit }: { material: Material; value: number; selected: boolean; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? String(value)
  const parsed = text.trim() === '' ? NaN : Number(text)
  const invalid = draft !== null && !isValidThreshold(parsed)
  const errorId = `threshold-error-${material}`

  return (
    <div className={`rounded-md border px-3 py-2 ${selected ? 'border-graphite bg-ivory' : 'border-transparent'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`threshold-${material}`} className="w-14 text-sm font-medium text-graphite">{material}</label>
        <input id={`threshold-${material}`} type="number" inputMode="decimal" min={THRESHOLD_MIN} max={THRESHOLD_MAX} step={1} value={text}
          aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={() => {
            if (draft !== null && isValidThreshold(parsed)) onCommit(parsed)
            setDraft(null)
          }}
          className={`min-h-11 w-24 rounded-md border bg-white px-2 py-1.5 font-mono text-base text-graphite ${invalid ? 'border-danger-ink border-2' : 'border-graphite/40'}`} />
        <span className="text-sm text-muted-ink">% RH</span>
        {selected && <span className="ml-auto"><Pill tone="warn">IN USE</Pill></span>}
      </div>
      {invalid && <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-danger-ink">Enter a number from {THRESHOLD_MIN} to {THRESHOLD_MAX}. Value will not be applied.</p>}
    </div>
  )
}

export function MaterialSettings({ settings, onMaterial, onThreshold }: {
  settings: Settings; onMaterial: (m: Material) => void; onThreshold: (m: Material, v: number) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="material-select" className="mb-1 block text-sm font-medium text-graphite">Stored material</label>
        <select id="material-select" value={settings.material} onChange={(e) => onMaterial(e.target.value as Material)}
          className="min-h-11 w-full rounded-md border border-graphite/40 bg-white px-3 py-2 text-base text-graphite">
          {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <p className="mt-2 text-sm text-muted-ink" data-testid="selected-material-summary">
          Selected profile: <span className="font-semibold text-graphite">{settings.material}</span>, alert above <span className="font-mono font-semibold text-graphite">{settings.thresholds[settings.material]}% RH</span> (provisional demonstration value)
        </p>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-graphite">Humidity thresholds</h3>
          <Pill tone="warn">PROVISIONAL</Pill>
        </div>
        <div className="space-y-1">
          {MATERIALS.map((m) => <ThresholdInput key={m} material={m} value={settings.thresholds[m]} selected={m === settings.material} onCommit={(v) => onThreshold(m, v)} />)}
        </div>
        <p className="mt-3 text-sm text-muted-ink">
          Demonstration values only, not universal safety limits. Breach when humidity is strictly greater than the threshold; equal is safe.
          Changing a threshold never alters existing events.
        </p>
      </div>
    </div>
  )
}
